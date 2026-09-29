// All calls to the NetWise backend go through this file.

// In development the backend runs separately on port 5000. In production
// Express serves this app, so the API is on the same origin.
const API_BASE_URL = import.meta.env.DEV ? 'http://localhost:5000/api' : '/api';

/** Error with a message that is safe to show to the user. */
export class ApiError extends Error {
  constructor(message, { status = null, unavailable = false } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.unavailable = unavailable;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      `Cannot reach the NetWise API. Make sure the backend is running on ${new URL(API_BASE_URL, window.location.href).origin} (cd backend, then npm start).`,
      { unavailable: true },
    );
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // Non-JSON response; handled below.
  }

  if (!response.ok) {
    const fallback =
      response.status >= 500 ? 'The server hit an unexpected error. Please try again.' : `Request failed (${response.status}).`;
    throw new ApiError(data?.error || fallback, { status: response.status });
  }
  if (data === null) {
    throw new ApiError('The server returned an unexpected response.', { status: response.status });
  }
  return data;
}

/** POST /api/plan — returns the network plan (check `success` for whether it fits). */
export function generatePlan(baseNetwork, departments) {
  return request('/plan', { method: 'POST', body: { baseNetwork, departments } });
}

/** GET /api/troubleshooting/symptoms — returns the symptom definitions object. */
export async function fetchSymptoms() {
  const data = await request('/troubleshooting/symptoms');
  return data.symptoms;
}

/** POST /api/troubleshooting/diagnose — returns the ranked diagnosis. */
export function diagnoseNetwork(symptoms) {
  return request('/troubleshooting/diagnose', { method: 'POST', body: symptoms });
}
