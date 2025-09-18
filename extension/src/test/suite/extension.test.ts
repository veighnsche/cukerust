import * as assert from 'assert';
import * as vscode from 'vscode';

suite('CukeRust Extension (integration)', () => {
  test('activate and rebuild index; diagnostics stable; go-to-def works', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const folders = vscode.workspace.workspaceFolders ?? [];
    assert.ok(folders.length >= 1, 'workspace folder is required');

    await vscode.commands.executeCommand('cukerust.rebuildIndex');

    const feature = vscode.Uri.joinPath(folders[0].uri, 'features', 'sample.feature');
    const doc = await vscode.workspace.openTextDocument(feature);
    await vscode.window.showTextDocument(doc);

    await new Promise((r) => setTimeout(r, 250));
    const diags = vscode.languages.getDiagnostics(doc.uri);
    assert.strictEqual(diags.length, 0, 'no diagnostics expected in fixture');

    const pos = new vscode.Position(2, 8);
    const defs = (await vscode.commands.executeCommand(
      'vscode.executeDefinitionProvider',
      doc.uri,
      pos,
    )) as vscode.Location[];
    assert.ok(defs && defs.length >= 1, 'definition should be found');
  });
});
