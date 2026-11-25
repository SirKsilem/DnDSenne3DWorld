// Locations: reads entries from data/locations.json and builds a placeholder
// building for each "type", or loads your own .glb model if the entry has "model".

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { heightAt, mulberry32, faceted } from './terrain.js';

// radius: area that is flattened and kept free of trees; you can "read" a place within radius + 8 m.
// labelHeight: how high the name floats above the ground.
export const TYPES = {
  town:     { label: 'Town',           radius: 24, labelHeight: 13, color: '#f2c14e', build: buildTown },
  tavern:   { label: 'Tavern',         radius: 11, labelHeight: 12, color: '#e9845f', build: buildTavern },
  tower:    { label: 'Tower',          radius: 7,  labelHeight: 37, color: '#a58bff', build: buildTower },
  castle:   { label: 'Castle',         radius: 24, labelHeight: 24, color: '#c9ced6', build: buildCastle },
  ruins:    { label: 'Ruins',          radius: 15, labelHeight: 10, color: '#c2b28e', build: buildRuins },
  cave:     { label: 'Cave',           radius: 13, labelHeight: 14, color: '#a08566', build: buildCave },
  camp:     { label: 'Camp',           radius: 10, labelHeight: 7,  color: '#8cc06f', build: buildCamp },
  shrine:   { label: 'Shrine',         radius: 10, labelHeight: 8,  color: '#5ec8d8', build: buildShrine },
  landmark: { label: 'Point of interest', radius: 4, labelHeight: 13, color: '#ffffff', build: buildLandmark },
};

function slug(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Validate the JSON entries and fill in defaults. Invalid entries are skipped with a console warning. */
export function prepareLocations(raw) {
  const seen = new Set();
  const out = [];
  raw.forEach((l, i) => {
    if (typeof l.x !== 'number' || typeof l.z !== 'number') {
      console.warn(`Location #${i + 1} ("${l.name ?? '?'}") needs numeric "x" and "z" — skipped.`);
      return;
    }
    let type = String(l.type ?? 'landmark').toLowerCase();
    if (!TYPES[type]) {
      console.warn(`"${l.name}": unknown type "${l.type}", using "landmark". Known types: ${Object.keys(TYPES).join(', ')}`);
      type = 'landmark';
    }
    let id = slug(l.id ?? l.name ?? `location-${i + 1}`) || `location-${i + 1}`;
    while (seen.has(id)) id += '-2';
    seen.add(id);
    out.push({
      ...l,
      id,
      type,
      name: l.name ?? 'Unnamed place',
      description: l.description ?? '',
      radius: l.radius ?? TYPES[type].radius,
      colliders: [],
    });
  });
  return out;
}

/** Build every location into the scene. Returns per-frame animation callbacks (fires, crystals, flags). */
export async function buildLocations(locations, scene) {
  const loader = new GLTFLoader();
  const updates = [];

  await Promise.all(locations.map(async (loc) => {
    const local = [];
    const col = makeColliderBuilder(local);
    let obj = null;
    let scale = 1;

    if (loc.model) {
      try {
        const gltf = await loader.loadAsync(loc.model);
        obj = gltf.scene;
        obj.scale.setScalar(loc.scale ?? 1);
        obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        if (loc.collisionRadius) col.circle(0, 0, loc.collisionRadius);
      } catch (err) {
        console.warn(`Could not load model "${loc.model}" for "${loc.name}" — using the placeholder instead.`, err);
      }
    }
    if (!obj) {
      obj = TYPES[loc.type].build(mulberry32(hashString(loc.id)), col, updates);
      scale = loc.scale ?? 1;
      obj.scale.setScalar(scale);
    }

    const group = new THREE.Group();
    group.add(obj);
    group.position.set(loc.x, heightAt(loc.x, loc.z), loc.z);
    group.rotation.y = THREE.MathUtils.degToRad(loc.rotation ?? 0);
    group.userData.location = loc;
    scene.add(group);

    // Collision circles from the builder's local space into world space.
    const cos = Math.cos(group.rotation.y), sin = Math.sin(group.rotation.y);
    loc.colliders = local.map((c) => ({
      x: loc.x + (c.x * cos + c.z * sin) * scale,
      z: loc.z + (-c.x * sin + c.z * cos) * scale,
      r: c.r * scale,
    }));

    const el = document.createElement('div');
    el.className = 'label';
    el.textContent = loc.name;
    el.style.setProperty('--accent', TYPES[loc.type].color);
    const label = new CSS2DObject(el);
    label.position.set(0, loc.labelHeight ?? TYPES[loc.type].labelHeight * scale, 0);
    group.add(label);

    loc.group = group;
    loc.label = label;
  }));

  return updates;
}

function makeColliderBuilder(list) {
  return {
    circle(x, z, r) { list.push({ x, z, r }); },
    // Approximate a rectangle (w along x, d along z, rotated by rot) with a row of circles.
    rect(cx, cz, w, d, rot = 0) {
      const long = Math.max(w, d), short = Math.min(w, d), alongX = w >= d;
      const n = Math.max(1, Math.round(long / short));
      const r = Math.hypot(short / 2, long / (2 * n)) * 0.9;
      const cos = Math.cos(rot), sin = Math.sin(rot);
      for (let i = 0; i < n; i++) {
        const t = ((i + 0.5) / n - 0.5) * long;
        const lx = alongX ? t : 0, lz = alongX ? 0 : t;
        list.push({ x: cx + lx * cos + lz * sin, z: cz - lx * sin + lz * cos, r });
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Placeholder builders. Each returns a THREE.Group centred on (0, 0) with the
// "front" (doors, gates, entrances) facing +z. Use "rotation" in the JSON to turn it.
// ---------------------------------------------------------------------------

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...opts });
const M = {
  plaster: mat(0xe3d5b8), timber: mat(0xc2a27a), wood: mat(0x7a5434), darkWood: mat(0x4a3220),
  roofRed: mat(0x9b3d2e), roofBlue: mat(0x3e5c86), roofThatch: mat(0xb4914f), roofSlate: mat(0x4d5560), roofPurple: mat(0x4b3a78),
  stone: mat(0x9a958c), darkStone: mat(0x6a655e), mossStone: mat(0x7f8a6a), rock: mat(0x7a736a),
  dark: mat(0x120e0b, { roughness: 1 }), canvas: mat(0xd2c29a), banner: mat(0x8a2232),
  fire: new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: 0xff6a00, emissiveIntensity: 2.5 }),
  magic: new THREE.MeshStandardMaterial({ color: 0xc9b9ff, emissive: 0x7a5cff, emissiveIntensity: 2 }),
  window: new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb347, emissiveIntensity: 0.6 }),
};

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const ROCK = new THREE.DodecahedronGeometry(1, 0);
// Triangular prism (ridge along z) used for gable roofs and tents.
const GABLE = (() => {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath();
  return new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5);
})();

const facetedCache = new WeakMap();
function mesh(geo, material, x = 0, y = 0, z = 0) {
  if (!facetedCache.has(geo)) facetedCache.set(geo, faceted(geo));
  const m = new THREE.Mesh(facetedCache.get(geo), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function box(w, h, d, material, x = 0, y = h / 2, z = 0) {
  const m = mesh(UNIT_BOX, material, x, y, z);
  m.scale.set(w, h, d);
  return m;
}

function house(rng, w, d, h, roofMat, wallMat = M.plaster) {
  const g = new THREE.Group();
  g.add(box(w, h, d, wallMat));
  g.add(box(w + 0.2, 0.5, d + 0.2, M.darkStone));
  const roof = mesh(GABLE, roofMat, 0, h, 0);
  roof.scale.set(w + 0.8, Math.min(w, d) * 0.55 + 1, d + 0.8);
  g.add(roof);
  g.add(box(1.2, 2.1, 0.15, M.darkWood, 0, 1.05, d / 2 + 0.05));
  if (w > 5) for (const sx of [-1, 1]) g.add(box(0.9, 0.9, 0.1, M.window, sx * w * 0.3, h * 0.6, d / 2 + 0.05));
  if (rng() < 0.6) g.add(box(0.8, 2.5, 0.8, M.stone, w * 0.25 * (rng() < 0.5 ? -1 : 1), h + 1.6, -d * 0.2));
  return g;
}

function buildTown(rng, col) {
  const g = new THREE.Group();
  // Village well in the square
  g.add(mesh(new THREE.CylinderGeometry(1.4, 1.5, 1, 12), M.stone, 0, 0.5, 0));
  for (const sx of [-1, 1]) g.add(box(0.2, 2.6, 0.2, M.wood, sx * 1.2, 1.3, 0));
  const wellRoof = mesh(GABLE, M.roofRed, 0, 2.6, 0);
  wellRoof.scale.set(3.2, 1.2, 1.6);
  wellRoof.rotation.y = Math.PI / 2;
  g.add(wellRoof);
  col.circle(0, 0, 1.6);

  const roofs = [M.roofRed, M.roofThatch, M.roofSlate, M.roofBlue];
  const n = 7 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (rng() - 0.5) * 0.3;
    const dist = 12 + rng() * 6;
    const w = 5 + rng() * 3, d = 4.5 + rng() * 2.5, h = 3 + rng() * 2;
    const x = Math.cos(a) * dist, z = Math.sin(a) * dist;
    const hs = house(rng, w, d, h, roofs[Math.floor(rng() * roofs.length)], rng() < 0.5 ? M.plaster : M.timber);
    hs.position.set(x, 0, z);
    hs.rotation.y = Math.atan2(-x, -z); // door faces the square
    g.add(hs);
    col.rect(x, z, w, d, hs.rotation.y);
  }
  return g;
}

function buildTavern(rng, col) {
  const g = new THREE.Group();
  g.add(house(rng, 12, 8, 5.5, M.roofThatch, M.timber));
  col.rect(0, 0, 12, 8);
  const annex = house(rng, 5, 5, 3.2, M.roofThatch, M.plaster);
  annex.position.set(-8.5, 0, -1);
  annex.rotation.y = -Math.PI / 2;
  g.add(annex);
  col.rect(-8.5, -1, 5, 5);
  // Hanging sign
  g.add(box(0.25, 3.6, 0.25, M.darkWood, 3.8, 1.8, 6));
  g.add(box(1.8, 0.18, 0.18, M.darkWood, 4.6, 3.4, 6));
  g.add(box(1.3, 0.9, 0.1, M.banner, 5.0, 2.7, 6));
  col.circle(3.8, 6, 0.3);
  // Barrels
  const barrel = new THREE.CylinderGeometry(0.45, 0.45, 1.1, 10);
  for (let i = 0; i < 3; i++) g.add(mesh(barrel, M.wood, -4 + i, 0.55, 4.8));
  return g;
}

function buildTower(rng, col, updates) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(4.2, 4.8, 3, 10), M.darkStone, 0, 1.5, 0));
  g.add(mesh(new THREE.CylinderGeometry(3.2, 3.8, 20, 10), M.stone, 0, 13, 0));
  g.add(mesh(new THREE.CylinderGeometry(4.2, 3.4, 1.4, 10), M.darkStone, 0, 23.5, 0));
  g.add(mesh(new THREE.ConeGeometry(4.8, 8, 10), M.roofPurple, 0, 28.2, 0));
  for (let i = 0; i < 6; i++) {
    const a = i * 2.1, y = 6 + i * 3, r = 3.8 - (0.6 * (y - 3)) / 20;
    const w = box(0.7, 1.3, 0.3, M.window, Math.sin(a) * r, y, Math.cos(a) * r);
    w.rotation.y = a;
    g.add(w);
  }
  g.add(box(1.6, 2.6, 0.6, M.dark, 0, 1.3, 4.4));
  const crystal = mesh(new THREE.OctahedronGeometry(0.9), M.magic, 0, 34, 0);
  crystal.castShadow = false;
  g.add(crystal);
  updates.push((t) => { crystal.rotation.y = t; crystal.position.y = 34 + Math.sin(t * 1.5) * 0.4; });
  col.circle(0, 0, 4.6);
  return g;
}

function buildCastle(rng, col, updates) {
  const g = new THREE.Group();
  const S = 34, H = 7, T = 2, GATE = 6, half = S / 2;

  const wall = (w, d, x, z) => {
    g.add(box(w, H, d, M.stone, x, H / 2, z));
    col.rect(x, z, w, d);
    const len = Math.max(w, d), alongX = w >= d;
    for (let t = -len / 2 + 1; t <= len / 2 - 0.5; t += 2.4) {
      g.add(box(alongX ? 1.2 : T + 0.1, 1.1, alongX ? T + 0.1 : 1.2, M.stone, x + (alongX ? t : 0), H + 0.55, z + (alongX ? 0 : t)));
    }
  };
  wall(S, T, 0, -half);
  wall(T, S, -half, 0);
  wall(T, S, half, 0);
  const seg = (S - GATE) / 2;
  wall(seg, T, -(GATE / 2 + seg / 2), half);
  wall(seg, T, GATE / 2 + seg / 2, half);
  g.add(box(GATE + 1, 2, T + 0.6, M.darkStone, 0, H - 1, half)); // gate lintel

  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(mesh(new THREE.CylinderGeometry(3, 3.3, 11, 10), M.stone, sx * half, 5.5, sz * half));
    g.add(mesh(new THREE.ConeGeometry(3.7, 4.5, 10), M.roofBlue, sx * half, 13.25, sz * half));
    col.circle(sx * half, sz * half, 3.4);
  }

  // Keep
  g.add(box(13, 15, 11, M.stone, 0, 7.5, -7));
  g.add(box(2.4, 3.5, 0.3, M.dark, 0, 1.75, -1.4));
  col.rect(0, -7, 13, 11);
  const pole = new THREE.Group();
  pole.position.set(0, 15, -7);
  pole.add(box(0.2, 6, 0.2, M.darkWood, 0, 3, 0));
  const flag = box(2.4, 1.4, 0.08, M.banner, 1.3, 5, 0);
  const flagPivot = new THREE.Group();
  flagPivot.add(flag);
  pole.add(flagPivot);
  g.add(pole);
  updates.push((t) => { flagPivot.rotation.y = Math.sin(t * 2) * 0.25; });
  return g;
}

function buildRuins(rng, col) {
  const g = new THREE.Group();
  g.add(box(24, 0.5, 15, M.mossStone, 0, 0.1, 0));
  g.add(box(8, 0.3, 2, M.mossStone, 0, 0.05, 8.3));
  const colGeo = new THREE.CylinderGeometry(0.7, 0.8, 1, 8);
  for (const zSide of [-5.5, 5.5]) {
    for (let i = 0; i < 6; i++) {
      const x = -10 + i * 4;
      const r = rng();
      if (r < 0.15) continue;
      if (r < 0.3) {
        const c = mesh(colGeo, M.stone, x + 1.5, 0.7, zSide + (rng() - 0.5) * 3);
        c.scale.y = 4 + rng() * 3;
        c.rotation.z = Math.PI / 2;
        c.rotation.y = rng() * Math.PI;
        g.add(c);
        continue;
      }
      const hgt = 1.5 + rng() * 6;
      const c = mesh(colGeo, M.stone, x, hgt / 2, zSide);
      c.scale.y = hgt;
      g.add(c);
      if (hgt > 6) g.add(box(1.9, 0.5, 1.9, M.stone, x, hgt + 0.25, zSide));
      col.circle(x, zSide, 0.9);
    }
  }
  for (let i = 0; i < 5; i++) {
    const h = 1 + rng() * 4;
    g.add(box(3.6, h, 1.2, M.darkStone, -8 + i * 4, h / 2, -8.5));
    col.rect(-8 + i * 4, -8.5, 3.6, 1.2);
  }
  for (let i = 0; i < 14; i++) {
    const s = 0.3 + rng() * 0.8;
    const rock = mesh(ROCK, M.stone, (rng() - 0.5) * 26, s * 0.4, (rng() - 0.5) * 18);
    rock.scale.setScalar(s);
    rock.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    g.add(rock);
  }
  return g;
}

function buildCave(rng, col, updates) {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // Bumps depend only on position, so shared corners move together and the surface stays closed.
    const k = 1 + 0.12 * Math.sin(v.x * 7.1 + v.y * 3.3) + 0.1 * Math.sin(v.z * 9.7 - v.x * 4.1);
    p.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  geo.computeVertexNormals();
  const mound = mesh(geo, M.rock, 0, -1, -1);
  mound.scale.set(13, 9, 10);
  g.add(mound);

  g.add(box(5, 4.6, 4, M.dark, 0, 2.3, 8)); // the dark mouth
  for (const [x, y, z, s] of [[-3.2, 1.8, 9.2, 2.2], [3.2, 1.8, 9.2, 2.2], [0, 5.2, 9, 2.6]]) {
    const r = mesh(ROCK, M.rock, x, y, z);
    r.scale.set(s, s, s * 0.8);
    r.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    g.add(r);
  }
  const flames = [];
  for (const sx of [-1, 1]) {
    g.add(box(0.15, 2.2, 0.15, M.darkWood, sx * 3.8, 1.1, 11.2));
    const f = mesh(new THREE.ConeGeometry(0.25, 0.6, 6), M.fire, sx * 3.8, 2.5, 11.2);
    f.castShadow = false;
    g.add(f);
    flames.push(f);
  }
  updates.push((t) => flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 11 + i * 2) * 0.2; }));
  col.circle(0, -1, 10);
  col.circle(-6, 3, 6);
  col.circle(6, 3, 6);
  return g;
}

function buildCamp(rng, col, updates) {
  const g = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const s = mesh(ROCK, M.darkStone, Math.cos(a) * 1.1, 0.15, Math.sin(a) * 1.1);
    s.scale.setScalar(0.3);
    g.add(s);
  }
  for (const r of [0.5, -0.6]) {
    const log = mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.6, 6), M.darkWood, 0, 0.2, 0);
    log.rotation.set(Math.PI / 2, r, 0.2);
    g.add(log);
  }
  const flame = mesh(new THREE.ConeGeometry(0.55, 1.4, 7), M.fire, 0, 0.8, 0);
  flame.castShadow = false;
  g.add(flame);
  const light = new THREE.PointLight(0xff8a3d, 30, 20, 2);
  light.position.set(0, 1.5, 0);
  g.add(light);
  updates.push((t) => {
    const f = 1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.06;
    flame.scale.y = f;
    light.intensity = 30 * f;
  });
  col.circle(0, 0, 1.2);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const x = Math.sin(a) * 6.5, z = Math.cos(a) * 6.5;
    const tent = mesh(GABLE, M.canvas, x, 0, z);
    tent.scale.set(3, 2.4, 3.8);
    tent.rotation.y = a;
    g.add(tent);
    col.rect(x, z, 3, 3.8, a);
  }
  // Log benches around the fire
  for (const a of [1.2, 2.8, 4.6]) {
    const bench = mesh(new THREE.CylinderGeometry(0.25, 0.25, 2, 6), M.wood, Math.sin(a) * 3, 0.25, Math.cos(a) * 3);
    bench.rotation.set(0, a, Math.PI / 2);
    g.add(bench);
  }
  return g;
}

function buildShrine(rng, col, updates) {
  const g = new THREE.Group();
  const n = 9, R = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const h = 3 + rng() * 2;
    const x = Math.sin(a) * R, z = Math.cos(a) * R;
    const stone = box(1.3, h, 0.8, M.stone, x, h / 2 - 0.2, z);
    stone.rotation.set(0, a, (rng() - 0.5) * 0.12);
    g.add(stone);
    col.circle(x, z, 0.9);
  }
  g.add(box(2.6, 1, 1.6, M.darkStone, 0, 0.5, 0));
  col.circle(0, 0, 1.6);
  const crystal = mesh(new THREE.OctahedronGeometry(0.6), M.magic, 0, 2.2, 0);
  crystal.castShadow = false;
  g.add(crystal);
  const glow = new THREE.PointLight(0x8a6cff, 15, 12, 2);
  glow.position.set(0, 2.5, 0);
  g.add(glow);
  updates.push((t) => { crystal.rotation.y = t * 0.8; crystal.position.y = 2.2 + Math.sin(t * 2) * 0.15; });
  return g;
}

function buildLandmark(rng, col, updates) {
  const g = new THREE.Group();
  g.add(box(3, 0.6, 3, M.darkStone));
  const ob = mesh(new THREE.CylinderGeometry(0.5, 1.1, 9, 4), M.darkStone, 0, 5.1, 0);
  ob.rotation.y = Math.PI / 4;
  g.add(ob);
  const gem = mesh(new THREE.OctahedronGeometry(0.5), M.magic, 0, 10.3, 0);
  gem.castShadow = false;
  g.add(gem);
  updates.push((t) => { gem.rotation.y = t; });
  col.circle(0, 0, 1.5);
  return g;
}
