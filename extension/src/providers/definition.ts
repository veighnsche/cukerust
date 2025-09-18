import * as vscode from 'vscode';
import { StepIndexManager } from '../indexer';
import { detectDialect, getDialect, buildStepKeywordRegex, extractOutlineContext, resolvePlaceholders } from '../gherkin';
import { bodyRange, featureSelector as ds } from './shared';

export function registerDefinitionProvider(
  context: vscode.ExtensionContext,
  manager: StepIndexManager,
): vscode.Disposable {
  return vscode.languages.registerDefinitionProvider(ds, {
    async provideDefinition(doc, position) {
      const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
      const index = manager.getIndex(folder ?? null);
      if (!index) return undefined;
      const text = doc.getText();
      const configured = vscode.workspace.getConfiguration('cukerust', folder ?? undefined).get<'auto'|'en'|'es'>('dialect', 'auto');
      const code = detectDialect(text, configured);
      const dialect = getDialect(code);
      const stepRe = buildStepKeywordRegex(dialect);
      const line = doc.lineAt(position.line).text;
      const m = stepRe.exec(line);
      if (!m) return undefined;
      const keyword = m[1];
      const body = m[2];
      let kind: 'Given' | 'When' | 'Then' = 'Given';
      if (dialect.Given.includes(keyword)) kind = 'Given';
      else if (dialect.When.includes(keyword)) kind = 'When';
      else if (dialect.Then.includes(keyword)) kind = 'Then';
      else if (dialect.And.includes(keyword) || dialect.But.includes(keyword)) {
        for (let i = position.line - 1; i >= 0; i--) {
          const l = doc.lineAt(i).text;
          const mm = stepRe.exec(l);
          if (mm) {
            const kw = mm[1];
            if (dialect.Given.includes(kw)) { kind = 'Given'; break; }
            if (dialect.When.includes(kw)) { kind = 'When'; break; }
            if (dialect.Then.includes(kw)) { kind = 'Then'; break; }
          }
        }
      }
      // Outline resolution
      const oc = extractOutlineContext(text, position.line);
      let bodies: string[] = [body];
      if (oc.isOutline && oc.examples.length > 0 && /<[^>]+>/.test(body)) {
        bodies = oc.examples.map((row) => resolvePlaceholders(body, row));
      }
      let matches: typeof index.steps = [];
      for (const b of bodies) {
        const ms = manager.matchStep(index.steps, kind, b);
        matches = matches.concat(ms);
      }
      // Ambiguity memory key: kind + original body
      const key = `${kind}|${body}`;
      const remembered = manager.getAmbiguityChoice(key);
      const origin = bodyRange(line, keyword, body, position.line);
      // If cursor is within the body, let DocumentLink provider own Ctrl+Click so the entire body is underlined
      if (position.character >= origin.start.character && position.character <= origin.end.character) {
        return undefined;
      }
      if (remembered) {
        const root = folder?.uri ?? vscode.Uri.file('/');
        const targetUri = vscode.Uri.joinPath(root, remembered.file);
        const pos = new vscode.Position(Math.max(0, (remembered.line ?? 1) - 1), 0);
        const link: vscode.LocationLink = {
          originSelectionRange: origin,
          targetUri,
          targetRange: new vscode.Range(pos, pos),
        };
        return [link];
      }
      if (matches.length === 0) return undefined;
      const links: vscode.LocationLink[] = matches.map((s) => {
        const root = folder?.uri ?? vscode.Uri.file('/');
        const targetUri = vscode.Uri.joinPath(root, s.file);
        const pos = new vscode.Position(Math.max(0, (s.line ?? 1) - 1), 0);
        return {
          originSelectionRange: origin,
          targetUri,
          targetRange: new vscode.Range(pos, pos),
        } satisfies vscode.LocationLink;
      });
      if (links.length === 1) return links;
      // Present quick pick and remember choice
      const items = matches.map((s) => ({ label: `${s.file}:${s.line}`, description: `${s.kind} /${s.regex}/`, s }));
      const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Multiple step definitions found. Choose one to remember.' });
      if (picked) {
        const s = picked.s;
        manager.setAmbiguityChoice(`${kind}|${body}`, { file: s.file, line: s.line });
        const root = folder?.uri ?? vscode.Uri.file('/');
        const targetUri = vscode.Uri.joinPath(root, s.file);
        const pos = new vscode.Position(Math.max(0, (s.line ?? 1) - 1), 0);
        const link: vscode.LocationLink = {
          originSelectionRange: origin,
          targetUri,
          targetRange: new vscode.Range(pos, pos),
        };
        return [link];
      }
      return links;
    },
  });
}
