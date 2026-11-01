import { clamp } from './motion.js';

export const frameIndex = (progress, count) => Math.round(clamp(progress) * (count - 1));

// Fill the image area with real frame pixels, preserving their aspect ratio.
export function frameLayout(viewWidth, viewHeight, sourceWidth, sourceHeight, positionX = .5) {
  const scale = Math.max(viewWidth / sourceWidth, viewHeight / sourceHeight);
  const width = sourceWidth * scale, height = sourceHeight * scale;
  return { x: (viewWidth - width) * positionX, y: (viewHeight - height) / 2, width, height };
}

async function loadBitmap(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Frame unavailable: ${response.status}`);
  return createImageBitmap(await response.blob());
}

// A small decoded window keeps the original-resolution images affordable.
// Each draw uses one complete frame, avoiding blurred double-frame blending.
export function createFrameSequence(canvas, { count, mobile = false, load = loadBitmap, density = () => devicePixelRatio } = {}) {
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) return { render() {}, resize() {}, dispose() {} };
  const cache = new Map(), pending = new Map(), failed = new Set();
  const variant = mobile ? 'mobile' : 'desktop';
  let dead = false, target = 0, direction = 1;
  let drawn = '', revision = 0;

  function draw() {
    if (dead || !cache.size) return;
    const nearest = [...cache.keys()].sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
    const signature = `${nearest}:${revision}`;
    if (signature === drawn) return;
    const bitmap = cache.get(nearest);
    const { x, y, width, height } = frameLayout(canvas.width, canvas.height, bitmap.width, bitmap.height, mobile ? .84 - .34 * nearest / Math.max(1, count - 1) : .5);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, x, y, width, height);
    canvas.classList.add('is-ready');
    drawn = signature;
  }

  function wanted() {
    return [...new Set([target, target + direction, target - direction, target + 2 * direction, target - 2 * direction])]
      .filter(index => index >= 0 && index < count);
  }
  function pump() {
    if (dead) return;
    const window = wanted();
    for (const index of window) {
      if (pending.size >= 2) break;
      if (cache.has(index) || pending.has(index) || failed.has(index)) continue;
      const controller = new AbortController();
      pending.set(index, controller);
      const url = `/media/portal-full/${variant}/${String(index).padStart(4, '0')}.webp`;
      Promise.resolve().then(() => load(url, controller.signal)).then(bitmap => {
        if (dead || controller.signal.aborted) { bitmap.close(); return; }
        cache.set(index, bitmap);
        while (cache.size > 6) {
          const farthest = [...cache.keys()].sort((a, b) => Math.abs(b - target) - Math.abs(a - target))[0];
          cache.get(farthest).close(); cache.delete(farthest);
        }
        draw();
      }).catch(error => {
        if (error.name !== 'AbortError' && !controller.signal.aborted) failed.add(index);
      }).finally(() => { pending.delete(index); pump(); });
    }
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const sourceWidth = mobile ? 1600 : 2912, sourceHeight = mobile ? 879 : 1600;
    const sourceScale = Math.max(rect.width / sourceWidth, rect.height / sourceHeight);
    const ratio = Math.min(2, density() || 1, 1 / Math.max(.001, sourceScale));
    const width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio));
    if (width !== canvas.width || height !== canvas.height) {
      canvas.width = width; canvas.height = height; revision++; draw();
    }
  }
  resize();
  return {
    render(value) {
      if (dead) return;
      const next = frameIndex(value, count);
      if (next !== target) direction = Math.sign(next - target);
      target = next;
      // Let nearby requests finish on slower connections instead of cancelling
      // them every scroll tick. Large jumps still discard irrelevant work.
      for (const [index, controller] of pending) if (Math.abs(index - target) > 20) controller.abort();
      draw(); pump();
    },
    resize,
    dispose() {
      dead = true;
      for (const controller of pending.values()) controller.abort();
      for (const bitmap of cache.values()) bitmap.close();
      cache.clear(); canvas.classList.remove('is-ready');
      canvas.width = canvas.height = 1;
    },
  };
}
