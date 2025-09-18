import * as vscode from 'vscode';
import { StepIndexManager } from './indexer';
import { resolveRunCommand } from './run_matrix';
import { shellQuote } from './utils';

function extractScenarioName(doc: vscode.TextDocument, line: number): string | undefined {
  for (let i = line; i >= 0; i--) {
    const m = /^\s*Scenario:\s*(.+)$/.exec(doc.lineAt(i).text);
    if (m) return m[1].trim();
  }
  return undefined;
}

export function registerCommands(
  context: vscode.ExtensionContext,
  manager: StepIndexManager,
  status: vscode.StatusBarItem,
  output: vscode.OutputChannel,
) {
  // Open Output command
  context.subscriptions.push(vscode.commands.registerCommand('cukerust.openOutput', async () => {
    output.show(true);
  }));

  // Health Report command
  context.subscriptions.push(vscode.commands.registerCommand('cukerust.openHealthReport', async () => {
    output.appendLine('[CukeRust] Health Report');
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (folders.length === 0) {
      output.appendLine('  - No workspace folders open');
    }
    for (const f of folders) {
      const cfg = vscode.workspace.getConfiguration('cukerust', f);
      const mode = cfg.get('discovery.mode', 'auto' as const);
      const ms = manager.getLastBuildMs(f);
      const stale = manager.getArtifactStale(f);
      const idx = manager.getIndex(f);
      output.appendLine(`  - Folder: ${f.name}`);
      output.appendLine(`    • Mode: ${String(mode)}${stale ? ' (stale artifact)' : ''}`);
      output.appendLine(`    • Last index build: ${ms ? ms + 'ms' : 'n/a'}`);
      output.appendLine(`    • Steps: ${idx ? idx.steps.length : 0}`);
    }
    output.appendLine('  - Settings: statusbar.showMode=' + String(vscode.workspace.getConfiguration('cukerust').get('statusbar.showMode', true)));
    output.appendLine('  - Tip: Use "CukeRust: Rebuild Step Index" after changing discovery settings.');
    output.show(true);
  }));

  // Quick Start command: create a sample feature file in the selected workspace folder
  context.subscriptions.push(vscode.commands.registerCommand('cukerust.quickStart', async () => {
    const folder = await vscode.window.showWorkspaceFolderPick();
    if (!folder) { vscode.window.showWarningMessage('CukeRust: No workspace folder selected'); return; }
    const featuresDir = vscode.Uri.joinPath(folder.uri, 'features');
    const sample = vscode.Uri.joinPath(featuresDir, 'sample.feature');
    try { await vscode.workspace.fs.createDirectory(featuresDir); } catch {}
    let exists = false;
    try { await vscode.workspace.fs.stat(sample); exists = true; } catch {}
    if (exists) {
      const open = 'Open';
      const choice = await vscode.window.showInformationMessage('CukeRust: sample.feature already exists', open);
      if (choice === open) { await vscode.window.showTextDocument(sample); }
      return;
    }
    const content = Buffer.from(
`Feature: Sample
  Scenario: Running a sample step
    Given I have cukes
    When I run a scenario
    Then I should see output
`);
    await vscode.workspace.fs.writeFile(sample, content);
    const doc = await vscode.workspace.openTextDocument(sample);
    await vscode.window.showTextDocument(doc);
    vscode.window.showInformationMessage('CukeRust: Created features/sample.feature');
  }));

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
