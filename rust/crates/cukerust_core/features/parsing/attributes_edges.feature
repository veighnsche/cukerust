Feature: Attribute macros edge cases

  Scenario: Normal, raw, and multi-hash raw attribute literals
    Given a Rust file "attr_normal.rs" with content:
      """
      #[given(regex = "^foo$")]
      fn g() {}
      """
    And a Rust file "attr_raw.rs" with content:
      """
      #[given(regex = r"^bar$")]
      fn h() {}
      """
    And a Rust file "attr_raw_quotes.rs" with content:
      """
      #[given(regex = r#"^a \"quoted\" word$"#)]
      fn i() {}
      """
    And a Rust file "attr_raw_multi.rs" with content:
      """
      #[given(regex = r###"^multi # hash$"###)]
      fn j() {}
      """
    When we extract the Step Index
    Then the index contains 4 steps
    And there is a step with kind "Given" and regex "^foo$" from file "attr_normal.rs" at line 2
    And there is a step with kind "Given" and regex "^bar$" from file "attr_raw.rs" at line 2
    And there is a step with kind "Given" and regex "^a \"quoted\" word$" from file "attr_raw_quotes.rs" at line 2
    And there is a step with kind "Given" and regex "^multi # hash$" from file "attr_raw_multi.rs" at line 2

  Scenario: Attribute extra args uses first literal
    Given a Rust file "attr_extra_args.rs" with content:
      """
      #[when(name = "FIRST", regex = "^second$")]
      fn z() {}
      """
    When we extract the Step Index
    Then the index contains 1 steps
    And there is a step with kind "When" and regex "FIRST" from file "attr_extra_args.rs" at line 2

  Scenario: Attribute without literal is ignored
    Given a Rust file "attr_no_literal.rs" with content:
      """
      #[then]
      fn t() {}
      """
    When we extract the Step Index
    Then there are no steps

  Scenario: Multi-line attribute is discovered
    Given a Rust file "attr_multiline.rs" with content:
      """
      #[given(
        regex = r"^ml$"
      )]
      fn ml() {}
      """
    When we extract the Step Index
    Then the index contains 1 steps
    And there is a step with kind "Given" and regex "^ml$" from file "attr_multiline.rs" at line 2
    And there is a step with kind "Given" and regex "^ml$" from file "attr_multiline.rs" at line 2 with function "ml"
