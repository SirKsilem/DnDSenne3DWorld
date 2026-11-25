// Holmstead: loads the map data, builds the town and runs the game loop.

import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Physics } from './engine/physics.js';
import { LightPool } from './engine/lights.js';
import { Kit } from './engine/kit.js';
import { loadHeightmap, createTerrain, createWater, createOuterGround, WATER_LEVEL } from './world/terrain.js';
import { BuildingIndex, minAreaRect, buildBuildings, buildWalls, buildCastle, buildQuays, buildBridges, bridgeLines, scatterTrees } from './world/city.js';
import { Player } from './player.js';
import { UI, Minimap } from './ui.js';
import { detectTouch, TouchControls } from './touch.js';

const DATA = 'data/holmstead/';
const LABEL_FADE = [140, 320];
const DISTRICT_FADE = [450, 900]; // district names show from 120 m to ~700 m away
const CLICK_RANGE = 120;

async function getJSON(file) {
  const res = await fetch(DATA + file, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${DATA + file} (HTTP ${res.status}).`);
  try { return await res.json(); } catch (e) { throw new Error(`${DATA + file} is not valid JSON: ${e.message}`); }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

async function loadLanduse(meta) {
  const img = await loadImage(DATA + meta.file);
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, img.width, img.height).data;
  const data = new Uint8Array(img.width * img.height);
  for (let i = 0; i < data.length; i++) data[i] = Math.round(px[i * 4] / 40);
  return { ...meta, cols: img.width, rows: img.height, data };
}

function createSky() {
  const top = new THREE.Color(0x4a82c4), horizon = new THREE.Color(0xd8e4ea);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(2500, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { top: { value: top }, horizon: { value: horizon } },
      vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 horizon; varying vec3 vDir;
        void main() { float t = clamp(vDir.y * 1.8, 0.0, 1.0); gl_FragColor = vec4(mix(horizon, top, pow(t, 0.6)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
    }),
  );
  sky.renderOrder = -1;
  return { sky, horizon };
}

/** Turn a footprint rectangle so its front (+z) faces the most open side (the street). */
function bestFront(index, x, z, w, d, angle) {
  let best = null;
  for (let k = 0; k < 4; k++) {
    const a = angle + (k * Math.PI) / 2;
    const ww = k % 2 ? d : w, dd = k % 2 ? w : d;
    const fx = Math.sin(a), fz = Math.cos(a), rx = Math.cos(a), rz = -Math.sin(a);
    let score = 0;
    for (const s of [2, 5, 9]) for (const t of [-0.3, 0, 0.3]) {
      const px = x + fx * (dd / 2 + s) + rx * t * ww, pz = z + fz * (dd / 2 + s) + rz * t * ww;
      if (!index.at(px, pz)) score++;
    }
    if (!best || score > best.score) best = { score, angle: a, w: ww, d: dd };
  }
  return best;
}

async function init() {
  const [world, buildings, placesData] = await Promise.all([getJSON('world.json'), getJSON('buildings.json'), getJSON('places.json')]);
  const ui = new UI(placesData.name ?? world.name, placesData.subtitle);
  let touchMode = detectTouch();
  ui.setTouchMode(touchMode);
  ui.setLoading('Loading the map…');

  const texLoader = new THREE.TextureLoader();
  const [hm, groundTex, minimapImg, landuse] = await Promise.all([
    loadHeightmap(DATA + world.heightmap.file, world.heightmap),
    texLoader.loadAsync(DATA + world.ground),
    loadImage(DATA + world.minimap),
    loadLanduse(world.landuse),
  ]);
  const heightAt = hm.heightAt;

  // --- Renderer, scene, camera ---
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, touchMode ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'world';
  document.body.prepend(renderer.domElement);
  groundTex.colorSpace = THREE.SRGBColorSpace;
  groundTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(innerWidth, innerHeight);
  labelRenderer.domElement.className = 'label-layer';
  document.body.insertBefore(labelRenderer.domElement, renderer.domElement.nextSibling);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 4000);
  const { sky, horizon } = createSky();
  scene.add(sky);
  scene.fog = new THREE.Fog(horizon, 260, 1200);
  scene.add(new THREE.HemisphereLight(0xd6e9ff, 0x8a7656, 1.4));
  scene.add(new THREE.AmbientLight(0xfff1dc, 0.55)); // so interiors and ceilings aren't pitch black
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.6);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(touchMode ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 500 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.06;
  scene.add(sun, sun.target);
  const SUN_OFFSET = new THREE.Vector3(110, 180, 70);

  // --- World ---
  const physics = new Physics(heightAt);
  physics.waterFloor = WATER_LEVEL - 1.1; // you swim rather than sink
  const ctx = {
    scene, physics, heightAt, world,
    lights: new LightPool(scene, 6),
    updates: [], locations: [], clickables: [], gates: [],
    touch: touchMode,
  };
  const index = new BuildingIndex(buildings);
  ctx.buildingAt = (x, z) => index.at(x, z);

  // Where each place goes, and which map buildings it replaces.
  const skipIds = new Set();
  const keepOut = [];
  const frames = placesData.places.map((p) => {
    let x = p.x, z = p.z, angle = THREE.MathUtils.degToRad(p.angle ?? 0), w = p.w ?? 12, d = p.d ?? 12;
    if (p.footprint) {
      const b = index.at(p.x, p.z) ?? index.nearest(p.x, p.z);
      if (b) {
        const r = minAreaRect(b.pts);
        ({ cx: x, cz: z, w, d } = r);
        angle = r.angle;
        skipIds.add(b.id);
      } else console.warn(`${p.name}: no building found on the map at ${p.x}, ${p.z}`);
    }
    if (p.footprint || p.autoFront) ({ angle, w, d } = bestFront(index, x, z, w, d, angle));
    const clear = p.clear ?? Math.max(w, d) * 0.55;
    if (clear > 0) {
      keepOut.push({ x, z, r: clear });
      for (const b of index.buildings) if (Math.hypot(b.cx - x, b.cz - z) < clear) skipIds.add(b.id);
    }
    return { place: p, x, z, angle, w, d };
  });

  // Keep the ends of every bridge clear of map buildings.
  for (const br of bridgeLines(world, 6)) {
    const [ax, az] = br.a, [bx, bz] = br.b, L = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / L, nz = (bx - ax) / L;
    for (let s = 0; s <= L; s += 1.5) for (const o of [-br.width / 2, 0, br.width / 2]) {
      const hit = index.at(ax + ((bx - ax) * s) / L + nx * o, az + ((bz - az) * s) / L + nz * o);
      if (hit) skipIds.add(hit.id);
    }
  }

  ui.setLoading('Building Holmstead…');
  for (const f of frames) {
    try {
      const mod = await import(`./places/${f.place.module}.js`);
      const kit = new Kit(ctx, { x: f.x, z: f.z, y: heightAt(f.x, f.z), angle: f.angle });
      await mod.default.build(kit, { ...f.place, w: f.w, d: f.d }, ctx);
      kit.finalize();
      ctx.clickables.push(kit.group);
      // travelling here puts you a few metres in front of the place's front side
      if (kit.mainLocation && kit.mainLocation.approach === undefined) kit.mainLocation.approach = f.d / 2 + 5;
    } catch (err) {
      console.error(`Building "${f.place.name}" failed:`, err);
    }
  }
  buildBridges(ctx, world);
  buildWalls(ctx, world);
  buildCastle(ctx, world);
  buildQuays(ctx, world); // after places and bridges, which cut openings in the quay walls
  const nBuildings = buildBuildings(ctx, index, (b) => skipIds.has(b.id));
  const inKeepOut = (x, z) => keepOut.some((k) => Math.hypot(x - k.x, z - k.z) < k.r + 4);
  const nTrees = scatterTrees(ctx, landuse, inKeepOut, touchMode ? 1600 : 3200);
  console.info(`Holmstead: ${nBuildings} buildings, ${nTrees} trees, ${ctx.locations.length} places`);

  const terrain = createTerrain(hm, groundTex, world.bounds, touchMode ? 3 : 2);
  scene.add(terrain, createWater(world.bounds));
  ctx.clickables.push(terrain);
  scene.add(createOuterGround(world.bounds));

  // District names float high above the rooftops.
  const castleKit = ctx.locations.find((l) => l.id === 'castle');
  for (const dd of placesData.districts ?? []) {
    const el = document.createElement('div');
    el.className = 'label district';
    el.textContent = dd.name;
    const label = new CSS2DObject(el);
    label.position.set(dd.x, heightAt(dd.x, dd.z) + (dd.labelHeight ?? 34), dd.z);
    scene.add(label);
    ctx.locations.push({ ...dd, kind: 'District', radius: 0, label, district: true, travel: true });
  }
  if (castleKit) ctx.locations.splice(ctx.locations.indexOf(castleKit), 1);

  // --- Player ---
  const bnd = world.bounds;
  const player = new Player(camera, document.body, physics, [bnd[0] + 15, bnd[1] + 15, bnd[2] - 15, bnd[3] - 15]);
  const controls = player.controls;

  function freeSpotNear(x, z) {
    for (let r = 0; r < 60; r += 2) {
      for (let a = 0; a < 6.28; a += 0.5) {
        const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        const bld = index.at(px, pz);
        if ((!bld || skipIds.has(bld.id)) && heightAt(px, pz) > WATER_LEVEL + 0.5) return [px, pz];
        if (r === 0) break;
      }
    }
    return [x, z];
  }

  function goToLocation(loc) {
    if (loc.district) {
      const [x, z] = freeSpotNear(loc.x, loc.z);
      player.teleport(x, z, loc.x + 30, loc.z);
      return;
    }
    if (loc.spawn) { player.teleport(loc.spawn.x, loc.spawn.z, loc.x, loc.z); return; }
    const a = loc.group ? loc.group.rotation.y : 0;
    const dist = loc.approach ?? Math.max(loc.radius, 6) + 2;
    const [x, z] = freeSpotNear(loc.x + Math.sin(a) * dist, loc.z + Math.cos(a) * dist);
    player.teleport(x, z, loc.x, loc.z);
  }

  const byId = new Map(ctx.locations.map((l) => [l.id, l]));
  function goToHash() {
    const loc = byId.get(decodeURIComponent(location.hash.slice(1)));
    if (loc) { goToLocation(loc); return true; }
    return false;
  }
  if (!goToHash()) {
    const s = placesData.spawn;
    player.teleport(s.x, s.z, s.lookAt[0], s.lookAt[1]);
  }
  addEventListener('hashchange', goToHash);

  // --- UI ---
  const minimapCanvas = document.getElementById('minimap');
  const minimap = new Minimap(minimapCanvas, minimapImg, world.bounds, ctx.locations);
  minimapCanvas.addEventListener('click', () => minimap.toggle());
  ui.north = placesData.north ?? [0, -1];

  let nearby = null;
  let infoOpenedAt = null;
  const openInfo = (loc) => { ui.showInfo(loc); infoOpenedAt = camera.position.clone(); };
  const toggleInfo = () => {
    if (ui.openLocation) ui.hideInfo();
    else if (nearby) openInfo(nearby);
  };
  document.getElementById('prompt').addEventListener('click', toggleInfo);
  document.getElementById('info-close').addEventListener('click', () => ui.hideInfo());

  const raycaster = new THREE.Raycaster();
  raycaster.far = CLICK_RANGE;
  function pickAt(ndcX, ndcY) {
    if (ui.openLocation) { ui.hideInfo(); return; }
    raycaster.setFromCamera({ x: ndcX, y: ndcY }, camera);
    const hit = raycaster.intersectObjects(ctx.clickables, true)[0];
    let o = hit?.object;
    while (o && !o.userData.location) o = o.parent;
    if (o) openInfo(o.userData.location);
  }

  let playing = false;
  const touchUI = document.getElementById('touch-ui');
  const touch = new TouchControls({
    area: document.getElementById('touch-area'),
    joystick: document.getElementById('joystick'),
    stick: document.getElementById('stick'),
    jumpButton: document.getElementById('btn-jump'),
    camera, player,
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
  addEventListener('touchstart', () => {
    if (!touchMode) { touchMode = true; ui.setTouchMode(true); }
  }, { once: true, passive: true });

  ui.buildTravelList(ctx.locations.filter((l) => l.travel), (loc) => {
    history.replaceState(null, '', `#${loc.id}`);
    goToLocation(loc);
    start();
  });
  ui.hideMessage();
  setPlaying(false);

  addEventListener('keydown', (e) => {
    if (e.code === 'KeyE') toggleInfo();
    else if (e.code === 'KeyM') minimap.toggle();
  });
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
    for (const fn of ctx.updates) fn(t, dt);
    ctx.lights.update(pos, t, dt);

    sky.position.copy(pos);
    sun.target.position.copy(pos);
    sun.position.copy(pos).add(SUN_OFFSET);

    nearby = null;
    let nearest = Infinity;
    for (const loc of ctx.locations) {
      const d = Math.hypot(pos.x - loc.x, pos.z - loc.z);
      if (loc.radius > 0 && d < loc.radius && d < nearest) { nearest = d; nearby = loc; }
    }
    // Labels show through walls, so hide them all while you're at (or inside) a place.
    for (const loc of ctx.locations) {
      const d = Math.hypot(pos.x - loc.x, pos.z - loc.z);
      if (loc.label && nearby) loc.label.element.style.opacity = 0;
      else if (loc.label) {
        const [f0, f1] = loc.district ? DISTRICT_FADE : LABEL_FADE;
        const fadeIn = loc.district ? THREE.MathUtils.smoothstep(d, 90, 160) : 1;
        loc.label.element.style.opacity = fadeIn * (1 - THREE.MathUtils.smoothstep(d, f0, f1));
      }
    }
    if (ui.openLocation && infoOpenedAt && pos.distanceTo(infoOpenedAt) > 25) ui.hideInfo();
    ui.setPrompt(nearby);
    camera.getWorldDirection(dir);
    ui.setCoords(pos, dir);
    minimap.draw(pos, dir);
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  });

  window.world = { scene, camera, player, physics, locations: ctx.locations, goToLocation, touch, ctx };
}

if (location.protocol !== 'file:') {
  init().catch((err) => {
    console.error(err);
    new UI(document.title).showError(err);
  });
}
