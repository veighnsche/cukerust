# Communication & Feedback Patterns

Make the extension communicative but not noisy. Prefer ambient signals; reserve modals for critical actions.

## Surfaces

- Status Bar: `CukeRust` item showing `Indexing…`, `Ready`, `Errors`, with menu actions: Reindex, Open Output, Run Last.
- Output Channel: `CukeRust` channel with structured logs (component, level, message). Include redaction and opt-in telemetry.
- Notifications: Info for one-off success; Warning for recoverable issues; Error for blocking failures. Use progress notifications for long tasks.
- Problems Panel Diagnostics: Unresolved steps, ambiguous matches, duplicate definitions, parsing errors.
- Inline Decorations: Squiggles for unresolved steps; lightbulb quick fixes (create definition, re-scan).
- QuickPick Menus: Run by tag, pick test binary, choose target crate for new step.
- Command Palette: All actions prefixed with `CukeRust:`.

## Tone & Copy

- Specific, actionable, short. Example: "2 ambiguous step matches. Pick one or refine patterns."
- Provide a `Show Details` button linking to docs or Output.
- Never blame the user; suggest the next best action.

## Error Categories & Handling

- Configuration: missing rust-analyzer, missing toolchain — propose `Install` or open helper script.
- Indexing: parse failures — point to file/line; allow `Retry`.
- Execution: test binary not built — offer `cargo check` or run helper.
- Engine: WASM/native bridge errors — open issue link with captured context (sanitized).

## Observability

- Add a `CukeRust: Open Health Report` command to show environment checks (toolchain, rust-analyzer, workspace crates) and recent failures.
- Log levels configurable: Error/Warn/Info/Debug.

## Privacy & Telemetry (opt-in)

- Clear toggle and docs; scope: feature usage counts, anonymized errors.
- No source content; redact file paths where possible.
