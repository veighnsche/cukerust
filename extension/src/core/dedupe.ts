import type { StepEntry } from '../types';

export function dedupeSteps(steps: StepEntry[]): StepEntry[] {
  const seen = new Set<string>();
  const out: StepEntry[] = [];
  for (const s of steps) {
    const key = `${s.kind}|${s.regex}|${s.file}|${s.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}
