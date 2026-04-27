const path = require('path');
const { runCommand } = require('./lib/run-command.cjs');

const repoRoot = path.resolve(__dirname, '..');
const serverDir = path.join(repoRoot, 'server');
const jestBin = path.join(serverDir, 'node_modules', 'jest', 'bin', 'jest.js');

async function main() {
  await runCommand({
    label: 'Server integration tests',
    command: process.execPath,
    args: [jestBin, 'tests/integration', '--runInBand', '--verbose', '--forceExit'],
    cwd: serverDir,
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
