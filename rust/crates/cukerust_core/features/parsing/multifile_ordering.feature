Feature: Multi-file ordering

  Scenario: Steps are ordered by file then line
    Given a Rust file "z.rs" with content:
      """
      // padding
      given!(r"^z$", || {});
      """
    And a Rust file "a.rs" with content:
      """
      // padding
      // padding
      when!(r"^a$", || {});
      """
    When we extract the Step Index
    Then the index contains 2 steps
    And steps are ordered by file then line
