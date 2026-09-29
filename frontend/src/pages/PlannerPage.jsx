import { useState } from 'react';
import { generatePlan } from '../api.js';
import PlanResult from '../components/PlanResult.jsx';
import { Alert, Button, Card, Spinner, inputClass } from '../components/ui.jsx';

const EXAMPLE = {
  baseNetwork: '192.168.10.0/24',
  departments: [
    { name: 'Admin', hosts: '50' },
    { name: 'Sales', hosts: '25' },
    { name: 'IT', hosts: '10' },
    { name: 'Servers', hosts: '5' },
  ],
};

const CIDR_FORMAT = /^\d{1,3}(\.\d{1,3}){3}\/\d{1,2}$/;

/** Basic checks before calling the API. The backend still validates everything. */
function validate(baseNetwork, departments) {
  const errors = { baseNetwork: null, rows: {}, form: null };

  if (baseNetwork.trim() === '') {
    errors.baseNetwork = 'Enter a base network, for example 192.168.10.0/24.';
  } else if (!CIDR_FORMAT.test(baseNetwork.trim())) {
    errors.baseNetwork = 'Use CIDR format: an IPv4 address, a slash and a prefix, for example 192.168.10.0/24.';
  }

  if (departments.length === 0) {
    errors.form = 'Add at least one department.';
  }

  const seen = new Map();
  for (const dept of departments) {
    const rowErrors = {};
    const name = dept.name.trim();
    if (name === '') {
      rowErrors.name = 'Enter a department name.';
    } else if (seen.has(name.toLowerCase())) {
      rowErrors.name = `"${name}" is already used. Department names must be unique.`;
    }
    seen.set(name.toLowerCase(), true);

    const hosts = Number(dept.hosts);
    if (dept.hosts.trim() === '') {
      rowErrors.hosts = 'Enter the number of hosts.';
    } else if (!Number.isInteger(hosts) || hosts < 1) {
      rowErrors.hosts = 'Hosts must be a whole number of at least 1.';
    }
    if (Object.keys(rowErrors).length > 0) errors.rows[dept.id] = rowErrors;
  }

  const valid = !errors.baseNetwork && !errors.form && Object.keys(errors.rows).length === 0;
  return valid ? null : errors;
}

// Row IDs are only needed as stable React keys. New rows are created in event
// handlers, never during render; the first row uses the fixed ID 0.
let nextRowId = 1;
const newRow = (name = '', hosts = '') => ({ id: nextRowId++, name, hosts });

export default function PlannerPage() {
  const [baseNetwork, setBaseNetwork] = useState('');
  const [departments, setDepartments] = useState([{ id: 0, name: '', hosts: '' }]);
  const [errors, setErrors] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [plan, setPlan] = useState(null);

  const updateRow = (id, field, value) =>
    setDepartments((rows) => rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  const addRow = () => setDepartments((rows) => [...rows, newRow()]);
  const removeRow = (id) => setDepartments((rows) => rows.filter((row) => row.id !== id));

  const loadExample = () => {
    setBaseNetwork(EXAMPLE.baseNetwork);
    setDepartments(EXAMPLE.departments.map((d) => newRow(d.name, d.hosts)));
    setErrors(null);
    setApiError(null);
  };

  const clearForm = () => {
    setBaseNetwork('');
    setDepartments([newRow()]);
    setErrors(null);
    setApiError(null);
    setPlan(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const found = validate(baseNetwork, departments);
    setErrors(found);
    setApiError(null);
    if (found) return;

    setLoading(true);
    try {
      const result = await generatePlan(
        baseNetwork.trim(),
        departments.map((d) => ({ name: d.name.trim(), hosts: Number(d.hosts) })),
      );
      setPlan(result);
    } catch (err) {
      setApiError(err);
      setPlan(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Network Planner</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter a base network and the hosts each department needs. NetWise allocates VLSM subnets (largest first),
          assigns VLAN IDs and picks a default gateway for each department.
        </p>
      </div>

      <Card
        title="Requirements"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={loadExample}>
              Load example
            </Button>
            <Button variant="secondary" onClick={clearForm}>
              Clear
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div className="max-w-sm">
            <label htmlFor="baseNetwork" className="mb-1 block text-sm font-medium text-slate-700">
              Base network (CIDR)
            </label>
            <input
              id="baseNetwork"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck="false"
              placeholder="192.168.10.0/24"
              value={baseNetwork}
              onChange={(e) => setBaseNetwork(e.target.value)}
              aria-invalid={Boolean(errors?.baseNetwork)}
              aria-describedby={errors?.baseNetwork ? 'baseNetwork-error' : undefined}
              className={`${inputClass} font-mono`}
            />
            {errors?.baseNetwork && (
              <p id="baseNetwork-error" className="mt-1 text-sm text-red-700">
                {errors.baseNetwork}
              </p>
            )}
          </div>

          <fieldset>
            <legend className="mb-1 text-sm font-medium text-slate-700">Departments</legend>
            <p className="mb-3 text-xs text-slate-500">
              Hosts = end devices only. NetWise adds one address for the default gateway automatically.
            </p>

            <div className="space-y-3">
              {departments.map((dept, index) => {
                const rowErrors = errors?.rows[dept.id] ?? {};
                return (
                  <div key={dept.id} className="grid grid-cols-[1fr_6.5rem_auto] items-start gap-2 sm:grid-cols-[1fr_10rem_auto]">
                    <div>
                      <label htmlFor={`dept-name-${dept.id}`} className="sr-only">
                        Department {index + 1} name
                      </label>
                      <input
                        id={`dept-name-${dept.id}`}
                        type="text"
                        placeholder={`Department ${index + 1}`}
                        value={dept.name}
                        onChange={(e) => updateRow(dept.id, 'name', e.target.value)}
                        aria-invalid={Boolean(rowErrors.name)}
                        className={inputClass}
                      />
                      {rowErrors.name && <p className="mt-1 text-sm text-red-700">{rowErrors.name}</p>}
                    </div>
                    <div>
                      <label htmlFor={`dept-hosts-${dept.id}`} className="sr-only">
                        Department {index + 1} hosts
                      </label>
                      <input
                        id={`dept-hosts-${dept.id}`}
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        placeholder="Hosts"
                        value={dept.hosts}
                        onChange={(e) => updateRow(dept.id, 'hosts', e.target.value)}
                        aria-invalid={Boolean(rowErrors.hosts)}
                        className={inputClass}
                      />
                      {rowErrors.hosts && <p className="mt-1 text-sm text-red-700">{rowErrors.hosts}</p>}
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => removeRow(dept.id)}
                      aria-label={`Remove ${dept.name.trim() || `department ${index + 1}`}`}
                      className="px-3"
                    >
                      Remove
                    </Button>
                  </div>
                );
              })}
            </div>

            {errors?.form && (
              <div className="mt-3">
                <Alert type="error">{errors.form}</Alert>
              </div>
            )}

            <Button variant="secondary" onClick={addRow} className="mt-3">
              + Add department
            </Button>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
            <Button type="submit" disabled={loading}>
              Generate Network Plan
            </Button>
            {loading && <Spinner label="Generating plan…" />}
          </div>
        </form>
      </Card>

      {apiError && (
        <Alert type="error" title={apiError.unavailable ? 'Backend not reachable' : 'Could not generate the plan'}>
          {apiError.message}
        </Alert>
      )}

      {plan && <PlanResult plan={plan} />}
    </div>
  );
}
