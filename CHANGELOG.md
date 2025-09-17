# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0-pre] - 2025-09-17

- Rust core (`cukerust_core`)
  - Implemented Step Index types and extractors for attribute macros, builder chains, macros, and raw strings.
  - Added BDD harness with cucumber and tokio; features cover attributes, builder chains, macros, raw strings, and ambiguity.
  - Computed stats: total, by_kind, and ambiguous.
- WASM wrapper (`cukerust_wasm`)
  - Exported `extract_step_index(input_json: string) -> string` using `wasm-bindgen`.
  - JSON in/out shape follows `.specs/00_cukerust.md`.
- VS Code extension (`extension/`)
  - Implemented in-memory Step Index manager with Static Scan and Artifact Mode (with staleness detection).
  - Diagnostics for undefined/ambiguous steps, Go-to-Definition, Completion, and Hover.
  - Run helpers: CodeLens and `cukerust.runScenario` command with shell-safe placeholders.
  - Integration test scaffolding with a basic fixture workspace and extension-host test runner.
  - CI: lint/format, Rust clippy/fmt, tests, and VSIX packaging.

### Notes
- The extension prefers `docs/cukerust/step_index.json` when fresh; otherwise falls back to static scan.
- All I/O remains on the TS side; Rust crates are pure and deterministic.
