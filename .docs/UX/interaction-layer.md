# Proposed Interaction Layer

We propose an internal Interaction Layer that mediates between the VS Code UI surfaces and the Rust engines (`cukerust_core` via native or `cukerust_wasm`).

## Why

- Centralize state and events: indexing, step db, run sessions.
- Decouple UI from engine details (native/WASM, worker boundaries).
- Enable testing and future LSP migration.

## Architecture

- UI Adapters: Tree View, CodeLens provider, Hover, Completion, Diagnostics, Commands.
- Interaction Layer (TypeScript):
  - Event Bus: typed events (indexing-started, indexing-complete, run-started, run-progress, run-complete, error).
  - State Stores: step index, feature graph, run sessions, configuration.
  - Orchestrators: indexer, runner, resolver.
- Engine Bridge:
  - WASM adapter (`cukerust_wasm`) for portability.
  - Native adapter for performance if needed.

## API Sketch

```ts
interface StepMatch { id: string; file: string; range: Range; macro: string; crate: string; }
interface RunProgress { scenarioId: string; status: 'pending'|'running'|'passed'|'failed'|'skipped'; message?: string }

class CukeRustIL {
  on(event: 'indexing-started'|'indexing-complete'|'run-progress'|'error', cb: Function): Disposable
  indexWorkspace(reason: 'startup'|'manual'|'file-change'): Promise<void>
  resolveStep(text: string, location: Uri): Promise<StepMatch[]>
  run(target: { type: 'scenario'|'file'|'tag'|'workspace'; id?: string; tag?: string }): AsyncIterable<RunProgress>
}
```

## Data Contracts

- Versioned messages; include `schemaVersion`.
- Errors with `code`, `message`, `details` (engine stack redacted in UI).

## Migration Path

- Start as an in-process TS layer wrapping WASM calls.
- If/when we adopt LSP: the IL becomes a thin client for the language server, preserving UI APIs.

## Performance

- Debounce file events, incremental re-index, cache across sessions.
- Offload heavy regex parsing to Rust/WASM; stream results back.
