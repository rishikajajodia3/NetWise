import { describe, expect, it } from 'vitest';
import {
  buildNetworkPlan,
  GATEWAY_ADDRESSES,
  PlanValidationError,
  VLAN_START,
  VLAN_STEP,
} from '../src/planner/planBuilder.js';
import { allocateVlsm } from '../src/planner/vlsm.js';
import { blockSize, ipToNumber, prefixToSubnetMask } from '../src/planner/ipUtils.js';

const exampleRequirements = {
  baseNetwork: '192.168.10.0/24',
  departments: [
    { name: 'Admin', hosts: 50 },
    { name: 'Sales', hosts: 25 },
    { name: 'IT', hosts: 10 },
    { name: 'Servers', hosts: 5 },
  ],
};

describe('buildNetworkPlan – 192.168.10.0/24 example', () => {
  const plan = buildNetworkPlan(exampleRequirements);

  it('succeeds with a summary of the plan', () => {
    expect(plan.success).toBe(true);
    expect(plan.error).toBeUndefined();
    expect(plan.unallocatedDepartments).toEqual([]);
    expect(plan.summary).toEqual({
      baseNetwork: '192.168.10.0/24',
      totalDepartments: 4,
      totalRequestedHosts: 50 + 25 + 10 + 5,
      totalUsableAddressesAllocated: 62 + 30 + 14 + 6,
      success: true,
    });
  });

  it('matches the hand-worked plan', () => {
    const rows = plan.departments.map((d) => [
      d.name, d.vlanId, d.requiredHosts, d.cidr, d.subnetMask,
      d.defaultGateway, d.firstUsable, d.lastUsable, d.broadcastAddress, d.usableHosts,
    ]);
    expect(rows).toEqual([
      ['Admin', 10, 50, '192.168.10.0/26', '255.255.255.192', '192.168.10.1', '192.168.10.1', '192.168.10.62', '192.168.10.63', 62],
      ['Sales', 20, 25, '192.168.10.64/27', '255.255.255.224', '192.168.10.65', '192.168.10.65', '192.168.10.94', '192.168.10.95', 30],
      ['IT', 30, 10, '192.168.10.96/28', '255.255.255.240', '192.168.10.97', '192.168.10.97', '192.168.10.110', '192.168.10.111', 14],
      ['Servers', 40, 5, '192.168.10.112/29', '255.255.255.248', '192.168.10.113', '192.168.10.113', '192.168.10.118', '192.168.10.119', 6],
    ]);
  });

  it('returns every required field for each department', () => {
    for (const d of plan.departments) {
      expect(Object.keys(d).sort()).toEqual([
        'broadcastAddress', 'cidr', 'defaultGateway', 'firstUsable', 'lastUsable', 'name',
        'networkAddress', 'prefix', 'requiredHosts', 'subnetMask', 'usableHosts', 'vlanId',
      ]);
    }
  });

  it('is plain JSON-serialisable data', () => {
    expect(JSON.parse(JSON.stringify(plan))).toEqual(plan);
  });
});

describe('buildNetworkPlan – VLAN IDs', () => {
  it('assigns 10, 20, 30, ... in allocation order', () => {
    const plan = buildNetworkPlan(exampleRequirements);
    plan.departments.forEach((d, i) => expect(d.vlanId).toBe(VLAN_START + i * VLAN_STEP));
    expect(plan.departments.map((d) => d.vlanId)).toEqual([10, 20, 30, 40]);
  });

  it('produces unique, ascending VLAN IDs for many departments', () => {
    const departments = Array.from({ length: 30 }, (_, i) => ({ name: `Dept ${i}`, hosts: 2 + (i % 7) }));
    const plan = buildNetworkPlan({ baseNetwork: '10.0.0.0/16', departments });
    const ids = plan.departments.map((d) => d.vlanId);
    expect(new Set(ids).size).toBe(30);
    expect(ids[0]).toBe(10);
    expect(ids.at(-1)).toBe(300);
    for (let i = 1; i < ids.length; i++) expect(ids[i] - ids[i - 1]).toBe(10);
  });

  it('keeps VLAN IDs ascending with subnet addresses', () => {
    const plan = buildNetworkPlan(exampleRequirements);
    for (let i = 1; i < plan.departments.length; i++) {
      expect(ipToNumber(plan.departments[i].networkAddress))
        .toBeGreaterThan(ipToNumber(plan.departments[i - 1].networkAddress));
    }
  });
});

describe('buildNetworkPlan – default gateway', () => {
  it('uses the first usable IP of each subnet', () => {
    const plan = buildNetworkPlan({
      baseNetwork: '172.16.0.0/20',
      departments: [
        { name: 'Campus', hosts: 900 },
        { name: 'Lab', hosts: 120 },
        { name: 'Link', hosts: 1 },
      ],
    });
    for (const d of plan.departments) {
      expect(d.defaultGateway).toBe(d.firstUsable);
      expect(ipToNumber(d.defaultGateway)).toBe(ipToNumber(d.networkAddress) + 1);
    }
  });

  it('leaves room for the required hosts after the gateway takes an address', () => {
    // 62 hosts alone would fit a /26 (62 usable), but not once the gateway is added.
    const plan = buildNetworkPlan({ baseNetwork: '10.0.0.0/24', departments: [{ name: 'A', hosts: 62 }] });
    const [d] = plan.departments;
    expect(d.prefix).toBe(25);
    expect(d.usableHosts - GATEWAY_ADDRESSES).toBeGreaterThanOrEqual(62);

    for (let hosts = 1; hosts <= 300; hosts++) {
      const [dept] = buildNetworkPlan({ baseNetwork: '10.0.0.0/16', departments: [{ name: 'X', hosts }] }).departments;
      expect(dept.usableHosts - GATEWAY_ADDRESSES).toBeGreaterThanOrEqual(hosts);
    }
  });
});

describe('buildNetworkPlan – consistency with allocateVlsm', () => {
  it('copies every value from the VLSM allocation', () => {
    const plan = buildNetworkPlan(exampleRequirements);
    const vlsm = allocateVlsm(
      exampleRequirements.baseNetwork,
      exampleRequirements.departments.map((d) => ({ name: d.name, hosts: d.hosts + GATEWAY_ADDRESSES })),
    );

    expect(plan.departments).toHaveLength(vlsm.allocations.length);
    plan.departments.forEach((d, i) => {
      const a = vlsm.allocations[i];
      expect(d.name).toBe(a.department);
      expect(d.networkAddress).toBe(a.networkAddress);
      expect(d.prefix).toBe(a.prefix);
      expect(d.cidr).toBe(a.cidr);
      expect(d.subnetMask).toBe(a.subnetMask);
      expect(d.firstUsable).toBe(a.firstUsable);
      expect(d.lastUsable).toBe(a.lastUsable);
      expect(d.broadcastAddress).toBe(a.broadcastAddress);
      expect(d.usableHosts).toBe(a.usableHosts);
    });
  });

  it('has internally consistent subnet values', () => {
    const plan = buildNetworkPlan(exampleRequirements);
    for (const d of plan.departments) {
      const net = ipToNumber(d.networkAddress);
      expect(d.subnetMask).toBe(prefixToSubnetMask(d.prefix));
      expect(ipToNumber(d.broadcastAddress)).toBe(net + blockSize(d.prefix) - 1);
      expect(ipToNumber(d.lastUsable)).toBe(ipToNumber(d.broadcastAddress) - 1);
    }
  });
});

describe('buildNetworkPlan – input order', () => {
  it('produces the same plan regardless of the order departments are entered', () => {
    const expected = buildNetworkPlan(exampleRequirements);
    const orders = [
      ['Servers', 'IT', 'Sales', 'Admin'],
      ['IT', 'Admin', 'Servers', 'Sales'],
      ['Sales', 'Servers', 'Admin', 'IT'],
    ];
    for (const order of orders) {
      const departments = order.map((name) => exampleRequirements.departments.find((d) => d.name === name));
      const plan = buildNetworkPlan({ baseNetwork: '192.168.10.0/24', departments });
      expect(plan).toEqual(expected);
    }
  });

  it('does not mutate the caller\'s requirements', () => {
    const input = structuredClone(exampleRequirements);
    buildNetworkPlan(input);
    expect(input).toEqual(exampleRequirements);
  });
});

describe('buildNetworkPlan – invalid input', () => {
  const invalidCases = [
    ['no argument', undefined],
    ['null', null],
    ['an array', []],
    ['a string', '192.168.10.0/24'],
    ['missing baseNetwork', { departments: exampleRequirements.departments }],
    ['empty baseNetwork', { baseNetwork: '  ', departments: exampleRequirements.departments }],
    ['non-string baseNetwork', { baseNetwork: 42, departments: exampleRequirements.departments }],
    ['malformed CIDR', { baseNetwork: '192.168.10/24', departments: exampleRequirements.departments }],
    ['prefix out of range', { baseNetwork: '192.168.10.0/33', departments: exampleRequirements.departments }],
    ['host bits set', { baseNetwork: '192.168.10.5/24', departments: exampleRequirements.departments }],
    ['missing departments', { baseNetwork: '192.168.10.0/24' }],
    ['empty departments', { baseNetwork: '192.168.10.0/24', departments: [] }],
    ['department not an object', { baseNetwork: '192.168.10.0/24', departments: ['Admin'] }],
    ['department is null', { baseNetwork: '192.168.10.0/24', departments: [null] }],
    ['missing name', { baseNetwork: '192.168.10.0/24', departments: [{ hosts: 5 }] }],
    ['blank name', { baseNetwork: '192.168.10.0/24', departments: [{ name: ' ', hosts: 5 }] }],
    ['missing hosts', { baseNetwork: '192.168.10.0/24', departments: [{ name: 'A' }] }],
    ['zero hosts', { baseNetwork: '192.168.10.0/24', departments: [{ name: 'A', hosts: 0 }] }],
    ['negative hosts', { baseNetwork: '192.168.10.0/24', departments: [{ name: 'A', hosts: -3 }] }],
    ['fractional hosts', { baseNetwork: '192.168.10.0/24', departments: [{ name: 'A', hosts: 2.5 }] }],
    ['string hosts', { baseNetwork: '192.168.10.0/24', departments: [{ name: 'A', hosts: '5' }] }],
    ['duplicate names', {
      baseNetwork: '192.168.10.0/24',
      departments: [{ name: 'Sales', hosts: 5 }, { name: 'sales ', hosts: 5 }],
    }],
  ];

  it.each(invalidCases)('rejects %s with a PlanValidationError', (_label, input) => {
    expect(() => buildNetworkPlan(input)).toThrow(PlanValidationError);
  });

  it('gives a helpful message', () => {
    expect(() => buildNetworkPlan({ baseNetwork: '192.168.10.5/24', departments: exampleRequirements.departments }))
      .toThrow(/192\.168\.10\.0\/24/);
    expect(() => buildNetworkPlan({ baseNetwork: '192.168.10.0/24', departments: [] }))
      .toThrow(/non-empty/);
  });

  it('rejects more departments than VLAN IDs allow', () => {
    const departments = Array.from({ length: 410 }, (_, i) => ({ name: `D${i}`, hosts: 1 }));
    expect(() => buildNetworkPlan({ baseNetwork: '10.0.0.0/8', departments })).toThrow(/VLAN/);
  });
});

describe('buildNetworkPlan – requirements that do not fit', () => {
  // A /26 has 64 addresses. Admin (50 + gateway) needs a /26 on its own,
  // leaving no room for Sales, IT or Servers.
  const plan = buildNetworkPlan({
    baseNetwork: '192.168.10.0/26',
    departments: exampleRequirements.departments,
  });

  it('reports failure instead of returning a partial plan', () => {
    expect(plan.success).toBe(false);
    expect(plan.summary).toEqual({
      baseNetwork: '192.168.10.0/26',
      totalDepartments: 4,
      totalRequestedHosts: 90,
      totalUsableAddressesAllocated: 0,
      success: false,
    });
    expect(plan.departments).toEqual([]);
    expect(plan.error).toMatch(/do not fit/);
  });

  it('lists the departments that could not be placed', () => {
    expect(plan.unallocatedDepartments).toEqual([
      { name: 'Sales', requiredHosts: 25, requiredPrefix: 27, requiredAddresses: 32 },
      { name: 'IT', requiredHosts: 10, requiredPrefix: 28, requiredAddresses: 16 },
      { name: 'Servers', requiredHosts: 5, requiredPrefix: 29, requiredAddresses: 8 },
    ]);
    for (const u of plan.unallocatedDepartments) {
      expect(plan.error).toContain(u.name);
    }
  });

  it('fails when a single department is larger than the base network', () => {
    const result = buildNetworkPlan({ baseNetwork: '10.0.0.0/24', departments: [{ name: 'Huge', hosts: 300 }] });
    expect(result.success).toBe(false);
    expect(result.unallocatedDepartments).toEqual([
      { name: 'Huge', requiredHosts: 300, requiredPrefix: 23, requiredAddresses: 512 },
    ]);
  });

  it('fails when the gateway address tips a department over its subnet size', () => {
    // 254 hosts + 1 gateway = 255 usable addresses needed; a /24 only has 254.
    expect(buildNetworkPlan({ baseNetwork: '10.0.0.0/24', departments: [{ name: 'A', hosts: 253 }] }).success).toBe(true);
    expect(buildNetworkPlan({ baseNetwork: '10.0.0.0/24', departments: [{ name: 'A', hosts: 254 }] }).success).toBe(false);
  });
});
