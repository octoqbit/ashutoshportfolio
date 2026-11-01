import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { beyondState } from './beyond-motion.js';

export function createBeyondModel() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(46, 1, .035, 220);
  const pathMarble = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: .23, metalness: .02, clearcoat: .58, clearcoatRoughness: .16, ior: 1.5 });
  const bronze = new THREE.MeshStandardMaterial({ color: '#b19356', roughness: .31, metalness: .82 });
  const gold = new THREE.MeshPhysicalMaterial({ color: '#e1bf78', metalness: .88, roughness: .21, clearcoat: .45, emissive: '#bd7718', emissiveIntensity: .025 });
  const group = new THREE.Group(); scene.add(group);
  function add(geometry, material, x, y, z, name) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; mesh.name = name;
    group.add(mesh); return mesh;
  }

  // A continuous walkable causeway; the last slab meets the platform's front edge.
  const slab = new RoundedBoxGeometry(2.8, .32, 2.04, 2, .045);
  for (let i = 0; i < 21; i++) {
    const z = 29 - i * 2.1, geometry = slab.clone();
    const position = geometry.attributes.position, uv = geometry.attributes.uv;
    // World-aligned veins continue across slab joints, with no stretched face UVs.
    for (let vertex = 0; vertex < position.count; vertex++) {
      uv.setXY(vertex, (position.getX(vertex) + 1.4) / 5.6, (position.getZ(vertex) + z) / 5.6);
    }
    uv.needsUpdate = true;
    add(geometry, pathMarble, 0, .31, z, `path-${i}`);
  }
  slab.dispose();
  const edging = new THREE.BoxGeometry(.035, .025, 44.1);
  for (const x of [-1.33, 1.33]) add(edging, bronze, x, .484, 8, 'path-inlay');

  for (const [radius, y, height, material] of [[6.3,.15,.3,pathMarble],[6.06,.31,.035,bronze],[5.85,.43,.23,pathMarble],[5.58,.56,.035,bronze],[5.35,.68,.22,pathMarble]]) {
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 6);
    geometry.rotateY(Math.PI / 6);
    if (material === pathMarble) {
      const position = geometry.attributes.position, uv = geometry.attributes.uv;
      // Match the walkway's world scale so the veins continue onto the terraces.
      for (let vertex = 0; vertex < position.count; vertex++) {
        uv.setXY(vertex, (position.getX(vertex) + 1.4) / 5.6, (position.getZ(vertex) - 18) / 5.6);
      }
      uv.needsUpdate = true;
    }
    add(geometry, material, 0, y, -18, 'platform');
  }

  // Extruded versions of the header's two open chevrons, with a real central opening.
  const shape = new THREE.Shape();
  shape.moveTo(-2.2, 0); shape.lineTo(0, 3.8); shape.lineTo(2.2, 0);
  shape.lineTo(1.91, -.17); shape.lineTo(0, 3.2); shape.lineTo(-1.91, -.17); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .25, bevelEnabled: true, bevelSize: .035, bevelThickness: .035, bevelSegments: 3, steps: 1 });
  geometry.translate(0, 0, -.125);
  const logo = new THREE.Group(); logo.position.set(0, 1.8, -18); logo.name = 'floating-logo';
  for (const scale of [1, .5]) {
    const mesh = new THREE.Mesh(geometry, gold); mesh.scale.set(scale, scale, 1);
    mesh.castShadow = true; mesh.receiveShadow = true; logo.add(mesh);
  }
  group.add(logo);

  const water = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), new THREE.MeshStandardMaterial({ color: '#95a59b', metalness: .4, roughness: .32, transparent: true, opacity: .19, depthWrite: false }));
  water.rotation.x = -Math.PI / 2; water.position.y = -.03; water.name = 'water'; scene.add(water);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(130, 130), new THREE.ShadowMaterial({ opacity: .19 }));
  shadow.rotation.x = -Math.PI / 2; shadow.receiveShadow = true; shadow.name = 'shadow-water'; scene.add(shadow);
  scene.add(new THREE.HemisphereLight('#fff7de', '#6f8073', 2.5));
  const sun = new THREE.DirectionalLight('#fff0ce', 3.4); sun.position.set(-15, 24, 16);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 34, bottom: -34, near: 1, far: 110 });
  sun.shadow.normalBias = .025; sun.target.position.set(0, 0, -7); scene.add(sun, sun.target);
  const entranceLight = new THREE.PointLight('#ffc660', 0, 22, 2); entranceLight.position.set(0, 2.8, -17.6); scene.add(entranceLight);

  function pose(progress, aspect = 1.6) {
    const state = beyondState(progress);
    camera.aspect = aspect; camera.fov = aspect < 1 ? 58 : 46; camera.updateProjectionMatrix();
    camera.position.set(state.x, state.y, state.z); camera.lookAt(0, 2.75, -30);
    logo.rotation.y = state.rotation;
    logo.position.y = 1.8 + Math.sin(state.progress * Math.PI * 4) * .055 * (1 - state.enter);
    gold.emissiveIntensity = .025 + state.gold * .8;
    entranceLight.intensity = state.enter * 9 + state.gold * 24;
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    return state;
  }
  function dispose() {
    const geometries = new Set(), materials = new Set();
    scene.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) materials.add(object.material); });
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose());
    sun.shadow.map?.dispose();
  }
  pose(0);
  return { scene, camera, logo, pathMarble, sun, pose, dispose };
}
