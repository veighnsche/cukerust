import * as vscode from 'vscode';
import { StepIndexManager } from './indexer';
import { detectDialect, getDialect, buildStepKeywordRegex, extractOutlineContext, resolvePlaceholders } from './gherkin';
import { toSnippet } from './utils';

export function registerProviders(
  context: vscode.ExtensionContext,
  manager: StepIndexManager,
) {
  // Go-to-definition
  const ds: vscode.DocumentSelector = [
    { language: 'feature' },
    { language: 'gherkin' as any },
    { language: 'cucumber' as any },
    { pattern: '**/*.feature' },
  ];

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(ds, {
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
      ds,
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
    vscode.languages.registerHoverProvider(ds, {
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
              md.isTrusted = true;
              // Title
              md.appendMarkdown(`### ${s.kind}\n`);
              // Regex block
              md.appendCodeblock(s.regex, 'regex');
              // File link
              const root = folder?.uri ?? vscode.Uri.file('/');
              const target = vscode.Uri.joinPath(root, s.file);
              const lineNum = Math.max(0, (s.line ?? 1) - 1);
              const openCmd = `command:vscode.open?${encodeURIComponent(JSON.stringify([target.with({ fragment: `L${lineNum + 1}` })]))}`;
              md.appendMarkdown(`Source: [${s.file}:${s.line}](${openCmd})\n`);
              // Resolved outline value if applicable
              if (b !== body) {
                md.appendMarkdown(`Resolved: \`${b}\`\n`);
              }
              // Capture groups preview
              try {
                const re = new RegExp(s.regex.replace(/^\^|\$$/g, ''));
                const mm = re.exec(b);
                if (mm && mm.length > 1) {
                  md.appendMarkdown('\n**Captures**\n');
                  for (let i = 1; i < mm.length; i++) {
                    md.appendMarkdown(`- $${i}: \`${mm[i]}\`\n`);
                  }
                }
              } catch {}
              // Ambiguity note
              if (matches.length > 1) {
                md.appendMarkdown(`\n> Note: ${matches.length - 1} other candidate(s) exist. Use Go to Definition to disambiguate or run \`CukeRust: Clear Ambiguity Choices\`.\n`);
              }
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
    vscode.languages.registerCodeLensProvider(ds, new ScenarioCodeLensProvider()),
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
