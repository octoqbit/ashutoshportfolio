// Work-page entrances and a lazily loaded, scroll-driven sheet surface.
const galleries = new WeakMap();
export function beginProjectFlight(box) {
  return galleries.get(box.closest('.work-section'))?.beginFlight(box) || null;
}
export function setupWorkMotion(section, reduced = matchMedia('(prefers-reduced-motion: reduce)'), loadSheets = () => import('./work-sheets.js')) {
  if (!section) return () => {};
  let disposed = false, visible = false, pending = false, sheets = null, generation = 0;
  const animations = new Set();
  const heading = section.querySelector('.work-heading h1, .work-heading h2');
  const originalHeading = heading?.innerHTML;
  const words = [];
  if (heading && !reduced.matches) {
    const walker = document.createTreeWalker(heading, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const fragment = document.createDocumentFragment();
      for (const part of node.textContent.split(/(\s+)/)) {
        if (!part.trim()) { fragment.append(document.createTextNode(part)); continue; }
        const mask = document.createElement('span'), word = document.createElement('span');
        mask.className = 'work-word-mask'; word.className = 'work-word';
        word.textContent = part; mask.append(word); fragment.append(mask); words.push(word);
      }
      node.replaceWith(fragment);
    }
  }
  const reveal = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      reveal.unobserve(entry.target);
      if (reduced.matches) continue;
      const targets = entry.target === heading ? words : [entry.target];
      targets.forEach((target, index) => {
        const isWord = entry.target === heading;
        const animation = target.animate([
          { opacity: 0, transform: isWord ? 'translateY(105%) rotate(3deg)' : 'translateY(26px)' },
          { opacity: 1, transform: 'translateY(0) rotate(0deg)' },
        ], { duration: isWord ? 950 : 850, delay: isWord ? index * 55 : 0, easing: 'cubic-bezier(.18,.72,.22,1)', fill: 'backwards' });
        animations.add(animation);
        animation.finished.catch(() => {}).finally(() => animations.delete(animation));
      });
    }
  }, { threshold: .08 });
  if (heading) reveal.observe(heading);
  section.querySelectorAll('.work-heading > div, .project-caption').forEach(node => reveal.observe(node));

  async function load() {
    if (disposed || pending || sheets || !visible || reduced.matches || navigator.connection?.saveData) return;
    pending = true;
    const token = ++generation;
    try {
      const { createWorkSheets } = await loadSheets();
      if (!disposed && token === generation && !reduced.matches) {
        sheets = createWorkSheets(section);
        if (sheets) galleries.set(section, sheets);
      }
    } catch { /* The original, accessible image cards remain the fallback. */ }
    finally {
      pending = false;
      if (token !== generation) load();
    }
  }
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) load();
  }, { rootMargin: '500px 0px' });
  observer.observe(section);
  function preference() {
    if (reduced.matches) {
      generation++;
      sheets?.dispose(); sheets = null;
      galleries.delete(section);
      animations.forEach(animation => animation.finish());
    } else load();
  }
  reduced.addEventListener('change', preference);
  return () => {
    disposed = true; generation++;
    observer.disconnect(); reveal.disconnect();
    reduced.removeEventListener('change', preference);
    animations.forEach(animation => animation.cancel()); animations.clear();
    sheets?.dispose();
    galleries.delete(section);
    if (heading && originalHeading !== undefined) heading.innerHTML = originalHeading;
  };
}
