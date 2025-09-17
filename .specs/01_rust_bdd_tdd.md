# Rust BDD/TDD for CukeRust (cukerust_core)

This document describes how we develop the Rust core of CukeRust using Behavior‑Driven Development (BDD) with Gherkin and the `cucumber` crate. It defines directory layout, dependencies, conventions, example scenarios, and execution commands.

## Scope

- Applies to `rust/crates/cukerust_core` (pure logic). The WASM wrapper (`cukerust_wasm`) remains thin and may use `wasm-bindgen-test` or black‑box tests via TS.
- Drives the shape and semantics of the Step Index described in `.specs/00_cukerust.md`.

## Goals

- Make behaviors explicit in Gherkin so they are readable and verifiable.
- Keep core algorithms deterministic, pure, and unit‑testable.
- Ensure parity between features, step definitions, and the Step Index JSON contract.

## Directory layout

```
rust/
  crates/
    cukerust_core/
      features/
        parsing/
          attributes.feature
          builder_chains.feature
          macros.feature
          raw_strings.feature
          ambiguity.feature
      tests/
        bdd.rs         # cucumber test harness (tokio)
      src/
        lib.rs         # core logic (no I/O)
```

## Dependencies

Add to `rust/crates/cukerust_core/Cargo.toml` (as dev‑dependencies):

```toml
[dev-dependencies]
cucumber = { version = "0.21", features = ["lib"] }
tokio = { version = "1", features = ["rt-multi-thread", "macros"] }
serde = { version = "1", features = ["derive" ] }
serde_json = "1"
```

Note: Versions may be adjusted to latest compatible.

## Test harness

Example `tests/bdd.rs`:

```rust
use cucumber::World;
use futures::FutureExt;
use std::path::PathBuf;

#[derive(Debug, Default, World)]
pub struct CoreWorld {
    // add shared state if needed
}

#[tokio::main]
async fn main() {
    // Run all features under features/ directory
    CoreWorld::cucumber()
        .after(|_feature, _rule, _scenario, _status| async move {
            // per-scenario cleanup if needed
        }.boxed())
        .run_and_exit(PathBuf::from("features"))
        .await;
}
```

## Step definition modules

- Organize steps by domain: `tests/steps/parsing.rs`, `tests/steps/matching.rs`, etc.
- Register modules in `bdd.rs` with `CoreWorld::cucumber().with_steps(parsing::steps())` patterns (depending on chosen API style).

Example step skeleton (parsing):

```rust
use cucumber::{then, given, when};

#[given(regex = r"^a Rust file with attribute (given|when|then)$")]
fn has_attribute() {
    // setup or record input text
}

#[when("we extract the Step Index")]
fn extract_index() {
    // call into core extraction helpers
}

#[then(regex = r"^the index contains (\d+) steps$")]
fn index_count() {
    // assert on resulting index
}
```

Depending on the chosen cucumber API version, macro names and wiring may vary (adjust as needed).

## Example feature

`features/parsing/attributes.feature`

```gherkin
Feature: Parse attribute macros into Step Index
  Scenario: Given/When/Then attributes with raw strings
    Given a Rust file with attribute given
    And a Rust file with attribute when
    And a Rust file with attribute then
    When we extract the Step Index
    Then the index contains 3 steps
```

## Conventions

- Keep feature text tightly coupled to Step Index semantics (kinds, regex normalization, file:line mapping).
- Prefer deterministic examples with small inline fixtures.
- Use scenario tags to filter runs where helpful, e.g. `@raw_strings`.

## Running tests

- Run only BDD: `cargo test -p cukerust_core --test bdd`
- Run everything: `cargo test --workspace`

## CI integration

- The existing CI `rust` job runs `cargo test --workspace`. Add a separate job or step for feature runs if filtering is desired.

## Relationship to Step Index spec

- This BDD suite verifies the behaviors expected by `.specs/00_cukerust.md` (shape, fields, normalization rules).
- Any changes to Step Index semantics should be accompanied by updated features and step definitions.
