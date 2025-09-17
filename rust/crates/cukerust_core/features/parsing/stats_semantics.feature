Feature: Statistics and ambiguity semantics

  Scenario: Stats reflect totals, by_kind, and ambiguity clusters across files
    Given a Rust file "dup1.rs" with content:
      """
      given!(r"^dup$", || {});
      """
    And a Rust file "dup2.rs" with content:
      """
      given!(r"^dup$", || {});
      """
    And a Rust file "uniq.rs" with content:
      """
      when!(r"^uniq$", || {});
      """
    And a Rust file "then.rs" with content:
      """
      then!(r"^th$", || {});
      """
    When we extract the Step Index
    Then the index contains 4 steps
    And the index has Given, When, Then kinds counted
    And the index ambiguous count is 1
