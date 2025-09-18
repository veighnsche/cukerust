# CukeRust UX Plan

This directory collects the UX strategy and actionable plans to make the `Veighnsche.cukerust` VS Code extension delightful, clear, and productive for BDD/TDD in Rust.

## Goals

- Fast understanding of scenarios and steps in `.feature` files.
- Seamless round-trip between Gherkin and Rust step definitions (macros-based).
- Clear guidance, feedback, and error handling.
- Low-friction onboarding; showcase project compiles with rust-analyzer.
- Progressive enhancement: useful with minimal setup, excellent when fully configured.

## Design Principles

- Progressive disclosure of complexity.
- Consistency with native VS Code idioms.
- Immediate, actionable feedback.
- Respect performance and developer flow.
- Accessibility and theming support (light/dark/high-contrast).

## Personas (lightweight)

- Rust BDD newcomer: needs onboarding and examples.
- Experienced Rust dev: wants speed, keyboard-first, minimal noise.
- Test maintainer: cares about diagnostics, refactors, and coverage.

## Documents

- `features.md` — Features and interactions surface.
- `highlighting.md` — Gherkin and step semantic highlighting strategy.
- `communication.md` — Notifications, status bar, and diagnostics patterns.
- `interaction-layer.md` — Proposal for a new interaction layer between UI and engine.
- `user-journeys.md` — Onboarding and key flows.
- `roadmap.md` — Phased delivery aligned with showcase requirements.
- `open-questions.md` — Decisions and risks.

## Related project constraints and references

- Publisher/ID: `Veighnsche.cukerust`.
- Showcase requirement: example Rust crate compiles with rust-analyzer; macros used for steps; helper script installs rust-analyzer and runs `cargo check`.
- Codebase paths of interest:
  - `extension/` — VS Code extension sources.
  - `extension/test-fixtures/basic/` — Example project used for tests/showcase.
  - `rust/crates/` — `cukerust_core`, `cukerust_wasm` engines.
