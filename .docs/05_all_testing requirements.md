# CukeRust — Comprehensive Test Requirements (Gherkin‑ready)

This document aggregates requirements from the CukeRust specification and supporting docs and translates them into testable behaviors. It is designed to become a source for Gherkin features, step definitions, and test harness wiring (TS extension host + Rust BDD).

Sources synthesized

- `.specs/00_cukerust.md` (v0.2.0 spec)
- `.docs/00_end_goal.md` (End Goal)
- `.docs/01_hybrid_ts_rust_vscode_extension.md` (Architecture)
- `.docs/02_testing_vscode_extensions.md` (Test strategy)
- `.docs/03_monorepo_ts_rust_structure.md` (Repo layout)
- `.docs/04_workspace_packages_crates_plan.md` (Build paths)
- `.docs/99_BDD_WIRING.md` (Harness wiring)

Conventions

- Feature file organization under `extension/test-fixtures/**` (extension host tests) and `rust/crates/cukerust_core/features/**` (Rust BDD for parsing/matching internals).
- Suggested tag taxonomy:
  - `@DISCOVERY`, `@ARTIFACT`, `@RUNTIME_LIST`, `@INDEX`, `@MATCHING`, `@DIAGNOSTICS`, `@GOTO`, `@COMPLETION`, `@HOVER`, `@OUTLINES`, `@DIALECTS`, `@MULTIROOT`, `@RUN`, `@SECURITY`, `@ERRORS`, `@PERF`, `@WASM`, `@CI`.
- Typical step patterns (TS integration tests):
  - Given a workspace root “X” with feature files and Rust step sources
  - And the discovery mode is “auto|static-scan|artifact|runtime-list”
  - When the extension rebuilds the Step Index
  - Then the editor shows a “Y” diagnostic at line N
  - And Go to Definition opens “file:line”

---

## 1) Discovery Modes & Priority (@DISCOVERY)

Behavioral requirements

- Priority order: Static Scan → Artifact (if fresh) → Runtime‑List (opt‑in). Setting override must be respected.
- Static Scan detects and extracts:
  - Attribute macros: `#[given|when|then(...)]` with normal strings and raw strings (`r"…"`, `r#"…"#`, `r###"…"###`).
  - Builder chains: `.given(r"…")`, `.when(r"…")`, `.then(r"…")` (whitespace tolerant, arguments separated by commas if applicable).
  - Macros: `given!(r"…", ...)`, `when!(...)`, `then!(...)` with varying argument lists.
- Extraction fields: `{ kind, regex, file, line, function? }` with correct relative file and line numbers.
- Multi‑entry files and duplicate patterns handled deterministically.

Gherkin templates

- Scenario: Static Scan extracts attribute, builder, and macro steps
- Scenario: Discovery respects user override to “artifact” even when static scan is available
- Scenario: Runtime‑List is not used unless explicitly run by the user (opt‑in)

Hidden opportunities

- Mixed files combining attribute + macro + builder in any order.
- Whitespace and comments between tokens; trailing commas where allowed.
- Duplicate regex with different kinds (should not be ambiguous across kinds).

---

## 2) Artifact Mode & Staleness (@ARTIFACT)

Behavioral requirements

- When `docs/cukerust/step_index.json` exists and is fresh, it is preferred over scanning.
- Unknown fields ignored; missing optional fields tolerated; invalid entries skipped (best‑effort).
- Staleness detection: any referenced file newer than `generated_at` or index file’s `mtime` ⇒ stale indicator + one‑click fallback to Static Scan.

Gherkin templates

- Scenario: Fresh artifact is loaded and used; scanning is not performed
- Scenario: Stale artifact shows indicator and one‑click fallback performs scan
- Scenario: Artifact with unknown fields still loads remaining entries
- Scenario: Artifact with partially invalid entries skips invalid ones and powers features with the rest

Hidden opportunities

- Artifact points to files under multiple roots; ensure per‑root resolution.

---

## 3) Runtime‑List Mode (Trust & Parsing) (@RUNTIME_LIST)

Behavioral requirements

- Listing steps via runner is a user‑initiated command; first run prompts trust per workspace.
- Runner output parsed best‑effort into Step Index; unknown fields tolerated.
- Never auto‑executes project code; trust cached per root until cleared.

Gherkin templates

- Scenario: First run prompts for trust; accepting enables listing; rejecting does not run
- Scenario: Malformed runner output degrades gracefully and does not crash features

Hidden opportunities

- Different shells; environment variable interference; long output truncation handling.

---

## 4) Matching Semantics & Normalization (@MATCHING)

Behavioral requirements

- Normalization removes leading keyword + one space; `And/But` inherit last explicit kind.
- Tiers:
  - Anchored: respect `^`/`$`, require full‑line.
  - Smart: if no anchors, implicitly anchor.
  - Relaxed: substring fallback (configurable).
- Raw string normalization (hash counts, quotes) results in equivalent regex.

Gherkin templates

- Scenario: Anchored patterns only match exact text with anchors respected
- Scenario: Smart mode implicitly anchors when pattern lacks anchors
- Scenario: Substring mode matches when Anchored/Smart do not
- Scenario: And/But infer kind based on preceding Given/When/Then

Hidden opportunities

- Overlapping patterns where Relaxed tier produces multiple matches; ambiguity surfaced.

---

## 5) Diagnostics (Undefined / Ambiguous) (@DIAGNOSTICS)

Behavioral requirements

- Undefined: 0 matches ⇒ diagnostic displayed.
- Ambiguous: >1 matches ⇒ diagnostic displayed.
- Debounce and noise control while editing; severity lowered while typing; capped refresh rate.

Gherkin templates

- Scenario: Undefined step shows diagnostic and disappears after definition added
- Scenario: Ambiguous step shows diagnostic when multiple candidates exist
- Scenario: Rapid edits do not cause diagnostic spam (debounce)

Hidden opportunities

- Variant of the same regex across roots; ensure correct root index is used.

---

## 6) Go‑to‑Definition (@GOTO)

Behavioral requirements

- Best match opens at `file:line`.
- If multiple matches exist, inline Peek lists candidates. May remember user choice per session; status action clears memory.
- `preferSingle` auto‑picks first candidate with status message.

Gherkin templates

- Scenario: Single candidate jumps directly to file:line
- Scenario: Multiple candidates show Peek; user selection remembered during session
- Scenario: Clearing memory restores Peek behavior

Hidden opportunities

- Ambiguity across kinds vs within kind.

---

## 7) Completion (@COMPLETION)

Behavioral requirements

- Offers completion items from Step Index when editing step lines.
- Snippet placeholders from captures: `(\d+)` → `${1:number}`, `(.+)` → `${1:value}`; de‑duplicate semantically equivalent patterns.
- Sorted and filtered appropriately by kind and context.

Gherkin templates

- Scenario: Numeric capture becomes `${1:number}` in snippet
- Scenario: Generic capture becomes `${1:value}`
- Scenario: Duplicates across files produce a single completion item

Hidden opportunities

- Multiple captures; nested groups; optional groups.

---

## 8) Hover (@HOVER)

Behavioral requirements

- Hover shows `kind`, normalized `/regex/`, `file:line`, optional `function?` and table/docstring hints.

Gherkin templates

- Scenario: Hover displays normalized regex and source location
- Scenario: Hover indicates presence of DataTable/DocString when detected

Hidden opportunities

- Macro forms that imply docstring usage; ensure hint detection stays best‑effort.

---

## 9) Scenario Outlines & Examples (@OUTLINES)

Behavioral requirements

- Diagnostics account for Examples expansion; hover may show resolved placeholders based on current row.

Gherkin templates

- Scenario Outline: Diagnostics are evaluated for each Examples row
- Scenario Outline: Hover shows resolved values when cursor is in a row

Hidden opportunities

- Mixed dialect + outlines; large examples tables.

---

## 10) Gherkin Dialects (@DIALECTS)

Behavioral requirements

- Support official dialects; auto‑detect with fallback to English; override via setting.

Gherkin templates

- Scenario: Spanish keywords (Dado/Cuando/Entonces) parse and produce diagnostics/go‑to‑def
- Scenario: Dialect override forces English in a non‑English feature

Hidden opportunities

- Mixed dialects within a workspace; per‑file auto‑detect interactions.

---

## 11) Index Management & Watchers (@INDEX)

Behavioral requirements

- Watchers pick up Rust file changes and debounce rebuilds; `.gitignore` and `cukerust.ignoreGlobs` respected.
- Per‑root Step Index and Runner Map.

Gherkin templates

- Scenario: Editing a Rust step source updates diagnostics after debounce
- Scenario: Ignore globs exclude specified files from index

Hidden opportunities

- Many rapid successive writes; verify last‑write wins and stability.

---

## 12) Multi‑Root Workspaces (@MULTIROOT)

Behavioral requirements

- Each root uses its own Step Index; feature files resolve to nearest root; status bar displays active root and mode.

Gherkin templates

- Scenario: Two roots with different step definitions show different diagnostics
- Scenario: Status bar displays active root and discovery mode

Hidden opportunities

- Cross‑root artifact + static scan precedence differences.

---

## 13) Run Helpers & Run Matrix (@RUN)

Behavioral requirements

- CodeLens “Run Scenario” and command run in integrated terminal using template placeholders `${featurePath}`, `${scenarioName}`, `${tags}` with shell‑safe quoting.
- If `run_matrix.md` exists, its commands are used; else heuristic default per folder; first execution prompts confirmation.

Gherkin templates

- Scenario: CodeLens executes run command with proper quoting on Bash/Zsh/Fish/PowerShell/CMD
- Scenario: Run Matrix overrides default and selects nearest path prefix
- Scenario: First execution prompts confirmation and remembers template per root

Hidden opportunities

- Scenario names with quotes/newlines; tags with spaces; Windows path complexities.

---

## 14) Security & Privacy (@SECURITY)

Behavioral requirements

- No auto‑execution of project code; all runs user‑initiated.
- Telemetry is opt‑in and excludes file paths/content; only anonymous counts when enabled.

Gherkin templates

- Scenario: No runner execution occurs until explicit command is invoked
- Scenario: Telemetry is disabled by default and can be opted‑in

---

## 15) Error Handling & Resilience (@ERRORS)

Behavioral requirements

- No index available ⇒ diagnostics disabled; status bar hint explains enablement paths.
- Malformed artifact ⇒ non‑blocking warning; fallback to static scan.
- Watcher failures logged; Reload command remains available.

Gherkin templates

- Scenario: With no index, diagnostics are disabled and status bar explains options
- Scenario: Malformed artifact shows warning and static scan resumes
- Scenario: File watcher error does not crash extension; manual reload works

---

## 16) Performance Targets (@PERF)

Behavioral requirements

- Cold static scan (≤15k files) ≤ 2s; incremental rebuilds ≤ 200ms (debounced ≥ 100ms); idle CPU ≤ ~50% of one core.

Test approach

- Use synthetic large fixtures; collect timings via logs and measure in CI or local sessions.

Gherkin templates

- Scenario: Cold scan completes within target on fixture corpus
- Scenario: Incremental rebuild completes within target after a single‑file change

---

## 17) WASM FFI Contracts (@WASM)

Behavioral requirements

- `extract_step_index(input)` accepts `{ files: Array<{ path, text }> }` (+ optional `apiVersion`) and returns Step Index JSON.
- Unknown fields tolerated; structured errors for unknown future versions; stable output shape for valid inputs.

Gherkin templates (Rust or TS black‑box)

- Scenario: Round‑trip JSON with multi‑file input returns valid Step Index
- Scenario: Unknown fields in input ignored; unknown `apiVersion` rejected gracefully

Hidden opportunities

- Large input payloads; non‑UTF‑8 bytes (normalized or rejected predictably).

---

## 18) Rust Core Parsing Behaviors (@WASM @INDEX)

Behavioral requirements (unit/BDD in Rust)

- Attribute macros parsing: plain and raw strings, multiple hashes, nested quotes.
- Builder chains parsing: `.given/.when/.then` with whitespace and trailing commas.
- Macro parsing: `given!/when!/then!` with different argument shapes.
- Raw strings: quotes inside, multi‑hash boundaries, multiple in one line.
- Ambiguity stats: duplicate `(kind, regex)` pairs counted once per duplicate cluster.

Gherkin templates (existing + new)

- Scenario: Attribute macros with raw string (`r#"…"#`) parse
- Scenario: Builder chain across whitespace parses
- Scenario: Macro with additional arguments parses first literal only
- Scenario: Two identical `Given` patterns are ambiguous; different kinds are not
- Scenario: Raw string with quotes inside is parsed correctly

---

## 19) CI/CD & Packaging (@CI)

Behavioral requirements

- CI builds WASM + TS, runs lint/tests, packages VSIX, and uploads artifact; Rust job runs fmt, clippy, and tests.
- VSIX includes `native/**` WASM assets and `out/**` JS.

Gherkin templates (pseudo steps via CI assertions)

- Scenario: CI artifact contains `.wasm` and extension `out/**` files
- Scenario: CI fails on clippy warnings or fmt errors

---

## 20) Combined & Cross‑Cutting Tests (Hidden Opportunities)

- Dialects + Outlines + Ambiguity: ensure diagnostics remain correct when multiple dialects and examples co‑exist.
- Multi‑root + Artifact + Static Scan: per‑root precedence and status display.
- Run Helpers with complex scenario names/tags and Windows paths.
- Matching tiers with nearly overlapping patterns; ensure hints and ambiguity are surfaced.

---

## Example Step Library Sketch (TS integration)

- Given a workspace fixture "{name}" is open
- And discovery mode is "{mode}"
- When I rebuild the Step Index
- Then a diagnostic of kind "{Undefined|Ambiguous}" appears at "{file}:{line}"
- And Go to Definition for line {line} resolves to "{file}:{line}"
- And completion offers "{snippet}"
- And hover shows "/{regex}/ at {file}:{line}"
- And the status bar text contains "CukeRust: {mode} ({root})"
- When I click Run Scenario on "{scenarioName}" in "{featurePath}"
- Then the integrated terminal runs a command that contains "{escapedArgs}"

These steps can be implemented once and reused across most scenarios.

---

## Traceability

For each Feature/Scenario in this document, map back to `.specs/00_cukerust.md` sections:

- Discovery (§4), Inputs (§5), Language Features (§6), Matching (§7), Index (§8), UI/UX (§9), Run/Debug (§10), Security (§11), Config/Commands (§12), Errors (§13), Performance (§14), Acceptance (§15).

Maintaining a simple mapping (e.g., YAML or a table) ensures spec conformance can be audited in CI.
