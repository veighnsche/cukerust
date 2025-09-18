import * as vscode from 'vscode';
import { StepIndexManager } from '../indexer';
import { featureSelector as ds } from './shared';
import { toSnippet } from '../utils';

export function registerCompletionProvider(
  context: vscode.ExtensionContext,
  manager: StepIndexManager,
): vscode.Disposable {
  return vscode.languages.registerCompletionItemProvider(
    ds,
    {
      provideCompletionItems(doc) {
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
    ' ',
  );
}
