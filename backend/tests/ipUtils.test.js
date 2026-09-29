import { describe, expect, it } from 'vitest';
import {
  blockSize,
  broadcastAddress,
  firstUsableIp,
  ipToNumber,
  isNetworkAddress,
  isValidPrefix,
  lastUsableIp,
  networkAddress,
  numberToIp,
  parseCidr,
  prefixForHosts,
  prefixToMaskNumber,
  prefixToSubnetMask,
  subnetMaskToPrefix,
  usableHostCount,
} from '../src/planner/ipUtils.js';

describe('ipToNumber / numberToIp', () => {
  it('converts known addresses to their 32-bit values', () => {
    expect(ipToNumber('0.0.0.0')).toBe(0);
    expect(ipToNumber('0.0.0.1')).toBe(1);
    expect(ipToNumber('0.0.1.0')).toBe(256);
    expect(ipToNumber('192.168.10.0')).toBe(192 * 2 ** 24 + 168 * 2 ** 16 + 10 * 2 ** 8);
    expect(ipToNumber('255.255.255.255')).toBe(2 ** 32 - 1);
  });

  it('never returns negative numbers for high addresses', () => {
    expect(ipToNumber('200.0.0.0')).toBeGreaterThan(0);
    expect(ipToNumber('255.255.255.255')).toBeGreaterThan(0);
  });

  it('converts numbers back to dotted decimal', () => {
    expect(numberToIp(0)).toBe('0.0.0.0');
    expect(numberToIp(2 ** 32 - 1)).toBe('255.255.255.255');
    expect(numberToIp(3232238080)).toBe('192.168.10.0');
  });

  it('round-trips a range of addresses', () => {
    const samples = ['10.0.0.1', '172.16.254.3', '192.168.10.127', '1.2.3.4', '224.0.0.251'];
    for (const ip of samples) {
      expect(numberToIp(ipToNumber(ip))).toBe(ip);
    }
    for (let n = 0; n < 2 ** 32; n += 16777259) {
      expect(ipToNumber(numberToIp(n))).toBe(n);
    }
  });

  it('rejects malformed addresses', () => {
    for (const bad of ['', '1.2.3', '1.2.3.4.5', '256.0.0.1', '1.2.3.-1', 'a.b.c.d', '01.2.3.4', '1..2.3']) {
      expect(() => ipToNumber(bad), bad).toThrow();
    }
    expect(() => ipToNumber(123)).toThrow(TypeError);
  });

  it('rejects out-of-range numbers', () => {
    expect(() => numberToIp(-1)).toThrow();
    expect(() => numberToIp(2 ** 32)).toThrow();
    expect(() => numberToIp(1.5)).toThrow();
  });
});

describe('CIDR / prefix handling', () => {
  it('parses CIDR notation', () => {
    expect(parseCidr('192.168.10.0/24')).toEqual({
      ip: '192.168.10.0',
      ipNumber: ipToNumber('192.168.10.0'),
      prefix: 24,
    });
    expect(parseCidr(' 10.0.0.0/8 ').prefix).toBe(8);
    expect(parseCidr('0.0.0.0/0').prefix).toBe(0);
  });

  it('rejects invalid CIDR strings', () => {
    for (const bad of ['192.168.10.0', '192.168.10.0/33', '192.168.10.0/-1', '192.168.10.0/', '192.168.10.0/24/1', '300.1.1.1/24']) {
      expect(() => parseCidr(bad), bad).toThrow();
    }
  });

  it('validates prefixes', () => {
    expect(isValidPrefix(0)).toBe(true);
    expect(isValidPrefix(32)).toBe(true);
    expect(isValidPrefix(33)).toBe(false);
    expect(isValidPrefix(-1)).toBe(false);
    expect(isValidPrefix(24.5)).toBe(false);
  });
});

describe('subnet masks', () => {
  it('computes masks for common prefixes', () => {
    expect(prefixToSubnetMask(0)).toBe('0.0.0.0');
    expect(prefixToSubnetMask(8)).toBe('255.0.0.0');
    expect(prefixToSubnetMask(24)).toBe('255.255.255.0');
    expect(prefixToSubnetMask(26)).toBe('255.255.255.192');
    expect(prefixToSubnetMask(27)).toBe('255.255.255.224');
    expect(prefixToSubnetMask(28)).toBe('255.255.255.240');
    expect(prefixToSubnetMask(29)).toBe('255.255.255.248');
    expect(prefixToSubnetMask(30)).toBe('255.255.255.252');
    expect(prefixToSubnetMask(32)).toBe('255.255.255.255');
  });

  it('mask has exactly `prefix` leading one bits for every prefix', () => {
    for (let p = 0; p <= 32; p++) {
      const mask = prefixToMaskNumber(p);
      const ones = mask.toString(2).replace(/0/g, '').length;
      expect(ones).toBe(p);
      expect(subnetMaskToPrefix(numberToIp(mask))).toBe(p);
    }
  });

  it('rejects non-contiguous masks', () => {
    expect(() => subnetMaskToPrefix('255.0.255.0')).toThrow();
    expect(() => subnetMaskToPrefix('255.255.255.1')).toThrow();
  });
});

describe('block size and usable hosts', () => {
  it('computes block sizes as powers of two', () => {
    expect(blockSize(24)).toBe(256);
    expect(blockSize(26)).toBe(64);
    expect(blockSize(30)).toBe(4);
    expect(blockSize(32)).toBe(1);
    expect(blockSize(0)).toBe(2 ** 32);
  });

  it('subtracts network and broadcast for normal subnets', () => {
    for (let p = 0; p <= 30; p++) {
      expect(usableHostCount(p)).toBe(blockSize(p) - 2);
    }
    expect(usableHostCount(31)).toBe(2);
    expect(usableHostCount(32)).toBe(1);
  });

  it('chooses the smallest prefix that fits the hosts', () => {
    expect(prefixForHosts(1)).toBe(30);
    expect(prefixForHosts(2)).toBe(30);
    expect(prefixForHosts(3)).toBe(29);
    expect(prefixForHosts(6)).toBe(29);
    expect(prefixForHosts(7)).toBe(28);
    expect(prefixForHosts(62)).toBe(26);
    expect(prefixForHosts(63)).toBe(25);
    expect(prefixForHosts(254)).toBe(24);
    expect(prefixForHosts(255)).toBe(23);
  });

  it('prefixForHosts always returns the tightest fit', () => {
    for (let hosts = 1; hosts <= 5000; hosts++) {
      const p = prefixForHosts(hosts);
      expect(usableHostCount(p)).toBeGreaterThanOrEqual(hosts);
      if (p < 30) {
        // One size smaller would not be enough.
        expect(usableHostCount(p + 1)).toBeLessThan(hosts);
      }
    }
  });

  it('rejects invalid host counts', () => {
    expect(() => prefixForHosts(0)).toThrow();
    expect(() => prefixForHosts(-5)).toThrow();
    expect(() => prefixForHosts(2.5)).toThrow();
    expect(() => prefixForHosts(2 ** 32)).toThrow();
  });
});

describe('network, broadcast and usable range', () => {
  it('computes addresses for a host inside a /26', () => {
    expect(networkAddress('192.168.10.77', 26)).toBe('192.168.10.64');
    expect(broadcastAddress('192.168.10.77', 26)).toBe('192.168.10.127');
    expect(firstUsableIp('192.168.10.77', 26)).toBe('192.168.10.65');
    expect(lastUsableIp('192.168.10.77', 26)).toBe('192.168.10.126');
  });

  it('handles subnets that cross octet boundaries', () => {
    expect(networkAddress('10.1.130.5', 17)).toBe('10.1.128.0');
    expect(broadcastAddress('10.1.130.5', 17)).toBe('10.1.255.255');
    expect(networkAddress('172.31.255.255', 12)).toBe('172.16.0.0');
    expect(broadcastAddress('172.16.0.0', 12)).toBe('172.31.255.255');
  });

  it('handles the edges of the address space', () => {
    expect(networkAddress('255.255.255.255', 24)).toBe('255.255.255.0');
    expect(broadcastAddress('255.255.255.0', 24)).toBe('255.255.255.255');
    expect(networkAddress('123.45.67.89', 0)).toBe('0.0.0.0');
    expect(broadcastAddress('123.45.67.89', 0)).toBe('255.255.255.255');
  });

  it('handles /31 and /32 special cases', () => {
    expect(firstUsableIp('10.0.0.5', 31)).toBe('10.0.0.4');
    expect(lastUsableIp('10.0.0.5', 31)).toBe('10.0.0.5');
    expect(firstUsableIp('10.0.0.5', 32)).toBe('10.0.0.5');
    expect(lastUsableIp('10.0.0.5', 32)).toBe('10.0.0.5');
  });

  it('satisfies subnet invariants for every prefix', () => {
    const ip = '203.0.113.201';
    for (let p = 0; p <= 30; p++) {
      const net = ipToNumber(networkAddress(ip, p));
      const bc = ipToNumber(broadcastAddress(ip, p));
      expect(bc - net + 1).toBe(blockSize(p));
      expect(net % blockSize(p)).toBe(0);
      expect(net).toBeLessThanOrEqual(ipToNumber(ip));
      expect(bc).toBeGreaterThanOrEqual(ipToNumber(ip));
      expect(ipToNumber(firstUsableIp(ip, p))).toBe(net + 1);
      expect(ipToNumber(lastUsableIp(ip, p))).toBe(bc - 1);
      expect(ipToNumber(lastUsableIp(ip, p)) - ipToNumber(firstUsableIp(ip, p)) + 1).toBe(usableHostCount(p));
    }
  });

  it('detects whether an address is a network address', () => {
    expect(isNetworkAddress('192.168.10.0', 24)).toBe(true);
    expect(isNetworkAddress('192.168.10.64', 26)).toBe(true);
    expect(isNetworkAddress('192.168.10.64', 25)).toBe(false);
    expect(isNetworkAddress('192.168.10.5', 24)).toBe(false);
  });
});
