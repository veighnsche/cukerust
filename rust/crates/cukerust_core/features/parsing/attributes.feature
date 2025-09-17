Feature: Parse attribute macros into Step Index
  Scenario: Given/When/Then attributes with raw strings
    Given a Rust file with attribute given
    And a Rust file with attribute when
    And a Rust file with attribute then
    When we extract the Step Index
    Then the index contains 3 steps
    And the index has Given, When, Then kinds counted
