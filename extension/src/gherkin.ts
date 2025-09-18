export type DialectCode = 'en' | 'es';

export interface Dialect {
  Given: string[];
  When: string[];
  Then: string[];
  And: string[];
  But: string[];
}

const DIALECTS: Record<DialectCode, Dialect> = {
  en: {
    Given: ['Given'],
    When: ['When'],
    Then: ['Then'],
    And: ['And'],
    But: ['But'],
  },
  es: {
    Given: ['Dado', 'Dada'],
    When: ['Cuando'],
    Then: ['Entonces'],
    And: ['Y'],
    But: ['Pero'],
  },
};

export function detectDialect(text: string, configured: 'auto' | DialectCode = 'auto'): DialectCode {
  if (configured !== 'auto') return configured;
  const m = /^\s*#\s*language:\s*([A-Za-z0-9_-]+)/m.exec(text);
  if (!m) return 'en';
  const code = (m[1] || '').trim().toLowerCase();
  if (code.startsWith('es')) return 'es';
  return 'en';
}

export function getDialect(code: DialectCode): Dialect {
  return DIALECTS[code] || DIALECTS.en;
}

export interface OutlineContext {
  isOutline: boolean;
  examples: Record<string, string>[]; // list of rows
  header: string[]; // header names
}

export function extractOutlineContext(text: string, lineIndex: number): OutlineContext {
  // Very simple structural parser: walk upwards to find "Scenario Outline:" and downwards for "Examples:" tables
  const lines = text.split(/\r?\n/);
  let isOutline = false;
  let start = -1;
  for (let i = lineIndex; i >= 0; i--) {
    const t = lines[i].trim();
    if (/^Scenario Outline:/i.test(t)) { isOutline = true; start = i; break; }
    if (/^Scenario:/i.test(t) || /^Feature:/i.test(t)) { break; }
  }
  if (!isOutline) return { isOutline, examples: [], header: [] };
  // Find the nearest Examples after the outline block start
  let examplesStart = -1;
  for (let i = start + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (/^Examples:/i.test(t)) { examplesStart = i; break; }
    if (/^Scenario( Outline)?:/i.test(t)) break;
  }
  if (examplesStart === -1) return { isOutline, examples: [], header: [] };
  // Read table header and rows
  let header: string[] = [];
  const rows: Record<string, string>[] = [];
  for (let i = examplesStart + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!/^\s*\|/.test(raw)) {
      if (raw.trim() === '') continue;
      break;
    }
    const cells = raw.trim().replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map(s => s.trim());
    if (header.length === 0) {
      header = cells;
    } else {
      const row: Record<string, string> = {};
      for (let c = 0; c < header.length; c++) {
        row[header[c]] = cells[c] ?? '';
      }
      rows.push(row);
    }
  }
  return { isOutline, examples: rows, header };
}

export function resolvePlaceholders(body: string, row: Record<string, string>): string {
  return body.replace(/<([^>]+)>/g, (_, name) => row[name] ?? `<${name}>`);
}

export function buildStepKeywordRegex(d: Dialect): RegExp {
  const kws = [
    ...d.Given,
    ...d.When,
    ...d.Then,
    ...d.And,
    ...d.But,
  ]
    .map(s => s.replace(/[.*+?^${}()|[\]\\]/g, r => `\\${r}`))
    .join('|');
  return new RegExp(`^\\s*(${kws})\\s+(.+)$`);
}
