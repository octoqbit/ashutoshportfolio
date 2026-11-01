// Paragraphs type once as they enter view; the heading stays fully visible.
export function setupStoryMotion(section) {
  const paragraphs = [...(section?.querySelectorAll('.story-columns p') || [])];
  if (!paragraphs.length) return () => {};
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches) return () => {};
  let completeTimer;
  const originals = paragraphs.map(paragraph => [paragraph, paragraph.innerHTML]);
  let lastDelay = 0;
  paragraphs.forEach((paragraph, order) => {
    const accessible = document.createElement('span');
    accessible.className = 'story-accessible-text';
    accessible.textContent = paragraph.textContent;
    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true'); visual.className = 'story-typing';
    while (paragraph.firstChild) visual.append(paragraph.firstChild);
    let index = 0;
    const step = Math.max(10, Math.min(20, 3200 / Math.max(1, visual.textContent.length)));
    function wrap(node) {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === Node.TEXT_NODE) {
          const fragment = document.createDocumentFragment();
          for (const character of child.textContent) {
            const span = document.createElement('span');
            span.className = 'story-character'; span.textContent = character;
            const delay = 180 + order * 180 + index++ * step;
            lastDelay = Math.max(lastDelay, delay);
            span.style.setProperty('--type-delay', `${delay}ms`);
            span.style.setProperty('--type-step', `${step}ms`);
            span.style.animationDelay = `${delay}ms`;
            span.style.animationDuration = '80ms';
            span.style.animationFillMode = 'forwards';
            fragment.append(span);
          }
          child.replaceWith(fragment);
        } else if (child.nodeType === Node.ELEMENT_NODE) wrap(child);
      }
    }
    wrap(visual); paragraph.append(accessible, visual);
  });
  section.classList.add('story-motion-ready');
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      if (entry.target !== section) continue;
      section.classList.add('story-entered');
      paragraphs.forEach(paragraph => paragraph.classList.add('story-paragraph-entered'));
      completeTimer = setTimeout(() => section.classList.add('story-complete'), lastDelay + 100);
      observer.unobserve(section);
    }
  }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });
  observer.observe(section);
  function restore() {
    observer.disconnect(); clearTimeout(completeTimer);
    section.classList.remove('story-motion-ready', 'story-entered', 'story-complete');
    for (const [paragraph, html] of originals) {
      paragraph.innerHTML = html; paragraph.classList.remove('story-paragraph-entered');
    }
  }
  function preference() { if (reduced.matches) restore(); }
  reduced.addEventListener('change', preference);
  return () => { reduced.removeEventListener('change', preference); restore(); };
}
