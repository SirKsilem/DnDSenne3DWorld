// Terrain: a procedural landscape with a ring of mountains at the edge,
// lakes and dirt roads from data/locations.json, and flat ground under each location.
// 1 unit = 1 metre. The map is centred on (0, 0); x runs east, z runs south.

import * as THREE from 'three';

export const WORLD_SIZE = 600;   // the map is WORLD_SIZE x WORLD_SIZE metres
export const WATER_LEVEL = 0;
export const ROAD_WIDTH = 3;
const HALF = WORLD_SIZE / 2;
const SEGMENTS = 200;            // terrain mesh resolution (3 m per cell)

let flatZones = [];  // { x, z, r, h } – ground is levelled here so buildings sit flat
let lakes = [];      // { x, z, radius, depth }
let roadSegments = []; // { ax, az, bx, bz }

const lerp = THREE.MathUtils.lerp;
function smoothstep(edge0, edge1, x) {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/** Call once, before building anything, with the prepared world data. */
export function configureTerrain({ locations = [], lakes: lakeData = [], roads = [] }) {
  lakes = lakeData.map((l) => ({ x: l.x, z: l.z, radius: l.radius ?? 30, depth: l.depth ?? 4 }));
  roadSegments = [];
  for (const road of roads) {
    for (let i = 0; i < road.length - 1; i++) {
      roadSegments.push({ ax: road[i].x, az: road[i].z, bx: road[i + 1].x, bz: road[i + 1].z });
    }
  }
  flatZones = locations.map((l) => ({
    x: l.x, z: l.z, r: l.radius,
    h: Math.max(baseHeight(l.x, l.z), WATER_LEVEL + 0.6),
  }));
}

// Rolling hills from a few layered sine waves, mountains near the border, lakes carved in.
function baseHeight(x, z) {
  let h = 4
    + Math.sin(x * 0.018) * Math.cos(z * 0.021) * 5
    + Math.sin(x * 0.047 + 1.3) * Math.sin(z * 0.041 + 0.7) * 2.2
    + Math.sin(x * 0.11 + 2.1) * Math.cos(z * 0.093 + 0.4) * 0.7;

  const ang = Math.atan2(z, x);
  const edge = Math.max(Math.abs(x), Math.abs(z)) / HALF
    + Math.sin(ang * 7) * 0.03 + Math.sin(ang * 13 + 1) * 0.02;
  if (edge > 0.68) {
    const t = (edge - 0.68) / 0.32;
    h += t * t * 65 + t * 9 * Math.abs(Math.sin(x * 0.05 + z * 0.03));
  }

  for (const l of lakes) {
    const d = Math.hypot(x - l.x, z - l.z) / l.radius;
    if (d < 1) h = lerp(h, WATER_LEVEL - l.depth, smoothstep(1, 0.35, d));
  }
  return h;
}

/** Ground height at any point. Used by the mesh, the player and object placement. */
export function heightAt(x, z) {
  let h = baseHeight(x, z);
  for (const f of flatZones) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r * 1.7) h = lerp(h, f.h, smoothstep(f.r * 1.7, f.r, d));
  }
  return h;
}

export function distanceToRoad(x, z) {
  let best = Infinity;
  for (const s of roadSegments) {
    const dx = s.bx - s.ax, dz = s.bz - s.az;
    const len2 = dx * dx + dz * dz || 1;
    const t = Math.min(Math.max(((x - s.ax) * dx + (z - s.az) * dz) / len2, 0), 1);
    best = Math.min(best, Math.hypot(x - (s.ax + dx * t), z - (s.az + dz * t)));
  }
  return best;
}

const COLORS = {
  sand: new THREE.Color(0xd4c08a),
  grass: new THREE.Color(0x5f8a38),
  grass2: new THREE.Color(0x87a548),
  dirt: new THREE.Color(0x9a7b4f),
  rock: new THREE.Color(0x7d7468),
  snow: new THREE.Color(0xf1f3f5),
};

/** Ground colour (linear colour space) at a point. Shared by the 3D terrain and the minimap. */
export function terrainColor(x, z, out = new THREE.Color()) {
  const h = heightAt(x, z);
  const e = 1.5;
  const slope = Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  const n = (Math.sin(x * 0.13 + Math.cos(z * 0.09) * 2) + Math.sin(z * 0.17 + x * 0.03)) * 0.25 + 0.5;

  out.copy(COLORS.grass).lerp(COLORS.grass2, n);
  for (const f of flatZones) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r) out.lerp(COLORS.dirt, 0.35 * smoothstep(f.r, f.r * 0.5, d));
  }
  if (h < WATER_LEVEL + 1.2) out.lerp(COLORS.sand, smoothstep(WATER_LEVEL + 1.2, WATER_LEVEL + 0.4, h));
  const road = distanceToRoad(x, z);
  if (road < ROAD_WIDTH * 1.5) out.lerp(COLORS.dirt, smoothstep(ROAD_WIDTH * 1.5, ROAD_WIDTH * 0.6, road));
  if (slope > 0.6 || h > 22) out.lerp(COLORS.rock, Math.max(smoothstep(0.6, 1.0, slope), smoothstep(22, 30, h)));
  if (h > 48) out.lerp(COLORS.snow, smoothstep(48, 56, h));
  return out;
}

/**
 * Give a geometry one normal per face (the low-poly look). Baking the normals into the
 * geometry is more reliable than `flatShading: true`, which some software renderers get wrong.
 */
export function faceted(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  g.computeVertexNormals();
  return g;
}

export function createTerrain() {
  let geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    terrainColor(x, z, c);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo = faceted(geo);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

export function createWater() {
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x2f6f8f, roughness: 0.15, transparent: true, opacity: 0.82 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_LEVEL;
  water.receiveShadow = true;
  return water;
}

export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Scatter trees and boulders. `isBlocked(x, z)` keeps them off roads and locations.
 * Returns collision circles { x, z, r } so the player can't walk through trunks and rocks.
 */
export function scatterNature(scene, isBlocked, seed = 1234) {
  const rand = mulberry32(seed);
  const colliders = [];
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  // Trees
  const TREES = 1400;
  const trunkGeo = faceted(new THREE.CylinderGeometry(0.22, 0.35, 2.2, 6).translate(0, 1.1, 0));
  const leafGeo = faceted(new THREE.ConeGeometry(1.9, 5.2, 7).translate(0, 4.4, 0));
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: 0x5b3d24, roughness: 1 }), TREES);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }), TREES);
  const leafColor = new THREE.Color();
  let n = 0;
  for (let tries = 0; tries < TREES * 8 && n < TREES; tries++) {
    const x = (rand() - 0.5) * WORLD_SIZE * 0.96;
    const z = (rand() - 0.5) * WORLD_SIZE * 0.96;
    const h = heightAt(x, z);
    if (h < WATER_LEVEL + 1 || h > 30) continue;
    // Forest density varies across the map, so you get woods and clearings.
    const density = 0.5 + 0.5 * Math.sin(x * 0.021 + 1.7) * Math.cos(z * 0.017 - 0.4);
    if (rand() > density * density) continue;
    if (isBlocked(x, z)) continue;
    const scale = 0.7 + rand() * 0.7;
    m.compose(p.set(x, h - 0.2, z), q.setFromAxisAngle(up, rand() * Math.PI * 2), s.set(scale, scale * (0.85 + rand() * 0.3), scale));
    trunks.setMatrixAt(n, m);
    leaves.setMatrixAt(n, m);
    leaves.setColorAt(n, leafColor.setHSL(0.26 + rand() * 0.06, 0.45, 0.22 + rand() * 0.1));
    colliders.push({ x, z, r: 0.35 * scale });
    n++;
  }
  trunks.count = leaves.count = n;
  for (const im of [trunks, leaves]) { im.castShadow = true; im.receiveShadow = true; scene.add(im); }

  // Boulders
  const ROCKS = 260;
  const rocks = new THREE.InstancedMesh(faceted(new THREE.DodecahedronGeometry(1, 0)), new THREE.MeshStandardMaterial({ color: 0x8a847a, roughness: 1 }), ROCKS);
  let r = 0;
  for (let tries = 0; tries < ROCKS * 8 && r < ROCKS; tries++) {
    const x = (rand() - 0.5) * WORLD_SIZE * 0.96;
    const z = (rand() - 0.5) * WORLD_SIZE * 0.96;
    const h = heightAt(x, z);
    if (h < WATER_LEVEL - 0.5 || h > 35 || isBlocked(x, z)) continue;
    const size = 0.4 + rand() * rand() * 2.4;
    m.compose(p.set(x, h + size * 0.2, z), q.setFromEuler(new THREE.Euler(rand() * 3, rand() * 3, rand() * 3)), s.set(size * (1 + rand() * 0.5), size * 0.8, size));
    rocks.setMatrixAt(r, m);
    if (size > 0.8) colliders.push({ x, z, r: size * 0.9 });
    r++;
  }
  rocks.count = r;
  rocks.castShadow = rocks.receiveShadow = true;
  scene.add(rocks);

  return colliders;
}
