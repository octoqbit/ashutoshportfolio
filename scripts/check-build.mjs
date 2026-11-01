import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { routePaths, projects } from '../content.js';
import { home, workPage, practicePage, aboutPage, contactPage, projectPage, notFound } from '../pages.js';

const dist = new URL('../dist/', import.meta.url);
const shell = await readFile(new URL('index.html', dist), 'utf8');
const documents = [home(), workPage(), practicePage(), aboutPage(), contactPage(), ...projects.map(p => projectPage(p.slug)), notFound()];
let references = 0;
async function localFile(path) {
  if (!path.startsWith('/') || path.startsWith('//')) return;
  const clean = path.split(/[?#]/)[0];
  await access(new URL(`.${clean}${clean.endsWith('/') ? 'index.html' : ''}`, dist));
  references++;
}

for (const route of routePaths) await localFile(route);
await access(new URL('404.html', dist));
for (const html of [shell, ...documents]) {
  for (const [, path] of html.matchAll(/(?:src|srcset|href)="([^" ]+)"/g)) await localFile(path);
}
for (const html of documents) {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, 'Duplicate IDs in a rendered page');
  const available = new Set([...ids, 'main']);
  for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(available.has(anchor), `Missing anchor #${anchor}`);
  for (const [, attributes] of html.matchAll(/<img\b([^>]+)>/g)) assert.match(attributes, /\balt="[^"]*"/, 'Image is missing alternative text');
}
for (const name of await readdir(new URL('assets/', dist))) {
  if (!name.endsWith('.css')) continue;
  const css = await readFile(new URL(`assets/${name}`, dist), 'utf8');
  for (const [, path] of css.matchAll(/url\(["']?([^\s)"']+)["']?\)/g)) await localFile(path);
}
console.log(`Build verified: ${routePaths.length} routes, 404 page, ${references} local references, page anchors, image alternatives, and CSS assets.`);
