# CukeRust — End Goal and Product Definition

This document consolidates the end goal for the CukeRust project: a zero‑config, read‑only VS Code extension that delivers first‑class Gherkin authoring with Rust step integration. It aligns all teams on the vision, scope, architecture, UX, FFI contracts, testing, CI/CD, and release criteria.

It synthesizes the specifications in `.specs/00_cukerust.md`, the hybrid architecture in `.docs/01_hybrid_ts_rust_vscode_extension.md`, project structure in `.docs/03_monorepo_ts_rust_structure.md`, workspace plan in `.docs/04_workspace_packages_crates_plan.md`, testing strategy in `.docs/02_testing_vscode_extensions.md`, and the completed TODO-1 milestones in `.docs/DONE/TODO-1.md`.

---

## 1. Vision & Value

CukeRust brings accurate, productive Gherkin authoring to Rust BDD repositories in VS Code with:

- Zero configuration by default (works on open).
- Read‑only scanning with no execution of project code unless the user opts in.
- Accurate authoring assistance: diagnostics, go‑to‑definition, completion, hover.
- Multi‑root awareness and performance‑conscious indexing.

Outcome: Authors catch undefined/ambiguous steps early, navigate to Rust step definitions instantly, and write steps faster with high‑fidelity completions—without repository writes or local toolchain hurdles for users.

## 2. Target Users

- VS Code users working with Gherkin feature files in Rust BDD repos.
- Rust maintainers and QA teams who define/own step libraries.
- CI owners who require predictable, portable extension behavior.

## 3. Success Metrics (illustrative)

- Undefined/ambiguous diagnostics correctness on sample repos ≥ 95%.
- Cold scan (≤15k files) ≤ 2s on a modern machine; incremental update (debounced) ≤ 200ms.
- Go‑to‑Definition opens in ≤ 150ms for indexed steps.
- Near‑zero configuration tasks for the “happy path”.

## 4. Scope (v0.1 → v0.2 → RC)

- v0.1 (MVP):
  - Diagnostics (undefined/ambiguous), Go‑to‑Definition, Completion, Hover.
  - Static scan, per‑root Step Index, Run helpers (CodeLens + command), basic performance targets.
  - CI builds, tests, lints; VSIX artifact.

- v0.2 (current spec baseline in `.specs/00_cukerust.md`):
  - Multi‑root, debounced indexing, dialects, scenario outlines support.
  - Artifact Mode with staleness detection; optional runtime listing (opt‑in).

- RC (release candidate):
  - Hardened UX, status/telemetry (opt‑in), documented limits, cross‑platform smoke tests.

## 5. Architecture (TS + Rust via WASM)

- TypeScript (VS Code extension):
  - File discovery, workspace integration, index lifecycle, and all VS Code APIs.
  - Presentation surfaces (diagnostics, go‑to‑def, completion, hover, CodeLens/commands).

- Rust core (`cukerust_core`):
  - Pure, deterministic parsing/matching helpers and normalization.
  - BDD/TDD via the `cucumber` crate and Gherkin features under `rust/crates/cukerust_core/features/**`.

- Rust WASM wrapper (`cukerust_wasm`):
  - Minimal JSON FFI for the TS extension; Node target via `wasm-bindgen`.

- Directory structure (single TS extension + Rust workspace) per `.docs/03_monorepo_ts_rust_structure.md`.

## 6. Discovery Modes & Priority

Per `.specs/00_cukerust.md` the extension selects the first viable mode (unless overridden):

1) Static Scan (default):
   - Detect Rust BDD patterns without executing repo code:
     - Attributes: `#[given(...)]`, `#[when(...)]`, `#[then(...)]` (incl. raw strings).
     - Builder chains: `.given(r"…")`, `.when(r"…")`, `.then(r"…")`.
     - Macros: `given!(r"…", …)`, `when!(…)`, `then!(…)`.
   - Extracts `{ kind, regex, file, line, function? }` and builds an in‑memory Step Index.

2) Artifact Mode (optional):
   - Prefers `docs/cukerust/step_index.json` when fresh; otherwise fall back to Static Scan.

3) Runtime‑List Mode (opt‑in):
   - User‑initiated command to run a trusted project runner to list steps.

## 7. Language Features (end‑goal)

- Diagnostics:
  - Undefined (0 matches) and Ambiguous (>1 matches) for step lines.
  - Debounced updates while editing; noise controlled per spec.

- Go‑to‑Definition:
  - Open best match at `file:line`; inline Peek on multiple candidates.

- Completion:
  - Entries from Step Index; captures → snippet placeholders (e.g., `(\d+)` → `${1:number}`).

- Hover:
  - Displays `kind`, normalized `regex`, `function?`, `file:line`, DataTable/DocString hints if detectable.

- Scenario Outlines & Examples:
  - Diagnostics account for Examples expansion; hovers may show resolved values.

- Dialects:
  - Official Gherkin dialects supported; auto‑detect with override setting.

- Run Helpers:
  - CodeLens and commands with shell‑safe placeholders.
  - Run Matrix parsing from `docs/cukerust/run_matrix.md` when present.

- Multi‑Root:
  - Independent Step Index and Runner Map per workspace root; status shows active root and mode.

## 8. Matching Semantics

- Normalize: remove leading keyword + space; infer `And/But` from the last explicit keyword.
- Regex tiers:
  1. Anchored — full‑line; respect `^`/`$`.
  2. Smart — if anchored, full‑line; else implicitly anchored.
  3. Relaxed — substring fallback.
- Surface subtle hints when a fallback tier is used.

## 9. Index Management & Performance Targets

- Static scan respects `.gitignore` + `cukerust.ignoreGlobs`.
- Cold scan target (≤15k files): ≤ 2 seconds.
- Incremental updates target: ≤ 200 ms per change (debounced ≥ 100 ms).
- Staleness detection for artifacts; one‑click fallback to Static Scan.

## 10. Security & Privacy

- Read‑only by default; never executes project code automatically.
- Telemetry is opt‑in and excludes file paths/content; only anonymous feature usage counts.

## 11. Public FFI Contracts (JSON, all optional fields tolerated)

- `extract_step_index(input)` → `StepIndex`

Request (v1):
```json
{
  "apiVersion": 1,
  "files": [
    { "path": "relative/path/to/file.rs", "text": "…" }
  ]
}
```

Response:
```json
{
  "steps": [
    { "kind": "Given|When|Then", "regex": "^…$", "file": "…", "line": 1, "function": "module::fn" }
  ],
  "stats": {
    "total": 0,
    "by_kind": { "Given": 0, "When": 0, "Then": 0 },
    "ambiguous": 0,
    "generated_at": "ISO-8601"
  }
}
```

- `match_step_text(stepText, candidates)` → `MatchResult` (future, optional)
  - Offload tiered regex matching to Rust if profiling justifies it.

Versioning & stability:

- Unknown fields are ignored; missing optional fields tolerated.
- WASM rejects unknown future `apiVersion` gracefully with a structured error.

## 12. Configuration (settings) & Commands

Settings (all optional):

- `cukerust.discovery.mode`: `"auto" | "static-scan" | "artifact" | "runtime-list"`.
- `cukerust.index.path`: path to `step_index.json` (default: `docs/cukerust/step_index.json`).
- `cukerust.runMatrix.path`: path to `run_matrix.md`.
- `cukerust.goToDef.preferSingle`: boolean.
- `cukerust.regex.matchMode`: `"anchored" | "smart" | "substring"`.
- `cukerust.ignoreGlobs`: array of globs merged with `.gitignore`.
- `cukerust.diagnostics.enabled`, `cukerust.completion.enabled`, `cukerust.statusbar.showMode`.
- `cukerust.run.template`: run command template with `${featurePath}`, `${scenarioName}`, `${tags}`.

Commands:

- CukeRust: Rebuild Step Index
- CukeRust: Load Step Index from File…
- CukeRust: List Steps via Runner (opt‑in)
- CukeRust: Configure Run Command for This Folder
- CukeRust: Reload Index

## 13. Testing Strategy (TS + Rust)

- TypeScript unit (Vitest): utilities, snippet conversion, matching helpers.
- Extension‑host integration (`@vscode/test-electron`): diagnostics, go‑to‑def, completion, hover, CodeLens.
- Rust unit and BDD:
  - `cargo test --workspace` for unit + integration tests.
  - BDD features under `rust/crates/cukerust_core/features/**` executed by `cucumber`.
- WASM tests:
  - `wasm-bindgen-test --node` or black‑box tests via TS importing WASM.
- Coverage and perf notes:
  - TS: `c8` for coverage; performance notes recorded in docs.

## 14. CI/CD & Release

- GitHub Actions matrix:
  - Node job (Linux/macOS/Windows): install, build, lint, unit tests, extension‑host tests, package VSIX.
  - Rust job (Linux): fmt check, clippy (deny warnings), tests.
- Artifacts: VSIX attached on Linux.
- Release steps:
  - Finalize publisher and repo URL; bump version; update CHANGELOG; publish VSIX.

## 15. Roadmap (selected future items)

- Rust LSP backend for live discovery.
- NDJSON live decorations.
- Quick‑fix step skeleton scaffolding.
- Tag browser & coverage.
- JSON Schema validation for artifacts.

## 16. Definition of Done (Release Candidate)

- BDD scenarios for core parsing are green and cover major patterns.
- Diagnostics, go‑to‑def, completion, and hover work on representative fixtures.
- Discovery modes (Static/Artifact) behave per spec; Runtime‑List Mode is opt‑in and gated by trust.
- Performance targets met on test corpus; no pathological slowdowns.
- CI enforces build + tests + lint + format and produces a VSIX artifact.
- Docs (README, `.docs/01..04`, and this End Goal) reflect current behavior and limits.

## 17. Glossary (selected)

- Step Index: In‑memory collection of discovered steps `{ kind, regex, file, line, function? }` plus stats.
- Discovery Mode: Strategy to obtain Step Index (Static Scan, Artifact, Runtime‑List).
- Run Matrix: Advisory markdown describing run commands used by CodeLens/commands.
- Ambiguity: Multiple regex candidates match the same step text.
