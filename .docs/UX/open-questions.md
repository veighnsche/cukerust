# Open Questions & Decisions Needed

- Grammar vs LSP-first: Start with TextMate + minimal AST or jump to LSP? Proposal: start minimal, layer LSP later.
- WASM vs native: portability vs performance for indexing? Proposal: WASM first; native optional.
- Step pattern source: macros only or also attribute-based APIs? Confirm supported macros and patterns.
- Runner strategy: use `cargo test`-driven harness vs standalone binary? How to map scenarios to Rust tests.
- Debugger: attach to which process when running within cargo? Provide template `launch.json`.
- Workspace scale: large monorepos—index sharding and caching strategy.
- Telemetry: opt-in mechanism and data contract.
- Theming: provide sample theme token colors or rely solely on defaults?
- Accessibility: keyboard shortcuts defaults and when to add.
- New interaction layer scope: keep only orchestration or include persistence and caching?
