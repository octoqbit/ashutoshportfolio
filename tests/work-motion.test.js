import test from 'node:test';
import assert from 'node:assert/strict';
import { setupWorkMotion } from '../work-motion.js';
const settle = () => new Promise(resolve => setImmediate(resolve));
function environment(t) {
  const originals = ['IntersectionObserver', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  const observers = [];
  globalThis.IntersectionObserver = class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {} unobserve() {} disconnect() { this.closed = true; }
  };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { connection: { saveData: false } } });
  t.after(() => originals.forEach(([key, descriptor]) => { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }));
  const reduced = Object.assign(new EventTarget(), { matches: false });
  const section = { querySelector: () => null, querySelectorAll: () => [] };
  const enter = () => observers[1].callback([{ isIntersecting: true }]);
  const preference = value => { reduced.matches = value; reduced.dispatchEvent(new Event('change')); };
  return { reduced, section, enter, preference, observers };
}

test('Work sheets load only near the section and release resources on navigation', async t => {
  const env = environment(t); let loads = 0, disposals = 0;
  const cleanup = setupWorkMotion(env.section, env.reduced, async () => {
    loads++; return { createWorkSheets: () => ({ dispose() { disposals++; } }) };
  });
  assert.equal(loads, 0);
  env.enter(); await settle(); env.enter(); await settle();
  assert.equal(loads, 1);
  cleanup();
  assert.equal(disposals, 1); assert.ok(env.observers.every(observer => observer.closed));
  env.preference(false); await settle(); assert.equal(loads, 1);
});

test('A late Work import cannot create a renderer after navigating away', async t => {
  const env = environment(t); let resolve, creations = 0;
  const cleanup = setupWorkMotion(env.section, env.reduced, () => new Promise(done => { resolve = done; }));
  env.enter(); cleanup();
  resolve({ createWorkSheets() { creations++; } }); await settle();
  assert.equal(creations, 0);
});

test('Work motion handles reduced-motion toggles while its import is pending', async t => {
  const env = environment(t); let resolve, loads = 0, creations = 0, disposals = 0;
  const module = { createWorkSheets() { creations++; return { dispose() { disposals++; } }; } };
  env.reduced.matches = true;
  const cleanup = setupWorkMotion(env.section, env.reduced, () => {
    loads++;
    return loads === 1 ? new Promise(done => { resolve = done; }) : Promise.resolve(module);
  });
  env.enter(); await settle(); assert.equal(loads, 0);
  env.preference(false); env.preference(true); env.preference(false);
  resolve(module); await settle();
  assert.equal(creations, 1, 'The stale import is skipped and the current preference is respected');
  env.preference(true); assert.equal(disposals, 1);
  cleanup(); assert.equal(disposals, 1);
});

test('Unavailable Work animation leaves static content usable', async t => {
  const env = environment(t);
  const cleanup = setupWorkMotion(env.section, env.reduced, async () => { throw new Error('offline'); });
  env.enter(); await settle();
  assert.deepEqual(env.section.querySelectorAll(), []);
  cleanup(); assert.ok(env.observers.every(observer => observer.closed));
});
