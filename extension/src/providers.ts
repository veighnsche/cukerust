import * as vscode from 'vscode';
import { StepIndexManager } from './indexer';
import { registerDefinitionProvider } from './providers/definition';
import { registerCompletionProvider } from './providers/completion';
import { registerHoverProvider } from './providers/hover';
import { registerDocumentLinkProvider } from './providers/documentLinks';
import { registerScenarioCodeLensProvider } from './providers/codeLens';

export function registerProviders(
  context: vscode.ExtensionContext,
  manager: StepIndexManager,
) {
  // Modular providers aggregator (preferred)
  context.subscriptions.push(
    registerDefinitionProvider(context, manager),
    registerCompletionProvider(context, manager),
    registerHoverProvider(context, manager),
    registerDocumentLinkProvider(context, manager),
    registerScenarioCodeLensProvider(context),
  );
}