import { useEffect, useState } from 'react';
import { diagnoseNetwork, fetchSymptoms } from '../api.js';
import DiagnosisResult from './DiagnosisResult.jsx';
import SymptomForm from './SymptomForm.jsx';
import { Alert, Button, Card, Spinner } from './ui.jsx';

const NOT_TESTED = 'not_tested';

/** Every symptom starts as "not_tested" (or its first value if that option does not exist). */
function defaultSelections(symptoms) {
  return Object.fromEntries(
    Object.entries(symptoms).map(([key, def]) => {
      const values = Object.keys(def.values);
      return [key, values.includes(NOT_TESTED) ? NOT_TESTED : values[0]];
    }),
  );
}

/** Full form with every symptom the engine supports (the original troubleshooting view). */
export default function AdvancedDiagnosis() {
  const [symptoms, setSymptoms] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [selections, setSelections] = useState({});
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnoseError, setDiagnoseError] = useState(null);
  const [result, setResult] = useState(null);

  // Incremented by "Try again" to re-run the effect below.
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    let ignore = false; // Drop the response if the page unmounted or a retry started.
    fetchSymptoms().then(
      (defs) => {
        if (ignore) return;
        setSymptoms(defs);
        setSelections(defaultSelections(defs));
      },
      (err) => {
        if (!ignore) setLoadError(err);
      },
    );
    return () => {
      ignore = true;
    };
  }, [loadAttempt]);

  const retryLoad = () => {
    setLoadError(null);
    setLoadAttempt((n) => n + 1);
  };

  const testedCount = Object.values(selections).filter((v) => v !== NOT_TESTED).length;

  const handleChange = (key, value) => setSelections((prev) => ({ ...prev, [key]: value }));

  const handleReset = () => {
    setSelections(defaultSelections(symptoms));
    setResult(null);
    setDiagnoseError(null);
  };

  const handleDiagnose = async (event) => {
    event.preventDefault();
    setDiagnoseError(null);
    if (testedCount === 0) {
      setResult(null);
      setDiagnoseError({
        message: 'Choose a result for at least one symptom. Everything is still set to "not tested".',
        invalid: true,
      });
      return;
    }
    setDiagnosing(true);
    try {
      setResult(await diagnoseNetwork(selections));
    } catch (err) {
      setDiagnoseError(err);
      setResult(null);
    } finally {
      setDiagnosing(false);
    }
  };

  return (
    <div className="space-y-6">
      {!symptoms && !loadError && (
        <Card>
          <Spinner label="Loading symptoms…" />
        </Card>
      )}

      {loadError && (
        <Alert type="error" title={loadError.unavailable ? 'Backend not reachable' : 'Could not load symptoms'}>
          <p>{loadError.message}</p>
          <Button variant="secondary" onClick={retryLoad} className="mt-3">
            Try again
          </Button>
        </Alert>
      )}

      {symptoms && (
        <Card
          title="Observed symptoms"
          subtitle={`${testedCount} of ${Object.keys(symptoms).length} symptoms recorded`}
          actions={
            <Button variant="secondary" onClick={handleReset}>
              Reset all
            </Button>
          }
        >
          <form onSubmit={handleDiagnose} noValidate>
            <SymptomForm symptoms={symptoms} selections={selections} onChange={handleChange} />
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
              <Button type="submit" disabled={diagnosing}>
                Diagnose Network
              </Button>
              {diagnosing && <Spinner label="Diagnosing…" />}
            </div>
          </form>
        </Card>
      )}

      {diagnoseError && (
        <Alert
          type={diagnoseError.invalid ? 'warning' : 'error'}
          title={diagnoseError.unavailable ? 'Backend not reachable' : diagnoseError.invalid ? 'Nothing to diagnose yet' : 'Diagnosis failed'}
        >
          {diagnoseError.message}
        </Alert>
      )}

      {result && <DiagnosisResult result={result} />}
    </div>
  );
}
