import { copyFile, mkdir } from 'node:fs/promises';
import { routePaths } from '../content.js';
for (const route of routePaths.filter(path => path !== '/')) {
  const target = new URL(`../dist${route}`, import.meta.url);
  await mkdir(target, { recursive: true });
  await copyFile(new URL('../dist/index.html', import.meta.url), new URL('index.html', target));
}
await copyFile(new URL('../dist/index.html', import.meta.url), new URL('../dist/404.html', import.meta.url));
console.log(`Prepared ${routePaths.length} directly loadable pages and a 404 page.`);
