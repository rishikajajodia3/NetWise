import {
  blockSize,
  broadcastAddress,
  firstUsableIp,
  isNetworkAddress,
  lastUsableIp,
  networkAddress,
  numberToIp,
  parseCidr,
  prefixForHosts,
  prefixToSubnetMask,
  usableHostCount,
} from './ipUtils.js';

function validateDepartments(departments) {
  if (!Array.isArray(departments) || departments.length === 0) {
    throw new Error('At least one department is required');
  }

  const seen = new Set();
  for (const dept of departments) {
    if (!dept || typeof dept.name !== 'string' || dept.name.trim() === '') {
      throw new Error('Every department needs a non-empty name');
    }
    const name = dept.name.trim();
    if (seen.has(name.toLowerCase())) {
      throw new Error(`Duplicate department name "${name}"`);
    }
    seen.add(name.toLowerCase());

    if (!Number.isInteger(dept.hosts) || dept.hosts < 1) {
      throw new Error(`Department "${name}" must require a positive whole number of hosts`);
    }
  }
}

/**
 * Allocate VLSM subnets for each department inside a base network.
 *
 * Departments are sorted largest-first and each receives the smallest subnet
 * whose usable hosts (block size minus network and broadcast) cover its
 * requirement. Subnets are packed from the start of the base network, with
 * every subnet starting on a multiple of its own block size.
 *
 * @param {string} baseCidr - e.g. "192.168.10.0/24"; must be a network address.
 * @param {{ name: string, hosts: number }[]} departments
 * @returns {{
 *   success: boolean,
 *   baseNetwork: string,
 *   allocations: object[],
 *   unallocated: { department: string, requestedHosts: number, requiredPrefix: number, blockSize: number }[],
 *   addressesAvailable: number,
 *   addressesRequired: number,
 *   error?: string,
 * }}
 */
export function allocateVlsm(baseCidr, departments) {
  const base = parseCidr(baseCidr);
  if (!isNetworkAddress(base.ipNumber, base.prefix)) {
    throw new Error(
      `Base network "${baseCidr}" has host bits set; did you mean ` +
        `${networkAddress(base.ipNumber, base.prefix)}/${base.prefix}?`,
    );
  }
  validateDepartments(departments);

  const baseStart = base.ipNumber;
  const baseEnd = baseStart + blockSize(base.prefix); // exclusive

  // Array.prototype.sort is stable, so equal-sized departments keep their input order.
  const requests = departments
    .map((dept) => {
      const prefix = prefixForHosts(dept.hosts);
      return { name: dept.name.trim(), hosts: dept.hosts, prefix, size: blockSize(prefix) };
    })
    .sort((a, b) => b.hosts - a.hosts);

  const allocations = [];
  const unallocated = [];
  let cursor = baseStart;

  for (const req of requests) {
    // Round up to the next boundary aligned to this block size.
    const start = Math.ceil(cursor / req.size) * req.size;

    if (start + req.size > baseEnd) {
      unallocated.push({
        department: req.name,
        requestedHosts: req.hosts,
        requiredPrefix: req.prefix,
        blockSize: req.size,
      });
      continue;
    }

    const network = numberToIp(start);
    allocations.push({
      department: req.name,
      requestedHosts: req.hosts,
      networkAddress: network,
      prefix: req.prefix,
      cidr: `${network}/${req.prefix}`,
      subnetMask: prefixToSubnetMask(req.prefix),
      firstUsable: firstUsableIp(start, req.prefix),
      lastUsable: lastUsableIp(start, req.prefix),
      broadcastAddress: broadcastAddress(start, req.prefix),
      usableHosts: usableHostCount(req.prefix),
      blockSize: req.size,
    });
    cursor = start + req.size;
  }

  const addressesAvailable = baseEnd - baseStart;
  const addressesRequired = requests.reduce((sum, req) => sum + req.size, 0);
  const result = {
    success: unallocated.length === 0,
    baseNetwork: `${base.ip}/${base.prefix}`,
    allocations,
    unallocated,
    addressesAvailable,
    addressesRequired,
  };

  if (!result.success) {
    const names = unallocated.map((u) => `${u.department} (/${u.requiredPrefix}, ${u.blockSize} addresses)`);
    result.error =
      `Requirements do not fit in ${result.baseNetwork}: ${addressesRequired} addresses needed, ` +
      `${addressesAvailable} available. Could not allocate: ${names.join(', ')}.`;
  }

  return result;
}
