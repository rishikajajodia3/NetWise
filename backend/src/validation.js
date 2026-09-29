// Request-body checks for the API. They reject badly shaped input with a clear
// message before the planner or engine is called. Deeper rules (CIDR syntax,
// duplicate names, subnet fit) stay in the planner, which throws
// PlanValidationError for them.

import { symptoms } from './troubleshooting/troubleshootingData.js';

/** Error for invalid user input; the error handler turns it into HTTP 400. */
export class RequestValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RequestValidationError';
  }
}

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function requireJsonObject(body) {
  if (!isPlainObject(body)) {
    throw new RequestValidationError('Request body must be a JSON object (send Content-Type: application/json)');
  }
}

/** Validate a POST /api/plan body. Returns the fields the planner needs. */
export function validatePlanRequest(body) {
  requireJsonObject(body);
  const { baseNetwork, departments } = body;

  if (typeof baseNetwork !== 'string' || baseNetwork.trim() === '') {
    throw new RequestValidationError('"baseNetwork" must be a CIDR string such as "192.168.10.0/24"');
  }
  if (!Array.isArray(departments) || departments.length === 0) {
    throw new RequestValidationError('"departments" must be a non-empty array');
  }

  departments.forEach((dept, i) => {
    const where = `departments[${i}]`;
    if (!isPlainObject(dept)) {
      throw new RequestValidationError(`${where} must be an object with "name" and "hosts"`);
    }
    if (typeof dept.name !== 'string' || dept.name.trim() === '') {
      throw new RequestValidationError(`${where}.name must be a non-empty string`);
    }
    if (!Number.isInteger(dept.hosts) || dept.hosts < 1) {
      throw new RequestValidationError(`${where}.hosts must be a positive whole number`);
    }
  });

  return {
    baseNetwork,
    departments: departments.map(({ name, hosts }) => ({ name, hosts })),
  };
}

/** Validate a POST /api/troubleshooting/diagnose body against the symptom definitions. */
export function validateDiagnoseRequest(body) {
  requireJsonObject(body);

  for (const [key, value] of Object.entries(body)) {
    if (!Object.hasOwn(symptoms, key)) {
      throw new RequestValidationError(`Unknown symptom "${key}"`);
    }
    const allowed = Object.keys(symptoms[key].values);
    if (typeof value !== 'string' || !allowed.includes(value)) {
      throw new RequestValidationError(
        `Invalid value ${JSON.stringify(value)} for "${key}". Allowed values: ${allowed.join(', ')}`,
      );
    }
  }
  return body;
}
