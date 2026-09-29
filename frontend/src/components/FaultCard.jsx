import { DeviceBadge } from './ui.jsx';

const CONFIDENCE = {
  likely: {
    label: 'Likely',
    card: 'border-blue-300 border-l-4 border-l-blue-600',
    badge: 'bg-blue-700 text-white',
    bar: 'bg-blue-600',
  },
  possible: {
    label: 'Possible',
    card: 'border-slate-200 border-l-4 border-l-amber-400',
    badge: 'border border-amber-400 bg-amber-50 text-amber-900',
    bar: 'bg-amber-400',
  },
};

function Command({ device, command }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DeviceBadge device={device} />
      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm break-all text-slate-900">{command}</code>
    </div>
  );
}

function SectionTitle({ children }) {
  return <h4 className="mb-2 text-sm font-semibold text-slate-900">{children}</h4>;
}

export default function FaultCard({ fault, defaultOpen = false }) {
  const style = CONFIDENCE[fault.confidence] ?? CONFIDENCE.possible;
  const percent = fault.maxScore > 0 ? Math.max(0, Math.round((fault.score / fault.maxScore) * 100)) : 0;

  return (
    <article className={`rounded-xl border bg-white shadow-sm ${style.card}`}>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{fault.name}</h3>
            <p className="text-xs uppercase tracking-wide text-slate-500">{fault.category}</p>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.badge}`}>{style.label}</span>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 rounded-full bg-slate-100" aria-hidden="true">
            <div className={`h-2 rounded-full ${style.bar}`} style={{ width: `${percent}%` }} />
          </div>
          <span className="shrink-0 font-mono text-sm text-slate-700">
            Score {fault.score} / {fault.maxScore}
          </span>
        </div>

        <p className="mt-3 text-sm text-slate-700">{fault.description}</p>
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-medium text-slate-800">Why: </span>
          {fault.explanation}
        </p>
      </div>

      <details open={defaultOpen} className="border-t border-slate-100">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-blue-800 sm:px-5">
          Checks, fix and verification
        </summary>
        <div className="space-y-6 px-4 pb-5 sm:px-5">
          <p className="text-xs text-slate-500">
            PC commands: Desktop &gt; Command Prompt. Router/Switch commands: Cisco IOS in privileged EXEC mode (type{' '}
            <code className="font-mono">enable</code> first if the prompt ends in “&gt;”).
          </p>

          <section>
            <SectionTitle>Recommended checks</SectionTitle>
            <ol className="space-y-4">
              {fault.checks.map((check, i) => (
                <li key={i} className="text-sm">
                  <Command device={check.device} command={check.command} />
                  <p className="mt-1 text-slate-700">{check.purpose}</p>
                  <p className="mt-0.5 text-slate-600">
                    <span className="font-medium text-slate-800">Look for: </span>
                    {check.lookFor}
                  </p>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <SectionTitle>Fix</SectionTitle>
            <p className="text-sm text-slate-700">{fault.fix.summary}</p>
            {fault.fix.steps.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                {fault.fix.steps.map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ul>
            )}
            {fault.fix.commands.length > 0 && (
              <div className="mt-3 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
                {fault.fix.commands.map((c, i) => (
                  <Command key={i} device={c.device} command={c.command} />
                ))}
              </div>
            )}
          </section>

          <section>
            <SectionTitle>Verify the fix</SectionTitle>
            <ol className="space-y-3">
              {fault.verify.map((step, i) => (
                <li key={i} className="text-sm">
                  <Command device={step.device} command={step.command} />
                  <p className="mt-1 text-slate-600">
                    <span className="font-medium text-slate-800">Expect: </span>
                    {step.lookFor}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </details>
    </article>
  );
}
