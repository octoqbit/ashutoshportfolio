import test from 'node:test';
import assert from 'node:assert/strict';
import { createPageTransition } from '../page-transition.js';

class Surface extends EventTarget {
  constructor() {
    super(); this.style = {}; this.attributes = new Map();
    const classes = new Set();
    this.classList = { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value) };
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name); }
}
function environment(t) {
  const names = ['document', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const originals = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  const document = new Surface(), preference = new Surface(), host = new Surface(), callbacks = new Map();
  document.hidden = false; preference.matches = false;
  const elements = Object.fromEntries(['[data-silk-sheet]', '[data-silk-edge]', '#silk-light', '.transition-mark'].map(selector => [selector, new Surface()]));
  host.querySelector = selector => elements[selector]; host.querySelectorAll = () => [new Surface(), new Surface(), new Surface()];
  let id = 0, now = 0;
  globalThis.document = document;
  globalThis.requestAnimationFrame = fn => { callbacks.set(++id, fn); return id; };
  globalThis.cancelAnimationFrame = key => callbacks.delete(key);
  t.after(() => originals.forEach(([name, descriptor]) => descriptor ? Object.defineProperty(globalThis, name, descriptor) : delete globalThis[name]));
  async function advance() {
    now += 100;
    const work = [...callbacks.values()]; callbacks.clear(); work.forEach(fn => fn(now));
    await Promise.resolve(); await Promise.resolve();
  }
  return { document, preference, host, sheet: elements['[data-silk-sheet]'], callbacks, advance };
}

test('page swap waits for full coverage, occurs once, and releases the overlay after reveal', async t => {
  const { host, sheet, preference, callbacks, advance } = environment(t);
  let commits = 0;
  const transition = createPageTransition(host, preference);
  const done = transition.run(() => {
    commits++;
    assert.ok(host.classList.contains('is-active'));
    const coordinates = sheet.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);
    assert.ok(coordinates[1] < 0 && coordinates[3] < 0 && coordinates[5] < 0 && coordinates[7] < 0, 'Entire curved upper edge is above the viewport');
    assert.ok(coordinates[9] > 1000 && coordinates[11] > 1000, 'Sheet reaches below the viewport before replacing content');
  });
  await advance(); await advance(); assert.equal(commits, 0);
  for (let i = 0; i < 20; i++) await advance();
  await done;
  assert.equal(commits, 1); assert.equal(callbacks.size, 0);
  assert.equal(host.classList.contains('is-active'), false);
});

test('reduced motion skips the wipe and changing preference mid-transition cannot stall navigation', async t => {
  const { host, preference, callbacks } = environment(t);
  const transition = createPageTransition(host, preference);
  preference.matches = true;
  let commits = 0;
  await transition.run(() => { commits++; assert.equal(host.classList.contains('is-active'), false); });
  assert.equal(callbacks.size, 0);
  preference.matches = false;
  const done = transition.run(() => { commits++; });
  assert.equal(callbacks.size, 1);
  preference.matches = true; preference.dispatchEvent(new Event('change'));
  await done;
  assert.equal(commits, 2); assert.equal(callbacks.size, 0);
  assert.equal(host.classList.contains('is-active'), false);
});

test('hidden tabs finish promptly and a failed page render leaves navigation unlocked', async t => {
  const { host, preference, document, callbacks } = environment(t);
  const transition = createPageTransition(host, preference);
  let commits = 0;
  const done = transition.run(() => { commits++; });
  document.hidden = true; document.dispatchEvent(new Event('visibilitychange'));
  await done;
  assert.equal(commits, 1); assert.equal(callbacks.size, 0);
  await assert.rejects(transition.run(() => { throw new Error('Render failed'); }), /Render failed/);
  assert.equal(host.classList.contains('is-active'), false);
  await transition.run(() => { commits++; });
  assert.equal(commits, 2);
});
