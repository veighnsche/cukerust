# CukeRust — Zero‑Config Gherkin × Rust BDD for VS Code

A VS Code extension that delivers first‑class Gherkin authoring with Rust step integration. It is designed to work out‑of‑the‑box (zero configuration) without writing to your repository or executing project code unless you explicitly opt in.

Status: Draft v0.2.0 (spec). Audience: VS Code extension developers (TypeScript), Rust BDD maintainers, CI owners, repo maintainers, QA.

## Highlights

- Zero‑Config First: static scanning discovers steps across your workspace with no setup.
- Read‑Only by Default: never modifies repository files or runs code automatically.
- Accurate Authoring: diagnostics for undefined/ambiguous steps; go‑to‑definition; completion; hovers.
- Multi‑Root Aware: per‑folder step indexes and runner mappings.
- Performance Conscious: incremental, debounced indexing that respects ignore rules.

## What it does

- Diagnostics in `*.feature` files for undefined and ambiguous steps.
- Go‑to‑definition from a step to the Rust source location (`file:line`).
- Step completion and hovers powered by discovered regex patterns and metadata.
- Run helpers (CodeLens/commands) with per‑root command mapping and shell‑safe placeholders.
- Support for Gherkin dialects and Scenario Outlines (Examples expansion for diagnostics).

## How it discovers steps (priority order)

The extension selects the first viable discovery mode below (users can override via settings):

1) Static Scan (Default, Zero‑Config)

- Statically scans workspace files without executing code.
- Detects common Rust BDD patterns:
  - Attribute macros: `#[given(...)]`, `#[when(...)]`, `#[then(...)]` (incl. raw string forms).
  - Builder/registry chains: `.given(r"…")`, `.when(r"…")`, `.then(r"…")`.
  - Macros: `given!(r"…", …)` etc.
- Extracts `{ kind, regex, file, line, function? }` into an in‑memory Step Index.

2) Artifact Mode (Optional)

- If `docs/cukerust/step_index.json` exists, it is preferred if not stale.
- Unknown fields are ignored; missing optional fields are tolerated.

3) Runtime‑List Mode (Opt‑in, User‑Initiated)

- User command can run a trusted project runner (e.g., `cargo test -- --list-steps`) to emit a step list.
- Never executes project code automatically; requires per‑workspace confirmation on first run.

4) Rust LSP Backend (Future)

- Reserved for v0.3+; not part of this spec.

## Data contracts (all optional)

Step Index (Artifact Mode)

- Location: `docs/cukerust/step_index.json`
- Shape:

```json
{
  "steps": [
    {
      "kind": "Given|When|Then",
      "regex": "^…$",
      "file": "relative/path/to/steps.rs",
      "line": 1,
      "function": "module::fn",
      "captures": ["name"],
      "tags": ["Given"],
      "notes": "freeform"
    }
  ],
  "stats": {
    "total": 0,
    "by_kind": { "Given": 0, "When": 0, "Then": 0 },
    "ambiguous": 0,
    "generated_at": "ISO-8601"
  }
}
```

- Loaders ignore unknown fields and continue best‑effort if some entries are invalid.

Run Matrix (Optional)

- Location: `docs/cukerust/run_matrix.md`
- Contract: fenced code blocks enumerate runnable commands (entire suite, single feature, by scenario name, by tags).
- If absent, a default heuristic may be used (see Run/Debug Integration).

Advisory Files (Optional)

- `docs/cukerust/survey.json`, `docs/cukerust/tags.json`, `docs/cukerust/recommendations.md` enrich UX but are never required.

## Language features

Diagnostics (Undefined / Ambiguous)

- Match each step line against the active Step Index.
- Undefined: zero matches ⇒ show diagnostic.
- Ambiguous: multiple matches ⇒ show diagnostic.
- Updates on document change and index updates (debounced; noise controlled while editing).

Go‑to‑Definition

- Opens the best match at `file:line`.
- If multiple matches exist, shows inline Peek and may remember the user’s choice for the session.

Completion

- Offers completion items from known regex patterns.
- Captures are converted to snippet placeholders (e.g., `(\d+)` → `${1:number}`, generic → `${1:value}`).
- Duplicate patterns are de‑duplicated across kinds when equivalent.

Hover

- Displays `kind`, normalized `regex`, `function?`, `file:line`, and presence of DataTable/DocString if detected.

Scenario Outlines & Examples

- Parser expands Examples rows logically for diagnostics.
- Hovers may show resolved placeholder values when inside an example context.

Gherkin Dialects

- Supports official dialects for keywords.
- Workspace setting can override/pin the dialect; auto‑detect falls back to English when uncertain.

## Matching semantics

Normalization

- Removes leading Gherkin keyword and space from the step line.
- Infers `And/But` kind from the most recent explicit keyword.

Regex Handling & Tiers

- Treats patterns as standard regex; normalizes raw string notations.
- Tiered policy:
  1. Anchored: full‑line match; respect `^`/`$`.
  2. Smart: if pattern has anchors ⇒ full‑line; else attempt full‑line with implicit anchors.
  3. Relaxed: allow substring match as a last resort.
- A subtle hint may indicate when a fallback tier was used.

Ambiguity

- Multiple matches surface an Ambiguous Step diagnostic.
- Go‑to‑definition offers inline Peek; `preferSingle` can auto‑pick first with a status message.

## Index management

Static Scan

- Respects `.gitignore` and `cukerust.ignoreGlobs`.
- Cold scan targets: ≤2s for ≤15k files; larger repos hydrate progressively.
- Incremental updates target: ≤200ms per change (debounced ≥100ms).

Multi‑Root

- Each workspace folder maintains its own Step Index and Runner Map.
- Feature files resolve to the nearest folder’s index.
- Status bar may display the active root for the current document.

Best‑Effort Loading

- Invalid artifact entries are skipped with a non‑blocking summary; remaining entries still power features.

Artifact Staleness

- Detects staleness (e.g., any referenced file newer than `generated_at` or the index file’s `mtime`).
- Shows a staleness indicator with one‑click fallback to Static Scan.

## UI & UX

- Diagnostics refresh rate is capped (≤5 refreshes/second per document).
- Ambiguity selection uses inline Peek rather than modal dialogs.
- A status bar item can show discovery mode (Static/Artifact/Runtime) and active root.
- A "Reload Index" command is always available.

## Run/Debug integration

Resolution

- If `run_matrix.md` exists, use its commands verbatim; if multiple per root, choose the nearest path prefix.
- If absent, a default heuristic may be used per folder, e.g. for a crate with `tests/bdd_main.rs` or a `features/` directory:
  - `cargo test -p <crate> -- --nocapture` (feature‑path filters applied only if supported by repo conventions).
- First execution per folder prompts for confirmation and may persist a trusted command template.

Execution

- Commands run in the integrated terminal.
- Placeholders are shell‑aware: `${featurePath}`, `${scenarioName}`, `${tags}` quoted for Bash/Zsh/Fish/PowerShell/CMD.
- Never modifies files or persistent environment.

## Security & privacy

- Never auto‑executes project code; all runs are user‑initiated.
- Telemetry is opt‑in (default off) and excludes file paths/content; only anonymous feature usage counts may be sent.

## Configuration (settings)

- `cukerust.discovery.mode`: `"auto" | "static-scan" | "artifact" | "runtime-list"` (default: `"auto"`).
- `cukerust.index.path`: path to `step_index.json` (default: `docs/cukerust/step_index.json`).
- `cukerust.runMatrix.path`: path to `run_matrix.md`.
- `cukerust.goToDef.preferSingle`: boolean (default: `false`).
- `cukerust.regex.matchMode`: `"anchored" | "smart" | "substring"` (default: `"smart"`).
- `cukerust.ignoreGlobs`: array of glob strings, merged with `.gitignore`.
- `cukerust.diagnostics.enabled`: boolean (default: `true`).
- `cukerust.completion.enabled`: boolean (default: `true`).
- `cukerust.statusbar.showMode`: boolean (default: `true`).

## Commands

- CukeRust: Rebuild Step Index — re‑scan (static).
- CukeRust: Load Step Index from File… — select an artifact.
- CukeRust: List Steps via Runner — user‑confirmed runtime listing (optional).
- CukeRust: Configure Run Command for This Folder — set/edit per‑root command template.
- CukeRust: Reload Index — reloads current index source.

## Error handling

- No index available: diagnostics disabled; status bar hint explains enablement paths (scan, artifact, runtime list).
- Malformed artifact: non‑blocking warning; fall back to static scan.
- Watcher failures: logged internally; Reload Index remains available.

## Performance targets

- Cold static scan (≤15k files) should complete ≤2s; larger repos hydrate progressively.
- Incremental update should finalize ≤200ms after debounce.
- CPU usage should remain under ~50% of one core during steady‑state idle.

## Acceptance criteria (v0.2.0)

- Zero‑Config: opening a feature in a Rust BDD repo (no artifacts) produces diagnostics and go‑to‑def for detected steps.
- Artifacts Present: fresh `step_index.json` is preferred; stale artifacts show an indicator with fallback.
- Ambiguity UX: multiple matches yield inline Peek; user selection may be remembered per session.
- Scenario Outlines: diagnostics account for Examples expansion; hovers may show resolved values.
- Dialects: non‑English keywords parse; undefined/ambiguous detection still works.
- Run Helpers: with a configured or inferred command, a Run CodeLens appears and executes in the integrated terminal with shell‑safe placeholders.
- Multi‑Root: each folder uses its own index/runner; status bar can show active root and discovery mode.

## Non‑goals & constraints

- No mandatory internet access; no repository writes; no auto‑execution of project binaries.
- Does not enforce a specific Rust BDD framework; operates on patterns/artifacts only.

## Roadmap (non‑binding)

- Rust LSP backend for live discovery.
- NDJSON live decorations.
- Quick‑fix step skeleton scaffolding.
- Tag browser & coverage.
- JSON Schema validation for artifacts.

## Development & contributing

This repository currently tracks the spec for the extension. Implementation details, build instructions, and contribution guidelines will be added as the codebase is introduced.

## License

Dual-licensed under either of:

- Apache License, Version 2.0 (see `LICENSE-APACHE`)
- MIT License (see `LICENSE-MIT`)

You may choose either license at your option.
