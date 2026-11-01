// The supplied section owns input and the canvas; trails stay inside that section.
export function setupFooterSmoke(host, load = () => import('./src/components/lightswind/footer-fluid.ts')) {
  if (!host) return () => {};
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let canvas = null, fluid = null, loading = false, dead = false, failed = false;
  let inside = false, visible = true, frame = 0, lastTime = 0, lastInput = 0, generation = 0;
  let position = { x: .5, y: .5 };
  const enabled = () => !dead && !failed && visible && pointer.matches && !reduced.matches && !document.hidden && !document.body.classList.contains('modal-open');
  function stop() {
    cancelAnimationFrame(frame); frame = 0; lastTime = 0; inside = false;
    fluid?.clear();
  }
  function wake() {
    if (!frame && fluid && enabled()) frame = requestAnimationFrame(tick);
  }
  function tick(now) {
    frame = 0;
    if (!enabled() || now - lastInput > 2800) { stop(); return; }
    fluid.render(lastTime ? (now - lastTime) / 1000 : 1 / 60);
    lastTime = now;
    frame = requestAnimationFrame(tick);
  }
  function onLost(event) {
    event.preventDefault(); failed = true; stop();
  }
  async function prepare() {
    if (fluid || loading || !enabled()) return;
    loading = true;
    const version = generation;
    try {
      const { createFooterFluid } = await load();
      if (dead || generation !== version || !enabled() || !inside) return;
      canvas = document.createElement('canvas');
      canvas.className = 'footer-smoke'; canvas.setAttribute('aria-hidden', 'true');
      canvas.addEventListener('webglcontextlost', onLost);
      host.append(canvas);
      fluid = createFooterFluid(canvas);
      fluid.move(position.x, position.y, true);
      lastTime = 0; wake();
    } catch (error) {
      failed = true;
      // Keep the footer and its link usable on devices without suitable WebGL.
      const context = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
      context?.getExtension('WEBGL_lose_context')?.loseContext();
      canvas?.remove(); canvas = null;
      console.warn('Footer smoke unavailable:', error.message);
    } finally { loading = false; }
  }
  function move(event) {
    if (event.pointerType !== 'mouse' || !enabled()) return;
    const rect = host.getBoundingClientRect();
    const first = !inside;
    inside = true;
    position = {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width))),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / Math.max(1, rect.height))),
    };
    lastInput = performance.now();
    if (fluid) { fluid.move(position.x, position.y, first); wake(); }
    else prepare();
  }
  function leave() { inside = false; }
  function preferenceChanged() {
    generation++; stop();
    if (!pointer.matches || reduced.matches) {
      canvas?.removeEventListener('webglcontextlost', onLost);
      fluid?.dispose(); fluid = null; canvas?.remove(); canvas = null;
    }
  }
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (!visible) stop();
  });
  observer.observe(host);
  const resizeObserver = new ResizeObserver(() => { stop(); fluid?.resize(); });
  resizeObserver.observe(host);
  host.addEventListener('pointerenter', move, { passive: true });
  host.addEventListener('pointermove', move, { passive: true });
  host.addEventListener('pointerleave', leave);
  window.addEventListener('blur', stop);
  document.addEventListener('visibilitychange', stop);
  pointer.addEventListener('change', preferenceChanged); reduced.addEventListener('change', preferenceChanged);
  return () => {
    dead = true; generation++; stop(); observer.disconnect(); resizeObserver.disconnect();
    host.removeEventListener('pointerenter', move); host.removeEventListener('pointermove', move); host.removeEventListener('pointerleave', leave);
    window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', stop);
    pointer.removeEventListener('change', preferenceChanged); reduced.removeEventListener('change', preferenceChanged);
    canvas?.removeEventListener('webglcontextlost', onLost);
    fluid?.dispose(); canvas?.remove();
  };
}
