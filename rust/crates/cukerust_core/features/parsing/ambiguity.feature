Feature: Ambiguity detection
  Scenario: Multiple steps with the same regex and kind are counted as ambiguous
    Given a Rust file with macro given
    And a Rust file with macro given
    When we extract the Step Index
    Then the index contains 2 steps
    And the index ambiguous count is 1
