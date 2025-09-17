# CukeRust — BDD/TDD 4‑Week Plan (TODO)

This plan breaks work into weekly milestones with a BDD/TDD‑first mindset. Each week includes features, testing, and docs. Keep all I/O and VS Code API in TypeScript (`extension/`), and CPU‑bound parsing/matching in Rust (`rust/`).

## Principles

- Write scenarios and tests first; implement only what’s necessary to pass.
- Keep `cukerust_core` pure and deterministic; perform I/O only in the TS extension.
- Keep the FFI small and JSON‑based; fail clearly with structured errors.
- Update docs whenever contracts change (Step Index, FFI, behaviors).

## Week 1 — Rust BDD harness + minimal Step Index (M1, BDD/TDD)

- [x] Rust BDD harness (cukerust_core)
  - [x] Add dev‑deps: `cucumber`, `tokio` (rt‑multi‑thread, macros), `serde`, `serde_json`
  - [x] Create `tests/bdd.rs` cucumber harness (tokio main)
  - [x] Create `features/` directory with initial scenarios (attributes, builder chains, macros, raw strings)
  - [x] Create `tests/steps/` with first step module and wire into harness
- [x] Rust: Define StepIndex types and JSON shape (follow `.specs/00_cukerust.md`).
- [x] Rust: Implement extractors for Rust BDD patterns (initial pass)
  - [x] Attribute macros: `#[given/when/then(...)]` (incl. raw strings)
  - [x] Builder chains: `.given/.when/.then(r"…")`
  - [x] Macros: `given!/when!/then!(r"…", ...)`
- [x] WASM wrapper (`cukerust_wasm`)
  - [x] Export `extract_step_index(input_json: string) -> string` via `wasm-bindgen`
  - [x] Accept `{ files: Array<{ path: string, text: string }> }`, return `StepIndex` JSON
- [x] Unit tests (Rust)
  - [x] `cukerust_core` parsing helpers
  - [x] `cukerust_wasm` JSON in/out (serde round‑trip), or tests via `wasm-bindgen-test --node`
- [x] TS glue (temporary)
  - [x] Add a dev command to call WASM on a small in‑repo fixture and log summary
- [x] Docs
  - [x] Update `.docs/01_hybrid_ts_rust_vscode_extension.md` and `.docs/04_workspace_packages_crates_plan.md` if the FFI shape changes

Deliverables

- [x] Green BDD run: `cargo test -p cukerust_core --test bdd`
- [x] `extract_step_index` implemented and callable from WASM
- [x] At least 5 focused scenarios across attribute/builder/macro/raw‑string parsing

Commands

- cargo test -p cukerust_core --test bdd
- cargo test --workspace
- (in extension/) npm run build

Acceptance Criteria

- `extract_step_index` returns correct shapes for representative inputs.
- Rust unit tests cover common patterns and raw string forms.

## Week 2 — Extension integration: diagnostics + go‑to‑definition (M2, test‑first)

- [x] TS: Workspace scanning
  - [x] Glob for candidate Rust files; respect `.gitignore` and settings
  - [x] Debounced in‑memory Step Index per workspace folder
  - [x] Wire to `extract_step_index`
- [x] Diagnostics
  - [x] Undefined step diagnostic (no matches)
  - [x] Ambiguous step diagnostic (multiple matches)
- [x] Go‑to‑Definition
  - [x] Jump to `file:line` for best match; inline Peek if multiple
- [x] Integration tests (extension‑host via `@vscode/test-electron`)
  - [x] Write tests first for diagnostics and go‑to‑def
  - [x] Fixture workspace with Rust samples and `*.feature` files
  - [x] Tests verify diagnostics and go‑to‑def behavior
- [x] Docs
  - [x] Add a Quickstart with a mini example and how to run tests

Commands

- (in extension/) npm run build && npm run test:int

Acceptance Criteria

- [x] Opening the fixture shows diagnostics and go‑to‑definition works.
- [x] Tests pass on CI (Linux at minimum).

## Week 3 — Completion + Hover (M3) and performance review (M4)

- [x] Completion
  - [x] Generate completion items from Step Index
  - [x] Convert captures to snippet placeholders (e.g., `(\d+)` → `${1:number}`)
- [x] Hover
  - [x] Show kind, normalized regex, `file:line`, function?
- [x] Matching semantics (initially in TS)
  - [x] Anchored/Smart/Relaxed tiers
  - [x] Optional: offload matching to Rust if profiling justifies
- [x] Performance checks
  - [x] Measure index build and matching on the fixture
  - [x] Identify hotspots; small targeted improvements
- [x] Tests & Docs
  - [x] Unit tests for completion/hover helpers
  - [x] Update docs on completion/hover behaviors and matching tiers

Deliverables

- [x] Completion list with snippet placeholders visible in fixture
- [x] Hover content shows normalized regex and location info
- [x] Short perf note with before/after timings on fixture

Acceptance Criteria

- [x] Completion and hover functional on the fixture.
- [x] Performance within acceptable bounds on test corpus; no pathological slowdowns.

## Week 4 — Run helpers, hardening, CI, and docs (M5–M7 leading to M8)

- [x] Run helpers (CodeLens/commands)
  - [x] Configurable run command per workspace folder
  - [x] Shell‑safe placeholders for feature/scenario/tags
- [x] Hardening
  - [x] Best‑effort loading and staleness detection of artifacts (if present)
  - [x] Robust error handling and telemetry stubs (if any, opt‑in)
- [x] CI/CD
  - [x] Add ESLint and clippy to CI; format checks
  - [x] Package VSIX as CI artifact; smoke test on Linux
- [x] Documentation
  - [x] Keep `.docs/01..04` aligned
  - [x] Add CHANGELOG and update README Quickstart
- [x] Pre‑release checklist
  - [x] Version bump plan and release notes
  - [x] Manual smoke test on macOS/Windows if available

Deliverables

- [x] Run helpers (CodeLens + command) working on fixture
- [x] CI job produces VSIX artifact
- [x] CHANGELOG initialized and README Quickstart updated

Acceptance Criteria

- Run helpers appear and execute configured commands (without auto‑exec by default).
- CI enforces build + tests + lint + format and produces a VSIX artifact.

## Stretch (nice to have if time permits)

- [ ] Basic benchmark harness for indexing/matching
- [ ] Demo screencast GIF
- [ ] Additional fixture scenarios (large repo, multiple roots)

## Open Items

- [ ] Publisher name and repository URL in `extension/package.json`
- [ ] Example repositories to validate (small, medium, large)
- [ ] Minimum supported VS Code version policy

## Risks & Mitigations

- Ambiguity in regex parsing semantics
  - Mitigation: capture behaviors in Gherkin first; document normalization rules.
- WASM/Node interop issues (asset loading, bundling)
  - Mitigation: keep `.wasm` unbundled with `--external:vscode`; add asset tests.
- Performance regressions on large workspaces
  - Mitigation: track fixture timings; add micro-benchmarks and debounce.

## Definition of Done (v0.1)

- BDD scenarios for core parsing are green and cover major patterns.
- Diagnostics, go‑to‑def, completion, and hover work on the fixture.
- CI builds, tests, lints, and produces a VSIX artifact.
