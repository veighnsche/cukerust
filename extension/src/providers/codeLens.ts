import * as vscode from 'vscode';

export function registerScenarioCodeLensProvider(
  context: vscode.ExtensionContext,
): vscode.Disposable {
  return vscode.languages.registerCodeLensProvider(
    [{ language: 'feature' }, { pattern: '**/*.feature' }],
    new ScenarioCodeLensProvider(),
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
