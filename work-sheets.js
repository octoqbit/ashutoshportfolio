import * as THREE from 'three';

// A subdivided image surface: each card enters from the nearest edge, with a
// soft fold. All geometry is expressed in CSS pixels to keep the DOM layout.
const vertexShader = `
  uniform vec4 uRect;
  uniform vec2 uViewport, uTilt;
  uniform float uReveal, uHover, uPortal;
  varying vec2 vUv;
  varying float vFold;
  void main() {
    vUv = uv;
    float delay = .16 * (1.0 - uv.x) + .09 * uv.y;
    float arrive = smoothstep(delay, .76 + delay, uReveal);
    float fold = sin(arrive * 3.14159265) * .42;
    vec2 size = uRect.zw * mix(.93, 1.0 + .018 * uHover, arrive);
    vec2 local = (uv - .5) * size;
    float bowl = 1.0 - pow(uv.x * 2.0 - 1.0, 2.0);
    float depth = -bowl * size.x * .022 * arrive * (1.0 - .45 * uHover);
    depth += fold * size.x * .055 * (uv.y - .25);
    depth += dot(local, uTilt);
    float lens = 1600.0 / (1600.0 - depth);
    local *= lens;
    float twist = fold * .035;
    local = mat2(cos(twist), -sin(twist), sin(twist), cos(twist)) * local;
    vec2 center = uRect.xy + uRect.zw * .5;
    vec2 pixel = center + vec2(local.x, -local.y);
    bool wide = uRect.z > uViewport.x * .7;
    vec2 entry = wide
      ? vec2(0.0, 1.0)
      : (uRect.x + uRect.z * .5 < uViewport.x * .5
        ? vec2(-1.0, 0.0)
        : vec2(1.0, 0.0));
    float distance = wide ? min(uViewport.y * .34, 300.0) : min(uViewport.x * .24, 300.0);
    pixel += entry * (1.0 - arrive) * distance;
    pixel.y += fold * size.y * .015;
    pixel = mix(pixel, vec2(uv.x * uViewport.x, (1.0 - uv.y) * uViewport.y), uPortal);
    gl_Position = vec4(pixel.x / uViewport.x * 2.0 - 1.0,
      1.0 - pixel.y / uViewport.y * 2.0, 0.0, 1.0);
    vFold = fold;
  }
`;
const fragmentShader = `
  uniform sampler2D uImage;
  uniform vec4 uRect;
  uniform vec2 uLight, uViewport;
  uniform float uAspect, uReveal, uHover, uPortal;
  varying vec2 vUv;
  varying float vFold;
  void main() {
    vec2 size = mix(uRect.zw, uViewport, uPortal);
    float aspect = size.x / size.y;
    vec2 tex = vUv - .5;
    if (aspect > uAspect) tex.y *= uAspect / aspect;
    else tex.x *= aspect / uAspect;
    tex *= mix(mix(.94, 1.0, uReveal), 1.0, uPortal);
    vec4 color = texture2D(uImage, tex + .5);
    float shine = exp(-dot(vUv - uLight, vUv - uLight) * 7.0);
    color.rgb = mix(color.rgb, vec3(.94, .96, 1.0), shine * uHover * .012 * (1.0 - uPortal));
    color.rgb *= 1.0 - vFold * .055 * (1.0 - uPortal);
    float radius = min(12.0, size.x * .025) * (1.0 - uPortal);
    vec2 edge = abs((vUv - .5) * size) - size * .5 + radius;
    float distance = length(max(edge, 0.0)) + min(max(edge.x, edge.y), 0.0) - radius;
    float alpha = 1.0 - smoothstep(-1.0, .5, distance);
    gl_FragColor = vec4(color.rgb, color.a * alpha);
    #include <colorspace_fragment>
  }
`;
const clamp = value => Math.max(0, Math.min(1, value));

export function createWorkSheets(section) {
  const canvas = document.createElement('canvas');
  canvas.className = 'work-sheet-canvas'; canvas.setAttribute('aria-hidden', 'true');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' }); }
  catch { return null; }
  renderer.setClearColor(0, 0);
  const scene = new THREE.Scene(), camera = new THREE.Camera();
  const geometry = new THREE.PlaneGeometry(1, 1, 36, 28);
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const cards = [], listeners = [];
  let dead = false, failed = false, frame = 0, last = 0, width = 0, height = 0, near = false;
  let flightActive = false, disposeRequested = false;
  const on = (target, event, handler, options) => {
    target.addEventListener(event, handler, options);
    listeners.push(() => target.removeEventListener(event, handler, options));
  };
  const blocked = () => document.hidden || document.body.classList.contains('modal-open') ||
    !!document.querySelector('#page-transition.is-active');
  function restore() {
    canvas.hidden = true;
    cards.forEach(card => card.box.classList.remove('work-sheet-ready'));
  }
  renderer.debug.onShaderError = () => { failed = true; restore(); };
  function wake() {
    if (dead || failed || flightActive) return;
    if (!near || blocked()) { cancelAnimationFrame(frame); frame = 0; last = 0; restore(); return; }
    if (!frame) frame = requestAnimationFrame(draw);
  }
  section.classList.add('work-sheets-enabled'); section.prepend(canvas);
  function resize() {
    const w = document.documentElement.clientWidth, h = innerHeight;
    if (w === width && h === height) return;
    width = w; height = h;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, fine.matches ? 2 : 1.5));
    renderer.setSize(width, height, false);
  }
  function draw(time) {
    frame = 0;
    if (flightActive) return;
    if (dead || failed || !near || blocked()) { restore(); last = 0; return; }
    resize();
    const dt = last ? Math.min(.05, (time - last) / 1000) : 1 / 60;
    last = time;
    const ease = 1 - Math.exp(-8 * dt), hoverEase = 1 - Math.exp(-6 * dt);
    let unsettled = false;
    // Read all layout first, then update geometry and reveal the rendered images.
    const bounds = cards.map(card => card.box.getBoundingClientRect());
    cards.forEach((card, i) => {
      const rect = bounds[i], u = card.material.uniforms;
      const visible = card.ready && rect.top < height + 80 && rect.bottom > -80 && rect.width > 0;
      card.mesh.visible = visible;
      if (!visible) { card.progress = null; return; }
      const raw = clamp((height - rect.top) / (height * .52));
      const target = Math.max(card.progress ?? 0, raw * raw * (3 - 2 * raw));
      card.progress ??= 0;
      card.progress += (target - card.progress) * ease;
      card.hover += ((card.over && fine.matches ? 1 : 0) - card.hover) * hoverEase;
      card.tiltX += (card.pointerX * card.hover * .11 - card.tiltX) * hoverEase;
      card.tiltY += (-card.pointerY * card.hover * .09 - card.tiltY) * hoverEase;
      unsettled ||= Math.abs(target - card.progress) > .0005 ||
        Math.abs((card.over && fine.matches ? 1 : 0) - card.hover) > .001 ||
        Math.abs(card.pointerX * card.hover * .11 - card.tiltX) + Math.abs(-card.pointerY * card.hover * .09 - card.tiltY) > .0005;
      u.uRect.value.set(rect.left, rect.top, rect.width, rect.height);
      u.uViewport.value.set(width, height); u.uReveal.value = card.progress;
      u.uHover.value = card.hover; u.uTilt.value.set(card.tiltX, card.tiltY);
      u.uLight.value.set(.5 + card.pointerX * .5, .5 - card.pointerY * .5);
    });
    try {
      renderer.render(scene, camera);
      if (failed) { restore(); return; }
      canvas.hidden = false;
      cards.forEach(card => {
        card.box.style.setProperty('--sheet-label-opacity', clamp((card.progress - .92) / .08).toFixed(3));
        card.box.classList.toggle('work-sheet-ready', card.mesh.visible);
      });
    } catch { failed = true; restore(); }
    if (unsettled && !failed) frame = requestAnimationFrame(draw);
    else last = 0;
  }
  const images = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const card = cards.find(item => item.box === entry.target);
      images.unobserve(entry.target);
      card.image.loading = 'eager';
      card.image.decode().then(() => {
        if (dead || failed) return;
        card.texture.image = card.image; card.texture.needsUpdate = true;
        card.material.uniforms.uAspect.value = card.image.naturalWidth / card.image.naturalHeight;
        card.ready = true; wake();
      }).catch(() => {});
    });
  }, { rootMargin: '600px 0px' });
  section.querySelectorAll('.project-image').forEach(box => {
    const image = box.querySelector('img');
    if (!image) return;
    const texture = new THREE.Texture();
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    const material = new THREE.ShaderMaterial({
      vertexShader, fragmentShader, transparent: true, depthTest: false, depthWrite: false,
      uniforms: { uImage: { value: texture }, uRect: { value: new THREE.Vector4() },
        uViewport: { value: new THREE.Vector2() }, uTilt: { value: new THREE.Vector2() },
        uLight: { value: new THREE.Vector2(.5, .5) }, uAspect: { value: 1 },
        uReveal: { value: 0 }, uHover: { value: 0 }, uPortal: { value: 0 } },
    });
    const mesh = new THREE.Mesh(geometry, material); mesh.frustumCulled = false; mesh.visible = false;
    scene.add(mesh);
    const card = { box, image, texture, material, mesh, ready: false, progress: null, hover: 0,
      over: false, pointerX: 0, pointerY: 0, tiltX: 0, tiltY: 0 };
    cards.push(card);
    const link = box.closest('a');
    on(link, 'pointermove', event => {
      if (event.pointerType === 'touch' || !fine.matches) return;
      const rect = box.getBoundingClientRect();
      card.pointerX = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
      card.pointerY = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
      card.over = true; wake();
    }, { passive: true });
    const leave = () => { card.over = false; card.pointerX = card.pointerY = 0; wake(); };
    on(link, 'pointerleave', leave); on(link, 'pointercancel', leave);
    on(link, 'focusin', () => { card.over = true; wake(); }); on(link, 'focusout', leave);
    images.observe(box);
  });
  const visibility = new IntersectionObserver(entries => { near = entries[0].isIntersecting; wake(); }, { rootMargin: '100px 0px' });
  visibility.observe(section);
  const sizes = new ResizeObserver(wake); cards.forEach(card => sizes.observe(card.box));
  const overlays = new MutationObserver(wake);
  overlays.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  const transition = document.querySelector('#page-transition');
  if (transition) overlays.observe(transition, { attributes: true, attributeFilter: ['class'] });
  on(window, 'scroll', wake, { passive: true }); on(window, 'resize', wake);
  on(document, 'visibilitychange', wake); on(fine, 'change', wake);
  on(window, 'blur', () => { cards.forEach(card => { card.over = false; }); wake(); });
  on(canvas, 'webglcontextlost', event => { event.preventDefault(); failed = true; cancelAnimationFrame(frame); frame = 0; restore(); });
  function dispose() {
      if (dead) return;
      if (flightActive) { disposeRequested = true; return; }
      dead = true; cancelAnimationFrame(frame); restore();
      images.disconnect(); visibility.disconnect(); sizes.disconnect(); overlays.disconnect();
      listeners.forEach(remove => remove());
      cards.forEach(card => {
        card.box.style.removeProperty('--sheet-label-opacity');
        card.texture.dispose(); card.material.dispose();
      });
      geometry.dispose(); renderer.dispose(); renderer.forceContextLoss();
      canvas.remove(); section.classList.remove('work-sheets-enabled');
  }
  return {
    beginFlight(box) {
      const card = cards.find(item => item.box === box && item.ready && item.mesh.visible);
      if (!card || failed || dead || flightActive) return null;
      flightActive = true; cancelAnimationFrame(frame); frame = 0;
      cards.forEach(item => {
        item.mesh.visible = item === card;
        if (item !== card) item.box.classList.remove('work-sheet-ready');
      });
      let finished = false;
      return {
        canvas,
        paint(progress) {
          if (failed || dead) throw new Error('Project surface unavailable');
          resize();
          card.material.uniforms.uViewport.value.set(width, height);
          card.material.uniforms.uPortal.value = progress;
          renderer.render(scene, camera); canvas.hidden = false;
        },
        finish() {
          if (finished) return;
          finished = true; flightActive = false;
          card.material.uniforms.uPortal.value = 0;
          if (disposeRequested) dispose();
          else { section.prepend(canvas); wake(); }
        },
      };
    },
    dispose,
  };
}
