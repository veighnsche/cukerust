# Project Structure: Single TypeScript Extension + Rust Cargo Workspace

This guide describes a simple project layout that hosts a single VS Code extension (TypeScript) alongside a Rust Cargo workspace. Each ecosystem is kept idiomatic and the wiring between them is minimal.


## Executive summary

- TypeScript side: a single extension package in `extension/`.
- Rust side: a Cargo workspace with two crates: `cukerust_core` (lib) and `cukerust_wasm` (cdylib for WASM).
- Build orchestration: plain npm scripts in the extension package call `wasm-pack` for Rust, then build TypeScript.
- Packaging: the VSIX embeds the WASM assets so users don’t need a native toolchain at install time.


## Goals and constraints

- Zero install friction for end users installing from the Marketplace/VSIX.
- Fast local developer workflows for both TS and Rust.
- CI portability across Linux, macOS, Windows.
- Clear separation of concerns; keep Rust integration behind a stable WASM interface.

## Repository layout

```
repo/
  .docs/                   # architecture & ops docs
  .vscode/                 # editor settings & debug launch configs
  extension/               # VS Code extension (TypeScript)
    src/
    native/                # wasm-pack output (JS glue + .wasm)
      cukerust-wasm/
    test/
    package.json
  rust/
    crates/
      cukerust_core/       # pure Rust core used by wrapper(s)
      cukerust_wasm/       # Rust WASM crate (cdylib) for Node target
    Cargo.toml             # Cargo workspace manifest
  tsconfig.base.json       # optional: shared TS config
```

Why this split?

- Node uses npm and a local package for the extension; Rust uses Cargo. We avoid mixing build systems.
- The extension owns the npm scripts that trigger Rust builds (`wasm-pack`) as needed.

## Build scripts (extension)

`extension/package.json` (scripts excerpt)

```json
{
  "scripts": {
    "build:wasm": "wasm-pack build ../rust/crates/cukerust_wasm --target nodejs --release --out-dir ./native/cukerust-wasm",
    "build:ts": "tsup src/extension.ts --format=cjs --dts --out-dir out",
    "build": "npm run build:wasm && npm run build:ts",
    "test": "vitest run",
    "test:int": "node ./out/test/runTest.js",
    "package": "vsce package"
  }
}
```


## Cargo workspace

`rust/Cargo.toml`

```toml
[workspace]
resolver = "2"
members = [
  "crates/cukerust_core",
  "crates/cukerust_wasm",
]
```

Example WASM crate `rust/crates/cukerust_wasm/Cargo.toml`

```toml
[package]
name = "cukerust_wasm"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
wasm-bindgen = "0.2"
regex = "1"
```


## Extension package (TypeScript)

`extension/package.json` (skeletal)

```json
{
  "name": "@cukerust/extension",
  "version": "0.0.0",
  "private": true,
  "main": "./out/extension.js",
  "engines": { "vscode": "^1.92.0" },
  "activationEvents": ["onLanguage:feature", "onCommand:cukerust.rebuildIndex"],
  "contributes": {
    "commands": [{
      "command": "cukerust.rebuildIndex",
      "title": "CukeRust: Rebuild Step Index"
    }]
  },
  "scripts": {
    "build:wasm": "wasm-pack build ../../rust/crates/cukerust_wasm --target nodejs --release --out-dir ./native/cukerust-wasm",
    "build:ts": "tsup src/extension.ts --format=cjs --dts --out-dir out",
    "build": "npm run build:wasm && npm run build:ts",
    "test": "vitest run",
    "test:int": "node ./out/test/runTest.js",
    "lint": "eslint .",
    "package": "vsce package"
  },
  "files": [
    "out/**",
    "native/**"
  ],
  "devDependencies": {
    "tsup": "^8",
    "vitest": "^2",
    "@vscode/test-electron": "^3",
    "eslint": "^9",
    "@types/node": "^20"
  }
}
```

Include WASM output in `extension/native/cukerust-wasm/` so `files` picks it up for the VSIX.

## Rust development methodology (BDD/TDD via cucumber)

- We practice BDD-first TDD for the Rust core (`cukerust_core`) using Gherkin features and the [`cucumber`](https://crates.io/crates/cucumber) crate.
- Directory layout:
  - `rust/crates/cukerust_core/features/**/*.feature`
  - `rust/crates/cukerust_core/tests/bdd.rs` — cucumber test harness (tokio async)
- Dev-dependencies (in `cukerust_core`): `cucumber`, `tokio` (rt-multi-thread, macros)
- Commands:
  - Run only BDD harness: `cargo test -p cukerust_core --test bdd`
  - Run all Rust tests: `cargo test --workspace`

## Scope note

Only the WebAssembly integration is in scope. N‑API and CLI variants are out of scope for this repo.

WASM benefits: straightforward distribution, great portability. Keep CPU‑bound logic in Rust; all VS Code I/O remains in TypeScript.

## CI/CD outline (GitHub Actions)

- Node job matrix (Ubuntu/macOS/Windows): install Node, run extension `npm ci && npm run build && npm test && npm run test:int`.
- Rust job: `cargo test --workspace`.
- Packaging job: build VSIX via `vsce package`; upload artifact.

Example fragments

```yaml
jobs:
  node:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix: { os: [ubuntu-latest, macos-latest, windows-latest], node: [20] }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: ${{ matrix.node }} }
      - name: Install dependencies
        working-directory: extension
        run: npm ci
      - name: Build extension
        working-directory: extension
        run: npm run build
      - name: Run unit tests
        working-directory: extension
        run: npm test
      - name: Run extension-host tests
        working-directory: extension
        run: npm run test:int

  rust:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo test --workspace --all-features --locked
```


## Developer onboarding checklist

- Install toolchains
  - Node 20+ and npm
  - Rust stable via `rustup`, plus `wasm-pack`
- First‑time setup
  - In `extension/`: `npm ci`
  - In `extension/`: `npm run build`
  - In `extension/`: `npm run test:int`
- Day‑to‑day
  - In `extension/`: `npm test` for TS unit tests
  - In repo root: `cargo test --workspace` for Rust tests


## Linting and formatting

- TypeScript: ESLint + Prettier; share config via `tsconfig.base.json` and repo‑wide `.eslintrc`.
- Rust: `cargo fmt --all` and `cargo clippy --workspace --all-features -D warnings` (hook with pre‑commit if desired).


## Versioning and releases

- Single VS Code extension: version via the extension `package.json`.
- Rust crates: `cargo release` or manual tagging. Keep crate versions aligned with extension milestones when shipped together.
- VSIX: source of truth for user delivery. Ensure WASM artifacts are embedded.


## FAQ

- Why not a single unified build tool?
  - We use npm for the TS extension and Cargo for Rust. This keeps each side idiomatic and simple.
- Can we nest the Rust crate inside the extension package?
  - Possible, but it complicates Cargo workspaces and Rust IDE tooling. We prefer `rust/` at the top level.
- How do we add another Rust crate later?
  - Create `rust/crates/<name>` and list it in `rust/Cargo.toml` workspace members.


## Recommended default

- Use the WASM strategy.
- Keep a single TS extension package and a Rust Cargo workspace.
- Package all WASM artifacts inside the VSIX so users can install without toolchains.
