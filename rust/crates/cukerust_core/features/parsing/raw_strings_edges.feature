Feature: Raw string handling edge cases

  Scenario: Quotes inside raw string are preserved
    Given a Rust file "raw_quotes.rs" with content:
      """
      registry.when(r#"^a \"quoted\" word$"#);
      """
    When we extract the Step Index
    Then the index contains 1 steps
    And there is a step with kind "When" and regex "^a \"quoted\" word$" from file "raw_quotes.rs" at line 2

  Scenario: Multiple literals in one call uses the first literal
    Given a Rust file "raw_multi_literal.rs" with content:
      """
      given!(r"^a$", r"^b$", || {});
      """
    When we extract the Step Index
    Then the index contains 1 steps
    And there is a step with kind "Given" and regex "^a$" from file "raw_multi_literal.rs" at line 2

  Scenario: Unterminated raw string is ignored
    Given a Rust file "raw_unterminated.rs" with content:
      """
      registry.when(r#"^unterminated$);
      """
    When we extract the Step Index
    Then there are no steps

  Scenario: Mixed normal and raw chooses the first literal
    Given a Rust file "raw_mixed.rs" with content:
      """
      registry.when("^n$", r"^r$");
      """
    When we extract the Step Index
    Then the index contains 1 steps
    And there is a step with kind "When" and regex "^n$" from file "raw_mixed.rs" at line 2
