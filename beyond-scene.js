import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createBeyondModel } from './beyond-model.js';

export function createBeyondScene(host) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0, 0); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 761 ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05; renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.append(renderer.domElement);
  const model = createBeyondModel();
  if (innerWidth < 761) model.sun.shadow.mapSize.set(1024, 1024);
  const pmrem = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04); model.scene.environment = environment.texture;
  room.dispose(); pmrem.dispose();

  let progress = 0, disposed = false;
  const marble = new THREE.TextureLoader().load('/media/path-marble.webp', () => {
    if (disposed) { marble.dispose(); return; }
    model.pathMarble.needsUpdate = true;
    render();
  });
  marble.colorSpace = THREE.SRGBColorSpace;
  marble.wrapS = marble.wrapT = THREE.MirroredRepeatWrapping;
  marble.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  model.pathMarble.map = marble;
  function render(value = progress) {
    if (disposed) return;
    progress = value;
    model.pose(progress, Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight));
    renderer.render(model.scene, model.camera);
  }
  function resize() { if (disposed) return; renderer.setSize(host.clientWidth, host.clientHeight); render(); }
  const lost = event => { event.preventDefault(); host.closest('.beyond-world')?.classList.remove('beyond-ready'); };
  const restored = () => { resize(); host.closest('.beyond-world')?.classList.add('beyond-ready'); };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  renderer.domElement.addEventListener('webglcontextrestored', restored);
  resize();
  return { render, resize, dispose() {
    disposed = true;
    renderer.domElement.removeEventListener('webglcontextlost', lost); renderer.domElement.removeEventListener('webglcontextrestored', restored);
    model.dispose(); marble.dispose(); environment.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
  } };
}
