export type StepKind = 'Given' | 'When' | 'Then';

export interface StepEntry {
  kind: StepKind;
  regex: string;
  file: string; // relative path
  line: number; // 1-based
  function?: string;
  captures?: string[];
  tags?: string[];
  notes?: string;
}

export interface StepIndexStats {
  total: number;
  by_kind: { Given: number; When: number; Then: number } | { given: number; when: number; then: number };
  ambiguous: number;
  generated_at?: string;
}

export interface StepIndex {
  steps: StepEntry[];
  stats: StepIndexStats;
}

export interface SourceFileInput {
  path: string;
  text: string;
}
