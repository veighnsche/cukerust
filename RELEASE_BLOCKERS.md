# CukeRust — Release Blockers Checklist

Use this as the final pre‑release gate for the repo. All items must be checked before tagging a release.

## CI and Quality Gates

- [ ] CI green on all jobs and OSes (`.github/workflows/ci.yml`)
- [ ] Rust fmt: `cargo fmt --all -- --check`
- [ ] Clippy warnings: `cargo clippy --workspace --all-features -- -D warnings`
- [ ] Node build/lint/tests in `extension/` succeed:
  - [ ] `npm ci || npm i`
  - [ ] `npm run build`
  - [ ] `npm run lint`
  - [ ] `npm test` (if tests exist)
  - [ ] `npm run test:int` (if integration tests exist)

## Rust Core (cukerust_core)

- [ ] BDD tests green: `cd rust && cargo test -p cukerust_core --test bdd`
- [ ] Unit tests green: `cd rust && cargo test --all --lib`
- [ ] Performance sanity on local fixtures (no obvious regressions)

## Extension (VS Code)

- [ ] WASM is rebuilt and present: `extension/native/cukerust-wasm/*`
- [ ] Build succeeds: `cd extension && npm run build`
- [ ] VSIX packages: `cd extension && npm run package`
- [ ] Try in Extension Host (F5): no crashes; commands work
  - [ ] Rebuild Step Index
  - [ ] Force Static Scan Rebuild
  - [ ] Clear Ambiguity Choices
  - [ ] List Steps via Runner (if configured)

## Feature Completeness & Tests

- [ ] All feature files for core parsing exist and pass (see `rust/crates/cukerust_core/features/`)
- [ ] Definition of Done satisfied in `rust/crates/cukerust_core/TODO.md`
- [ ] Known limits documented in `.docs/05_all_testing requirements.md` and enforced with negative scenarios

## Docs & Communications

- [ ] `CHANGELOG.md` updated (user‑visible changes, breaking changes, migration notes)
- [ ] `README.md` updated (badges, usage, screenshots/gifs)
- [ ] `.docs/MONKEY_TESTING_GUIDE.md` reviewed/updated
- [ ] Version numbers bumped consistently
  - [ ] `extension/package.json` `version`
  - [ ] Any published Rust crates (if applicable) `Cargo.toml`
- [ ] Licensing & repository metadata correct
  - [ ] `extension/package.json` `publisher`, `repository.url`
  - [ ] Dual license headers present (MIT OR Apache‑2.0)

## Manual Monkey Test (Sign‑off)

- [ ] Completed the matrix in `.docs/MONKEY_TESTING_GUIDE.md`
- [ ] No crashes or severe UX issues
- [ ] Diagnostics behaved predictably during chaotic edits

## Tag & Release Artifacts

- [ ] Tag created (e.g., `vX.Y.Z`) and pushed
- [ ] Release notes drafted from CHANGELOG and linked artifacts
- [ ] VSIX attached (if releasing outside Marketplace)
