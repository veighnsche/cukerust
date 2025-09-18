import * as vscode from 'vscode';

export function bodyRange(lineText: string, keyword: string, body: string, line: number): vscode.Range {
  const esc = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pref = new RegExp(`^(\\s*${esc}\\s+)`).exec(lineText);
  const start = pref ? pref[0].length : Math.max(0, lineText.indexOf(body));
  return new vscode.Range(line, start, line, Math.max(start + body.length, start));
}

export const featureSelector: vscode.DocumentSelector = [
  { language: 'feature' },
  { language: 'gherkin' as any },
  { language: 'cucumber' as any },
  { pattern: '**/*.feature' },
];
