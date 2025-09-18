import * as vscode from 'vscode';
import { StepIndexManager } from './indexer';
import { detectDialect, getDialect, buildStepKeywordRegex, extractOutlineContext, resolvePlaceholders } from './gherkin';
import { resolveRunCommand } from './run_matrix';
import { toSnippet, shellQuote } from './utils';

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
    refreshStatusBar(status, manager);
    status.command = 'cukerust.rebuildStatic';
  });

  context.subscriptions.push(disposable);

  const devCmd = vscode.commands.registerCommand('cukerust.dev.extractIndex', async () => {
    try {
      const wasm = await manager.ensureWasm();
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

  // Clear ambiguity memory
  context.subscriptions.push(vscode.commands.registerCommand('cukerust.clearAmbiguityMemory', () => manager.clearAmbiguityChoices()));

  // Force static scan rebuild (one-click fallback)
  context.subscriptions.push(vscode.commands.registerCommand('cukerust.rebuildStatic', async () => {
    await manager.rebuildAllStaticScan();
    for (const doc of vscode.workspace.textDocuments) {
      await manager.refreshDiagnostics(doc);
    }
    vscode.window.showInformationMessage('CukeRust: Rebuilt Step Index via Static Scan');
  }));

  // Dev micro-benchmark for matching modes
  context.subscriptions.push(vscode.commands.registerCommand('cukerust.dev.matchBenchmark', async () => {
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (folders.length === 0) { vscode.window.showWarningMessage('CukeRust: no workspace folder'); return; }
    const folder = folders[0];
    // Ensure index exists
    await manager.rebuildForFolder(folder);
    const index = manager.getIndex(folder);
    if (!index) { vscode.window.showWarningMessage('CukeRust: no Step Index'); return; }
    // Build a small query corpus from current steps
    const queries = index.steps.slice(0, 50).map(s => ({ kind: s.kind, body: s.regex.replace(/^\^|\$$/g, '') }));
    const kinds: ('Given'|'When'|'Then')[] = ['Given', 'When', 'Then'];
    const modes: Array<'anchored'|'smart'|'substring'> = ['anchored','smart','substring'];
    const results: Record<string, number> = {};
    const runOnce = (mode: 'anchored'|'smart'|'substring') => {
      const t0 = Date.now();
      for (let r = 0; r < 200; r++) {
        for (const q of queries) {
          for (const k of kinds) {
            // local matcher replicating manager.matchStep but explicit mode
            for (const s of index.steps) {
              if (s.kind !== k) continue;
              try {
                let pattern = s.regex;
                if (mode === 'anchored') {
                  if (!pattern.startsWith('^')) pattern = '^' + pattern;
                  if (!pattern.endsWith('$')) pattern = pattern + '$';
                } else if (mode === 'smart') {
                  const anchored = s.regex.startsWith('^') || s.regex.endsWith('$');
                  pattern = anchored ? s.regex : `^${s.regex}$`;
                } // substring uses raw
                const re = new RegExp(pattern);
                re.test(q.body);
              } catch {}
            }
          }
        }
      }
      return Date.now() - t0;
    };
    for (const m of modes) {
      results[m] = runOnce(m);
    }
    console.log('CukeRust match benchmark (ms):', results);
    vscode.window.showInformationMessage(`CukeRust: match benchmark ms ${JSON.stringify(results)}`);
  }));

  // Runtime-List Mode: list steps via runner
  context.subscriptions.push(vscode.commands.registerCommand('cukerust.listStepsViaRunner', async () => {
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (folders.length === 0) { vscode.window.showWarningMessage('CukeRust: no workspace folder'); return; }
    await manager.listStepsViaRunner(folders[0]);
    for (const doc of vscode.workspace.textDocuments) {
      await manager.refreshDiagnostics(doc);
    }
    refreshStatusBar(status, manager);
  }));

  // Rebuild on activation for current workspace
  manager.rebuildAll().then(async () => {
    for (const doc of vscode.workspace.textDocuments) {
      await manager.refreshDiagnostics(doc);
    }
    manager.initWatchers();
    refreshStatusBar(status, manager);
    status.command = 'cukerust.rebuildStatic';
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
      if (e.affectsConfiguration('cukerust')) {
        refreshStatusBar(status, manager);
        // Rebuild indexes when discovery-related settings change
        if (
          e.affectsConfiguration('cukerust.discovery.mode') ||
          e.affectsConfiguration('cukerust.index.path') ||
          e.affectsConfiguration('cukerust.ignoreGlobs') ||
          e.affectsConfiguration('cukerust.runtimeList.command')
        ) {
          void manager.rebuildAll().then(async () => {
            for (const doc of vscode.workspace.textDocuments) {
              await manager.refreshDiagnostics(doc);
            }
            refreshStatusBar(status, manager);
          });
        }
      }
    }),
  );

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
      const cfg = vscode.workspace.getConfiguration('cukerust', folder);
      let cmd = await resolveRunCommand(folder, featurePath, scenarioName, cfg);
      if (!cmd) {
        const template = cfg.get<string>('run.template', 'echo Running ${scenarioName} in ${featurePath}');
        cmd = template
          .replace(/\$\{featurePath\}/g, shellQuote(featurePath))
          .replace(/\$\{scenarioName\}/g, shellQuote(scenarioName))
          .replace(/\$\{tags\}/g, '');
      }
      const term = vscode.window.createTerminal({ name: 'CukeRust' });
      term.show();
      term.sendText(cmd);
    }),
  );
}

export function deactivate() {}

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

function refreshStatusBar(status: vscode.StatusBarItem, manager: StepIndexManager) {
  const folders = vscode.workspace.workspaceFolders ?? [];
  const active = vscode.window.activeTextEditor?.document;
  const folder = active ? vscode.workspace.getWorkspaceFolder(active.uri) : folders[0];
  const mode = vscode.workspace.getConfiguration('cukerust', folder ?? undefined).get('discovery.mode', 'auto');
  const stale = manager.getArtifactStale(folder ?? null) ? ' (stale artifact)' : '';
  const ms = manager.getLastBuildMs(folder ?? null);
  const msText = ms ? ` ${ms}ms` : '';
  status.text = `CukeRust: ${String(mode)}${stale}${msText}`;
  status.command = manager.hasAmbiguityChoices() ? 'cukerust.clearAmbiguityMemory' : 'cukerust.rebuildStatic';
  if (vscode.workspace.getConfiguration('cukerust', folder ?? undefined).get<boolean>('statusbar.showMode', true)) status.show(); else status.hide();
}
