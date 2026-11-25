// Entry point: loads data/locations.json, builds the world and runs the game loop.

import * as THREE from 'three';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import {
  configureTerrain, createTerrain, createWater, scatterNature, distanceToRoad, ROAD_WIDTH,
} from './terrain.js';
import { prepareLocations, buildLocations } from './locations.js';
import { Player } from './player.js';
import { UI, Minimap } from './ui.js';
import { detectTouch, TouchControls } from './touch.js';

const DATA_URL = 'data/locations.json';
const LABEL_FADE_START = 180;  // labels start fading beyond this distance (m)
const LABEL_HIDE = 320;        // and disappear completely here
const INTERACT_EXTRA = 8;      // "Press E" shows within a location's radius + this many metres
const CLICK_RANGE = 150;       // how far away you can click a building to read about it

async function loadData() {
  const res = await fetch(DATA_URL, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${DATA_URL} (HTTP ${res.status}).`);
  try {
    return await res.json();
  } catch (e) {
    throw new Error(`${DATA_URL} is not valid JSON: ${e.message}`);
  }
}

// A road is a list of stops: location ids ("thornwick") or [x, z] waypoints.
function resolveRoads(roads, byId) {
  return (roads ?? [])
    .map((road) => road.map((stop) => {
      if (typeof stop === 'string') {
        const l = byId.get(stop);
        if (!l) console.warn(`A road refers to unknown location id "${stop}".`);
        return l ? { x: l.x, z: l.z } : null;
      }
      return Array.isArray(stop) ? { x: stop[0], z: stop[1] } : null;
    }).filter(Boolean))
    .filter((r) => r.length >= 2);
}

function createSky() {
  const top = new THREE.Color(0x3f78c0), horizon = new THREE.Color(0xcfe0ea);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1500, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { top: { value: top }, horizon: { value: horizon } },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 top;
        uniform vec3 horizon;
        varying vec3 vDir;
        void main() {
          float t = clamp(vDir.y * 1.8, 0.0, 1.0);
          gl_FragColor = vec4(mix(horizon, top, pow(t, 0.6)), 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.renderOrder = -1;
  return { sky, horizon };
}

async function init() {
  const data = await loadData();
  const ui = new UI(data.name ?? 'The Realm');
  let touchMode = detectTouch();
  ui.setTouchMode(touchMode);

  const locations = prepareLocations(data.locations ?? []);
  const byId = new Map(locations.map((l) => [l.id, l]));
  const lakes = data.lakes ?? [];
  const roads = resolveRoads(data.roads, byId);
  configureTerrain({ locations, lakes, roads });

  // --- Renderer, scene, camera ---
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, touchMode ? 1.5 : 2)); // phones: fewer pixels, smoother
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'world';
  document.body.prepend(renderer.domElement);

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(innerWidth, innerHeight);
  labelRenderer.domElement.className = 'label-layer';
  document.body.insertBefore(labelRenderer.domElement, renderer.domElement.nextSibling);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 2000);

  const { sky, horizon } = createSky();
  scene.add(sky);
  scene.fog = new THREE.Fog(horizon, 150, 700);

  scene.add(new THREE.HemisphereLight(0xd6e9ff, 0x5a4a32, 1.3));
  const sun = new THREE.DirectionalLight(0xfff1d6, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(touchMode ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 1, far: 450 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
  const SUN_OFFSET = new THREE.Vector3(90, 160, 60);

  // --- World ---
  const terrain = createTerrain();
  scene.add(terrain, createWater());
  const updates = await buildLocations(locations, scene);

  const spawn = data.spawn ?? { x: 0, z: 40 };
  const isBlocked = (x, z) =>
    distanceToRoad(x, z) < ROAD_WIDTH * 1.6
    || Math.hypot(x - spawn.x, z - spawn.z) < 6
    || locations.some((l) => Math.hypot(x - l.x, z - l.z) < l.radius * 1.15);
  const natureColliders = scatterNature(scene, isBlocked);
  const colliders = [...locations.flatMap((l) => l.colliders), ...natureColliders];

  // --- Player ---
  const player = new Player(camera, document.body, colliders);
  const controls = player.controls;

  function goToLocation(loc) {
    // Stand in front of the entrance (placeholders face +z before "rotation"), far enough to see it all.
    const dist = Math.max(loc.radius + 12, loc.label.position.y * 1.1);
    const a = loc.group.rotation.y;
    player.teleport(loc.x + Math.sin(a) * dist, loc.z + Math.cos(a) * dist, loc.x, loc.z);
  }

  function goToHash() {
    const loc = byId.get(decodeURIComponent(location.hash.slice(1)));
    if (loc) { goToLocation(loc); return true; }
    return false;
  }

  if (!goToHash()) {
    const look = spawn.lookAt ?? [0, 0];
    player.teleport(spawn.x, spawn.z, look[0], look[1]);
  }
  addEventListener('hashchange', goToHash);

  // --- UI ---
  const minimapCanvas = document.getElementById('minimap');
  const minimap = new Minimap(minimapCanvas, locations, lakes);
  minimapCanvas.addEventListener('click', () => minimap.toggle());

  let nearby = null;
  let infoOpenedAt = null;
  const openInfo = (loc) => { ui.showInfo(loc); infoOpenedAt = camera.position.clone(); };
  const toggleInfo = () => {
    if (ui.openLocation) ui.hideInfo();
    else if (nearby) openInfo(nearby);
  };
  document.getElementById('prompt').addEventListener('click', toggleInfo);
  document.getElementById('info-close').addEventListener('click', () => ui.hideInfo());

  // Find the location under a point on screen (in -1..1 coordinates) and show its info.
  const raycaster = new THREE.Raycaster();
  raycaster.far = CLICK_RANGE;
  const clickables = [terrain, ...locations.map((l) => l.group)];
  function pickAt(ndcX, ndcY) {
    if (ui.openLocation) { ui.hideInfo(); return; }
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
    const hit = raycaster.intersectObjects(clickables, true)[0];
    let o = hit?.object;
    while (o && !o.userData.location) o = o.parent;
    if (o) openInfo(o.userData.location);
  }

  // --- Playing / paused ---
  // Desktop: playing while the mouse is captured (pointer lock); Esc pauses.
  // Touch: playing after tapping "Tap to explore"; the ☰ button pauses.
  let playing = false;
  const touchUI = document.getElementById('touch-ui');
  const touch = new TouchControls({
    area: document.getElementById('touch-area'),
    joystick: document.getElementById('joystick'),
    stick: document.getElementById('stick'),
    jumpButton: document.getElementById('btn-jump'),
    camera,
    player,
    onTap: (x, y) => pickAt((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1),
  });

  function setPlaying(on) {
    playing = on;
    ui.setOverlay(!on);
    touchUI.hidden = !(on && touchMode);
    if (!on) touch.reset();
  }

  function start() {
    if (touchMode) {
      // Full screen hides the browser bars on Android; iPhones don't support it and just ignore this.
      document.documentElement.requestFullscreen?.().catch(() => {});
      setPlaying(true);
    } else {
      controls.lock();
    }
  }

  controls.addEventListener('lock', () => setPlaying(true));
  controls.addEventListener('unlock', () => setPlaying(false));
  document.getElementById('btn-menu').addEventListener('click', () => setPlaying(false));
  document.getElementById('start').addEventListener('click', start);

  // A desktop-detected device that gets touched (e.g. a tablet in desktop mode) switches to touch controls.
  addEventListener('touchstart', () => {
    if (!touchMode) { touchMode = true; ui.setTouchMode(true); }
  }, { once: true, passive: true });

  ui.buildTravelList(locations, (loc) => {
    history.replaceState(null, '', `#${loc.id}`); // shareable link straight to this place
    goToLocation(loc);
    start();
  });
  ui.hideMessage();
  setPlaying(false);

  addEventListener('keydown', (e) => {
    if (e.code === 'KeyE') toggleInfo();
    else if (e.code === 'KeyM') minimap.toggle();
  });

  // Desktop: click a building (aim with the crosshair) to read about it.
  document.addEventListener('mousedown', (e) => {
    if (controls.isLocked && e.button === 0) pickAt(0, 0);
  });

  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    labelRenderer.setSize(innerWidth, innerHeight);
  });

  // --- Game loop ---
  const clock = new THREE.Clock();
  const dir = new THREE.Vector3();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const pos = camera.position;

    if (playing) player.update(dt);
    for (const fn of updates) fn(t);

    sky.position.copy(pos);
    sun.target.position.copy(pos);
    sun.position.copy(pos).add(SUN_OFFSET);

    nearby = null;
    let nearest = Infinity;
    for (const loc of locations) {
      const d = Math.hypot(pos.x - loc.x, pos.z - loc.z);
      const el = loc.label.element;
      el.style.opacity = d > LABEL_HIDE ? 0 : 1 - THREE.MathUtils.smoothstep(d, LABEL_FADE_START, LABEL_HIDE);
      if (d < loc.radius + INTERACT_EXTRA && d < nearest) { nearest = d; nearby = loc; }
    }
    if (ui.openLocation && infoOpenedAt && pos.distanceTo(infoOpenedAt) > 20) ui.hideInfo();
    ui.setPrompt(nearby);

    camera.getWorldDirection(dir);
    ui.setCoords(pos, dir);
    minimap.draw(pos, dir);

    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  });

  // Exposed for debugging from the browser console.
  window.world = { scene, camera, player, locations, goToLocation, touch };
}

if (location.protocol !== 'file:') {
  init().catch((err) => {
    console.error(err);
    new UI(document.title).showError(err);
  });
}
