# User Journeys

## Onboarding (5 minutes)

1. Install `Veighnsche.cukerust`.
2. Open a Rust workspace with a crate.
3. Extension health check runs: detects rust-analyzer; if missing, offers to install; runs `cargo check` via helper script.
4. QuickStart prompt: create `features/sample.feature` and `steps_macros/src/lib.rs` with example macros.
5. Syntax highlighting active; CodeLens shows Run/Debug.
6. User runs the sample scenario; sees progress and result.

## Daily Authoring

- Create/modify `.feature` files; get completions for known steps.
- Unresolved step shows quick fix to create macro in chosen crate/module.
- Hover shows macro signature; Go to Definition jumps to Rust.
- Run by tag or file from Explorer; watch progress in status bar and Output.

## Triage & Maintenance

- Diagnostics list all ambiguous/duplicate steps with links.
- `CukeRust: Health Report` surfaces misconfigurations with fixes.
- Explorer highlights orphaned steps (no usages) and unused examples.

## Advanced: Debugging

- Start a Debug Session from CodeLens; breakpoints hit inside step functions in Rust.
- After failure, peek last run output with links back to scenario and step.
