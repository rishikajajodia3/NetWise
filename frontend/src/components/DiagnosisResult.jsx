import FaultCard from './FaultCard.jsx';
import { Alert, Card } from './ui.jsx';

export default function DiagnosisResult({ result }) {
  const likely = result.results.filter((r) => r.confidence === 'likely');
  const possible = result.results.filter((r) => r.confidence === 'possible');
  const diagnosed = result.status === 'diagnosis';

  return (
    <div className="space-y-6">
      <Alert type={diagnosed ? 'info' : 'warning'} title={diagnosed ? 'Diagnosis' : 'Not enough evidence yet'}>
        <p>{result.message}</p>
        <p className="mt-1 text-xs opacity-80">
          Based on {result.symptomsReported} recorded symptom{result.symptomsReported === 1 ? '' : 's'}.
        </p>
      </Alert>

      {!diagnosed && result.suggestedSymptoms.length > 0 && (
        <Card title="Test these next" subtitle="These observations would help narrow down the fault.">
          <ul className="space-y-3">
            {result.suggestedSymptoms.map((s) => (
              <li key={s.symptom} className="text-sm">
                <p className="font-medium text-slate-800">{s.label}</p>
                <p className="text-slate-600">{s.howToTest}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {likely.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Likely faults ({likely.length})</h2>
          {likely.map((fault) => (
            <FaultCard key={fault.faultId} fault={fault} defaultOpen />
          ))}
        </section>
      )}

      {possible.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Possible faults ({possible.length})</h2>
            <p className="text-sm text-slate-600">Partly match the symptoms. Worth checking if the likely faults are ruled out.</p>
          </div>
          {possible.map((fault) => (
            <FaultCard key={fault.faultId} fault={fault} />
          ))}
        </section>
      )}

      {result.ruledOut.length > 0 && (
        <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-sm sm:px-6">
          <summary className="cursor-pointer font-medium text-slate-800">
            Ruled out by your symptoms ({result.ruledOut.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {result.ruledOut.map((r) => (
              <li key={r.faultId}>
                <span className="font-medium text-slate-800">{r.name}</span>
                <span className="text-slate-600"> — {r.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
