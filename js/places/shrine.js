// Shrine of the Anchor: a sailors' shrine to Valkur the Mighty near the harbour (R2 on the map).
// A walled, paved courtyard with a big bronze anchor statue in the middle, benches, lanterns
// and rope, and a small open-fronted chapel at the back.

import * as THREE from 'three';
import { longAxisFrame, finishFrame } from './temple-align.js';
import { faceted } from '../engine/kit.js';

const VERDIGRIS = 0x5f9e8a, BRONZE = 0x9c6b30, SEA = 0x2f5e6e, ROPE = 0xb8955c;

export default {
  build(outerKit, outerPlace, ctx) {
    const frame = longAxisFrame(outerKit, outerPlace, ctx);
    const kit = frame.k;
    const place = { ...outerPlace, w: frame.w, d: frame.d };
    const flame = kit.mat(0xffb050, { emissive: 0xff7a10, emissiveIntensity: 2.2 });
    const lantern = kit.mat(0xffe0a0, { emissive: 0xffb040, emissiveIntensity: 1.3 });
    const hw = Math.min(place.w ?? 15.4, 16) / 2 - 0.4;   // half width inside the plot
    const hd = Math.min(place.d ?? 23.1, 24) / 2 - 0.3;   // half depth
    const WH = 2.6;

    // ---- paving ------------------------------------------------------------------------------
    for (let x = -hw + 0.75; x < hw; x += 1.5) {
      for (let z = -hd + 0.75; z < hd; z += 1.5) {
        const c = (Math.round((x + hw) / 1.5) + Math.round((z + hd) / 1.5)) % 2 ? 'paleStone' : 0xb8b0a2;
        kit.box(1.46, 0.08, 1.46, c, x, 0, z, { shadow: false });
      }
    }
    // a ring of blue-green tiles round the anchor, like water
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      kit.box(0.9, 0.1, 0.5, SEA, Math.sin(a) * 3.4, 0, 1 + Math.cos(a) * 3.4, { ry: a, shadow: false });
    }

    // ---- courtyard wall with a gate at the front ---------------------------------------------------
    const wallC = 0xd8d0c0;
    kit.wall(-hw, hd, hw, hd, { h: WH, t: 0.5, color: wallC, doors: [{ at: hw, w: 3, h: 4 }] });
    kit.wall(hw, hd, hw, -hd, { h: WH, t: 0.5, color: wallC });
    kit.wall(hw, -hd, -hw, -hd, { h: WH, t: 0.5, color: wallC });
    kit.wall(-hw, -hd, -hw, hd, { h: WH, t: 0.5, color: wallC });
    // coping stones
    for (const [x, z, w, d] of [[0, hd, 2 * hw + 0.6, 0.7], [0, -hd, 2 * hw + 0.6, 0.7], [hw, 0, 0.7, 2 * hd], [-hw, 0, 0.7, 2 * hd]]) {
      if (z === hd) {
        for (const s of [-1, 1]) kit.box(hw - 1.5 + 0.3, 0.2, d, 'stone', s * (1.5 + (hw - 1.5) / 2 + 0.15), WH, z);
      } else kit.box(w, 0.2, d, 'stone', x, WH, z);
    }
    // gate: two pillars, a lintel with a little anchor, lanterns
    for (const s of [-1, 1]) {
      kit.box(0.9, 3.8, 0.9, 'stone', s * 1.95, 0, hd, { solid: true });
      kit.box(1.1, 0.25, 1.1, 'paleStone', s * 1.95, 3.8, hd);
      lanternOnPost(kit, lantern, s * 1.95, 4.05, hd, true);
    }
    kit.box(4.8, 0.5, 0.7, 'paleStone', 0, 3.3, hd);
    kit.box(0.12, 0.9, 0.12, VERDIGRIS, 0, 3.5, hd + 0.4);
    kit.box(0.6, 0.1, 0.12, VERDIGRIS, 0, 4.15, hd + 0.4);

    // ---- the anchor ------------------------------------------------------------------------------
    const AZ = 1;
    kit.box(4.2, 0.35, 4.2, 'stone', 0, 0, AZ);
    kit.box(3.2, 0.5, 3.2, 'paleStone', 0, 0.35, AZ);
    kit.box(2.1, 1.4, 2.1, 'stone', 0, 0.85, AZ);
    kit.box(2.3, 0.2, 2.3, 'paleStone', 0, 2.25, AZ);
    kit.box(1.4, 0.5, 0.06, BRONZE, 0, 1.3, AZ + 1.08); // plaque
    kit.circle(0, AZ, 2.3, { y0: -0.5, y1: 9 });
    anchor(kit, 0, 2.45, AZ);

    // ---- benches, rope, crates, planters ---------------------------------------------------------
    for (const z of [6.5, -3]) {
      for (const s of [-1, 1]) {
        const x = s * (hw - 0.75);
        kit.box(0.6, 0.12, 2.6, 'paleStone', x, 0.45, z);
        for (const dz of [-1, 1]) kit.box(0.45, 0.45, 0.4, 'stone', x, 0, z + dz);
        kit.solidBox(0.7, 2.6, x, z, 0, 0.9);
      }
    }
    ropeCoil(kit, -hw + 1.4, hd - 1.5);
    ropeCoil(kit, hw - 1.3, -1.2);
    ropeCoil(kit, hw - 1.0, 0.1);
    for (const s of [-1, 1]) {
      kit.box(0.9, 0.7, 0.9, 'plank', s * (hw - 1.2), 0, hd - 3.4, { ry: 0.3 * s, solid: true });
      kit.cyl(0.35, 0.35, 0.9, 'wood', s * (hw - 1.1), 0, hd - 4.8, { seg: 8, solid: true });
      kit.box(0.7, 0.06, 0.7, 'black', s * (hw - 1.1), 0.9, hd - 4.8);
    }
    for (const [x, z] of [[-hw + 0.9, 2], [hw - 0.9, 3.2], [-hw + 0.9, -5.5]]) {
      kit.cyl(0.45, 0.35, 0.6, 'roofRed', x, 0, z, { seg: 8, solid: true });
      kit.ball(0.45, 'leaf', x, 0.85, z);
      kit.ball(0.12, 0x6f9fd8, x + 0.2, 1.15, z + 0.1, { shadow: false });
      kit.ball(0.12, 0xf0f0ff, x - 0.15, 1.1, z - 0.2, { shadow: false });
    }
    for (const [x, z] of [[-hw + 1, -hd + 7.5], [hw - 1, -hd + 7.5], [-hw + 1, hd - 7], [hw - 1, hd - 7]]) {
      kit.cyl(0.1, 0.14, 2.6, 'iron', x, 0, z, { seg: 6, solid: true });
      lanternOnPost(kit, lantern, x, 2.6, z, false);
    }

    // ---- offering basin -------------------------------------------------------------------------
    const OZ = -3.6;
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

    // ---- the chapel ------------------------------------------------------------------------------
    const CW = Math.min(9, 2 * hw - 2), CD = 5.6, CZ = -hd + 0.4 + CD / 2;
    kit.room({
      x: 0, z: CZ, w: CW, d: CD, h: 4.4, wall: 'whitewash', floor: 'plank', base: 'stone',
      doors: { front: [{ at: 0, w: CW - 2.2, h: 3.4 }] }, roof: 'gable', roofColor: 0x3f6f6c, ceilingColor: 0x6b4a2e,
    });
    kit.floor(0, CZ, CW - 0.8, CD - 0.8, 0.12);
    for (const s of [-1, 1]) {
      kit.cyl(0.22, 0.25, 3.4, 'paleStone', s * (CW / 2 - 1.1), 0, CZ + CD / 2 + 0.15, { seg: 8 });
    }
    kit.box(CW + 0.2, 0.5, 0.2, SEA, 0, 3.6, CZ + CD / 2 + 0.25);
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
    // ship's wheel on the back wall
    shipsWheel(kit, 0, 2.85, back + 0.12);
    // fishing nets and floats on the side walls, a carved Valkur relief
    for (const s of [-1, 1]) {
      const x = s * (CW / 2 - 0.25);
      for (let i = 0; i < 6; i++) kit.box(0.03, 2.2, 0.03, 0x3d4a3a, x - s * 0.02, 1.2, CZ - 1.6 + i * 0.6, { rz: 0.06 * s });
      for (let j = 0; j < 4; j++) kit.box(0.03, 0.03, 3.2, 0x3d4a3a, x - s * 0.02, 1.4 + j * 0.55, CZ - 0.1);
      for (const [y, z] of [[1.3, CZ - 1.2], [2.5, CZ + 0.4], [1.8, CZ + 1.1]]) kit.ball(0.12, 'red', x - s * 0.1, y, z, { shadow: false });
    }
    kit.ball(0.5, 0xe8e4dc, CW / 2 - 1.3, 0.62, back + 0.7, { detail: 1 }); // a huge conch, offered by a whaler
    kit.cone(0.35, 0.7, 0xf0c8b8, CW / 2 - 1.3, 0.62, back + 1.15, { seg: 6, rx: Math.PI / 2 });

    kit.info({ id: place.id, name: place.name, kind: place.kind, description: place.description, radius: 13, labelHeight: 9.5, color: '#6fc0b0' });
    kit.info({
      id: `${place.id}-anchor`, name: "The Silver Gull's anchor", kind: 'Statue', x: 0, z: AZ, radius: 3.6, label: false, travel: false,
      description: 'Raised from the wreck of the Silver Gull after the great storm of 1479 DR, cast in bronze and set here by her surviving crew.\n\nSailors touch the ring for luck before every voyage; it has been polished bright by a thousand hands. Coins in the basin keep Umberlee from growing jealous.',
    });
    finishFrame(frame, ctx);
  },
};

/** A rod in the x-y plane of `parent` from (x1, y1) to (x2, y2). */
function rod(kit, parent, x1, y1, x2, y2, r, color) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
  return kit.cyl(r, r, L, color, x1, y1, 0, { seg: 8, rz: Math.atan2(-dx, dy), parent });
}

function anchor(kit, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  kit.add(g);
  const C = VERDIGRIS;
  // shank
  kit.cyl(0.22, 0.26, 4.6, C, 0, 0.3, 0, { seg: 8, parent: g });
  // crown and arms: an arc under the shank
  const R = 1.75, cy = 1.95;
  const angles = [];
  for (let a = 200; a <= 340; a += 17.5) angles.push((a * Math.PI) / 180);
  for (let i = 0; i < angles.length - 1; i++) {
    const [a0, a1] = [angles[i], angles[i + 1]];
    const p0 = [Math.cos(a0) * R, cy + Math.sin(a0) * R], p1 = [Math.cos(a1) * R, cy + Math.sin(a1) * R];
    rod(kit, g, p0[0], p0[1], p1[0], p1[1], 0.22, C);
    kit.ball(0.23, C, p1[0], p1[1], 0, { parent: g });
  }
  kit.ball(0.34, C, 0, cy - R + 0.05, 0, { parent: g, detail: 1 }); // the crown
  // flukes: broad spade-shaped tips pointing up and out
  for (const s of [-1, 1]) {
    const a = s < 0 ? angles[0] : angles[angles.length - 1];
    const tx = Math.cos(a) * R, ty = cy + Math.sin(a) * R;
    kit.ball(0.24, C, tx, ty, 0, { parent: g });
    kit.gable(0.95, 0.9, 0.16, C, tx + s * 0.1, ty - 0.15, 0, { parent: g, rz: -s * 0.55 });
    kit.gable(0.95, 0.45, 0.16, C, tx + s * 0.32, ty - 0.48, 0, { parent: g, rz: -s * 0.55 + Math.PI });
  }
  // stock: the crossbar near the top, at right angles to the arms
  kit.cyl(0.14, 0.14, 3.2, BRONZE, 0, 4.0, -1.6, { seg: 8, rx: Math.PI / 2, parent: g });
  for (const s of [-1, 1]) kit.ball(0.22, BRONZE, 0, 4.0, s * 1.62, { parent: g });
  kit.box(0.6, 0.35, 0.6, BRONZE, 0, 3.85, 0, { parent: g });
  // the ring at the top, polished bright
  const ring = faceted(new THREE.TorusGeometry(0.55, 0.13, 6, 14));
  kit.mesh(ring, 'gold', 0, 5.45, 0, { parent: g });
  // a short chain hanging from the ring, draped over the pedestal
  const link = faceted(new THREE.TorusGeometry(0.17, 0.05, 4, 8));
  for (let i = 0; i < 7; i++) {
    kit.mesh(link, 'iron', 0.55 + i * 0.12, 5.0 - i * 0.42, 0.05 + (i > 4 ? (i - 4) * 0.2 : 0), { parent: g, ry: i % 2 ? Math.PI / 2 : 0, rz: 0.25 });
  }
}

function ropeCoil(kit, x, z, y = 0) {
  const geo = faceted(new THREE.TorusGeometry(0.42, 0.1, 5, 12));
  for (let i = 0; i < 3; i++) kit.mesh(geo, ROPE, x, y + 0.1 + i * 0.17, z, { rx: Math.PI / 2 });
  kit.circle(x, z, 0.55, { y0: 0, y1: 0.6 });
}

function lanternOnPost(kit, mat, x, y, z, light) {
  kit.box(0.08, 0.5, 0.08, 'iron', x, y, z);
  kit.box(0.42, 0.55, 0.42, 'iron', x, y + 0.45, z);
  kit.box(0.34, 0.45, 0.34, mat, x, y + 0.5, z, { shadow: false });
  kit.cone(0.32, 0.3, 'iron', x, y + 1.0, z, { seg: 4, ry: Math.PI / 4 });
  if (light) kit.light(x, y + 0.7, z, { color: 0xffc070, intensity: 8, distance: 7 });
}

function shipsWheel(kit, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  kit.add(g);
  const rim = faceted(new THREE.TorusGeometry(0.75, 0.07, 5, 16));
  kit.mesh(rim, 'darkWood', 0, 0, 0.12, { parent: g });
  kit.cyl(0.14, 0.14, 0.25, 'bronze', 0, 0, 0, { seg: 8, rx: Math.PI / 2, parent: g });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    kit.cyl(0.035, 0.05, 1.05, 'wood', 0, 0, 0.12, { seg: 5, rz: a, parent: g });
  }
}

function modelShip(kit, x, y, z) {
  kit.box(0.2, 0.08, 0.2, 'darkWood', x, y, z);
  kit.box(1.1, 0.22, 0.32, 'wood', x, y + 0.08, z);
  kit.gable(0.32, 0.25, 0.3, 'wood', x + 0.66, y + 0.08, z, { rz: -Math.PI / 2 });
  kit.box(0.3, 0.18, 0.3, 'darkWood', x - 0.45, y + 0.3, z);
  kit.cyl(0.02, 0.02, 0.9, 'darkWood', x + 0.05, y + 0.3, z, { seg: 4 });
  kit.box(0.04, 0.45, 0.42, 0xf2ead8, x + 0.08, y + 0.55, z);
}
