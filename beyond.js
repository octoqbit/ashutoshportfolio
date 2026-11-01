import { beyondState } from './beyond-motion.js';

// Keep the floating mark attached to the same scene coordinates as the platform.
export function beyondLayout(width, height) {
  const scale = Math.max(width / 1672, height / 941);
  const sceneWidth = 1672 * scale, sceneHeight = 941 * scale;
  return {
    width: sceneWidth, height: sceneHeight,
    x: (width - sceneWidth) * (width <= 760 || width < height ? .72 : .5),
    y: (height - sceneHeight) / 2,
  };
}

export function setupBeyond(arrival, journey, load = () => import('./beyond-scene.js')) {
  const composition = arrival.querySelector('.beyond-composition');
  const host = arrival.querySelector('.beyond-view');
  const light = arrival.querySelector('.beyond-golden');
  let renderer = null, loading = false, dead = false, version = 0, progress = 0;
  function resize() {
    const scene = beyondLayout(arrival.clientWidth, arrival.clientHeight);
    Object.assign(composition.style, {
      width: `${scene.width}px`, height: `${scene.height}px`,
      left: `${scene.x}px`, top: `${scene.y}px`,
    });
    renderer?.resize();
  }
  async function prepare() {
    if (loading || renderer || dead) return;
    loading = true;
    const requested = version;
    try {
      const { createBeyondScene } = await load();
      if (dead || requested !== version) return;
      renderer = createBeyondScene(host);
      renderer.render(progress);
      arrival.classList.add('beyond-ready');
    } catch (error) {
      if (!dead && requested === version) {
        arrival.classList.remove('beyond-ready');
        console.warn('Using the lightweight Beyond scene:', error.message);
      }
    }
  }
  function render(value) {
    if (dead) return;
    progress = value;
    const state = beyondState(progress);
    light.style.opacity = String(state.gold);
    arrival.style.setProperty('--beyond-turn', `${state.rotation}rad`);
    composition.style.transform = `scale(${1 + state.walk * .12 + state.enter * 6})`;
    renderer?.render(progress);
    if (progress > .70) prepare();
  }
  function reset() {
    version++; renderer?.dispose(); renderer = null; loading = false;
    arrival.classList.remove('beyond-ready');
    light.style.opacity = '0'; composition.style.transform = 'none';
  }
  resize();
  return { render, resize, reset, dispose() { dead = true; reset(); } };
}
