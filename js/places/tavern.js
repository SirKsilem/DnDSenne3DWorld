// The Laughing Lantern (T7): a two-storey timber-framed inn in the Barrow.
// Walkable common room: bar, tables, roaring hearth with an owlbear trophy,
// candle chandeliers, notice board and a staircase up to a landing.

import * as THREE from 'three';

const FIRE = [0xffa040, { emissive: 0xff6a00, emissiveIntensity: 2.5 }];
const CANDLE_FLAME = [0xffd080, { emissive: 0xffb040, emissiveIntensity: 2.2 }];
const LIT_WINDOW = [0xf0c070, { emissive: 0xc07a20, emissiveIntensity: 0.6 }];

export default {
  build(kit, place) {
    const W = Math.min(20, place.w - 1);
    const D = Math.min(12.5, place.d - 0.6);
    const H = 4.6;   // ground floor height
    const UP = 3.4;  // upper storey (outside only)
    const RH = 4.2;  // roof height
    const hw = W / 2, hd = D / 2;
    const FT = 0.12; // top of the floor boards
    const doorX = -hw * 0.4;
    const fire = kit.mat(...FIRE);
    const flameMat = kit.mat(...CANDLE_FLAME);
    const litWin = kit.mat(...LIT_WINDOW);

    // ---------------------------------------------------------------- shell
    kit.room({
      w: W, d: D, h: H, wall: 'plaster', floor: 'plank', ceiling: false, roof: null,
      doors: { front: [{ at: doorX, w: 1.8, h: 2.7 }] },
      windows: {
        front: [{ at: -hw + 1.6, color: litWin }, { at: doorX + 3, color: litWin }, { at: hw - 6, color: litWin }, { at: hw - 3.2, color: litWin }],
        back: [{ at: 0, color: litWin }],
        left: [{ at: -1.5, color: litWin }, { at: 2, color: litWin }],
      },
    });

    // ceiling boards with a stairwell opening above the back flight of stairs
    const SX = hw - 0.95; // centre line of the staircase, along the right wall
    const ceilY = H - 0.25;
    kit.box(W - 0.2 - 1.8, 0.25, D - 0.2, 'wood', -0.9, ceilY, 0);
    kit.box(1.6, 0.25, hd - 0.1 - 0.2, 'wood', SX, ceilY, (0.2 + hd - 0.1) / 2);
    kit.box(1.6, 0.25, hd - 0.1 - 4.2, 'wood', SX, ceilY, -(4.2 + hd - 0.1) / 2);
    for (let x = -hw + 2; x < hw - 2; x += 3) kit.box(0.3, 0.35, D - 0.4, 'darkWood', x, H - 0.6, 0);

    // timber frame on the ground floor
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.box(0.32, H, 0.32, 'timber', sx * (hw + 0.1), 0, sz * (hd + 0.1));
    for (const sz of [-1, 1]) kit.box(W + 0.5, 0.28, 0.12, 'timber', 0, H - 0.3, sz * (hd + 0.24));
    for (const sx of [-1, 1]) kit.box(0.12, 0.28, D + 0.5, 'timber', sx * (hw + 0.24), H - 0.3, 0);

    // ---------------------------------------------------------------- upper storey (exterior only)
    const UW = W + 0.6, UD = D + 0.6;
    kit.box(UW, UP, UD, 'plaster', 0, H, 0);
    const faceZ = UD / 2 + 0.05, faceX = UW / 2 + 0.05;
    for (const sz of [-1, 1]) {
      kit.box(UW + 0.2, 0.25, 0.12, 'timber', 0, H, sz * faceZ);
      kit.box(UW + 0.2, 0.25, 0.12, 'timber', 0, H + UP - 0.25, sz * faceZ);
      for (let x = -UW / 2; x <= UW / 2 + 0.01; x += UW / 8) kit.box(0.22, UP, 0.1, 'timber', x, H, sz * faceZ);
      for (let i = 0; i < 8; i++) {
        const x0 = -UW / 2 + (i + 0.5) * (UW / 8);
        if (i % 2 === 0) {
          kit.box(0.9, 1.1, 0.06, litWin, x0, H + 1.1, sz * (faceZ + 0.02));
        } else {
          kit.box(0.14, 2.2, 0.08, 'timber', x0, H + 0.5, sz * faceZ, { rz: (i % 4 === 1 ? 0.55 : -0.55) });
        }
      }
    }
    for (const sx of [-1, 1]) {
      kit.box(0.12, 0.25, UD + 0.2, 'timber', sx * faceX, H, 0);
      kit.box(0.12, 0.25, UD + 0.2, 'timber', sx * faceX, H + UP - 0.25, 0);
      for (let z = -UD / 2; z <= UD / 2 + 0.01; z += UD / 4) kit.box(0.1, UP, 0.22, 'timber', sx * faceX, H, z);
      kit.box(0.06, 1.1, 0.9, litWin, sx * (faceX + 0.02), H + 1.1, -UD / 8);
      kit.box(0.06, 1.1, 0.9, litWin, sx * (faceX + 0.02), H + 1.1, UD * 3 / 8 - UD / 4);
    }
    // roof, ridge along the long side, and a chimney above the hearth
    kit.gable(UD + 1.2, RH, UW + 1.2, 'roofBrown', 0, H + UP, 0, { ry: Math.PI / 2 });
    const FX = -hw + 3.5;
    kit.box(1.6, UP + RH + 1.4, 1.2, 'stone', FX, H, -hd + 0.6);
    kit.box(1.9, 0.3, 1.5, 'darkStone', FX, H + UP + RH + 1.4, -hd + 0.6);

    // ---------------------------------------------------------------- outside: sign, lanterns, benches
    const signX = doorX - 1.9;
    kit.box(0.12, 0.12, 1.5, 'iron', signX, 3.55, hd + 0.75);
    kit.box(0.1, 0.5, 0.1, 'iron', signX, 3.1, hd + 0.3, { rx: -0.7 });
    for (const dz of [0.85, 1.35]) kit.box(0.03, 0.45, 0.03, 'iron', signX, 3.1, hd + dz);
    kit.box(0.08, 0.85, 1.15, 'wood', signX, 2.25, hd + 1.1);
    for (const s of [-1, 1]) {
      kit.box(0.02, 0.4, 0.28, kit.mat(0xf2c14e, { emissive: 0xc08020, emissiveIntensity: 0.5 }), signX + s * 0.05, 2.45, hd + 1.1);
      kit.box(0.02, 0.06, 0.5, 'black', signX + s * 0.05, 2.38, hd + 1.1);
    }
    // lantern beside the door
    kit.box(0.08, 0.08, 0.5, 'iron', doorX + 1.3, 2.9, hd + 0.45);
    kit.box(0.32, 0.42, 0.32, 'iron', doorX + 1.3, 2.4, hd + 0.65);
    kit.box(0.22, 0.3, 0.22, flameMat, doorX + 1.3, 2.46, hd + 0.65);
    // bench and barrels out front
    kit.box(2.2, 0.08, 0.45, 'wood', hw - 4, 0.45, hd + 0.6);
    for (const dx of [-0.9, 0.9]) kit.box(0.12, 0.45, 0.4, 'darkWood', hw - 4 + dx, 0, hd + 0.6);
    barrel(kit, -hw + 1, hd + 0.8);
    barrel(kit, -hw + 2, hd + 0.9);
    kit.solidBox(2.4, 0.6, hw - 4, hd + 0.6, 0, 0.8);

    // ---------------------------------------------------------------- hearth and owlbear trophy
    const backZ = -hd + 0.2; // inner face of the back wall
    kit.box(3.8, 2.9, 1.1, 'stone', FX, 0, backZ + 0.55);
    kit.box(2.2, 1.45, 0.3, 'black', FX, FT, backZ + 1.0);
    kit.box(2.6, 0.15, 0.9, 'darkStone', FX, 0, backZ + 1.4);
    kit.box(4.2, 0.2, 1.4, 'darkWood', FX, 2.0, backZ + 0.65);
    kit.box(2.8, H - 2.9, 0.9, 'stone', FX, 2.9, backZ + 0.45);
    kit.solidBox(3.8, 1.5, FX, backZ + 0.75, 0, 3);
    for (const dx of [-0.5, 0, 0.45]) kit.cyl(0.1, 0.1, 1.2, 'darkWood', FX + dx, FT + 0.12, backZ + 1.45, { rz: Math.PI / 2, seg: 6 });
    const flames = kit.dynamic(kit.add(new THREE.Group()));
    const fl = [[-0.45, 0.75], [0.05, 1.0], [0.5, 0.65]].map(([dx, h]) => {
      const f = kit.cone(0.28, h, fire, FX + dx, FT + 0.1, backZ + 1.45, { parent: flames, seg: 6, shadow: false });
      f.userData.h = h;
      return f;
    });
    kit.animate((t) => fl.forEach((f, i) => {
      f.scale.y = f.userData.h * (1 + Math.sin(t * 11 + i * 2.1) * 0.18 + Math.sin(t * 6.3 + i) * 0.1);
      f.scale.x = f.scale.z = 0.28 * (1 + Math.sin(t * 9 + i) * 0.08);
    }));
    kit.light(FX, 1.0, backZ + 2.2, { color: 0xff8a3d, intensity: 45, distance: 14, flicker: 1 });
    kit.box(3.2, 0.03, 2.2, 'red', FX, FT, backZ + 2.8);
    // owlbear head on a plaque above the mantel
    const oz = backZ + 0.92, oy = 3.45;
    kit.box(1.4, 1.2, 0.1, 'darkWood', FX, oy - 0.6, oz);
    kit.ball(0.5, 0x6e4a2c, FX, oy, oz + 0.38).scale.set(0.55, 0.48, 0.42);
    kit.ball(0.5, 0x8a6a48, FX, oy - 0.1, oz + 0.2).scale.set(0.7, 0.55, 0.35); // feather ruff
    kit.cone(0.13, 0.42, 0xd9b44a, FX, oy - 0.05, oz + 0.62, { rx: Math.PI / 2, seg: 5 });
    for (const s of [-1, 1]) {
      kit.ball(0.06, 0xf5d020, FX + s * 0.17, oy + 0.1, oz + 0.68);
      kit.ball(0.03, 'black', FX + s * 0.17, oy + 0.1, oz + 0.73);
      kit.cone(0.08, 0.28, 0x5a3c24, FX + s * 0.22, oy + 0.3, oz + 0.4, { rz: -s * 0.35, seg: 4 });
    }

    // ---------------------------------------------------------------- the bar
    const BX = hw - 5.4, BZ = -hd + 3.2;
    kit.box(6.4, 1.05, 0.8, 'darkWood', BX, 0, BZ);
    kit.box(6.7, 0.08, 1.0, 'plank', BX, 1.05, BZ);
    kit.solidBox(6.4, 0.8, BX, BZ, 0, 1.3);
    for (const dx of [-1.5, -0.8, -0.1]) {
      kit.cyl(0.05, 0.05, 0.3, 'bronze', BX + dx, 1.13, BZ - 0.25, { seg: 5 });
      kit.box(0.08, 0.06, 0.2, 'bronze', BX + dx, 1.38, BZ - 0.15);
    }
    for (const dx of [0.6, 1.0, 2.2]) kit.cyl(0.07, 0.06, 0.16, 'bronze', BX + dx, 1.13, BZ + 0.1, { seg: 6 });
    // shelves of bottles on the back wall
    kit.box(6, 2.6, 0.45, 'wood', BX, 0, backZ + 0.25);
    const bottleCols = [0x2f5a2a, 0x6b3e1a, 0x2f4e7a, 0x9fc4d8, 0x7a2a3a];
    let bi = 0;
    for (const y of [1.3, 1.85, 2.4]) {
      kit.box(6.2, 0.06, 0.55, 'darkWood', BX, y, backZ + 0.55);
      for (let x = -2.8; x <= 2.8; x += 0.42) {
        const c = bottleCols[(bi++ * 7) % bottleCols.length];
        kit.cyl(0.07, 0.08, 0.26, c, BX + x, y + 0.06, backZ + 0.6, { seg: 6, shadow: false });
        kit.cyl(0.025, 0.025, 0.1, c, BX + x, y + 0.32, backZ + 0.6, { seg: 4, shadow: false });
      }
    }
    // kegs on a rack in the corner behind the bar, and Dagna the barkeep
    kit.box(1.5, 0.5, 2.0, 'darkWood', hw - 1.1, 0, backZ + 1.1);
    for (const dz of [0.6, 1.6]) {
      kit.cyl(0.42, 0.42, 1.0, 'wood', hw - 0.6, 0.95, backZ + dz, { rz: Math.PI / 2, seg: 8 });
      kit.cyl(0.08, 0.08, 0.2, 'bronze', hw - 1.75, 0.92, backZ + dz, { rz: Math.PI / 2, seg: 5 });
    }
    kit.solidBox(1.5, 2.0, hw - 1.1, backZ + 1.1, 0, 1.5);
    const dagX = BX - 0.6, dagZ = BZ - 1.0;
    kit.cyl(0.36, 0.42, 0.85, 0x6b3a2a, dagX, 0, dagZ, { seg: 7 });
    kit.cyl(0.3, 0.36, 0.35, 0xd8ccb0, dagX, 0.6, dagZ + 0.04, { seg: 7 }); // apron
    kit.ball(0.24, 0xe0b090, dagX, 1.08, dagZ);
    kit.cone(0.2, 0.45, 0xc0602a, dagX, 1.02, dagZ + 0.2, { rx: Math.PI, seg: 6 });
    kit.ball(0.2, 0xc0602a, dagX, 1.22, dagZ - 0.06).scale.set(0.22, 0.14, 0.22);
    kit.circle(dagX, dagZ, 0.45, { y0: 0, y1: 1.4 });

    // ---------------------------------------------------------------- tables, stools, benches
    const tables = [[-7.2, 3.6], [-1.2, 3.9], [-7.0, -1.0], [3.0, 3.4], [6.0, 1.2]];
    tables.forEach(([x, z], i) => roundTable(kit, x, z, FT, i));
    // a long trestle table with benches
    const LX = -2.4, LZ = 0.0;
    kit.box(3.4, 0.08, 1.0, 'plank', LX, FT + 0.72, LZ);
    for (const dx of [-1.3, 1.3]) kit.box(0.15, 0.72, 0.8, 'darkWood', LX + dx, FT, LZ);
    for (const dz of [-0.85, 0.85]) {
      kit.box(3.2, 0.07, 0.35, 'wood', LX, FT + 0.42, LZ + dz);
      for (const dx of [-1.3, 1.3]) kit.box(0.1, 0.42, 0.3, 'darkWood', LX + dx, FT, LZ + dz);
    }
    for (const dx of [-1, 0, 1.1]) {
      kit.cyl(0.07, 0.06, 0.16, 'bronze', LX + dx, FT + 0.8, LZ + 0.2, { seg: 6 });
      kit.cyl(0.17, 0.17, 0.02, 'paleStone', LX + dx + 0.25, FT + 0.8, LZ - 0.2, { seg: 8 });
    }
    kit.solidBox(3.4, 1.0, LX, LZ, 0, 1.0);

    // ---------------------------------------------------------------- chandeliers
    for (const [cx, cz] of [[-4.6, 1.0], [2.4, 1.6]]) {
      kit.box(0.04, 0.95, 0.04, 'iron', cx, H - 1.2, cz);
      kit.cyl(0.85, 0.85, 0.08, 'darkWood', cx, H - 1.35, cz, { seg: 8 });
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        kit.cyl(0.04, 0.04, 0.18, 'bone', cx + Math.cos(a) * 0.75, H - 1.27, cz + Math.sin(a) * 0.75, { seg: 4, shadow: false });
        kit.cone(0.035, 0.1, flameMat, cx + Math.cos(a) * 0.75, H - 1.09, cz + Math.sin(a) * 0.75, { seg: 4, shadow: false });
      }
      kit.light(cx, H - 1.6, cz, { color: 0xffc070, intensity: 14, distance: 10, flicker: 0.3 });
    }

    // ---------------------------------------------------------------- staircase to the rooms upstairs
    const LAND = 2.2; // landing height
    const z1 = 5.6 - (6.25 - hd); // bottom of the first flight, just inside the front wall
    const zl0 = 0.1, zl1 = 1.7;   // landing
    const n1 = 10;
    for (let i = 0; i < n1; i++) {
      const top = (LAND * (i + 1)) / n1;
      kit.box(1.6, top, (z1 - zl1) / n1, 'wood', SX, 0, z1 - ((z1 - zl1) * (i + 0.5)) / n1);
    }
    kit.ramp(SX, (zl1 + z1) / 2, 1.6, z1 - zl1, LAND, 0);
    kit.box(1.6, LAND, zl1 - zl0, 'wood', SX, 0, (zl0 + zl1) / 2);
    kit.floor(SX, (zl0 + zl1) / 2, 1.6, zl1 - zl0, LAND);
    const n2 = 11, z2 = -3.9;
    for (let i = 0; i < n2; i++) {
      const top = LAND + ((H - LAND) * (i + 1)) / n2;
      kit.box(1.6, top, (zl0 - z2) / n2, 'wood', SX, 0, zl0 - ((zl0 - z2) * (i + 0.5)) / n2);
    }
    kit.solidBox(1.6, zl1 - z2, SX, (zl1 + z2) / 2, 0, LAND - 0.2);
    // handrail along the open side; a rope across the upper flight ("Guests only")
    const RX = SX - 0.8;
    for (let z = zl0; z <= z1; z += 1.1) {
      const y = z > zl1 ? LAND * (1 - (z - zl1) / (z1 - zl1)) : LAND;
      kit.box(0.08, 1.0, 0.08, 'darkWood', RX, y, z);
    }
    kit.segment(RX, zl0, RX, z1 - 0.6, { r: 0.08, y0: 0.4, y1: 6 });
    const run = z1 - zl1, railLen = Math.hypot(run, LAND);
    kit.box(0.07, 0.07, railLen, 'darkWood', RX, LAND / 2 + 0.96, (z1 + zl1) / 2, { rx: Math.atan2(LAND, run) });
    kit.box(0.07, 0.07, zl1 - zl0, 'darkWood', RX, LAND + 0.96, (zl0 + zl1) / 2);
    for (const dx of [-0.7, 0.7]) kit.cyl(0.05, 0.05, 1.0, 'bronze', SX + dx, LAND, zl0 + 0.12, { seg: 5 });
    kit.box(1.4, 0.06, 0.06, 'red', SX, LAND + 0.8, zl0 + 0.12);
    kit.box(0.5, 0.3, 0.03, 'cloth', SX, LAND + 0.45, zl0 + 0.14);
    kit.segment(SX - 0.8, zl0, SX + 0.8, zl0, { r: 0.08, y0: 1.5, y1: 6 });

    // ---------------------------------------------------------------- odds and ends
    const NX = doorX - 2.3, NZ = hd - 0.22;
    kit.box(1.7, 1.2, 0.08, 'wood', NX, 1.2, NZ);
    [[-0.5, 1.65], [0.05, 1.75], [0.55, 1.6], [-0.3, 1.3], [0.35, 1.28]].forEach(([dx, y], i) =>
      kit.box(0.34, 0.42, 0.02, i % 2 ? 'cloth' : 'bone', NX + dx, y, NZ - 0.06));
    for (const [x, z] of [[-hw + 0.8, -2.0], [-hw + 0.8, -3.0], [-hw + 0.8, hd - 1.2]]) barrel(kit, x, z);
    kit.box(0.08, 2.6, 1.7, 'wood', doorX - 0.98, FT, hd - 1.05); // the door, swung open
    kit.box(2.4, 0.03, 1.6, 'purple', doorX, FT, hd - 1.4);

    kit.info({
      id: place.id, name: place.name, kind: place.kind, description: place.description,
      radius: Math.max(W, D) / 2 + 6, labelHeight: H + UP + RH + 2.2, color: '#e9845f',
    });
    kit.info({
      id: `${place.id}-board`, name: 'Notice board', kind: place.name, label: false, radius: 2.2,
      x: NX, z: hd - 1.3,
      description: 'WANTED: brave souls to clear the cellars under the old Barrow mound. Strange lights seen. Ask for Hollin at the Lantern. 50 gp.\n\nREWARD: whoever has been taking Tobias Oakley\'s sheep at Brightfurrow Farm. 25 gp, more if it is not a wolf.\n\nLOST: grey cat, answers to Sir Whiskerton. Last seen near Kelemvor\'s Rest.',
    });
  },
};

function barrel(kit, x, z) {
  kit.cyl(0.42, 0.38, 1.0, 'wood', x, 0, z, { seg: 8 });
  kit.cyl(0.43, 0.43, 0.06, 'iron', x, 0.18, z, { seg: 8 });
  kit.cyl(0.43, 0.43, 0.06, 'iron', x, 0.78, z, { seg: 8 });
  kit.circle(x, z, 0.45, { y0: 0, y1: 1.1 });
}

function roundTable(kit, x, z, ft, i) {
  kit.cyl(0.85, 0.85, 0.08, 'plank', x, ft + 0.72, z, { seg: 10 });
  kit.cyl(0.12, 0.25, 0.72, 'darkWood', x, ft, z, { seg: 6 });
  const n = 3 + (i % 2);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + i;
    const sx = x + Math.cos(a) * 1.15, sz = z + Math.sin(a) * 1.15;
    kit.cyl(0.25, 0.25, 0.06, 'wood', sx, ft + 0.42, sz, { seg: 7 });
    kit.cyl(0.06, 0.09, 0.42, 'darkWood', sx, ft, sz, { seg: 5 });
  }
  kit.cyl(0.07, 0.06, 0.16, 'bronze', x + 0.3, ft + 0.8, z + 0.1, { seg: 6 });
  kit.cyl(0.07, 0.06, 0.16, 'bronze', x - 0.25, ft + 0.8, z - 0.3, { seg: 6 });
  kit.cyl(0.18, 0.18, 0.02, 'paleStone', x - 0.2, ft + 0.8, z + 0.3, { seg: 8 });
  if (i % 2 === 0) kit.cyl(0.04, 0.04, 0.15, 'bone', x, ft + 0.8, z, { seg: 4, shadow: false });
  kit.circle(x, z, 0.88, { y0: 0, y1: 1.0 });
}
