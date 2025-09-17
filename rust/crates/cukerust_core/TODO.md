# cukerust_core — BDD Test Plan and TODO

This file tracks an exhaustive set of Gherkin tests and behaviors for the Rust core parsing/indexing logic that powers the VS Code extension. The goal is full coverage of supported patterns and well-documented limits for anything not yet supported.

Directories

- Features: `rust/crates/cukerust_core/features/`
- Step defs: `rust/crates/cukerust_core/tests/steps/`
- Harness: `rust/crates/cukerust_core/tests/bdd.rs`

Status summary

- [x] Attribute macros baseline (same-line) — `parsing/attributes.feature`
- [x] Builder chains baseline — `parsing/builder_chains.feature`
- [x] Macros baseline — `parsing/macros.feature`
- [x] Raw strings baseline — `parsing/raw_strings.feature`
- [x] Ambiguity count (duplicate (kind, regex)) — `parsing/ambiguity.feature`

Planned additions (Gherkin scenarios to add)

1) Attribute macros — breadth & edge cases

- [x] Attribute with normal string (e.g., `regex = "^foo$"`)
- [x] Attribute with raw string `r"^foo$"`
- [x] Attribute with raw string `r#"a \"quoted\" word"#`
- [x] Attribute with multi-hash raw string `r###"multi # hash"###`
- [x] Multiple attributes on consecutive lines (each discovered)
- [x] Attribute with extra arguments where `regex` is present but not first (first string literal used)
- [x] Attribute without any string literal (ignored)
- [x] Attribute spanning multiple lines (supported)
- [x] Attribute with escaped normal string (e.g., `"hello\nworld"` unescapes correctly)
- [x] Line number accuracy for attribute-derived steps

Feature file to add: `parsing/attributes_edges.feature`

2) Builder chains — breadth & edge cases

- [x] `.given(r"^I have (\\d+) cukes$")` (raw)
- [x] `.when("^I eat (.*)$")` (normal)
- [x] Whitespace tolerance: `.then   (  r"^done$"  )`
- [x] Trailing comma inside call: `.given(r"^a$",)`
- [x] Method name lookalikes should NOT match: `.given_data(r"^a$")`
- [x] Multiple builder calls on different lines are all discovered
- [x] Multiple builder calls on the same line are discovered
- [x] Generic method call (e.g., `.given::<T>(r"^x$")`) is discovered
- [x] Line number accuracy for builder-derived steps

Feature file to add: `parsing/builder_edges.feature`

3) Macros — breadth & edge cases

- [x] `given!(r"^start$", || {});` (baseline)
- [x] `when!("^middle$", || {});` (normal string)
- [x] Macro with additional arguments (only first literal parsed)
- [x] Macro names with module path, e.g., `my::given!(r"^x$")` (match)
- [x] Macro-like names that should NOT match (e.g., `forgiven!`, `between!`)
- [x] Macro literal via variable (e.g., `let s = r"^x$"; given!(s, || {});`) not discovered
- [x] Multiple macro calls on the same line are discovered
- [x] Line number accuracy for macro-derived steps

Feature file to add: `parsing/macros_edges.feature`

4) Raw string handling — deep cases

- [x] Quotes inside raw strings preserved exactly
- [x] Multiple raw literals in a single line — only the first literal is captured per call site
- [x] Unterminated raw string is ignored (no panic)
- [x] Mixed normal + raw on the same line (first literal wins)

Feature file to add: `parsing/raw_strings_edges.feature`

5) Statistics & ambiguity semantics

- [x] `stats.total` equals number of discovered steps
- [x] `stats.by_kind` counts correct per kind
- [x] `stats.ambiguous` counts duplicate clusters of identical (kind, regex)
- [x] Duplicates across different files are treated as ambiguous

Feature file to add: `parsing/stats_semantics.feature`

6) False positives & robustness

- [x] Comments containing step-like text are ignored
- [x] Strings in unrelated contexts (e.g., logging) are ignored unless preceded by a recognized call/attribute
- [x] Builder lookalikes, macro lookalikes, attribute lookalikes are not matched

Feature file to add: `parsing/false_positives.feature`

7) Multi-file inputs & ordering

- [x] Stable sort `(file, line)` ordering in `StepIndex::from_steps`
- [x] Mixed files contributing to the same index produce expected stats and order

Feature file to add: `parsing/multifile_ordering.feature`

Step definitions work plan

- Extend `tests/steps/parsing.rs` with helpers to compose multiple `SourceFile{ path, text }` payloads.
- Add new `#[given]` steps for each fixture pattern above (attributes_edges, builder_edges, macros_edges, raw_strings_edges, false_positives, multifile_ordering, stats_semantics).
- Reuse existing `#[when] we extract the Step Index` and `#[then]` assertions; add new `#[then]` steps for line accuracy, ordering, false-positive checks, and failure expectations where applicable.

Known limitations to document (and optionally address later)

- `function` is populated best-effort for attribute-based steps only; builder/macro steps keep `function: None`.
- `captures`, `tags`, and `notes` fields are not populated by the core extractor.
- Attribute/macro/builder detection remains regex-based (not AST); extremely exotic formatting could evade detection.

Execution

- Run all BDD features:
  - `cd rust && cargo test -p cukerust_core --test bdd -- --nocapture`
- Target a single feature directory/file:
  - `cd rust && CUKERUST_BDD_FEATURE_PATH=crates/cukerust_core/features/parsing cargo test -p cukerust_core --test bdd -- --nocapture`

Milestones

- [x] M1: Edges for attributes, builders, macros (features + steps + green)
- [x] M2: Raw string deep cases and false positives
- [x] M3: Multifile ordering and stats semantics
- [x] M4: Optional parser improvements (comments, multi-line attributes, generics, multi-call per line) with gated tests

Detailed acceptance criteria (by feature file)

attributes_edges.feature

- [x] Given files contain attribute macros with normal, raw, and multi-hash raw strings
- [x] When we extract the Step Index
- [x] Then steps exist for each attribute literal and line numbers match their source lines
- [x] And attributes without a string literal are ignored (no step produced)
- [x] And attributes with extra args use the first string literal (documented behavior)
- [x] And multi-line attributes are discovered and function name captured
- [x] And escaped sequences in normal strings are unescaped (e.g., \n)

builder_edges.feature

- [x] Given files contain `.given/.when/.then` calls with whitespace variance
- [x] When we extract the Step Index
- [x] Then each call produces a step entry with the correct kind and line number
- [x] And lookalike methods (e.g., `.given_data`) are not discovered
- [x] And trailing comma cases are handled per current extractor behavior (documented)
- [x] And multiple calls on the same line are discovered
- [x] And generic method calls `.given::<T>(...)` are discovered

macros_edges.feature

- [x] Given files contain `given!/when!/then!` macro uses with normal and raw literals
- [x] When we extract the Step Index
- [x] Then each macro produces a step with correct kind and line number
- [x] And `my::given!(...)` (module path) is discovered
- [x] And macro-like names such as `forgiven!` / `between!` are not discovered
- [x] And only the first string literal in the macro arg list is used
- [x] And macro calls with variables instead of literals are not discovered (documented limit)
- [x] And multiple macro calls on the same line are discovered

raw_strings_edges.feature

- [ ] Given files contain raw string literals with quotes inside and varying hash counts
- [ ] When we extract the Step Index
- [ ] Then extracted regex content preserves exact inner text for raw strings
- [ ] And unterminated raw strings do not panic and are ignored
- [ ] And if both normal and raw literals appear on the same line, the first literal is used

stats_semantics.feature

- [ ] Given multiple files contribute overlapping and unique (kind, regex) pairs
- [ ] When we extract the Step Index
- [ ] Then `stats.total` equals the number of entries in `steps`
- [ ] And `stats.by_kind` counts are correct per kind
- [ ] And `stats.ambiguous` equals the number of duplicate clusters of identical (kind, regex) pairs
- [ ] And duplicates across different files are counted as ambiguous

false_positives.feature

- [ ] Given files contain comments and unrelated strings with step-like text
- [ ] When we extract the Step Index
- [ ] Then no steps are produced from lookalike method names or macro names
- [ ] And strings not attached to recognized calls/attributes do not produce steps
- [ ] And any current false positives are captured and documented (as known limits)

multifile_ordering.feature

- [ ] Given multiple files contribute step definitions on varying line numbers
- [ ] When we extract the Step Index
- [ ] Then `steps` are sorted by `(file, line)`
- [ ] And the resulting order is stable across runs

Scaffolding checklist

- [x] `features/parsing/attributes_edges.feature`
- [x] `features/parsing/builder_edges.feature`
- [x] `features/parsing/macros_edges.feature`
- [x] `features/parsing/raw_strings_edges.feature`
- [x] `features/parsing/stats_semantics.feature`
- [x] `features/parsing/false_positives.feature`
- [x] `features/parsing/multifile_ordering.feature`

New/extended step definitions (tests/steps/parsing.rs)

- [x] Given a Rust file with attribute having normal/raw/multi-hash raw string (DocString-powered)
- [x] Given a Rust file with attribute extra args (first literal used)
- [x] Given a Rust file with multi-line attribute
- [x] Given a Rust file with builder calls (whitespace variance)
- [x] Given a Rust file with builder lookalike (negative)
- [x] Given a Rust file with builder trailing comma
- [x] Given a Rust file with builder generic call
- [x] Given a Rust file with macro module path (`my::given!`)
- [x] Given a Rust file with macro lookalike names (negative)
- [x] Given a Rust file with macro extra args (first literal used)
- [x] Given a Rust file with macro literal via variable (negative)
- [x] Given multiple Rust files contributing steps
- [x] Then the index contains N steps
- [x] Then the index has Given, When, Then kinds counted
- [x] Then the index ambiguous count is N
- [x] Then the step list is ordered by `(file, line)`
- [x] Then the step at position K matches `{ kind, regex, file, line }`

Optional parser improvements (if implemented, add gated tests)

- [ ] Strip comments prior to detection to reduce false positives
- [ ] Support multi-line attributes
- [ ] Support generic builder calls `.given::<T>(...)`
- [ ] Detect multiple calls on the same line (iterate tokens, not just first literal)

Developer tips

- Use `CUKERUST_BDD_FEATURE_PATH` to target a specific feature or folder during iteration
- Prefer small atomic commits per scenario set; keep expected/actual text in the feature for clarity
- For tricky raw-string cases, add unit tests under `src/step_index.rs` alongside BDD scenarios

Definition of Done (cukerust_core)

- [ ] All edge-case feature files above exist with scenarios implemented
- [ ] Step definitions cover all Given/When/Then listed and reuse shared assertions
- [ ] `cargo test -p cukerust_core --test bdd` passes locally and on CI
- [ ] Documented limits reflected both in features (negative assertions) and in `.docs/05_all_testing requirements.md`
- [ ] Any parser improvements added have gated tests and do not regress performance
