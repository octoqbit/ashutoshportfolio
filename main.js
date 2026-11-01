import './style.css';
import { setupHeaderGlass } from './header-glass.js';
import { setupAboutDepth } from './about-depth.js';
import { setupStoryMotion } from './about-story.js';
import { setupContactMotion } from './contact-motion.js';
import { setupWorkMotion, beginProjectFlight } from './work-motion.js';
import { createProjectTransition } from './project-transition.js';
import { createPageTransition } from './page-transition.js';
import { home, workPage, aboutPage, practicePage, contactPage, projectPage, notFound } from './pages.js';
import { projects } from './content.js';
import { clamp, damp, sceneState, normalizePath } from './motion.js';
import { setupFooterSmoke } from './footer-smoke.js';
import { createFrameSequence } from './sequence.js';
import { setupBeyond } from './beyond.js';
import { beyondState, journeyProgress, journeyOffset } from './beyond-motion.js';
import recording from './public/media/portal-full/manifest.json';

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const main = $('#main'), header = $('#header');
const disposeHeaderGlass = setupHeaderGlass(header);
if (import.meta.hot) import.meta.hot.dispose(disposeHeaderGlass);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const pageTransition = createPageTransition($('#page-transition'), reduced);
const projectTransition = createProjectTransition(beginProjectFlight, reduced);
let teardown = () => {}, transitionBusy = false, queuedNavigation = null, toastTimer;
history.scrollRestoration = 'manual';

function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3500); }
async function copyText(text) {
  if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return; }
  const area = document.createElement('textarea'); area.value = text; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.append(area); area.select();
  const success = document.execCommand('copy'); area.remove(); if (!success) throw new Error('Clipboard unavailable');
}

function revealElements() {
  if (reduced.matches) return () => {};
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
  }), { rootMargin: '0px 0px -30px 0px', threshold: .06 });
  $$('[data-reveal]', main).filter(element => !element.matches('.work-section .project, .work-section .work-heading')).forEach(element => { element.classList.add('reveal-ready'); observer.observe(element); });
  return () => observer.disconnect();
}

function setupFooterCurve(footer) {
  if (!footer) return () => {};
  let frame = 0;
  function update() {
    frame = 0;
    const progress = Math.max(0, Math.min(1,
      (innerHeight - footer.getBoundingClientRect().top) / Math.min(260, innerHeight * .4)));
    const curve = reduced.matches ? 1 : progress * progress * (3 - 2 * progress);
    footer.style.setProperty('--footer-curve', curve.toFixed(4));
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  reduced.addEventListener('change', schedule);
  update();
  return () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    reduced.removeEventListener('change', schedule);
    footer.style.removeProperty('--footer-curve');
  };
}

function setupPage() {
  const footer = $('.site-footer', main);
  const cleanups = [revealElements(), setupFooterSmoke(footer), setupFooterCurve(footer)];
  cleanups.push(setupWorkMotion($('.work-section', main), reduced));
  const contactPage = $('.contact-page', main);
  if (contactPage) cleanups.push(setupFooterSmoke(contactPage));
  if (contactPage) cleanups.push(setupContactMotion(contactPage));
  const journey = $('#journey');
  const portraitHero = $('.about-portrait-hero', main);
  const story = $('.about-story', main);
  const toolkit = $('.toolkit-track', main);
  if (toolkit) cleanups.push(setupToolkitEffects(toolkit));
  if (story) cleanups.push(setupStoryMotion(story), setupFooterSmoke(story));
  if (portraitHero) cleanups.push(setupAboutDepth(portraitHero));
  for (const portrait of $$('.about-portrait, .contact-personal', main)) {
    const preventImageAction = event => event.preventDefault();
    portrait.addEventListener('contextmenu', preventImageAction);
    portrait.addEventListener('dragstart', preventImageAction);
    cleanups.push(() => {
      portrait.removeEventListener('contextmenu', preventImageAction);
      portrait.removeEventListener('dragstart', preventImageAction);
    });
  }

  function setupToolkitEffects(track) {
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = matchMedia('(hover: hover) and (pointer: fine)');
    if (!pointer.matches || reducedMotion.matches) return () => {};
    const move = event => {
      const bounds = track.getBoundingClientRect();
      track.style.setProperty('--pointer-x', `${((event.clientX - bounds.left) / Math.max(1, bounds.width) * 100).toFixed(2)}%`);
      track.style.setProperty('--pointer-y', `${((event.clientY - bounds.top) / Math.max(1, bounds.height) * 100).toFixed(2)}%`);
    };
    const leave = () => {
      track.style.setProperty('--pointer-x', '50%');
      track.style.setProperty('--pointer-y', '50%');
    };
    const preferenceChanged = () => { if (!pointer.matches || reducedMotion.matches) leave(); };
    track.addEventListener('pointermove', move, { passive: true });
    track.addEventListener('pointerleave', leave);
    pointer.addEventListener('change', preferenceChanged);
    reducedMotion.addEventListener('change', preferenceChanged);
    return () => {
      track.removeEventListener('pointermove', move);
      track.removeEventListener('pointerleave', leave);
      pointer.removeEventListener('change', preferenceChanged);
      reducedMotion.removeEventListener('change', preferenceChanged);
    };
  }
  if (journey) cleanups.push(setupJourney(journey));
  function updateHeader() {
    const onScene = journey && journey.getBoundingClientRect().bottom > 95;
    const arrival = journey?.dataset.arrived === 'true';
    header.classList.toggle('plain-journey-header', !!onScene && journey.dataset.glassReady !== 'true');
    const onPortrait = portraitHero && portraitHero.getBoundingClientRect().bottom > 95;
    const storyRect = story?.getBoundingClientRect();
    const onStory = storyRect && storyRect.top < 95 && storyRect.bottom > 95;
    header.classList.toggle('on-scene', (!!onScene && !arrival) || !!onPortrait || !!onStory);
    header.classList.toggle('scrolled', scrollY > 40);
  }
  window.addEventListener('scroll', updateHeader, { passive: true }); updateHeader();
  cleanups.push(() => window.removeEventListener('scroll', updateHeader));
  const preview = $('.reel-preview video');
  if (preview) {
    let visible = false;
    const sync = () => {
      if (visible && !document.hidden && !reduced.matches && !document.body.classList.contains('modal-open')) {
        preview.src ||= preview.dataset.src; preview.play().catch(() => {});
      } else preview.pause();
    };
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { threshold: .2 });
    observer.observe(preview); document.addEventListener('visibilitychange', sync); reduced.addEventListener('change', sync);
    cleanups.push(() => { observer.disconnect(); preview.pause(); document.removeEventListener('visibilitychange', sync); reduced.removeEventListener('change', sync); });
  }
  const form = $('#brief-form');
  if (form) form.addEventListener('submit', async event => {
    event.preventDefault(); if (!form.reportValidity()) return;
    const data = new FormData(form);
    const brief = `Hello Ashutosh,\n\n${data.get('message').trim()}\n\nInterested in: ${data.getAll('topic').join(', ') || 'A conversation'}\n\n${data.get('name').trim()}\n${data.get('email').trim()}`;
    try { await copyText(brief); $('#brief-status').textContent = 'Your brief is copied. Nothing has been sent.'; toast('Brief copied to clipboard.'); }
    catch { $('#brief-status').textContent = 'Clipboard access is unavailable. Select and copy your message from the fields above.'; }
  });
  return () => cleanups.forEach(fn => fn());
}

function setupJourney(journey) {
  const stage = $('.journey-stage', journey), portal = $('.portal-picture', journey);
  const background = $('.journey-background', journey);
  const sequenceCanvas = $('#portal-sequence', journey);
  let sequence = null;
  let sequenceMobile = stage.clientWidth <= 760;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const tilt = { x: 0, y: 0, targetX: 0, targetY: 0 };
  const arrival = $('.arrival-picture', journey), hero = $('.hero-copy', journey), arrivalCopy = $('.arrival-copy', journey);
  const beyond = setupBeyond(arrival, journey);
  const passageLayer = $('.passage-layer', journey), passageHost = $('#passage-canvas', journey);
  const shade = $('.scene-shade', journey), reveal = $('.scene-reveal', journey);
  const bottom = $('.journey-bottom', journey), topline = $('.scene-topline', journey), progressLine = $('.scene-progress i', journey), motion = $('.motion-toggle', journey);
  const beats = $$('[data-beat]', journey), nav = $$('.journey-bottom nav a', journey);
  let dead = false, frame = 0, current = 0, target = 0, lastTime = 0;
  let passage = null, passageLoading = false, generation = 0, renderedTravel = 0;
  let paused = reduced.matches, dirty = true, visible = true;
  let travelHeight = 1, journeyTop = 0, stageHeight = 1, lastProgress = -1;

  function wake() {
    if (!dead && visible && !document.hidden && !document.body.classList.contains('modal-open') && !frame) {
      lastTime = 0; frame = requestAnimationFrame(tick);
    }
  }
  function paintTilt() {
    background.style.setProperty('--tilt-x', `${(-tilt.y * .9).toFixed(4)}deg`);
    background.style.setProperty('--tilt-y', `${(tilt.x * 1.4).toFixed(4)}deg`);
  }
  function resetTilt(immediate = false) {
    tilt.targetX = tilt.targetY = 0;
    if (immediate) { tilt.x = tilt.y = 0; paintTilt(); }
    else wake();
  }
  function onPointer(event) {
    if (event.pointerType !== 'mouse' || !finePointer.matches || reduced.matches || paused || !visible || document.body.classList.contains('modal-open')) return;
    tilt.targetX = clamp(event.clientX / Math.max(1, stage.clientWidth) * 2 - 1, -1, 1);
    tilt.targetY = clamp(event.clientY / Math.max(1, stageHeight) * 2 - 1, -1, 1);
    wake();
  }
  const onPointerLeave = () => resetTilt();
  const onPointerPreference = () => resetTilt(true);
  function measure() {
    const mobile = stage.clientWidth <= 760;
    if (mobile !== sequenceMobile) { sequence?.dispose(); sequence = null; sequenceMobile = mobile; }
    stageHeight = stage.clientHeight;
    // Reserve the actual text height so phone framing never crowds the introduction.
    stage.style.setProperty('--intro-copy-height', `${hero.offsetHeight}px`);
    travelHeight = Math.max(1, journey.offsetHeight - stageHeight);
    journeyTop = journey.getBoundingClientRect().top + scrollY;
    background.style.setProperty('--tilt-perspective', `${Math.max(1800, stage.clientWidth * 2.5)}px`);
    passage?.resize(); sequence?.resize(); beyond.resize(); dirty = true; onScroll();
  }
  function onScroll() {
    const offset = scrollY - journeyTop;
    target = reduced.matches ? 0 : journeyProgress(offset, travelHeight, stageHeight);
    visible = offset < journey.offsetHeight && offset + innerHeight > 0;
    if (!visible) resetTilt(true);
    // Match native scrolling immediately at the sticky boundary and on large jumps.
    if (!visible || target === 1 || Math.abs(target - current) > .35 || reduced.matches) current = target;
    wake();
  }
  async function preparePassage() {
    if (passageLoading || reduced.matches || dead) return;
    passageLoading = true;
    const requestedGeneration = generation;
    try {
      const { createPassage } = await import('./scene.js');
      if (dead || reduced.matches || generation !== requestedGeneration) return;
      passage = createPassage(passageHost);
      passage.render(renderedTravel, renderedTravel * 12);
      dirty = true; wake();
    } catch (error) {
      if (!dead && generation === requestedGeneration) {
        journey.classList.remove('webgl-ready');
        console.warn('Using the lightweight tunnel:', error.message);
      }
    }
  }
  function setVisibility(element, alpha) {
    element.style.opacity = String(alpha);
    element.style.visibility = alpha > .005 ? 'visible' : 'hidden';
    element.inert = alpha < .5;
  }
  function setPause() {
    journey.dataset.motionPaused = String(paused);
    motion.setAttribute('aria-pressed', String(paused));
    motion.textContent = `${paused ? 'Resume' : 'Pause'} motion`;
  }
  function onPause() { paused = !paused; setPause(); if (paused) resetTilt(); dirty = true; wake(); }
  function onPreference() {
    paused = reduced.matches; setPause(); resetTilt(true);
    generation++; passage?.dispose(); passage = null; passageLoading = false; renderedTravel = 0;
    sequence?.dispose(); sequence = null; beyond.reset();
    journey.classList.remove('webgl-ready');
    current = target = 0; lastProgress = -1; measure();
  }
  function onVisibility() {
    if (document.hidden || document.body.classList.contains('modal-open')) {
      cancelAnimationFrame(frame); frame = 0; lastTime = 0; resetTilt(true);
    } else { dirty = true; onScroll(); }
  }
  const resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(stage); resizeObserver.observe(journey); resizeObserver.observe(hero);
  const modalObserver = new MutationObserver(onVisibility);
  modalObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('blur', onPointerLeave);
  document.documentElement.addEventListener('pointerleave', onPointerLeave);
  finePointer.addEventListener('change', onPointerPreference);
  window.addEventListener('resize', measure);
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  reduced.addEventListener('change', onPreference);
  motion.addEventListener('click', onPause);
  setPause(); measure();

  function tick(time) {
    frame = 0;
    if (dead || !visible || document.hidden || document.body.classList.contains('modal-open')) return;
    const delta = lastTime ? Math.min((time - lastTime) / 1000, .05) : 1 / 60;
    lastTime = time;
    current = damp(current, target, delta);
    const previousX = tilt.x, previousY = tilt.y;
    tilt.x = damp(tilt.x, tilt.targetX, delta, 10);
    tilt.y = damp(tilt.y, tilt.targetY, delta, 10);
    if (tilt.x !== previousX || tilt.y !== previousY) paintTilt();
    const state = sceneState(reduced.matches ? 0 : current);
    if (current > .04 && current < .84 && !reduced.matches) preparePassage();
    if (!paused && !reduced.matches) {
      renderedTravel = state.travel;
      if (current > .70) beyond.render(current);
      if (state.portal > 0) {
        sequence ||= createFrameSequence(sequenceCanvas, { count: recording.count, mobile: sequenceMobile });
        sequence.render(state.video);
      }
    }
    if (state.portal === 0 && sequence) { sequence.dispose(); sequence = null; }
    if (passage && state.passage > 0 && (dirty || current !== lastProgress)) {
      // Scroll controls both camera movement and shader time, including in reverse.
      passage.render(renderedTravel, renderedTravel * 12);
    }

    if (dirty || current !== lastProgress) {
      portal.style.opacity = String(state.portal);
      background.style.setProperty('--portal-opacity', String(state.portalExpand === 1 ? 0 : state.portal));
      stage.style.setProperty('--portal-expand', String(state.portalExpand));
      stage.style.setProperty('--portal-mask-top', `${18 * (1 - state.portalExpand)}%`);
      stage.style.setProperty('--portal-mask-bottom', `${100 - 9 * (1 - state.portalExpand)}%`);
      // The canvas follows its expanding CSS box, including while scrolling back.
      if (sequenceMobile) sequence?.resize();
      passageLayer.style.opacity = String(state.passage);
      passageLayer.style.setProperty('--passage-scale', String(1 + renderedTravel * .5));
      arrival.style.opacity = String(state.arrival);
      arrival.style.transform = 'none';
      setVisibility(hero, state.hero); setVisibility(arrivalCopy, state.arrivalCopy * beyondState(current).copy);
      hero.style.transform = sequenceMobile ? 'none' : `translate3d(0,${-(1 - state.hero) * 24}px,0)`;
      beats.forEach(element => {
        const alpha = state[element.dataset.beat];
        setVisibility(element, alpha); element.style.transform = `translate3d(0,${(1 - alpha) * 14}px,0)`;
      });
      shade.style.opacity = String(state.hero);
      topline.style.opacity = String(state.hero * .83);
      const darkText = state.arrival > .65;
      bottom.style.color = darkText ? '#232624' : '#f3f1ec';
      bottom.style.opacity = String(1 - state.reveal); bottom.inert = state.reveal > .5;
      journey.dataset.arrived = String(darkText);
      journey.dataset.glassReady = String(current >= .84);
      header.classList.toggle('plain-journey-header', current < .84 && scrollY < journeyTop + journey.offsetHeight - 95);
      header.classList.toggle('on-scene', !darkText && scrollY < journeyTop + journey.offsetHeight - 95);
      progressLine.style.transform = `scaleX(${current})`;
      reveal.style.opacity = String(state.reveal);
      nav.forEach((link, index) => {
        const active = (current < .40 ? 0 : current < .78 ? 1 : 2) === index;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'step'); else link.removeAttribute('aria-current');
      });
    }
    lastProgress = current; dirty = false;
    if (current !== target || tilt.x !== tilt.targetX || tilt.y !== tilt.targetY) frame = requestAnimationFrame(tick);
  }
  return () => {
    beyond.dispose();
    dead = true; generation++; cancelAnimationFrame(frame); passage?.dispose(); sequence?.dispose();
    resizeObserver.disconnect(); modalObserver.disconnect();
    window.removeEventListener('pointermove', onPointer); window.removeEventListener('blur', onPointerLeave);
    document.documentElement.removeEventListener('pointerleave', onPointerLeave); finePointer.removeEventListener('change', onPointerPreference);
    window.removeEventListener('resize', measure); window.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', onVisibility); reduced.removeEventListener('change', onPreference);
    motion.removeEventListener('click', onPause);
  };
}

function render(path) {
  teardown();
  const route = normalizePath(path);
  const pages = { '/': home, '/work/': workPage, '/about/': aboutPage, '/practice/': practicePage, '/contact/': contactPage };
  const projectMatch = route.match(/^\/work\/([^/]+)\/$/);
  main.innerHTML = pages[route] ? pages[route]() : projectMatch ? projectPage(projectMatch[1]) : notFound();
  const titles = { '/': 'Personal Portfolio', '/work/': 'My Work', '/about/': 'About Me', '/practice/': 'Skills', '/contact/': 'Contact' };
  document.title = `${titles[route] || projects.find(project => project.slug === projectMatch?.[1])?.title || 'Page Not Found'} — Ashutosh Yadav`;
  $$('.desktop-nav a').forEach(link => { if (route.startsWith(link.pathname)) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  header.classList.toggle('home-header', route === '/');
  header.classList.toggle('on-scene', route === '/');
  teardown = setupPage();
}
async function navigate(url, push = true, projectImage = null) {
  if (transitionBusy) { queuedNavigation = { url, push }; return; }
  transitionBusy = true;
  $('#menu').close();
  const wasMainInert = main.inert, wasHeaderInert = header.inert;
  main.inert = header.inert = true; main.setAttribute('aria-busy', 'true');
  try {
    const commit = () => {
      // A Back/Forward event during the cover takes precedence before changing history.
      const destination = queuedNavigation || { url, push }; queuedNavigation = null;
      if (destination.push) history.pushState({}, '', destination.url.pathname + destination.url.hash);
      render(destination.url.pathname); window.scrollTo({ top: 0, behavior: 'instant' });
      if (destination.url.hash) document.getElementById(destination.url.hash.slice(1))?.scrollIntoView({ behavior: 'instant' });
    };
    if (projectImage) await projectTransition.run(projectImage, commit);
    else await pageTransition.run(commit);
  } finally {
    main.inert = wasMainInert; header.inert = wasHeaderInert;
    main.removeAttribute('aria-busy'); transitionBusy = false;
    main.focus({ preventScroll: true });
    if (queuedNavigation) {
      const next = queuedNavigation; queuedNavigation = null;
      navigate(next.url, next.push);
    }
  }
}

document.addEventListener('click', event => {
  const close = event.target.closest('[data-close]');
  if (close) { document.getElementById(close.dataset.close).close(); return; }
  if (event.target.closest('.menu-toggle')) { $('#menu').showModal(); document.body.classList.add('modal-open'); return; }
  if (event.target.closest('[data-top]')) { window.scrollTo({ top: 0, behavior: reduced.matches ? 'instant' : 'smooth' }); return; }
  const link = event.target.closest('a');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0 || link.target || link.hasAttribute('download')) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin) return;
  if (link.dataset.travel !== undefined && $('#journey')) {
    event.preventDefault();
    if (reduced.matches) { $('#work').scrollIntoView({ behavior: 'instant' }); return; }
    const journey = $('#journey');
    const viewport = $('.journey-stage', journey).clientHeight;
    window.scrollTo({ top: journey.offsetTop + journeyOffset(Number(link.dataset.travel), journey.offsetHeight - viewport, viewport), behavior: 'smooth' }); return;
  }
  if (url.pathname === location.pathname && url.hash) { const target = document.getElementById(url.hash.slice(1)); if (target) { event.preventDefault(); target.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth' }); } return; }
  if (url.pathname === location.pathname && !url.hash) { event.preventDefault(); window.scrollTo({ top: 0, behavior: reduced.matches ? 'instant' : 'smooth' }); return; }
  event.preventDefault(); navigate(url, true, link.closest('.project')?.querySelector('.project-image'));
});
window.addEventListener('popstate', () => navigate(new URL(location.href), false));
$('#menu').addEventListener('close', () => document.body.classList.remove('modal-open'));
for (const dialog of $$('dialog')) {
  dialog.addEventListener('click', event => { if (event.target !== dialog) return; const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); });
}
render(location.pathname);
requestAnimationFrame(() => { if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'instant' }); });
