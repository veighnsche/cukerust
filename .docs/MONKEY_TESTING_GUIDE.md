# CukeRust — Monkey Testing Guide (Pre‑Release)

This guide helps you stress, poke, and try to break CukeRust in realistic ways before a release. It complements the automated BDD/tests and focuses on resilience, UX, and guardrails.

## Objectives

- Ensure the extension never crashes VS Code.
- Ensure static scan (Rust parser) and UI stay responsive during chaotic edits.
- Surface diagnostics (Undefined/Ambiguous) predictably, without spam.
- Confirm discovery modes behave and switch reliably.
- Validate watchers, ordering, ambiguity stats, and known limits.

## Baseline sanity (must be green before monkey testing)

- Rust core BDD:
  - `cd rust && cargo test -p cukerust_core --test bdd`
- Extension build:
  - `cd extension && npm ci || npm i`
  - `npm run build`
- Optional: Extension host tests if present
  - `cd extension && npm run test:int`

## One-command live showcase (recommended)

- Run:
  - `./scripts/open-showcase.sh`
- This will:
  - Build the extension (WASM + TS), package a VSIX, and install it into your VS Code
  - Open `examples/cukerust-showcase.code-workspace` (points to `extension/test-fixtures/basic/`)
- Requirements:
  - Node.js and npm
  - VS Code CLI `code` on PATH
  - `wasm-pack` for the WASM build (`cargo install wasm-pack`)
  - Rust toolchain (`cargo` on PATH) — the script will run `cargo check`
- The showcase workspace includes:
  - `features/` with `sample.feature` and `outline.feature`
  - A real Cargo crate under `extension/test-fixtures/basic/` so rust-analyzer can compile it
  - `src/lib.rs` defines demo `given!`, `when!`, `then!` macros and a tiny `StepBuilder`
  - `src/steps.rs` uses macros and builder calls for discovery
  - `docs/cukerust/step_index.json` for Artifact mode
  - `docs/cukerust/run_matrix.md` as a placeholder for the run matrix

## Test workspace setup

- Use `examples/cukerust-showcase.code-workspace` (recommended) which points to `extension/test-fixtures/basic/`, or your own small workspace with:
  - Several `.feature` files (with and without Scenario Outline)
  - A small Rust crate folder with steps (attribute, builder, macro forms)
- If you prefer manual Extension Host: launch VS Code with this repo, press F5 to start the Extension Host, and open `extension/test-fixtures/basic/`.

## Quick monkey test matrix (checklist)

- Discovery mode toggles (auto → static-scan → artifact → runtime-list)
- Static scan: fast chaotic edits across multiple files
- Artifact staleness detection and fallback to scan
- Undefined/Ambiguous diagnostics stability while typing
- Go to Definition and status bar stability
- Multi-root workspace behavior
- Raw strings and multi-line attributes correctness
- Builder/macro edge cases and multiple calls per line
- False positives remain suppressed (comments/unattached strings)
- Stability under large files and long lines

## Playbook

1) Discovery Modes

- Set `cukerust.discovery.mode` to each of: `auto`, `static-scan`, `artifact`, `runtime-list`.
- Flip settings repeatedly and run commands:
  - `CukeRust: Rebuild Step Index`
  - `CukeRust: Force Static Scan Rebuild`
  - `CukeRust: Clear Ambiguity Choices`
- Expectation: No crashes; status bar updates; diagnostics refresh within debounce.

2) Static Scan Chaos (editing storms)

- Open multiple Rust files with attributes, macros, and builder calls.
- Do rapid edits: paste blocks, add/remove raw string hashes (`r#"…"#` ↔ `r###"…"###`), duplicate lines, comment/uncomment entire regions.
- Save repeatedly and quickly.
- Expectation: Diagnostics remain consistent; no flood/spam; Step Index rebuild remains stable.

3) Artifact Mode (fresh vs stale)

- Create `docs/cukerust/step_index.json` in the workspace (pointed by `cukerust.index.path`).
- Mark it fresh (recent timestamp) and verify discovery uses the artifact.
- Then make a referenced file newer to force staleness; confirm a visible stale indication and manual fallback to Static Scan works.

4) Ambiguity & Duplicates

- Introduce the same `(kind, regex)` across different files.
- Confirm `Ambiguous` diagnostics appear; clear via `CukeRust: Clear Ambiguity Choices`.
- Remove duplicates; verify diagnostics resolve.

5) False Positives Hardening

- Add lookalike method/macro names (`given_data`, `forgiven!`), strings not attached to calls/attributes, and comments with step-like text.
- Expectation: No steps produced from these.

6) Raw Strings & Multi-line Attributes

- Use quotes inside raw strings, change hash counts, and leave one raw string unterminated deliberately.
- Use multi-line attributes with `regex = r"…"` split across lines, with and without extra args.
- Expectation: First literal is used; unterminated raw strings are ignored (no crash); function name captured for attributes.

7) Builder/Macro Edges

- Generic builder calls `.given::<T>(r"^x$")`.
- Multiple builder/macro calls on the same line.
- Mixed normal and raw literals.
- Expectation: All calls are discovered; first literal per call site wins.

8) Multi-file Ordering

- Spread definitions across files `a.rs`, `z.rs` with different line offsets.
- Expectation: Step list is sorted by `(file, line)` and remains stable across runs.

9) Multi-root Workspaces

- Open a multi-root workspace (two folders), each with its own steps and features.
- Expectation: Per-root Step Index; status bar indicates root/mode; diagnostics reflect nearest root.

10) Performance/Resilience Hints

- Create a file with very long lines and many string-like segments.
- Add large numbers of small changes quickly.
- Expectation: No UI freeze; rebuilds are debounced; CPU usage reasonable.

## Helpful commands & env

- Limit the Rust BDD run to a folder while iterating:
  - `cd rust && CUKERUST_BDD_FEATURE_PATH=crates/cukerust_core/features/parsing cargo test -p cukerust_core --test bdd`
- Extension commands (Command Palette):
  - `CukeRust: Rebuild Step Index`
  - `CukeRust: Dev — Extract Step Index (Fixture)`
  - `CukeRust: Dev — Match Micro Benchmark`
  - `CukeRust: Force Static Scan Rebuild`
  - `CukeRust: Run Scenario`
  - `CukeRust: Clear Ambiguity Choices`
  - `CukeRust: List Steps via Runner`

## Triage template (when you find issues)

- Repro steps (short):
- Minimal fixture (attach code blocks or files):
- Expected vs actual:
- Logs/console snippet:
- Discovery mode and settings:
- Regression from commit/branch:

## Exit Criteria

- No crashes after running the matrix above.
- Diagnostics/commands behave predictably across toggles.
- Known limits remain as documented and are not worse.
