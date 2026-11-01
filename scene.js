import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function roundedPath(path, w, h, r) {
  const x = -w / 2, y = -h / 2;
  path.moveTo(x + r, y); path.lineTo(x + w - r, y); path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r); path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h); path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r); path.quadraticCurveTo(x, y, x + r, y);
  return path;
}

export function createHeroObject(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 761 ? 1.25 : 1.65));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, .1, 100);
  camera.position.set(0, .1, 10);
  const group = new THREE.Group();
  scene.add(group);
  scene.add(new THREE.HemisphereLight('#f5ead7', '#17251f', 2.3));
  const key = new THREE.DirectionalLight('#fff1d1', 4);
  key.position.set(-4, 6, 8);
  scene.add(key);
  const rim = new THREE.PointLight('#83b69b', 15, 20);
  rim.position.set(3, -1, 4);
  scene.add(rim);

  const liquid = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, pointer: { value: new THREE.Vector2() } },
    vertexShader: `uniform float time; uniform vec2 pointer; varying vec3 vPosition;
      void main(){ vec3 p=position; float wave=sin(p.x*2.7+time*1.5)+cos(p.z*3.2-time*1.15);
      p.y += wave*.08*(1.0-smoothstep(-1.7,1.7,p.y)); p.x += pointer.x*.05;
      vPosition=p; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
    fragmentShader: `uniform float time; varying vec3 vPosition;
      void main(){ float field=sin(vPosition.y*2.1+sin(vPosition.x*2.6+time)*1.4+cos(vPosition.y*1.5-time)*.7);
      float secondary=sin(vPosition.x*3.2+cos(vPosition.y*2.4+time)*1.2);
      float veins=1.0-smoothstep(.02,.14,abs(field))+.35*(1.0-smoothstep(.02,.1,abs(secondary)));
      vec3 color=vec3(.035,.075,.068)+vec3(.72,.52,.25)*veins;
      float sheen=pow(max(0.0,1.0-length(vPosition.xz*.45)),3.0);
      gl_FragColor=vec4(color+vec3(.08,.1,.08)*sheen,.96); }`,
  });
  const liquidMesh = new THREE.Mesh(new RoundedBoxGeometry(2.8, 4.15, .72, 7, .24), liquid);
  liquidMesh.position.set(0, -.25, .28);
  group.add(liquidMesh);

  const frameShape = roundedPath(new THREE.Shape(), 4.25, 5.45, .72);
  frameShape.holes.push(roundedPath(new THREE.Path(), 3.15, 4.35, .5));
  const frameGeometry = new THREE.ExtrudeGeometry(frameShape, {
    depth: .22, bevelEnabled: true, bevelSegments: 3, bevelSize: .1, bevelThickness: .08, curveSegments: 16,
  });
  const shell = new THREE.MeshStandardMaterial({ color: '#202a2b', metalness: .92, roughness: .24 });
  const trim = new THREE.LineBasicMaterial({ color: '#c9b58c', transparent: true, opacity: .72, depthTest: false });
  for (let i = 0; i < 15; i++) {
    const frame = new THREE.Mesh(frameGeometry, shell);
    frame.position.set(i * .075, i * .025, -.12 - i * .3);
    frame.scale.set(1 + i * .012, 1 + i * .008, 1);
    group.add(frame);
    const frameHighlight = new THREE.LineSegments(new THREE.EdgesGeometry(frameGeometry, 35), trim);
    frameHighlight.position.copy(frame.position);
    frameHighlight.rotation.copy(frame.rotation);
    frameHighlight.scale.copy(frame.scale);
    frameHighlight.renderOrder = 3;
    frameHighlight.material.opacity = i === 0 ? .95 : .42 + (i % 3) * .14;
    group.add(frameHighlight);
  }
  group.rotation.set(-.06, -.28, .035);

  let width = innerWidth, height = innerHeight, disposed = false;
  function onLost(event) {
    event.preventDefault();
    host.closest('.journey')?.classList.remove('hero-ready');
  }
  function resize() {
    width = innerWidth; height = innerHeight;
    const rect = host.getBoundingClientRect();
    camera.aspect = Math.max(.5, rect.width / Math.max(1, rect.height));
    camera.updateProjectionMatrix();
    renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false);
  }
  function render(time, pointer, visibility = 1) {
    if (disposed) return;
    liquid.uniforms.time.value = time;
    liquid.uniforms.pointer.value.set(pointer.x, pointer.y);
    group.rotation.y = -.18 + pointer.x * .08;
    group.rotation.x = -.04 + pointer.y * .04;
    group.position.y = Math.sin(time * .7) * .08;
    group.scale.setScalar(.92 + visibility * .08);
    renderer.render(scene, camera);
  }
  function dispose() {
    disposed = true;
    renderer.domElement.removeEventListener('webglcontextlost', onLost);
    scene.traverse(object => {
      object.geometry?.dispose();
      if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => material.dispose());
    });
    renderer.dispose();
    renderer.domElement.remove();
  }
  renderer.domElement.addEventListener('webglcontextlost', onLost);
  resize();
  render(0, { x: 0, y: 0 });
  host.closest('.journey')?.classList.add('hero-ready');
  return { render, resize, dispose };
}

export function createPassage(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
  host.append(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#0d1514');
  scene.fog = new THREE.FogExp2('#18221e', .009);
  const camera = new THREE.PerspectiveCamera(47, innerWidth / innerHeight, .07, 180);
  const generator = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const environment = generator.fromScene(room, .05); scene.environment = environment.texture;
  scene.environmentIntensity = 1.1; room.dispose(); generator.dispose();
  scene.add(new THREE.HemisphereLight('#eee1c8', '#0b1615', 2));
  const light = new THREE.PointLight('#f6d4a0', 45, 35, 1.5); scene.add(light);
  const rim = new THREE.DirectionalLight('#e7e9df', 3); rim.position.set(7, 10, 8); scene.add(rim);
  const shape = roundedPath(new THREE.Shape(), 8.8, 10.8, 2);
  shape.holes.push(roundedPath(new THREE.Path(), 7.9, 9.9, 1.75));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .16, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .08, bevelThickness: .07, curveSegments: 12 });
  const dark = new THREE.MeshStandardMaterial({ color: '#45504b', metalness: .94, roughness: .18 });
  const gold = new THREE.MeshStandardMaterial({ color: '#b7a181', metalness: .89, roughness: .17, emissive: '#9d804e', emissiveIntensity: .10 });
  const frames = new THREE.Group(); scene.add(frames);
  for (let i = 0; i < 33; i++) {
    const frame = new THREE.Mesh(geometry, i % 4 === 0 ? gold : dark);
    frame.position.z = -i * 2.25;
    frame.rotation.z = Math.sin(i * .15) * .06;
    frames.add(frame);
    if (i % 4 === 0) {
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 45), new THREE.LineBasicMaterial({ color: '#decca7', transparent: true, opacity: .45 }));
      edges.position.copy(frame.position); edges.rotation.copy(frame.rotation); frames.add(edges);
    }
  }
  const exit = new THREE.Mesh(new THREE.PlaneGeometry(11, 13), new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv; uniform float time;
      void main(){vec2 p=(vUv-.5)*2.;float d=length(p*vec2(1.,.8));float a=atan(p.y,p.x);
      float wave=sin(d*20.-time*.8+sin(a*4.+time*.2)*1.8);
      float glow=pow(max(0.,1.-d),2.);vec3 base=mix(vec3(.11,.17,.15),vec3(.93,.87,.71),glow);
      base+=vec3(.25,.20,.11)*pow(max(0.,wave),12.)*(1.-smoothstep(.5,1.,d));
      gl_FragColor=vec4(base,1.);}`,
    side: THREE.DoubleSide,
  }));
  exit.position.z = -80; scene.add(exit);
  const particlesGeometry = new THREE.BufferGeometry();
  const coords = new Float32Array(110 * 3);
  for (let i = 0; i < 110; i++) { coords[i * 3] = Math.sin(i * 13.37) * 3.6; coords[i * 3 + 1] = Math.cos(i * 7.17) * 4.6; coords[i * 3 + 2] = -i * .72; }
  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(coords, 3));
  const dust = new THREE.Points(particlesGeometry, new THREE.PointsMaterial({ color: '#efdec0', size: .025, transparent: true, opacity: .4 })); scene.add(dust);
  let width = innerWidth, height = innerHeight, disposed = false, lost = false;
  function resize() { renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight); camera.aspect = width / height; camera.fov = width < 761 ? 58 : 47; camera.updateProjectionMatrix(); renderer.setSize(width, height, false); }
  function render(travel, time, pointer = { x: 0, y: 0 }) {
    if (disposed || lost) return;
    camera.position.set(Math.sin(travel * Math.PI) * .35 + pointer.x * .08, -.1 + pointer.y * .06, 3 - travel * 68);
    camera.lookAt(0, 0, camera.position.z - 20);
    light.position.set(-1.5, 2, camera.position.z - 3);
    frames.rotation.z = Math.sin(time * .08) * .015;
    exit.material.uniforms.time.value = time; dust.rotation.z = time * .002;
    renderer.render(scene, camera);
  }
  function onLost(event) { event.preventDefault(); lost = true; host.closest('.journey')?.classList.remove('webgl-ready'); }
  renderer.domElement.addEventListener('webglcontextlost', onLost);
  resize(); render(0, 0);
  host.closest('.journey')?.classList.add('webgl-ready');
  function dispose() {
    disposed = true;
    renderer.domElement.removeEventListener('webglcontextlost', onLost);
    const geometries = new Set(), materials = new Set();
    scene.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material)); });
    geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    environment.dispose(); renderer.dispose(); renderer.domElement.remove();
  }
  return { render, resize, dispose };
}
