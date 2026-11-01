const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => value < .5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2;

// Separate leading and trailing edges let a curved sheet cover the entire page
// before navigation, then peel away without exposing the DOM swap.
export function silkFrame(progress, phase) {
  const p = clamp(progress), travel = ease(p), wave = Math.sin(Math.PI * p);
  const y = 1100 - 1300 * travel;
  function curtain(offset = 0) {
    const edge = y - offset * wave;
    if (phase === 'cover') return `M0 ${edge + wave * 70} C300 ${edge - wave * 150} 680 ${edge + wave * 155} 1000 ${edge - wave * 65} L1000 1200 L0 1200Z`;
    return `M0 -250 L1000 -250 L1000 ${edge - wave * 60} C700 ${edge + wave * 160} 300 ${edge - wave * 135} 0 ${edge + wave * 65}Z`;
  }
  return {
    sheet: curtain(), edge: curtain(phase === 'cover' ? 30 : -25),
    sheen: phase === 'cover' ? travel : 1 + travel,
    mark: phase === 'cover' ? clamp((travel - .55) / .4) : 1 - clamp(travel / .45),
  };
}

export function createPageTransition(host, reduced = matchMedia('(prefers-reduced-motion: reduce)')) {
  const sheet = host.querySelector('[data-silk-sheet]');
  const edge = host.querySelector('[data-silk-edge]');
  const folds = [...host.querySelectorAll('[data-silk-fold]')];
  const gradient = host.querySelector('#silk-light');
  const mark = host.querySelector('.transition-mark');
  let frame = 0, finishPhase = null, running = false;
  function paint(progress, phase) {
    const state = silkFrame(progress, phase);
    sheet.setAttribute('d', state.sheet); edge.setAttribute('d', state.edge);
    gradient.setAttribute('gradientTransform', `rotate(${-18 + state.sheen * 16} .5 .5)`);
    folds.forEach((fold, index) => {
      const offset = index * 170, flow = state.sheen * 95;
      fold.setAttribute('d', `M-150 ${850 + offset - flow} C260 ${430 + offset + flow} 420 ${110 + offset - flow} 1150 ${-120 + offset + flow}`);
    });
    mark.style.opacity = String(state.mark);
    mark.style.transform = `translateY(${(1 - state.mark) * (phase === 'cover' ? 12 : -12)}px) scale(${.97 + state.mark * .03})`;
  }
  function animate(phase, duration) {
    if (reduced.matches || document.hidden) { paint(1, phase); return Promise.resolve(); }
    return new Promise(resolve => {
      let start = null;
      const finish = () => { cancelAnimationFrame(frame); frame = 0; paint(1, phase); finishPhase = null; resolve(); };
      finishPhase = finish;
      const draw = now => {
        start ??= now;
        const progress = clamp((now - start) / duration);
        paint(progress, phase);
        if (progress === 1) finish(); else frame = requestAnimationFrame(draw);
      };
      paint(0, phase); frame = requestAnimationFrame(draw);
    });
  }
  const preference = () => { if (reduced.matches || document.hidden) finishPhase?.(); };
  const blockScroll = event => event.preventDefault();
  return {
    async run(commit) {
      if (running) throw new Error('A page transition is already running');
      running = true;
      reduced.addEventListener('change', preference);
      document.addEventListener('visibilitychange', preference);
      host.addEventListener('wheel', blockScroll, { passive: false });
      host.addEventListener('touchmove', blockScroll, { passive: false });
      try {
        if (!reduced.matches && !document.hidden) {
          paint(0, 'cover'); host.classList.add('is-active');
          await animate('cover', 480);
        }
        await commit();
        if (host.classList.contains('is-active')) await animate('reveal', 620);
      } finally {
        cancelAnimationFrame(frame); frame = 0; finishPhase = null;
        host.classList.remove('is-active');
        mark.style.opacity = '0';
        reduced.removeEventListener('change', preference);
        document.removeEventListener('visibilitychange', preference);
        host.removeEventListener('wheel', blockScroll); host.removeEventListener('touchmove', blockScroll);
        running = false;
      }
    },
  };
}
