# Highlighting and Semantic Tokens

Goal: Deliver clear, theme-friendly coloring and structure for Gherkin files and step-related contexts.

## Gherkin in VS Code

- Provide a TextMate grammar for `.feature` files.
- Add a semantic tokens provider (optional in P0; P1+ for richer semantics) via a language server or extension API.

## Tokenization Targets

- Keywords: `Feature`, `Background`, `Scenario`, `Scenario Outline`, `Examples`, `Given`, `When`, `Then`, `And`, `But`.
- Tags: `@wip`, `@slow`, custom.
- Step parameters: quoted strings, numbers, capture hints.
- Doc strings and data tables with column alignment.
- Comments.

## TextMate Grammar Sketch

```json
{
  "scopeName": "source.gherkin",
  "patterns": [
    { "match": "^(Feature|Background|Scenario Outline|Scenario|Examples):", "name": "keyword.control.gherkin" },
    { "match": "^(Given|When|Then|And|But) ", "name": "keyword.operator.gherkin.step" },
    { "match": "@\\w+", "name": "entity.name.tag.gherkin" },
    { "begin": "^\"\"\"", "end": "^\"\"\"", "name": "string.quoted.block.gherkin" },
    { "match": "#.*$", "name": "comment.line.number-sign.gherkin" }
  ]
}
```

Notes:
- Keep grammar minimal and fast. Prefer semantic tokens for deep structure later.

## Semantic Tokens (Future-friendly)

Token types we may emit:
- `feature`, `scenario`, `step` (with modifiers like `given|when|then`), `tag`, `parameter`, `table.header`, `table.cell`, `docstring`.

Use cases:
- Differentiate step kinds (Given/When/Then) via modifiers.
- Highlight unresolved steps (diagnostics + modifier `unresolved`).

## File Icons and Theme

- Contribute a file icon association for `.feature`.
- Offer a recommended theme token color mapping in docs; rely on VS Code theming for actual colors.

## Performance Considerations

- Keep regex fast; no catastrophic backtracking.
- Incremental tokenization where supported.
- Move heavy parsing to WASM/native in later phases; surface tokens via LSP if we introduce one.
