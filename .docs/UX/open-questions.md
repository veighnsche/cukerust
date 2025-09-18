# Open Questions & Decisions Needed

- Grammar vs LSP-first: Start with TextMate + minimal AST or jump to LSP? Proposal: start minimal, layer LSP later.
  - Decision: Start with TextMate grammar + existing TS providers (Go to Def, Hover, Completion). Introduce semantic tokens via the Interaction Layer later; plan an LSP migration in P3 when APIs stabilize. Rationale: fastest time-to-value and minimal overhead.

- WASM vs native: portability vs performance for indexing? Proposal: WASM first; native optional.
  - Decision: WASM-first for portability and simple packaging. Add an optional native adapter behind a setting for heavy monorepos. Keep a stable bridge API so UI remains unchanged.

- Step pattern source: macros only or also attribute-based APIs? Confirm supported macros and patterns.
  - Decision: Prioritize macros to meet the showcase requirement (steps via macros). Officially support `given!`, `when!`, `then!` with regex literals (and builder-style registrations later). Consider attributes as a follow-up if the ecosystem demands it.

- Runner strategy: use `cargo test`-driven harness vs standalone binary? How to map scenarios to Rust tests.
  - Decision: Prefer `cargo test`-driven harness for integration with rust-analyzer and debugging. Map scenario names/tags to test filters or env-vars; keep the run template fallback. Provide a thin orchestrator crate example if needed in P2.

- Debugger: attach to which process when running within cargo? Provide template `launch.json`.
  - Decision: Generate a `launch.json` template that launches `cargo test` with appropriate filters (`-- --exact --nocapture`) and uses CodeLLDB (or platform default). CodeLens Debug should invoke this configuration.

- Workspace scale: large monorepos—index sharding and caching strategy.
  - Decision: Shard the index per workspace folder and per crate. Cache on disk (e.g., `.cukerust/step_index.json`) with mtime hashing; incrementally update via file watchers; throttle/debounce; respect ignore globs.

- Telemetry: opt-in mechanism and data contract.
  - Decision: Opt-in only. Collect minimal counters (feature usage, anonymized error codes), no source content or file paths. Provide a clear toggle and document what’s collected.

- Theming: provide sample theme token colors or rely solely on defaults?
  - Decision: Rely on default theme token colors; ensure grammar scopes align with common tokens. Add docs with recommended mappings; defer custom theme contributions.

- Accessibility: keyboard shortcuts defaults and when to add.
  - Decision: Expose all actions via Command Palette first (no default keybindings to avoid conflicts). Add conservative, discoverable defaults post-telemetry. Ensure status/notifications are screen-reader friendly.

- New interaction layer scope: keep only orchestration or include persistence and caching?
  - Decision: Include orchestration, typed events, and lightweight state stores with persistence for caches (step index, ambiguity choices). Keep adapters pluggable (WASM/native) and avoid heavy persistence until needed.
