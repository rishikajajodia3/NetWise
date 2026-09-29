import { useRef, useState } from 'react';
import { diagnoseNetwork } from '../api.js';
import { PROBLEMS } from '../basicQuestions.js';
import { Alert, Button, Card, DeviceBadge, Spinner } from './ui.jsx';

function Command({ device, command }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <DeviceBadge device={device} />
      <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm break-all text-slate-900">{command}</code>
    </span>
  );
}

function ResultSection({ title, children }) {
  return (
    <section className="border-t border-slate-100 pt-4">
      <h4 className="mb-2 text-sm font-semibold tracking-wide text-slate-500 uppercase">{title}</h4>
      {children}
    </section>
  );
}

/** Shows the backend's top-ranked fault. Nothing here is decided in the frontend. */
function ResultCard({ result, onReset }) {
  const [top, ...others] = result.results;

  if (result.status !== 'diagnosis') {
    return (
      <Card title="No clear diagnosis yet">
        <p className="text-sm text-slate-700">{result.message}</p>
        {result.results.length > 0 && (
          <p className="mt-2 text-sm text-slate-700">
            <span className="font-medium">Possible causes: </span>
            {result.results.map((r) => r.name).join(', ')}.
          </p>
        )}
        <p className="mt-2 text-sm text-slate-600">Answer more of the questions above, or try a different problem.</p>
        <Button variant="secondary" onClick={onReset} className="mt-4">
          Reset
        </Button>
      </Card>
    );
  }

  const evidence = [...top.evidence.requiredMatched, ...top.evidence.supportingMatched];

  return (
    <article className="rounded-xl border border-blue-300 border-l-4 border-l-blue-600 bg-white p-4 shadow-sm sm:p-6" aria-live="polite">
      <p className="text-sm font-semibold tracking-wide text-blue-700 uppercase">Likely problem</p>
      <h3 className="mt-1 text-xl font-semibold text-slate-900">{top.name}</h3>

      <div className="mt-5 space-y-5">
        <ResultSection title="Why">
          <p className="text-sm text-slate-700">{top.description}</p>
          {evidence.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-slate-600">
              {evidence.map((e) => (
                <li key={e.symptom}>
                  {e.label}: <span className="font-medium text-slate-800">{e.observedLabel}</span>
                </li>
              ))}
            </ul>
          )}
        </ResultSection>

        <ResultSection title="Check">
          <ol className="space-y-3">
            {top.checks.map((c, i) => (
              <li key={i} className="text-sm">
                <Command device={c.device} command={c.command} />
                <p className="mt-1 text-slate-600">{c.lookFor}</p>
              </li>
            ))}
          </ol>
        </ResultSection>

        <ResultSection title="Fix">
          <p className="text-sm text-slate-700">{top.fix.summary}</p>
          {top.fix.steps.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {top.fix.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
          )}
          {top.fix.commands.length > 0 && (
            <div className="mt-3 space-y-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
              {top.fix.commands.map((c, i) => (
                <Command key={i} device={c.device} command={c.command} />
              ))}
            </div>
          )}
        </ResultSection>

        <ResultSection title="Verify">
          <ol className="space-y-3">
            {top.verify.map((v, i) => (
              <li key={i} className="text-sm">
                <Command device={v.device} command={v.command} />
                <p className="mt-1 text-slate-600">{v.lookFor}</p>
              </li>
            ))}
          </ol>
        </ResultSection>

        {others.length > 0 && (
          <p className="border-t border-slate-100 pt-4 text-sm text-slate-600">
            <span className="font-medium text-slate-700">Also worth checking: </span>
            {others.map((r) => `${r.name} (${r.confidence})`).join(', ')}.
          </p>
        )}
      </div>

      <Button onClick={onReset} className="mt-6">
        Reset
      </Button>
    </article>
  );
}

export default function BasicDiagnosis() {
  const [problemId, setProblemId] = useState(null);
  const [answers, setAnswers] = useState({});
  const [diagnosing, setDiagnosing] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const topRef = useRef(null);

  const problem = PROBLEMS.find((p) => p.id === problemId) ?? null;
  const answeredCount = problem ? problem.questions.filter((q) => answers[q.symptom]).length : 0;

  const chooseProblem = (id) => {
    setProblemId(id);
    setAnswers({});
    setResult(null);
    setError(null);
  };

  const answer = (symptom, value) => {
    setAnswers((prev) => ({ ...prev, [symptom]: value }));
    setResult(null);
  };

  const reset = () => {
    chooseProblem(null);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDiagnose = async (event) => {
    event.preventDefault();
    setError(null);
    setDiagnosing(true);
    try {
      // Only answered questions are sent; the engine treats the rest as "not tested".
      setResult(await diagnoseNetwork(answers));
    } catch (err) {
      setError(err);
      setResult(null);
    } finally {
      setDiagnosing(false);
    }
  };

  return (
    <div ref={topRef} className="scroll-mt-4 space-y-6">
      <Card title="Step 1: What problem are you experiencing?">
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Problem">
          {PROBLEMS.map((p) => {
            const selected = p.id === problemId;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => chooseProblem(p.id)}
                className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  selected
                    ? 'border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-600'
                    : 'border-slate-300 bg-white text-slate-800 hover:border-blue-400'
                }`}
              >
                {p.title}
              </button>
            );
          })}
        </div>
      </Card>

      {problem && (
        <Card
          title="Step 2: Answer what you have tested"
          subtitle={`${answeredCount} of ${problem.questions.length} answered. Skip any question you have not tested.`}
        >
          <form onSubmit={handleDiagnose} noValidate>
            <ol className="space-y-5">
              {problem.questions.map((q, index) => (
                <li key={q.symptom}>
                  <fieldset>
                    <legend className="text-sm font-medium text-slate-900">
                      {index + 1}. {q.question}
                    </legend>
                    <p className="mt-0.5 text-xs text-slate-500">{q.hint}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {q.options.map((o) => (
                        <label key={o.value} className="cursor-pointer">
                          <input
                            type="radio"
                            name={`${problem.id}-${q.symptom}`}
                            value={o.value}
                            checked={answers[q.symptom] === o.value}
                            onChange={() => answer(q.symptom, o.value)}
                            className="peer sr-only"
                          />
                          <span className="inline-block min-w-16 rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-center text-sm text-slate-700 peer-checked:border-blue-600 peer-checked:bg-blue-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 peer-focus-visible:ring-offset-1 hover:border-blue-400">
                            {o.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </li>
              ))}
            </ol>
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
              <Button type="submit" disabled={diagnosing || answeredCount === 0}>
                Diagnose Network
              </Button>
              {answeredCount === 0 && <span className="text-sm text-slate-500">Answer at least one question.</span>}
              {diagnosing && <Spinner label="Diagnosing…" />}
            </div>
          </form>
        </Card>
      )}

      {error && (
        <Alert type="error" title={error.unavailable ? 'Backend not reachable' : 'Diagnosis failed'}>
          {error.message}
        </Alert>
      )}

      {result && <ResultCard result={result} onReset={reset} />}
    </div>
  );
}
