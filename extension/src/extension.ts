import * as vscode from 'vscode';
import { StepIndexManager } from './indexer';

export function activate(context: vscode.ExtensionContext) {
  const manager = new StepIndexManager(context);
  const status = vscode.window.createStatusBarItem('cukerust.mode', vscode.StatusBarAlignment.Left, 100);
  status.name = 'CukeRust Mode';
  status.tooltip = 'CukeRust discovery mode';
  context.subscriptions.push(status);

  const disposable = vscode.commands.registerCommand('cukerust.rebuildIndex', async () => {
    await manager.rebuildAll();
    // Refresh diagnostics for all open feature documents
    for (const doc of vscode.workspace.textDocuments) {
      await manager.refreshDiagnostics(doc);
    }
    vscode.window.showInformationMessage('CukeRust: Step Index rebuilt');
  });

  context.subscriptions.push(disposable);

  const devCmd = vscode.commands.registerCommand('cukerust.dev.extractIndex', async () => {
    try {
      const wasm = await import('../native/cukerust-wasm');
      const files = [
        {
          path: 'src/steps_attr.rs',
          text: '#[then(regex = r"^done$")]\nfn ok() {}',
        },
        {
          path: 'src/steps_builder.rs',
          text: 'registry.given(r"^I have (\\d+) cukes$");',
        },
        {
          path: 'src/steps_macro.rs',
          text: 'given!(r"^start$", || {});',
        },
      ];
      const input = JSON.stringify({ files });
      const output = wasm.extract_step_index(input);
      const idx = JSON.parse(output);
      const total = idx?.stats?.total ?? idx?.steps?.length ?? 0;
      console.log('CukeRust: Step Index', idx);
      vscode.window.showInformationMessage(`CukeRust (Dev): Extracted ${total} steps from fixture`);
    } catch (err) {
      console.error('CukeRust dev extract error', err);
      vscode.window.showErrorMessage(`CukeRust (Dev) error: ${String(err)}`);
    }
  });

  context.subscriptions.push(devCmd);

  // Rebuild on activation for current workspace
  manager.rebuildAll().then(async () => {
    for (const doc of vscode.workspace.textDocuments) {
      await manager.refreshDiagnostics(doc);
    }
    manager.initWatchers();
    refreshStatusBar(status);
  });

  // Diagnostics refresh hooks
  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument((doc) => manager.refreshDiagnostics(doc)),
  );
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => manager.refreshDiagnostics(e.document)),
  );

  // Config/status updates
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('cukerust')) refreshStatusBar(status);
    }),
  );

  // Go-to-definition
  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider({ language: 'feature' }, {
      provideDefinition(doc, position) {
        const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
        const index = manager.getIndex(folder);
        if (!index) return undefined;
        const line = doc.lineAt(position.line).text;
        const m = /^(Given|When|Then|And|But)\s+(.+)$/.exec(line);
        if (!m) return undefined;
        let kind: 'Given' | 'When' | 'Then' = 'Given';
        const keyword = m[1];
        const body = m[2];
        if (keyword === 'Given' || keyword === 'When' || keyword === 'Then') kind = keyword as any;
        // simplistic: search backward for last explicit keyword
        if (keyword === 'And' || keyword === 'But') {
          for (let i = position.line - 1; i >= 0; i--) {
            const l = doc.lineAt(i).text;
            const mm = /^(Given|When|Then)\b/.exec(l);
            if (mm) { kind = mm[1] as any; break; }
          }
        }
        const matches = manager.matchStep(index.steps, kind, body);
        if (matches.length === 0) return undefined;
        const targets = matches.map((s) => {
          const root = folder?.uri ?? vscode.Uri.file('/');
          const target = vscode.Uri.joinPath(root, s.file);
          const pos = new vscode.Position(Math.max(0, (s.line ?? 1) - 1), 0);
          return new vscode.Location(target, pos);
        });
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
          const index = manager.getIndex(folder);
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
        const index = manager.getIndex(folder);
        if (!index) return undefined;
        const line = doc.lineAt(position.line).text;
        const m = /^(Given|When|Then|And|But)\s+(.+)$/.exec(line);
        if (!m) return undefined;
        const body = m[2];
        const kinds: ('Given'|'When'|'Then')[] = ['Given','When','Then'];
        for (const kind of kinds) {
          const matches = manager.matchStep(index.steps, kind, body);
          if (matches.length) {
            const s = matches[0];
            const md = new vscode.MarkdownString();
            md.appendMarkdown(`**${s.kind}**  \\`);
            md.appendMarkdown(`/${s.regex}/  \\`);
            md.appendMarkdown(`${s.file}:${s.line}`);
            md.isTrusted = false;
            return new vscode.Hover(md);
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

  // Run Scenario command
  context.subscriptions.push(
    vscode.commands.registerCommand('cukerust.runScenario', async (args?: { featurePath?: string; scenarioName?: string }) => {
      const editor = vscode.window.activeTextEditor;
      const doc = editor?.document;
      const featurePath = args?.featurePath ?? doc?.uri.fsPath;
      const scenarioName = args?.scenarioName ?? (editor ? extractScenarioName(editor.document, editor.selection.active.line) : undefined);
      if (!featurePath || !scenarioName) {
        vscode.window.showWarningMessage('CukeRust: No scenario context to run');
        return;
      }
      const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(featurePath));
      const template = vscode.workspace.getConfiguration('cukerust', folder).get<string>('run.template', 'echo Running ${scenarioName} in ${featurePath}');
      const cmd = template
        .replaceAll('${featurePath}', shellQuote(featurePath))
        .replaceAll('${scenarioName}', shellQuote(scenarioName))
        .replaceAll('${tags}', '');
      const term = vscode.window.createTerminal({ name: 'CukeRust' });
      term.show();
      term.sendText(cmd);
    }),
  );
}

export function deactivate() {}

export function toSnippet(regex: string): string {
  // Basic conversion: (\d+) -> ${1:number}; (.+) -> ${1:value}
  let idx = 1;
  return regex
    .replace(/\^|\$/g, '')
    .replace(/\\d\+/g, () => `\${${idx++}:number}`)
    .replace(/\(\.\+\)/g, () => `\${${idx++}:value}`);
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

function extractScenarioName(doc: vscode.TextDocument, line: number): string | undefined {
  for (let i = line; i >= 0; i--) {
    const m = /^\s*Scenario:\s*(.+)$/.exec(doc.lineAt(i).text);
    if (m) return m[1].trim();
  }
  return undefined;
}

function shellQuote(s: string): string {
  // Basic POSIX-like quoting
  if (s === '') return "''";
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(s)) return s; // safe
  return `'${s.replaceAll("'", `'"'"'`)}'`;
}
