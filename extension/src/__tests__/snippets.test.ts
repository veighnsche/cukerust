import { describe, it, expect } from 'vitest';
import { toSnippet } from '../utils';

describe('toSnippet', () => {
  it('converts numeric captures to number placeholders', () => {
    expect(toSnippet('^I have (\\d+) cukes$')).toBe('I have ${1:number} cukes');
  });
  it('converts generic captures to value placeholders', () => {
    expect(toSnippet('^eat (.+)$')).toBe('eat ${1:value}');
  });
  it('removes anchors', () => {
    expect(toSnippet('^done$')).toBe('done');
  });
});
