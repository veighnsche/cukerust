import * as vscode from 'vscode';
import type { StepEntry, StepIndex, SourceFileInput } from './types';
import { detectDialect, getDialect, buildStepKeywordRegex, extractOutlineContext, resolvePlaceholders } from './gherkin';
import { exec } from 'child_process';

export class StepIndexManager {
  private indexes = new Map<string, StepIndex>(); // key: workspace folder fsPath
  private wasmModule: any | null = null;
  private diag = vscode.languages.createDiagnosticCollection('cukerust');
  private rebuildTimers = new Map<string, NodeJS.Timeout>();
  private artifactStale = new Map<string, boolean>();
  private ambiguityMemory = new Map<string, { file: string; line: number }>();
  private lastBuildMs = new Map<string, number>();
  private forceStatic = false;

  constructor(private context: vscode.ExtensionContext) {}


  async ensureWasm(): Promise<any> {
    if (!this.wasmModule) {
      // Delay resolution to runtime so bundler doesn't try to bundle native WASM pkg
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const path = require('node:path');
      const nativePath = path.join(__dirname, '..', 'native', 'cukerust-wasm');
      // Require at runtime (CommonJS) to avoid bundler resolution
      // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
      this.wasmModule = require(nativePath);
    }
    return this.wasmModule;
  }

  getIndex(folder: vscode.WorkspaceFolder | null): StepIndex | undefined {
    if (!folder) return undefined;
    return this.indexes.get(folder.uri.fsPath);
  }

  getArtifactStale(folder: vscode.WorkspaceFolder | null): boolean {
    if (!folder) return false;
    return this.artifactStale.get(folder.uri.fsPath) ?? false;
  }

  getLastBuildMs(folder: vscode.WorkspaceFolder | null): number | undefined {
    if (!folder) return undefined;
    return this.lastBuildMs.get(folder.uri.fsPath);
  }

  async rebuildAll(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    for (const f of folders) {
      await this.rebuildForFolder(f);
    }
  }

  async rebuildAllStaticScan(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders ?? [];
    this.forceStatic = true;
    try {
      for (const f of folders) {
        await this.rebuildForFolder(f);
      }
    } finally {
      this.forceStatic = false;
    }
  }

  async rebuildForFolder(folder: vscode.WorkspaceFolder): Promise<void> {
    const mode = vscode.workspace.getConfiguration('cukerust', folder).get<'auto'|'static-scan'|'artifact'|'runtime-list'>('discovery.mode', 'auto');
    if (mode === 'artifact' || mode === 'auto') {
      const loaded = await this.tryLoadArtifact(folder);
      if (loaded) return; // prefer artifact if fresh
      if (mode === 'artifact') return; // artifact requested but not present; leave empty
    }
    if (mode === 'runtime-list') {
      await this.listStepsViaRunner(folder);
      return;
    }
    // Static scan
    const t0 = Date.now();
    const wasm = await this.ensureWasm();
    const include = new vscode.RelativePattern(folder, '**/*.rs');
    const ignore = vscode.workspace.getConfiguration('cukerust', folder).get<string[]>('ignoreGlobs', []);
    const excludes = ['**/target/**', ...ignore];
    const exclude = excludes.length > 1 ? `{${excludes.join(',')}}` : excludes[0];
    const rustFiles = await vscode.workspace.findFiles(include, exclude, 5000);
    const inputs: SourceFileInput[] = [];
    for (const uri of rustFiles) {
      try {
        const bytes = await vscode.workspace.fs.readFile(uri);
        const text = new TextDecoder('utf-8').decode(bytes);
        const rel = folder ? vscode.workspace.asRelativePath(uri, false) : uri.fsPath;
        inputs.push({ path: rel, text });
        // Yield to event loop for responsiveness on huge repos
        await new Promise((r) => setTimeout(r, 0));
      } catch {
        // ignore read failures
      }
    }
    const payload = JSON.stringify({ files: inputs });
    const result = wasm.extract_step_index(payload);
    const index: StepIndex = JSON.parse(result);
    index.steps = dedupeSteps(index.steps);
    this.indexes.set(folder.uri.fsPath, index);
    this.artifactStale.set(folder.uri.fsPath, false);
    this.lastBuildMs.set(folder.uri.fsPath, Date.now() - t0);
  }

  private async tryLoadArtifact(folder: vscode.WorkspaceFolder): Promise<boolean> {
    if (this.forceStatic) return false;
    const cfgPath = vscode.workspace.getConfiguration('cukerust', folder).get<string>('index.path', 'docs/cukerust/step_index.json');
    const artifact = vscode.Uri.joinPath(folder.uri, cfgPath);
    try {
      const stat = await vscode.workspace.fs.stat(artifact);
      const bytes = await vscode.workspace.fs.readFile(artifact);
      const text = new TextDecoder('utf-8').decode(bytes);
      const index: StepIndex = JSON.parse(text);
      const fresh = await this.isArtifactFresh(folder, artifact, stat.mtime, index);
      if (!fresh) {
        // Mark stale; fall back to static scan
        this.artifactStale.set(folder.uri.fsPath, true);
        return false;
      }
      this.indexes.set(folder.uri.fsPath, index);
      this.artifactStale.set(folder.uri.fsPath, false);
      return true;
    } catch {
      this.artifactStale.set(folder.uri.fsPath, false);
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
    const configured = vscode.workspace.getConfiguration('cukerust', folder ?? undefined).get<'auto'|'en'|'es'>('dialect', 'auto');
    const code = detectDialect(text, configured);
    const dialect = getDialect(code);
    const stepRe = buildStepKeywordRegex(dialect);
    let lastKind: 'Given' | 'When' | 'Then' | undefined;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const m = stepRe.exec(line);
      if (!m) continue;
      const keyword = m[1];
      const body = m[2];
      let kind: 'Given' | 'When' | 'Then';
      if (dialect.And.includes(keyword) || dialect.But.includes(keyword)) {
        kind = lastKind ?? 'Given';
      } else if (dialect.Given.includes(keyword)) {
        kind = 'Given';
        lastKind = kind;
      } else if (dialect.When.includes(keyword)) {
        kind = 'When';
        lastKind = kind;
      } else if (dialect.Then.includes(keyword)) {
        kind = 'Then';
        lastKind = kind;
      } else {
        continue;
      }
      // Outline handling
      const oc = extractOutlineContext(text, i);
      if (oc.isOutline && oc.examples.length > 0 && /<[^>]+>/.test(body)) {
        let anyOk = false;
        let anyAmb = false;
        for (const row of oc.examples) {
          const resolved = resolvePlaceholders(body, row);
          const matches = this.matchStep(index.steps, kind, resolved);
          if (matches.length > 1) anyAmb = true;
          if (matches.length >= 1) anyOk = true;
        }
        if (!anyOk) {
          const d = new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), 'Undefined step (none of the Examples values match)', vscode.DiagnosticSeverity.Warning);
          d.source = 'CukeRust';
          diags.push(d);
        } else if (anyAmb) {
          const d = new vscode.Diagnostic(new vscode.Range(i, 0, i, line.length), 'Ambiguous step (one or more Examples values have multiple matches)', vscode.DiagnosticSeverity.Warning);
          d.source = 'CukeRust';
          diags.push(d);
        }
      } else {
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
    }
    this.diag.set(doc.uri, diags);
  }

  matchStep(steps: StepEntry[], kind: 'Given' | 'When' | 'Then', body: string): StepEntry[] {
    const norm = body.trim();
    const results: StepEntry[] = [];
    const folder = vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor?.document?.uri ?? vscode.Uri.file(''));
    const mode = vscode.workspace.getConfiguration('cukerust', folder ?? undefined).get<'anchored'|'smart'|'substring'>('regex.matchMode', 'smart');
    for (const s of steps) {
      if (s.kind !== kind) continue;
      try {
        let pattern = s.regex;
        if (mode === 'anchored') {
          pattern = s.regex;
          if (!pattern.startsWith('^')) pattern = '^' + pattern;
          if (!pattern.endsWith('$')) pattern = pattern + '$';
        } else if (mode === 'smart') {
          const anchored = s.regex.startsWith('^') || s.regex.endsWith('$');
          pattern = anchored ? s.regex : `^${s.regex}$`;
        } else {
          // substring
          pattern = s.regex;
        }
        const re = new RegExp(pattern);
        if (re.test(norm)) results.push(s);
      } catch {
        // ignore invalid regex entries
      }
    }
    return results;
  }

  async listStepsViaRunner(folder: vscode.WorkspaceFolder): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('cukerust', folder);
    const cmd = cfg.get<string>('runtimeList.command', '');
    if (!cmd) {
      vscode.window.showWarningMessage('CukeRust: Set cukerust.runtimeList.command to use Runtime-List mode');
      return;
    }
    const trustKey = `trust:runner:${folder.uri.fsPath}`;
    const trusted = this.context.workspaceState.get<boolean>(trustKey, false);
    if (!trusted) {
      const choice = await vscode.window.showWarningMessage('CukeRust: Run project-defined step list command?', 'Trust and Run', 'Cancel');
      if (choice !== 'Trust and Run') return;
      await this.context.workspaceState.update(trustKey, true);
    }
    await new Promise<void>((resolve) => {
      exec(cmd, { cwd: folder.uri.fsPath, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          vscode.window.showErrorMessage(`CukeRust: runner failed: ${String(err)}`);
          resolve();
          return;
        }
        try {
          const index: StepIndex = JSON.parse(stdout.toString('utf-8'));
          this.indexes.set(folder.uri.fsPath, index);
          this.artifactStale.set(folder.uri.fsPath, false);
        } catch (e) {
          vscode.window.showErrorMessage(`CukeRust: runner produced invalid JSON: ${String(e)}`);
        }
        resolve();
      });
    });
  }

  setAmbiguityChoice(key: string, target: { file: string; line: number }) {
    this.ambiguityMemory.set(key, target);
  }
  getAmbiguityChoice(key: string) {
    return this.ambiguityMemory.get(key);
  }
  clearAmbiguityChoices() {
    this.ambiguityMemory.clear();
  }

  // Watchers to debounce rebuilds on Rust file changes
  initWatchers() {
    const folders = vscode.workspace.workspaceFolders ?? [];
    for (const f of folders) {
      const pattern = new vscode.RelativePattern(f, '**/*.rs');
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);
      const schedule = () => {
        const key = f.uri.fsPath;
        const prev = this.rebuildTimers.get(key);
        if (prev) clearTimeout(prev);
        const t = setTimeout(() => { this.rebuildForFolder(f).then(() => {
          // refresh diagnostics for open feature docs under this folder
          for (const doc of vscode.workspace.textDocuments) {
            if (vscode.workspace.getWorkspaceFolder(doc.uri)?.uri.fsPath === key) {
              this.refreshDiagnostics(doc);
            }
          }
        }); }, 500);
        this.rebuildTimers.set(key, t);
      };
      watcher.onDidCreate(schedule, this, this.context.subscriptions);
      watcher.onDidChange(schedule, this, this.context.subscriptions);
      watcher.onDidDelete(schedule, this, this.context.subscriptions);
      this.context.subscriptions.push(watcher);
    }
  }
}

function dedupeSteps(steps: StepEntry[]): StepEntry[] {
  const seen = new Set<string>();
  const out: StepEntry[] = [];
  for (const s of steps) {
    const key = `${s.kind}|${s.regex}|${s.file}|${s.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}
