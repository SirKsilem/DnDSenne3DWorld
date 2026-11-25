// The Bubbling Flask (M13): a crooked alchemist's shop outside the Monastery Gate,
// with a turret, a bay window, a walkable shop full of potions and a herb garden.

import * as THREE from 'three';

const POTIONS = [0xc0303a, 0x3a6ad0, 0x40a050, 0xd0a020, 0x8a40b0, 0xe07030, 0x30b0b0, 0xe8e0d0];

export default {
  build(kit, place) {
    const SW = Math.min(14, place.w - 2), SD = Math.min(10, place.d - 1);
    const H = 4.0;
    const SX = -place.w / 2 + SW / 2 + 1; // the shop sits on the left of the plot, the garden on the right
    const hw = SW / 2, hd = SD / 2;
    const FT = 0.12;
    const X = (x) => SX + x; // shop-local x -> place-local x
    const glow = (c, k = 1.6) => kit.mat(c, { emissive: c, emissiveIntensity: k });
    const glass = kit.mat(0xbfe8e0, { transparent: true, opacity: 0.45 });
    const fire = kit.mat(0xffa040, { emissive: 0xff6a00, emissiveIntensity: 2.4 });
    const flame = kit.mat(0xffd080, { emissive: 0xffb040, emissiveIntensity: 2.2 });
    const doorAt = 1.5;

    // ---------------------------------------------------------------- shell
    kit.room({
      x: SX, w: SW, d: SD, h: H, wall: 0xb9c29c, floor: 'plank', base: 'darkStone', roof: null,
      ceiling: true, ceilingColor: 'darkWood',
      doors: { front: [{ at: doorAt, w: 1.6, h: 2.6 }] },
      windows: {
        front: [{ at: -hw + 1.6, color: glow(0xb0e0a0, 0.35) }, { at: 3.6, color: glow(0xb0e0a0, 0.35) }],
        left: [{ at: 0, color: glow(0xb0e0a0, 0.35) }],
        back: [{ at: -2, color: glow(0xb0e0a0, 0.35) }],
      },
    });
    // crooked upper storey and a steep, mossy roof leaning the other way
    kit.box(SW - 0.6, 3.0, SD - 0.4, 0x9a86b0, X(0.25), H, 0, { rz: 0.035, ry: 0.03 });
    for (const sz of [-1, 1]) for (const dx of [-4, -1, 2.5]) {
      kit.box(0.9, 1.1, 0.06, glow(0xf0d080, 0.5), X(dx + 0.3), H + 0.9, sz * ((SD - 0.4) / 2 + 0.03), { ry: 0.03 });
    }
    kit.gable(SD + 0.6, 5.2, SW + 0.4, 0x3f5a4a, X(0.45), H + 2.95, 0, { ry: Math.PI / 2 + 0.03, rz: -0.03 });
    // corner turret with a pointed hat
    const TX = X(hw - 0.2), TZ = hd - 0.2;
    kit.cyl(1.7, 1.8, 10, 'paleStone', TX, -0.3, TZ, { seg: 9, solid: true });
    kit.cyl(1.95, 1.75, 0.6, 'darkWood', TX, 9.6, TZ, { seg: 9 });
    kit.cone(2.3, 4.6, 0x4b3a78, TX, 10.1, TZ, { seg: 9 });
    kit.box(0.3, 1.0, 0.06, glow(0xf0d080, 0.5), TX + 0.8, 6.0, TZ + 1.62, { ry: 0.45 });
    kit.box(0.3, 1.0, 0.06, glow(0xf0d080, 0.5), TX + 1.4, 8.0, TZ + 1.0, { ry: 0.95 });
    kit.cyl(0.04, 0.04, 1.4, 'iron', TX, 14.6, TZ, { seg: 4 });
    kit.box(0.5, 0.5, 0.05, 'gold', TX, 15.4, TZ, { rz: 0.4 }); // crescent-moon weathervane, more or less
    // chimney with green smoke
    const CX = X(-hw + 1.4), CZ = -hd + 0.6;
    kit.box(1.1, 9.5, 1.1, 'stone', CX, H, CZ);
    const smoke = kit.dynamic(kit.add(new THREE.Group()));
    const puffs = [0, 1, 2, 3].map((i) => kit.ball(0.4, kit.mat(0x9ad0a0, { transparent: true, opacity: 0.55 }), CX, H + 10, CZ, { parent: smoke, shadow: false }));
    kit.animate((t) => puffs.forEach((p, i) => {
      const k = (t * 0.35 + i / 4) % 1;
      p.position.set(CX + Math.sin(t + i) * 0.3 + k * 1.2, H + 9.7 + k * 4, CZ);
      p.scale.setScalar(0.3 + k * 0.9);
    }));
    // bay window full of potions
    const BX = X(-hw + 1.6);
    kit.box(2.6, 0.5, 0.9, 'darkWood', BX, 0.4, hd + 0.45);
    kit.box(2.6, 0.25, 0.9, 'darkWood', BX, 2.6, hd + 0.45);
    kit.box(2.4, 1.7, 0.05, glass, BX, 0.9, hd + 0.88);
    for (const s of [-1, 1]) kit.box(0.05, 1.7, 0.8, glass, BX + s * 1.2, 0.9, hd + 0.45);
    POTIONS.slice(0, 6).forEach((c, i) => kit.cyl(0.08, 0.1, 0.3, glow(c, 0.8), BX - 1 + i * 0.4, 0.9, hd + 0.5, { seg: 6, shadow: false }));
    kit.solidBox(2.6, 0.9, BX, hd + 0.45, 0, 2.8);
    // hanging sign: a mortar and pestle
    const signX = X(doorAt + 1.4);
    kit.box(0.1, 0.1, 1.3, 'iron', signX, 3.3, hd + 0.65);
    kit.box(0.03, 0.5, 0.03, 'iron', signX, 2.8, hd + 1.15);
    kit.cyl(0.36, 0.24, 0.42, 'paleStone', signX, 2.36, hd + 1.15, { seg: 8 });
    kit.cyl(0.07, 0.1, 0.8, 'wood', signX + 0.1, 2.5, hd + 1.15, { rz: -0.45, seg: 6 });
    // door, swung open, and a lantern
    kit.box(0.07, 2.5, 1.5, 0x5b3a7a, X(doorAt - 0.85), FT, hd - 0.95);
    kit.box(0.28, 0.36, 0.28, 'iron', X(doorAt - 1.3), 2.5, hd + 0.35);
    kit.box(0.2, 0.26, 0.2, glow(0x80ff9a, 1.4), X(doorAt - 1.3), 2.55, hd + 0.35);

    // ---------------------------------------------------------------- shelves of potions (left wall)
    kit.box(0.3, 2.9, SD - 1.2, 'darkWood', X(-hw + 0.38), 0, 0);
    let n = 0;
    for (const y of [0.55, 1.15, 1.75, 2.35]) {
      kit.box(0.55, 0.05, SD - 1.2, 'wood', X(-hw + 0.55), y, 0);
      for (let z = -hd + 1.0; z <= hd - 1.0; z += 0.42) {
        const c = POTIONS[(n * 5 + Math.floor(y * 3)) % POTIONS.length];
        const m = n % 5 === 0 ? glow(c, 1.4) : kit.mat(c);
        if (n % 3 === 1) kit.ball(0.13, m, X(-hw + 0.6), y + 0.17, z, { shadow: false });
        else kit.cyl(0.08, 0.1, 0.28, m, X(-hw + 0.6), y + 0.05, z, { seg: 6, shadow: false });
        kit.cyl(0.03, 0.03, 0.09, 'cloth', X(-hw + 0.6), y + 0.3, z, { seg: 4, shadow: false });
        n++;
      }
    }
    kit.solidBox(0.8, SD - 1.2, X(-hw + 0.55), 0, 0, 3);

    // back wall: jars, books and a skull
    kit.box(4.6, 2.2, 0.4, 'darkWood', X(-2.6), 0, -hd + 0.4);
    for (const y of [0.9, 1.5, 2.1]) kit.box(4.6, 0.05, 0.5, 'wood', X(-2.6), y, -hd + 0.55);
    for (let i = 0; i < 9; i++) {
      kit.cyl(0.14, 0.14, 0.3, i % 3 ? 0x8a6a3a : glass, X(-4.6 + i * 0.5), 0.95, -hd + 0.55, { seg: 7, shadow: false });
      kit.box(0.1 + (i % 3) * 0.05, 0.4, 0.3, [0x6b2a2a, 0x2f4e7a, 0x3f6b35][i % 3], X(-4.7 + i * 0.25), 1.55, -hd + 0.55);
    }
    kit.ball(0.18, 'bone', X(-1.0), 2.3, -hd + 0.55).scale.set(0.18, 0.19, 0.2);
    kit.box(0.2, 0.08, 0.16, 'bone', X(-1.0), 2.12, -hd + 0.65);
    for (const s of [-1, 1]) kit.ball(0.045, 'black', X(-1.0 + s * 0.07), 2.33, -hd + 0.73);
    kit.solidBox(4.6, 0.7, X(-2.6), -hd + 0.45, 0, 2.4);

    // ---------------------------------------------------------------- counter and Mirella
    const KX = X(3.6), KZ = 1.4;
    kit.box(0.8, 1.0, 3.8, 'darkWood', KX, 0, KZ);
    kit.box(1.0, 0.07, 4.0, 'plank', KX, 1.0, KZ);
    kit.solidBox(0.8, 3.8, KX, KZ, 0, 1.2);
    kit.cyl(0.05, 0.05, 0.4, 'bronze', KX, 1.07, KZ - 1.2, { seg: 5 });      // scales
    kit.box(0.6, 0.03, 0.05, 'bronze', KX, 1.47, KZ - 1.2);
    for (const dz of [-0.3, 0.3]) kit.cyl(0.14, 0.12, 0.04, 'bronze', KX, 1.3, KZ - 1.2 + dz, { seg: 6 });
    kit.cyl(0.12, 0.15, 0.12, 'darkWood', KX, 1.07, KZ + 0.4, { seg: 6 });  // crystal ball
    kit.ball(0.17, glow(0x80b0ff, 1.2), KX, 1.33, KZ + 0.4, { shadow: false });
    for (let i = 0; i < 3; i++) kit.box(0.4, 0.08, 0.3, [0x6b2a2a, 0x3f6b35, 0x5b3a7a][i], KX, 1.07 + i * 0.08, KZ + 1.3, { ry: i * 0.3 });
    kit.cyl(0.05, 0.05, 0.16, 'bone', KX, 1.07, KZ + 0.95, { seg: 4, shadow: false });
    kit.cone(0.04, 0.08, flame, KX, 1.23, KZ + 0.95, { seg: 4, shadow: false });
    kit.light(KX - 0.3, 2.2, KZ, { color: 0xffc080, intensity: 10, distance: 8, flicker: 0.3 });
    const MX = KX + 1.1, MZ = KZ + 0.2;
    kit.cone(0.5, 1.2, 0x4b3a78, MX, 0, MZ, { seg: 7 });
    kit.ball(0.22, 0xe8c8a8, MX, 1.35, MZ);
    kit.cone(0.32, 0.12, 0x2f2550, MX, 1.48, MZ, { seg: 8 });
    kit.cone(0.2, 0.6, 0x2f2550, MX, 1.55, MZ, { seg: 7, rz: 0.25 });
    kit.ball(0.12, 0xb0b8c8, MX - 0.08, 1.3, MZ - 0.18).scale.set(0.24, 0.12, 0.17); // silver hair
    kit.circle(MX, MZ, 0.5, { y0: 0, y1: 1.8 });

    // ---------------------------------------------------------------- the cauldron
    const CAX = X(-1.4), CAZ = -1.6;
    kit.ball(0.85, 'iron', CAX, 0.8, CAZ, { detail: 1 }).scale.set(0.85, 0.62, 0.85);
    kit.cyl(0.78, 0.78, 0.08, 'black', CAX, 1.32, CAZ, { seg: 12 });
    kit.cyl(0.72, 0.72, 0.06, glow(0x5cff6a, 1.3), CAX, 1.26, CAZ, { seg: 12, shadow: false });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      kit.box(0.12, 0.35, 0.12, 'iron', CAX + Math.cos(a) * 0.55, 0, CAZ + Math.sin(a) * 0.55);
    }
    for (let i = 0; i < 4; i++) kit.cone(0.15, 0.3, fire, CAX + Math.cos(i * 1.6) * 0.25, FT, CAZ + Math.sin(i * 1.6) * 0.25, { seg: 5, shadow: false });
    const bubbles = kit.dynamic(kit.add(new THREE.Group()));
    const bub = [0, 1, 2, 3, 4, 5].map((i) => kit.ball(0.09, glow(0x9aff9a, 1.6), CAX, 1.3, CAZ, { parent: bubbles, shadow: false }));
    kit.animate((t) => bub.forEach((b, i) => {
      const k = (t * 0.7 + i / 6) % 1;
      b.position.set(CAX + Math.cos(i * 2.3) * 0.4, 1.28 + k * 0.5, CAZ + Math.sin(i * 2.3) * 0.4);
      b.scale.setScalar(0.09 * (0.6 + k) * (1 - k * 0.6));
    }));
    kit.light(CAX, 1.8, CAZ, { color: 0x66ff88, intensity: 24, distance: 9, flicker: 0.5 });
    kit.circle(CAX, CAZ, 0.95, { y0: 0, y1: 1.5 });
    kit.cyl(0.04, 0.05, 1.3, 'wood', CAX + 0.3, 1.0, CAZ, { rz: -0.5, seg: 5 }); // stirring paddle

    // ---------------------------------------------------------------- workbench with an alembic
    const WX = X(3.9), WZ = -hd + 1.0;
    kit.box(3.6, 0.9, 1.1, 'wood', WX, 0, WZ);
    kit.box(3.8, 0.07, 1.25, 'plank', WX, 0.9, WZ);
    kit.solidBox(3.6, 1.1, WX, WZ, 0, 1.2);
    kit.cyl(0.18, 0.2, 0.25, 'iron', WX - 1.1, 0.97, WZ, { seg: 6 });
    kit.cone(0.08, 0.16, flame, WX - 1.1, 1.22, WZ, { seg: 5, shadow: false });
    kit.ball(0.32, glass, WX - 1.1, 1.6, WZ, { detail: 1, shadow: false });
    kit.ball(0.22, glow(0xd03060, 0.6), WX - 1.1, 1.53, WZ, { detail: 1, shadow: false });
    kit.cyl(0.04, 0.04, 1.5, glass, WX - 1.05, 1.85, WZ, { rz: -1.1, seg: 5, shadow: false });
    kit.cyl(0.1, 0.1, 0.5, 'bronze', WX + 0.35, 1.55, WZ, { rz: -1.1, seg: 6 });
    kit.ball(0.2, glass, WX + 0.75, 1.17, WZ, { detail: 1, shadow: false });
    kit.ball(0.13, glow(0xd03060, 0.6), WX + 0.75, 1.12, WZ, { shadow: false });
    kit.box(0.05, 0.9, 0.05, 'iron', WX - 0.4, 0.97, WZ - 0.3);
    kit.cyl(0.15, 0.1, 0.12, 'paleStone', WX + 1.3, 0.97, WZ + 0.2, { seg: 7 });   // mortar
    kit.cyl(0.03, 0.04, 0.3, 'wood', WX + 1.3, 1.02, WZ + 0.2, { rz: 0.4, seg: 4 });
    kit.cyl(0.05, 0.05, 0.6, 'cloth', WX + 0.6, 0.97, WZ + 0.35, { rz: Math.PI / 2, seg: 6 }); // scroll

    // ---------------------------------------------------------------- herbs and a stuffed crocodile
    for (const zb of [-0.4, 2.2]) {
      kit.box(SW - 0.6, 0.15, 0.15, 'darkWood', SX, H - 0.55, zb);
      for (let x = -hw + 1.2; x < hw - 0.6; x += 0.75) {
        const c = [0x4f7a34, 0x7a5aa0, 0x8a6a3a, 0x6a8a3a][Math.floor((x + 10) * 3) % 4];
        kit.box(0.02, 0.18, 0.02, 'cloth', X(x), H - 0.73, zb);
        kit.cone(0.09, 0.34, c, X(x), H - 0.73, zb, { rx: Math.PI, seg: 5, shadow: false });
      }
    }
    const croc = 0x4f6b3a, cy = H - 1.15, cz = 0.9, cx0 = X(-1.0);
    kit.box(2.0, 0.35, 0.55, croc, cx0, cy, cz);
    kit.box(1.3, 0.26, 0.38, croc, cx0 + 1.6, cy + 0.05, cz);
    kit.box(1.0, 0.16, 0.2, croc, cx0 + 2.7, cy + 0.1, cz);
    kit.box(0.9, 0.24, 0.42, croc, cx0 - 1.4, cy + 0.05, cz);
    kit.box(0.8, 0.12, 0.32, 0x6a8a4a, cx0 - 2.2, cy + 0.02, cz);
    kit.box(0.8, 0.06, 0.3, 0xe8e0c8, cx0 - 2.2, cy + 0.14, cz); // teeth
    for (const s of [-1, 1]) {
      kit.ball(0.06, 0xf0d020, cx0 - 1.65, cy + 0.32, cz + s * 0.13);
      for (const dx of [-0.6, 0.6]) kit.box(0.14, 0.3, 0.14, croc, cx0 + dx, cy - 0.25, cz + s * 0.3);
    }
    for (const dx of [-0.6, 0.9]) kit.box(0.03, H - cy - 0.35, 0.03, 'iron', cx0 + dx, cy + 0.35, cz);
    kit.box(2.6, 0.02, 1.8, 'purple', X(doorAt - 0.4), FT, 1.6);

    // ---------------------------------------------------------------- herb garden
    const gx0 = SX + hw + 0.8, gx1 = place.w / 2 - 0.6, gz = Math.min(hd, place.d / 2 - 0.6);
    if (gx1 - gx0 > 4) {
      const gw = gx1 - gx0, gmx = (gx0 + gx1) / 2;
      const post = (x, z) => kit.box(0.14, 1.0, 0.14, 'darkWood', x, 0, z);
      for (let x = gx0; x <= gx1 + 0.01; x += gw / Math.ceil(gw / 1.6)) { post(x, -gz); post(x, gz); }
      for (let z = -gz; z <= gz + 0.01; z += (2 * gz) / Math.ceil((2 * gz) / 1.6)) post(gx1, z);
      for (const y of [0.4, 0.8]) {
        kit.box(gw, 0.06, 0.06, 'wood', gmx, y, -gz);
        kit.box(0.06, 0.06, 2 * gz, 'wood', gx1, y, 0);
        kit.box(gw / 2 - 0.8, 0.06, 0.06, 'wood', gx0 + (gw / 2 - 0.8) / 2, y, gz); // front, with a gate gap
        kit.box(gw / 2 - 0.8, 0.06, 0.06, 'wood', gx1 - (gw / 2 - 0.8) / 2, y, gz);
      }
      kit.segment(gx0, -gz, gx1, -gz, { r: 0.08, y0: 0, y1: 1.2 });
      kit.segment(gx1, -gz, gx1, gz, { r: 0.08, y0: 0, y1: 1.2 });
      kit.segment(gx0, gz, gmx - 0.8, gz, { r: 0.08, y0: 0, y1: 1.2 });
      kit.segment(gmx + 0.8, gz, gx1, gz, { r: 0.08, y0: 0, y1: 1.2 });
      const plants = [[0x7a5aa0, 'cone'], [0x4f7a34, 'ball'], [0xe0c040, 'ball'], [0x5f8f3a, 'cone'], [0xc04a4a, 'shroom']];
      let row = 0;
      for (let z = -gz + 1.3; z < gz - 1.2; z += 1.6, row++) {
        kit.box(gw - 1.6, 0.22, 0.9, 'dirt', gmx, 0, z);
        const [c, kind] = plants[row % plants.length];
        for (let x = gx0 + 1.2; x < gx1 - 0.8; x += 0.7) {
          if (kind === 'cone') kit.cone(0.22, 0.6, c, x, 0.22, z, { seg: 5 });
          else if (kind === 'ball') kit.ball(0.24, c, x, 0.4, z);
          else { kit.cyl(0.04, 0.05, 0.2, 'bone', x, 0.22, z, { seg: 4 }); kit.cone(0.16, 0.12, c, x, 0.4, z, { seg: 6 }); }
        }
      }
      // bee skep and potting bench
      kit.box(0.6, 0.5, 0.6, 'darkWood', gx1 - 1.0, 0, -gz + 0.8);
      kit.cone(0.45, 0.8, 'hay', gx1 - 1.0, 0.5, -gz + 0.8, { seg: 8 });
      kit.box(1.8, 0.9, 0.6, 'wood', gx0 + 1.4, 0, -gz + 0.6);
      for (let i = 0; i < 3; i++) kit.cyl(0.16, 0.12, 0.25, 0xa65a3a, gx0 + 0.8 + i * 0.5, 0.9, -gz + 0.6, { seg: 6 });
    }

    kit.info({
      id: place.id, name: place.name, kind: place.kind, description: place.description,
      x: SX, z: 0, radius: Math.max(SW, SD) / 2 + 6, labelHeight: 12.5, color: '#9bd17a',
    });
    kit.info({
      id: `${place.id}-cauldron`, name: 'The bubbling cauldron', kind: place.name, label: false, radius: 2.2,
      x: CAX, z: CAZ + 1.2,
      description: "Today's brew, chalked on a slate: POTION OF HEALING, 50 gp a flask. Do NOT taste. Do NOT stir counter-clockwise.\n\nMirella will brew a Potion of Greater Healing to order if you bring her troll blood.",
    });
  },
};
