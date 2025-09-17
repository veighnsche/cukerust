# Workspace Plan: Packages, Crates, and Wiring

This document justifies using separate TypeScript and Rust workspaces, enumerates planned packages/crates, and defines the wiring (interfaces, build/test flows) between them.

## Why separate TS and Rust workspaces?

- Ecosystem best practices: Node/npm are ideal for JS/TS; Cargo is ideal for Rust.
- Clean toolchains: developers can work on TS or Rust independently with proper caching.
- Packaging clarity: VSIX bundles WASM artifacts produced by Cargo without leaking Rust build complexity into Node builds.
- Future-proofing: the FFI is minimal and versioned so we can evolve it without disrupting the TS code.

## Planned TypeScript package

Package (single)

- @cukerust/extension
  - VS Code extension host (activation, scanning/globbing, diagnostics UI, hovers, completion, commands, CodeLens, run helpers).
  - Loads Rust artifact (default: WASM) via dynamic import.

Responsibilities split

- TS keeps all I/O (fs, globbing, VS Code API) and presentation (diagnostics, hovers, completion surfaces).
- TS passes CPU-heavy text processing to Rust via a small FFI.

Runtime dependency graph

```
@cukerust/extension ──▶ native artifact (wasm) → cukerust_wasm → cukerust_core
```

## Planned Rust workspace (Cargo)

Crates (initial set)

- cukerust_core (lib)
  - Pure Rust algorithms: regex normalization, pattern extraction, matching tiers (anchored/smart/relaxed), ambiguity resolution.
  - No platform-specific I/O; deterministic and unit-testable.
- cukerust_wasm (cdylib)
  - WASM wrapper exposing a minimal FFI for TS. Depends on `cukerust_core`.
  - Node target via wasm-bindgen; JSON in/out.

Build dependency graph

```
cukerust_wasm  →  cukerust_core
```

## Interfaces (TS ⇄ Rust)

We keep the FFI minimal and JSON-based for portability. The Step Index JSON follows `.specs/00_cukerust.md`.

Core FFI (WASM)

- extract_step_index(input) → StepIndex
  - input: `{ files: Array<{ path: string; text: string }> }`
  - output: `StepIndex` JSON per spec (`steps[]`, `stats`)
  - Scope: parse Rust source text for BDD patterns: `#[given/when/then]`, `.given/.when/.then`, `given!/when!/then!`, raw string forms.
- match_step_text(stepText, candidates) → MatchResult (optional, phase 2)
  - If profiling shows benefit, offload regex tiered matching to Rust; initially TS can perform matching using the index.

TS responsibilities

- Discover candidate Rust files (globs), read file contents, and pass text to WASM.
- Maintain in-memory index per workspace folder; implement debounced updates and VS Code UI.

Stability contract

- FFI is versioned: `{ apiVersion: 1 }` field in requests; WASM rejects unknown future versions gracefully.
- Unknown fields are ignored to allow forward-compatible callers.

## Wiring the builds

- Rust → WASM:
  - Task `build:wasm` runs `wasm-pack build --target nodejs --release` in `rust/crates/cukerust_wasm`.
  - Output placed in `extension/native/cukerust-wasm/`.
- TS build:
  - `tsup`/`esbuild` compiles `@cukerust/extension` and includes WASM glue + `.wasm` asset.
- Packaging:
  - VSIX includes `out/**` and `native/**` (WASM assets) in `files`.

## Testing flows

- Rust: `cargo test --workspace` for `cukerust_core` and wrapper crates.
- WASM: unit tests via `wasm-bindgen-test --node` or black-box testing from TS.
- TS unit: Vitest.
- Extension-host integration: `@vscode/test-electron` with fixtures (feature files + Rust sources) to verify diagnostics and go-to-def.

## Versioning and release

- Align crate versions with extension milestones to simplify traceability.
- VSIX is the delivery source of truth; ensure it embeds the correct WASM artifacts.
- If we later publish TS packages or Rust crates independently, adopt Changesets (TS) and `cargo release` (Rust).

## Roadmap checkpoints

- M1: WASM path end-to-end (index extraction powering diagnostics, go-to-def).
- M2: Performance pass; decide whether to offload matching to Rust.
