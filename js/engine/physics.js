// Collision and walkable surfaces.
//
// Colliders are vertical walls: line segments (with a thickness) or circles, each with a
// height range [y0, y1]. They only block you when your body overlaps that height range,
// so a low wall can be stepped over and a deck rail doesn't block the hold below it.
//
// Floors are walkable surfaces above the terrain: flat rectangles or ramps (stairs).
// You stand on the highest floor that is at or just above (one step) your feet, so you
// can walk under a deck and up onto it by the stairs.

const CELL = 8; // metres per spatial-hash cell

export class Physics {
  constructor(terrainHeight) {
    this.terrainHeight = terrainHeight;
    this.colliders = new Map(); // cellKey -> [collider]
    this.floors = new Map();
    this.openings = [];
    this.waterFloor = -Infinity;
  }

  _key(cx, cz) { return cx * 65536 + cz; }

  _insert(map, item, minX, minZ, maxX, maxZ) {
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = this._key(cx, cz);
        let list = map.get(k);
        if (!list) map.set(k, (list = []));
        list.push(item);
      }
    }
  }

  _query(map, x, z) {
    return map.get(this._key(Math.floor(x / CELL), Math.floor(z / CELL))) ?? [];
  }

  /** Areas (rectangles) where segments tagged `quay` are left out, e.g. under bridges and gangplanks. */
  addOpening(cx, cz, halfW, halfD, angle) {
    this.openings.push({ cx, cz, halfW, halfD, cos: Math.cos(angle), sin: Math.sin(angle) });
  }

  _inOpening(x, z) {
    for (const o of this.openings) {
      const dx = x - o.cx, dz = z - o.cz;
      const lx = dx * o.cos - dz * o.sin, lz = dx * o.sin + dz * o.cos;
      if (Math.abs(lx) <= o.halfW && Math.abs(lz) <= o.halfD) return true;
    }
    return false;
  }

  addSegment(x1, z1, x2, z2, { r = 0.15, y0 = -1e9, y1 = 1e9, tag } = {}) {
    if (tag === 'quay' && this._inOpening((x1 + x2) / 2, (z1 + z2) / 2)) return;
    const c = { kind: 0, x1, z1, x2, z2, r, y0, y1 };
    this._insert(this.colliders, c, Math.min(x1, x2) - r - 1, Math.min(z1, z2) - r - 1, Math.max(x1, x2) + r + 1, Math.max(z1, z2) + r + 1);
  }

  addCircle(x, z, r, { y0 = -1e9, y1 = 1e9 } = {}) {
    const c = { kind: 1, x, z, r, y0, y1 };
    this._insert(this.colliders, c, x - r - 1, z - r - 1, x + r + 1, z + r + 1);
  }

  /** Closed polygon outline, e.g. a building footprint: [x, z, x, z, ...]. */
  addPolygon(pts, opts) {
    for (let i = 0; i < pts.length; i += 2) {
      const j = (i + 2) % pts.length;
      this.addSegment(pts[i], pts[i + 1], pts[j], pts[j + 1], opts);
    }
  }

  /**
   * A walkable rectangle centred on (cx, cz), halfW along the rotated x axis, halfD along z.
   * Height y, or y0 -> y1 rising along +z (local) for a ramp or staircase.
   */
  addFloor({ cx, cz, halfW, halfD, angle = 0, y, y0, y1 }) {
    const f = { cx, cz, halfW, halfD, cos: Math.cos(angle), sin: Math.sin(angle), y0: y0 ?? y, y1: y1 ?? y };
    const ext = Math.hypot(halfW, halfD);
    this._insert(this.floors, f, cx - ext, cz - ext, cx + ext, cz + ext);
    return f;
  }

  _floorHeight(f, x, z) {
    const dx = x - f.cx, dz = z - f.cz;
    // world -> local: rotate by -angle (three.js rotation.y convention)
    const lx = dx * f.cos - dz * f.sin;
    const lz = dx * f.sin + dz * f.cos;
    if (Math.abs(lx) > f.halfW || Math.abs(lz) > f.halfD) return null;
    if (f.y0 === f.y1) return f.y0;
    return f.y0 + (f.y1 - f.y0) * ((lz + f.halfD) / (2 * f.halfD));
  }

  /** Height of whatever you would stand on at (x, z) with your feet at feetY. */
  ground(x, z, feetY, step = 0.5) {
    let g = Math.max(this.terrainHeight(x, z), this.waterFloor);
    for (const f of this._query(this.floors, x, z)) {
      const h = this._floorHeight(f, x, z);
      if (h !== null && h <= feetY + step && h > g) g = h;
    }
    return g;
  }

  /** Lowest floor above your head, so you can't jump through a deck or ceiling. */
  ceiling(x, z, feetY, step = 0.5) {
    let c = Infinity;
    for (const f of this._query(this.floors, x, z)) {
      const h = this._floorHeight(f, x, z);
      if (h !== null && h > feetY + step && h < c) c = h;
    }
    return c;
  }

  /** Push a body (circle of `radius`, from feetY up `height`) out of anything it overlaps. */
  collide(pos, feetY, height, radius, step = 0.45) {
    const lo = feetY + step, hi = feetY + height;
    for (let pass = 0; pass < 2; pass++) {
      for (const c of this._query(this.colliders, pos.x, pos.z)) {
        if (c.y1 <= lo || c.y0 >= hi) continue;
        let px, pz;
        if (c.kind === 1) {
          px = c.x; pz = c.z;
        } else {
          const dx = c.x2 - c.x1, dz = c.z2 - c.z1;
          const len2 = dx * dx + dz * dz || 1e-9;
          const t = Math.min(Math.max(((pos.x - c.x1) * dx + (pos.z - c.z1) * dz) / len2, 0), 1);
          px = c.x1 + dx * t; pz = c.z1 + dz * t;
        }
        const ox = pos.x - px, oz = pos.z - pz;
        const min = c.r + radius;
        const d2 = ox * ox + oz * oz;
        if (d2 < min * min) {
          const d = Math.sqrt(d2) || 1e-4;
          pos.x = px + (ox / d) * min;
          pos.z = pz + (oz / d) * min;
        }
      }
    }
  }
}
