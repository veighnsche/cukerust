import * as vscode from 'vscode';
import type { StepEntry, StepIndex, SourceFileInput } from './types';

export class StepIndexManager {
  private indexes = new Map<string, StepIndex>(); // key: workspace folder fsPath
  private wasmModule: any | null = null;
  private diag = vscode.languages.createDiagnosticCollection('cukerust');

  constructor(private context: vscode.ExtensionContext) {}

  async ensureWasm(): Promise<any> {
    if (!this.wasmModule) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.wasmModule = await import('../native/cukerust-wasm');
    }
    return this.wasmModule;
  }

  getIndex(folder: vscode.WorkspaceFolder | null): StepIndex | undefined {
    if (!folder) return undefined;
    return this.indexes.get(folder.uri.fsPath);
  }

  async rebuildAll(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    for (const f of folders) {
      await this.rebuildForFolder(f);
    }
  }

  async rebuildForFolder(folder: vscode.WorkspaceFolder): Promise<void> {
    const mode = vscode.workspace.getConfiguration('cukerust', folder).get<'auto'|'static-scan'|'artifact'|'runtime-list'>('discovery.mode', 'auto');
    if (mode === 'artifact' || mode === 'auto') {
      const loaded = await this.tryLoadArtifact(folder);
      if (loaded) return; // prefer artifact if fresh
      if (mode === 'artifact') return; // artifact requested but not present; leave empty
    }
    // Static scan
    const wasm = await this.ensureWasm();
    const include = new vscode.RelativePattern(folder, '**/*.rs');
    const rustFiles = await vscode.workspace.findFiles(include, '**/target/**', 5000);
    const inputs: SourceFileInput[] = [];
    for (const uri of rustFiles) {
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        const text = new TextDecoder('utf-8').decode(bytes);
        const rel = folder ? vscode.workspace.asRelativePath(uri, false) : uri.fsPath;
        inputs.push({ path: rel, text });
      } catch {
        // ignore read failures
      }
    }
    const payload = JSON.stringify({ files: inputs });
    const result = wasm.extract_step_index(payload);
    const index: StepIndex = JSON.parse(result);
    this.indexes.set(folder.uri.fsPath, index);
  }

  private async tryLoadArtifact(folder: vscode.WorkspaceFolder): Promise<boolean> {
    const cfgPath = vscode.workspace.getConfiguration('cukerust', folder).get<string>('index.path', 'docs/cukerust/step_index.json');
    const artifact = vscode.Uri.joinPath(folder.uri, cfgPath);
    try {
      const stat = await vscode.workspace.fs.stat(artifact);
      const bytes = await vscode.workspace.fs.readFile(artifact);
      const text = new TextDecoder('utf-8').decode(bytes);
      const index: StepIndex = JSON.parse(text);
      const fresh = await this.isArtifactFresh(folder, artifact, stat.mtime, index);
      if (!fresh) {
        // Surface staleness non-blocking info
        console.warn('[CukeRust] artifact stale; falling back to static scan');
        return false;
      }
      this.indexes.set(folder.uri.fsPath, index);
      return true;
    } catch {
      return false;
    }
  }

  private async isArtifactFresh(folder: vscode.WorkspaceFolder, artifact: vscode.Uri, artifactMtime: number, index: StepIndex): Promise<boolean> {
    // If stats.generated_at present, prefer that; else compare artifact mtime with referenced files
    try {
      const generated = (index as any).stats?.generated_at;
      let genTime = artifactMtime;
      if (typeof generated === 'string') {
        const t = Date.parse(generated);
        if (!Number.isNaN(t)) genTime = Math.max(genTime, t);
      }
      const steps = Array.isArray(index.steps) ? index.steps : [];
      for (const s of steps) {
        const uri = vscode.Uri.joinPath(folder.uri, s.file);
        try {
          const st = await vscode.workspace.fs.stat(uri);
          if (st.mtime > genTime) return false;
        } catch {
          // missing file — consider stale
          return false;
        }
      }
      return true;
    } catch {
      return false;
    }
  }

  // Diagnostics for a document
  async refreshDiagnostics(doc: vscode.TextDocument): Promise<void> {
    if (doc.languageId !== 'feature') return;
    const folder = vscode.workspace.getWorkspaceFolder(doc.uri) ?? null;
    const index = this.getIndex(folder);
    if (!index) {
      this.diag.delete(doc.uri);
      return;
    }
    const diags: vscode.Diagnostic[] = [];
    const text = doc.getText();
    const lines = text.split(/\r?\n/);
    let lastKind: 'Given' | 'When' | 'Then' | undefined;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const m = /^(Given|When|Then|And|But)\s+(.+)$/.exec(line);
      if (!m) continue;
      const keyword = m[1];
      const body = m[2];
      let kind: 'Given' | 'When' | 'Then';
      if (keyword === 'And' || keyword === 'But') {
        kind = lastKind ?? 'Given';
      } else {
        kind = keyword as 'Given' | 'When' | 'Then';
        lastKind = kind;
      }
      const matches = this.matchStep(index.steps, kind, body);
      if (matches.length === 0) {
        const d = new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), 'Undefined step', vscode.DiagnosticSeverity.Warning);
        d.source = 'CukeRust';
        diags.push(d);
      } else if (matches.length > 1) {
        const d = new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), 'Ambiguous step', vscode.DiagnosticSeverity.Warning);
        d.source = 'CukeRust';
        diags.push(d);
      }
    }
    this.diag.set(doc.uri, diags);
  }

  matchStep(steps: StepEntry[], kind: 'Given' | 'When' | 'Then', body: string): StepEntry[] {
    const norm = body.trim();
    const results: StepEntry[] = [];
    for (const s of steps) {
      if (s.kind !== kind) continue;
      try {
        // Smart mode: if starts/ends with ^$, test full; otherwise implicit anchors
        const anchored = s.regex.startsWith('^') || s.regex.endsWith('$');
        const pattern = anchored ? s.regex : `^${s.regex}$`;
        const re = new RegExp(pattern);
        if (re.test(norm)) results.push(s);
      } catch {
        // ignore invalid regex entries
      }
    }
    return results;
  }
}
