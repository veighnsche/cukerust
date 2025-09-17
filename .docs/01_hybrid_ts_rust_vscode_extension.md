# Hybrid TypeScript + Rust VS Code Extension (CukeRust)

This guide explains how to build a VS Code extension where the extension host code is TypeScript and performance‑critical logic is implemented in Rust. It compares three integration strategies (WebAssembly, N‑API native addon, CLI child process), recommends a default for CukeRust, and outlines build and packaging steps for each.

## Goals

- Keep the extension zero‑config and read‑only by default.
- Make the Rust component portable across OS/arch without install friction.
- Keep distribution via VSIX and Marketplace simple and predictable.
- Leave room to switch strategies if performance requirements change.

## Integration strategies

### 1) Rust → WebAssembly (Node target)

- Build Rust as a `cdylib` and compile to WebAssembly using `wasm-bindgen`/`wasm-pack` with `--target nodejs`.
- Load the generated JS glue + `.wasm` from the TypeScript extension and call exported functions.

Pros

- Single portable artifact (works on all OS/arch with Node). No native toolchain required at install time.
- Easy to package inside a VSIX (include the `.wasm` as an asset).

Cons

- Data transfer costs between Node and WASM; thread support is limited/complex in Node.
- Access to Node APIs (fs, path) must be provided by the extension host; WASM code itself should be pure/CPU‑bound logic.

Recommended usage

- Keep file system scanning and globbing in TS.
- Send parsed text or buffers to the WASM module for parsing/matching.

Minimal blueprint

- Rust crate
  - `Cargo.toml`:

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

  - `src/lib.rs`:

    ```rust
    use wasm_bindgen::prelude::*;

    #[wasm_bindgen]
    pub fn analyze_steps(files_json: &str) -> String {
        // Accept JSON from TS, return JSON back (StepIndex)
        // Keep this CPU-bound and pure.
        files_json.to_string()
    }
    ```

- Build command (from crate dir):

  ```bash
  wasm-pack build --target nodejs --release --out-dir ../../packages/extension/native/cukerust-wasm
  ```

- TypeScript usage (extension host):

  ```ts
  const wasm = await import("../native/cukerust-wasm");
  const out = wasm.analyze_steps(JSON.stringify(files));
  const index = JSON.parse(out);
  ```

Packaging notes

- Ensure the `.wasm` and glue JS are included by your bundler and VSIX. Mark them as assets (don’t tree‑shake out).
- If you bundle with esbuild/tsup, configure `external` or asset loaders for `.wasm`.

### 2) Rust → N‑API native addon (via `napi-rs`)

- Build a Node native addon using [`napi-rs`](https://napi.rs/) and ship prebuilt `.node` binaries per OS/arch.

Pros

- Best raw performance and seamless access to Node types.
- Mature tooling (`@napi-rs/cli`) for building and publishing prebuilds.

Cons

- Distribution complexity: the VSIX must embed multiple prebuilt binaries (win/mac/linux, arm/x64). You can’t compile on the user’s machine during extension install.

Minimal blueprint

- Rust crate using `napi`:

  ```toml
  [lib]
  crate-type = ["cdylib"]

  [dependencies]
  napi = { version = "3", features = ["napi8"] }
  napi-derive = "3"
  regex = "1"
  ```

- Expose functions with `#[napi]` and build via `@napi-rs/cli`.
- Publish or copy the prebuilt artifacts into the extension before packaging.

Packaging notes

- Use CI to create prebuilds for all supported targets, then include them in `files` inside the extension’s `package.json`.
- At runtime, pick the correct binary with `process.platform` and `process.arch` or rely on napi’s loader.

### 3) Rust → CLI child process

- Build a Rust binary and call it via `child_process.spawn` from the extension. Communicate via JSON over stdio.

Pros

- Simple integration and isolation of failures/crashes.
- Flexible versioning (can point to a repo/tool the user already has installed).

Cons

- Installation frictions: shipping per‑platform binaries or requiring Rust on the user’s machine.
- Updating the binary outside VSIX lifecycle is tricky.

Recommended usage

- Keep as an optional power‑user path. Not the default for Marketplace distribution.

## Recommendation for CukeRust

- Default: WebAssembly for portability and frictionless installs.
- Architecture split:
  - TypeScript: scanning, globbing, workspace integration, VS Code UI (diagnostics, hovers, completion, commands).
  - Rust (WASM): CPU‑bound parsing/matching/normalization logic.
- Fallback option: retain the ability to swap the WASM parser with an N‑API addon later if profiling shows the need.

## Project layout (hybrid)

```
repo/
  packages/
    extension/               # VS Code extension (TypeScript)
      src/
      native/
        cukerust-wasm/       # wasm-pack output (JS + .wasm)
      package.json
    ts-shared/               # optional TS utilities shared across packages
  rust/
    crates/
      cukerust_wasm/         # Rust crate compiled to WASM
      cukerust_core/         # optional pure Rust core reused by wasm and other bins
    Cargo.toml               # cargo workspace
  .docs/
  pnpm-workspace.yaml
  turbo.json
```

## Build pipeline (WASM path)

- Rust → WASM: `wasm-pack build --target nodejs --release`
- TS build: `tsup` or `esbuild` for the extension host code
- Turbo orchestration: define a `build:wasm` task that runs before `build:ts` for the extension package

Example scripts

```json
{
  "scripts": {
    "build:wasm": "cd rust/crates/cukerust_wasm && wasm-pack build --target nodejs --release --out-dir ../../../packages/extension/native/cukerust-wasm",
    "build:ts": "tsup packages/extension/src/extension.ts --format=cjs --dts",
    "build": "pnpm build:wasm && pnpm build:ts",
    "package": "vsce package"
  }
}
```

## Packaging and publishing

- Use `vsce package` (or `@vscode/vsce`) to create a VSIX.
- Include WASM assets in the `files` list of `package.json`.
- Validate the VSIX on Linux, macOS, and Windows.

## Performance and memory notes

- Minimize data crossing the TS⇄WASM boundary. Prefer batched JSON or binary buffers.
- Keep WASM CPU‑bound; all I/O stays in TS.
- Profile with `--inspect` and flamegraphs to decide if an N‑API switch is warranted later.
