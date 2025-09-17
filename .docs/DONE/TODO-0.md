# CukeRust — Project Scaffolding TODO

This checklist will scaffold a minimal working layout:

- [x] Create `extension/` (single TS extension package)
  - [x] `extension/package.json` with build scripts (WASM + TS)
  - [x] `extension/tsconfig.json`
  - [x] `extension/src/extension.ts` (activation + sample command)
  - [x] `extension/.gitignore`
  - [x] `extension/native/.gitkeep` (added by user)
- [x] Create Rust workspace
  - [x] `rust/Cargo.toml` (workspace members)
  - [x] `rust/crates/cukerust_core/Cargo.toml` and `src/lib.rs`
  - [x] `rust/crates/cukerust_wasm/Cargo.toml` and `src/lib.rs`
- [x] Wire scripts
  - [x] `npm run build:wasm` in `extension/` calls wasm-pack to output into `extension/native/cukerust-wasm`
  - [x] `npm run build:ts` bundles the extension to `extension/out`
- [x] Fix doc path correctness
  - [x] In `.docs/01_hybrid_ts_rust_vscode_extension.md` ensure crate-dir build out-dir uses `../../../extension/native/cukerust-wasm`
  - [x] In `.docs/03_monorepo_ts_rust_structure.md` ensure extension script uses `../rust/crates/cukerust_wasm`
- [x] Add next steps section to this TODO

Once complete, run:

- In `extension/`: `npm ci` (after adding a lockfile), then `npm run build`
- In repo root: `cargo test --workspace`
