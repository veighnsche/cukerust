import * as vscode from 'vscode';
import { extractRunBlocks } from './core/run_matrix';
import { shellQuote } from './utils';

export async function resolveRunCommand(
  folder: vscode.WorkspaceFolder | null | undefined,
  featurePath: string,
  scenarioName: string,
  cfg: vscode.WorkspaceConfiguration,
): Promise<string | undefined> {
  try {
    if (!folder) return undefined;
    const rel = vscode.workspace.asRelativePath(featurePath, false);
    const uri = vscode.Uri.joinPath(folder.uri, cfg.get<string>('runMatrix.path', 'docs/cukerust/run_matrix.md'));
    const bytes = await vscode.workspace.fs.readFile(uri);
    const text = new TextDecoder('utf-8').decode(bytes);
    // very simple parser: look for fenced blocks starting with ```run and key=value lines
    const blocks = extractRunBlocks(text);
    // Pick scenario-level first, else feature-level, else suite
    const featureRel = rel.replace(/\\/g, '/');
    const scenKey = `scenario:${scenarioName}`;
    if (blocks[scenKey]) return fill(blocks[scenKey], featureRel, scenarioName, '');
    const featKey = `feature:${featureRel}`;
    if (blocks[featKey]) return fill(blocks[featKey], featureRel, scenarioName, '');
    if (blocks['suite']) return fill(blocks['suite'], featureRel, scenarioName, '');
    return undefined;
  } catch {
    return undefined;
  }
}

function fill(template: string, featurePath: string, scenarioName: string, tags: string): string {
  return template
    .replaceAll('${featurePath}', shellQuote(featurePath))
    .replaceAll('${scenarioName}', shellQuote(scenarioName))
    .replaceAll('${tags}', shellQuote(tags));
}
