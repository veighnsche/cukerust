import * as vscode from 'vscode';

// Minimal semantic tokens for .feature files to ensure step keywords and scenario headers get themed
const tokenTypes = ['keyword', 'string', 'number', 'comment'] as const;
const tokenModifiers: string[] = [];
const legend = new vscode.SemanticTokensLegend(tokenTypes as unknown as string[], tokenModifiers);

type TokenType = typeof tokenTypes[number];

export function registerSemanticTokens(context: vscode.ExtensionContext) {
  const ds: vscode.DocumentSelector = [{ language: 'feature' }, { pattern: '**/*.feature' }];
  context.subscriptions.push(
    vscode.languages.registerDocumentSemanticTokensProvider(
      ds,
      new FeatureSemanticTokensProvider(),
      legend,
    ),
  );
}

class FeatureSemanticTokensProvider implements vscode.DocumentSemanticTokensProvider {
  async provideDocumentSemanticTokens(doc: vscode.TextDocument): Promise<vscode.SemanticTokens> {
    const builder = new vscode.SemanticTokensBuilder(legend);
    for (let line = 0; line < doc.lineCount; line++) {
      const text = doc.lineAt(line).text;

      // Comments
      const hash = text.indexOf('#');
      if (hash >= 0) {
        builder.push(line, hash, text.length - hash, typeIndex('comment'), 0);
      }

      // Tags like @wip
      const tagRe = /@\w+/g;
      for (let m; (m = tagRe.exec(text)); ) {
        // Tokenize as keyword to ensure visible color in most themes
        builder.push(line, m.index, m[0].length, typeIndex('keyword'), 0);
      }

      // Scenario/Feature keywords at line start
      const headerRe = /^\s*(Feature|Background|Scenario Outline|Scenario|Examples):/;
      const h = headerRe.exec(text);
      if (h) {
        const start = text.indexOf(h[1]);
        if (start >= 0) builder.push(line, start, h[1].length, typeIndex('keyword'), 0);
        continue; // Avoid double-tokenizing lines with steps
      }

      // Step keywords at line start
      const stepRe = /^\s*(Given|When|Then|And|But)\b/;
      const s = stepRe.exec(text);
      if (s) {
        const start = text.indexOf(s[1]);
        if (start >= 0) builder.push(line, start, s[1].length, typeIndex('keyword'), 0);
      }

      // Quoted strings within a line (and docstrings handled below)
      for (const m of text.matchAll(/"[^"]*"/g)) {
        builder.push(line, m.index ?? 0, m[0].length, typeIndex('string'), 0);
      }

      // Triple-quoted docstring lines
      if (/^\s*"""/.test(text)) {
        builder.push(line, 0, text.length, typeIndex('string'), 0);
      }

      // Numbers
      for (const m of text.matchAll(/(?<=\s)[+-]?\d+(?:\.\d+)?(?=\s|$)/g)) {
        if (m.index != null) builder.push(line, m.index, m[0].length, typeIndex('number'), 0);
      }
    }
    return builder.build();
  }
}

function typeIndex(t: TokenType): number {
  return (tokenTypes as unknown as string[]).indexOf(t);
}
