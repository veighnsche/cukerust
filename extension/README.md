# CukeRust — Gherkin × Rust BDD for VS Code

[
![CI](https://img.shields.io/github/actions/workflow/status/veighnsche/cukerust/ci.yml?branch=main&logo=github&label=CI)
](https://github.com/veighnsche/cukerust/actions/workflows/ci.yml)
[
![MSRV 1.89.0](https://img.shields.io/badge/MSRV-1.89.0-orange)
](https://github.com/veighnsche/cukerust#msrv)
[
![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/Veighnsche.cukerust?label=VS%20Marketplace)
](https://marketplace.visualstudio.com/items?itemName=Veighnsche.cukerust)
[
![Installs](https://img.shields.io/visual-studio-marketplace/i/Veighnsche.cukerust?label=Installs)
](https://marketplace.visualstudio.com/items?itemName=Veighnsche.cukerust)
[
![License: MIT OR Apache-2.0](https://img.shields.io/badge/license-MIT%20OR%20Apache--2.0-blue)
](https://github.com/veighnsche/cukerust#license)

![CukeRust Logo](images/LOGO.png)

Zero‑config Gherkin authoring with Rust step integration. Diagnostics, go‑to‑definition, completion, hovers, and run helpers — all without executing project code unless you explicitly opt in.

## Features

- Diagnostics for undefined and ambiguous steps
- Go‑to‑definition to Rust source (`file:line`)
- Completion and hovers powered by discovered regex patterns
- Scenario Outline awareness (Examples expansion)
- Discovery modes: Static Scan (default), Artifact, Runtime‑List (opt‑in)

## Getting Started

1) Install the extension from the Marketplace (search “CukeRust”).
2) Open a Rust BDD workspace with `*.feature` files and Rust step definitions.
3) Use Command Palette:
   - `CukeRust: Rebuild Step Index`
   - `CukeRust: Force Static Scan Rebuild`
   - `CukeRust: Run Scenario`

## Settings

- `cukerust.discovery.mode`: `auto | static-scan | artifact | runtime-list` (default: `auto`)
- `cukerust.index.path`: path to `docs/cukerust/step_index.json`
- `cukerust.runMatrix.path`: path to `docs/cukerust/run_matrix.md`
- `cukerust.regex.matchMode`: `anchored | smart | substring` (default: `smart`)
- `cukerust.dialect`: `auto | en | es` (default: `auto`)
- `cukerust.ignoreGlobs`: additional globs to ignore during static scan
- `cukerust.diagnostics.enabled`: enable/disable diagnostics
- `cukerust.completion.enabled`: enable/disable completion
- `cukerust.statusbar.showMode`: show active discovery mode in status bar
- `cukerust.run.template`: fallback run command template for CodeLens
- `cukerust.runtimeList.command`: shell command to list steps in Runtime‑List mode

## Commands

- `CukeRust: Rebuild Step Index`
- `CukeRust: Dev — Extract Step Index (Fixture)`
- `CukeRust: Dev — Match Micro Benchmark`
- `CukeRust: Force Static Scan Rebuild`
- `CukeRust: Run Scenario`
- `CukeRust: Clear Ambiguity Choices`
- `CukeRust: List Steps via Runner`

## Contributing & Docs

- Full spec and test plan live in the repository root (`README.md`, `.docs/`, `.specs/`).
- Rust core BDD tests: `cargo test -p cukerust_core --test bdd` in the `rust/` workspace.

## License

Dual‑licensed under MIT or Apache‑2.0. See repository root `LICENSE-MIT` and `LICENSE-APACHE`.
