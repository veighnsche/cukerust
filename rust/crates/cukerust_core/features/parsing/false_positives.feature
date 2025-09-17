Feature: False positives and robustness

  Scenario: Commented builder call is ignored
    Given a Rust file "comment_builder.rs" with content:
      """
      // registry.given(r"^nope$");
      """
    When we extract the Step Index
    Then there are no steps

  Scenario: Unattached string does not produce steps
    Given a Rust file "unattached_string.rs" with content:
      """
      fn f() { let s = "^free$"; }
      """
    When we extract the Step Index
    Then there are no steps

  Scenario: Macro lookalike names do not produce steps
    Given a Rust file "macro_lookalikes.rs" with content:
      """
      forgiven!(r"^no$", || {}); between!(r"^no$", || {});
      """
    When we extract the Step Index
    Then there are no steps
