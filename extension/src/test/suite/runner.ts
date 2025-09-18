import * as path from 'node:path';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Mocha: any = require('mocha');

export function run(): Promise<void> {
  // Use TDD UI to support suite/test globals
  const mocha = new Mocha({ ui: 'tdd', color: true, timeout: 10000 });
  const testsRoot = __dirname;

  return new Promise((resolve, reject) => {
    try {
      // Add compiled test files
      mocha.addFile(path.join(testsRoot, 'extension.test.js'));
      mocha.run((failures: number) => {
        try {
          if (failures > 0) {
            reject(new Error(`${failures} tests failed.`));
          } else {
            resolve();
          }
        } catch (err) {
          reject(err);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}
