import * as vscode from 'vscode';
import { StepIndexManager } from './indexer';
import { registerCommands } from './commands';
import { registerProviders } from './providers';
import { registerSemanticTokens } from './semantics';

export function activate(context: vscode.ExtensionContext) {
  const manager = new StepIndexManager(context);
  const status = vscode.window.createStatusBarItem('cukerust.mode', vscode.StatusBarAlignment.Left, 100);
  status.name = 'CukeRust Mode';
  status.tooltip = 'CukeRust discovery mode';
  context.subscriptions.push(status);
  const output = vscode.window.createOutputChannel('CukeRust');
  context.subscriptions.push({ dispose: () => output.dispose() });
  output.appendLine('[CukeRust] Activated');
  status.text = 'CukeRust: Initializing…';
  status.show();

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
    output.appendLine('[CukeRust] Indexing complete');
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

  // Providers and core commands are registered via modules
  registerProviders(context, manager);
  registerCommands(context, manager, status, output);
  registerSemanticTokens(context);
}

export function deactivate() {}

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
