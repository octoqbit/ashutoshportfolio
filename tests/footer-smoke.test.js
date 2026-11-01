import test from 'node:test';
import assert from 'node:assert/strict';
import { setupFooterSmoke } from '../footer-smoke.js';

class Surface extends EventTarget {
  constructor() { super(); this.children = []; }
  append(child) { this.children.push(child); child.parent = this; }
  remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
  setAttribute() {}
  getBoundingClientRect() { return { left: 100, top: 400, width: 800, height: 200 }; }
}
const pointerEvent = (type, x = 500, y = 500) => Object.assign(new Event(type), { pointerType: 'mouse', clientX: x, clientY: y });
const settle = () => new Promise(resolve => setImmediate(resolve));

function environment(t) {
  const names = ['window', 'document', 'matchMedia', 'IntersectionObserver', 'ResizeObserver', 'requestAnimationFrame', 'cancelAnimationFrame'];
  const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const pointer = Object.assign(new EventTarget(), { matches: true });
  const reduced = Object.assign(new EventTarget(), { matches: false });
  const window = new Surface(), document = new Surface(), callbacks = new Map();
  document.hidden = false;
  document.body = { classList: { contains: () => false } };
  document.createElement = () => new Surface();
  globalThis.window = window; globalThis.document = document;
  globalThis.matchMedia = query => query.includes('reduced-motion') ? reduced : pointer;
  globalThis.IntersectionObserver = globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  let id = 0;
  globalThis.requestAnimationFrame = callback => { callbacks.set(++id, callback); return id; };
  globalThis.cancelAnimationFrame = key => callbacks.delete(key);
  t.after(() => { for (const [name, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; } });
  return { window, reduced, callbacks };
}

test('smoke uses footer-local input and releases the effect when navigating away', async t => {
  const { window, callbacks } = environment(t);
  const host = new Surface(), moves = [];
  let loads = 0, disposed = 0;
  const fluid = { move: (...args) => moves.push(args), clear() {}, resize() {}, render() {}, dispose() { disposed++; } };
  const cleanup = setupFooterSmoke(host, async () => { loads++; return { createFooterFluid: () => fluid }; });
  window.dispatchEvent(pointerEvent('pointermove')); await settle();
  assert.equal(loads, 0, 'Moving elsewhere on the page never loads smoke');
  host.dispatchEvent(pointerEvent('pointerenter')); await settle();
  assert.equal(loads, 1);
  assert.deepEqual(moves[0], [.5, .5, true], 'Coordinates are relative to the whole footer');
  assert.equal(host.children.length, 1);
  assert.equal(host.children[0].className, 'footer-smoke');
  host.dispatchEvent(pointerEvent('pointermove', 700, 550));
  assert.deepEqual(moves.at(-1), [.75, .75, false]);
  cleanup();
  assert.equal(disposed, 1);
  assert.equal(host.children.length, 0);
  assert.equal(callbacks.size, 0);
  host.dispatchEvent(pointerEvent('pointerenter')); await settle();
  assert.equal(loads, 1, 'Teardown detaches local pointer listeners');
});

test('footer trails fade after input stops and a new entry starts without a connecting streak', async t => {
  const { callbacks } = environment(t);
  const host = new Surface(), moves = [];
  let clears = 0, renders = 0;
  const cleanup = setupFooterSmoke(host, async () => ({ createFooterFluid: () => ({
    move: (...args) => moves.push(args), clear() { clears++; }, resize() {},
    render() { renders++; }, dispose() {},
  }) }));
  host.dispatchEvent(pointerEvent('pointerenter')); await settle();
  const draw = now => { const work = [...callbacks.values()]; callbacks.clear(); work.forEach(callback => callback(now)); };
  draw(performance.now());
  assert.equal(renders, 1);
  host.dispatchEvent(pointerEvent('pointerleave'));
  assert.equal(callbacks.size, 1, 'Existing trails keep fading after the pointer leaves');
  draw(performance.now() + 3000);
  assert.ok(clears > 0);
  assert.equal(callbacks.size, 0, 'No permanent GPU loop after trails disappear');
  host.dispatchEvent(pointerEvent('pointerenter', 200, 450));
  assert.deepEqual(moves.at(-1), [.125, .25, true]);
  cleanup();
});

test('reduced motion and a late module load cannot attach an unwanted canvas', async t => {
  const { reduced } = environment(t);
  const host = new Surface();
  let loads = 0, resolveLoad;
  reduced.matches = true;
  const cleanup = setupFooterSmoke(host, () => { loads++; return new Promise(resolve => { resolveLoad = resolve; }); });
  host.dispatchEvent(pointerEvent('pointerenter'));
  assert.equal(loads, 0);
  reduced.matches = false; reduced.dispatchEvent(new Event('change'));
  host.dispatchEvent(pointerEvent('pointerenter'));
  assert.equal(loads, 1);
  cleanup();
  resolveLoad({ createFooterFluid: () => assert.fail('Must not initialize after navigation') });
  await settle();
  assert.equal(host.children.length, 0);
});
