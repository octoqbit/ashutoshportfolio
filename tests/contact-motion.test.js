import test from 'node:test';
import assert from 'node:assert/strict';
import { deformContactPath } from '../contact-motion.js';
import { contactPage } from '../pages.js';

test('ribbon deformation preserves implicit and relative SVG curve commands', () => {
  const path = 'M10 20c1 2 3 4 5 6 1 2 3 4 5 6l5-2z';
  // These points are above the join region, so join must only normalize the syntax.
  assert.equal(deformContactPath(path, 0, 0, 1), 'M10.000 20.000 C11.000 22.000 13.000 24.000 15.000 26.000 C16.000 28.000 18.000 30.000 20.000 32.000 L25.000 30.000 Z');
});

test('both existing Contact paths remain finite in motion and restore exactly at rest', () => {
  const paths = [...contactPage().matchAll(/<path class="contact-(?:loop|glint)" d="([^"]+)"/g)].map(match => match[1]);
  assert.equal(paths.length, 2);
  for (const path of paths) {
    for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const join of [0, .5, 1]) {
      const result = deformContactPath(path, x, y, join);
      assert.ok(!/NaN|undefined|Infinity/.test(result));
      assert.ok(result.endsWith('Z') || result.endsWith('z'));
    }
    assert.equal(deformContactPath(path, 0, 0, 0), path, 'Original artwork restored without drift');
  }
});
