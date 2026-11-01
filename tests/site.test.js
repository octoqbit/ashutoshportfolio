import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { sceneState, normalizePath, damp } from '../motion.js';
import { routePaths, projects, skills, profile } from '../content.js';
import { home, workPage, aboutPage, practicePage, contactPage, projectPage } from '../pages.js';

test('scroll scene remains finite, continuous, and covered throughout the transition', () => {
  let previous = sceneState(0);
  for (let i = 0; i <= 10000; i++) {
    const state = sceneState(i / 10000);
    assert.ok(Object.values(state).every(Number.isFinite));
    assert.ok(1 - (1 - state.portal) * (1 - state.passage) * (1 - state.arrival) >= .85, 'No blank scene between transitions');
    for (const key of Object.keys(state)) assert.ok(Math.abs(state[key] - previous[key]) < .05, `Continuous ${key}`);
    for (const key of ['hero','portal','passage','travel','arrival','reveal','first','second']) assert.ok(state[key] >= 0 && state[key] <= 1);
    previous = state;
  }
  assert.equal(sceneState(0).hero, 1);
  assert.equal(sceneState(1).reveal, 1);
  assert.deepEqual(sceneState(-10), sceneState(0));
  assert.deepEqual(sceneState(10), sceneState(1));
});

test('every page has one primary heading, valid internal routes, and available media', async () => {
  const pages = [home(), workPage(), aboutPage(), practicePage(), contactPage(), ...projects.map(p => projectPage(p.slug))];
  for (const html of pages) {
    assert.equal((html.match(/<h1(?:>|\s)/g) || []).length, 1);
    for (const [, href] of html.matchAll(/href="(\/[^"#]*)"/g)) assert.ok(routePaths.includes(normalizePath(href)), `Known route ${href}`);
    for (const [, src] of html.matchAll(/(?:src|srcset|poster|data-src)="(\/media\/[^" ]+)"/g)) await access(new URL(`../public${src}`, import.meta.url));
  }
});

test('work features Ashutosh’s real projects and public source links', () => {
  assert.deepEqual(projects.map(project => project.slug), ['attendly', 'tivzo', 'cygnus']);
  for (const project of projects) {
    const html = projectPage(project.slug);
    assert.ok(html.includes(project.collection));
    assert.ok(html.includes(project.note));
    assert.ok(html.includes('ASHUTOSH YADAV'));
    assert.doesNotMatch(html, /Tesla|Coca-Cola|Vela Group|REFERENCE STUDY/);
    assert.ok(html.includes(project.repo));
  }
  const about = aboutPage();
  assert.doesNotMatch(about, /Illustrative toolkit|Figma|Python/);
  for (const skill of skills) assert.ok(about.includes(`<span>${skill}</span>`));
  for (const detail of ['second-year B.Tech', profile.college, 'Google Student Ambassador', 'MAY — SEPTEMBER 2026', 'Two contest wins', 'Introduction to IoT']) assert.ok(about.includes(detail));
  assert.ok(contactPage().includes(profile.github));
  assert.ok(contactPage().includes(profile.linkedin));
});

test('the contact page exposes direct contact details and its visual layers', () => {
  const html = contactPage();
  assert.ok(html.includes('mailto:aymail247@gmail.com'));
  assert.ok(html.includes('tel:+917895020802'));
  assert.ok(html.includes('class="contact-sheet"'));
});

test('the About story includes the paragraphs used by the typing reveal', () => {
  const html = aboutPage();
  assert.equal((html.match(/class="story-columns"/g) || []).length, 1);
  const story = html.match(/class="story-columns">(.*?)<\/div>/s)?.[1];
  assert.equal((story?.match(/<p>[^<]+<\/p>/g) || []).length, 2);
  assert.ok(story.includes('I’m Ashutosh Yadav'));
});


test('scroll damping is independent of refresh rate and never overshoots on reversal', () => {
  const run = fps => { let p = 0; for (let i = 0; i < fps / 4; i++) p = damp(p, 1, 1 / fps); return p; };
  assert.ok(Math.abs(run(60) - run(120)) < 1e-10);
  let p = .85;
  for (let i = 0; i < 100; i++) { const next = damp(p, .1, 1 / 60); assert.ok(next <= p && next >= .1); p = next; }
  assert.equal(p, .1);
});

test('the cleaned recording reaches the portal before tunnel travel begins', () => {
  const approach = sceneState(.30), threshold = sceneState(.36), inside = sceneState(.52), beyond = sceneState(.86);
  assert.equal(approach.passage, 0);
  assert.equal(approach.travel, 0);
  assert.equal(threshold.portal, 1);
  assert.equal(threshold.passage, 0);
  assert.equal(threshold.video, 1);
  assert.equal(sceneState(0).video, 0);
  assert.equal(inside.portal, 0);
  assert.equal(inside.passage, 1);
  assert.ok(inside.travel > 0 && inside.travel < 1);
  assert.equal(inside.arrival, 0);
  assert.equal(beyond.passage, 0);
  assert.equal(beyond.arrival, 1);
  // The same scroll position gives the same camera pose in either direction.
  const route = [.1, .36, .52, .72, .86];
  assert.deepEqual(route.map(sceneState), route.toReversed().map(sceneState).reverse());
});

test('phone portal fills the screen after the intro fades and before the tunnel appears', () => {
  for (let step = 0; step <= 1000; step++) {
    const state = sceneState(step / 1000);
    if (state.hero > 0) assert.equal(state.portalExpand, 0, 'Keep the sculpture clear of visible intro text');
    if (state.passage > 0) assert.equal(state.portalExpand, 1, 'No small image panel during the tunnel crossfade');
  }
  const positions = [0, .20, .25, .30, .35, .42];
  assert.deepEqual(positions.map(p => sceneState(p).portalExpand), positions.toReversed().map(p => sceneState(p).portalExpand).reverse());
});
