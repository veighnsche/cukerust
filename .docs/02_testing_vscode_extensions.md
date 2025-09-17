# Testing VS Code Extensions (TypeScript + Rust)

This guide covers unit, integration, and end‑to‑end testing for a VS Code extension with a TypeScript host and Rust components (WASM/N‑API/CLI).

## Test layers

- Unit (TS): fast tests for pure TS modules (use Vitest or Jest; Vitest recommended).
- Integration (Extension Host): run tests in a real VS Code instance using `@vscode/test-electron`.
- UI/E2E (optional): drive VS Code UI with Playwright or `vscode-extension-tester`.
- Rust unit: `cargo test` for Rust crates.
- Rust WASM unit: `wasm-bindgen-test` (Node target) or test the JS glue from TS.

## Unit testing (TypeScript)

Recommended stack

- Vitest + tsconfig paths + c8 for coverage.

Example scripts (root or package)

```json
{
  "devDependencies": {
    "vitest": "^2",
    "c8": "^9"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "coverage": "c8 -r text -r html vitest run"
  }
}
```

## Integration testing (Extension Host)

Use `@vscode/test-electron` to download VS Code and run tests inside the extension host.

Install

```bash
pnpm add -D @vscode/test-electron mocha @types/mocha
```

Structure

```
packages/extension/
  src/
  out/
  test/
    runTest.ts         # bootstraps VS Code and runs mocha tests
    suite/
      extension.test.ts
      index.ts         # mocha setup
  package.json
```

Minimal runner (`test/runTest.ts`)

```ts
import * as path from 'node:path';
import { runTests } from '@vscode/test-electron';

async function main() {
  const extensionDevelopmentPath = path.resolve(__dirname, '../');
  const extensionTestsPath = path.resolve(__dirname, './suite/index');
  await runTests({ extensionDevelopmentPath, extensionTestsPath });
}

main().catch((err) => {
  console.error('Failed to run tests', err);
  process.exit(1);
});
```

Mocha suite bootstrap (`test/suite/index.ts`)

```ts
import * as path from 'node:path';
import * as Mocha from 'mocha';
import * as glob from 'glob';

export function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'bdd', color: true, timeout: 20000 });
  const testsRoot = path.resolve(__dirname, '.');

  return new Promise((resolve, reject) => {
    glob('**/*.test.js', { cwd: testsRoot }, (err, files) => {
      if (err) return reject(err);
      files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));
      try {
        mocha.run((failures) => {
          if (failures > 0) reject(new Error(`${failures} tests failed.`));
          else resolve();
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}
```

Example test (`test/suite/extension.test.ts`)

```ts
import * as assert from 'node:assert';
import * as vscode from 'vscode';

describe('Extension activation', () => {
  it('activates successfully', async () => {
    const ext = vscode.extensions.getExtension('publisher.cukerust');
    await ext?.activate();
    assert.ok(ext?.isActive);
  });
});
```

Scripts (package `packages/extension/package.json`)

```json
{
  "scripts": {
    "pretest:int": "pnpm -w build", // ensure extension is built
    "test:int": "node ./out/test/runTest.js"
  }
}
```

Fixtures

- Use a `test-fixtures/` workspace with sample `*.feature` and Rust files.
- Launch tests with `workspaceFolder` pointing to the fixture path.

## UI/E2E tests (optional)

Options

- Playwright launching Code via `@vscode/test-electron` executable.
- `vscode-extension-tester` for a higher‑level API.

Use cases

- Verify diagnostics appear, CodeLens commands, and go‑to‑definition behavior within a real editor UI.

## Testing Rust components

- Pure Rust: `cargo test --workspace`.
- WASM: `wasm-pack test --node` or test via TS importing the built WASM.
- N‑API: test via `node` + mocha/vitest; also run `cargo test` for internal logic.

## Coverage

- TS: `c8` (V8 coverage). For extension‑host integration tests, coverage is partial because code runs in a child process.
- Rust: `cargo tarpaulin` (Linux) or `grcov` + LLVM profiling.

## Continuous Integration (GitHub Actions)

Matrix example (TS + Extension Host)

```yaml
name: ci
on: [push, pull_request]

jobs:
  ts-tests:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [20]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: ${{ matrix.node }}, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm -w build
      - run: pnpm -w test
      - run: pnpm --filter @cukerust/extension test:int

  rust-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo test --workspace --all-features --locked
```

If using N‑API prebuilds, add jobs to build artifacts for each OS/arch using `@napi-rs/cli` and upload them before packaging the VSIX.

## Debugging tests locally

- Add a VS Code `launch.json` for running extension tests with the debugger attached.
- Use `console.log` generously; logs are visible in the test runner output.
- For slow tests, increase timeouts in Mocha or Vitest.
