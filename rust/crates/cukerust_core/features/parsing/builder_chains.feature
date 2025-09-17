Feature: Parse builder chains into Step Index
  Scenario: .given/.when/.then patterns
    Given a Rust file with builder given
    And a Rust file with attribute when
    And a Rust file with macro then
    When we extract the Step Index
    Then the index contains 3 steps
    And the index has Given, When, Then kinds counted
