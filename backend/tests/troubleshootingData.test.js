import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { faults, NOT_TESTED, symptoms } from '../src/troubleshooting/troubleshootingData.js';

const DEVICES = ['pc', 'router', 'switch'];
const CATEGORIES = ['addressing', 'services', 'switching', 'inter-vlan', 'routing', 'internet', 'security'];
const asArray = (v) => (Array.isArray(v) ? v : [v]);

const EXPECTED_FAULT_IDS = [
  'wrong-ip-or-mask',
  'wrong-default-gateway',
  'duplicate-ip',
  'dhcp-server-problem',
  'dhcp-relay-missing',
  'dns-problem',
  'port-in-wrong-vlan',
  'trunk-misconfigured',
  'interface-down',
  'subinterface-misconfigured',
  'missing-route',
  'default-route-missing',
  'nat-misconfigured',
  'acl-blocking-traffic',
];

const nonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

describe('symptom definitions', () => {
  it.each(Object.entries(symptoms))('%s has a label, test instructions and fixed values', (_key, def) => {
    expect(nonEmptyString(def.label)).toBe(true);
    expect(nonEmptyString(def.howToTest)).toBe(true);
    const values = Object.keys(def.values);
    expect(values.length).toBeGreaterThanOrEqual(3);
    expect(values).toContain(NOT_TESTED);
    for (const valueLabel of Object.values(def.values)) {
      expect(nonEmptyString(valueLabel)).toBe(true);
    }
  });

  it('every symptom is used by at least one fault condition', () => {
    const used = new Set(
      faults.flatMap((f) => [...Object.keys(f.conditions.required), ...Object.keys(f.conditions.supporting)]),
    );
    for (const key of Object.keys(symptoms)) {
      expect(used.has(key), `symptom "${key}" is never used`).toBe(true);
    }
  });
});

describe('fault definitions', () => {
  it('contains exactly the 14 planned faults', () => {
    expect(faults.map((f) => f.id).sort()).toEqual([...EXPECTED_FAULT_IDS].sort());
  });

  it('has unique fault IDs', () => {
    const ids = faults.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique fault names', () => {
    const names = faults.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(faults.map((f) => [f.id, f]))('%s has all required fields', (_id, fault) => {
    expect(fault.id).toMatch(/^[a-z]+(-[a-z]+)*$/);
    expect(nonEmptyString(fault.name)).toBe(true);
    expect(CATEGORIES).toContain(fault.category);
    expect(nonEmptyString(fault.description)).toBe(true);

    expect(Object.keys(fault.conditions.required).length).toBeGreaterThan(0);
    expect(typeof fault.conditions.supporting).toBe('object');

    expect(fault.checks.length).toBeGreaterThan(0);
    for (const check of fault.checks) {
      expect(Object.keys(check).sort()).toEqual(['command', 'device', 'lookFor', 'purpose']);
      expect(nonEmptyString(check.command)).toBe(true);
      expect(nonEmptyString(check.purpose)).toBe(true);
      expect(nonEmptyString(check.lookFor)).toBe(true);
    }

    expect(nonEmptyString(fault.fix.summary)).toBe(true);
    expect(Array.isArray(fault.fix.steps)).toBe(true);
    expect(Array.isArray(fault.fix.commands)).toBe(true);
    expect(fault.fix.steps.length + fault.fix.commands.length).toBeGreaterThan(0);

    expect(fault.verify.length).toBeGreaterThan(0);
    for (const step of fault.verify) {
      expect(nonEmptyString(step.command)).toBe(true);
      expect(nonEmptyString(step.lookFor)).toBe(true);
    }
  });

  it('only references symptom keys that exist', () => {
    for (const fault of faults) {
      for (const key of [...Object.keys(fault.conditions.required), ...Object.keys(fault.conditions.supporting)]) {
        expect(symptoms, `${fault.id} uses unknown symptom "${key}"`).toHaveProperty(key);
      }
    }
  });

  it('only uses allowed symptom values, and never "not_tested", in conditions', () => {
    for (const fault of faults) {
      for (const conditions of [fault.conditions.required, fault.conditions.supporting]) {
        for (const [key, expected] of Object.entries(conditions)) {
          const values = asArray(expected);
          expect(values.length).toBeGreaterThan(0);
          for (const value of values) {
            expect(Object.keys(symptoms[key].values), `${fault.id}.${key}`).toContain(value);
            expect(value, `${fault.id}.${key}`).not.toBe(NOT_TESTED);
          }
        }
      }
    }
  });

  it('only uses valid devices in checks, fixes and verification steps', () => {
    for (const fault of faults) {
      for (const item of [...fault.checks, ...fault.fix.commands, ...fault.verify]) {
        expect(DEVICES, `${fault.id}: ${item.command}`).toContain(item.device);
      }
    }
  });

  it('keeps PC commands and Cisco IOS commands on the right devices', () => {
    const pcOnly = /^(ipconfig|nslookup|tracert|arp -a)\b/;
    const iosOnly = /^(show |configure terminal|traceroute|clear |interface |ip |no |switchport |vlan |end$|exit$)/;
    for (const fault of faults) {
      for (const item of [...fault.checks, ...fault.fix.commands, ...fault.verify]) {
        if (pcOnly.test(item.command)) expect(item.device, item.command).toBe('pc');
        if (iosOnly.test(item.command)) expect(item.device, item.command).not.toBe('pc');
      }
    }
  });

  it('never joins several commands with "/" in one command string', () => {
    for (const fault of faults) {
      for (const item of [...fault.checks, ...fault.fix.commands, ...fault.verify]) {
        expect(item.command, `${fault.id}: ${item.command}`).not.toMatch(/\s\/\s/);
      }
    }
  });

  it('is frozen so callers cannot mutate the rule data', () => {
    expect(Object.isFrozen(faults)).toBe(true);
    expect(Object.isFrozen(faults[0].conditions.required)).toBe(true);
    expect(Object.isFrozen(symptoms.gatewayPing.values)).toBe(true);
  });
});

describe('module format', () => {
  const srcDir = fileURLToPath(new URL('../src', import.meta.url));

  const listJsFiles = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? listJsFiles(join(dir, entry.name)) : entry.name.endsWith('.js') ? [join(dir, entry.name)] : [],
    );

  it('uses ES modules only (no CommonJS module.exports or require)', () => {
    const files = listJsFiles(srcDir);
    expect(files.some((f) => f.endsWith('troubleshootingData.js'))).toBe(true);
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source, file).not.toMatch(/module\.exports|exports\.\w+\s*=|\brequire\s*\(/);
    }
  });

  it('exposes symptoms and faults as named exports', async () => {
    const mod = await import('../src/troubleshooting/troubleshootingData.js');
    expect(mod.symptoms).toBe(symptoms);
    expect(mod.faults).toBe(faults);
    expect(mod.default).toBeUndefined();
  });
});
