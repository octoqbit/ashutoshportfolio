export const clamp = (x, min = 0, max = 1) => Math.min(max, Math.max(min, Number.isFinite(x) ? x : 0));
export const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
// Exponential damping uses elapsed time so touch, mouse and high-refresh displays agree.
export function damp(current, target, seconds, rate = 16) {
  const next = current + (target - current) * (1 - Math.exp(-Math.max(0, seconds) * rate));
  return Math.abs(target - next) < .0001 ? target : next;
}
export const range = (value, start, end) => ease((value - start) / (end - start));
export const windowAlpha = (p, start, enter, leave, end) => range(p, start, enter) * (1 - range(p, leave, end));
export function sceneState(progress) {
  const p = clamp(progress);
  return {
    progress: p,
    hero: 1 - range(p, .035, .20),
    // Fit the opening sculpture, then fill the phone before the tunnel crossfade.
    portalExpand: range(p, .20, .35),
    // The clean recording reaches its opening before we enter the 3D passage.
    video: clamp((p - .015) / .345),
    portal: 1 - range(p, .41, .48),
    passage: windowAlpha(p, .36, .43, .77, .84),
    travel: range(p, .40, .81),
    first: windowAlpha(p, .46, .50, .55, .60),
    second: windowAlpha(p, .61, .65, .70, .75),
    arrival: range(p, .73, .81),
    arrivalCopy: windowAlpha(p, .73, .79, .88, .91),
    reveal: range(p, .9936, 1),
  };
}
export function normalizePath(path) {
  return path === '/' ? '/' : `/${path.split('/').filter(Boolean).join('/')}/`;
}
