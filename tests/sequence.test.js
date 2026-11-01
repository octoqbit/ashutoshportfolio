import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { createFrameSequence, frameIndex, frameLayout } from '../sequence.js';

const settle = () => new Promise(resolve => setImmediate(resolve));
function fixture(load) {
  const draws = [], classes = new Set();
  const canvas = {
    width: 0, height: 0,
    getContext: () => ({ drawImage: (...args) => draws.push(args) }),
    getBoundingClientRect: () => ({ width: 1200, height: 700 }),
    classList: { add: name => classes.add(name), remove: name => classes.delete(name) },
  };
  return { canvas, draws, classes, sequence: createFrameSequence(canvas, { count: 297, load, density: () => 2 }) };
}

test('the full recording is retained from its first frame without gaps', async () => {
  const base = new URL('../public/media/portal-full/', import.meta.url);
  const manifest = JSON.parse(await readFile(new URL('manifest.json', base), 'utf8'));
  assert.equal(manifest.sourceTimes.length, manifest.count);
  assert.equal(manifest.sourceTimes[0], 0);
  assert.equal(manifest.count, 297);
  assert.ok(manifest.sourceTimes.every((time, i, times) => time >= 0 && time < 9.87 && (!i || time - times[i-1] <= .051)));
  assert.equal(manifest.desktop.width, 2912);
  assert.equal(manifest.desktop.height, 1600);
  assert.ok(Math.abs(manifest.desktop.width / manifest.desktop.height - manifest.mobile.width / manifest.mobile.height) < .001);
  for (const variant of ['desktop', 'mobile']) {
    await Promise.all(Array.from({ length: manifest.count }, (_, i) => access(new URL(`${variant}/${String(i).padStart(4, '0')}.webp`, base))));
  }
  assert.equal(frameIndex(-1, manifest.count), 0);
  assert.equal(frameIndex(2, manifest.count), manifest.count - 1);
});

test('frame cache stays bounded, reverses exactly, and releases every decoded image', async () => {
  const images = [];
  const fixtureState = fixture(async url => {
    const bitmap = { index: Number(url.match(/(\d+)\.webp$/)[1]), width: 2912, height: 1600, closed: false, close() { this.closed = true; } };
    images.push(bitmap); return bitmap;
  });
  const { sequence, draws, classes } = fixtureState;
  for (const position of [0, .2, .6, 1, .5, .1, 0]) {
    sequence.render(position); await settle();
    assert.equal(draws.at(-1)[0].index, frameIndex(position, 297));
    assert.ok(images.filter(image => !image.closed).length <= 6);
    assert.ok(classes.has('is-ready'));
  }
  const count = draws.length;
  sequence.render(0); await settle();
  assert.equal(draws.length, count, 'No redraw when the frame and crop are unchanged');
  sequence.dispose();
  assert.ok(images.every(image => image.closed));
  assert.ok(!classes.has('is-ready'));
});

test('late decodes after navigation are closed and never draw', async () => {
  const waiting = [];
  const { sequence, draws } = fixture(() => new Promise(resolve => waiting.push(resolve)));
  sequence.render(.5); await settle();
  assert.equal(waiting.length, 2);
  sequence.dispose();
  let closed = 0;
  waiting.forEach(resolve => resolve({ width: 2912, height: 1600, close: () => closed++ }));
  await settle();
  assert.equal(closed, 2); assert.equal(draws.length, 0);
});

test('the image area is filled by one proportional frame without stretched edge strips', async () => {
  for (const [width, height] of [[2940, 1400], [1440, 900], [2560, 1080], [390, 844], [375, 667], [320, 568], [430, 932], [740, 480]]) {
    const layout = frameLayout(width, height, 2912, 1600);
    assert.ok(layout.x <= .001 && layout.y <= .001);
    assert.ok(layout.width >= width - .001 && layout.height >= height - .001, 'Real image covers every edge');
    assert.ok(Math.abs(layout.width / layout.height - 2912 / 1600) < 1e-10, 'No distortion');
  }
  const { sequence, draws } = fixture(async () => ({ width: 2912, height: 1600, close() {} }));
  sequence.render(0); await settle();
  assert.equal(draws.length, 1, 'No additional pixel-strip draws');
  assert.equal(draws[0].length, 5, 'Draw the image uniformly, not sliced edge pixels');
  sequence.dispose();
});

test('phone framing keeps the opening portal and final entrance in the image area', () => {
  for (const [width, height] of [[320, 200], [375, 300], [390, 429], [430, 473], [740, 480]]) {
    const opening = frameLayout(width, height, 2912, 1600, .84);
    // Bounds of the entire sculpture in the opening frame, not only its center.
    const scale = opening.width / 2912;
    assert.ok(opening.x + 1519 * scale >= 12, 'Left silhouette has breathing room');
    assert.ok(opening.x + 2600 * scale <= width - 12, 'Right silhouette has breathing room');
    assert.ok(opening.y + 340 * scale >= 12, 'Top of sculpture is visible');
    assert.ok(opening.y + 1425 * scale <= height - 12, 'Base of sculpture is visible');
    for (const [position, centerX] of [[.84, 2050], [.5, 1456]]) {
      const layout = frameLayout(width, height, 2912, 1600, position);
      const center = layout.x + centerX * layout.width / 2912;
      assert.ok(center > width * .15 && center < width * .85, 'Portal remains away from the image edges');
    }
  }
});

test('a failed image leaves the poster available and does not retry endlessly', async () => {
  let attempts = 0;
  const { sequence, classes } = fixture(async () => { attempts++; throw new Error('offline'); });
  sequence.render(0); await settle();
  assert.equal(attempts, 3);
  assert.ok(!classes.has('is-ready'));
  sequence.render(0); await settle();
  assert.equal(attempts, 3);
  sequence.dispose();
});

test('expanding and reversing the phone frame redraws without leaving uncovered canvas edges', async () => {
  const { canvas, sequence, draws } = fixture(async () => ({ width: 2912, height: 1600, close() {} }));
  sequence.render(.6); await settle();
  for (const height of [300, 450, 650, 844, 650, 450, 300]) {
    canvas.getBoundingClientRect = () => ({ width: 390, height });
    sequence.resize();
    const [, x, y, width, drawnHeight] = draws.at(-1);
    assert.ok(x <= 0 && y <= 0);
    assert.ok(x + width >= canvas.width - .001 && y + drawnHeight >= canvas.height - .001);
    assert.ok(Math.abs(width / drawnHeight - 2912 / 1600) < 1e-10);
  }
  sequence.dispose();
});
