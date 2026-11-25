// Shrine of the Anchor: a sailors' shrine to Valkur the Mighty near the harbour (R2 on the map).
// A walled, paved courtyard with a big bronze anchor statue in the middle, benches, lanterns
// and rope, and a small open-fronted chapel at the back.
//
// On the map the courtyard is hemmed in by buildings, so the gate goes wherever the map
// leaves open street (front, left or right wall) and the furniture keeps clear of it.

import * as THREE from 'three';
import { longAxisFrame, finishFrame } from './temple-align.js';
import { faceted } from '../engine/kit.js';

const VERDIGRIS = 0x5f9e8a, BRONZE = 0x9c6b30, SEA = 0x2f5e6e, ROPE = 0xb8955c, WALL = 0xd8d0c0;

export default {
  build(outerKit, outerPlace, ctx) {
    const frame = longAxisFrame(outerKit, outerPlace, ctx);
    const kit = frame.k;
    const place = { ...outerPlace, w: frame.w, d: frame.d };
    const flame = kit.mat(0xffb050, { emissive: 0xff7a10, emissiveIntensity: 2.2 });
    const glow = kit.mat(0xffe0a0, { emissive: 0xffb040, emissiveIntensity: 1.3 });
    const hw = Math.min(place.w, 16) / 2 - 0.4;   // half width inside the plot
    const hd = Math.min(place.d, 24) / 2 - 0.3;   // half depth
    const WH = 2.6;
    const AZ = 1;                                 // the anchor
    const CW = Math.min(9, 2 * hw - 2), CD = 5.6, CZ = -hd + 0.4 + CD / 2; // the chapel

    // ---- where the gate goes: the wall spot with the most open street outside it -------------
    const free = (lx, lz) => { const p = kit.toWorld(lx, lz); return !ctx.buildingAt?.(p.x, p.z); };
    const cands = [];
    for (const x of [0, -2.5, 2.5]) cands.push({ side: 'front', x, z: hd, nx: 0, nz: 1 });
    for (const z of [2, -2.5, 6, -1, 8.5]) {
      cands.push({ side: 'left', x: -hw, z, nx: -1, nz: 0 });
      cands.push({ side: 'right', x: hw, z, nx: 1, nz: 0 });
    }
    let gate = cands[0], best = -1;
    for (const c of cands) {
      if (c.side !== 'front' && c.z - 1.6 < CZ + CD / 2 + 0.2) continue; // not beside the chapel
      let n = 0;
      for (const s of [1.2, 2.5, 4, 6]) for (const t of [-1.2, 0, 1.2]) {
        if (free(c.x + c.nx * s + c.nz * t, c.z + c.nz * s - c.nx * t)) n++;
      }
      if (n > best) { best = n; gate = c; }
    }
    const nearGate = (x, z) => Math.hypot(x - (gate.x - gate.nx * 1.5), z - (gate.z - gate.nz * 1.5)) < 3.4;

    // ---- paving ------------------------------------------------------------------------------
    for (let x = -hw + 0.75; x < hw; x += 1.5) {
      for (let z = -hd + 0.75; z < hd; z += 1.5) {
        const c = (Math.round((x + hw) / 1.5) + Math.round((z + hd) / 1.5)) % 2 ? 'paleStone' : 0xb8b0a2;
        kit.box(1.46, 0.08, 1.46, c, x, 0, z, { shadow: false });
      }
    }
    for (let i = 0; i < 20; i++) { // a ring of sea-blue tiles round the anchor
      const a = (i / 20) * Math.PI * 2;
      kit.box(0.9, 0.1, 0.5, SEA, Math.sin(a) * 3.4, 0, AZ + Math.cos(a) * 3.4, { ry: a, shadow: false });
    }

    // ---- courtyard wall ------------------------------------------------------------------------
    const walls = {
      front: [-hw, hd, hw, hd], right: [hw, hd, hw, -hd], back: [hw, -hd, -hw, -hd], left: [-hw, -hd, -hw, hd],
    };
    for (const [side, [x1, z1, x2, z2]] of Object.entries(walls)) {
      const L = Math.hypot(x2 - x1, z2 - z1);
      let at = null;
      if (side === gate.side) at = side === 'front' ? gate.x + hw : side === 'right' ? hd - gate.z : gate.z + hd;
      kit.wall(x1, z1, x2, z2, { h: WH, t: 0.5, color: WALL, doors: at === null ? [] : [{ at, w: 3, h: 4 }] });
      // coping stones, split around the gate
      const ux = (x2 - x1) / L, uz = (z2 - z1) / L, ry = Math.atan2(x2 - x1, z2 - z1) - Math.PI / 2;
      const spans = at === null ? [[0, L]] : [[0, at - 1.5], [at + 1.5, L]];
      for (const [a, b] of spans) {
        if (b - a < 0.1) continue;
        const m = (a + b) / 2;
        kit.box(b - a + 0.25, 0.2, 0.75, 'stone', x1 + ux * m, WH, z1 + uz * m, { ry });
      }
    }
    gateway(kit, glow, gate);

    // ---- the anchor ----------------------------------------------------------------------------
    kit.box(4.2, 0.35, 4.2, 'stone', 0, 0, AZ);
    kit.box(3.2, 0.5, 3.2, 'paleStone', 0, 0.35, AZ);
    kit.box(2.1, 1.4, 2.1, 'stone', 0, 0.85, AZ);
    kit.box(2.3, 0.2, 2.3, 'paleStone', 0, 2.25, AZ);
    for (const [x, z, ry] of [[0, AZ + 1.08, 0], [0, AZ - 1.08, 0], [1.08, AZ, Math.PI / 2], [-1.08, AZ, Math.PI / 2]]) {
      kit.box(1.3, 0.5, 0.06, BRONZE, x, 1.3, z, { ry }); // plaques
    }
    kit.circle(0, AZ, 2.3, { y0: -0.5, y1: 9 });
    anchor(kit, 0, 2.45, AZ, 1.15);

    // ---- benches, rope, crates, planters, lanterns -----------------------------------------------
    const put = (x, z, fn) => { if (!nearGate(x, z)) fn(); };
    for (const z of [6.5, -2.5]) {
      for (const s of [-1, 1]) {
        const x = s * (hw - 0.75);
        put(x, z, () => {
          kit.box(0.6, 0.12, 2.6, 'paleStone', x, 0.45, z);
          for (const dz of [-1, 1]) kit.box(0.45, 0.45, 0.4, 'stone', x, 0, z + dz);
          kit.solidBox(0.7, 2.6, x, z, 0, 0.9);
        });
      }
    }
    for (const [x, z] of [[-hw + 1.4, hd - 1.5], [hw - 1.3, -1.2], [hw - 1.0, 0.1]]) put(x, z, () => ropeCoil(kit, x, z));
    for (const s of [-1, 1]) {
      put(s * (hw - 1.2), hd - 3.4, () => kit.box(0.9, 0.7, 0.9, 'plank', s * (hw - 1.2), 0, hd - 3.4, { ry: 0.3 * s, solid: true }));
      put(s * (hw - 1.1), hd - 4.8, () => {
        kit.cyl(0.35, 0.35, 0.9, 'wood', s * (hw - 1.1), 0, hd - 4.8, { seg: 8, solid: true });
        kit.box(0.7, 0.06, 0.7, 'black', s * (hw - 1.1), 0.9, hd - 4.8);
      });
    }
    for (const [x, z] of [[-hw + 0.9, 2.5], [hw - 0.9, 3.4], [-hw + 0.9, -4.6], [hw - 0.9, -4.6]]) {
      put(x, z, () => {
        kit.cyl(0.45, 0.35, 0.6, 'roofRed', x, 0, z, { seg: 8, solid: true });
        kit.ball(0.45, 'leaf', x, 0.85, z);
        kit.ball(0.12, 0x6f9fd8, x + 0.2, 1.15, z + 0.1, { shadow: false });
        kit.ball(0.12, 0xf0f0ff, x - 0.15, 1.1, z - 0.2, { shadow: false });
      });
    }
    for (const [x, z] of [[-hw + 1, -3.6], [hw - 1, -3.6], [-hw + 1, hd - 6.5], [hw - 1, hd - 6.5]]) {
      put(x, z, () => {
        kit.cyl(0.08, 0.12, 2.6, 'iron', x, 0, z, { seg: 6, solid: true });
        lantern(kit, glow, x, 2.6, z, false);
      });
    }

    // ---- offering basin --------------------------------------------------------------------------
    const OZ = CZ + CD / 2 + 1.4;
    kit.cyl(0.35, 0.5, 0.8, 'stone', 0, 0, OZ, { seg: 8, solid: true });
    kit.cyl(1.0, 0.55, 0.35, 'paleStone', 0, 0.8, OZ, { seg: 10 });
    kit.cyl(0.85, 0.85, 0.05, kit.mat(0x3f7f8f, { emissive: 0x0f3a46, emissiveIntensity: 0.6 }), 0, 1.07, OZ, { seg: 10, shadow: false });
    for (let i = 0; i < 9; i++) {
      const a = i * 2.4, r = 0.2 + (i % 3) * 0.2;
      kit.cyl(0.07, 0.07, 0.02, 'gold', Math.sin(a) * r, 1.1, OZ + Math.cos(a) * r, { seg: 6, shadow: false });
    }
    for (const a of [0.6, 2.2, 3.8, 5.3]) {
      kit.cyl(0.05, 0.05, 0.25, 0xf4ecd8, Math.sin(a) * 0.93, 1.15, OZ + Math.cos(a) * 0.93, { seg: 5 });
      kit.cone(0.04, 0.1, flame, Math.sin(a) * 0.93, 1.4, OZ + Math.cos(a) * 0.93, { seg: 4, shadow: false });
    }

    // ---- the chapel --------------------------------------------------------------------------------
    kit.room({
      x: 0, z: CZ, w: CW, d: CD, h: 4.4, wall: 'whitewash', floor: 'plank', base: 'stone',
      doors: { front: [{ at: 0, w: CW - 2.2, h: 3.4 }] }, roof: 'gable', roofColor: 0x3f6f6c, ceilingColor: 0x6b4a2e,
    });
    kit.floor(0, CZ, CW - 0.8, CD - 0.8, 0.12);
    for (const s of [-1, 1]) kit.cyl(0.22, 0.25, 3.4, 'paleStone', s * (CW / 2 - 1.1), 0, CZ + CD / 2 + 0.15, { seg: 8 });
    kit.box(CW + 0.2, 0.5, 0.2, SEA, 0, 3.6, CZ + CD / 2 + 0.25);
    anchor(kit, 0, 3.62, CZ + CD / 2 + 0.38, 0.13, true);
    const back = CZ - CD / 2 + 0.2;
    // altar with a sea-blue cloth, shells, candles and a model ship
    kit.box(3.2, 1.0, 1.1, 'stone', 0, 0.12, back + 1.0, { solid: true });
    kit.box(3.3, 0.05, 1.2, SEA, 0, 1.12, back + 1.0);
    kit.box(0.6, 0.85, 0.06, SEA, 0, 0.3, back + 1.6);
    modelShip(kit, 0, 1.17, back + 0.95);
    for (const [x, z, c] of [[-1.3, back + 1.25, 0xf0d8c8], [1.25, back + 0.8, 0xe8c0b0], [1.4, back + 1.3, 0xfaf0e0], [-1.1, back + 0.75, 0xf6e2d2]]) {
      kit.cone(0.12, 0.22, c, x, 1.17, z, { seg: 5, rx: -1.2 });
    }
    for (const x of [-1.5, -0.95, 0.95, 1.5]) {
      kit.cyl(0.05, 0.05, 0.35 + Math.abs(x) * 0.1, 0xf4ecd8, x, 1.17, back + 0.6, { seg: 5 });
      kit.cone(0.04, 0.1, flame, x, 1.52 + Math.abs(x) * 0.1, back + 0.6, { seg: 4, shadow: false });
    }
    kit.light(0, 2.2, back + 1.6, { color: 0xffb060, intensity: 14, distance: 8, flicker: 0.5 });
    shipsWheel(kit, 0, 2.85, back + 0.12);
    for (const s of [-1, 1]) { // fishing nets with red floats on the side walls
      const x = s * (CW / 2 - 0.25);
      for (let i = 0; i < 6; i++) kit.box(0.03, 2.2, 0.03, 0x3d4a3a, x - s * 0.02, 1.2, CZ - 1.6 + i * 0.6, { rz: 0.06 * s });
      for (let j = 0; j < 4; j++) kit.box(0.03, 0.03, 3.2, 0x3d4a3a, x - s * 0.02, 1.4 + j * 0.55, CZ - 0.1);
      for (const [y, z] of [[1.3, CZ - 1.2], [2.5, CZ + 0.4], [1.8, CZ + 1.1]]) kit.ball(0.12, 'red', x - s * 0.1, y, z, { shadow: false });
    }
    kit.ball(0.5, 0xe8e4dc, CW / 2 - 1.3, 0.62, back + 0.7, { detail: 1 }); // a huge conch, offered by a whaler
    kit.cone(0.35, 0.7, 0xf0c8b8, CW / 2 - 1.3, 0.62, back + 1.15, { seg: 6, rx: Math.PI / 2 });

    const main = kit.info({ id: place.id, name: place.name, kind: place.kind, description: place.description, radius: 13, labelHeight: 10, color: '#6fc0b0' });
    main.spawn = kit.toWorld(gate.x + gate.nx * 3.5, gate.z + gate.nz * 3.5); // fast travel: just outside the gate
    kit.info({
      id: `${place.id}-anchor`, name: "The Silver Gull's anchor", kind: 'Statue', x: 0, z: AZ, radius: 3.6, label: false, travel: false,
      description: 'Raised from the wreck of the Silver Gull after the great storm of 1479 DR, cast in bronze and set here by her surviving crew.\n\nSailors touch the ring for luck before every voyage; it has been polished bright by a thousand hands. Coins in the basin keep Umberlee from growing jealous.',
    });
    finishFrame(frame, ctx);
  },
};

/** Gate pillars, lintel, a small anchor emblem and lanterns, facing out along gate.nx/nz. */
function gateway(kit, glow, gate) {
  const ry = Math.atan2(gate.nx, gate.nz);
  const g = new THREE.Group();
  g.position.set(gate.x, 0, gate.z);
  g.rotation.y = ry;
  kit.add(g);
  const c = Math.cos(ry), s = Math.sin(ry);
  for (const side of [-1, 1]) {
    const lx = side * 1.95;
    kit.box(0.9, 3.8, 0.9, 'stone', lx, 0, 0, { parent: g });
    kit.box(1.1, 0.25, 1.1, 'paleStone', lx, 3.8, 0, { parent: g });
    lantern(kit, glow, lx, 4.05, 0, false, g);
    kit.circle(gate.x + lx * c, gate.z - lx * s, 0.55, { y0: -0.5, y1: 4 });
  }
  kit.light(gate.x, 4.6, gate.z, { color: 0xffc070, intensity: 10, distance: 8 });
  kit.box(4.8, 0.5, 0.7, 'paleStone', 0, 3.3, 0, { parent: g });
  anchor(kit, 0, 3.86, 0.38, 0.13, true, g);
}

/** A rod in the x-y plane of `parent` from (x1, y1) to (x2, y2). */
function rod(kit, parent, x1, y1, x2, y2, r, color) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
  return kit.cyl(r, r, L, color, x1, y1, 0, { seg: 8, rz: Math.atan2(-dx, dy), parent });
}

/** The anchor: shank, curved arms with flukes, a crossbar stock and a ring. `small` skips the chain. */
function anchor(kit, x, y, z, scale = 1, small = false, parent) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  kit.add(g, parent);
  const C = VERDIGRIS;
  kit.cyl(0.22, 0.26, 4.6, C, 0, 0.3, 0, { seg: 8, parent: g });                   // shank
  const R = 1.9, cy = 2.1;                                                           // arms: an arc under the shank
  const angles = [];
  for (let a = 198; a <= 342; a += 18) angles.push((a * Math.PI) / 180);
  for (let i = 0; i < angles.length - 1; i++) {
    const p0 = [Math.cos(angles[i]) * R, cy + Math.sin(angles[i]) * R];
    const p1 = [Math.cos(angles[i + 1]) * R, cy + Math.sin(angles[i + 1]) * R];
    rod(kit, g, p0[0], p0[1], p1[0], p1[1], 0.24, C);
    kit.ball(0.25, C, p1[0], p1[1], 0, { parent: g });
  }
  kit.ball(0.38, C, 0, cy - R + 0.05, 0, { parent: g, detail: 1 });                 // crown
  for (const s of [-1, 1]) {                                                        // flukes
    const a = s < 0 ? angles[0] : angles[angles.length - 1];
    const tx = Math.cos(a) * R, ty = cy + Math.sin(a) * R;
    kit.ball(0.26, C, tx, ty, 0, { parent: g });
    kit.gable(1.1, 1.0, 0.18, C, tx + s * 0.12, ty - 0.1, 0, { parent: g, rz: -s * 0.6 });
    kit.gable(1.1, 0.5, 0.18, C, tx + s * 0.32, ty - 0.42, 0, { parent: g, rz: -s * 0.6 + Math.PI });
  }
  kit.cyl(0.15, 0.15, 3.4, BRONZE, 0, 4.0, -1.7, { seg: 8, rx: Math.PI / 2, parent: g }); // stock
  for (const s of [-1, 1]) kit.ball(0.24, BRONZE, 0, 4.0, s * 1.72, { parent: g });
  kit.box(0.65, 0.4, 0.65, BRONZE, 0, 3.8, 0, { parent: g });
  kit.mesh(faceted(new THREE.TorusGeometry(0.58, 0.14, 6, 14)), 'gold', 0, 5.5, 0, { parent: g }); // the ring, polished bright
  if (small) return;
  const link = faceted(new THREE.TorusGeometry(0.17, 0.05, 4, 8));                  // a chain draped from the ring
  for (let i = 0; i < 7; i++) {
    kit.mesh(link, 'iron', 0.6 + i * 0.12, 5.05 - i * 0.42, 0.05 + (i > 4 ? (i - 4) * 0.2 : 0), { parent: g, ry: i % 2 ? Math.PI / 2 : 0, rz: 0.25 });
  }
}

function ropeCoil(kit, x, z) {
  const geo = faceted(new THREE.TorusGeometry(0.42, 0.1, 5, 12));
  for (let i = 0; i < 3; i++) kit.mesh(geo, ROPE, x, 0.1 + i * 0.17, z, { rx: Math.PI / 2 });
  kit.circle(x, z, 0.55, { y0: 0, y1: 0.6 });
}

/** An iron lantern with glowing glass, standing on (x, y, z). */
function lantern(kit, glow, x, y, z, light, parent) {
  const o = parent ? { parent } : {};
  kit.box(0.46, 0.06, 0.46, 'iron', x, y, z, o);
  kit.box(0.32, 0.46, 0.32, glow, x, y + 0.06, z, { ...o, shadow: false });
  for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2]]) kit.box(0.05, 0.5, 0.05, 'iron', x + dx, y + 0.06, z + dz, o);
  kit.box(0.46, 0.05, 0.46, 'iron', x, y + 0.55, z, o);
  kit.cone(0.36, 0.3, 'iron', x, y + 0.6, z, { ...o, seg: 4, ry: Math.PI / 4 });
  if (light) kit.light(x, y + 0.3, z, { color: 0xffc070, intensity: 8, distance: 7 });
}

function shipsWheel(kit, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  kit.add(g);
  kit.mesh(faceted(new THREE.TorusGeometry(0.75, 0.07, 5, 16)), 'darkWood', 0, 0, 0.12, { parent: g });
  kit.cyl(0.14, 0.14, 0.25, 'bronze', 0, 0, 0, { seg: 8, rx: Math.PI / 2, parent: g });
  for (let i = 0; i < 8; i++) kit.cyl(0.035, 0.05, 1.05, 'wood', 0, 0, 0.12, { seg: 5, rz: (i / 8) * Math.PI * 2, parent: g });
}

function modelShip(kit, x, y, z) {
  kit.box(0.2, 0.08, 0.2, 'darkWood', x, y, z);
  kit.box(1.1, 0.22, 0.32, 'wood', x, y + 0.08, z);
  kit.gable(0.32, 0.25, 0.3, 'wood', x + 0.66, y + 0.08, z, { rz: -Math.PI / 2 });
  kit.box(0.3, 0.18, 0.3, 'darkWood', x - 0.45, y + 0.3, z);
  kit.cyl(0.02, 0.02, 0.9, 'darkWood', x + 0.05, y + 0.3, z, { seg: 4 });
  kit.box(0.04, 0.45, 0.42, 0xf2ead8, x + 0.08, y + 0.55, z);
}
