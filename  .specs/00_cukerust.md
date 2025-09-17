# CukeRust — VSCode Extension Specification (Zero‑Config First, RFC‑2119)

## 0. Status & Audience

* **Status:** Draft v0.2.0 (supersedes prior drafts; stable for implementation).
* **Audience:** VS Code extension developers (TypeScript), Rust BDD maintainers, CI owners, repo maintainers, QA.

## 1. Purpose & Scope

**Purpose.** Deliver first‑class **Gherkin** authoring and **Rust** step integration in VS Code with **zero configuration** and **no repository writes**. The extension must be productive out‑of‑the‑box via static scanning, while allowing optional artifacts or runtime listing to enhance fidelity.

**In‑scope (v0.2.0):**

* Diagnostics (undefined/ambiguous) in `*.feature` files.
* Go‑to‑definition from steps → Rust source locations.
* Step completion + hovers (regex‑derived snippets and metadata).
* Run helpers (CodeLens/commands) with per‑root command mapping.
* Multi‑root workspaces; performance and debouncing; Gherkin dialects; Scenario Outlines.

**Out‑of‑scope (v0.2.0):**

* Live decorations via Cucumber Messages/NDJSON.
* Code generation (step skeletons).
* AST‑accurate Rust parsing or executing project code by default.

## 2. RFC‑2119 Conventions

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are to be interpreted as described in RFC‑2119.

## 3. Architectural Principles

1. **Zero‑Config First.** The extension **MUST** function without any repo‑provided artifacts or commands configured.
2. **Read‑Only by Default.** The extension **MUST NOT** modify repository files or execute project code without explicit user action.
3. **Pluggable Discovery.** The extension **MUST** support multiple discovery modes with a fixed priority order (§4). Users **MAY** override via settings.
4. **Fail‑Safe Degradation.** On missing/malformed data, the extension **MUST** gracefully degrade (reduced features) and **MUST NOT** disrupt editing.
5. **Performance & Scale.** Indexing **MUST** be incremental, debounced, and respect ignore rules to avoid extension‑host stalls in large repos.

## 4. Discovery Modes & Priority

The extension **MUST** select the first viable mode in this order (unless user overrides):

1. **Static Scan (Default, Zero‑Config).**

   * The extension **MUST** statically scan workspace files for step definitions **without executing code**.
   * It **SHOULD** detect common Rust BDD patterns:

     * Attribute macros: `#[given(...)]`, `#[when(...)]`, `#[then(...)]` (including string/regex arguments and raw string forms).
     * Builder/registry chains: `.given(r"…")`, `.when(r"…")`, `.then(r"…")`.
     * Macros: `given!(r"…", …)`, etc.
   * It **MUST** extract `{ kind, regex, file, line, function? }` and build an in‑memory Step Index.

2. **Artifact Mode (Optional).**

   * If `docs/cukerust/step_index.json` exists, the extension **MAY** load it and **SHOULD** prefer it as authoritative **if not stale** (§8.4).
   * Unknown fields **MUST** be ignored; missing optional fields **MUST** be tolerated.

3. **Runtime‑List Mode (Opt‑in, User‑Initiated).**

   * The extension **MAY** expose a command to execute a user‑approved runner (e.g., `cargo test -- --list-steps` or custom bin) to emit a step list.
   * The extension **MUST NOT** run project code automatically; first run **MUST** prompt for confirmation per workspace folder.

4. **Rust LSP Backend (Future).**

   * Reserved for v0.3+; non‑binding here.

## 5. Inputs & Data Contracts (All Optional)

### 5.1 Step Index (Artifact Mode)

* **Location:** `docs/cukerust/step_index.json`
* **Contract:**

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

* Loaders **MUST** ignore unknown fields and **MUST** proceed best‑effort if some entries are invalid (§12.3).

### 5.2 Run Matrix (Optional)

* **Location:** `docs/cukerust/run_matrix.md`
* **Contract:** The extension **SHOULD** parse fenced code blocks to discover runnable commands:

  * Run entire suite; run single feature; run by scenario name; run by tags (if present).
* If absent, a default heuristic **MAY** be used (§10.1), subject to first‑run confirmation.

### 5.3 Advisory Files (Optional)

* `docs/cukerust/survey.json`, `docs/cukerust/tags.json`, `docs/cukerust/recommendations.md` **MAY** enrich UX but **MUST NOT** be required.

## 6. Language Features

### 6.1 Diagnostics (Undefined / Ambiguous)

* For each step line in `*.feature`, the extension **MUST** attempt to match the normalized step text (§7.1) against the active Step Index.
* **Undefined:** zero matches → diagnostic **MUST** be shown.
* **Ambiguous:** more than one match → diagnostic **MUST** be shown.
* Diagnostics **SHOULD** update on document change and on index updates (file watch or manual reload).
* **Noise Control:** While a line is being edited, undefined diagnostics **SHOULD** be downgraded to *Information* and **MUST** be debounced ≥300ms.

### 6.2 Go‑to‑Definition

* Invoking *Go to Definition* on a step line **MUST** open the best match’s `file:line`.
* If multiple matches exist, the extension **MUST** show an inline *Peek* with candidates and **MAY** remember the user’s choice for the session (per `(featurePath, stepText)`), reversible via a status bar action.

### 6.3 Completion

* While editing a step, the extension **SHOULD** offer completion items from known regex patterns.
* Captures **SHOULD** be converted to snippet placeholders (e.g., `(
  \d+)` → `${1:number}`, generic → `${1:value}`).
* Duplicate regex **SHOULD** be de‑duplicated across kinds where semantically equivalent.

### 6.4 Hover

* Hovering a step **SHOULD** display: `kind`, normalized `regex`, `function?`, `file:line`, and presence of DataTable/DocString if detected.

### 6.5 Scenario Outlines & Examples

* The parser **MUST** expand Examples rows logically for diagnostics.
* Hovers **SHOULD** show resolved placeholder values when the cursor is within an expanded example context.

### 6.6 Gherkin Dialects

* The extension **MUST** support official Gherkin dialects for keywords (`Feature`, `Scenario`, `Given/When/Then/And/But`).
* A workspace setting **MAY** override or pin the dialect; auto‑detect **SHOULD** fall back to English if uncertain.

## 7. Matching Semantics

### 7.1 Normalization

* Before matching, the extension **MUST** remove the leading Gherkin keyword and one following space from the step line and **MUST** infer `And/But` kind from the most recent explicit keyword above.

### 7.2 Regex Handling & Tiers

* Patterns **MUST** be treated as standard regex; raw string notations (e.g., `r"…"`, `r#"…"#`) **MUST** be normalized.
* Matching **MUST** implement tiered policy:

  1. **Anchored:** full‑line match; respect `^`/`$`.
  2. **Smart:** if pattern has anchors → full‑line; else attempt full‑line with implicit anchors.
  3. **Relaxed:** allow substring match as a last resort.
* When a fallback tier is used, the extension **SHOULD** render a subtle gutter hint indicating the tier.

### 7.3 Ambiguity

* On multiple matches, the extension **MUST** surface an *Ambiguous Step* diagnostic.
* Go‑to‑definition **MUST** offer an inline Peek selector; `preferSingle` setting may auto‑pick the first, but a status message **SHOULD** indicate ambiguity.

## 8. Index Management

### 8.1 Static Scan

* The scanner **MUST** respect `.gitignore` and `cukerust.ignoreGlobs` settings.
* Initial scan for ≤15k files **SHOULD** finish ≤2s on a modern dev machine; larger repos **SHOULD** hydrate progressively in idle time.
* Incremental updates **SHOULD** complete ≤200ms per change (debounced ≥100ms).

### 8.2 Multi‑Root

* Each workspace folder **MUST** maintain an independent Step Index and Runner Map.
* Feature files **MUST** resolve to the nearest folder’s index.
* The status bar **SHOULD** display the active root for the current document.

### 8.3 Best‑Effort Loading

* When loading an artifact index, invalid entries **MUST** be skipped with a non‑blocking summary warning; the remainder **MUST** still power features.

### 8.4 Artifact Staleness

* If using `step_index.json`, the extension **MUST** detect staleness (e.g., any referenced file `mtime` newer than `generated_at` or the index file’s `mtime`).
* When stale, the extension **MUST** surface a staleness indicator and **MUST** allow one‑click fallback to Static Scan mode.

## 9. UI & UX

* Diagnostics **MUST** not exceed 5 refreshes/second per document.
* Ambiguity selection **SHOULD** use inline Peek rather than modal dialog.
* A status bar item **SHOULD** show discovery mode (Static/Artifact/Runtime) and active root.
* *Reload Index* command **MUST** be available.

## 10. Run/Debug Integration

### 10.1 Resolution

* If `run_matrix.md` is present, commands **SHOULD** be used verbatim; if multiple per root, the nearest path prefix **MUST** be chosen.
* If absent, the extension **MAY** infer a default per folder (heuristic):

  * If a crate has `tests/bdd_main.rs` or a `features/` directory, prefer:

    * `cargo test -p <crate> -- --nocapture` (feature‑path filters applied only if supported by repo conventions).
* First execution per folder **MUST** prompt for confirmation and **MAY** persist a trusted command template.

### 10.2 Execution

* Commands **MUST** run in the integrated terminal.
* Placeholders **MUST** be shell‑aware:

  * `${featurePath}`, `${scenarioName}`, `${tags}` quoted appropriately for Bash/Zsh/Fish/PowerShell/CMD.
* The extension **MUST NOT** modify files or persistent environment.

## 11. Security & Privacy

* The extension **MUST NOT** auto‑execute project code; all runs are user‑initiated.
* Telemetry **MUST** be opt‑in (default off) and **MUST NOT** include file paths or content; only anonymous feature usage counts **MAY** be sent.

## 12. Configuration & Commands

### 12.1 Settings (All Optional)

* `cukerust.discovery.mode`: `"auto" | "static-scan" | "artifact" | "runtime-list"` (default: `"auto"`).
* `cukerust.index.path`: path to `step_index.json` (default: `docs/cukerust/step_index.json`).
* `cukerust.runMatrix.path`: path to `run_matrix.md`.
* `cukerust.goToDef.preferSingle`: boolean (default: `false`).
* `cukerust.regex.matchMode`: `"anchored" | "smart" | "substring"` (default: `"smart"`).
* `cukerust.ignoreGlobs`: array of glob strings, merged with `.gitignore`.
* `cukerust.diagnostics.enabled`: boolean (default: `true`).
* `cukerust.completion.enabled`: boolean (default: `true`).
* `cukerust.statusbar.showMode`: boolean (default: `true`).

### 12.2 Commands

* `CukeRust: Rebuild Step Index` — Re‑scan (static).
* `CukeRust: Load Step Index from File…` — Select an artifact.
* `CukeRust: List Steps via Runner` — User‑confirmed runtime listing (optional).
* `CukeRust: Configure Run Command for This Folder` — Set/edit per‑root command template.
* `CukeRust: Reload Index` — Reloads current index source.

### 12.3 Public Extension API (Power Users)

* `cukerust.loadIndex(uri)` **SHOULD** be exposed to load an external index.
* `cukerust.setRunner(root, commandTemplate)` **SHOULD** set per‑root runner at runtime.

## 13. Error Handling

* **No index available:** diagnostics disabled; status bar hint **SHOULD** explain enablement paths (scan, artifact, runtime list).
* **Malformed artifact:** show non‑blocking warning; fall back to static scan.
* **Watcher failures:** log internally; `Reload Index` **MUST** remain available.

## 14. Performance Targets

* Cold static scan (≤15k files) **SHOULD** complete ≤2s; larger repos progressively hydrate.
* Incremental update **SHOULD** finalize ≤200ms after debounce.
* CPU usage **SHOULD** remain under 50% of one core during steady‑state idle.

## 15. Acceptance Criteria

1. **Zero‑Config:** In a repo with Rust BDD patterns and `.feature` files but no artifacts, opening a feature **MUST** produce diagnostics and go‑to‑def for detected steps.
2. **Artifacts Present:** If `step_index.json` exists and is fresh, it **MUST** be preferred over scan; if stale, a visible indicator **MUST** appear with one‑click fallback.
3. **Ambiguity UX:** Multiple matches **MUST** yield an inline Peek selector; user selection **MAY** be remembered for the session.
4. **Scenario Outlines:** Diagnostics **MUST** account for Examples expansion; hovers **SHOULD** show resolved values.
5. **Dialects:** Non‑English keywords **MUST** parse; undefined/ambiguous detection **MUST** still function.
6. **Run Helpers:** With a configured or inferred command, a Run CodeLens **SHOULD** appear and **MUST** execute in the integrated terminal with shell‑safe placeholders.
7. **Multi‑Root:** Each folder **MUST** use its own index and runner; status bar **SHOULD** show active root and discovery mode.

## 16. Non‑Goals & Constraints

* No mandatory internet access; no repository writes; no auto‑exec of project binaries.
* Do not enforce a specific Rust BDD framework; operate on patterns/artifacts only.

## 17. Extensibility (Non‑Binding, Future)

* Rust LSP backend for live discovery; NDJSON live decorations; quick‑fix step skeleton scaffolding; tag browser & coverage; JSON Schema validation for artifacts.

## 18. Appendix — Advisory JSON Schema (Optional)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "CukeRust Step Index",
  "type": "object",
  "required": ["steps"],
  "properties": {
    "steps": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["kind", "regex", "file", "line"],
        "properties": {
          "kind": { "enum": ["Given", "When", "Then", "Step"] },
          "regex": { "type": "string" },
          "file": { "type": "string" },
          "line": { "type": "integer", "minimum": 1 },
          "function": { "type": "string" },
          "captures": { "type": "array", "items": { "type": "string" } },
          "tags": { "type": "array", "items": { "type": "string" } },
          "notes": { "type": "string" }
        },
        "additionalProperties": true
      }
    },
    "stats": {
      "type": "object",
      "properties": {
        "total": { "type": "integer", "minimum": 0 },
        "by_kind": {
          "type": "object",
          "properties": {
            "Given": { "type": "integer", "minimum": 0 },
            "When": { "type": "integer", "minimum": 0 },
            "Then": { "type": "integer", "minimum": 0 }
          },
          "additionalProperties": true
        },
        "ambiguous": { "type": "integer", "minimum": 0 },
        "generated_at": { "type": "string", "format": "date-time" }
      },
      "additionalProperties": true
    }
  },
  "additionalProperties": true
}
```
