# Features and Interactions

This is the proposed UX surface for the CukeRust extension. Items are ordered roughly by priority/phases.

## P0 — Core Usability

- Syntax highlighting for Gherkin (`.feature`): keywords, steps, doc strings, tables, tags, comments.
- Semantic tokens for scenario/step structure and parameter placeholders.
- Step definition discovery: index Rust macros across workspace crates.
- Go to Definition/Peek Definition from step text to Rust macro definition.
- CodeLens above steps: "Run" / "Debug" scenario, and quick nav to definition.
- Status bar item: CukeRust engine status (indexing, idle, errors) and quick actions.
- Output channel: structured logs from engine/resolver/test runner.
- QuickStart command: scaffold a sample feature and steps into the active Rust crate.

## P1 — Navigation & Authoring

- Hover on steps: show matched macro signature, source crate, capture groups.
- Step completion: suggest known steps as you type; snippet insertion for parameters.
- Create definition quick fix: when step unresolved, one-click generate a Rust macro skeleton in the selected crate/module.
- Scenario/Feature outline view: a dedicated Explorer tree for features and steps.
- Tag-based filter and run from the tree.
- Problems panel diagnostics: unmatched steps, duplicate step regex, ambiguous matches.

## P2 — Test Running & Debugging

- Run single scenario, file, tag, or workspace suite.
- Live progress with granular feedback (status bar + notifications).
- Debug scenario attaching to Rust test binary; breakpoints inside step functions.
- Test history with last run summary and re-run commands.

## P3 — Refactors & Insights

- Rename step parameters and propagate to Rust capture groups (safe refactor).
- Show references: where a step is used across features.
- Coverage-like insights: used/unused steps, orphaned definitions.

## P4 — Collaboration & Advanced

- Shareable run profiles and tag presets.
- Telemetry (opt-in) on feature usage to improve UX.
- Experimental: inline webview for scenario run details with charts.

## Cross-cutting

- Multi-root workspace support.
- Performance: cached indexing, incremental updates, offloading heavy work to WASM/native.
- Accessibility: keyboard-first commands, screen reader labels, theming.
