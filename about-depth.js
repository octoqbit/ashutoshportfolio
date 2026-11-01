// Only the architectural image moves; the foreground portrait and copy stay fixed.
export function setupAboutDepth(hero) {
  const background = hero?.querySelector('.about-architecture img');
  if (!background) return () => {};
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  let x = 0, y = 0, targetX = 0, targetY = 0, frame = 0, last = 0, visible = true, dead = false;
  const enabled = () => !dead && visible && !document.hidden && !motion.matches && pointer.matches;
  function paint() {
    background.style.setProperty('--about-look-x', x.toFixed(4));
    background.style.setProperty('--about-look-y', y.toFixed(4));
  }
  function wake() {
    if (!frame && enabled()) frame = requestAnimationFrame(draw);
  }
  function reset() {
    cancelAnimationFrame(frame); frame = 0; last = 0;
    x = y = targetX = targetY = 0; paint();
  }
  function draw(time) {
    frame = 0;
    if (!enabled()) { reset(); return; }
    const dt = last ? Math.min((time - last) / 1000, .05) : 1 / 60;
    last = time;
    const ease = 1 - Math.exp(-7 * dt);
    x += (targetX - x) * ease; y += (targetY - y) * ease;
    if (Math.abs(targetX - x) + Math.abs(targetY - y) < .0005) {
      x = targetX; y = targetY; last = 0; paint();
    } else { paint(); wake(); }
  }
  function move(event) {
    if (!enabled() || event.pointerType === 'touch') return;
    const rect = hero.getBoundingClientRect();
    targetX = Math.max(-1, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width) * 2 - 1));
    targetY = Math.max(-1, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height) * 2 - 1));
    wake();
  }
  function leave() { targetX = targetY = 0; wake(); }
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (!visible) reset();
  });
  observer.observe(hero);
  hero.addEventListener('pointermove', move, { passive: true });
  hero.addEventListener('pointerleave', leave);
  hero.addEventListener('pointercancel', leave);
  motion.addEventListener('change', reset); pointer.addEventListener('change', reset);
  document.addEventListener('visibilitychange', reset);
  window.addEventListener('blur', reset); window.addEventListener('resize', reset);
  return () => {
    dead = true; reset(); observer.disconnect();
    hero.removeEventListener('pointermove', move); hero.removeEventListener('pointerleave', leave); hero.removeEventListener('pointercancel', leave);
    motion.removeEventListener('change', reset); pointer.removeEventListener('change', reset);
    document.removeEventListener('visibilitychange', reset);
    window.removeEventListener('blur', reset); window.removeEventListener('resize', reset);
    background.style.removeProperty('--about-look-x'); background.style.removeProperty('--about-look-y');
  };
}
