import { describe, it, expect } from 'vitest';
import { detectDialect, getDialect, buildStepKeywordRegex, extractOutlineContext, resolvePlaceholders } from '../gherkin';

const featureEn = `
Feature: Sample
  Scenario: S
    Given I have 1 cukes
`;

const featureEs = `
# language: es
Característica: Ejemplo
  Escenario: S
    Dado I have 1 cukes
`;

describe('gherkin dialects', () => {
  it('detects English by default', () => {
    expect(detectDialect(featureEn, 'auto')).toBe('en');
  });
  it('detects Spanish from header', () => {
    expect(detectDialect(featureEs, 'auto')).toBe('es');
  });
  it('builds a keyword regex that matches steps', () => {
    const d = getDialect('es');
    const re = buildStepKeywordRegex(d);
    const m = re.exec('    Dado I have 1 cukes');
    expect(m).toBeTruthy();
    expect(m?.[1]).toBe('Dado');
    expect(m?.[2]).toBe('I have 1 cukes');
  });
});

describe('scenario outlines', () => {
  const outline = `
Feature: F
  Scenario Outline: Eating
    When I eat <n>
    Then done

    Examples:
      | n |
      | 1 |
      | 2 |
`;
  it('extracts Examples table rows', () => {
    // line index pointing to the When line (3rd line zero-based index 3?)
    const oc = extractOutlineContext(outline, 3);
    expect(oc.isOutline).toBe(true);
    expect(oc.header).toEqual(['n']);
    expect(oc.examples.length).toBe(2);
  });
  it('resolves placeholders with a row', () => {
    const body = 'I eat <n>';
    const row = { n: '5' } as Record<string, string>;
    expect(resolvePlaceholders(body, row)).toBe('I eat 5');
  });
});
