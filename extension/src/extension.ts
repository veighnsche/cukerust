import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('cukerust.rebuildIndex', async () => {
    vscode.window.showInformationMessage('CukeRust: Rebuild Step Index (stub)');
    // TODO: In future, call into WASM to rebuild from workspace files
    // const wasm = await import('../native/cukerust-wasm');
    // const result = wasm.analyze_steps(JSON.stringify({ files: [] }));
    // console.log('WASM result', result);
  });

  context.subscriptions.push(disposable);
}

export function deactivate() {}
