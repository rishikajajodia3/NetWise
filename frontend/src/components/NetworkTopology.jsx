import { useState } from 'react';

// Topology drawn from a successful /api/plan response:
// Internet -> Router -> Core Switch -> one access network per department.
// All addressing shown here comes straight from `plan.departments`.

const LINE = 'bg-slate-400';

// Accent colours cycle so neighbouring VLANs are easy to tell apart.
const VLAN_ACCENTS = [
  { strip: 'bg-blue-600', badge: 'bg-blue-50 text-blue-800 ring-blue-200' },
  { strip: 'bg-emerald-600', badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  { strip: 'bg-violet-600', badge: 'bg-violet-50 text-violet-800 ring-violet-200' },
  { strip: 'bg-amber-500', badge: 'bg-amber-50 text-amber-900 ring-amber-200' },
  { strip: 'bg-rose-600', badge: 'bg-rose-50 text-rose-800 ring-rose-200' },
  { strip: 'bg-cyan-600', badge: 'bg-cyan-50 text-cyan-800 ring-cyan-200' },
];

function CloudIcon() {
  return (
    <svg viewBox="0 0 48 32" className="h-8 w-12" aria-hidden="true">
      <path
        d="M14 28h22a8 8 0 0 0 1-15.9A11 11 0 0 0 16.2 9 7.5 7.5 0 0 0 14 28Z"
        className="fill-sky-100 stroke-sky-600"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Cisco-style router symbol: a round device with four routing arrows.
function RouterIcon() {
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden="true">
      <circle cx="20" cy="20" r="18" className="fill-blue-700" />
      <g className="stroke-white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M20 6v10M16.5 12.5 20 16l3.5-3.5" />
        <path d="M20 34V24M16.5 27.5 20 24l3.5 3.5" />
        <path d="M6 20h10M9.5 16.5 6 20l3.5 3.5" />
        <path d="M34 20H24M30.5 16.5 34 20l-3.5 3.5" />
      </g>
    </svg>
  );
}

// Cisco-style switch symbol: a box with crossing traffic arrows.
function SwitchIcon() {
  return (
    <svg viewBox="0 0 48 32" className="h-8 w-12" aria-hidden="true">
      <rect x="1" y="1" width="46" height="30" rx="4" className="fill-teal-700" />
      <g className="stroke-white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M9 11h24M29 7l4 4-4 4" />
        <path d="M39 21H15M19 17l-4 4 4 4" />
      </g>
    </svg>
  );
}

function LanIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
      <g className="stroke-slate-500" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="12" rx="1.5" />
        <path d="M9 20h6M12 16v4" />
      </g>
    </svg>
  );
}

function DeviceNode({ icon, title, subtitle }) {
  return (
    <div className="flex min-w-40 flex-col items-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-center shadow-sm">
      {icon}
      <p className="mt-1.5 text-sm font-semibold text-slate-900">{title}</p>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}

/** Vertical cable between two stacked devices, with an optional link label. */
function Link({ label }) {
  return (
    <div className={`relative h-9 w-0.5 ${LINE}`}>
      {label && (
        <span className="absolute top-1/2 left-3 -translate-y-1/2 text-[11px] whitespace-nowrap text-slate-500">
          {label}
        </span>
      )}
    </div>
  );
}

function DepartmentNode({ dept, accent, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-48 overflow-hidden rounded-lg border bg-white text-left shadow-sm transition-colors hover:border-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        selected ? 'border-blue-600 ring-2 ring-blue-600' : 'border-slate-300'
      }`}
    >
      <span className={`block h-1 ${accent.strip}`} aria-hidden="true" />
      <span className="block px-3 py-2.5">
        <span className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold break-words text-slate-900">{dept.name}</span>
          <LanIcon />
        </span>
        <span className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-semibold ring-1 ${accent.badge}`}>
          VLAN {dept.vlanId}
        </span>
        <span className="mt-2 block font-mono text-[13px] font-medium text-slate-900">{dept.cidr}</span>
        <span className="mt-1 block text-xs text-slate-600">
          Gateway: <span className="font-mono text-slate-800">{dept.defaultGateway}</span>
        </span>
        <span className="block text-xs text-slate-600">
          Hosts: <span className="font-mono text-slate-800">{dept.requiredHosts}</span>
        </span>
      </span>
    </button>
  );
}

function DepartmentDetails({ dept, onClose }) {
  const rows = [
    ['VLAN', dept.vlanId],
    ['Network', dept.cidr],
    ['Subnet mask', dept.subnetMask],
    ['Usable IP range', `${dept.firstUsable} – ${dept.lastUsable}`],
    ['Gateway', dept.defaultGateway],
    ['Broadcast', dept.broadcastAddress],
    ['Usable hosts', `${dept.usableHosts} (${dept.requiredHosts} needed)`],
  ];
  return (
    <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/50 p-4" aria-live="polite">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold text-slate-900">{dept.name}</h4>
        <button type="button" onClick={onClose} className="text-sm font-medium text-blue-800 hover:underline">
          Close
        </button>
      </div>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="font-mono text-sm text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function NetworkTopology({ plan }) {
  // Store the selected department by name and look it up in the current plan,
  // so the details panel always reflects the latest generated plan.
  const [selectedName, setSelectedName] = useState(null);
  const selected = plan.departments.find((d) => d.name === selectedName) ?? null;
  const count = plan.departments.length;

  return (
    <section className="mt-8" aria-labelledby="topology-heading">
      <h3 id="topology-heading" className="text-base font-semibold text-slate-900">
        Network topology
      </h3>
      <p className="mt-1 mb-3 text-sm text-slate-600">
        One router with a VLAN subinterface per department, connected to the core switch by an 802.1Q trunk. Select a
        department for its full addressing.
      </p>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px]">
        <div className="mx-auto flex w-max min-w-full flex-col items-center px-6 py-6">
          <DeviceNode icon={<CloudIcon />} title="Internet" subtitle="ISP / WAN" />
          <Link label="WAN link" />
          <DeviceNode
            icon={<RouterIcon />}
            title="Router"
            subtitle={`Default gateway for ${count} VLAN${count === 1 ? '' : 's'}`}
          />
          <Link label="802.1Q trunk" />
          <DeviceNode icon={<SwitchIcon />} title="Core Switch" subtitle={plan.summary.baseNetwork} />
          <div className={`h-6 w-0.5 ${LINE}`} />

          <ul className="flex" role="list">
            {plan.departments.map((dept, i) => (
              <li key={dept.name} className="relative flex flex-col items-center px-2 pt-6">
                {/* Horizontal bus: each node draws the half on either side of its drop line. */}
                {i > 0 && <span className={`absolute top-0 left-0 h-0.5 w-1/2 ${LINE}`} aria-hidden="true" />}
                {i < count - 1 && <span className={`absolute top-0 right-0 h-0.5 w-1/2 ${LINE}`} aria-hidden="true" />}
                <span className={`absolute top-0 left-1/2 h-6 w-0.5 -translate-x-1/2 ${LINE}`} aria-hidden="true" />
                <DepartmentNode
                  dept={dept}
                  accent={VLAN_ACCENTS[i % VLAN_ACCENTS.length]}
                  selected={dept.name === selectedName}
                  onSelect={() => setSelectedName(dept.name === selectedName ? null : dept.name)}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {selected && <DepartmentDetails dept={selected} onClose={() => setSelectedName(null)} />}
    </section>
  );
}
