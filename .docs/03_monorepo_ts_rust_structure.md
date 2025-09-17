# Monorepo Structure: TypeScript (pnpm + Turborepo) and Rust (Cargo)

This guide recommends a clean monorepo that hosts a VS Code extension (TypeScript) alongside Rust crates. We keep each ecosystem idiomatic while enabling cross‑language workflows.

## Executive summary

- TypeScript side: pnpm workspace + Turborepo to manage the VS Code extension and any shared TS packages.
- Rust side: Cargo workspace to manage crates (WASM crate, optional core crate, CLI tools).
- Orchestration: Turbo tasks triggering Rust builds (e.g., `wasm-pack`) via a thin `justfile` or direct script calls.
- Packaging: The VSIX embeds the WASM (or prebuilt N‑API binaries) so users don’t need a native toolchain at install time.

## Goals and constraints

- Zero install friction for end users installing from the Marketplace/VSIX.
- Fast local developer workflows for both TS and Rust.
- CI portability across Linux, macOS, Windows.
- Clear separation of concerns; easy to swap the Rust integration strategy later (WASM ⇄ N‑API ⇄ CLI).

## Repository layout

```
repo/
  .docs/                           # architecture & ops docs
  .vscode/                         # editor settings & debug launch configs
  packages/
    extension/                     # VS Code extension (TypeScript)
      src/
      native/                      # built artifacts (e.g., wasm-pack output)
      test/
      package.json
    ts-shared/                     # optional shared TS utilities
  rust/
    crates/
      cukerust_wasm/               # Rust WASM crate (cdylib) for CPU-bound logic
      cukerust_core/               # optional pure Rust core used by wasm/other bins
    Cargo.toml                     # Cargo workspace manifest
  tools/                           # optional Node helpers for orchestration (spawn cargo, etc.)
  pnpm-workspace.yaml
  turbo.json
  package.json                     # root scripts delegating to Turbo/Just
  tsconfig.base.json
  justfile                         # thin DX wrapper for Rust/WASM build/test
```

Why this split?

- Node ecosystem tooling (pnpm, Turbo) excels at JS/TS builds, caching, and task graphs.
- Rust is best managed by Cargo. We avoid forcing Rust through Node toolchains.
- The root scripts and/or a minimal `justfile` bridge the two worlds.

## pnpm workspace

`pnpm-workspace.yaml`

```yaml
packages:
  - 'packages/*'
  - 'tools/*'
```

Root `package.json`

```json
{
  "private": true,
  "packageManager": "pnpm@9",
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "package": "turbo run package",

    "build:wasm": "just build-wasm",
    "test:rust": "just test-rust",
    "check:rust": "cargo check --workspace --all-features"
  },
  "devDependencies": {
    "turbo": "^2"
  }
}
```

`turbo.json` (pipeline example)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "out/**", "native/**"]
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": []
    },
    "lint": {
      "outputs": []
    },
    "package": {
      "dependsOn": ["build"],
      "outputs": ["*.vsix"]
    }
  }
}
```

## Cargo workspace

`rust/Cargo.toml`

```toml
[workspace]
resolver = "2"
members = [
  "crates/cukerust_wasm",
  "crates/cukerust_core",
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

`packages/extension/package.json` (skeletal)

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
    "build": "pnpm -w build:wasm && tsup src/extension.ts --format=cjs --dts --out-dir out",
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

Include WASM output in `packages/extension/native/cukerust-wasm/` so `files` picks it up for the VSIX.

## Orchestration with `just`

Root `justfile`

```just
# Build the Rust WASM crate and place artifacts inside the extension package
build-wasm:
    cd rust/crates/cukerust_wasm && \
    wasm-pack build --target nodejs --release \
      --out-dir ../../../packages/extension/native/cukerust-wasm

# Run Rust tests across the workspace
test-rust:
    cargo test --workspace --all-features --locked
```

Why `just`?

- Declarative, cross‑platform command runner. Keeps shell specifics out of package.json.
- Easy to call from Turbo or directly in CI.

Alternative: add Node scripts in `tools/` to spawn `cargo`/`wasm-pack` if you prefer a JS‑only orchestration layer.

## Strategy variants

- Default (recommended): WASM for portability; embed artifacts in VSIX.
- N‑API variant: add `rust/crates/cukerust_napi/` using `napi-rs`. Build prebuilt `.node` binaries for each OS/arch in CI and include them in the VSIX. Load with napi’s loader at runtime.
- CLI variant: ship per‑platform binaries (or require Rust) and call via `child_process`. Keep as an optional power‑user path.

Trade‑offs

- WASM: easiest distribution, great portability, limited threading and Node API access.
- N‑API: best performance and interop, but more complex packaging.
- CLI: simplest isolation, but installation/versioning is trickier.

## CI/CD outline (GitHub Actions)

- Node job matrix (Ubuntu/macOS/Windows): install pnpm, run `pnpm -w build`, unit tests, extension‑host tests.
- Rust job: `cargo test --workspace`. If N‑API, build prebuilds per target using `@napi-rs/cli`.
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
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: ${{ matrix.node }}, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm -w build
      - run: pnpm -w test
      - run: pnpm --filter @cukerust/extension test:int

  rust:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo test --workspace --all-features --locked
```

## Developer onboarding checklist

- Install toolchains
  - Node 20+ and pnpm 9
  - Rust stable via `rustup`, plus `wasm-pack`
- First‑time setup
  - `pnpm install`
  - `pnpm -w build` (runs `just build-wasm` under the hood)
  - `pnpm --filter @cukerust/extension test:int`
- Day‑to‑day
  - `pnpm -w test` for TS unit tests
  - `pnpm test:rust` for Rust tests

## Linting and formatting

- TypeScript: ESLint + Prettier; share config via `tsconfig.base.json` and repo‑wide `.eslintrc`.
- Rust: `cargo fmt --all` and `cargo clippy --workspace --all-features -D warnings` (hook with pre‑commit if desired).

## Versioning and releases

- TS packages: consider `changesets` for versioning/release notes if publishing to npm. For a single extension, pin to the extension version.
- Rust crates: `cargo release` or manual tagging. Keep crate versions aligned with extension milestones when they’re shipped together.
- VSIX: source of truth for user delivery. Ensure WASM/N‑API artifacts are embedded.

## FAQ

- Why not one unified build tool?
  - Each ecosystem is strongest with its native tool (Turbo/pnpm vs Cargo). We glue them via small scripts.
- Can we nest the Rust crate inside the extension package?
  - Technically yes, but it complicates Cargo workspaces and Rust IDE tooling. We prefer `rust/` at the top level.
- How do we add another TS package?
  - Create `packages/<name>`, reference it from `pnpm-workspace.yaml`, and add Turbo tasks.
- How do we add another Rust crate?
  - Create `rust/crates/<name>` and list it in `rust/Cargo.toml` workspace members.

## Recommended default

- Use the WASM strategy first.
- Keep Node and Rust workspaces separate but orchestrated through Turbo + Just.
- Package all platform‑dependent artifacts inside the VSIX so users can install without toolchains.
