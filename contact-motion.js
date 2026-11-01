// Animate the existing Contact artwork; its resting paths and layout stay intact.
export function deformContactPath(source, x, y, join) {
  if (Math.abs(x) + Math.abs(y) + Math.abs(join) < .00001) return source;
  const tokens = source.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/g);
  let index = 0, px = 0, py = 0, command = null;
  const result = [];
  while (index < tokens.length) {
    if (/^[a-z]$/i.test(tokens[index])) command = tokens[index++];
    const upper = command?.toUpperCase();
    if (upper === 'Z') { result.push('Z'); command = null; continue; }
    // SVG permits multiple coordinate groups after a single command letter.
    if (!['M', 'L', 'C'].includes(upper)) return source;
    const count = upper === 'C' ? 6 : 2;
    const values = tokens.slice(index, index + count).map(Number); index += count;
    if (values.length !== count || !values.every(Number.isFinite)) return source;
    const relative = command !== upper;
    const coords = [];
    for (let i = 0; i < count; i += 2) {
      const vx = values[i] + (relative ? px : 0), vy = values[i + 1] + (relative ? py : 0);
      const t = Math.max(0, Math.min(1, (vy - 330) / 180));
      const fold = t * t * (3 - 2 * t) * join;
      coords.push((vx + x * 11 * Math.sin(vy / 560 * Math.PI) + (205 - vx) * fold * .55).toFixed(3));
      coords.push((vy + y * 8 * Math.sin(vx / 520 * Math.PI) + (445 - vy) * fold * .22).toFixed(3));
      if (i === count - 2) { px = vx; py = vy; }
    }
    result.push(upper + coords.join(' '));
    if (upper === 'M') command = relative ? 'l' : 'L';
  }
  return result.join(' ');
}

export function setupContactMotion(section) {
  const sheet = section?.querySelector('.contact-sheet');
  if (!sheet) return () => {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const paths = [...sheet.querySelectorAll('path')].map(path => [path, path.getAttribute('d')]);
  const gradient = sheet.querySelector('#contact-metal');
  const gradientTransform = gradient?.getAttribute('gradientTransform');
  const links = [...section.querySelectorAll('.contact-details a, .text-link')];
  const listeners = [], animations = [], hovered = new Set(), focused = new Set();
  const current = { x: 0, y: 0, join: 0 }, target = { x: 0, y: 0, join: 0 };
  let frame = 0, last = 0, dead = false, visible = false, entered = false;
  function listen(node, event, fn, options) {
    node.addEventListener(event, fn, options);
    listeners.push(() => node.removeEventListener(event, fn, options));
  }
  const enabled = () => !dead && visible && !reduced.matches && !document.hidden && !document.body.classList.contains('modal-open');
  function paint() {
    sheet.style.setProperty('--sheet-x', current.x.toFixed(4));
    sheet.style.setProperty('--sheet-y', current.y.toFixed(4));
    sheet.style.setProperty('--sheet-join', current.join.toFixed(4));
    for (const [path, source] of paths) path.setAttribute('d', deformContactPath(source, current.x, current.y, current.join));
    gradient?.setAttribute('gradientTransform', `rotate(${(current.x * 9 + current.join * 5).toFixed(3)} .5 .5) translate(${(current.x * .025).toFixed(4)} ${(current.y * .018).toFixed(4)})`);
  }
  function stop() { cancelAnimationFrame(frame); frame = 0; last = 0; }
  function reset() {
    stop(); hovered.clear(); focused.clear();
    for (const key of Object.keys(current)) current[key] = target[key] = 0;
    for (const [path, source] of paths) path.setAttribute('d', source);
    for (const key of ['x', 'y', 'join']) sheet.style.removeProperty(`--sheet-${key}`);
    if (gradientTransform == null) gradient?.removeAttribute('gradientTransform');
    else gradient?.setAttribute('gradientTransform', gradientTransform);
  }
  function wake() { if (!frame && enabled()) frame = requestAnimationFrame(draw); }
  function draw(now) {
    frame = 0;
    if (!enabled()) { stop(); return; }
    const dt = last ? Math.min(.05, (now - last) / 1000) : 1 / 60;
    last = now;
    const ease = 1 - Math.exp(-7.5 * dt);
    let moving = false;
    for (const key of Object.keys(current)) {
      current[key] += (target[key] - current[key]) * ease;
      if (Math.abs(current[key] - target[key]) < .0005) current[key] = target[key];
      else moving = true;
    }
    paint();
    if (moving) wake(); else last = 0;
  }
  function enter() {
    if (entered || !enabled()) return;
    entered = true;
    const elements = [section.querySelector('.eyebrow'), section.querySelector('h1'), section.querySelector('.contact-page-intro')];
    elements.forEach((element, index) => {
      if (element?.animate) animations.push(element.animate([
        { opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 850, delay: index * 100, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }));
    });
    const svg = sheet.querySelector('svg');
    if (svg?.animate) animations.push(svg.animate([
      { opacity: 0, transform: 'translateY(12px) scale(.96)' }, { opacity: 1, transform: 'translateY(0) scale(1)' },
    ], { duration: 1100, easing: 'cubic-bezier(.22,1,.36,1)' }));
  }
  function sync() {
    if (!enabled()) { reset(); animations.forEach(animation => animation.cancel()); }
    else { enter(); wake(); }
  }
  function join() { target.join = hovered.size || focused.size ? 1 : 0; wake(); }
  listen(section, 'pointermove', event => {
    if (!enabled() || !fine.matches || event.pointerType !== 'mouse') return;
    const rect = section.getBoundingClientRect();
    target.x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1) * 2 - 1));
    target.y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / Math.max(rect.height, 1) * 2 - 1));
    wake();
  }, { passive: true });
  listen(section, 'pointerleave', () => { target.x = target.y = 0; hovered.clear(); join(); });
  for (const link of links) {
    listen(link, 'pointerenter', event => { if (event.pointerType === 'mouse' && fine.matches) { hovered.add(link); join(); } });
    listen(link, 'pointerleave', () => { hovered.delete(link); join(); });
    listen(link, 'focus', () => { focused.add(link); join(); });
    listen(link, 'blur', () => { focused.delete(link); join(); });
  }
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); });
  observer.observe(section);
  const modalObserver = new MutationObserver(sync);
  modalObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  listen(reduced, 'change', sync); listen(fine, 'change', reset);
  listen(document, 'visibilitychange', sync); listen(window, 'blur', reset);
  return () => { dead = true; reset(); observer.disconnect(); modalObserver.disconnect(); listeners.forEach(remove => remove()); animations.forEach(animation => animation.cancel()); };
}
