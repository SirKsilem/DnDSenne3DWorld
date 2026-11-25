// Kelemvor's Rest: Holmstead's graveyard on the Monastery Road.
//
// Local frame: origin = centre, +z = the side facing the road (the gate), x across.
// Left half (x < 0): the poor field with plain graves. Right half (x > 0): behind an iron
// fence, the crypts of the old families. The largest crypt (the Vanthorne crypt) can be entered.

import * as THREE from 'three';
import { mulberry32 } from '../world/city.js';

const GRAVEL = 0x9b917f, MOSS = 0x6f7d58, OLD_MOUND = 0x56703a, HEDGE = 0x3c5c2c, CYPRESS = 0x2c4626, LAWN = 0x5d7e3d;

export default {
  build(kit, place) {
    const rng = mulberry32(4242);
    const HW = place.w / 2, HD = place.d / 2;
    const waterLocal = -kit.origin.y; // world water level (0) in local coordinates
    const DRY = waterLocal + 0.5;
    // Ground height, but never below the dry level (low hollows are levelled into a lawn).
    const gnd = (x, z) => Math.max(kit.groundAt(x, z), DRY);

    const glow = kit.mat(0xffd38a, { emissive: 0xffa640, emissiveIntensity: 1.3 });
    const flame = kit.mat(0xffc070, { emissive: 0xff8a20, emissiveIntensity: 2.2 });
    const web = kit.mat(0xe2e2e2, { transparent: true, opacity: 0.28, side: THREE.DoubleSide });
    const group = (x, y, z, ry = 0, rx = 0, rz = 0) => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      g.rotation.set(rx, ry, rz);
      kit.add(g);
      return g;
    };
    const span = (x, z, w, d) => {
      let lo = Infinity, hi = -Infinity;
      for (let i = -1; i <= 1; i += 0.5) for (let j = -1; j <= 1; j += 0.5) {
        const g = gnd(x + (i * w) / 2, z + (j * d) / 2);
        lo = Math.min(lo, g); hi = Math.max(hi, g);
      }
      return { lo, hi };
    };

    levelLowGround(kit, HW, HD, gnd, waterLocal, DRY);

    // ------------------------------------------------------------ enclosure wall + gate
    const GATE = 2.2;
    const wallLine = (x1, z1, x2, z2, gaps = []) => {
      const L = Math.hypot(x2 - x1, z2 - z1), ux = (x2 - x1) / L, uz = (z2 - z1) / L;
      const ry = Math.atan2(x2 - x1, z2 - z1) - Math.PI / 2;
      let s = 0;
      while (s < L - 0.01) {
        let e = Math.min(L, s + 4);
        const gap = gaps.find(([a, b]) => s < b && e > a);
        if (gap && s >= gap[0]) { s = gap[1]; continue; }
        if (gap) e = gap[0];
        const ax = x1 + ux * s, az = z1 + uz * s, bx = x1 + ux * e, bz = z1 + uz * e;
        const mx = (ax + bx) / 2, mz = (az + bz) / 2;
        const ga = kit.groundAt(ax, az), gb = kit.groundAt(bx, bz), gm = kit.groundAt(mx, mz);
        const base = Math.min(ga, gb, gm) - 0.6;
        const top = Math.max(gnd(ax, az), gnd(bx, bz), gnd(mx, mz)) + 1.25;
        kit.box(e - s + 0.05, top - base, 0.6, 'stone', mx, base, mz, { ry });
        kit.box(e - s + 0.12, 0.14, 0.8, 'paleStone', mx, top, mz, { ry });
        kit.segment(ax, az, bx, bz, { r: 0.35, y0: base, y1: top + 0.35 });
        s = e;
      }
    };
    wallLine(-HW, HD, HW, HD, [[HW - GATE, HW + GATE]]);
    wallLine(HW, -HD, -HW, -HD);
    wallLine(-HW, -HD, -HW, HD);
    wallLine(HW, HD, HW, -HD);

    const gg = gnd(0, HD);
    for (const sx of [-1, 1]) {
      const px = sx * (GATE + 0.45);
      kit.box(1.0, 3.3, 1.0, 'paleStone', px, gg - 0.5, HD);
      kit.box(1.25, 0.25, 1.25, 'stone', px, gg + 2.8, HD);
      kit.ball(0.3, 'stone', px, gg + 3.3, HD, { detail: 1 });
      kit.circle(px, HD, 0.65, { y0: gg - 1, y1: gg + 4 });
      ironLeaf(kit, group(sx * GATE, gg, HD - 0.15, sx < 0 ? 1.25 : -1.25), -sx, 2.1, 2.0);
      lantern(kit, sx * (GATE + 1.4), HD + 0.7, gnd, glow);
    }
    kit.box(2 * GATE + 1.9, 0.55, 1.0, 'paleStone', 0, gg + 3.05, HD);
    scales(kit, group(0, gg + 3.6, HD), 0.9);
    kit.light(0, gg + 2.6, HD + 1, { color: 0xffb060, intensity: 10, distance: 12, flicker: 0.3 });

    // ------------------------------------------------------------ gravel paths
    const path = (x1, z1, x2, z2, w = 2.6) => {
      const L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.ceil(L / 2));
      const ry = Math.atan2(x2 - x1, z2 - z1) - Math.PI / 2;
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n, mx = x1 + (x2 - x1) * t, mz = z1 + (z2 - z1) * t;
        kit.box(L / n + 0.08, 0.3, w, GRAVEL, mx, gnd(mx, mz) - 0.24, mz, { ry, shadow: false });
      }
    };
    const PZ = 22;               // the east-west path
    const POOR_X = -26;          // poor field's north-south path
    const AV = 26;               // the avenue through the rich section
    path(0, HD + 1.5, 0, PZ - 1.3, 3.2);
    path(0, PZ, -HW + 2.5, PZ);
    path(POOR_X, PZ, POOR_X, -HD + 2.5);
    path(0, PZ, AV + 1.6, PZ);
    path(AV, PZ, AV, -15.2, 3.4);
    const plazaZ = 5;
    for (let i = -2; i <= 2; i++) path(AV - 4.5, plazaZ + i * 1.8, AV + 4.5, plazaZ + i * 1.8, 1.9);

    // ------------------------------------------------------------ iron fence between the sections
    const FX = 3.2, FGATE = [PZ - 1.8, PZ + 1.8];
    const posts = [];
    for (let z = -HD + 0.8; z <= HD - 0.8; z += 1.6) posts.push(z);
    for (let i = 0; i < posts.length; i++) {
      const z = posts[i], g = gnd(FX, z);
      const inGate = z > FGATE[0] && z < FGATE[1];
      if (!inGate) {
        kit.box(0.1, 1.9, 0.1, 'iron', FX, g - 0.1, z);
        kit.cone(0.07, 0.22, 'iron', FX, g + 1.8, z, { seg: 4 });
      }
      const z2 = posts[i + 1];
      if (z2 === undefined) break;
      const midIn = (z + z2) / 2 > FGATE[0] && (z + z2) / 2 < FGATE[1];
      if (midIn || (inGate && z2 < FGATE[1])) continue;
      const g2 = gnd(FX, z2), gm = (g + g2) / 2;
      for (const y of [0.35, 1.55]) kit.box(0.05, 0.06, z2 - z, 'iron', FX, gm + y, (z + z2) / 2);
      for (let k = 1; k < 4; k++) kit.box(0.04, 1.7, 0.04, 'iron', FX, gm, z + ((z2 - z) * k) / 4);
      kit.segment(FX, z, FX, z2, { r: 0.12, y0: gm - 1, y1: gm + 2.2 });
    }
    for (const s of [-1, 1]) {
      const z = s < 0 ? FGATE[0] : FGATE[1], g = gnd(FX, z);
      kit.box(0.7, 2.4, 0.7, 'paleStone', FX, g - 0.3, z);
      kit.cone(0.42, 0.6, 'stone', FX, g + 2.1, z, { seg: 4, ry: Math.PI / 4 });
      kit.circle(FX, z, 0.45, { y0: g - 1, y1: g + 3 });
      ironLeaf(kit, group(FX, g, z - s * 0.35, s < 0 ? 0.2 : -0.2), 1, 1.4, 1.6);
    }
    lantern(kit, FX - 1.2, PZ + 2.6, gnd, glow);
    kit.light(FX, gnd(FX, PZ) + 2.4, PZ + 2.4, { color: 0xffb060, intensity: 8, distance: 10, flicker: 0.3 });

    // ------------------------------------------------------------ the poor field
    const avoid = (x, z) =>
      Math.abs(z - PZ) < 2.6 || Math.abs(x - POOR_X) < 2.4 || x > -4.5 || x < -HW + 1.8 || z > HD - 2.2 || z < -HD + 1.8 ||
      (x < -36 && z < -23) || Math.hypot(x + 14, z + 8) < 4 || Math.hypot(x + 34, z - 8) < 3 || Math.hypot(x + 8, z + 30) < 3;
    let graves = 0;
    for (let z = HD - 3.2; z > -HD + 2; z -= 3.3) {
      for (let x = -HW + 3; x < -4; x += 2.3) {
        const gx = x + (rng() - 0.5) * 0.5, gz = z + (rng() - 0.5) * 0.4;
        if (avoid(gx, gz) || avoid(gx, gz + 1.2) || rng() < 0.18) continue;
        plainGrave(kit, group, gx, gz, gnd(gx, gz), rng);
        graves++;
      }
    }

    // A freshly dug grave
    {
      const x = -14, z = -8, g = gnd(x, z);
      kit.box(1.05, 0.05, 2.15, 'black', x, g + 0.01, z, { shadow: false });
      kit.box(1.35, 0.12, 0.18, 'dirt', x, g, z - 1.15);
      kit.box(1.35, 0.12, 0.18, 'dirt', x, g, z + 1.15);
      const pile = kit.ball(1, 'dirt', x + 1.7, g - 0.15, z, { detail: 1 });
      pile.scale.set(0.95, 0.75, 1.35);
      kit.cyl(0.035, 0.035, 1.4, 'wood', x + 1.75, g + 0.3, z + 0.3, { seg: 5, rz: 0.35 });
      kit.box(0.1, 0.12, 0.3, 'wood', x + 1.31, g + 1.55, z + 0.3, { rz: 0.35 });
      for (const dz of [-0.5, 0.5]) kit.box(1.6, 0.05, 0.22, 'plank', x, g + 0.05, z + dz, { ry: 0.08 });
      kit.cyl(0.05, 0.05, 1.2, 'darkWood', x, g, z - 1.45, { seg: 4 });
      kit.box(0.6, 0.08, 0.06, 'darkWood', x, g + 0.85, z - 1.45);
      kit.info({
        id: 'open-grave', name: 'A freshly dug grave', kind: 'Open grave', x, z, radius: 4, label: false,
        description: 'Six feet deep and ready, but nobody in Holmstead has died this week. Old Mortimer says the order came on black paper, unsigned, with a gold coin for his trouble.',
      });
    }

    // The gravedigger's shack
    {
      const x = -42.5, z = -30, w = 5, d = 4, h = 2.6;
      const { lo, hi } = span(x, z, w + 1, d + 1);
      const y = hi + 0.15;
      kit.box(w + 0.3, y - lo + 0.6, d + 0.3, 'darkStone', x, lo - 0.6, z);
      kit.box(w, 0.1, d, 'plank', x, y, z);
      kit.floor(x, z + 0.4, w, d + 0.8, y + 0.1);
      const opt = { y: y + 0.1, h, t: 0.22, color: 'plank' };
      kit.wall(x - w / 2, z + d / 2, x + w / 2, z + d / 2, { ...opt, doors: [{ at: w / 2, w: 1.1, h: 2.0 }] });
      kit.wall(x + w / 2, z + d / 2, x + w / 2, z - d / 2, { ...opt, windows: [{ at: d / 2, w: 0.7, h: 0.6, y: 1.3 }] });
      kit.wall(x + w / 2, z - d / 2, x - w / 2, z - d / 2, opt);
      kit.wall(x - w / 2, z - d / 2, x - w / 2, z + d / 2, opt);
      kit.box(w, 0.12, d, 'darkWood', x, y + h - 0.05, z);
      kit.gable(w + 0.8, 1.5, d + 0.9, 'thatch', x, y + h + 0.05, z, { ry: Math.PI / 2 });
      kit.box(0.9, 0.4, 1.9, 'cloth', x - 1.7, y + 0.1, z - 0.8);       // cot
      kit.box(1.0, 0.75, 0.6, 'wood', x + 1.5, y + 0.1, z - 1.4);       // table
      kit.cyl(0.06, 0.08, 0.2, 'whitewash', x + 1.5, y + 0.85, z - 1.4, { seg: 5 });
      kit.cone(0.05, 0.1, flame, x + 1.5, y + 1.05, z - 1.4, { seg: 4, shadow: false });
      for (let i = 0; i < 3; i++) kit.cyl(0.03, 0.03, 1.5, 'wood', x + 2.25, y + 0.1, z - 0.3 + i * 0.35, { seg: 4, rz: -0.25 });
      kit.solidBox(1.0, 0.6, x + 1.5, z - 1.4, y, y + 0.9);
      kit.light(x + 1.5, y + 1.6, z - 1.2, { color: 0xffaa55, intensity: 6, distance: 7, flicker: 0.5 });
      lantern(kit, x + 3.3, z + 2.6, gnd, glow);
      for (const dz of [-0.6, 0.4]) kit.box(0.7, 0.3, 2.0, 'wood', x + w / 2 + 0.45, y - 0.1 + 0.9, z + dz, { rz: 1.2 }); // coffins leaning on the wall
      kit.info({
        id: 'gravedigger-shack', name: "Gravedigger's shack", kind: 'Shack', x, z: z + 1, radius: 5, label: false,
        description: "Home of old Mortimer Grell, Holmstead's gravedigger for forty years. He keeps a lantern burning all night \"so they can find their way back\". He has never said who \"they\" are.",
      });
    }

    deadTree(kit, -34, 8, gnd, rng, true);
    deadTree(kit, -8, -30, gnd, rng, false);
    deadTree(kit, 46, -33, gnd, rng, true);

    // ------------------------------------------------------------ the rich section
    for (let z = -HD + 2; z < HD - 2; z += 2) {
      if (z > FGATE[0] - 1 && z < FGATE[1] + 1) continue;
      const g = gnd(FX + 1.2, z);
      kit.box(1.1, 1.25, 2.05, HEDGE, FX + 1.2, g - 0.1, z);
    }
    kit.segment(FX + 1.2, -HD + 1, FX + 1.2, FGATE[0] - 1, { r: 0.6, y0: -50, y1: 50 });
    kit.segment(FX + 1.2, FGATE[1] + 1, FX + 1.2, HD - 1, { r: 0.6, y0: -50, y1: 50 });
    for (const z of [17, 9, -2, -12]) for (const x of [AV - 4.2, AV + 4.2]) cypress(kit, x, z, gnd);
    for (const x of [10, 18, 34, 42]) cypress(kit, x, HD - 3, gnd);

    const crypts = [
      { type: columned, x: 14.5, z: 14, ry: Math.PI / 2, name: 'Harrowgate' },
      { type: domed, x: 37.5, z: 14, ry: -Math.PI / 2 },
      { type: pyramid, x: 14.5, z: 1.5, ry: Math.PI / 2 },
      { type: gothic, x: 37.5, z: 1.5, ry: -Math.PI / 2 },
      { type: tombMonument, x: 14.5, z: -10, ry: Math.PI / 2 },
      { type: columnedFlat, x: 37.5, z: -10, ry: -Math.PI / 2 },
    ];
    for (const c of crypts) {
      const { lo, hi } = span(c.x, c.z, 7, 7);
      const g = group(c.x, hi + 0.1, c.z, c.ry);
      kit.box(7.2, hi - lo + 0.9, 7.2, 'darkStone', c.x, lo - 0.8, c.z, { ry: c.ry });
      const foot = c.type(kit, g, glow);
      kit.solidBox(foot.w, foot.d, c.x, c.z, lo - 1, hi + 6, c.ry);
    }

    // Statues, urns, obelisks, lanterns
    kelemvor(kit, group, AV, plazaZ, gnd);
    kit.info({
      id: 'kelemvor-statue', name: 'Statue of Kelemvor', kind: 'Statue', x: AV, z: plazaZ, radius: 4.5, label: false,
      description: 'The Lord of the Dead holds his scales over the graves: every soul is judged fairly, and no one need fear an honest death. Mourners leave a copper on the lower pan. The gravedigger swears the coins are gone by morning.',
    });
    statue(kit, group, 10, 29, gnd, 'angel', Math.PI);
    statue(kit, group, 42, 29, gnd, 'mourner', Math.PI);
    statue(kit, group, 19.5, -19, gnd, 'mourner', 0.4);
    obelisk(kit, 8, 7.5, gnd);
    obelisk(kit, 45, 22, gnd);
    obelisk(kit, 45, -21, gnd);
    for (const [x, z] of [[AV - 2.4, 19.5], [AV + 2.4, 19.5], [AV - 2.4, -9], [AV + 2.4, -9]]) lantern(kit, x, z, gnd, glow);
    for (const [x, z] of [[AV - 4.6, plazaZ + 3.8], [AV + 4.6, plazaZ + 3.8], [AV - 4.6, plazaZ - 3.8], [AV + 4.6, plazaZ - 3.8]]) urn(kit, x, z, gnd);
    kit.light(AV, gnd(AV, plazaZ) + 3, plazaZ + 3, { color: 0xffc070, intensity: 6, distance: 10, flicker: 0.2 });

    // ------------------------------------------------------------ the Vanthorne crypt (enterable)
    vanthorneCrypt(kit, AV, -27, span, gnd, flame, web, glow);

    // Crows on the dead trees and headstones
    for (const [x, z, y] of [[-34.4, 8.5, 4.3], [-33.3, 7.6, 3.6], [-8, -29.6, 3.9], [-17.5, 30.8, 0.95]]) crow(kit, group, x, gnd(x, z) + y, z, rng);

    kit.info({
      id: place.id, name: place.name, kind: place.kind, description: place.description,
      x: 0, z: 10, radius: 34, labelHeight: 12, color: '#9fb0c0',
    });
    console.info(`Kelemvor's Rest: ${graves} graves`);
  },
};

// ---------------------------------------------------------------- ground
/** Grass lawn over any part of the graveyard that dips below the river level, plus floors to walk on. */
function levelLowGround(kit, HW, HD, gnd, waterLocal, DRY) {
  const S = 2.5;
  const nx = Math.round((2 * HW + 6) / S), nz = Math.round((2 * HD + 6) / S);
  const x0 = -HW - 3, z0 = -HD - 3;
  const pos = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const xa = x0 + i * S, xb = xa + S, za = z0 + j * S, zb = za + S;
      const low = Math.min(kit.groundAt(xa, za), kit.groundAt(xb, za), kit.groundAt(xa, zb), kit.groundAt(xb, zb));
      if (low > DRY + 0.2) continue;
      const p = (x, z) => [x, gnd(x, z) + 0.07, z];
      const a = p(xa, za), b = p(xb, za), c = p(xa, zb), d = p(xb, zb);
      pos.push(...a, ...c, ...b, ...b, ...c, ...d);
      if (kit.groundAt((xa + xb) / 2, (za + zb) / 2) < DRY) kit.floor((xa + xb) / 2, (za + zb) / 2, S, S, DRY + 0.07);
    }
  }
  if (!pos.length) return;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, kit.mat(LAWN));
  m.receiveShadow = true;
  kit.add(m);
  // a low earth bank where the lawn meets the water outside
  void waterLocal;
}

// ---------------------------------------------------------------- small pieces
function plainGrave(kit, group, x, z, g, rng) {
  const r = rng();
  const tilt = (rng() - 0.5) * 0.25;
  const grp = group(x, g, z, (rng() - 0.5) * 0.15, tilt, (rng() - 0.5) * 0.18);
  const stone = rng() < 0.5 ? 'stone' : rng() < 0.5 ? MOSS : 'darkStone';
  if (r < 0.2) {
    kit.box(0.6, 0.62, 0.15, stone, 0, -0.1, 0, { parent: grp });
    kit.cyl(0.3, 0.3, 0.15, stone, 0, 0.52, -0.075, { parent: grp, seg: 8, rx: Math.PI / 2 });
  } else if (r < 0.35) {
    kit.box(0.55, 0.85, 0.14, stone, 0, -0.1, 0, { parent: grp });
  } else if (r < 0.48) {
    kit.box(0.13, 1.0, 0.13, stone, 0, -0.1, 0, { parent: grp });
    kit.box(0.55, 0.13, 0.13, stone, 0, 0.55, 0, { parent: grp });
  } else if (r < 0.58) {
    kit.box(0.42, 0.35, 0.32, stone, 0, -0.05, 0, { parent: grp });
  } else if (r < 0.82) {
    kit.box(0.09, 0.95, 0.06, 'darkWood', 0, -0.1, 0, { parent: grp });
    kit.box(0.48, 0.08, 0.06, 'darkWood', 0, 0.5, 0, { parent: grp });
  }
  if (r < 0.9 || rng() < 0.5) {
    const m = kit.ball(1, rng() < 0.15 ? 'dirt' : OLD_MOUND, x, g - 0.1, z + 1.05, { ry: rng() });
    m.scale.set(0.45, 0.2, 0.95);
    m.castShadow = false;
  }
}

function ironLeaf(kit, parent, dir, width, height) {
  // dir: +1 bars run along +x from the hinge, -1 along -x
  for (let i = 0; i <= 6; i++) {
    const x = dir * (0.05 + (i * (width - 0.1)) / 6);
    kit.box(0.05, height, 0.05, 'iron', x, 0.08, 0, { parent });
    kit.cone(0.06, 0.18, 'iron', x, height + 0.08, 0, { seg: 4, parent });
  }
  for (const y of [0.3, height * 0.55, height - 0.05]) kit.box(width, 0.07, 0.07, 'iron', (dir * width) / 2, y, 0, { parent });
  kit.box(0.6, 0.6, 0.04, 'iron', (dir * width) / 2, height * 0.62, 0, { parent, rz: Math.PI / 4 });
}

function lantern(kit, x, z, gnd, glow) {
  const g = gnd(x, z);
  kit.box(0.14, 2.4, 0.14, 'iron', x, g - 0.1, z);
  kit.box(0.34, 0.42, 0.34, glow, x, g + 2.3, z, { shadow: false });
  kit.cone(0.3, 0.3, 'iron', x, g + 2.72, z, { seg: 4, ry: Math.PI / 4 });
  kit.circle(x, z, 0.15, { y0: g - 1, y1: g + 3 });
}

function scales(kit, parent, s = 1, color = 'gold') {
  kit.box(0.08 * s, 0.9 * s, 0.08 * s, color, 0, 0, 0, { parent });
  kit.box(1.1 * s, 0.06 * s, 0.06 * s, color, 0, 0.85 * s, 0, { parent });
  for (const sx of [-1, 1]) {
    kit.box(0.02 * s, 0.4 * s, 0.02 * s, color, sx * 0.52 * s, 0.47 * s, 0, { parent });
    kit.cyl(0.2 * s, 0.14 * s, 0.06 * s, color, sx * 0.52 * s, 0.42 * s, 0, { parent, seg: 8 });
  }
}

function cypress(kit, x, z, gnd) {
  const g = gnd(x, z);
  kit.cyl(0.1, 0.15, 0.7, 'darkWood', x, g - 0.1, z, { seg: 5 });
  kit.cone(0.75, 5.2, CYPRESS, x, g + 0.4, z, { seg: 6 });
  kit.circle(x, z, 0.5, { y0: g - 1, y1: g + 6 });
}

function deadTree(kit, x, z, gnd, rng, big) {
  const g = gnd(x, z), h = big ? 4.2 : 3.4;
  kit.cyl(0.14, 0.32, h, 0x4a4038, x, g - 0.2, z, { seg: 6, rz: 0.05 });
  for (let i = 0; i < 5; i++) {
    const a = rng() * Math.PI * 2, y = g + h * (0.45 + rng() * 0.45);
    kit.cyl(0.03, 0.09, 1.3 + rng() * 1.4, 0x4a4038, x, y, z, { seg: 4, ry: a, rz: 0.7 + rng() * 0.5 });
  }
  kit.circle(x, z, 0.4, { y0: g - 1, y1: g + 5 });
}

function crow(kit, group, x, y, z, rng) {
  const g = group(x, y, z, rng() * 6.28);
  const b = kit.ball(0.12, 'black', 0, 0.1, 0, { parent: g });
  b.scale.set(0.11, 0.1, 0.16);
  kit.ball(0.07, 'black', 0, 0.2, 0.12, { parent: g });
  kit.cone(0.025, 0.09, 'iron', 0, 0.2, 0.2, { parent: g, seg: 4, rx: Math.PI / 2 });
  kit.box(0.1, 0.02, 0.16, 'black', 0, 0.05, -0.15, { parent: g, rx: -0.3 });
}

function urn(kit, x, z, gnd) {
  const g = gnd(x, z);
  kit.box(0.7, 0.9, 0.7, 'paleStone', x, g - 0.1, z);
  kit.cyl(0.18, 0.12, 0.15, 'bronze', x, g + 0.8, z, { seg: 8 });
  kit.cyl(0.25, 0.18, 0.4, 'bronze', x, g + 0.95, z, { seg: 8 });
  kit.cyl(0.16, 0.25, 0.15, 'bronze', x, g + 1.35, z, { seg: 8 });
  kit.circle(x, z, 0.45, { y0: g - 1, y1: g + 1.5 });
}

function obelisk(kit, x, z, gnd) {
  const g = gnd(x, z);
  kit.box(1.4, 0.6, 1.4, 'stone', x, g - 0.2, z);
  kit.cyl(0.32, 0.5, 4.2, 'paleStone', x, g + 0.4, z, { seg: 4, ry: Math.PI / 4 });
  kit.cone(0.33, 0.6, 'paleStone', x, g + 4.6, z, { seg: 4, ry: Math.PI / 4 });
  kit.circle(x, z, 0.8, { y0: g - 1, y1: g + 5 });
}

function robedFigure(kit, parent, color, { hood = false, bowed = false } = {}) {
  kit.cyl(0.24, 0.42, 1.5, color, 0, 0, 0, { parent, seg: 8 });
  kit.ball(0.27, color, 0, 1.45, 0, { parent });
  kit.ball(0.17, color, 0, 1.78, bowed ? 0.08 : 0, { parent, detail: 1 });
  if (hood) kit.cone(0.24, 0.5, color, 0, 1.62, bowed ? 0.03 : -0.02, { parent, seg: 7, rx: bowed ? 0.25 : 0 });
}

function statue(kit, group, x, z, gnd, kind, ry) {
  const g = gnd(x, z);
  kit.box(1.3, 1.1, 1.3, 'paleStone', x, g - 0.2, z, { ry });
  kit.box(1.5, 0.15, 1.5, 'stone', x, g + 0.9, z, { ry });
  const p = group(x, g + 1.05, z, ry);
  robedFigure(kit, p, 'marble', { hood: kind === 'mourner', bowed: kind === 'mourner' });
  if (kind === 'angel') {
    for (const s of [-1, 1]) {
      kit.box(0.06, 1.5, 0.7, 'marble', s * 0.35, 0.8, -0.45, { parent: p, ry: s * 0.6, rz: s * -0.25 });
    }
    kit.box(0.1, 0.65, 0.1, 'marble', 0.3, 1.5, 0.1, { parent: p, rz: -0.5 });
  } else {
    kit.box(0.42, 0.1, 0.12, 'marble', 0, 1.2, 0.25, { parent: p });
  }
  kit.circle(x, z, 0.85, { y0: g - 1, y1: g + 3.5 });
}

function kelemvor(kit, group, x, z, gnd) {
  const g = gnd(x, z);
  kit.box(2.6, 0.3, 2.6, 'stone', x, g - 0.15, z);
  kit.box(1.8, 1.5, 1.8, 'paleStone', x, g + 0.15, z);
  kit.box(2.0, 0.2, 2.0, 'stone', x, g + 1.65, z);
  const p = group(x, g + 1.85, z, 0);
  p.scale.setScalar(1.35);
  robedFigure(kit, p, 'stone', { hood: true });
  // the skeletal arm holding the scales
  kit.box(0.08, 0.08, 0.75, 'bone', 0.22, 1.32, 0.38, { parent: p });
  kit.box(0.05, 0.05, 0.28, 'bone', 0.22, 1.32, 0.82, { parent: p, rx: -0.5 });
  const sc = new THREE.Group();
  sc.position.set(0.22, 0.95, 0.95);
  p.add(sc);
  scales(kit, sc, 0.55);
  kit.box(0.9, 0.12, 0.06, 'gold', x, g + 1.2, z + 0.92);
  kit.circle(x, z, 1.5, { y0: g - 1, y1: g + 5 });
}

// ---------------------------------------------------------------- crypts (built facing +z in a group)
function columned(kit, g) {
  const w = 5, d = 6, h = 3.6;
  kit.box(w, h, d - 1.6, 'paleStone', 0, 0, -0.8, { parent: g });
  for (const s of [-1, 1]) kit.cyl(0.24, 0.3, h, 'marble', s * (w / 2 - 0.45), 0, d / 2 - 0.45, { parent: g, seg: 8 });
  kit.box(w + 0.4, 0.3, d + 0.4, 'paleStone', 0, h, 0, { parent: g });
  kit.gable(w + 0.4, 1.3, d + 0.4, 'paleStone', 0, h + 0.3, 0, { parent: g });
  kit.box(1.4, 2.4, 0.08, 'bronze', 0, 0, d / 2 - 1.58, { parent: g });
  kit.box(1.7, 0.3, 0.05, 'gold', 0, h - 0.7, d / 2 - 1.57, { parent: g });
  kit.box(w, 0.25, 1.2, 'stone', 0, -0.25, d / 2 + 0.5, { parent: g });
  return { w: w + 0.4, d: d + 0.4 };
}

function columnedFlat(kit, g) {
  const w = 6, d = 5, h = 3.4;
  kit.box(w, h, d - 1.4, 'marble', 0, 0, -0.7, { parent: g });
  for (const sx of [-2.4, -0.9, 0.9, 2.4]) kit.cyl(0.2, 0.25, h, 'marble', sx, 0, d / 2 - 0.35, { parent: g, seg: 8 });
  kit.box(w + 0.4, 0.45, d + 0.4, 'paleStone', 0, h, 0, { parent: g });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    kit.cyl(0.18, 0.12, 0.5, 'bronze', sx * (w / 2), h + 0.45, sz * (d / 2), { parent: g, seg: 8 });
  }
  kit.box(1.3, 2.3, 0.08, 'bronze', 0, 0, d / 2 - 1.38, { parent: g });
  return { w: w + 0.4, d: d + 0.4 };
}

function domed(kit, g) {
  const r = 2.7;
  kit.cyl(r, r, 3.2, 'paleStone', 0, 0, 0, { parent: g, seg: 8, ry: Math.PI / 8 });
  kit.cyl(r + 0.25, r + 0.25, 0.3, 'stone', 0, 3.2, 0, { parent: g, seg: 8, ry: Math.PI / 8 });
  const dome = kit.ball(1, 'verdigris', 0, 3.4, 0, { parent: g, detail: 1 });
  dome.scale.set(r, r * 0.85, r);
  kit.cone(0.15, 0.9, 'gold', 0, 3.4 + r * 0.8, 0, { parent: g, seg: 6 });
  kit.box(1.2, 2.3, 0.1, 'bronze', 0, 0, r * 0.93, { parent: g });
  kit.box(1.6, 0.25, 0.4, 'stone', 0, 2.3, r * 0.95, { parent: g });
  return { w: 2 * r, d: 2 * r };
}

function pyramid(kit, g) {
  kit.box(4.2, 3, 4.2, 'stone', 0, 0, 0, { parent: g });
  const p = kit.cone(1, 2.8, 'darkStone', 0, 3, 0, { parent: g, seg: 4, ry: Math.PI / 4 });
  p.scale.set(3.25, 2.8, 3.25);
  kit.box(1.2, 2.1, 0.08, 'bronze', 0, 0, 2.12, { parent: g });
  for (const s of [-1, 1]) kit.box(0.5, 2.6, 0.5, 'paleStone', s * 1.0, 0, 2.15, { parent: g });
  kit.box(2.5, 0.4, 0.5, 'paleStone', 0, 2.6, 2.15, { parent: g });
  return { w: 4.6, d: 4.8 };
}

function gothic(kit, g) {
  const w = 3.6, d = 5, h = 4.2;
  kit.box(w, h, d, 'darkStone', 0, 0, 0, { parent: g });
  kit.gable(w + 0.4, 3, d + 0.4, 'slate', 0, h, 0, { parent: g });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    kit.box(0.4, h + 0.3, 0.4, 'stone', sx * w / 2, 0, sz * d / 2, { parent: g });
    kit.cone(0.22, 1.3, 'stone', sx * w / 2, h + 0.3, sz * d / 2, { parent: g, seg: 4 });
  }
  kit.box(1.1, 2.2, 0.08, 'black', 0, 0, d / 2 + 0.02, { parent: g });
  kit.gable(1.1, 0.6, 0.08, 'black', 0, 2.2, d / 2 + 0.02, { parent: g, ry: 0 });
  kit.box(0.08, 1.3, 0.06, 'gold', 0, h - 1.8, d / 2 + 0.03, { parent: g });
  return { w: w + 0.5, d: d + 0.5 };
}

function tombMonument(kit, g) {
  kit.box(3.2, 0.8, 4.2, 'stone', 0, 0, 0, { parent: g });
  kit.box(1.7, 1.0, 2.8, 'marble', 0, 0.8, 0.3, { parent: g });
  kit.box(1.9, 0.2, 3.0, 'paleStone', 0, 1.8, 0.3, { parent: g });
  kit.cyl(0.35, 0.6, 4.5, 'paleStone', 0, 0.8, -1.55, { parent: g, seg: 4, ry: Math.PI / 4 });
  kit.cone(0.36, 0.7, 'gold', 0, 5.3, -1.55, { parent: g, seg: 4, ry: Math.PI / 4 });
  return { w: 3.2, d: 4.2 };
}

// ---------------------------------------------------------------- the enterable family crypt
function vanthorneCrypt(kit, cx, cz, span, gnd, flame, web, glow) {
  const w = 10, d = 12, h = 5, t = 0.5;
  const front = cz + d / 2, porch = 3.6;
  const { lo, hi } = span(cx, cz + porch / 2, w + 1, d + porch + 1);
  const B = hi + 0.45, F = B + 0.12; // floor surface
  kit.box(w + 0.8, B - lo + 0.8, d + 0.6, 'darkStone', cx, lo - 0.8, cz);
  kit.box(w + 0.8, B - lo + 0.8, porch, 'paleStone', cx, lo - 0.8, front + porch / 2);
  kit.box(w - 0.6, 0.12, d - 0.6, 'darkStone', cx, B, cz);
  kit.floor(cx, cz + porch / 2, w + 0.8, d + porch, F);

  const wo = { y: F, h, t, color: 'marble' };
  kit.wall(cx - w / 2, front, cx + w / 2, front, { ...wo, doors: [{ at: w / 2, w: 2.2, h: 3.0 }] });
  kit.wall(cx + w / 2, front, cx + w / 2, cz - d / 2, wo);
  kit.wall(cx + w / 2, cz - d / 2, cx - w / 2, cz - d / 2, wo);
  kit.wall(cx - w / 2, cz - d / 2, cx - w / 2, front, wo);
  kit.box(w, 0.3, d, 'darkStone', cx, F + h - 0.3, cz);
  kit.gable(w + 1, 2.6, d + 0.8, 'slate', cx, F + h, cz - 0.3);

  // portico: columns, roof, pediment, name plate
  for (const sx of [-4.3, -1.7, 1.7, 4.3]) {
    kit.cyl(0.33, 0.4, h - 0.3, 'marble', cx + sx, F, front + porch - 0.55, { seg: 8 });
    kit.box(0.95, 0.25, 0.95, 'paleStone', cx + sx, F + h - 0.5, front + porch - 0.55);
    kit.circle(cx + sx, front + porch - 0.55, 0.4, { y0: F - 1, y1: F + h });
  }
  kit.box(w + 0.8, 0.5, porch + 0.3, 'marble', cx, F + h - 0.25, front + porch / 2);
  kit.gable(w + 0.8, 2.1, porch + 0.3, 'marble', cx, F + h + 0.25, front + porch / 2);
  kit.box(3.4, 0.5, 0.08, 'gold', cx, F + 3.55, front + t / 2 + 0.03);
  for (const s of [-1, 1]) kit.box(0.12, 2.95, 1.1, 'bronze', cx + s * 1.04, F, front - t / 2 - 0.58); // doors swung open inside

  // steps down to the avenue
  const top = front + porch;
  let L = 1.5;
  for (let i = 0; i < 3; i++) L = Math.max(1.2, (F - gnd(cx, top + L)) / 0.32);
  const foot = gnd(cx, top + L);
  kit.stairs(cx, top + L / 2, 4.4, L, F, foot, 'paleStone');
  for (const s of [-1, 1]) {
    kit.box(0.6, F - lo + 1.1, L + 0.2, 'paleStone', cx + s * 2.5, lo - 0.6, top + L / 2);
    kit.cyl(0.2, 0.28, 0.6, 'bronze', cx + s * 2.5, F + 0.5, top + 0.3, { seg: 8 });
    kit.solidBox(0.6, L + 0.2, cx + s * 2.5, top + L / 2, lo - 1, F + 1.2);
  }
  kit.light(cx, F + 3.2, front + porch - 1, { color: 0xffb060, intensity: 7, distance: 9, flicker: 0.3 });
  kit.box(0.3, 0.4, 0.3, glow, cx, F + 3.4, front + porch - 1.1, { shadow: false });
  kit.box(0.04, 0.6, 0.04, 'iron', cx, F + 3.8, front + porch - 1.1);

  // inside: sarcophagi
  const sz = cz - 1.5;
  kit.box(1.5, 0.9, 2.6, 'stone', cx, F, sz);
  kit.box(1.7, 0.18, 2.8, 'marble', cx, F + 0.9, sz);
  kit.box(0.55, 0.28, 1.5, 'marble', cx, F + 1.08, sz - 0.1);          // the effigy
  kit.ball(0.18, 'marble', cx, F + 1.32, sz + 0.82, { detail: 1 });
  kit.box(0.08, 0.06, 1.1, 'paleStone', cx, F + 1.38, sz - 0.1);       // stone sword on its chest
  kit.box(0.3, 0.06, 0.06, 'paleStone', cx, F + 1.38, sz + 0.3);
  kit.solidBox(1.7, 2.8, cx, sz, F - 0.5, F + 1.1);
  for (const s of [-1, 1]) {
    const x = cx + s * 2.9;
    kit.box(1.2, 0.8, 2.3, 'darkStone', x, F, cz - 0.5);
    kit.box(1.35, 0.15, 2.45, 'stone', x, F + 0.8, cz - 0.5);
    kit.solidBox(1.35, 2.45, x, cz - 0.5, F - 0.5, F + 1);
    candle(kit, x + 0.4 * s, F + 0.95, cz + 0.4, flame);
  }
  for (const [dx, dz] of [[-0.6, 1.2], [0.6, 1.2], [-0.6, -1.3], [0.6, -1.3]]) candle(kit, cx + dx, F + 1.08, sz + dz, flame);

  // altar with the scales of Kelemvor on the back wall
  const back = cz - d / 2 + t / 2;
  kit.box(3, 1, 0.8, 'stone', cx, F, back + 0.45);
  kit.solidBox(3, 0.8, cx, back + 0.45, F - 0.5, F + 1);
  for (const dx of [-1.1, -0.4, 0.4, 1.1]) candle(kit, cx + dx, F + 1, back + 0.5, flame);
  const relief = new THREE.Group();
  relief.position.set(cx, F + 1.6, back + 0.06);
  kit.add(relief);
  scales(kit, relief, 1.2);
  kit.box(0.12, 0.12, 0.05, 'bone', cx, F + 2.75, back + 0.06);

  // wall niches with urns and skulls
  for (const s of [-1, 1]) {
    const x = cx + s * (w / 2 - t / 2 - 0.04);
    for (const nz of [cz - 4.3, cz - 1.9, cz + 0.5, cz + 2.9]) {
      kit.box(0.06, 1.0, 1.3, 'black', x, F + 1.2, nz, { shadow: false });
      kit.box(0.42, 0.08, 1.45, 'stone', x - s * 0.2, F + 1.12, nz);
      kit.cyl(0.11, 0.15, 0.38, 'bronze', x - s * 0.2, F + 1.2, nz + 0.3, { seg: 7 });
      kit.ball(0.12, 'bone', x - s * 0.2, F + 1.32, nz - 0.25);
      if (nz === cz - 1.9) candle(kit, x - s * 0.25, F + 1.2, nz, flame);
    }
  }
  // cobwebs in the corners, a few bones on the floor
  for (const [x, z, ry] of [[cx - w / 2 + 0.9, back + 0.9, Math.PI / 4], [cx + w / 2 - 0.9, back + 0.9, -Math.PI / 4], [cx - w / 2 + 0.9, front - 0.9, -Math.PI / 4], [cx + w / 2 - 0.9, front - 0.9, Math.PI / 4]]) {
    kit.box(1.6, 1.3, 0.02, web, x, F + h - 1.6, z, { ry, shadow: false });
  }
  for (const [x, z, ry] of [[cx + 3.3, cz + 3.6, 0.4], [cx + 3.6, cz + 3.4, 1.7], [cx - 3.5, cz - 4.6, 0.9]]) kit.box(0.06, 0.06, 0.5, 'bone', x, F, z, { ry });
  kit.light(cx, F + 1.8, back + 1.2, { color: 0xffa860, intensity: 6, distance: 10, flicker: 0.5 });
  kit.light(cx, F + 1.8, cz + 2, { color: 0xff9a50, intensity: 4, distance: 8, flicker: 0.6 });

  kit.info({
    id: 'vanthorne-crypt', name: 'The Vanthorne crypt', kind: 'Family crypt', x: cx, z: front, radius: 7.5, label: false,
    description: "The Vanthornes were Holmstead's richest shipping family until the whole line died in a single winter forty years ago. Last month the bronze doors were found standing open.\n\nNothing inside seems to be missing. But the effigy on Lord Aldric Vanthorne's tomb used to have its eyes closed.",
  });
}

function candle(kit, x, y, z, flame) {
  kit.cyl(0.04, 0.05, 0.2, 'whitewash', x, y, z, { seg: 5, shadow: false });
  kit.cone(0.035, 0.09, flame, x, y + 0.2, z, { seg: 4, shadow: false });
}
