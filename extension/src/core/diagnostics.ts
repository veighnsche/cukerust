import * as vscode from 'vscode';
import { detectDialect, getDialect, buildStepKeywordRegex, extractOutlineContext, resolvePlaceholders } from '../gherkin';
import type { StepEntry, StepIndex } from '../types';
import type { MatchMode } from './match';

export function buildDiagnostics(
  doc: vscode.TextDocument,
  index: StepIndex | undefined,
  match: (steps: StepEntry[], kind: 'Given'|'When'|'Then', body: string, mode?: MatchMode) => StepEntry[],
  cfg: vscode.WorkspaceConfiguration,
): vscode.Diagnostic[] {
  const diags: vscode.Diagnostic[] = [];
  if (!index) return diags;
  const text = doc.getText();
  const lines = text.split(/\r?\n/);
  const configured = cfg.get<'auto'|'en'|'es'>('dialect', 'auto');
  const matchMode = cfg.get<'anchored'|'smart'|'substring'>('regex.matchMode', 'smart');
  const code = detectDialect(text, configured);
  const dialect = getDialect(code);
  const stepRe = buildStepKeywordRegex(dialect);
  let lastKind: 'Given' | 'When' | 'Then' | undefined;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = stepRe.exec(line);
    if (!m) continue;
    const keyword = m[1];
    const body = m[2];
    let kind: 'Given' | 'When' | 'Then';
    if (dialect.And.includes(keyword) || dialect.But.includes(keyword)) {
      kind = lastKind ?? 'Given';
    } else if (dialect.Given.includes(keyword)) {
      kind = 'Given';
      lastKind = kind;
    } else if (dialect.When.includes(keyword)) {
      kind = 'When';
      lastKind = kind;
    } else if (dialect.Then.includes(keyword)) {
      kind = 'Then';
      lastKind = kind;
    } else {
      continue;
    }
    // Outline handling
    const oc = extractOutlineContext(text, i);
    if (oc.isOutline && oc.examples.length > 0 && /<[^>]+>/.test(body)) {
      let anyOk = false;
      let anyAmb = false;
      for (const row of oc.examples) {
        const resolved = resolvePlaceholders(body, row);
        const matches = match(index.steps, kind, resolved, matchMode);
        if (matches.length > 1) anyAmb = true;
        if (matches.length >= 1) anyOk = true;
      }
      if (!anyOk) {
        const d = new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), 'Undefined step (none of the Examples values match)', vscode.DiagnosticSeverity.Warning);
        d.source = 'CukeRust';
        diags.push(d);
      } else if (anyAmb) {
        const d = new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), 'Ambiguous step (one or more Examples values have multiple matches)', vscode.DiagnosticSeverity.Warning);
        d.source = 'CukeRust';
        diags.push(d);
      }
    } else {
      const matches = match(index.steps, kind, body, matchMode);
      if (matches.length === 0) {
        const d = new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), 'Undefined step', vscode.DiagnosticSeverity.Warning);
        d.source = 'CukeRust';
        diags.push(d);
      } else if (matches.length > 1) {
        const d = new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), 'Ambiguous step', vscode.DiagnosticSeverity.Warning);
        d.source = 'CukeRust';
        diags.push(d);
      }
    }
  }
  return diags;
}
