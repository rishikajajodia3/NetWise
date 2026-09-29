import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { app } from '../src/server.js';
import { buildNetworkPlan } from '../src/planner/planBuilder.js';
import { diagnose } from '../src/troubleshooting/engine.js';
import { symptoms } from '../src/troubleshooting/troubleshootingData.js';

/** Start an app on a random free port and return a small request helper. */
async function startServer(expressApp) {
  const server = await new Promise((resolve) => {
    const s = expressApp.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const request = async (method, path, { body, rawBody, headers = {} } = {}) => {
    const init = { method, headers: { ...headers } };
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    } else if (rawBody !== undefined) {
      init.body = rawBody;
    }
    const res = await fetch(baseUrl + path, init);
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : undefined };
  };

  return { request, close: () => new Promise((resolve) => server.close(resolve)) };
}

const examplePlan = {
  baseNetwork: '192.168.10.0/24',
  departments: [
    { name: 'Admin', hosts: 50 },
    { name: 'Sales', hosts: 25 },
    { name: 'IT', hosts: 10 },
    { name: 'Servers', hosts: 5 },
  ],
};

const exampleSymptoms = {
  gatewayPing: 'success',
  otherVlanPing: 'success',
  remoteNetworkPing: 'fail',
  remotePingMessage: 'unreachable_from_gateway',
};

let api;
beforeAll(async () => {
  api = await startServer(app);
});
afterAll(async () => {
  await api.close();
});

describe('GET /api/health', () => {
  it('reports the service is up', async () => {
    const res = await api.request('GET', '/api/health');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(res.body).toEqual({ status: 'ok', service: 'NetWise API' });
  });
});

describe('POST /api/plan', () => {
  it('returns the planner result for a valid request', async () => {
    const res = await api.request('POST', '/api/plan', { body: examplePlan });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(buildNetworkPlan(examplePlan));
    expect(res.body.success).toBe(true);
    expect(res.body.departments.map((d) => [d.name, d.cidr, d.vlanId, d.defaultGateway])).toEqual([
      ['Admin', '192.168.10.0/26', 10, '192.168.10.1'],
      ['Sales', '192.168.10.64/27', 20, '192.168.10.65'],
      ['IT', '192.168.10.96/28', 30, '192.168.10.97'],
      ['Servers', '192.168.10.112/29', 40, '192.168.10.113'],
    ]);
  });

  it('returns 200 with success=false when the departments do not fit', async () => {
    const res = await api.request('POST', '/api/plan', { body: { ...examplePlan, baseNetwork: '192.168.10.0/26' } });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toMatch(/do not fit/);
    expect(res.body.unallocatedDepartments.length).toBeGreaterThan(0);
  });

  it('ignores extra fields in the request', async () => {
    const res = await api.request('POST', '/api/plan', {
      body: { ...examplePlan, extra: true, departments: examplePlan.departments.map((d) => ({ ...d, colour: 'red' })) },
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(buildNetworkPlan(examplePlan));
  });

  it.each([
    ['missing baseNetwork', { departments: examplePlan.departments }, /baseNetwork/],
    ['non-string baseNetwork', { baseNetwork: 42, departments: examplePlan.departments }, /baseNetwork/],
    ['missing departments', { baseNetwork: '192.168.10.0/24' }, /departments/],
    ['empty departments', { baseNetwork: '192.168.10.0/24', departments: [] }, /departments/],
    ['department not an object', { baseNetwork: '192.168.10.0/24', departments: ['Admin'] }, /departments\[0\]/],
    ['blank name', { baseNetwork: '192.168.10.0/24', departments: [{ name: '', hosts: 5 }] }, /name/],
    ['hosts as a string', { baseNetwork: '192.168.10.0/24', departments: [{ name: 'A', hosts: '5' }] }, /hosts/],
    ['zero hosts', { baseNetwork: '192.168.10.0/24', departments: [{ name: 'A', hosts: 0 }] }, /hosts/],
    ['a JSON array body', [], /JSON object/],
    // Rejected by the planner itself (PlanValidationError).
    ['malformed CIDR', { baseNetwork: '192.168.10/24', departments: examplePlan.departments }, /CIDR|octet/i],
    ['host bits set', { baseNetwork: '192.168.10.5/24', departments: examplePlan.departments }, /192\.168\.10\.0\/24/],
    ['duplicate names', {
      baseNetwork: '192.168.10.0/24',
      departments: [{ name: 'Sales', hosts: 5 }, { name: 'sales', hosts: 5 }],
    }, /Duplicate/],
  ])('rejects %s with 400', async (_label, body, message) => {
    const res = await api.request('POST', '/api/plan', { body });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body)).toEqual(['error']);
    expect(res.body.error).toMatch(message);
  });

  it('rejects malformed JSON with 400', async () => {
    const res = await api.request('POST', '/api/plan', {
      rawBody: '{"baseNetwork": "192.168.10.0/24",',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Malformed JSON in request body' });
  });

  it('rejects a body that is not sent as JSON with 400', async () => {
    const res = await api.request('POST', '/api/plan', {
      rawBody: 'baseNetwork=192.168.10.0/24',
      headers: { 'Content-Type': 'text/plain' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/JSON object/);
  });
});

describe('GET /api/troubleshooting/symptoms', () => {
  it('returns the symptom definitions', async () => {
    const res = await api.request('GET', '/api/troubleshooting/symptoms');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ symptoms: JSON.parse(JSON.stringify(symptoms)) });
    expect(res.body.symptoms.gatewayPing.values).toHaveProperty('not_tested');
  });
});

describe('POST /api/troubleshooting/diagnose', () => {
  it('returns the engine diagnosis for a valid case', async () => {
    const res = await api.request('POST', '/api/troubleshooting/diagnose', { body: exampleSymptoms });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(JSON.parse(JSON.stringify(diagnose(exampleSymptoms))));
    expect(res.body.status).toBe('diagnosis');
    expect(res.body.results[0].faultId).toBe('missing-route');
  });

  it('returns "insufficient_evidence" (not an error) for an empty body', async () => {
    const res = await api.request('POST', '/api/troubleshooting/diagnose', { body: {} });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('insufficient_evidence');
  });

  it('rejects an invalid symptom value with 400', async () => {
    const res = await api.request('POST', '/api/troubleshooting/diagnose', {
      body: { ...exampleSymptoms, gatewayPing: 'maybe' },
    });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: 'Invalid value "maybe" for "gatewayPing". Allowed values: success, fail, not_tested',
    });
  });

  it.each([
    ['an unknown symptom', { gatewayPng: 'fail' }, /Unknown symptom "gatewayPng"/],
    ['a non-string value', { gatewayPing: true }, /Invalid value true/],
    ['an inherited property name', { toString: 'fail' }, /Unknown symptom/],
    ['a JSON array body', ['gatewayPing'], /JSON object/],
  ])('rejects %s with 400', async (_label, body, message) => {
    const res = await api.request('POST', '/api/troubleshooting/diagnose', { body });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
  });
});

describe('unknown routes', () => {
  it.each([
    ['GET', '/api/does-not-exist'],
    ['GET', '/api/plan'],
    ['POST', '/api/troubleshooting/unknown'],
    ['GET', '/'],
  ])('%s %s returns 404 JSON', async (method, path) => {
    const res = await api.request(method, path);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: `Route not found: ${method} ${path}` });
  });
});

describe('CORS', () => {
  it.each(['http://localhost:5173', 'http://127.0.0.1:3000', 'http://localhost'])(
    'allows local origin %s',
    async (origin) => {
      const res = await api.request('GET', '/api/health', { headers: { Origin: origin } });
      expect(res.headers.get('access-control-allow-origin')).toBe(origin);
    },
  );

  it('does not allow other origins', async () => {
    const res = await api.request('GET', '/api/health', { headers: { Origin: 'https://evil.example.com' } });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('answers preflight requests from the dev frontend', async () => {
    const res = await api.request('OPTIONS', '/api/plan', {
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    expect(res.headers.get('access-control-allow-methods')).toMatch(/POST/);
  });
});

describe('unexpected errors', () => {
  it('returns 500 with a generic message and does not leak internals', async () => {
    vi.resetModules();
    vi.doMock('../src/planner/planBuilder.js', async (importOriginal) => ({
      ...(await importOriginal()),
      buildNetworkPlan: () => {
        throw new Error('secret internal detail');
      },
    }));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { app: brokenApp } = await import('../src/server.js');
    const broken = await startServer(brokenApp);
    try {
      const res = await broken.request('POST', '/api/plan', { body: examplePlan });
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Internal server error' });
      expect(consoleError).toHaveBeenCalled();
    } finally {
      await broken.close();
      consoleError.mockRestore();
      vi.doUnmock('../src/planner/planBuilder.js');
    }
  });
});
