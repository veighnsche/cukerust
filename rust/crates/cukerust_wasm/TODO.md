# cukerust_wasm — Refactor and Cleanup TODO

This crate exposes the Rust core step index extractor to JS via wasm-bindgen.

Completed (quick wins)

- [x] Replace manual error JSON builder with `serde_json` to ensure correct escaping and reduce code paths (`src/lib.rs`).
- [x] Remove unused `regex` dependency from `Cargo.toml` to shrink build and dependency tree.
- [x] Broaden tests to ensure error-path JSON is valid (add a negative/invalid JSON test).

Backlog (larger refactors — not immediate TODO)

- Separate FFI boundary from domain logic: move input/output wrappers into `ffi.rs` and keep `lib.rs` slim.
- Add feature-gated `console_error_panic_hook` for better error messages in browsers.
- Provide a stable JSON schema document for `{ files: [{ path, text }] }` and `StepIndex` (reference `cukerust_core` JSON shape).
- Add a size guard for extremely large payloads (configurable cap) and return a structured error.
- Add a minimal benchmark (native target) to track serialization and extraction performance.

Notes

- The JSON shape mirrors `cukerust_core::StepIndex`. Keep the field casing stable across releases.
- Prefer small, testable units; keep the WASM entry small and delegate to core.
