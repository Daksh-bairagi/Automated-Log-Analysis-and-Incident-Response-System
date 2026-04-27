const path = require('path');
const { runCommand, getNpmCommand } = require('./lib/run-command.cjs');

const repoRoot = path.resolve(__dirname, '..');
const clientDir = path.join(repoRoot, 'client');
const npmCmd = getNpmCommand();

function makeCommand(scriptName) {
  if (process.platform === 'win32') {
    return {
      command: process.env.comspec || 'cmd.exe',
      args: ['/d', '/s', '/c', `npm run ${scriptName}`],
    };
  }

  return {
    command: npmCmd,
    args: ['run', scriptName],
  };
}

async function main() {
  const lint = makeCommand('lint');
  await runCommand({
    label: 'Client lint',
    command: lint.command,
    args: lint.args,
    cwd: clientDir,
  });

  await runCommand({
    label: 'Client build',
    command: process.execPath,
    args: [
      path.join(clientDir, 'node_modules', 'vite', 'bin', 'vite.js'),
      'build',
      '--configLoader',
      'native',
    ],
    cwd: clientDir,
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
