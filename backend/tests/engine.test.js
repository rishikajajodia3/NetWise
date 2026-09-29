import { describe, expect, it } from 'vitest';
import {
  diagnose,
  evaluateFault,
  NO_DIAGNOSIS_MESSAGE,
  normalizeSymptoms,
  SymptomValidationError,
} from '../src/troubleshooting/engine.js';
import { faults, NOT_TESTED, symptoms } from '../src/troubleshooting/troubleshootingData.js';

const ids = (results) => results.map((r) => r.faultId);
const find = (report, id) => report.results.find((r) => r.faultId === id);

// Top diagnoses produced by the scenario tests below (they run in order).
const diagnosedFaults = new Set();

/** The top result must be the expected fault, with "likely" confidence. */
function expectTopDiagnosis(report, faultId) {
  expect(report.status).toBe('diagnosis');
  expect(report.results[0].faultId).toBe(faultId);
  expect(report.results[0].confidence).toBe('likely');
  diagnosedFaults.add(faultId);
  // Strictly ahead of any other likely fault, so the ranking is not a tie broken by list order.
  const otherLikely = report.results.slice(1).filter((r) => r.confidence === 'likely');
  for (const other of otherLikely) {
    expect(report.results[0].score, `${faultId} vs ${other.faultId}`).toBeGreaterThan(other.score);
  }
}

describe('fault scenarios', () => {
  it('A. wrong default gateway', () => {
    const report = diagnose({
      pcIpStatus: 'in_planned_subnet',
      pcGatewayMatchesPlan: 'no',
      gatewayPing: 'success',
      sameVlanPing: 'success',
      otherVlanPing: 'fail',
      remoteNetworkPing: 'fail',
      remotePingMessage: 'timed_out',
    });
    expectTopDiagnosis(report, 'wrong-default-gateway');
    // Missing route shares the ping pattern but the other evidence points away from it.
    expect(find(report, 'missing-route')?.confidence).toBe('possible');
  });

  it('B. wrong IP address or subnet mask', () => {
    const report = diagnose({
      pcIpStatus: 'wrong_subnet_or_mask',
      linkLights: 'all_green',
      gatewayPing: 'fail',
      otherVlanPing: 'fail',
    });
    expectTopDiagnosis(report, 'wrong-ip-or-mask');
    expect(ids(report.ruledOut)).toEqual(
      expect.arrayContaining(['dhcp-server-problem', 'interface-down', 'trunk-misconfigured']),
    );
  });

  it('C. PC port in the wrong VLAN', () => {
    const report = diagnose({
      pcIpStatus: 'in_planned_subnet',
      pcGatewayMatchesPlan: 'yes',
      linkLights: 'all_green',
      gatewayPing: 'fail',
      sameVlanPing: 'fail',
      otherVlansReachGateway: 'yes',
    });
    expectTopDiagnosis(report, 'port-in-wrong-vlan');
    expect(ids(report.ruledOut)).toContain('subinterface-misconfigured');
  });

  it('C2. trunk problem when every VLAN loses its gateway', () => {
    const report = diagnose({
      pcIpStatus: 'in_planned_subnet',
      pcGatewayMatchesPlan: 'yes',
      linkLights: 'all_green',
      gatewayPing: 'fail',
      sameVlanPing: 'success',
      otherVlansReachGateway: 'no',
    });
    expectTopDiagnosis(report, 'trunk-misconfigured');
    expect(ids(report.ruledOut)).toEqual(expect.arrayContaining(['subinterface-misconfigured', 'port-in-wrong-vlan']));
  });

  it('D. missing route', () => {
    const report = diagnose({
      pcIpStatus: 'in_planned_subnet',
      pcGatewayMatchesPlan: 'yes',
      gatewayPing: 'success',
      otherVlanPing: 'success',
      remoteNetworkPing: 'fail',
      remotePingMessage: 'unreachable_from_gateway',
      routeToDestination: 'no',
      aclOnPath: 'no',
    });
    expectTopDiagnosis(report, 'missing-route');
    expect(report.results[0].score).toBe(report.results[0].maxScore);
    expect(ids(report.ruledOut)).toEqual(expect.arrayContaining(['acl-blocking-traffic', 'wrong-default-gateway']));
  });

  it('E. DHCP server problem', () => {
    const report = diagnose({
      pcIpStatus: 'apipa_169_254',
      dhcpServerLocation: 'same_subnet',
      linkLights: 'all_green',
    });
    expectTopDiagnosis(report, 'dhcp-server-problem');
    expect(ids(report.ruledOut)).toContain('dhcp-relay-missing');
  });

  it('F. missing DHCP relay', () => {
    const report = diagnose({
      pcIpStatus: 'apipa_169_254',
      dhcpServerLocation: 'different_subnet',
      linkLights: 'all_green',
    });
    expectTopDiagnosis(report, 'dhcp-relay-missing');
    // A broken pool on the remote server is still plausible, but ranked lower.
    expect(ids(report.results)).toContain('dhcp-server-problem');
  });

  it('G. DNS problem', () => {
    const report = diagnose({
      pcIpStatus: 'in_planned_subnet',
      gatewayPing: 'success',
      serverPingByIp: 'success',
      pingByName: 'fail',
    });
    expectTopDiagnosis(report, 'dns-problem');
    expect(ids(report.results)).toEqual(['dns-problem']);
  });

  it('H. NAT problem', () => {
    const report = diagnose({
      pcIpStatus: 'in_planned_subnet',
      gatewayPing: 'success',
      remoteNetworkPing: 'success',
      internetPingFromRouter: 'success',
      internetPingFromPc: 'fail',
    });
    expectTopDiagnosis(report, 'nat-misconfigured');
    expect(ids(report.ruledOut)).toEqual(expect.arrayContaining(['default-route-missing', 'missing-route']));
  });

  it('I. default route missing', () => {
    const report = diagnose({
      linkLights: 'all_green',
      gatewayPing: 'success',
      remoteNetworkPing: 'success',
      internetPingFromRouter: 'fail',
      internetPingFromPc: 'fail',
    });
    expectTopDiagnosis(report, 'default-route-missing');
    expect(ids(report.ruledOut)).toContain('nat-misconfigured');
  });

  it('J. ACL blocking traffic', () => {
    const report = diagnose({
      pcGatewayMatchesPlan: 'yes',
      gatewayPing: 'success',
      otherVlanPing: 'success',
      remoteNetworkPing: 'fail',
      remotePingMessage: 'unreachable_from_gateway',
      routeToDestination: 'yes',
      aclOnPath: 'yes',
    });
    expectTopDiagnosis(report, 'acl-blocking-traffic');
    // Same ping results as a missing route: the route table and ACL answers decide the ranking.
    expect(find(report, 'missing-route')).toBeDefined();
    expect(find(report, 'missing-route').score).toBeLessThan(report.results[0].score);
  });

  it('K. router subinterface problem', () => {
    const report = diagnose({
      pcIpStatus: 'in_planned_subnet',
      pcGatewayMatchesPlan: 'yes',
      linkLights: 'all_green',
      gatewayPing: 'fail',
      sameVlanPing: 'success',
      otherVlansReachGateway: 'yes',
    });
    expectTopDiagnosis(report, 'subinterface-misconfigured');
    expect(ids(report.ruledOut)).toContain('port-in-wrong-vlan');
  });

  it('L. interface down', () => {
    const report = diagnose({
      pcIpStatus: 'in_planned_subnet',
      linkLights: 'some_red',
      gatewayPing: 'fail',
    });
    expectTopDiagnosis(report, 'interface-down');
    expect(ids(report.ruledOut)).toEqual(
      expect.arrayContaining(['port-in-wrong-vlan', 'trunk-misconfigured', 'subinterface-misconfigured']),
    );
  });

  it('M. duplicate IP', () => {
    const report = diagnose({
      pcIpStatus: 'in_planned_subnet',
      pcGatewayMatchesPlan: 'yes',
      ipConflictWarning: 'yes',
      connectivityIntermittent: 'yes',
    });
    expectTopDiagnosis(report, 'duplicate-ip');
  });

  it('every fault is the top diagnosis for at least one scenario above', () => {
    // Guards against a fault that the rules can never select.
    expect([...diagnosedFaults].sort()).toEqual(faults.map((f) => f.id).sort());
  });
});

describe('N. insufficient evidence', () => {
  it('returns no diagnosis for an empty symptom object', () => {
    const report = diagnose({});
    expect(report.status).toBe('insufficient_evidence');
    expect(report.message).toBe(NO_DIAGNOSIS_MESSAGE);
    expect(report.results).toEqual([]);
    expect(report.ruledOut).toEqual([]);
    expect(report.symptomsReported).toBe(0);
    expect(report.suggestedSymptoms.length).toBeGreaterThan(0);
  });

  it('treats explicit not_tested values the same as missing ones', () => {
    const allNotTested = Object.fromEntries(Object.keys(symptoms).map((k) => [k, NOT_TESTED]));
    expect(diagnose(allNotTested)).toEqual(diagnose({}));
  });

  it('does not force a diagnosis from a single ambiguous symptom', () => {
    const report = diagnose({ gatewayPing: 'success' });
    expect(report.status).toBe('insufficient_evidence');
    expect(report.message).toBe(NO_DIAGNOSIS_MESSAGE);
    expect(report.results.every((r) => r.confidence !== 'likely')).toBe(true);
    // It tells the user what to test next.
    const suggested = report.suggestedSymptoms.map((s) => s.symptom);
    expect(suggested).toContain('remoteNetworkPing');
    expect(suggested).toContain('aclOnPath');
  });

  it('reports partial matches as "possible", not as a diagnosis', () => {
    const report = diagnose({ gatewayPing: 'fail', linkLights: 'all_green', otherVlansReachGateway: 'no' });
    expect(report.status).toBe('insufficient_evidence');
    const trunk = find(report, 'trunk-misconfigured');
    expect(trunk.confidence).toBe('possible');
    expect(trunk.explanation).toMatch(/Test these to confirm/);
  });

  it('ignores not_tested values when scoring', () => {
    const base = { gatewayPing: 'success', remoteNetworkPing: 'fail' };
    const withNotTested = { ...base, aclOnPath: NOT_TESTED, routeToDestination: NOT_TESTED };
    expect(diagnose(withNotTested).results).toEqual(diagnose(base).results);
  });
});

describe('required conditions eliminate contradicted faults', () => {
  it('rules out wrong gateway when the gateway matches the plan, even with a matching ping pattern', () => {
    const report = diagnose({
      pcGatewayMatchesPlan: 'yes',
      gatewayPing: 'success',
      sameVlanPing: 'success',
      otherVlanPing: 'fail',
      remoteNetworkPing: 'fail',
      remotePingMessage: 'timed_out',
    });
    expect(ids(report.results)).not.toContain('wrong-default-gateway');
    const ruledOut = report.ruledOut.find((r) => r.faultId === 'wrong-default-gateway');
    expect(ruledOut.reason).toMatch(/requires/);
  });

  it('never ranks a fault whose required condition is contradicted, however much supporting evidence it has', () => {
    const customFaults = [
      {
        id: 'contradicted',
        name: 'Contradicted fault',
        category: 'routing',
        description: 'x',
        conditions: {
          required: { gatewayPing: 'fail' },
          supporting: { sameVlanPing: 'success', otherVlanPing: 'success', remoteNetworkPing: 'success' },
        },
        checks: [],
        fix: {},
        verify: [],
      },
    ];
    const report = diagnose(
      { gatewayPing: 'success', sameVlanPing: 'success', otherVlanPing: 'success', remoteNetworkPing: 'success' },
      { faults: customFaults },
    );
    expect(report.results).toEqual([]);
    expect(report.status).toBe('insufficient_evidence');
    expect(ids(report.ruledOut)).toEqual(['contradicted']);
  });

  it('evaluateFault reports the contradicting condition', () => {
    const fault = faults.find((f) => f.id === 'dhcp-relay-missing');
    const result = evaluateFault(fault, normalizeSymptoms({ dhcpServerLocation: 'same_subnet' }));
    expect(result.confidence).toBe('ruled_out');
    expect(result.evidence.requiredContradicted.map((c) => c.symptom)).toEqual(['dhcpServerLocation']);
  });
});

describe('input validation', () => {
  it.each([
    ['undefined', undefined],
    ['null', null],
    ['an array', []],
    ['a string', 'gatewayPing=fail'],
  ])('rejects %s', (_label, input) => {
    expect(() => diagnose(input)).toThrow(SymptomValidationError);
  });

  it('rejects unknown symptom keys', () => {
    expect(() => diagnose({ gatewayPng: 'fail' })).toThrow(/Unknown symptom "gatewayPng"/);
  });

  it('rejects values that are not allowed for the symptom', () => {
    expect(() => diagnose({ gatewayPing: 'yes' })).toThrow(SymptomValidationError);
    expect(() => diagnose({ gatewayPing: 'yes' })).toThrow(/Allowed values: success, fail, not_tested/);
    expect(() => diagnose({ gatewayPing: 'FAIL' })).toThrow(SymptomValidationError);
    expect(() => diagnose({ gatewayPing: true })).toThrow(SymptomValidationError);
    expect(() => diagnose({ linkLights: 'toString' })).toThrow(SymptomValidationError);
  });
});

describe('result format', () => {
  const report = diagnose({
    gatewayPing: 'success',
    otherVlanPing: 'success',
    remoteNetworkPing: 'fail',
    remotePingMessage: 'unreachable_from_gateway',
  });

  it('returns every field the API and UI need', () => {
    for (const result of report.results) {
      for (const field of ['faultId', 'name', 'category', 'confidence', 'score', 'maxScore', 'explanation',
        'checks', 'fix', 'verify']) {
        expect(result).toHaveProperty(field);
      }
      expect(result.explanation.length).toBeGreaterThan(0);
    }
  });

  it('is JSON-serialisable', () => {
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });

  it('is deterministic', () => {
    const input = {
      gatewayPing: 'success',
      otherVlanPing: 'success',
      remoteNetworkPing: 'fail',
      remotePingMessage: 'unreachable_from_gateway',
    };
    expect(diagnose(input)).toEqual(report);
    expect(diagnose(Object.fromEntries(Object.entries(input).reverse()))).toEqual(report);
  });

  it('ranks likely results before possible ones, then by score', () => {
    const order = report.results.map((r) => [r.confidence === 'likely' ? 0 : 1, -r.score]);
    const sorted = [...order].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    expect(order).toEqual(sorted);
  });
});
