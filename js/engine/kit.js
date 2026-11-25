// Building kit for places (taverns, temples, ships...).
//
// Every place is built in its own LOCAL coordinates:
//   origin = the place's centre at ground level, +z = the front (where the door is),
//   +x = to the right when facing the front from outside... (i.e. local x), y = up.
// All positions given to kit methods are local; the kit converts colliders, floors,
// lights and info points to world coordinates for you.
//
// Conventions for mesh helpers: (x, y, z) is the BOTTOM-CENTRE of the shape, so
// kit.box(2, 1, 1, 'wood', 0, 0, 0) is a 1 m tall box standing on the ground.
// Colours can be a hex number (0xaa8844) or a name from PALETTE.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export const PALETTE = {
  plaster: 0xe6dcc6, whitewash: 0xf1ece0, ochre: 0xd9b778, timber: 0x6b4a2e, wood: 0x8a5f3a, darkWood: 0x4a3220,
  plank: 0xa87a4c, stone: 0x9c978e, darkStone: 0x6c675f, paleStone: 0xc9c2b4, marble: 0xe8e4dc, slate: 0x4f5862,
  roofRed: 0x9e4a34, roofBrown: 0x7a4b2c, thatch: 0xb89452, iron: 0x3c3f44, gold: 0xd4a93a, bronze: 0x9c6b30,
  verdigris: 0x5f9e8a, cloth: 0xd8ccb0, red: 0x8e2a2a, blue: 0x2f4e7a, green: 0x3f6b35, purple: 0x5b3a7a,
  rose: 0xd77a8a, black: 0x15110d, hay: 0xd8b860, dirt: 0x6e5236, leaf: 0x4f7a34, bone: 0xe3dccb, glass: 0x9fc4d8,
};

const _matCache = new Map();
/** Shared Lambert material. opts: emissive (hex), emissiveIntensity, transparent, opacity, side. */
export function material(color, opts = {}) {
  const c = typeof color === 'string' ? PALETTE[color] ?? 0xff00ff : color;
  const key = c + JSON.stringify(opts);
  if (!_matCache.has(key)) {
    _matCache.set(key, new THREE.MeshLambertMaterial({ color: c, ...opts }));
  }
  return _matCache.get(key);
}

/** One normal per face for the low-poly look, without uvs so geometries can be merged. */
export function faceted(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
  g.computeVertexNormals();
  return g;
}

const GEO = {
  box: faceted(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)),
  gable: (() => {
    const s = new THREE.Shape();
    s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath();
    return faceted(new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }).translate(0, 0, -0.5));
  })(),
};
const _geoCache = new Map();
function cachedGeo(key, make) {
  if (!_geoCache.has(key)) _geoCache.set(key, faceted(make()));
  return _geoCache.get(key);
}

export class Kit {
  /**
   * @param ctx    shared world context: { scene, physics, lights, updates, locations, heightAt }
   * @param origin { x, z, y, angle } world position of local (0,0,0) and rotation (radians)
   */
  constructor(ctx, origin) {
    this.ctx = ctx;
    this.origin = origin;
    this.group = new THREE.Group();
    this.group.position.set(origin.x, origin.y, origin.z);
    this.group.rotation.y = origin.angle;
    ctx.scene.add(this.group);
    this.cos = Math.cos(origin.angle);
    this.sin = Math.sin(origin.angle);
    this.dynamics = new Set();
    this.mainLocation = null;
  }

  // ------------------------------------------------------------ coordinates
  /** Local (x, z) -> world { x, z }. */
  toWorld(x, z) {
    return { x: this.origin.x + x * this.cos + z * this.sin, z: this.origin.z - x * this.sin + z * this.cos };
  }
  /** Ground height (world y) under a local point, relative to this place's origin. */
  groundAt(x, z) {
    const w = this.toWorld(x, z);
    return this.ctx.heightAt(w.x, w.z) - this.origin.y;
  }

  // ------------------------------------------------------------ meshes
  mat(color, opts) { return color?.isMaterial ? color : material(color, opts); }

  /** Add any Object3D at local coordinates. */
  add(obj, parent = this.group) { parent.add(obj); return obj; }

  mesh(geo, color, x = 0, y = 0, z = 0, { ry = 0, rx = 0, rz = 0, parent, shadow = true } = {}) {
    const m = new THREE.Mesh(geo, this.mat(color));
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = shadow;
    m.receiveShadow = true;
    (parent ?? this.group).add(m);
    return m;
  }

  /** Box w (x) × h (y) × d (z) standing on (x, y, z). */
  box(w, h, d, color, x = 0, y = 0, z = 0, opts = {}) {
    const m = this.mesh(GEO.box, color, x, y, z, opts);
    m.scale.set(w, h, d);
    if (opts.solid) this.solidBox(w, d, x, z, y, y + h, opts.ry ?? 0);
    return m;
  }

  /** Cylinder (rTop, rBottom, height) standing on (x, y, z). seg = number of sides. */
  cyl(rTop, rBot, h, color, x = 0, y = 0, z = 0, opts = {}) {
    const seg = opts.seg ?? 8;
    const geo = cachedGeo(`cyl${rTop}_${rBot}_${seg}`, () => new THREE.CylinderGeometry(rTop, rBot, 1, seg).translate(0, 0.5, 0));
    const m = this.mesh(geo, color, x, y, z, opts);
    m.scale.y = h;
    if (opts.solid) this.circle(x, z, Math.max(rTop, rBot), { y0: y, y1: y + h });
    return m;
  }

  cone(r, h, color, x = 0, y = 0, z = 0, opts = {}) {
    const seg = opts.seg ?? 8;
    const geo = cachedGeo(`cone${seg}`, () => new THREE.ConeGeometry(1, 1, seg).translate(0, 0.5, 0));
    const m = this.mesh(geo, color, x, y, z, opts);
    m.scale.set(r, h, r);
    return m;
  }

  /** Low-poly ball (icosahedron) centred at (x, y, z). */
  ball(r, color, x = 0, y = 0, z = 0, opts = {}) {
    const geo = cachedGeo(`ico${opts.detail ?? 0}`, () => new THREE.IcosahedronGeometry(1, opts.detail ?? 0));
    const m = this.mesh(geo, color, x, y, z, opts);
    m.scale.setScalar(r);
    return m;
  }

  /** Triangular prism (gable roof / tent): base w × d on (x, y, z), ridge along z, height h. */
  gable(w, h, d, color, x = 0, y = 0, z = 0, opts = {}) {
    const m = this.mesh(GEO.gable, color, x, y, z, opts);
    m.scale.set(w, h, d);
    return m;
  }

  /** Mark a mesh as moving (animated) so finalize() doesn't merge it away. */
  dynamic(mesh) { this.dynamics.add(mesh); return mesh; }

  /** Run fn(t, dt) every frame (t = seconds since start). */
  animate(fn) { this.ctx.updates.push(fn); }

  // ------------------------------------------------------------ physics (local coordinates)
  segment(x1, z1, x2, z2, { r = 0.15, y0 = -0.5, y1 = 4, tag } = {}) {
    const a = this.toWorld(x1, z1), b = this.toWorld(x2, z2);
    this.ctx.physics.addSegment(a.x, a.z, b.x, b.z, { r, y0: y0 + this.origin.y, y1: y1 + this.origin.y, tag });
  }

  circle(x, z, r, { y0 = -0.5, y1 = 4 } = {}) {
    const p = this.toWorld(x, z);
    this.ctx.physics.addCircle(p.x, p.z, r, { y0: y0 + this.origin.y, y1: y1 + this.origin.y });
  }

  /** Solid rectangle (w × d) centred on (x, z), blocking from y0 to y1. */
  solidBox(w, d, x, z, y0 = 0, y1 = 3, ry = 0) {
    const c = Math.cos(ry), s = Math.sin(ry);
    const p = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    const pts = [p(-w / 2, -d / 2), p(w / 2, -d / 2), p(w / 2, d / 2), p(-w / 2, d / 2)];
    for (let i = 0; i < 4; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % 4];
      this.segment(ax, az, bx, bz, { r: 0.05, y0, y1 });
    }
  }

  /** Walkable flat floor w × d centred on (x, z) at height y. */
  floor(x, z, w, d, y, { ry = 0 } = {}) {
    const p = this.toWorld(x, z);
    return this.ctx.physics.addFloor({ cx: p.x, cz: p.z, halfW: w / 2, halfD: d / 2, angle: this.origin.angle + ry, y: y + this.origin.y });
  }

  /** Ramp or staircase w × d centred on (x, z), height going from yStart at its -z end to yEnd at its +z end (local, before ry). */
  ramp(x, z, w, d, yStart, yEnd, { ry = 0 } = {}) {
    const p = this.toWorld(x, z);
    return this.ctx.physics.addFloor({ cx: p.x, cz: p.z, halfW: w / 2, halfD: d / 2, angle: this.origin.angle + ry, y0: yStart + this.origin.y, y1: yEnd + this.origin.y });
  }

  /**
   * Visible stairs + walkable ramp, centred on (x, z), `length` long along local +z (turn with ry),
   * climbing from height y0 at the -z end to y1 at the +z end.
   */
  stairs(x, z, width, length, y0, y1, color = 'wood', { ry = 0, steps } = {}) {
    const n = steps ?? Math.max(2, Math.round(Math.abs(y1 - y0) / 0.22));
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    this.group.add(g);
    const base = Math.min(y0, y1);
    for (let i = 0; i < n; i++) {
      const top = y0 + (y1 - y0) * ((i + 1) / n);
      const zz = -length / 2 + length * ((i + 0.5) / n);
      this.box(width, Math.max(0.05, top - base), length / n, color, 0, base, zz, { parent: g });
    }
    this.ramp(x, z, width, length, y0, y1, { ry });
    return g;
  }

  /** Remove quay walls (river edge colliders) under a rectangle, e.g. for a gangplank. */
  opening(x, z, w, d, { ry = 0 } = {}) {
    const p = this.toWorld(x, z);
    this.ctx.physics.addOpening(p.x, p.z, w / 2, d / 2, this.origin.angle + ry);
  }

  // ------------------------------------------------------------ architecture
  /**
   * A straight wall from (x1, z1) to (x2, z2), standing on y, h high, t thick.
   * doors:   [{ at, w = 1.4, h = 2.4 }]  at = distance from the start to the door's centre
   * windows: [{ at, w = 1, h = 1.2, y = 1.4, color }]  drawn as dark (or lit) panes, not holes
   * Blocks movement except at the doors.
   */
  wall(x1, z1, x2, z2, { h = 4, t = 0.4, y = 0, color = 'plaster', doors = [], windows = [], solid = true } = {}) {
    const dx = x2 - x1, dz = z2 - z1;
    const L = Math.hypot(dx, dz);
    const ry = Math.atan2(dx, dz) - Math.PI / 2; // local +x of the wall runs from p1 to p2
    const g = new THREE.Group();
    g.position.set(x1, y, z1);
    g.rotation.y = ry;
    this.group.add(g);
    const cuts = doors.map((d) => ({ a: d.at - (d.w ?? 1.4) / 2, b: d.at + (d.w ?? 1.4) / 2, h: d.h ?? 2.4 })).sort((p, q) => p.a - q.a);
    let cursor = 0;
    const piece = (a, b, y0, y1) => {
      if (b - a < 0.01 || y1 - y0 < 0.01) return;
      this.box(b - a, y1 - y0, t, color, (a + b) / 2, y0, 0, { parent: g });
    };
    const ux = dx / L, uz = dz / L;
    const solidPiece = (a, b) => {
      if (!solid || b - a < 0.01) return;
      this.segment(x1 + ux * a, z1 + uz * a, x1 + ux * b, z1 + uz * b, { r: t / 2 + 0.05, y0: y - 0.5, y1: y + h });
    };
    for (const c of cuts) {
      piece(cursor, c.a, 0, h);
      solidPiece(cursor, c.a);
      piece(c.a, c.b, c.h, h); // lintel above the door
      cursor = c.b;
    }
    piece(cursor, L, 0, h);
    solidPiece(cursor, L);
    for (const w of windows) {
      const ww = w.w ?? 1, wh = w.h ?? 1.2;
      for (const side of [1, -1]) {
        this.box(ww, wh, 0.06, w.color ?? 0x2c3440, w.at, w.y ?? 1.4, side * (t / 2 + 0.03), { parent: g, shadow: false });
      }
      this.box(ww + 0.25, 0.12, t + 0.25, 'darkWood', w.at, (w.y ?? 1.4) - 0.12, 0, { parent: g });
    }
    return g;
  }

  /**
   * An enterable rectangular building w (x) × d (z) centred on (x, z), walls h high.
   * doors: { front: [{ at, w, h }], back: [...], left: [...], right: [...] } with `at` measured
   *        from the centre of that side (0 = middle), front = +z side.
   * roof:  'gable' | 'hip' | 'flat' | null, roofColor, roofH. ceiling: true adds an inside ceiling.
   * Returns { inner: { w, d } } for furnishing.
   */
  room({ x = 0, z = 0, w, d, h = 4, t = 0.4, wall = 'plaster', floor = 'plank', base = 'stone',
    doors = { front: [{ at: 0 }] }, windows = {}, roof = 'gable', roofColor = 'roofRed', roofH, ceiling = true, ceilingColor = 'wood' } = {}) {
    const hw = w / 2, hd = d / 2;
    const sides = {
      front: [x - hw, z + hd, x + hw, z + hd],
      right: [x + hw, z + hd, x + hw, z - hd],
      back: [x + hw, z - hd, x - hw, z - hd],
      left: [x - hw, z - hd, x - hw, z + hd],
    };
    for (const [name, [ax, az, bx, bz]] of Object.entries(sides)) {
      const len = Math.hypot(bx - ax, bz - az);
      const ds = (doors[name] ?? []).map((dd) => ({ ...dd, at: len / 2 + (dd.at ?? 0) }));
      const ws = (windows[name] ?? []).map((ww) => ({ ...ww, at: len / 2 + (ww.at ?? 0) }));
      this.wall(ax, az, bx, bz, { h, t, color: wall, doors: ds, windows: ws });
    }
    // floor slab + a stone plinth outside
    this.box(w - t, 0.12, d - t, floor, x, 0, z);
    if (base) {
      for (const [ax, az, bx, bz] of Object.values(sides)) {
        const len = Math.hypot(bx - ax, bz - az);
        this.box(len + t + 0.1, 0.5, t + 0.16, base, (ax + bx) / 2, -0.3, (az + bz) / 2, { ry: Math.atan2(bx - ax, bz - az) - Math.PI / 2 });
      }
    }
    if (ceiling) this.box(w - 0.05, 0.25, d - 0.05, ceilingColor, x, h - 0.25, z);
    const rh = roofH ?? Math.min(w, d) * 0.45;
    if (roof === 'gable') {
      // ridge along the longer side
      if (d >= w) this.gable(w + 1, rh, d + 1, roofColor, x, h, z);
      else this.gable(d + 1, rh, w + 1, roofColor, x, h, z, { ry: Math.PI / 2 });
    } else if (roof === 'hip') {
      const m = this.cone(Math.hypot(w, d) / 2 + 0.6, rh, roofColor, x, h, z, { seg: 4, ry: Math.PI / 4 });
      m.scale.set((w + 1) / Math.SQRT2, rh, (d + 1) / Math.SQRT2);
    } else if (roof === 'flat') {
      this.box(w + 0.4, 0.4, d + 0.4, roofColor, x, h, z);
    }
    return { inner: { w: w - 2 * t, d: d - 2 * t } };
  }

  // ------------------------------------------------------------ lights, labels, info
  /** A light source at local (x, y, z); see LightPool for the options. */
  light(x, y, z, opts = {}) {
    const p = this.toWorld(x, z);
    return this.ctx.lights.add({ ...opts, x: p.x, y: y + this.origin.y, z: p.z });
  }

  /**
   * Something you can read about (press E nearby or click it).
   * { name, kind ('Tavern'...), description, x, z (local), radius, label: true, labelHeight }
   * The first info() of a place is its main entry (shown in the travel menu).
   */
  info({ id, name, kind, description, x = 0, z = 0, radius = 8, label = true, labelHeight = 8, color, travel }) {
    const p = this.toWorld(x, z);
    const loc = { id, name, kind, description, x: p.x, z: p.z, radius, color: color ?? '#e0b866', travel: travel ?? !this.mainLocation, group: this.group };
    if (label) {
      const el = document.createElement('div');
      el.className = 'label';
      el.textContent = name;
      el.style.setProperty('--accent', loc.color);
      const obj = new CSS2DObject(el);
      obj.position.set(x, labelHeight, z);
      this.group.add(obj);
      loc.label = obj;
    }
    if (!this.mainLocation) {
      this.mainLocation = loc;
      this.group.userData.location = loc;
    }
    this.ctx.locations.push(loc);
    return loc;
  }

  // ------------------------------------------------------------ finishing
  /** Merge all static meshes by material: a whole building becomes a handful of draw calls. */
  finalize() {
    this.group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.group.matrixWorld).invert();
    const byMat = new Map();
    const remove = [];
    this.group.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh) return;
      let p = o, dyn = false;
      while (p && p !== this.group) { if (this.dynamics.has(p)) dyn = true; p = p.parent; }
      if (dyn) return;
      const g = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      if (!byMat.has(o.material)) byMat.set(o.material, { geos: [], shadow: false });
      const e = byMat.get(o.material);
      e.geos.push(g);
      e.shadow ||= o.castShadow;
      remove.push(o);
    });
    for (const o of remove) o.parent.remove(o);
    for (const [mat, { geos, shadow }] of byMat) {
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      const m = new THREE.Mesh(merged, mat);
      m.castShadow = shadow;
      m.receiveShadow = true;
      this.group.add(m);
    }
    // drop now-empty helper groups
    const empty = [];
    this.group.traverse((o) => { if (o.isGroup && o !== this.group && o.children.length === 0) empty.push(o); });
    for (const o of empty) o.parent?.remove(o);
  }
}
