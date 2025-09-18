import * as vscode from 'vscode';
import { StepIndexManager } from '../indexer';
import { detectDialect, getDialect, buildStepKeywordRegex } from '../gherkin';
import { featureSelector as ds, bodyRange } from './shared';

export function registerDocumentLinkProvider(
  context: vscode.ExtensionContext,
  manager: StepIndexManager,
): vscode.Disposable {
  return vscode.languages.registerDocumentLinkProvider(ds, {
    provideDocumentLinks(doc) {
      const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
      const index = manager.getIndex(folder ?? null);
      const text = doc.getText();
      const configured = vscode.workspace.getConfiguration('cukerust', folder ?? undefined).get<'auto'|'en'|'es'>('dialect', 'auto');
      const code = detectDialect(text, configured);
      const dialect = getDialect(code);
      const stepRe = buildStepKeywordRegex(dialect);
      const links: vscode.DocumentLink[] = [];
      for (let line = 0; line < doc.lineCount; line++) {
        const raw = doc.lineAt(line).text;
        const m = stepRe.exec(raw);
        if (!m) continue;
        const keyword = m[1];
        const body = m[2];
        // Determine effective kind (resolve And/But)
        let kind: 'Given'|'When'|'Then' = dialect.Given.includes(keyword) ? 'Given'
          : dialect.When.includes(keyword) ? 'When'
          : dialect.Then.includes(keyword) ? 'Then' : 'Given';
        if (dialect.And.includes(keyword) || dialect.But.includes(keyword)) {
          // look upward for prior explicit kind
          for (let i = line - 1; i >= 0; i--) {
            const t = doc.lineAt(i).text;
            const mm = stepRe.exec(t);
            if (mm) {
              const kw = mm[1];
              if (dialect.Given.includes(kw)) { kind = 'Given'; break; }
              if (dialect.When.includes(kw)) { kind = 'When'; break; }
              if (dialect.Then.includes(kw)) { kind = 'Then'; break; }
            }
          }
        }
        // Resolve matches; prefer remembered ambiguity choice
        const matches = index ? manager.matchStep(index.steps, kind, body) : [];
        const remembered = manager.getAmbiguityChoice(`${kind}|${body}`);
        if (remembered) {
          const target = {
            file: remembered.file,
            line: remembered.line ?? 1,
          };
          const range = bodyRange(raw, keyword, body, line);
          const rootUri = folder?.uri ?? vscode.Uri.file('/');
          const uri = vscode.Uri.joinPath(rootUri, target.file).with({ fragment: `L${target.line}` });
          const cmd = vscode.Uri.parse(`command:vscode.open?${encodeURIComponent(JSON.stringify([uri]))}`);
          const link = new vscode.DocumentLink(range, cmd);
          link.tooltip = 'Go to Step Definition';
          links.push(link);
          continue;
        }
        if (matches.length === 1) {
          const s = matches[0];
          const range = bodyRange(raw, keyword, body, line);
          const rootUri = folder?.uri ?? vscode.Uri.file('/');
          const uri = vscode.Uri.joinPath(rootUri, s.file).with({ fragment: `L${(s.line ?? 1)}` });
          const cmd = vscode.Uri.parse(`command:vscode.open?${encodeURIComponent(JSON.stringify([uri]))}`);
          const link = new vscode.DocumentLink(range, cmd);
          link.tooltip = 'Go to Step Definition';
          links.push(link);
        } else if (matches.length > 1) {
          const range = bodyRange(raw, keyword, body, line);
          const cmd = vscode.Uri.parse(
            `command:cukerust.goToStepByLink?${encodeURIComponent(JSON.stringify({ query: { kind, body, root: folder?.uri.toString() } }))}`,
          );
          const link = new vscode.DocumentLink(range, cmd);
          link.tooltip = 'Choose Step Definition';
          links.push(link);
        } else {
          // No matches yet: still create a link to trigger resolution (and show a message if nothing found)
          const range = bodyRange(raw, keyword, body, line);
          const cmd = vscode.Uri.parse(
            `command:cukerust.goToStepByLink?${encodeURIComponent(JSON.stringify({ query: { kind, body, root: folder?.uri.toString() } }))}`,
          );
          const link = new vscode.DocumentLink(range, cmd);
          link.tooltip = 'Find Step Definition';
          links.push(link);
        }
      }
      return links;
    },
  });
}
