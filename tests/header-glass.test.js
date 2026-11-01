import test from 'node:test';
import assert from 'node:assert/strict';
import { setupHeaderGlass } from '../header-glass.js';

class Surface extends EventTarget {
  constructor() {
    super(); this.children = []; this.values = new Map();
    const classes = new Set(); this.classList = { contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name) };
    this.style = { setProperty: (key, value) => this.values.set(key, value) };
  }
  append(child) { this.children.push(child); child.parent = this; }
  prepend(child) { this.children.unshift(child); child.parent = this; }
  remove() { this.parent.children = this.parent.children.filter(child => child !== this); }
  setAttribute() {}
  getBoundingClientRect() { return { left: 16, top: 14, right: 1216, bottom: 90, width: 1200, height: 76 }; }
  getContext() {
    return new Proxy({}, { get: (_, key) => key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {} });
  }
}
function environment(t) {
  const names = ['document','window','matchMedia','ResizeObserver','MutationObserver','requestAnimationFrame','cancelAnimationFrame'];
  const originals = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  const document = new Surface(), window = new Surface(), preference = new Surface(), callbacks = new Map();
  document.createElement = () => new Surface(); document.hidden = false; preference.matches = false;
  globalThis.document = document; globalThis.window = window; globalThis.matchMedia = () => preference;
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.MutationObserver = class { constructor(callback) { this.callback = callback; } observe() {} disconnect() {} };
  let id = 0;
  globalThis.requestAnimationFrame = callback => { callbacks.set(++id, callback); return id; };
  globalThis.cancelAnimationFrame = key => callbacks.delete(key);
  t.after(() => { for (const [key, value] of originals) { if (value) Object.defineProperty(globalThis, key, value); else delete globalThis[key]; } });
  const contact = new Surface(), header = new Surface();
  contact.getBoundingClientRect = () => ({ left: 1080, right: 1190, top: 29, bottom: 73, width: 110, height: 44 });
  header.querySelector = () => contact;
  return { header, contact, preference, callbacks, document, window };
}
function pointer(type, x = 1170, y = 54) {
  return Object.assign(new Event(type), { clientX: x, clientY: y, pointerType: 'mouse' });
}

test('liquid glass reacts only inside the header, then stops drawing when settled', t => {
  const { header, contact, window, callbacks } = environment(t);
  const dispose = setupHeaderGlass(header);
  window.dispatchEvent(pointer('pointermove')); assert.equal(callbacks.size, 0);
  header.dispatchEvent(pointer('pointermove')); assert.equal(callbacks.size, 1);
  for (let time = 16; callbacks.size && time < 6000; time += 16) {
    const work = [...callbacks.values()]; callbacks.clear(); work.forEach(callback => callback(time));
  }
  assert.equal(callbacks.size, 0, 'No permanent animation loop');
  assert.ok(parseFloat(contact.values.get('--liquid-x')) > 0);
  header.dispatchEvent(pointer('pointerleave'));
  for (let time = 6016; callbacks.size && time < 12000; time += 16) {
    const work = [...callbacks.values()]; callbacks.clear(); work.forEach(callback => callback(time));
  }
  assert.equal(callbacks.size, 0);
  assert.ok(Math.abs(parseFloat(contact.values.get('--liquid-x'))) < .02);
  dispose(); assert.equal(header.children.length, 0);
  header.dispatchEvent(pointer('pointerdown')); assert.equal(callbacks.size, 0);
});

test('header water respects reduced motion and cancels work in hidden tabs', t => {
  const { header, preference, callbacks, document } = environment(t);
  const dispose = setupHeaderGlass(header);
  preference.matches = true; preference.dispatchEvent(new Event('change'));
  header.dispatchEvent(pointer('pointerdown')); assert.equal(callbacks.size, 0);
  preference.matches = false; preference.dispatchEvent(new Event('change'));
  header.dispatchEvent(pointer('pointerdown')); assert.equal(callbacks.size, 1);
  document.hidden = true; document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(callbacks.size, 0);
  dispose(); assert.equal(header.children.length, 0);
});


test('Portal and Tunnel suppress liquid effects, which resume in later sections', t => {
  const { header, callbacks } = environment(t);
  const dispose = setupHeaderGlass(header);
  header.classList.add('plain-journey-header');
  header.dispatchEvent(pointer('pointermove')); header.dispatchEvent(pointer('pointerdown'));
  assert.equal(callbacks.size, 0);
  header.classList.remove('plain-journey-header');
  header.dispatchEvent(pointer('pointerdown'));
  assert.equal(callbacks.size, 1);
  header.classList.add('plain-journey-header');
  const work = [...callbacks.values()]; callbacks.clear(); work.forEach(callback => callback(16));
  assert.equal(callbacks.size, 0, 'Returning to the tunnel stops all liquid animation');
  dispose();
});
