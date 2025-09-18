Feature: Outline
  Scenario Outline: Eating cukes
    Given I have 2 cukes
    When I eat <n>
    Then done

    Examples:
      | n |
      | 1 |
      | 2 |
