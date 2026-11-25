// The city itself: every building footprint from the map, the walls, towers and gates,
// the castle, the river quays, the bridges and trees in the countryside.

import * as THREE from 'three';
import { Kit } from '../engine/kit.js';

// ---------------------------------------------------------------- helpers
export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pointInPoly(x, z, p) {
  let inside = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], zi = p[i + 1], xj = p[j], zj = p[j + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Fast "which building footprint is here?" lookups. */
export class BuildingIndex {
  constructor(buildings) {
    this.buildings = buildings.map((b, id) => {
      let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity, cx = 0, cz = 0;
      const n = b.p.length / 2;
      for (let i = 0; i < b.p.length; i += 2) {
        minX = Math.min(minX, b.p[i]); maxX = Math.max(maxX, b.p[i]);
        minZ = Math.min(minZ, b.p[i + 1]); maxZ = Math.max(maxZ, b.p[i + 1]);
        cx += b.p[i] / n; cz += b.p[i + 1] / n;
      }
      return { id, pts: b.p, inCity: !!b.c, minX, minZ, maxX, maxZ, cx, cz };
    });
    this.cell = 20;
    this.grid = new Map();
    for (const b of this.buildings) {
      for (let x = Math.floor(b.minX / this.cell); x <= Math.floor(b.maxX / this.cell); x++) {
        for (let z = Math.floor(b.minZ / this.cell); z <= Math.floor(b.maxZ / this.cell); z++) {
          const k = x * 65536 + z;
          if (!this.grid.has(k)) this.grid.set(k, []);
          this.grid.get(k).push(b);
        }
      }
    }
  }

  at(x, z) {
    const list = this.grid.get(Math.floor(x / this.cell) * 65536 + Math.floor(z / this.cell)) ?? [];
    return list.find((b) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ && pointInPoly(x, z, b.pts)) ?? null;
  }

  nearest(x, z, maxDist = 12) {
    let best = null, bd = maxDist;
    for (const b of this.buildings) {
      const d = Math.hypot(b.cx - x, b.cz - z);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
}

/** Smallest rotated rectangle around a footprint: { cx, cz, w, d, angle } (local x along w). */
export function minAreaRect(pts) {
  let best = null;
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ex = pts[j * 2] - pts[i * 2], ez = pts[j * 2 + 1] - pts[i * 2 + 1];
    const len = Math.hypot(ex, ez);
    if (len < 0.5) continue;
    const ux = ex / len, uz = ez / len;
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (let k = 0; k < n; k++) {
      const px = pts[k * 2], pz = pts[k * 2 + 1];
      const a = px * ux + pz * uz, b = -px * uz + pz * ux;
      a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b);
    }
    const area = (a1 - a0) * (b1 - b0);
    if (!best || area < best.area) {
      const ca = (a0 + a1) / 2, cb = (b0 + b1) / 2;
      best = { area, cx: ca * ux - cb * uz, cz: ca * uz + cb * ux, w: a1 - a0, d: b1 - b0, angle: Math.atan2(-uz, ux) };
    }
  }
  return best;
}

// ---------------------------------------------------------------- buildings
const WALL_COLORS = [0xe6dcc6, 0xd9c9a8, 0xeae3d2, 0xcbb89a, 0xd2bf98, 0xd8cfc0, 0xbfae92, 0xe0d2b4];
const ROOF_COLORS = [0x9e4a34, 0x8a3e2c, 0x4f5862, 0x5b6470, 0x7a4b2c, 0xa65a3a, 0x6b4636, 0x55606a];
const STONE = new THREE.Color(0x8a857c), BEAM = new THREE.Color(0x4a3220), DOOR = new THREE.Color(0x3e2a1a);
const WINDOW = new THREE.Color(0x27303a), WINDOW_LIT = new THREE.Color(0xd9a650);

class GeoBuilder {
  constructor() { this.pos = []; this.col = []; }
  tri(a, b, c, color, hint) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) [b, c] = [c, b];
    this.pos.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) this.col.push(color.r, color.g, color.b);
  }
  quad(a, b, c, d, color, hint) { this.tri(a, b, c, color, hint); this.tri(a, c, d, color, hint); }
  mesh(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }
}

function isConvex(p) {
  let sign = 0;
  const n = p.length;
  for (let i = 0; i < n; i++) {
    const a = p[i], b = p[(i + 1) % n], c = p[(i + 2) % n];
    const cr = (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x);
    if (Math.abs(cr) < 1e-6) continue;
    if (sign === 0) sign = Math.sign(cr);
    else if (Math.sign(cr) !== sign) return false;
  }
  return true;
}

function addBuilding(gb, b, heightAt, rng) {
  const p = [];
  for (let i = 0; i < b.pts.length; i += 2) {
    const q = { x: b.pts[i], z: b.pts[i + 1] };
    const last = p[p.length - 1];
    if (!last || Math.hypot(last.x - q.x, last.z - q.z) > 0.3) p.push(q);
  }
  if (p.length < 3) return null;
  const n = p.length;
  const cx = p.reduce((s, q) => s + q.x, 0) / n, cz = p.reduce((s, q) => s + q.z, 0) / n;
  let g = heightAt(cx, cz);
  for (const q of p) g = Math.min(g, heightAt(q.x, q.z));
  const base = g - 0.8;
  let area = 0;
  for (let i = 0; i < n; i++) { const a = p[i], c = p[(i + 1) % n]; area += a.x * c.z - c.x * a.z; }
  area = Math.abs(area / 2);

  const FLOOR = 3.1;
  const stories = b.inCity ? 2 + (rng() < 0.4 ? 1 : 0) + (area > 260 && rng() < 0.35 ? 1 : 0) : 1 + (rng() < 0.35 ? 1 : 0);
  const top = g + stories * FLOOR + 0.4;
  const wallC = new THREE.Color(WALL_COLORS[Math.floor(rng() * WALL_COLORS.length)]);
  const roofC = new THREE.Color(ROOF_COLORS[Math.floor(rng() * ROOF_COLORS.length)]);
  const timbered = rng() < 0.5;

  // wall bands: stone plinth, plaster, timber beams between storeys
  const bands = [[base, g + 0.8, STONE]];
  let y = g + 0.8;
  for (let k = 1; k < stories; k++) {
    const yb = g + k * FLOOR;
    bands.push([y, yb - 0.12, wallC]);
    bands.push([yb - 0.12, yb + 0.12, timbered ? BEAM : STONE]);
    y = yb + 0.12;
  }
  bands.push([y, top, wallC]);

  let longest = 0;
  for (let i = 0; i < n; i++) longest = Math.max(longest, Math.hypot(p[(i + 1) % n].x - p[i].x, p[(i + 1) % n].z - p[i].z));
  let doorPlaced = false;
  for (let i = 0; i < n; i++) {
    const a = p[i], c = p[(i + 1) % n];
    const ex = c.x - a.x, ez = c.z - a.z, L = Math.hypot(ex, ez);
    const mx = (a.x + c.x) / 2, mz = (a.z + c.z) / 2;
    let nx = ez / L, nz = -ex / L;
    if (nx * (mx - cx) + nz * (mz - cz) < 0) { nx = -nx; nz = -nz; }
    const hint = [nx, 0, nz];
    for (const [y0, y1, col] of bands) gb.quad([a.x, y0, a.z], [c.x, y0, c.z], [c.x, y1, c.z], [a.x, y1, a.z], col, hint);
    if (L < 2.6) continue;
    // windows and one door
    const ux = ex / L, uz = ez / L, off = 0.05;
    const wins = Math.max(1, Math.floor((L - 1) / 3.2));
    const isDoorWall = !doorPlaced && L === longest;
    for (let k = 0; k < stories; k++) {
      for (let j = 0; j < wins; j++) {
        const t = ((j + 0.5) / wins) * L;
        let w = 0.8, h = 1.1, yc = g + k * FLOOR + 1.75;
        let col = rng() < 0.08 ? WINDOW_LIT : WINDOW;
        if (k === 0 && isDoorWall && j === Math.floor(wins / 2)) { w = 1.2; h = 2.2; yc = g + 1.1; col = DOOR; doorPlaced = true; }
        const px = a.x + ux * t + nx * off, pz = a.z + uz * t + nz * off;
        gb.quad([px - ux * w / 2, yc - h / 2, pz - uz * w / 2], [px + ux * w / 2, yc - h / 2, pz + uz * w / 2],
          [px + ux * w / 2, yc + h / 2, pz + uz * w / 2], [px - ux * w / 2, yc + h / 2, pz - uz * w / 2], col, hint);
      }
    }
  }

  // roof, with a small overhang
  const eave = p.map((q) => {
    const dx = q.x - cx, dz = q.z - cz, d = Math.hypot(dx, dz) || 1;
    return [q.x + (dx / d) * 0.45, top - 0.05, q.z + (dz / d) * 0.45];
  });
  const up = (pt) => [pt[0] - cx, Math.max(0.3, pt[1] - (top - 3)), pt[2] - cz];
  let peak = top;
  if (n === 4 && isConvex(p)) {
    const len = (i) => Math.hypot(p[(i + 1) % 4].x - p[i].x, p[(i + 1) % 4].z - p[i].z);
    const s = len(0) + len(2) <= len(1) + len(3) ? 0 : 1; // gable ends are the shorter pair
    const [e0, e1, e2, e3] = [0, 1, 2, 3].map((k) => eave[(k + s) % 4]);
    const span = Math.min(len(s), len((s + 2) % 4));
    const rh = Math.min(Math.max(span * 0.42, 1.6), 6);
    const mid = (u, v) => [(u[0] + v[0]) / 2, top + rh, (u[2] + v[2]) / 2];
    const r1 = mid(e0, e1), r2 = mid(e2, e3);
    peak = top + rh;
    const ctr = [cx, top, cz];
    const h = (a, b2, c) => { const m = [(a[0] + b2[0] + c[0]) / 3, (a[1] + b2[1] + c[1]) / 3, (a[2] + b2[2] + c[2]) / 3]; return [m[0] - ctr[0], m[1] - ctr[1] + 0.5, m[2] - ctr[2]]; };
    gb.quad(e1, e2, r2, r1, roofC, h(e1, e2, r2));
    gb.quad(e3, e0, r1, r2, roofC, h(e3, e0, r1));
    gb.tri(e0, e1, r1, wallC, h(e0, e1, r1).map((v, k) => (k === 1 ? 0 : v)));
    gb.tri(e2, e3, r2, wallC, h(e2, e3, r2).map((v, k) => (k === 1 ? 0 : v)));
    if (rng() < 0.35) chimney(gb, r1, r2, top, rh);
  } else if (isConvex(p)) {
    let minR = Infinity;
    for (const q of p) minR = Math.min(minR, Math.hypot(q.x - cx, q.z - cz));
    const rh = Math.min(Math.max(minR * 0.8, 1.5), 6);
    const apex = [cx, top + rh, cz];
    peak = top + rh;
    for (let i = 0; i < n; i++) gb.tri(eave[i], eave[(i + 1) % n], apex, roofC, up([(eave[i][0] + eave[(i + 1) % n][0]) / 2, top + rh / 2, (eave[i][2] + eave[(i + 1) % n][2]) / 2]));
  } else {
    const contour = p.map((q) => new THREE.Vector2(q.x, q.z));
    for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(contour, [])) {
      gb.tri([p[i].x, top, p[i].z], [p[j].x, top, p[j].z], [p[k].x, top, p[k].z], roofC.clone().multiplyScalar(0.85), [0, 1, 0]);
    }
  }
  return { base, top: peak };
}

function chimney(gb, r1, r2, top, rh) {
  const t = 0.3;
  const x = r1[0] + (r2[0] - r1[0]) * t, z = r1[2] + (r2[2] - r1[2]) * t;
  const s = 0.45, y0 = top + rh * 0.4, y1 = top + rh + 0.9;
  const c = new THREE.Color(0x7a6f66);
  const pts = [[x - s, z - s], [x + s, z - s], [x + s, z + s], [x - s, z + s]];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % 4];
    gb.quad([ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], c, [(ax + bx) / 2 - x, 0, (az + bz) / 2 - z]);
  }
  gb.quad([x - s, y1, z - s], [x + s, y1, z - s], [x + s, y1, z + s], [x - s, y1, z + s], c, [0, 1, 0]);
}

/** All the ordinary buildings, merged into one mesh per 200 m chunk. */
export function buildBuildings(ctx, index, skip) {
  const CH = 200;
  const chunks = new Map();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  let count = 0;
  for (const b of index.buildings) {
    if (skip(b)) continue;
    const k = `${Math.floor(b.cx / CH)},${Math.floor(b.cz / CH)}`;
    if (!chunks.has(k)) chunks.set(k, new GeoBuilder());
    const r = addBuilding(chunks.get(k), b, ctx.heightAt, mulberry32(b.id * 7919 + 13));
    if (!r) continue;
    ctx.physics.addPolygon(b.pts, { r: 0.1, y0: r.base, y1: r.top });
    count++;
  }
  for (const gb of chunks.values()) {
    const m = gb.mesh(mat);
    m.name = 'buildings';
    ctx.scene.add(m);
    ctx.clickables.push(m);
  }
  return count;
}

// ---------------------------------------------------------------- walls, gates, towers
const SHRINK_TOWER = 0.62;

function wallRun(kit, ctx, x1, z1, x2, z2, { h, t, color = 'stone', y0, crenels = true, solid = true }) {
  const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz);
  const ry = Math.atan2(dx, dz) - Math.PI / 2;
  const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
  const base = y0 ?? Math.min(ctx.heightAt(x1, z1), ctx.heightAt(x2, z2), ctx.heightAt(mx, mz)) - 1;
  const ground = Math.max(ctx.heightAt(x1, z1), ctx.heightAt(x2, z2), ctx.heightAt(mx, mz));
  const topY = ground + h;
  kit.box(L, topY - base, t, color, mx, base, mz, { ry });
  if (crenels) {
    const ux = dx / L, uz = dz / L, nx = -uz, nz = ux;
    for (let s = 1.2; s < L - 0.6; s += 2.4) {
      for (const side of [-1, 1]) {
        kit.box(1.2, 1.1, 0.6, color, x1 + ux * s + nx * side * (t / 2 - 0.3), topY, z1 + uz * s + nz * side * (t / 2 - 0.3), { ry });
      }
    }
  }
  if (solid) ctx.physics.addSegment(x1, z1, x2, z2, { r: t / 2, y0: base - 20, y1: topY + 2 });
  return topY;
}

function tower(kit, ctx, x, z, r, h, { roof = 'slate', banner } = {}) {
  const g = ctx.heightAt(x, z);
  kit.cyl(r, r * 1.08, h + 2, 'stone', x, g - 2, z, { seg: 12 });
  kit.cyl(r + 0.5, r + 0.4, 1.4, 'darkStone', x, g + h - 0.4, z, { seg: 12 });
  kit.cone(r + 1.1, r * 1.6 + 2, roof, x, g + h + 1, z, { seg: 12 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    kit.box(0.5, 1.2, 0.3, 'black', x + Math.sin(a) * (r + 0.02), g + h * (0.35 + i * 0.18), z + Math.cos(a) * (r + 0.02), { ry: a });
  }
  if (banner) {
    kit.cyl(0.08, 0.08, 3, 'darkWood', x, g + h + r * 1.6 + 2.6, z, { seg: 4 });
    kit.box(1.6, 1, 0.06, banner, x + 0.8, g + h + r * 1.6 + 4.2, z);
  }
  ctx.physics.addCircle(x, z, r, { y0: g - 20, y1: g + h + 10 });
}

function gatehouse(ctx, mx, mz, nx, nz, length, { depth = 11, h = 13, passage = 6, color = 'stone', roof = 'slate' } = {}) {
  const angle = Math.atan2(nx, nz);
  const g = ctx.heightAt(mx, mz);
  const kit = new Kit(ctx, { x: mx, z: mz, y: g, angle });
  const side = (length - passage) / 2;
  for (const s of [-1, 1]) {
    kit.box(side, h + 1.5, depth, color, s * (passage / 2 + side / 2), -1.5, 0, { solid: true });
    for (let c = -depth / 2 + 0.6; c < depth / 2; c += 2.4) {
      kit.box(0.6, 1.1, 1.2, color, s * (passage / 2 + side - 0.3), h, c);
    }
    kit.cone(side * 0.62, 5, roof, s * (passage / 2 + side / 2), h, 0, { seg: 4, ry: Math.PI / 4 });
  }
  kit.box(passage, h - 7, depth, color, 0, 7, 0);                    // over the arch
  kit.box(passage + 0.4, 0.5, depth + 0.2, 'darkStone', 0, 6.8, 0);
  for (let i = -2; i <= 2; i++) kit.box(0.12, 1.6, 0.12, 'iron', i * 1.2, 5.3, depth / 2 - 0.6); // raised portcullis
  kit.box(passage - 0.2, 0.12, 0.12, 'iron', 0, 5.4, depth / 2 - 0.6);
  for (const s of [-1, 1]) {
    kit.box(1.5, 3.2, 0.06, 'red', s * (passage / 2 + 1.5), h - 5, depth / 2 + 0.05);
    kit.box(1.5, 3.2, 0.06, 'red', s * (passage / 2 + 1.5), h - 5, -depth / 2 - 0.05);
  }
  kit.finalize();
}

export function buildWalls(ctx, world) {
  const kit = new Kit(ctx, { x: 0, z: 0, y: 0, angle: 0 });
  const W = world.cityWall;
  for (const [x1, z1, x2, z2, kind] of W.segments) {
    if (kind === 'water') {
      // a wall bridging the river, with a grate underneath
      const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz), ry = Math.atan2(dx, dz) - Math.PI / 2;
      const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
      kit.box(L, 9, 2.6, 'stone', mx, 4, mz, { ry });
      kit.box(L, 0.8, 3.2, 'darkStone', mx, 3.4, mz, { ry });
      const ux = dx / L, uz = dz / L;
      for (let s = 1; s < L; s += 1.2) kit.box(0.15, 4.6, 0.15, 'iron', x1 + ux * s, -1.2, z1 + uz * s, { ry });
      ctx.physics.addSegment(x1, z1, x2, z2, { r: 1.3, y0: -20, y1: 30 });
    } else {
      wallRun(kit, ctx, x1, z1, x2, z2, { h: 9, t: 2.6 });
    }
  }
  for (const [x, z, r] of W.towers) tower(kit, ctx, x, z, Math.max(3.5, r * SHRINK_TOWER), 13);
  kit.finalize();

  const [ccx, ccz] = world.cityPolygon.reduce(([a, b], [x, z]) => [a + x / world.cityPolygon.length, b + z / world.cityPolygon.length], [0, 0]);
  for (const gt of W.gates) {
    const [ax, az] = gt.a, [bx, bz] = gt.b;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    let nx = -(bz - az), nz = bx - ax;
    const l = Math.hypot(nx, nz); nx /= l; nz /= l;
    if (nx * (ccx - mx) + nz * (ccz - mz) < 0) { nx = -nx; nz = -nz; }
    gatehouse(ctx, mx, mz, nx, nz, l + 6);
    ctx.gates.push({ x: mx, z: mz, nx, nz });
  }
}

export function buildCastle(ctx, world) {
  const C = world.castle;
  const kit = new Kit(ctx, { x: 0, z: 0, y: 0, angle: 0 });
  const poly = C.polygon;
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  const [gx, gz] = C.gates[0];
  for (let [x1, z1, x2, z2] of C.segments) {
    // leave room for the gatehouse
    const trim = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az); return [ax + ((bx - ax) / L) * 7.5, az + ((bz - az) / L) * 7.5]; };
    if (Math.hypot(x1 - gx, z1 - gz) < 1) [x1, z1] = trim(x1, z1, x2, z2);
    if (Math.hypot(x2 - gx, z2 - gz) < 1) [x2, z2] = trim(x2, z2, x1, z1);
    wallRun(kit, ctx, x1, z1, x2, z2, { h: 12, t: 3.4, color: 'paleStone' });
  }
  for (const [x, z, r] of C.towers) tower(kit, ctx, x, z, r * 0.7, 17, { roof: 'blue', banner: 'red' });
  let nx = cx - gx, nz = cz - gz;
  const l = Math.hypot(nx, nz); nx /= l; nz /= l;
  // gatehouse faces outward: passage runs along n
  gatehouse(ctx, gx, gz, nx, nz, 16, { depth: 12, h: 15, passage: 6, color: 'paleStone', roof: 'blue' });

  // the keep and great hall
  const kx = cx + (cx - gx) * 0.05, kz = cz + (cz - gz) * 0.05;
  const keep = new Kit(ctx, { x: kx, z: kz, y: ctx.heightAt(kx, kz), angle: Math.atan2(nx, nz) });
  keep.box(20, 26, 20, 'paleStone', 0, -1, -2, { solid: true });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    keep.cyl(2.8, 3, 31, 'paleStone', sx * 10, -1, -2 + sz * 10, { seg: 10, solid: true });
    keep.cone(3.6, 7, 'blue', sx * 10, 30, -2 + sz * 10, { seg: 10 });
  }
  const hip = keep.cone(15, 8, 'blue', 0, 25, -2, { seg: 4, ry: Math.PI / 4 });
  hip.scale.set(14.5, 8, 14.5);
  for (let i = -2; i <= 2; i++) for (const y of [8, 14, 20]) keep.box(1, 1.8, 0.2, 'black', i * 3.5, y, 8.05);
  keep.box(3, 4.5, 0.4, 'darkWood', 0, -0.2, 8.1);
  keep.cyl(0.1, 0.1, 6, 'darkWood', 0, 33, -2, { seg: 4 });
  keep.box(3, 1.8, 0.08, 'red', 1.55, 36.5, -2);
  keep.room({ x: -14, z: -16, w: 22, d: 11, h: 8, wall: 'paleStone', roofColor: 'blue', doors: {}, ceiling: false });
  keep.solidBox(22, 11, -14, -16, -1, 12);
  keep.cyl(1.4, 1.5, 1, 'stone', 6, 0, 14, { seg: 10, solid: true }); // well
  keep.finalize();
  keep.info({ id: 'castle', name: 'Holm Castle', kind: 'Castle', labelHeight: 42, radius: 0, color: '#c9ced6', label: false });
}

export function buildQuays(ctx, world) {
  const kit = new Kit(ctx, { x: 0, z: 0, y: 0, angle: 0 });
  for (const [x1, z1, x2, z2] of world.quays) {
    const L = Math.hypot(x2 - x1, z2 - z1), ry = Math.atan2(x2 - x1, z2 - z1) - Math.PI / 2;
    const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
    const top = world.cityGround + 0.25;
    kit.box(L + 0.35, top + 3, 1.0, 'darkStone', mx, -3, mz, { ry, shadow: false });
    ctx.physics.addSegment(x1, z1, x2, z2, { r: 0.5, y0: -20, y1: world.cityGround + 2, tag: 'quay' });
  }
  kit.finalize();
}

export function buildBridges(ctx, world) {
  for (const br of world.bridges) {
    const [ax, az] = br.a, [bx, bz] = br.b;
    const L = Math.hypot(bx - ax, bz - az);
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const angle = Math.atan2(bx - ax, bz - az); // local +z runs from a to b
    const gA = ctx.heightAt(ax, az), gB = ctx.heightAt(bx, bz);
    const y0 = Math.max(gA, gB);
    const kit = new Kit(ctx, { x: mx, z: mz, y: 0, angle });
    const stone = br.kind === 'stone';
    const rise = stone ? 1.1 : 0.6;
    const W = br.width;
    const deckAt = (t) => { // t: -1..1 along the bridge
      const ends = t < 0 ? gA : gB;
      return ends + (y0 + rise - ends) * (1 - Math.abs(t) ** 2);
    };
    const N = 14;
    for (let i = 0; i < N; i++) {
      const t0 = -1 + (2 * i) / N, t1 = -1 + (2 * (i + 1)) / N;
      const zA = (t0 * L) / 2, zB = (t1 * L) / 2;
      const hA = deckAt(t0), hB = deckAt(t1);
      kit.ramp(0, (zA + zB) / 2, W, zB - zA, hA, hB);
      const top = Math.max(hA, hB);
      kit.box(W, stone ? top + 0.5 : 0.35, (zB - zA) + 0.05, stone ? 'paleStone' : 'plank', 0, stone ? -0.5 : top - 0.35, (zA + zB) / 2);
      for (const s of [-1, 1]) {
        if (stone) kit.box(0.5, 0.9, (zB - zA) + 0.05, 'stone', s * (W / 2 - 0.25), top, (zA + zB) / 2);
        else if (i % 2 === 0) kit.box(0.15, 1.1, 0.15, 'darkWood', s * (W / 2 - 0.1), top, zA);
      }
    }
    if (!stone) {
      for (const s of [-1, 1]) kit.box(0.12, 0.12, L, 'darkWood', s * (W / 2 - 0.1), y0 + rise + 0.95, 0);
      for (const t of [-0.5, 0, 0.5]) for (const s of [-1, 1]) kit.cyl(0.25, 0.25, y0 + 4, 'darkWood', s * (W / 2 - 0.3), -4, (t * L) / 2, { seg: 6 });
    } else {
      for (const t of [-0.45, 0.45]) kit.box(W + 1, y0 + 3, 2.5, 'stone', 0, -3, (t * L) / 2);
      kit.box(W + 0.6, 0.3, 4, 'darkStone', 0, y0 + rise + 0.85, 0);
    }
    for (const s of [-1, 1]) kit.segment(s * (W / 2 - 0.2), -L / 2 + 1, s * (W / 2 - 0.2), L / 2 - 1, { r: 0.25, y0: -10, y1: 30 });
    kit.opening(0, 0, W + 2, L);
    kit.finalize();
  }
}

// ---------------------------------------------------------------- trees
export function scatterTrees(ctx, landuse, keepOut, count) {
  const { cols, rows, cell, x0, z0, codes, data } = landuse;
  const rng = mulberry32(99);
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 1, 6).translate(0, 0.5, 0).toNonIndexed();
  trunkGeo.computeVertexNormals();
  const leafGeo = new THREE.IcosahedronGeometry(1, 0);
  leafGeo.computeVertexNormals();
  const pineGeo = new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0).toNonIndexed();
  pineGeo.computeVertexNormals();
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: 0x5b3d24 }), count);
  const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), count);
  const pines = new THREE.InstancedMesh(pineGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  let nt = 0, nl = 0, np = 0;
  for (let tries = 0; tries < count * 12 && nt < count; tries++) {
    const i = Math.floor(rng() * cols), j = Math.floor(rng() * rows);
    const code = data[j * cols + i];
    const x = x0 + (i + rng()) * cell, z = z0 + (j + rng()) * cell;
    const near = (dx, dz) => data[Math.min(rows - 1, Math.max(0, j + dz)) * cols + Math.min(cols - 1, Math.max(0, i + dx))];
    const byWater = near(1, 0) === codes.water || near(-1, 0) === codes.water || near(0, 1) === codes.water || near(0, -1) === codes.water;
    if (code !== codes.grass) continue;
    // woods come in clumps; riverbanks get trees too
    const clump = 0.5 + 0.5 * Math.sin(x * 0.013 + 1.1) * Math.cos(z * 0.017 - 0.6);
    if (!byWater && rng() > clump * clump * 0.9) continue;
    if (keepOut(x, z)) continue;
    const g = ctx.heightAt(x, z);
    if (g < 0.6) continue;
    const scale = 0.8 + rng() * 0.7;
    const h = (3 + rng() * 2.5) * scale;
    q.setFromAxisAngle(up, rng() * 6.28);
    m.compose(p.set(x, g - 0.2, z), q, s.set(scale, h, scale));
    trunks.setMatrixAt(nt++, m);
    if (rng() < 0.7) {
      const r = (2.2 + rng() * 1.2) * scale;
      m.compose(p.set(x, g + h + r * 0.4, z), q, s.set(r, r * 0.85, r));
      leaves.setMatrixAt(nl, m);
      leaves.setColorAt(nl++, c.setHSL(0.24 + rng() * 0.07, 0.42, 0.26 + rng() * 0.1));
    } else {
      m.compose(p.set(x, g + h * 0.35, z), q, s.set(2 * scale, h * 1.5, 2 * scale));
      pines.setMatrixAt(np, m);
      pines.setColorAt(np++, c.setHSL(0.3 + rng() * 0.04, 0.4, 0.2 + rng() * 0.06));
    }
    ctx.physics.addCircle(x, z, 0.35 * scale, { y0: g - 1, y1: g + 8 });
  }
  trunks.count = nt; leaves.count = nl; pines.count = np;
  for (const im of [trunks, leaves, pines]) {
    im.castShadow = true;
    im.receiveShadow = true;
    ctx.scene.add(im);
  }
  return nt;
}
