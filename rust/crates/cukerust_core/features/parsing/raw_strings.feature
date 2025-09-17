Feature: Parse raw strings
  Scenario: Raw string forms are parsed
    Given a Rust file with raw string pattern
    And a Rust file with raw string pattern (multi)
    When we extract the Step Index
    Then the index contains 2 steps
