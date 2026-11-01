import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupBeyond } from '../beyond.js';
import { beyondState, journeyProgress, journeyOffset } from '../beyond-motion.js';
import { createBeyondModel } from '../beyond-model.js';
import { sceneState } from '../motion.js';

const at = local => .84 + .16 * local;
const settle = () => new Promise(resolve => setImmediate(resolve));

test('extra Beyond scrolling preserves the original portal and complete tunnel distances', () => {
  for (const original of [4000, 3600]) {
    const viewport = 1000, total = original + 2800;
    for (const p of [0, .1, .36, .52, .73, .81, .84]) {
      assert.ok(Math.abs(journeyProgress(p * original, total, viewport) - p) < 1e-12);
      assert.ok(Math.abs(journeyOffset(p, total, viewport) - p * original) < 1e-9);
    }
    for (const p of [.85, .9, .95, 1]) assert.ok(Math.abs(journeyProgress(journeyOffset(p, total, viewport), total, viewport) - p) < 1e-12);
  }
});

test('camera walks, logo completes a revolution, camera enters, then gold reveals the page', () => {
  const start = beyondState(at(0)), platform = beyondState(at(.48)), spun = beyondState(at(.7));
  assert.equal(start.z, 20); assert.equal(platform.z, -9);
  assert.equal(spun.rotation, 2 * Math.PI);
  assert.equal(spun.enter, 0); assert.equal(spun.gold, 0);
  assert.ok(beyondState(at(.91)).z < -18, 'Camera crosses the logo plane');
  assert.equal(beyondState(at(.95)).gold, 1);
  assert.equal(beyondState(at(.95)).reveal, 0, 'Gold precedes the page reveal');
  assert.equal(beyondState(1).reveal, 1);
  for (let i = 0; i <= 1000; i++) {
    const p = at(i / 1000), state = beyondState(p);
    assert.ok(Object.values(state).every(Number.isFinite));
    assert.ok(Math.abs(state.reveal - sceneState(p).reveal) < 1e-10);
  }
});

test('the actual 3D logo has a clear entry opening and reversible camera poses', () => {
  const model = createBeyondModel();
  model.pose(at(.7), 390 / 844);
  const ray = new THREE.Raycaster(new THREE.Vector3(0, 2.75, -15), new THREE.Vector3(0, 0, -1), .01, 5);
  assert.equal(ray.intersectObjects(model.logo.children).length, 0, 'Camera enters an opening, not solid metal');
  const samples = [.84, .88, .94, .97, .99];
  const poses = samples.map(p => { model.pose(p); return [...model.camera.position.toArray(), model.logo.rotation.y]; });
  const reversed = samples.toReversed().map(p => { model.pose(p); return [...model.camera.position.toArray(), model.logo.rotation.y]; }).reverse();
  assert.deepEqual(poses, reversed);
  model.dispose();
});

function fixture(load) {
  const composition = { style: {} }, host = {}, light = { style: {} }, classes = new Set();
  const arrival = { clientWidth: 390, clientHeight: 844, style: { setProperty() {} }, classList: { add: x => classes.add(x), remove: x => classes.delete(x) }, querySelector: selector => ({ '.beyond-composition': composition, '.beyond-view': host, '.beyond-golden': light })[selector] };
  return { controller: setupBeyond(arrival, {}, load), light, classes };
}

test('Beyond lazily loads, restores the latest scroll pose and releases its renderer', async () => {
  let loads = 0, disposed = 0; const poses = [];
  const { controller, light, classes } = fixture(async () => { loads++; return { createBeyondScene: () => ({ render: p => poses.push(p), resize() {}, dispose() { disposed++; } }) }; });
  controller.render(.5); await settle(); assert.equal(loads, 0);
  controller.render(.75); controller.render(.94); await settle();
  assert.equal(loads, 1); assert.equal(poses.at(-1), .94); assert.ok(classes.has('beyond-ready'));
  controller.render(.99); assert.ok(Number(light.style.opacity) > .99);
  controller.render(.85); assert.equal(light.style.opacity, '0');
  controller.dispose(); assert.equal(disposed, 1); assert.ok(!classes.has('beyond-ready'));
});

test('a late Beyond import cannot initialize after route navigation', async () => {
  let resolve;
  const { controller } = fixture(() => new Promise(done => { resolve = done; }));
  controller.render(.8); controller.dispose();
  resolve({ createBeyondScene: () => assert.fail('Renderer created after disposal') });
  await settle();
});
