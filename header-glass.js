// Water highlights live inside the header. Links and their hit areas never move.
export function setupHeaderGlass(header) {
  const surface = document.createElement('div'); surface.className = 'header-liquid-surface'; surface.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas'); surface.append(canvas); header.prepend(surface);
  const context = canvas.getContext('2d');
  if (!context) { surface.remove(); return () => {}; }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const contact = header.querySelector('.liquid-contact');
  let width = 1, height = 1, frame = 0, last = 0, dead = false, active = false, emitted = 0;
  let x = 0, y = 0, tx = 0, ty = 0, vx = 0, vy = 0, strength = 0;
  let contactX = 0, contactY = 0, targetContactX = 0, targetContactY = 0;
  const ripples = [];
  const suppressed = () => reduced.matches || header.classList.contains('plain-journey-header');
  const wake = () => { if (!frame && !dead && !suppressed() && !document.hidden) frame = requestAnimationFrame(draw); };
  function resize() {
    const rect = header.getBoundingClientRect(); width = rect.width; height = rect.height;
    const density = Math.min(2, globalThis.devicePixelRatio || 1);
    canvas.width = Math.round(width * density); canvas.height = Math.round(height * density);
    context.setTransform(density, 0, 0, density, 0, 0);
    x = tx = width / 2; y = ty = height / 2; vx = vy = 0;
    if (active) wake();
  }
  function point(event) {
    const rect = header.getBoundingClientRect();
    tx = Math.max(0, Math.min(width, event.clientX - rect.left));
    ty = Math.max(0, Math.min(height, event.clientY - rect.top));
    active = true;
    const button = contact?.getBoundingClientRect();
    const inside = button && event.clientX >= button.left && event.clientX <= button.right && event.clientY >= button.top && event.clientY <= button.bottom;
    targetContactX = inside ? (event.clientX - button.left - button.width / 2) * .14 : 0;
    targetContactY = inside ? (event.clientY - button.top - button.height / 2) * .2 : 0;
  }
  function ripple(power) {
    ripples.push({ x: tx, y: ty, age: 0, power });
    if (ripples.length > 8) ripples.shift();
  }
  function move(event) {
    if (suppressed() || event.pointerType === 'touch') return;
    point(event);
    if (event.timeStamp - emitted > 115 && Math.hypot(tx - x, ty - y) > 10) { ripple(.48); emitted = event.timeStamp; }
    wake();
  }
  function press(event) {
    if (suppressed()) return;
    point(event); x = tx; y = ty; ripple(.85); wake();
    if (event.pointerType === 'touch') leave();
  }
  function leave() { active = false; targetContactX = targetContactY = 0; wake(); }
  function clear() {
    cancelAnimationFrame(frame); frame = 0; last = 0; active = false; strength = 0; ripples.length = 0;
    vx = vy = contactX = contactY = targetContactX = targetContactY = 0;
    context.clearRect(0, 0, width, height);
    contact?.style.setProperty('--liquid-x', '0px'); contact?.style.setProperty('--liquid-y', '0px');
  }
  function visibility() { if (document.hidden) clear(); }
  function draw(time) {
    frame = 0;
    if (dead || suppressed() || document.hidden) { clear(); return; }
    const dt = last ? Math.min((time - last) / 1000, .035) : 1 / 60; last = time;
    // A damped spring gives the surface weight without displacing navigation text.
    vx += ((tx - x) * 85 - vx * 13) * dt; vy += ((ty - y) * 85 - vy * 13) * dt;
    x += vx * dt; y += vy * dt;
    const ease = 1 - Math.exp(-9 * dt);
    strength += ((active ? 1 : 0) - strength) * ease;
    contactX += (targetContactX - contactX) * ease; contactY += (targetContactY - contactY) * ease;
    contact?.style.setProperty('--liquid-x', `${contactX.toFixed(2)}px`);
    contact?.style.setProperty('--liquid-y', `${contactY.toFixed(2)}px`);
    context.clearRect(0, 0, width, height);
    if (strength > .005) {
      const flow = Math.min(1, Math.hypot(vx, vy) / 900);
      context.save(); context.translate(x, y); context.scale(2.6 + flow * 1.2, .65 - flow * .15);
      const sheen = context.createRadialGradient(0, 0, 0, 0, 0, 70);
      sheen.addColorStop(0, `rgba(255,255,245,${.1 * strength})`); sheen.addColorStop(.4, `rgba(255,255,245,${.035 * strength})`); sheen.addColorStop(1, 'rgba(255,255,245,0)');
      context.fillStyle = sheen; context.fillRect(-70, -70, 140, 140); context.restore();
      // Curved light/dark pairs give the clear surface a liquid lens edge.
      // Velocity stretches the reflections; the spring lets them settle naturally.
      const span = 150 + flow * 100, bend = Math.max(-10, Math.min(10, vy * .025));
      for (const edge of [-1, 1]) {
        const rim = edge < 0 ? 4 : height - 5;
        const crest = rim + edge * (7 + flow * 9) + bend;
        for (const shade of [true, false]) {
          const offset = shade ? edge * 1.5 : 0;
          context.beginPath();
          context.moveTo(x - span, rim + offset);
          context.bezierCurveTo(x - span * .4, crest + offset, x + span * .3, rim - edge * 13 + offset, x + span, rim + offset);
          context.strokeStyle = shade ? `rgba(20,42,34,${strength * .2})` : `rgba(255,255,255,${strength * .65})`;
          context.lineWidth = shade ? 2 : 1.2; context.stroke();
        }
      }
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const wave = ripples[i]; wave.age += dt;
      if (wave.age >= 1.65) { ripples.splice(i, 1); continue; }
      const radius = 7 + wave.age * 76, opacity = Math.pow(1 - wave.age / 1.65, 2) * wave.power;
      context.beginPath(); context.ellipse(wave.x, wave.y, radius, radius * .52, 0, 0, Math.PI * 2);
      context.strokeStyle = `rgba(255,255,248,${opacity * .38})`; context.lineWidth = 1; context.stroke();
      context.beginPath(); context.ellipse(wave.x, wave.y + 1.5, radius + 2, radius * .52 + 1, 0, 0, Math.PI * 2);
      context.strokeStyle = `rgba(26,45,38,${opacity * .24})`; context.stroke();
    }
    const moving = Math.abs(tx - x) + Math.abs(ty - y) + Math.abs(vx) + Math.abs(vy) > .08;
    if (moving || ripples.length || Math.abs((active ? 1 : 0) - strength) > .005 || Math.abs(contactX - targetContactX) + Math.abs(contactY - targetContactY) > .01) wake();
    else last = 0;
  }
  const observer = new ResizeObserver(resize); observer.observe(header);
  const modeObserver = new MutationObserver(() => { if (suppressed()) clear(); });
  modeObserver.observe(header, { attributes: true, attributeFilter: ['class'] });
  header.addEventListener('pointermove', move, { passive: true }); header.addEventListener('pointerdown', press, { passive: true }); header.addEventListener('pointerleave', leave);
  reduced.addEventListener('change', clear); document.addEventListener('visibilitychange', visibility); window.addEventListener('blur', clear);
  resize();
  return () => {
    dead = true; clear(); observer.disconnect(); modeObserver.disconnect(); surface.remove();
    header.removeEventListener('pointermove', move); header.removeEventListener('pointerdown', press); header.removeEventListener('pointerleave', leave);
    reduced.removeEventListener('change', clear); document.removeEventListener('visibilitychange', visibility); window.removeEventListener('blur', clear);
  };
}
