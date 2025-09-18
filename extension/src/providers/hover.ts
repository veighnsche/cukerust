import * as vscode from 'vscode';
import { StepIndexManager } from '../indexer';
import { detectDialect, getDialect, buildStepKeywordRegex, extractOutlineContext, resolvePlaceholders } from '../gherkin';
import { featureSelector as ds } from './shared';

export function registerHoverProvider(
  context: vscode.ExtensionContext,
  manager: StepIndexManager,
): vscode.Disposable {
  return vscode.languages.registerHoverProvider(ds, {
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
      const keyword = m[1];
      const body = m[2];
      const oc = extractOutlineContext(text, position.line);
      const bodies: string[] = (oc.isOutline && oc.examples.length > 0 && /<[^>]+>/.test(body))
        ? oc.examples.map((row) => resolvePlaceholders(body, row))
        : [body];
      const kinds: ('Given'|'When'|'Then')[] = ['Given','When','Then'];
      for (const kind of kinds) {
        for (const b of bodies) {
          const matches = index ? manager.matchStep(index.steps, kind, b) : [];
          if (matches.length) {
            const s = matches[0];
            const md = new vscode.MarkdownString();
            md.isTrusted = true;
            md.appendMarkdown(`### ${s.kind}\n`);
            md.appendMarkdown('```regex\n' + s.regex + '\n```\n');
            const root = folder?.uri ?? vscode.Uri.file('/');
            const target = vscode.Uri.joinPath(root, s.file);
            const lineNum = Math.max(0, (s.line ?? 1) - 1);
            const openCmd = `command:vscode.open?${encodeURIComponent(JSON.stringify([target.with({ fragment: `L${lineNum + 1}` })]))}`;
            md.appendMarkdown(`Source: [${s.file}:${s.line}](${openCmd})\n`);
            if (b !== body) {
              md.appendMarkdown(`Resolved: \`${b}\`\n`);
            }
            try {
              const re = new RegExp(s.regex.replace(/^\^|\$$/g, ''));
              const mm = re.exec(b);
              if (mm && mm.length > 1) {
                md.appendMarkdown('\n**Captures**\n');
                for (let i = 1; i < mm.length; i++) {
                  md.appendMarkdown(`- $${i}: \`${mm[i]}\`\n`);
                }
              }
            } catch {}
            if (matches.length > 1) {
              md.appendMarkdown(`\n> Note: ${matches.length - 1} other candidate(s) exist. Use Go to Definition to disambiguate or run \`CukeRust: Clear Ambiguity Choices\`.\n`);
            }
            const esc = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const pref = new RegExp(`^(\\s*${esc}\\s+)`).exec(line);
            const bodyStart = pref ? pref[0].length : Math.max(0, line.indexOf(body));
            const range = new vscode.Range(position.line, bodyStart, position.line, Math.max(bodyStart + body.length, bodyStart));
            if (position.character >= bodyStart && position.character <= bodyStart + body.length) {
              return new vscode.Hover(md, range);
            } else {
              return new vscode.Hover(md);
            }
          }
        }
      }
      const md = new vscode.MarkdownString();
      md.isTrusted = false;
      md.appendMarkdown(`Step: \`${body}\`\n`);
      md.appendMarkdown(`(No matching step definition yet. Try "CukeRust: Rebuild Step Index" or adjust discovery mode.)`);
      const esc = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pref = new RegExp(`^(\\s*${esc}\\s+)`).exec(line);
      const bodyStart = pref ? pref[0].length : Math.max(0, line.indexOf(body));
      const range = new vscode.Range(position.line, bodyStart, position.line, Math.max(bodyStart + body.length, bodyStart));
      return new vscode.Hover(md, range);
    },
  });
}
