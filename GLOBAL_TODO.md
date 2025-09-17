# CukeRust — GLOBAL TODO (High‑Level Roadmap)

This is the high‑level plan for building, testing, documenting, and releasing the CukeRust extension (single TS package + Rust workspace with `cukerust_core` and `cukerust_wasm`).

## Methodology

- Rust core (`cukerust_core`) follows a BDD/TDD model using Gherkin features executed via the `cucumber` crate.
- Write scenarios/tests first; implement only what’s necessary to pass.
- Keep CPU‑bound logic in Rust and all I/O in the TS extension.

## Milestones

- [x] M0 — Repo scaffolding and architecture
  - Single TS extension in `extension/`, Rust workspace in `rust/`.
  - WASM build wiring via `wasm-pack`; TS bundling via `tsup`.
  - Base CI, licenses, repo hygiene files.

- [ ] M1 — Rust BDD harness + Step Index (WASM core)
  - Establish Rust BDD harness (`cucumber` + `tokio`) and initial `features/` for parsing behaviors.
  - Implement minimal JSON FFI in `cukerust_wasm` that accepts `{ files: {path,text}[] }` and returns `StepIndex` per `.specs/00_cukerust.md`.
  - Parsing surface: `#[given/when/then]`, `.given/.when/.then`, `given!/when!/then!` including raw string forms.
  - Deliverables: green BDD run; `extract_step_index(input) -> StepIndex` exported from WASM.
  - Performance target: acceptable on small repos (functional correctness prioritized).

- [ ] M2 — Extension integration (diagnostics + go‑to‑definition)
  - TS: discover candidate Rust files, pass to WASM, keep in‑memory Step Index, debounce updates.
  - Surface diagnostics for undefined/ambiguous steps; implement go‑to‑definition.
  - Deliverable: end‑to‑end features working on a sample workspace.

- [ ] M3 — Completion and Hover
  - Provide completion items from Step Index with snippet placeholders for captures.
  - Provide rich hovers (kind, regex, file:line, function?).

- [ ] M4 — Matching performance pass (optional offload)
  - Evaluate tiered matching (anchored/smart/relaxed). If needed, offload matching to Rust; otherwise keep in TS.
  - Micro‑benchmarks and flamegraphs; avoid regressions.

- [ ] M5 — Run helpers (CodeLens/commands)
  - Integrate configurable run commands per workspace folder.
  - Ensure shell‑safe placeholders for feature/scenario/tags.

- [ ] M6 — Hardening, Testing, and CI
  - Comprehensive unit/integration tests (TS + Rust + WASM).
  - CI: multi‑OS Node build + Rust tests; package VSIX as artifact.
  - Error handling and stability (best‑effort loading, staleness detection, resilience to invalid entries).

- [ ] M7 — Documentation and examples
  - Update guides in `.docs/` to reflect current behavior.
  - Add usage docs, examples, and a walkthrough.
  - Ensure `README.md` stays in sync with `.specs/00_cukerust.md` contracts.

- [ ] M8 — Pre‑release & Release
  - Versioning decisions; update changelog.
  - Package VSIX; smoke test across platforms; publish when ready.

## Testing Plan (cross‑cutting)

- [ ] TypeScript unit (Vitest)
  - Coverage goals for utilities and feature logic not bound to the VS Code host.

- [ ] Extension‑host integration (`@vscode/test-electron`)
  - Activate extension, verify diagnostics, go‑to‑def, completion, hovers using fixtures.

- [ ] Rust unit tests (`cargo test`)
  - `cukerust_core`: pure logic tests.
  - `cukerust_wasm`: wrapper behavior and JSON in/out (or tested via Node importing WASM).

- [ ] WASM tests
  - `wasm-bindgen-test --node` or black‑box tests from TS importing the built module.

- [ ] Rust BDD (cucumber + Gherkin)
  - Feature files under `rust/crates/cukerust_core/features/**`.
  - Harness `rust/crates/cukerust_core/tests/bdd.rs`.
  - Run: `cargo test -p cukerust_core --test bdd` (also part of `cargo test --workspace`).

- [ ] Performance checks
  - Basic timing for index build on a sample repo; smoke flamegraphs for hotspots.

- [ ] CI gates
  - Lint/format, build, unit + integration tests, Rust tests, and VSIX packaging on main PRs.

## Documentation Plan (cross‑cutting)

- [ ] Keep `.docs/01..04` aligned with implementation; WASM‑only scope.
- [ ] Author a quickstart: installation, features, example workspace, known limitations.
- [ ] API/FFI contract doc (brief) referencing `.specs/00_cukerust.md`.
- [ ] Rust BDD/TDD methodology `.specs/01_rust_bdd_tdd.md` maintained alongside core changes.
- [ ] CHANGELOG once versions start moving.

## CI/CD & Quality

- [ ] Expand CI to run lint (ESLint + clippy), format checks, and package VSIX artifacts.
- [ ] Consider release automation for tagging and VSIX publishing.
- [ ] Add pre‑commit hooks (format/lint) and Conventional Commits guidance.

## Security & Privacy

- [ ] Confirm no auto‑execution of project code.
- [ ] Telemetry remains opt‑in and minimal (if introduced later).

## Open Items / Decisions

- [ ] Publisher name and repository URL for `extension/package.json`.
- [ ] Example repositories to validate on (small, medium, large).
- [ ] Minimum supported VS Code version policy.
