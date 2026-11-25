// The Morninghall: Holmstead's temple of Lathander, the Morninglord (R1 on the map).
// A raised stone temple with a walkable nave: columns, pews, a rose carpet, stained glass,
// braziers and a raised altar with a glowing sun disc and a statue of Lathander.

import * as THREE from 'three';
import { longAxisFrame, finishFrame } from './temple-align.js';

const ROSE = 0xd77a8a, ROSE_TILE = 0xb05a68, WARM_WHITE = 0xf1e6d2, GOLD = 0xd4a93a;

export default {
  build(outerKit, outerPlace, ctx) {
    const frame = longAxisFrame(outerKit, outerPlace, ctx);
    const kit = frame.k;
    const place = { ...outerPlace, w: frame.w, d: frame.d };
    const sunGold = kit.mat(0xffd36a, { emissive: 0xffb020, emissiveIntensity: 1.1 });
    const flame = kit.mat(0xffb050, { emissive: 0xff7a10, emissiveIntensity: 2.2 });
    const glass = [
      kit.mat(0xf2a0b4, { emissive: 0xd0607a, emissiveIntensity: 0.9 }),
      kit.mat(0xffc87a, { emissive: 0xe09030, emissiveIntensity: 0.9 }),
      kit.mat(0xffe08a, { emissive: 0xd8b040, emissiveIntensity: 0.9 }),
    ];

    const F = 1.2;          // floor height of the temple platform
    const HW = 8;           // half width of the nave (wall centre lines)
    const ZF = 13, ZB = -15; // front and back walls
    const WALL_H = 12, T = 0.8;

    // ---- platform, steps and garden ---------------------------------------------------------
    kit.box(20, F, 31, 'paleStone', 0, 0, -1.5);
    kit.floor(0, -1.5, 20, 31, F);
    // platform edges block you except along the front, which is one wide staircase
    kit.segment(-10, 14, -10, -17, { y0: -1, y1: F });
    kit.segment(10, 14, 10, -17, { y0: -1, y1: F });
    kit.segment(-10, -17, 10, -17, { y0: -1, y1: F });
    kit.stairs(0, 15.5, 20, 3, 0, F, 'paleStone', { ry: Math.PI }); // climbs from the street (z 17) up to the platform (z 14)
    for (const s of [-1, 1]) {
      kit.box(1.2, F + 0.9, 3.4, 'stone', s * 10.6, 0, 15.4, { solid: true });
      kit.ball(0.45, sunGold, s * 10.6, F + 1.25, 15.4);
    }
    roseGarden(kit, -11.2);
    roseGarden(kit, 11.2);

    // ---- walls with stained glass --------------------------------------------------------------
    const winZ = [9, 4.5, 0, -4.5, -9];
    const sideWindows = (fromFront) => winZ.map((z, i) => ({
      at: fromFront ? ZF - z : z - ZB, w: 1.6, h: 6, y: 3, color: glass[i % 3],
    }));
    kit.wall(-HW, ZF, HW, ZF, { h: WALL_H, t: T, y: F, color: WARM_WHITE, doors: [{ at: HW, w: 3.4, h: 5.4 }] });
    kit.wall(HW, ZF, HW, ZB, { h: WALL_H, t: T, y: F, color: WARM_WHITE, windows: sideWindows(true) });
    kit.wall(HW, ZB, -HW, ZB, { h: WALL_H, t: T, y: F, color: WARM_WHITE });
    kit.wall(-HW, ZB, -HW, ZF, { h: WALL_H, t: T, y: F, color: WARM_WHITE, windows: sideWindows(false) });
    // buttresses between the windows
    for (const z of [11.2, 6.75, 2.25, -2.25, -6.75, -11.2, -14.3]) {
      for (const s of [-1, 1]) {
        kit.box(1.0, 9, 1.3, 'paleStone', s * (HW + 0.9), F, z, { solid: true });
        kit.box(1.0, 1.6, 1.3, 'paleStone', s * (HW + 0.9), F + 9, z, { rz: s * 0.35 });
      }
    }
    // rose and gold band under the eaves
    for (const s of [-1, 1]) kit.box(0.2, 0.6, ZF - ZB + 0.8, ROSE, s * (HW + 0.45), F + WALL_H - 1.2, (ZF + ZB) / 2);
    kit.box(2 * HW + 0.8, 0.6, 0.2, ROSE, 0, F + WALL_H - 1.2, ZF + 0.45);

    // ---- roof, front gable and the tower --------------------------------------------------------
    const roofZ = (ZF + ZB) / 2;
    kit.gable(2 * HW + 2.2, 7, ZF - ZB + 1.6, ROSE_TILE, 0, F + WALL_H, roofZ);
    kit.box(2 * HW - 0.2, 0.35, ZF - ZB - 0.4, 0xe9dcc0, 0, F + WALL_H - 0.35, roofZ); // ceiling inside
    // rose window in the front gable
    const rose = kit.cyl(1.7, 1.7, 0.2, kit.mat(ROSE, { emissive: 0xc0506a, emissiveIntensity: 0.7 }), 0, F + WALL_H + 2.2, ZF + 0.85, { seg: 12, rx: Math.PI / 2 });
    rose.castShadow = false;
    kit.cyl(1.95, 1.95, 0.15, GOLD, 0, F + WALL_H + 2.2, ZF + 0.8, { seg: 12, rx: Math.PI / 2 });
    // bell tower over the entrance with a golden sunburst on top
    const TZ = ZF - 3;
    kit.box(5, 10, 5, WARM_WHITE, 0, F + WALL_H + 2, TZ);
    for (const [x, z, ry] of [[0, TZ + 2.52, 0], [0, TZ - 2.52, 0], [2.52, TZ, Math.PI / 2], [-2.52, TZ, Math.PI / 2]]) {
      kit.box(1.4, 2.8, 0.1, 'black', x, F + WALL_H + 7.6, z, { ry });
      kit.box(1.8, 0.3, 0.2, GOLD, x, F + WALL_H + 7.3, z, { ry });
    }
    kit.box(5.6, 0.6, 5.6, ROSE, 0, F + WALL_H + 11.8, TZ);
    kit.cone(4.1, 8, ROSE_TILE, 0, F + WALL_H + 12.4, TZ, { seg: 4, ry: Math.PI / 4 });
    kit.cyl(0.12, 0.12, 2, GOLD, 0, F + WALL_H + 20, TZ, { seg: 6 });
    sunburst(kit, sunGold, 0, F + WALL_H + 23, TZ, 1.3, 12, 1.1);

    // ---- portico and open doors -----------------------------------------------------------------
    for (const s of [-1, 1]) {
      column(kit, s * 3.2, F, ZF + 0.7, 6.6, 0.4);
      // door leaves swung open inwards
      kit.box(1.7, 5.3, 0.15, 'darkWood', s * 2.45, F, ZF - 0.95, { ry: s * -1.2 });
    }
    kit.box(8, 0.7, 1.6, WARM_WHITE, 0, F + 6.6, ZF + 0.9);
    kit.gable(8.6, 2, 1.8, ROSE_TILE, 0, F + 7.3, ZF + 0.9);
    kit.cyl(0.7, 0.7, 0.15, sunGold, 0, F + 7.9, ZF + 1.85, { seg: 12, rx: Math.PI / 2 });

    // ---- inside: floor, carpet, columns, pews ------------------------------------------------------
    const inner = HW - T / 2;
    for (let x = -inner + 1; x < inner; x += 2) {
      for (let z = ZB + 1.4; z < ZF - 0.4; z += 2) {
        const odd = (Math.round(x) + Math.round(z)) % 4 === 0;
        kit.box(2, 0.05, 2, odd ? 0xe8e4dc : 0xd8cbb4, x, F, z, { shadow: false });
      }
    }
    kit.box(3, 0.08, ZF - ZB - 7, ROSE, 0, F, (ZF - 7 + ZB + 7) / 2 + 0.5 + 3, { shadow: false });
    for (const z of [9, 5, 1, -3, -7]) {
      for (const s of [-1, 1]) column(kit, s * 5.3, F, z, WALL_H - 0.4, 0.45);
    }
    for (let z = 8; z >= -5; z -= 1.6) {
      for (const s of [-1, 1]) pew(kit, s * 3.3, F, z);
    }
    for (const s of [-1, 1]) kit.solidBox(3.4, 13.5, s * 3.3, 1.5, F - 0.5, F + 1.1);

    // ---- altar dais ----------------------------------------------------------------------------------
    const DH = F + 1; // dais height
    const DZ0 = -8.6;  // front edge of the dais
    const dz = DZ0 - (ZB + T / 2), dc = (DZ0 + ZB + T / 2) / 2;
    kit.box(2 * inner, 1, dz, 'marble', 0, F, dc);
    kit.floor(0, dc, 2 * inner, dz, DH);
    kit.box(2 * inner, 0.12, 0.3, GOLD, 0, DH - 0.1, DZ0 + 0.1);
    kit.segment(-inner, DZ0, -3.2, DZ0, { y0: F - 1, y1: DH });
    kit.segment(3.2, DZ0, inner, DZ0, { y0: F - 1, y1: DH });
    kit.stairs(0, DZ0 + 0.9, 6, 1.8, F, DH, 'marble', { ry: Math.PI });
    kit.box(6.4, 0.06, 1.8, ROSE, 0, DH, -10.4, { shadow: false });

    // the altar
    kit.box(4.2, 1.1, 1.6, 'marble', 0, DH, -11.3, { solid: true });
    kit.box(4.4, 0.06, 1.8, ROSE, 0, DH + 1.1, -11.3);
    kit.box(1.2, 1.12, 1.82, GOLD, 0, DH, -11.3);
    for (const x of [-1.6, -0.9, 0.9, 1.6]) candle(kit, flame, x, DH + 1.16, -11.4, 0.5);
    kit.light(0, DH + 2, -10.6, { color: 0xffc070, intensity: 18, distance: 9, flicker: 0.4 });

    // statue of Lathander, arms raised to the dawn
    statue(kit, sunGold, 0, DH, -13.1);

    // the great sun disc on the back wall, its rays slowly turning
    const SY = F + 7.8;
    kit.cyl(2.2, 2.2, 0.3, sunGold, 0, SY, ZB + 0.45, { seg: 16, rx: Math.PI / 2 });
    kit.cyl(1.6, 1.6, 0.35, kit.mat(0xffe9a8, { emissive: 0xffd060, emissiveIntensity: 1.4 }), 0, SY, ZB + 0.5, { seg: 16, rx: Math.PI / 2 });
    const rays = new THREE.Group();
    rays.position.set(0, SY, ZB + 0.55);
    kit.add(rays);
    kit.dynamic(rays);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const len = i % 2 ? 0.9 : 1.5;
      kit.box(0.3, len, 0.15, sunGold, Math.sin(a) * 2.3, -Math.cos(a) * 2.3, 0, { parent: rays, rz: a + Math.PI, shadow: false });
    }
    kit.animate((t) => { rays.rotation.z = t * 0.08; });
    kit.light(0, F + 8, ZB + 3, { color: 0xffc860, intensity: 45, distance: 18 });

    // braziers
    for (const [x, y, z] of [[-6.2, DH, -10], [6.2, DH, -10], [-6.6, F, 10.5], [6.6, F, 10.5]]) brazier(kit, flame, x, y, z);

    // candle stands along the side aisles
    for (const z of [7, -1]) for (const s of [-1, 1]) {
      kit.cyl(0.06, 0.12, 1.3, 'bronze', s * 6.6, F, z, { seg: 6 });
      kit.cyl(0.35, 0.3, 0.08, 'bronze', s * 6.6, F + 1.3, z, { seg: 6 });
      for (const dx of [-0.2, 0, 0.2]) candle(kit, flame, s * 6.6 + dx, F + 1.38, z, 0.22 + Math.abs(dx));
    }

    kit.info({ id: place.id, name: place.name, kind: place.kind, description: place.description, radius: 22, labelHeight: 40, color: '#f2b8c6' });
    kit.info({
      id: `${place.id}-altar`, name: 'The Dawn Altar', kind: 'Altar of Lathander', x: 0, z: -11, radius: 4.5, label: false, travel: false,
      description: 'Beneath the great sun disc, the statue of the Morninglord greets each dawn with open arms. Pilgrims lay roses and loaves of fresh bread on the altar.\n\n"Every sunrise is a second chance." Words carved into the altar step.',
    });
    finishFrame(frame, ctx);
  },
};

function column(kit, x, y, z, h, r) {
  kit.box(r * 2.8, 0.5, r * 2.8, 'paleStone', x, y, z);
  kit.cyl(r, r * 1.1, h - 1, 'marble', x, y + 0.5, z, { seg: 10 });
  kit.cyl(r * 1.25, r * 1.25, 0.15, GOLD, x, y + h - 0.65, z, { seg: 10 });
  kit.box(r * 2.8, 0.5, r * 2.8, 'paleStone', x, y + h - 0.5, z);
  kit.circle(x, z, r * 1.3, { y0: y - 0.5, y1: y + h });
}

function pew(kit, x, y, z) {
  kit.box(3.2, 0.1, 0.5, 'wood', x, y + 0.45, z);
  kit.box(3.2, 0.65, 0.08, 'wood', x, y + 0.5, z + 0.27);
  for (const s of [-1, 1]) kit.box(0.08, 0.95, 0.55, 'darkWood', x + s * 1.6, y, z + 0.02);
}

function candle(kit, flame, x, y, z, h) {
  kit.cyl(0.05, 0.05, h, 0xf4ecd8, x, y, z, { seg: 5 });
  kit.cone(0.04, 0.12, flame, x, y + h, z, { seg: 4, shadow: false });
}

function brazier(kit, flame, x, y, z) {
  kit.cyl(0.12, 0.25, 1.1, 'bronze', x, y, z, { seg: 6, solid: true });
  kit.cyl(0.65, 0.3, 0.4, 'bronze', x, y + 1.1, z, { seg: 8 });
  const f = kit.cone(0.4, 0.9, flame, x, y + 1.4, z, { seg: 6, shadow: false });
  kit.dynamic(f);
  const seed = x * 3.1 + z;
  kit.animate((t) => { f.scale.y = 0.9 + Math.sin(t * 11 + seed) * 0.12 + Math.sin(t * 6.3 + seed) * 0.08; });
  kit.light(x, y + 1.9, z, { color: 0xff9a40, intensity: 22, distance: 10, flicker: 0.7 });
}

/** A golden sun: disc plus alternating long and short rays, facing +z, centred on (x, y, z). */
function sunburst(kit, mat, x, y, z, r, n, rayLen) {
  kit.cyl(r, r, 0.25, mat, x, y, z, { seg: 12, rx: Math.PI / 2 });
  const g = new THREE.Group();
  g.position.set(x, y, z);
  kit.add(g);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const len = i % 2 ? rayLen * 0.6 : rayLen;
    kit.box(0.22, len, 0.12, mat, Math.sin(a) * (r - 0.1), -Math.cos(a) * (r - 0.1), 0, { parent: g, rz: a + Math.PI });
  }
}

/** Lathander: a robed figure on a pedestal with both arms raised to the sun. */
function statue(kit, gold, x, y, z) {
  const stone = 0xeee6d6;
  kit.box(1.9, 1.2, 1.9, 'paleStone', x, y, z, { solid: true });
  kit.box(2.1, 0.15, 2.1, GOLD, x, y + 1.2, z);
  const b = y + 1.35;
  kit.cyl(0.42, 0.9, 2.5, stone, x, b, z, { seg: 8 });          // robe
  kit.cyl(0.5, 0.42, 1.0, stone, x, b + 2.5, z, { seg: 8 });     // chest
  kit.cyl(0.56, 0.56, 0.12, GOLD, x, b + 2.3, z, { seg: 8 });    // belt
  kit.ball(0.33, stone, x, b + 3.85, z, { detail: 1 });          // head
  kit.cyl(0.62, 0.62, 0.06, gold, x, b + 3.85, z - 0.35, { seg: 12, rx: Math.PI / 2 }); // halo
  for (const s of [-1, 1]) {
    kit.cyl(0.14, 0.17, 1.6, stone, x + s * 0.48, b + 3.25, z, { seg: 6, rz: -s * 0.55 }); // raised arms
    kit.ball(0.15, stone, x + s * 1.3, b + 4.6, z);
    kit.box(0.5, 0.06, 0.5, stone, x + s * 0.75, b + 2.1, z + 0.1, { rz: s * 0.3 });      // sleeve folds
  }
}

function roseGarden(kit, x) {
  kit.box(1.1, 0.5, 30, 'darkStone', x, 0, -1.5);
  kit.box(0.9, 0.12, 29.8, 'dirt', x, 0.5, -1.5);
  for (let z = -15.5; z <= 12.5; z += 1.8) {
    kit.ball(0.5, 'leaf', x, 0.9, z);
    for (const [dx, dz, dy] of [[0.25, 0.2, 0.3], [-0.2, -0.25, 0.25], [0.1, -0.3, 0.45]]) {
      kit.ball(0.14, ROSE, x + dx, 0.9 + dy, z + dz, { shadow: false });
    }
  }
}
