import { describe, expect, it } from 'vitest';
import { allocateVlsm } from '../src/planner/vlsm.js';
import {
  blockSize,
  ipToNumber,
  prefixToSubnetMask,
  usableHostCount,
} from '../src/planner/ipUtils.js';

const exampleDepartments = [
  // Deliberately not in size order to exercise sorting.
  { name: 'IT', hosts: 10 },
  { name: 'Admin', hosts: 50 },
  { name: 'Servers', hosts: 5 },
  { name: 'Sales', hosts: 25 },
];

/**
 * Checks every property a correct VLSM plan must have, independent of the
 * exact addresses chosen.
 */
function assertValidPlan(result, baseCidr, departments) {
  const [baseIp, basePrefix] = baseCidr.split('/');
  const baseStart = ipToNumber(baseIp);
  const baseEnd = baseStart + blockSize(Number(basePrefix)) - 1;

  expect(result.allocations).toHaveLength(departments.length);

  const ranges = [];
  for (const a of result.allocations) {
    const dept = departments.find((d) => d.name === a.department);
    expect(dept, `unknown department ${a.department}`).toBeDefined();

    const net = ipToNumber(a.networkAddress);
    const bc = ipToNumber(a.broadcastAddress);
    const size = blockSize(a.prefix);

    // Enough usable hosts, and the smallest subnet that provides them.
    expect(a.usableHosts).toBe(usableHostCount(a.prefix));
    expect(a.usableHosts).toBeGreaterThanOrEqual(dept.hosts);
    if (a.prefix < 30) {
      // /30 is the smallest LAN subnet, so only check tightness above it.
      expect(usableHostCount(a.prefix + 1)).toBeLessThan(dept.hosts);
    }

    // Network and broadcast addresses are reserved and bound the subnet.
    expect(net % size).toBe(0); // aligned to its own block size
    expect(bc - net + 1).toBe(size);
    expect(ipToNumber(a.firstUsable)).toBe(net + 1);
    expect(ipToNumber(a.lastUsable)).toBe(bc - 1);
    expect(a.subnetMask).toBe(prefixToSubnetMask(a.prefix));
    expect(a.cidr).toBe(`${a.networkAddress}/${a.prefix}`);

    // Inside the base network.
    expect(net).toBeGreaterThanOrEqual(baseStart);
    expect(bc).toBeLessThanOrEqual(baseEnd);

    ranges.push([net, bc]);
  }

  // No two subnets overlap.
  ranges.sort((x, y) => x[0] - y[0]);
  for (let i = 1; i < ranges.length; i++) {
    expect(ranges[i][0]).toBeGreaterThan(ranges[i - 1][1]);
  }
}

describe('allocateVlsm – example network', () => {
  const result = allocateVlsm('192.168.10.0/24', exampleDepartments);

  it('succeeds and allocates every department', () => {
    expect(result.success).toBe(true);
    expect(result.unallocated).toEqual([]);
    expect(result.error).toBeUndefined();
    expect(result.baseNetwork).toBe('192.168.10.0/24');
  });

  it('produces a structurally valid VLSM plan', () => {
    assertValidPlan(result, '192.168.10.0/24', exampleDepartments);
  });

  it('allocates departments from largest to smallest', () => {
    expect(result.allocations.map((a) => a.department)).toEqual(['Admin', 'Sales', 'IT', 'Servers']);
    const hosts = result.allocations.map((a) => a.requestedHosts);
    expect(hosts).toEqual([...hosts].sort((a, b) => b - a));
  });

  it('packs subnets contiguously from the start of the base network', () => {
    let expectedNext = ipToNumber('192.168.10.0');
    for (const a of result.allocations) {
      expect(ipToNumber(a.networkAddress)).toBe(expectedNext);
      expectedNext = ipToNumber(a.broadcastAddress) + 1;
    }
  });

  it('matches the hand-worked VLSM answer', () => {
    // Worked by hand: 50 -> /26 (62 usable), 25 -> /27 (30), 10 -> /28 (14), 5 -> /29 (6).
    const summary = result.allocations.map((a) => [
      a.department, a.cidr, a.subnetMask, a.firstUsable, a.lastUsable, a.broadcastAddress, a.usableHosts,
    ]);
    expect(summary).toEqual([
      ['Admin', '192.168.10.0/26', '255.255.255.192', '192.168.10.1', '192.168.10.62', '192.168.10.63', 62],
      ['Sales', '192.168.10.64/27', '255.255.255.224', '192.168.10.65', '192.168.10.94', '192.168.10.95', 30],
      ['IT', '192.168.10.96/28', '255.255.255.240', '192.168.10.97', '192.168.10.110', '192.168.10.111', 14],
      ['Servers', '192.168.10.112/29', '255.255.255.248', '192.168.10.113', '192.168.10.118', '192.168.10.119', 6],
    ]);
  });

  it('reports address usage', () => {
    expect(result.addressesAvailable).toBe(256);
    expect(result.addressesRequired).toBe(64 + 32 + 16 + 8);
  });
});

describe('allocateVlsm – host count boundaries', () => {
  it('moves to a larger subnet when network + broadcast no longer fit', () => {
    // 62 hosts + 2 reserved = 64 -> /26; 63 hosts needs 65 addresses -> /25.
    expect(allocateVlsm('10.0.0.0/24', [{ name: 'A', hosts: 62 }]).allocations[0].prefix).toBe(26);
    expect(allocateVlsm('10.0.0.0/24', [{ name: 'A', hosts: 63 }]).allocations[0].prefix).toBe(25);
    expect(allocateVlsm('10.0.0.0/24', [{ name: 'A', hosts: 2 }]).allocations[0].prefix).toBe(30);
    expect(allocateVlsm('10.0.0.0/24', [{ name: 'A', hosts: 1 }]).allocations[0].prefix).toBe(30);
  });

  it('exactly fills the base network when requirements match its size', () => {
    const depts = [
      { name: 'A', hosts: 126 },
      { name: 'B', hosts: 62 },
      { name: 'C', hosts: 30 },
      { name: 'D', hosts: 30 },
    ];
    const result = allocateVlsm('192.168.1.0/24', depts);
    expect(result.success).toBe(true);
    assertValidPlan(result, '192.168.1.0/24', depts);
    expect(result.addressesRequired).toBe(256);
    expect(result.allocations.at(-1).broadcastAddress).toBe('192.168.1.255');
  });

  it('keeps input order for departments with equal requirements', () => {
    const result = allocateVlsm('10.0.0.0/24', [
      { name: 'First', hosts: 10 },
      { name: 'Second', hosts: 10 },
      { name: 'Big', hosts: 100 },
    ]);
    expect(result.allocations.map((a) => a.department)).toEqual(['Big', 'First', 'Second']);
  });

  it('works with a base network that is not a /24', () => {
    const depts = [
      { name: 'Campus', hosts: 1000 },
      { name: 'Lab', hosts: 300 },
      { name: 'WiFi', hosts: 500 },
      { name: 'Link', hosts: 2 },
    ];
    const result = allocateVlsm('172.16.0.0/20', depts);
    expect(result.success).toBe(true);
    assertValidPlan(result, '172.16.0.0/20', depts);
    expect(result.allocations[0].cidr).toBe('172.16.0.0/22');
    expect(result.allocations[1].cidr).toBe('172.16.4.0/23');
  });

  it('produces valid plans for many random requirement sets', () => {
    // Deterministic pseudo-random generator so failures are reproducible.
    let seed = 12345;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };

    for (let trial = 0; trial < 200; trial++) {
      const count = 1 + Math.floor(rand() * 8);
      const depts = Array.from({ length: count }, (_, i) => ({
        name: `Dept${i}`,
        hosts: 1 + Math.floor(rand() * 120),
      }));
      const result = allocateVlsm('10.20.0.0/22', depts);

      // Largest-first packing of power-of-two blocks fits iff the total fits.
      expect(result.success).toBe(result.addressesRequired <= 1024);
      if (result.success) {
        assertValidPlan(result, '10.20.0.0/22', depts);
      }
    }
  });
});

describe('allocateVlsm – requirements that do not fit', () => {
  it('reports when total demand exceeds the base network', () => {
    const result = allocateVlsm('192.168.10.0/24', [
      ...exampleDepartments,
      { name: 'Guests', hosts: 120 }, // needs a /25 (128), total would be 248 + ... > 256
      { name: 'Lab', hosts: 60 },
    ]);
    expect(result.success).toBe(false);
    expect(result.addressesRequired).toBeGreaterThan(result.addressesAvailable);
    expect(result.error).toMatch(/do not fit/);
    expect(result.unallocated.length).toBeGreaterThan(0);
    // Every department is either allocated or reported as unallocated.
    expect(result.allocations.length + result.unallocated.length).toBe(6);
    for (const u of result.unallocated) {
      expect(result.error).toContain(u.department);
    }
  });

  it('reports a single department larger than the base network', () => {
    const result = allocateVlsm('192.168.10.0/24', [{ name: 'Huge', hosts: 300 }]);
    expect(result.success).toBe(false);
    expect(result.allocations).toEqual([]);
    expect(result.unallocated).toEqual([
      { department: 'Huge', requestedHosts: 300, requiredPrefix: 23, blockSize: 512 },
    ]);
  });

  it('fails when network/broadcast overhead pushes demand over the limit', () => {
    // 254 hosts fit a /24 exactly, but one more host needs its own /30.
    expect(allocateVlsm('10.0.0.0/24', [{ name: 'A', hosts: 254 }]).success).toBe(true);
    const result = allocateVlsm('10.0.0.0/24', [
      { name: 'A', hosts: 254 },
      { name: 'B', hosts: 1 },
    ]);
    expect(result.success).toBe(false);
    expect(result.unallocated.map((u) => u.department)).toEqual(['B']);
  });
});

describe('allocateVlsm – input validation', () => {
  it('rejects an invalid base network', () => {
    expect(() => allocateVlsm('192.168.10.0', exampleDepartments)).toThrow();
    expect(() => allocateVlsm('192.168.300.0/24', exampleDepartments)).toThrow();
  });

  it('rejects a base address with host bits set', () => {
    expect(() => allocateVlsm('192.168.10.5/24', exampleDepartments)).toThrow(/192\.168\.10\.0\/24/);
  });

  it('rejects bad department lists', () => {
    expect(() => allocateVlsm('10.0.0.0/24', [])).toThrow();
    expect(() => allocateVlsm('10.0.0.0/24', [{ name: '', hosts: 5 }])).toThrow();
    expect(() => allocateVlsm('10.0.0.0/24', [{ name: 'A', hosts: 0 }])).toThrow();
    expect(() => allocateVlsm('10.0.0.0/24', [{ name: 'A', hosts: 2.5 }])).toThrow();
    expect(() => allocateVlsm('10.0.0.0/24', [{ name: 'A', hosts: '5' }])).toThrow();
    expect(() =>
      allocateVlsm('10.0.0.0/24', [
        { name: 'Sales', hosts: 5 },
        { name: 'sales', hosts: 5 },
      ]),
    ).toThrow(/Duplicate/);
  });

  it('does not mutate the input array', () => {
    const input = exampleDepartments.map((d) => ({ ...d }));
    const snapshot = JSON.stringify(input);
    allocateVlsm('192.168.10.0/24', input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
