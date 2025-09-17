Feature: Builder chains edge cases

  Scenario: Whitespace variant
    Given a Rust file "builder_ws.rs" with content:
      """
      fn f() { registry.then   (  r"^done$"  ); }
      """
    When we extract the Step Index
    Then the index contains 1 steps
    And there is a step with kind "Then" and regex "^done$" from file "builder_ws.rs" at line 2

  Scenario: Trailing comma
    Given a Rust file "builder_trailing.rs" with content:
      """
      fn f() { registry.given(r"^a$",); }
      """
    When we extract the Step Index
    Then the index contains 1 steps
    And there is a step with kind "Given" and regex "^a$" from file "builder_trailing.rs" at line 2

  Scenario: Lookalike method not discovered
    Given a Rust file "builder_lookalike.rs" with content:
      """
      fn f() { registry.given_data(r"^a$"); }
      """
    When we extract the Step Index
    Then there are no steps

  Scenario: Multiple calls on the same line are discovered
    Given a Rust file "builder_same_line.rs" with content:
      """
      fn f() { registry.given(r"^a$"); registry.when(r"^b$"); }
      """
    When we extract the Step Index
    Then the index contains 2 steps
    And there is a step with kind "Given" and regex "^a$" from file "builder_same_line.rs" at line 2
    And there is a step with kind "When" and regex "^b$" from file "builder_same_line.rs" at line 2

  Scenario: Generic builder call is discovered
    Given a Rust file "builder_generic.rs" with content:
      """
      fn f() { registry.given::<T>(r"^x$"); }
      """
    When we extract the Step Index
    Then the index contains 1 steps
    And there is a step with kind "Given" and regex "^x$" from file "builder_generic.rs" at line 2

  Scenario: Line number accuracy
    Given a Rust file "builder_line.rs" with content:
      """
      // padding
      // padding
      fn f() {
        registry.when("^eat$");
      }
      """
    When we extract the Step Index
    Then the index contains 1 steps
    And there is a step with kind "When" and regex "^eat$" from file "builder_line.rs" at line 5
