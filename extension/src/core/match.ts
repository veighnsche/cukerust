import type { StepEntry } from '../types';

export type MatchMode = 'anchored' | 'smart' | 'substring';

export function normalizeBody(body: string): string {
  return body.trim();
}

export function patternForMode(regex: string, mode: MatchMode): string {
  if (mode === 'anchored') {
    let pattern = regex;
    if (!pattern.startsWith('^')) pattern = '^' + pattern;
    if (!pattern.endsWith('$')) pattern = pattern + '$';
    return pattern;
  }
  if (mode === 'smart') {
    const anchored = regex.startsWith('^') || regex.endsWith('$');
    return anchored ? regex : `^${regex}$`;
  }
  // substring
  return regex;
}

export function matchStep(steps: StepEntry[], kind: 'Given'|'When'|'Then', body: string, mode: MatchMode): StepEntry[] {
  const norm = normalizeBody(body);
  const results: StepEntry[] = [];
  for (const s of steps) {
    if (s.kind !== kind) continue;
    try {
      const re = new RegExp(patternForMode(s.regex, mode));
      if (re.test(norm)) results.push(s);
    } catch {
      // ignore invalid regex entries
    }
  }
  return results;
}
