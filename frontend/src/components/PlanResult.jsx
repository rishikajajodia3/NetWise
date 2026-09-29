import { Alert, Card } from './ui.jsx';

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-mono text-base font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

const th = 'whitespace-nowrap px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-600';
const td = 'whitespace-nowrap px-2.5 py-2 font-mono text-[13px] text-slate-800';

export default function PlanResult({ plan }) {
  const { summary } = plan;

  return (
    <Card title="Network plan" subtitle={`Base network ${summary.baseNetwork}`}>
      <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Base network" value={summary.baseNetwork} />
        <Stat label="Departments" value={summary.totalDepartments} />
        <Stat label="Hosts requested" value={summary.totalRequestedHosts} />
        <Stat label="Usable addresses allocated" value={summary.totalUsableAddressesAllocated} />
      </dl>

      {plan.success ? (
        <>
          <Alert type="success">All departments fit inside {summary.baseNetwork}.</Alert>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <caption className="sr-only">Subnet allocation for each department</caption>
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className={th}>Department</th>
                  <th scope="col" className={th}>VLAN</th>
                  <th scope="col" className={th}>Network</th>
                  <th scope="col" className={th}>CIDR</th>
                  <th scope="col" className={th}>Subnet Mask</th>
                  <th scope="col" className={th}>Usable IP Range</th>
                  <th scope="col" className={th}>Gateway</th>
                  <th scope="col" className={th}>Broadcast</th>
                  <th scope="col" className={`${th} text-right`}>Usable Hosts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {plan.departments.map((d) => (
                  <tr key={d.name} className="hover:bg-slate-50">
                    <th scope="row" className="whitespace-nowrap px-2.5 py-2 text-left text-sm font-medium text-slate-900">
                      {d.name}
                      <span className="block text-xs font-normal text-slate-500">{d.requiredHosts} hosts needed</span>
                    </th>
                    <td className={td}>{d.vlanId}</td>
                    <td className={td}>{d.networkAddress}</td>
                    <td className={td}>/{d.prefix}</td>
                    <td className={td}>{d.subnetMask}</td>
                    <td className={td}>
                      {d.firstUsable}
                      <span className="block text-slate-500">to {d.lastUsable}</span>
                    </td>
                    <td className={`${td} font-semibold text-blue-800`}>{d.defaultGateway}</td>
                    <td className={td}>{d.broadcastAddress}</td>
                    <td className={`${td} text-right`}>{d.usableHosts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            The gateway is the first usable IP of each subnet. Configure it on the router subinterface for that VLAN.
          </p>
        </>
      ) : (
        <>
          <Alert type="error" title="The departments do not fit in this base network">
            {plan.error}
          </Alert>
          {plan.unallocatedDepartments.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Departments that could not be placed</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th scope="col" className={th}>Department</th>
                      <th scope="col" className={`${th} text-right`}>Hosts needed</th>
                      <th scope="col" className={th}>Subnet needed</th>
                      <th scope="col" className={`${th} text-right`}>Addresses needed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {plan.unallocatedDepartments.map((u) => (
                      <tr key={u.name}>
                        <th scope="row" className="px-3 py-2 text-left text-sm font-medium text-slate-900">{u.name}</th>
                        <td className={`${td} text-right`}>{u.requiredHosts}</td>
                        <td className={td}>/{u.requiredPrefix}</td>
                        <td className={`${td} text-right`}>{u.requiredAddresses}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <p className="mt-3 text-sm text-slate-600">
            Try a larger base network (a smaller prefix, e.g. /23 instead of /24) or reduce the host counts.
          </p>
        </>
      )}
    </Card>
  );
}
