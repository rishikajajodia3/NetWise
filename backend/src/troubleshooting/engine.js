// Deterministic rule-based troubleshooting engine.
//
// Each fault is scored against the symptoms the user reported:
// - A required condition that contradicts an observed symptom rules the fault out.
// - Each matched required condition adds REQUIRED_WEIGHT; each matched
//   supporting condition adds SUPPORTING_WEIGHT; each contradicted supporting
//   condition subtracts SUPPORTING_WEIGHT.
// - Symptoms that are missing or "not_tested" are ignored when scoring.
//
// Confidence:
// - "likely":   every required condition matched and supporting evidence is not net negative.
// - "possible": every required condition matched but supporting evidence is net negative, or
//               some required conditions matched, none contradicted, and supporting evidence is net positive.
// Anything else lacks enough evidence and is not reported.

import { faults as defaultFaults, symptoms as defaultSymptoms, NOT_TESTED } from './troubleshootingData.js';

export const REQUIRED_WEIGHT = 3;
export const SUPPORTING_WEIGHT = 1;

export const NO_DIAGNOSIS_MESSAGE =
  'No strong diagnosis. Run the recommended checks and provide more symptoms.';

const CONFIDENCE_RANK = { likely: 0, possible: 1 };

/** Thrown when the reported symptoms use unknown keys or values. */
export class SymptomValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SymptomValidationError';
  }
}

const asArray = (value) => (Array.isArray(value) ? value : [value]);

/**
 * Check reported symptoms against the definitions and return a complete map
 * of every symptom key to its value, with unreported symptoms as "not_tested".
 */
export function normalizeSymptoms(observed, symptomDefs = defaultSymptoms) {
  if (!observed || typeof observed !== 'object' || Array.isArray(observed)) {
    throw new SymptomValidationError('Symptoms must be an object of symptom keys to values');
  }

  for (const [key, value] of Object.entries(observed)) {
    const def = symptomDefs[key];
    if (!def) {
      throw new SymptomValidationError(`Unknown symptom "${key}"`);
    }
    if (typeof value !== 'string' || !Object.hasOwn(def.values, value)) {
      throw new SymptomValidationError(
        `Invalid value ${JSON.stringify(value)} for symptom "${key}". ` +
          `Allowed values: ${Object.keys(def.values).join(', ')}`,
      );
    }
  }

  return Object.fromEntries(Object.keys(symptomDefs).map((key) => [key, observed[key] ?? NOT_TESTED]));
}

function describeCondition(key, expected, observedValue, symptomDefs) {
  const def = symptomDefs[key];
  const expectedValues = asArray(expected);
  return {
    symptom: key,
    label: def.label,
    expected: expectedValues,
    expectedLabels: expectedValues.map((v) => def.values[v]),
    observed: observedValue,
    observedLabel: def.values[observedValue],
  };
}

function formatObserved(items) {
  return items.map((c) => `${c.label}: ${c.observedLabel}`).join('; ');
}

function formatExpected(items) {
  return items.map((c) => `${c.label} (expected: ${c.expectedLabels.join(' or ')})`).join('; ');
}

/**
 * Evaluate one fault against normalized symptoms. Pure function.
 * Returns the confidence ("likely", "possible", "ruled_out" or "insufficient"),
 * score and the evidence behind it.
 */
export function evaluateFault(fault, normalized, symptomDefs = defaultSymptoms) {
  const evidence = {
    requiredMatched: [],
    requiredContradicted: [],
    requiredUntested: [],
    supportingMatched: [],
    supportingContradicted: [],
    supportingUntested: [],
  };

  const sort = (conditions, matched, contradicted, untested) => {
    for (const [key, expected] of Object.entries(conditions)) {
      const observedValue = normalized[key];
      const item = describeCondition(key, expected, observedValue, symptomDefs);
      if (observedValue === NOT_TESTED) untested.push(item);
      else if (asArray(expected).includes(observedValue)) matched.push(item);
      else contradicted.push(item);
    }
  };
  sort(fault.conditions.required, evidence.requiredMatched, evidence.requiredContradicted, evidence.requiredUntested);
  sort(
    fault.conditions.supporting,
    evidence.supportingMatched,
    evidence.supportingContradicted,
    evidence.supportingUntested,
  );

  const requiredCount = Object.keys(fault.conditions.required).length;
  const netSupporting = evidence.supportingMatched.length - evidence.supportingContradicted.length;
  const score = evidence.requiredMatched.length * REQUIRED_WEIGHT + netSupporting * SUPPORTING_WEIGHT;
  const maxScore =
    requiredCount * REQUIRED_WEIGHT + Object.keys(fault.conditions.supporting).length * SUPPORTING_WEIGHT;

  let confidence;
  if (evidence.requiredContradicted.length > 0) {
    confidence = 'ruled_out';
  } else if (evidence.requiredMatched.length === requiredCount) {
    confidence = netSupporting >= 0 ? 'likely' : 'possible';
  } else if (evidence.requiredMatched.length > 0 && netSupporting > 0) {
    confidence = 'possible';
  } else {
    confidence = 'insufficient';
  }

  return { confidence, score, maxScore, evidence };
}

function explain(confidence, evidence) {
  const parts = [];
  if (confidence === 'likely') {
    parts.push(`All key conditions match: ${formatObserved(evidence.requiredMatched)}.`);
  } else if (evidence.requiredUntested.length === 0) {
    parts.push(
      `All key conditions match (${formatObserved(evidence.requiredMatched)}), ` +
        'but more supporting evidence points away from this fault than towards it.',
    );
  } else {
    parts.push(
      `Some key conditions match: ${formatObserved(evidence.requiredMatched)}. ` +
        `Test these to confirm: ${formatExpected(evidence.requiredUntested)}.`,
    );
  }
  if (evidence.supportingMatched.length > 0) {
    parts.push(`Supporting evidence: ${formatObserved(evidence.supportingMatched)}.`);
  }
  if (evidence.supportingContradicted.length > 0) {
    parts.push(`Evidence against: ${formatObserved(evidence.supportingContradicted)}.`);
  }
  return parts.join(' ');
}

function ruledOutReason(evidence) {
  return evidence.requiredContradicted
    .map((c) => `${c.label} is "${c.observedLabel}", but this fault requires "${c.expectedLabels.join('" or "')}".`)
    .join(' ');
}

/**
 * Untested symptoms that would help most: those appearing in the required
 * conditions of faults that are still in play, most frequent first.
 */
function suggestSymptoms(evaluated, normalized, symptomDefs) {
  const inPlay = evaluated.filter((e) => e.result.confidence !== 'ruled_out');
  const withEvidence = inPlay.filter((e) => e.result.evidence.requiredMatched.length > 0);
  const pool = withEvidence.length > 0 ? withEvidence : inPlay;

  const counts = new Map();
  for (const { fault } of pool) {
    for (const key of Object.keys(fault.conditions.required)) {
      if (normalized[key] === NOT_TESTED) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const order = Object.keys(symptomDefs);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([key]) => ({ symptom: key, label: symptomDefs[key].label, howToTest: symptomDefs[key].howToTest }));
}

/**
 * Diagnose likely faults from reported symptoms.
 *
 * @param {Record<string, string>} observed - symptom key -> value; omitted keys are "not_tested".
 * @param {{ faults?: object[], symptoms?: object }} [data] - override the rule data (for tests).
 * @throws {SymptomValidationError} on unknown symptom keys or values.
 */
export function diagnose(observed, { faults = defaultFaults, symptoms: symptomDefs = defaultSymptoms } = {}) {
  const normalized = normalizeSymptoms(observed, symptomDefs);

  const evaluated = faults.map((fault, index) => ({
    fault,
    index,
    result: evaluateFault(fault, normalized, symptomDefs),
  }));

  const results = evaluated
    .filter((e) => e.result.confidence === 'likely' || e.result.confidence === 'possible')
    .sort(
      (a, b) =>
        CONFIDENCE_RANK[a.result.confidence] - CONFIDENCE_RANK[b.result.confidence] ||
        b.result.score - a.result.score ||
        a.index - b.index,
    )
    .map(({ fault, result }) => ({
      faultId: fault.id,
      name: fault.name,
      category: fault.category,
      description: fault.description,
      confidence: result.confidence,
      score: result.score,
      maxScore: result.maxScore,
      explanation: explain(result.confidence, result.evidence),
      evidence: result.evidence,
      checks: fault.checks,
      fix: fault.fix,
      verify: fault.verify,
    }));

  const ruledOut = evaluated
    .filter((e) => e.result.confidence === 'ruled_out')
    .map(({ fault, result }) => ({ faultId: fault.id, name: fault.name, reason: ruledOutReason(result.evidence) }));

  const diagnosed = results.some((r) => r.confidence === 'likely');

  return {
    status: diagnosed ? 'diagnosis' : 'insufficient_evidence',
    message: diagnosed
      ? `Most likely: ${results[0].name}. Run the checks to confirm before changing the configuration.`
      : NO_DIAGNOSIS_MESSAGE,
    symptomsReported: Object.values(normalized).filter((v) => v !== NOT_TESTED).length,
    results,
    ruledOut,
    suggestedSymptoms: suggestSymptoms(evaluated, normalized, symptomDefs),
  };
}
