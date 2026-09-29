// Pure IPv4 helper functions. Addresses are handled internally as unsigned
// 32-bit integers (0 .. 2^32 - 1); every function returning a number applies
// `>>> 0` so results never come back as negative signed integers.

const MAX_IPV4 = 0xffffffff;

/**
 * Convert a dotted-decimal IPv4 string (e.g. "192.168.10.0") to an unsigned 32-bit number.
 * Throws on malformed input, including octets with leading zeros ("010").
 */
export function ipToNumber(ip) {
  if (typeof ip !== 'string') {
    throw new TypeError(`IPv4 address must be a string, got ${typeof ip}`);
  }

  const parts = ip.trim().split('.');
  if (parts.length !== 4) {
    throw new Error(`Invalid IPv4 address "${ip}": expected 4 octets`);
  }

  let result = 0;
  for (const part of parts) {
    if (!/^(0|[1-9]\d{0,2})$/.test(part)) {
      throw new Error(`Invalid IPv4 address "${ip}": bad octet "${part}"`);
    }
    const octet = Number(part);
    if (octet > 255) {
      throw new Error(`Invalid IPv4 address "${ip}": octet ${octet} is out of range`);
    }
    result = result * 256 + octet;
  }
  return result >>> 0;
}

/** Convert an unsigned 32-bit number to a dotted-decimal IPv4 string. */
export function numberToIp(num) {
  if (!Number.isInteger(num) || num < 0 || num > MAX_IPV4) {
    throw new Error(`Invalid IPv4 number: ${num}`);
  }
  return [
    (num >>> 24) & 255,
    (num >>> 16) & 255,
    (num >>> 8) & 255,
    num & 255,
  ].join('.');
}

/** True if `prefix` is an integer between 0 and 32. */
export function isValidPrefix(prefix) {
  return Number.isInteger(prefix) && prefix >= 0 && prefix <= 32;
}

function assertPrefix(prefix) {
  if (!isValidPrefix(prefix)) {
    throw new Error(`Invalid CIDR prefix: ${prefix} (must be an integer 0-32)`);
  }
}

/**
 * Parse CIDR notation such as "192.168.10.0/24".
 * Returns { ip, ipNumber, prefix }. Does not require the address to be a network address.
 */
export function parseCidr(cidr) {
  if (typeof cidr !== 'string') {
    throw new TypeError(`CIDR must be a string, got ${typeof cidr}`);
  }

  const pieces = cidr.trim().split('/');
  if (pieces.length !== 2 || !/^\d{1,2}$/.test(pieces[1])) {
    throw new Error(`Invalid CIDR notation "${cidr}": expected a.b.c.d/prefix`);
  }

  const prefix = Number(pieces[1]);
  assertPrefix(prefix);
  const ipNumber = ipToNumber(pieces[0]);
  return { ip: numberToIp(ipNumber), ipNumber, prefix };
}

/** Subnet mask for a prefix as an unsigned 32-bit number (e.g. 24 -> 0xffffff00). */
export function prefixToMaskNumber(prefix) {
  assertPrefix(prefix);
  // Shifting a 32-bit value by 32 is a no-op in JS, so /0 is handled explicitly.
  return prefix === 0 ? 0 : (MAX_IPV4 << (32 - prefix)) >>> 0;
}

/** Subnet mask for a prefix in dotted-decimal form (e.g. 26 -> "255.255.255.192"). */
export function prefixToSubnetMask(prefix) {
  return numberToIp(prefixToMaskNumber(prefix));
}

/**
 * Convert a dotted-decimal subnet mask back to its prefix length.
 * Throws if the mask is not a contiguous run of 1 bits followed by 0 bits.
 */
export function subnetMaskToPrefix(mask) {
  const maskNumber = ipToNumber(mask);
  const inverted = ~maskNumber >>> 0;
  // A valid mask's inverse is 2^n - 1, so inverted + 1 must be a power of two.
  if ((inverted & (inverted + 1)) !== 0) {
    throw new Error(`Invalid subnet mask "${mask}": bits are not contiguous`);
  }
  let prefix = 0;
  for (let bit = 31; bit >= 0 && (maskNumber >>> bit) & 1; bit--) {
    prefix++;
  }
  return prefix;
}

/** Total number of addresses in a subnet with this prefix (e.g. 26 -> 64). */
export function blockSize(prefix) {
  assertPrefix(prefix);
  return 2 ** (32 - prefix);
}

/**
 * Number of assignable host addresses for a prefix.
 * /0-/30 reserve the network and broadcast addresses. /31 (RFC 3021
 * point-to-point) has 2 usable addresses and /32 is a single host.
 */
export function usableHostCount(prefix) {
  assertPrefix(prefix);
  if (prefix === 32) return 1;
  if (prefix === 31) return 2;
  return blockSize(prefix) - 2;
}

/**
 * Smallest prefix whose subnet can hold `hosts` usable hosts plus a network
 * and broadcast address. Returns at most /30, since /31 and /32 have no
 * broadcast address and are not suitable for a LAN segment.
 */
export function prefixForHosts(hosts) {
  if (!Number.isInteger(hosts) || hosts < 1) {
    throw new Error(`Host count must be a positive integer, got ${hosts}`);
  }
  for (let prefix = 30; prefix >= 0; prefix--) {
    if (blockSize(prefix) - 2 >= hosts) {
      return prefix;
    }
  }
  throw new Error(`Host count ${hosts} is too large for IPv4`);
}

/** Network address (as a number) containing `ip` for the given prefix. */
export function networkAddressNumber(ip, prefix) {
  const ipNumber = typeof ip === 'number' ? ip : ipToNumber(ip);
  return (ipNumber & prefixToMaskNumber(prefix)) >>> 0;
}

/** Broadcast address (as a number) of the subnet containing `ip`. */
export function broadcastAddressNumber(ip, prefix) {
  return (networkAddressNumber(ip, prefix) | ~prefixToMaskNumber(prefix)) >>> 0;
}

/** Network address in dotted-decimal form, e.g. ("192.168.10.77", 26) -> "192.168.10.64". */
export function networkAddress(ip, prefix) {
  return numberToIp(networkAddressNumber(ip, prefix));
}

/** Broadcast address in dotted-decimal form, e.g. ("192.168.10.77", 26) -> "192.168.10.127". */
export function broadcastAddress(ip, prefix) {
  return numberToIp(broadcastAddressNumber(ip, prefix));
}

/** First assignable host address of the subnet containing `ip`. */
export function firstUsableIp(ip, prefix) {
  const network = networkAddressNumber(ip, prefix);
  return numberToIp(prefix >= 31 ? network : network + 1);
}

/** Last assignable host address of the subnet containing `ip`. */
export function lastUsableIp(ip, prefix) {
  const broadcast = broadcastAddressNumber(ip, prefix);
  return numberToIp(prefix >= 31 ? broadcast : broadcast - 1);
}

/** True if `ip` is exactly the network address for `prefix` (no host bits set). */
export function isNetworkAddress(ip, prefix) {
  const ipNumber = typeof ip === 'number' ? ip : ipToNumber(ip);
  return networkAddressNumber(ipNumber, prefix) === ipNumber;
}
