Feature: Sample
  Scenario: Index count basic
    Given index has 3 steps
    When noop
    Then the index contains 3 steps
