import { useState } from 'react';
import AdvancedDiagnosis from '../components/AdvancedDiagnosis.jsx';
import BasicDiagnosis from '../components/BasicDiagnosis.jsx';

export default function TroubleshootingPage() {
  const [advanced, setAdvanced] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Diagnose Network</h1>
          <p className="mt-1 text-sm text-slate-600">
            {advanced
              ? 'Record every symptom you have tested. Leave the rest as “not tested”.'
              : 'Pick the problem you see in Packet Tracer, answer a few questions, and NetWise suggests the likely fault.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdvanced((a) => !a)}
          className="text-sm font-medium text-blue-800 hover:underline"
        >
          {advanced ? '← Back to guided diagnosis' : 'Advanced: all symptoms'}
        </button>
      </div>

      {advanced ? <AdvancedDiagnosis /> : <BasicDiagnosis />}
    </div>
  );
}
