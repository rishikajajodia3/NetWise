import { allocateVlsm } from './vlsm.js';

export const VLAN_START = 10;
export const VLAN_STEP = 10;
const MAX_VLAN_ID = 4094;

// The router's interface on each subnet takes one usable address (the
// default gateway), so it is added to each department's host requirement.
export const GATEWAY_ADDRESSES = 1;

/** Thrown for requirements that are malformed, as opposed to ones that simply do not fit. */
export class PlanValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PlanValidationError';
  }
}

/** VLAN ID for the department at `index` in allocation order: 10, 20, 30, ... */
export function vlanIdForIndex(index) {
  return VLAN_START + index * VLAN_STEP;
}

function validateRequirements(requirements) {
  if (!requirements || typeof requirements !== 'object' || Array.isArray(requirements)) {
    throw new PlanValidationError('Requirements must be an object with baseNetwork and departments');
  }
  const { baseNetwork, departments } = requirements;
  if (typeof baseNetwork !== 'string' || baseNetwork.trim() === '') {
    throw new PlanValidationError('baseNetwork must be a CIDR string such as "192.168.10.0/24"');
  }
  if (!Array.isArray(departments) || departments.length === 0) {
    throw new PlanValidationError('departments must be a non-empty array');
  }
  for (const [i, dept] of departments.entries()) {
    if (!dept || typeof dept !== 'object' || Array.isArray(dept)) {
      throw new PlanValidationError(`Department at position ${i + 1} must be an object with name and hosts`);
    }
  }
  if (vlanIdForIndex(departments.length - 1) > MAX_VLAN_ID) {
    throw new PlanValidationError(`Too many departments: VLAN IDs would exceed ${MAX_VLAN_ID}`);
  }
}

/**
 * Build a complete network plan (subnets, VLANs, gateways) from requirements.
 *
 * Subnets come from allocateVlsm(), so departments are ordered largest-first
 * and VLAN IDs follow that order, keeping VLAN numbers ascending with subnet
 * addresses. The first usable IP of each subnet is the default gateway.
 *
 * @param {{ baseNetwork: string, departments: { name: string, hosts: number }[] }} requirements
 *   `hosts` is the number of end devices, not counting the gateway.
 * @throws {PlanValidationError} if the requirements are malformed.
 */
export function buildNetworkPlan(requirements) {
  validateRequirements(requirements);
  const { baseNetwork, departments } = requirements;

  // Validation of CIDR syntax, host counts and duplicate names lives in
  // allocateVlsm(); surface its messages as validation errors.
  let allocation;
  try {
    allocation = allocateVlsm(
      baseNetwork,
      departments.map((dept) => ({
        name: dept.name,
        hosts: Number.isInteger(dept.hosts) && dept.hosts > 0 ? dept.hosts + GATEWAY_ADDRESSES : dept.hosts,
      })),
    );
  } catch (err) {
    throw new PlanValidationError(err.message);
  }

  const requestedHostsByName = new Map(departments.map((dept) => [dept.name.trim(), dept.hosts]));

  const planDepartments = allocation.allocations.map((a, index) => ({
    name: a.department,
    vlanId: vlanIdForIndex(index),
    requiredHosts: requestedHostsByName.get(a.department),
    networkAddress: a.networkAddress,
    prefix: a.prefix,
    cidr: a.cidr,
    subnetMask: a.subnetMask,
    firstUsable: a.firstUsable,
    lastUsable: a.lastUsable,
    defaultGateway: a.firstUsable,
    broadcastAddress: a.broadcastAddress,
    usableHosts: a.usableHosts,
  }));

  const unallocatedDepartments = allocation.unallocated.map((u) => ({
    name: u.department,
    requiredHosts: requestedHostsByName.get(u.department),
    requiredPrefix: u.requiredPrefix,
    requiredAddresses: u.blockSize,
  }));

  const plan = {
    success: allocation.success,
    summary: {
      baseNetwork: allocation.baseNetwork,
      totalDepartments: departments.length,
      totalRequestedHosts: departments.reduce((sum, dept) => sum + dept.hosts, 0),
      totalUsableAddressesAllocated: allocation.success
        ? planDepartments.reduce((sum, dept) => sum + dept.usableHosts, 0)
        : 0,
      success: allocation.success,
    },
    // A partial plan is not usable, so no departments are returned on failure.
    departments: allocation.success ? planDepartments : [],
    unallocatedDepartments,
  };

  if (!allocation.success) {
    plan.error = allocation.error;
  }
  return plan;
}
