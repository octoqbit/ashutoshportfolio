import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

let checked = 0;
for (const directory of ['.', 'scripts', 'tests']) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.(?:m?js)$/.test(entry.name)) continue;
    const result = spawnSync(process.execPath, ['--check', `${directory}/${entry.name}`], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
    checked++;
  }
}
console.log(`Syntax checked ${checked} JavaScript files.`);
