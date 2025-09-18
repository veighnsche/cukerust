import { describe, it, expect } from 'vitest';
import { extractRunBlocks } from '../core/run_matrix';

const doc = `
# Run Matrix

\`\`\`run
suite: cargo test -- --ignored
feature:features/sample.feature: cargo test -- --ignored --test sample
scenario:Running a sample step: cargo test -- --ignored --test sample --features one
\`\`\`

some other text

\`\`\`run
scenario:Foo: echo hi
\`\`\`
`;

describe('run_matrix extractRunBlocks', () => {
  it('extracts suite, feature and scenario entries', () => {
    const map = extractRunBlocks(doc);
    expect(map['suite']).toBeDefined();
    expect(map['feature:features/sample.feature']).toContain('cargo test');
    expect(map['scenario:Running a sample step']).toContain('--features one');
  });
  it('supports multiple code blocks and last wins for duplicate keys', () => {
    const map = extractRunBlocks(doc);
    expect(map['scenario:Foo']).toBe('echo hi');
  });
});
