# Hybrid TypeScript + Rust VS Code Extension (CukeRust)

This guide explains how to build a VS Code extension where the extension host code is TypeScript and performance‑critical logic is implemented in Rust. It focuses on the WebAssembly integration strategy and outlines build and packaging steps for it.

## Goals

- Keep the extension zero‑config and read‑only by default.
- Make the Rust component portable across OS/arch without install friction.
- Keep distribution via VSIX and Marketplace simple and predictable.

## Integration strategy (WASM only)

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
  wasm-pack build --target nodejs --release --out-dir ../../../extension/native/cukerust-wasm
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

### Out of scope integrations

At this stage, only the WebAssembly path is supported. N‑API and CLI strategies are deliberately out of scope.

## Recommendation for CukeRust

- Default: WebAssembly for portability and frictionless installs.
- Architecture split:
  - TypeScript: scanning, globbing, workspace integration, VS Code UI (diagnostics, hovers, completion, commands).
  - Rust (WASM): CPU‑bound parsing/matching/normalization logic.

## Project layout (single TS package + Rust workspace)

```
repo/
  extension/                 # VS Code extension (TypeScript)
    src/
    native/
      cukerust-wasm/         # wasm-pack output (JS + .wasm)
    test/
    package.json
  rust/
    crates/
      cukerust_core/         # pure Rust core reused by wrapper(s)
      cukerust_wasm/         # Rust crate compiled to WASM (Node target)
    Cargo.toml               # cargo workspace
  .docs/
```

## Build pipeline (WASM path)

- Rust → WASM: `wasm-pack build --target nodejs --release`
- TS build: `tsup` or `esbuild` for the extension host code
- Composite build: run `npm run build:wasm` before `npm run build:ts` in the extension package

Example scripts (extension/package.json)

```json
{
  "scripts": {
    "build:wasm": "wasm-pack build ../../rust/crates/cukerust_wasm --target nodejs --release --out-dir ./native/cukerust-wasm",
    "build:ts": "tsup src/extension.ts --format=cjs --dts --out-dir out",
    "build": "npm run build:wasm && npm run build:ts",
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
- Profile with `--inspect` and flamegraphs to identify and tune CPU hotspots.
