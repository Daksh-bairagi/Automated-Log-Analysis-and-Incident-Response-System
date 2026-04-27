const path = require('path');
const { runCommand } = require('./lib/run-command.cjs');

const repoRoot = path.resolve(__dirname, '..');

async function main() {
  await runCommand({
    label: 'Component audit',
    command: process.execPath,
    args: [path.join(repoRoot, 'test', 'generate-component-audit.cjs')],
    cwd: repoRoot,
  });

  await runCommand({
    label: 'Server unit runner',
    command: process.execPath,
    args: [path.join(repoRoot, 'test', 'run-server-unit.cjs')],
    cwd: repoRoot,
  });

  await runCommand({
    label: 'Server integration runner',
    command: process.execPath,
    args: [path.join(repoRoot, 'test', 'run-server-integration.cjs')],
    cwd: repoRoot,
  });

  await runCommand({
    label: 'Client verification runner',
    command: process.execPath,
    args: [path.join(repoRoot, 'test', 'run-client-verification.cjs')],
    cwd: repoRoot,
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
