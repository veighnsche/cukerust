/* Minimal integration test using Mocha-like globals without types */
import * as assert from 'assert';
import * as vscode from 'vscode';

// Declare mocha globals to satisfy TS without @types/mocha
declare const suite: any;
declare const test: any;

suite('CukeRust Extension', () => {
  test('activate and rebuild index', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const folders = vscode.workspace.workspaceFolders ?? [];
    assert.ok(folders.length >= 1, 'workspace folder is required');
    await vscode.commands.executeCommand('cukerust.rebuildIndex');
    // Open the sample feature and ensure no crash while diagnostics refresh
    const feature = vscode.Uri.joinPath(folders[0].uri, 'features', 'sample.feature');
    const doc = await vscode.workspace.openTextDocument(feature);
    const editor = await vscode.window.showTextDocument(doc);
    // Give extension a moment to produce diagnostics
    await new Promise((r) => setTimeout(r, 250));
    const diags = vscode.languages.getDiagnostics(doc.uri);
    assert.strictEqual(diags.length, 0, 'no diagnostics expected in fixture');
    // Go-to-definition on Given line
    const pos = new vscode.Position(2, 8);
    const defs = (await vscode.commands.executeCommand(
      'vscode.executeDefinitionProvider',
      doc.uri,
      pos,
    )) as vscode.Location[];
    assert.ok(defs && defs.length >= 1, 'definition should be found');
    // success if we got here
    assert.ok(true);
  });
});
