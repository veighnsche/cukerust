# Roadmap (Phased)

Aligned with showcase constraints: example Rust crate compiles with rust-analyzer; steps via macros; helper installs rust-analyzer and runs `cargo check`.

## P0 — Make it usable (Now)

- Gherkin TextMate grammar and file icon.
- Status bar item + Output channel skeleton.
- Index step macros in test fixture crate; Go to Definition.
- CodeLens: Run/Debug (wire to placeholder runner if needed).
- Health check command and minimal helper script integration.

## P1 — Authoring & Navigation

- Hover, completion, create-definition quick fix.
- Explorer view for Features/Scenarios/Tags.
- Diagnostics: unresolved/ambiguous/duplicate steps.

## P2 — Running & Debugging

- Real runner integration: run scenario/file/tag/workspace.
- Progress UX + history; debug attach configuration.

## P3 — Interaction Layer + Performance

- Introduce Interaction Layer with event bus and stores.
- WASM bridge for parsing/indexing; incremental updates and caching.

## P4 — Refactors & Insights

- Rename parameters; references; coverage-like insights.

## Non-goals (for now)

- Full-blown test coverage UI; multi-editor collaboration features.

## Risks & Mitigations

- Regex performance: move early to Rust/WASM parsing.
- Ambiguity noise: offer quick disambiguation UI and docs.
- Debug complexity: start with launch templates for common setups.
