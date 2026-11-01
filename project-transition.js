const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => value < .5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;
const viewport = () => ({ left: 0, top: 0, width: document.documentElement.clientWidth, height: innerHeight });
function place(image, from, to, progress, radius) {
  for (const key of ['left', 'top', 'width', 'height']) image.style[key] = `${from[key] + (to[key] - from[key]) * progress}px`;
  image.style.borderRadius = `${radius}px`;
}

// Keep the live, curved banner through the expansion, then hand the same image
// to the destination cover. Navigation happens only after the viewport is covered.
export function createProjectTransition(beginFlight, reduced = matchMedia('(prefers-reduced-motion: reduce)')) {
  let running = false, frame = 0, finishPhase = null;
  function animate(paint, duration) {
    if (reduced.matches || document.hidden) { paint(1); return Promise.resolve(); }
    return new Promise(resolve => {
      let start = null;
      const finish = () => { cancelAnimationFrame(frame); frame = 0; paint(1); finishPhase = null; resolve(); };
      finishPhase = finish;
      function draw(now) {
        start ??= now;
        const progress = clamp((now - start) / duration);
        paint(ease(progress));
        if (progress === 1) finish(); else frame = requestAnimationFrame(draw);
      }
      paint(0); frame = requestAnimationFrame(draw);
    });
  }
  const preference = () => { if (reduced.matches || document.hidden) finishPhase?.(); };
  const resize = () => finishPhase?.();
  const block = event => event.preventDefault();
  const blockKeys = event => { if ([' ', 'ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End'].includes(event.key)) event.preventDefault(); };
  return {
    async run(box, commit) {
      if (running) throw new Error('A project transition is already running');
      const source = box?.querySelector('img');
      if (!source || reduced.matches || document.hidden) { await commit(); return; }
      running = true;
      let flight = null, target = null, targetOpacity = '';
      const from = box.getBoundingClientRect();
      const host = document.createElement('div'), image = document.createElement('img');
      host.className = 'project-flight'; host.setAttribute('aria-hidden', 'true');
      image.src = source.currentSrc || source.src; image.alt = ''; image.draggable = false;
      image.className = 'project-flight-image'; host.append(image);
      host.addEventListener('wheel', block, { passive: false });
      host.addEventListener('touchmove', block, { passive: false });
      window.addEventListener('keydown', blockKeys);
      window.addEventListener('resize', resize);
      document.addEventListener('visibilitychange', preference);
      reduced.addEventListener('change', preference);
      try {
        flight = beginFlight(box);
        if (flight) { host.prepend(flight.canvas); image.style.opacity = '0'; }
        document.body.append(host);
        await animate(progress => {
          place(image, from, viewport(), progress, 12 * (1 - progress));
          if (flight) {
            try { flight.paint(progress); }
            catch { flight.finish(); flight = null; image.style.opacity = '1'; }
          }
        }, 780);
        await animate(() => {}, 90);
        await commit();
        // The route teardown defers GPU disposal until this exact full-screen handoff.
        place(image, viewport(), viewport(), 1, 0); image.style.opacity = '1';
        flight?.finish(); flight = null;
        target = document.querySelector('.case-cover img');
        if (target && (target.currentSrc || target.src) === image.src) {
          targetOpacity = target.style.opacity; target.style.opacity = '0';
          const destination = target.getBoundingClientRect();
          await animate(progress => place(image, viewport(), destination, progress, 0), 640);
        } else {
          target = null;
          await animate(progress => { host.style.opacity = String(1 - progress); }, 320);
        }
      } finally {
        cancelAnimationFrame(frame); frame = 0; finishPhase = null;
        if (target) target.style.opacity = targetOpacity;
        flight?.finish(); host.remove();
        host.removeEventListener('wheel', block); host.removeEventListener('touchmove', block);
        window.removeEventListener('keydown', blockKeys); window.removeEventListener('resize', resize);
        document.removeEventListener('visibilitychange', preference);
        reduced.removeEventListener('change', preference);
        running = false;
      }
    },
  };
}
