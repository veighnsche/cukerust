Feature: Macros edge cases

  Scenario: Normal string macro
    Given a Rust file "macro_normal.rs" with content:
      """
      when!("^middle$", || {});
      """
    When we extract the Step Index
    Then the index contains 1 steps
    And there is a step with kind "When" and regex "^middle$" from file "macro_normal.rs" at line 2

  Scenario: Module-path macro
    Given a Rust file "macro_module.rs" with content:
      """
      my::given!(r"^x$", || {});
      """
    When we extract the Step Index
    Then the index contains 1 steps
    And there is a step with kind "Given" and regex "^x$" from file "macro_module.rs" at line 2

  Scenario: Macro lookalike names not discovered
    Given a Rust file "macro_lookalike.rs" with content:
      """
      forgiven!(r"^no$", || {}); between!(r"^no$", || {});
      """
    When we extract the Step Index
    Then there are no steps

  Scenario: Macro with variable literal not discovered
    Given a Rust file "macro_variable.rs" with content:
      """
      fn f() { let s = r"^x$"; given!(s, || {}); }
      """
    When we extract the Step Index
    Then there are no steps

  Scenario: Multiple macros on same line are discovered
    Given a Rust file "macro_same_line.rs" with content:
      """
      given!(r"^a$", || {}); when!(r"^b$", || {});
      """
    When we extract the Step Index
    Then the index contains 2 steps
    And there is a step with kind "Given" and regex "^a$" from file "macro_same_line.rs" at line 2
    And there is a step with kind "When" and regex "^b$" from file "macro_same_line.rs" at line 2
