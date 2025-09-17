# CukeRust — Next 4‑Week Plan (TODO‑2)

This plan builds on the completed TODO‑1 (Weeks 1–4) and advances the feature set, UX, performance, and release readiness. We maintain the same architecture: all I/O and VS Code API in TypeScript (`extension/`), CPU‑bound parsing/matching in Rust (`rust/`).

## Principles

- Write scenarios and tests first; implement only what’s necessary to pass.
- Keep `cukerust_core` pure and deterministic; perform I/O only in the TS extension.
- Keep the FFI small and JSON‑based; fail clearly with structured errors.
- Update docs whenever contracts change (Step Index, FFI, behaviors).
- Measure performance and regress only intentionally with documented trade‑offs.

---

## Week 5 — Scenario Outlines, Dialects, Artifact UX, Ambiguity UX (M9)

- [ ] Gherkin Scenario Outlines (Examples expansion)
  - [ ] TS: Expand Examples for diagnostics (undefined/ambiguous) with resolved values.
  - [ ] TS: Hover shows resolved placeholders when inside an expanded example.
  - [ ] Tests: fixture with `Scenario Outline` and multi‑row `Examples`.

- [ ] Gherkin Dialects
  - [ ] TS: Support official dialects; auto‑detect with fallback to English.
  - [ ] Setting `cukerust.dialect` (optional override) and `auto` mode.
  - [ ] Tests: non‑English keywords (`Dado/Cuando/Entonces`), diagnostics & go‑to‑def.

- [ ] Artifact Staleness UX
  - [ ] Status bar indicator when `docs/cukerust/step_index.json` is stale.
  - [ ] One‑click fallback to Static Scan with a status message.
  - [ ] Tests: mark artifact older than referenced files; verify fallback.

- [ ] Ambiguity UX (Peek + memory)
  - [ ] Inline Peek for multiple matches; remember user choice for the session.
  - [ ] Status bar action to clear remembered choices.
  - [ ] Tests: ambiguous matches scenario; ensure memory and reset work.

- [ ] Docs
  - [ ] Update `.docs/01_hybrid_ts_rust_vscode_extension.md` with Outlines/Dialects.
  - [ ] README: add short examples for Outlines & Dialects behaviors.

Deliverables

- [ ] Outlines diagnostics/hover working; dialects supported with override.
- [ ] Staleness indicator + fallback; ambiguity memory + clear action.

Commands

- (in extension/) `npm run build && npm run test:int`

Acceptance Criteria

- Outlines diagnostics reflect resolved steps, and hovers show resolved values.
- Dialects parse correctly; diagnostics & go‑to‑def work in non‑English fixtures.
- Artifact staleness is visible with one‑click Static Scan.
- Ambiguity Peek appears; remembered choice influences go‑to‑def until cleared.

---

## Week 6 — Runtime‑List Mode + Run Matrix Integration (M10)

- [ ] Runtime‑List Mode (opt‑in, user‑initiated)
  - [ ] Implement `CukeRust: List Steps via Runner` with first‑run trust prompt per workspace.
  - [ ] Parse runner output into Step Index shape (best‑effort; ignore unknown fields).
  - [ ] Tests: mock runner output; trust gating; fallback to Static Scan.

- [ ] Run Matrix (`docs/cukerust/run_matrix.md`)
  - [ ] Parser for fenced code blocks specifying whole suite / single feature / scenario / tags.
  - [ ] Resolution picks nearest path prefix when multiple matrices exist.
  - [ ] Tests: matrix resolution and shell quoting with placeholders.

- [ ] Run Helpers Enhancements
  - [ ] Ensure `${featurePath}` / `${scenarioName}` / `${tags}` are shell‑safe across Bash/Zsh/Fish/PowerShell/CMD.
  - [ ] Remember last used run template per root; add command to edit.
  - [ ] Tests: cross‑platform quoting (simulation), editing template, multi‑root mapping.

- [ ] Docs
  - [ ] Document Runtime‑List Mode trust model and how to implement a project runner.
  - [ ] Document Run Matrix format with examples.

Deliverables

- [ ] Runtime‑List Mode command with trust gating and parsing.
- [ ] Run Matrix parsed and used by CodeLens and `runScenario`.

Commands

- (in extension/) `npm run build && npm run test:int`

Acceptance Criteria

- User can list steps via a trusted project runner; artifacts load best‑effort.
- CodeLens uses Run Matrix or heuristic; placeholders remain shell‑safe.

---

## Week 7 — Performance & Scale (M11)

- [ ] Indexing performance & scalability
  - [ ] Measure cold scan time on large fixture; document baselines.
  - [ ] Progressive hydration for very large repos; user feedback in status bar.
  - [ ] Tune file watchers and debounce to keep steady‑state idle low.

- [ ] Matching performance
  - [ ] Micro‑benchmarks for matching tiers (Anchored/Smart/Substring).
  - [ ] If profiling shows benefit, prototype Rust/WASM matching (opt‑in setting) with JSON in/out; otherwise, stay in TS.
  - [ ] Tests/benchmarks compare TS vs Rust matching on the fixture corpus.

- [ ] Memory footprint & stability
  - [ ] Ensure Step Index is compact (dedupe equivalent patterns).
  - [ ] Best‑effort skip of invalid entries with non‑blocking error summary.

- [ ] Docs
  - [ ] Add a short performance note with before/after timings and tuning guidance.

Deliverables

- [ ] Measurable improvements (documented) or clear justification not to offload matching.
- [ ] Stable incremental updates with low idle CPU usage.

Commands

- (in extension/) `npm run build && npm run test:int`
- (in rust/) `cargo test --workspace`

Acceptance Criteria

- Cold scan and incremental updates meet or improve targets on large fixtures.
- No pathological slowdowns introduced; idle CPU < ~50% of one core.

---

## Week 8 — Hardening, UX Polish, Release Candidate (M12)

- [ ] Error handling & UX polish
  - [ ] Centralize error reporting; actionable status bar messages; soft‑failures continue features when possible.
  - [ ] Non‑intrusive telemetry scaffolding (opt‑in; anonymous feature usage counts only).

- [ ] Multi‑root UX
  - [ ] Status bar clearly indicates active root and discovery mode; command to switch active root for current document.
  - [ ] Tests: multi‑root fixture; per‑root Step Index & Run Matrix mapping.

- [ ] Pre‑release readiness
  - [ ] Finalize publisher name and repository URL in `extension/package.json`.
  - [ ] Update CHANGELOG; bump version; generate VSIX.
  - [ ] Smoke tests: Linux/macOS/Windows.
  - [ ] Validate on example repositories (small, medium, large); record known limitations.

- [ ] CI/CD
  - [ ] Add a release job to package VSIX and publish artifact.
  - [ ] Optional: add Changesets for TS or `cargo release` workflow for Rust crates (if publishing separately later).

- [ ] Docs
  - [ ] Keep `.docs/01..04` aligned with new features.
  - [ ] README: extend Quickstart with Runtime‑List Mode and Run Matrix examples.

Deliverables

- [ ] Polished UX with clear status and error surfaces; telemetry opt‑in scaffold.
- [ ] Release candidate VSIX and updated documentation.

Commands

- (in extension/) `npm run build && npm run package`
- (in rust/) `cargo test --workspace`

Acceptance Criteria

- RC VSIX builds; docs are current; CHANGELOG updated; known issues documented.
- Cross‑platform smoke tests pass; example repos validated.

---

## Stretch (nice to have if time permits)

- [ ] Basic benchmark harness for indexing/matching; record graphs.
- [ ] Demo screencast GIF for README.
- [ ] Additional fixture scenarios (multi‑root, very large repos, mixed dialects).

## Open Items

- [ ] Publisher name and repository URL in `extension/package.json`.
- [ ] Example repositories to validate (small, medium, large).
- [ ] Minimum supported VS Code version policy.

## Definition of Done (next milestone)

- Outlines, Dialects, Artifact UX, and Ambiguity UX implemented and tested.
- Runtime‑List Mode and Run Matrix integrated and tested.
- Performance targets validated on large fixture; matching offload decision documented.
- RC VSIX produced; docs/CHANGELOG updated; CI gates (lint/format/clippy/tests/package) green.
