import * as vscode from 'vscode';
import { StepIndexManager } from './indexer';
import { detectDialect, getDialect, buildStepKeywordRegex, extractOutlineContext, resolvePlaceholders } from './gherkin';
import { toSnippet } from './utils';

export function registerProviders(
  context: vscode.ExtensionContext,
  manager: StepIndexManager,
) {
  // Go-to-definition
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider({ language: 'feature' }, {
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
        if (remembered) {
          const root = folder?.uri ?? vscode.Uri.file('/');
          const target = vscode.Uri.joinPath(root, remembered.file);
          const pos = new vscode.Position(Math.max(0, (remembered.line ?? 1) - 1), 0);
          return new vscode.Location(target, pos);
        }
        if (matches.length === 0) return undefined;
        const targets = matches.map((s) => {
          const root = folder?.uri ?? vscode.Uri.file('/');
          const target = vscode.Uri.joinPath(root, s.file);
          const pos = new vscode.Position(Math.max(0, (s.line ?? 1) - 1), 0);
          return new vscode.Location(target, pos);
        });
        if (targets.length === 1) return targets;
        // Present quick pick and remember choice
        const items = matches.map((s) => ({ label: `${s.file}:${s.line}`, description: `${s.kind} /${s.regex}/`, s }));
        const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Multiple step definitions found. Choose one to remember.' });
        if (picked) {
          const s = picked.s;
          manager.setAmbiguityChoice(`${kind}|${body}`, { file: s.file, line: s.line });
          const root = folder?.uri ?? vscode.Uri.file('/');
          const target = vscode.Uri.joinPath(root, s.file);
          const pos = new vscode.Position(Math.max(0, (s.line ?? 1) - 1), 0);
          return new vscode.Location(target, pos);
        }
        return targets;
      },
    }),
  );

  // Completion
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: 'feature' },
      {
        provideCompletionItems(doc, position) {
          const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
          const enabled = vscode.workspace.getConfiguration('cukerust', folder ?? undefined).get<boolean>('completion.enabled', true);
          if (!enabled) return [];
          const index = manager.getIndex(folder ?? null);
          if (!index) return [];
          const items: vscode.CompletionItem[] = [];
          for (const s of index.steps) {
            const label = `${s.kind}: ${s.regex}`;
            const ci = new vscode.CompletionItem(label, vscode.CompletionItemKind.Snippet);
            ci.insertText = new vscode.SnippetString(toSnippet(s.regex));
            ci.detail = `${s.file}:${s.line}`;
            items.push(ci);
          }
          return items;
        },
      },
      ' ', // trigger on space
    ),
  );

  // Hover
  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ language: 'feature' }, {
      provideHover(doc, position) {
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
        const body = m[2];
        const oc = extractOutlineContext(text, position.line);
        const bodies: string[] = (oc.isOutline && oc.examples.length > 0 && /<[^>]+>/.test(body))
          ? oc.examples.map((row) => resolvePlaceholders(body, row))
          : [body];
        const kinds: ('Given'|'When'|'Then')[] = ['Given','When','Then'];
        for (const kind of kinds) {
          for (const b of bodies) {
            const matches = manager.matchStep(index.steps, kind, b);
            if (matches.length) {
              const s = matches[0];
              const md = new vscode.MarkdownString();
              md.appendMarkdown(`**${s.kind}**  \\\n`);
              md.appendMarkdown(`/${s.regex}/  \\\n`);
              if ((s as any).function) md.appendMarkdown(`fn: ${(s as any).function}  \\\n`);
              md.appendMarkdown(`${s.file}:${s.line}`);
              if (b !== body) {
                md.appendMarkdown(`  \\\n`);
                md.appendMarkdown(`Resolved: ${b}`);
              }
              md.isTrusted = false;
              return new vscode.Hover(md);
            }
          }
        }
        return undefined;
      },
    }),
  );

  // CodeLens for running scenarios
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider({ language: 'feature' }, new ScenarioCodeLensProvider()),
  );
}

class ScenarioCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(doc: vscode.TextDocument): vscode.ProviderResult<vscode.CodeLens[]> {
    const lenses: vscode.CodeLens[] = [];
    for (let i = 0; i < doc.lineCount; i++) {
      const text = doc.lineAt(i).text;
      const m = /^\s*Scenario:\s*(.+)$/.exec(text);
      if (m) {
        const scenarioName = m[1].trim();
        const range = new vscode.Range(i, 0, i, text.length);
        lenses.push(new vscode.CodeLens(range, {
          command: 'cukerust.runScenario',
          title: 'Run Scenario',
          arguments: [{ featurePath: doc.uri.fsPath, scenarioName }],
        }));
      }
    }
    return lenses;
  }
}
