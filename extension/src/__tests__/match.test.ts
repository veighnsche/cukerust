import { describe, it, expect } from 'vitest';
import { matchStep, patternForMode, normalizeBody, type MatchMode } from '../core/match';
import type { StepEntry } from '../types';

const steps: StepEntry[] = [
  { kind: 'Given', regex: '^I have (\\d+) cukes$', file: 'src/steps.rs', line: 10 },
  { kind: 'When', regex: 'I eat (.+)', file: 'src/steps.rs', line: 20 },
  { kind: 'Then', regex: '^done$', file: 'src/steps.rs', line: 30 },
];

describe('core/match', () => {
  it('normalizes body', () => {
    expect(normalizeBody('  hello  ')).toBe('hello');
  });
  it('patternForMode anchors appropriately', () => {
    expect(patternForMode('a', 'anchored')).toBe('^a$');
    expect(patternForMode('^a$', 'anchored')).toBe('^a$');
    expect(patternForMode('a', 'smart')).toBe('^a$');
    expect(patternForMode('^a$', 'smart')).toBe('^a$');
    expect(patternForMode('a', 'substring')).toBe('a');
  });
  it('matches steps with anchored mode', () => {
    const res = matchStep(steps, 'Given', 'I have 5 cukes', 'anchored');
    expect(res.length).toBe(1);
    expect(res[0].line).toBe(10);
  });
  it('matches steps with smart mode (adds anchors when absent)', () => {
    const res = matchStep(steps, 'When', 'I eat apples', 'smart');
    expect(res.length).toBe(1);
    expect(res[0].line).toBe(20);
  });
  it('does not cross-kind match', () => {
    const res = matchStep(steps, 'Given', 'done', 'anchored');
    expect(res.length).toBe(0);
  });
});
