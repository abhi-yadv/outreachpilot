import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const children = [
  spawn(process.execPath, ['--env-file-if-exists=.env', 'server/index.mjs'], {
    cwd: root,
    stdio: 'inherit',
  }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], {
    cwd: root,
    stdio: 'inherit',
  }),
];

function stop() {
  for (const child of children) if (!child.killed) child.kill();
}

for (const child of children) {
  child.on('error', (error) => {
    console.error(error);
    stop();
    process.exitCode = 1;
  });
  child.on('exit', (code) => {
    if (code && code !== 0) process.exitCode = code;
    stop();
  });
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
