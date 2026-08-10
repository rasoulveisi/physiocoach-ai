import { spawnSync } from 'node:child_process';

const args = process.argv
  .slice(2)
  .filter((arg) => arg !== '--')
  .filter((arg) => arg !== '--run')
  .filter((arg) => arg !== '--watch');

const result = spawnSync('npx', ['ng', 'test', ...args], {
  stdio: 'inherit',
});

process.exit(result.status ?? 0);
