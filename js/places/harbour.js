// Holmstead Harbour: a jetty with dock clutter, a wooden pier, and the carrack
// "Wandering Gull" which you can board and explore (deck, sterncastle, forecastle,
// captain's cabin and cargo hold).
//
// Frame: the place origin sits in the river channel; kit.origin.y is the river bed.
// Local +z points across the river to the Hightown jetty, the ship lies along local x.
// All heights below are WORLD heights (water = 0, quays = 3) converted with Y().

import * as THREE from 'three';
import { faceted } from '../engine/kit.js';

// ---------------------------------------------------------------- ship dimensions (world heights)
const DECK = 4.2;        // main deck
const STERN_DECK = 6.6;  // sterncastle (roof of the captain's cabin)
const FORE_DECK = 6.0;   // forecastle
const HOLD = 1.4;        // cargo hold floor
const KEEL = -1.8;
const HALF_L = 13;       // ship is 26 m long, bow at +x
const SX = -2.7, SZ = 5.5; // ship centre in the place's local frame
const PIER_X = -4.7;     // the pier and gangplank line (centre of the jetty)
const GANGWAY = [-3, -1]; // ship-local x range of the gangway port on the jetty (+z) side

const UP = new THREE.Vector3(0, 1, 0);
const lerp = THREE.MathUtils.lerp;

function halfBeam(x) {
  const t = x / HALF_L;
  return t >= 0 ? Math.max(0.12, 4 * (1 - t ** 2.4)) : 4 * (1 - 0.45 * t * t);
}
function sheer(x) { // height of the top of the hull side
  if (x < -6.4) return STERN_DECK + 1.0;
  if (x < -5.0) return lerp(STERN_DECK + 1, DECK + 1, (x + 6.4) / 1.4);
  if (x < 7.2) return DECK + 1.0;
  if (x < 8.4) return lerp(DECK + 1, FORE_DECK + 1, (x - 7.2) / 1.2);
  return FORE_DECK + 1.0 + Math.max(0, x - 11) * 0.35;
}
function keelAt(x) {
  const t = x / HALF_L;
  if (t > 0.5) return lerp(KEEL, 1.4, ((t - 0.5) / 0.5) ** 1.5);
  if (t < -0.85) return lerp(KEEL, -1.0, (-t - 0.85) / 0.15);
  return KEEL;
}
/** Hull cross-section at x: [half-width, height] from the rail down to the keel. */
function profile(x) {
  const hb = halfBeam(x), top = sheer(x), k = keelAt(x);
  return [[0.9 * hb, top], [0.95 * hb, DECK + 0.05], [hb, 2.6], [0.88 * hb, 0], [0.5 * hb, k + 0.5], [0, k]];
}

export default {
  build(kit, place) {
    const oy = kit.origin.y;
    const Y = (w) => w - oy;                 // world height -> local
    const P = (x, z) => [SX + x, SZ + z];    // ship-local -> place-local (no rotation)
    const ship = new THREE.Group();
    ship.position.set(SX, 0, SZ);
    kit.group.add(ship);
    const on = { parent: ship };

    const glow = kit.mat(0xffd27a, { emissive: 0xffa640, emissiveIntensity: 1.4 });
    const paneGlow = kit.mat(0xbcd8e6, { emissive: 0x6f95ad, emissiveIntensity: 0.5 });
    const hullUpper = kit.mat(0x8f5f36, { side: THREE.DoubleSide });
    const hullMid = kit.mat(0x4e3320, { side: THREE.DoubleSide });
    const hullLow = kit.mat(0x2b2521, { side: THREE.DoubleSide });
    const sailMat = kit.mat(0xeee4cc, { side: THREE.DoubleSide });

    const beam = (a, b, r, color, parent = ship) => {
      const d = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const m = kit.cyl(r, r, d.length(), color, a[0], a[1], a[2], { seg: 5, parent });
      m.quaternion.setFromUnitVectors(UP, d.normalize());
      return m;
    };
    const lantern = (x, y, z, parent = ship, light = true) => {
      kit.box(0.34, 0.06, 0.34, 'iron', x, y + 0.5, z, { parent });
      kit.box(0.26, 0.45, 0.26, glow, x, y + 0.05, z, { parent, shadow: false });
      kit.box(0.34, 0.06, 0.34, 'iron', x, y, z, { parent });
      if (light) {
        const w = parent === ship ? P(x, z) : [x, z];
        kit.light(w[0], y + 0.3, w[1], { color: 0xffb060, intensity: 14, distance: 11, flicker: 0.5 });
      }
    };
    const crate = (x, y, z, s = 1, parent = kit.group, ry = 0) => {
      kit.box(s, s, s, 'plank', x, y, z, { parent, ry });
      kit.box(s + 0.04, 0.12, s + 0.04, 'darkWood', x, y + s * 0.5 - 0.06, z, { parent, ry });
    };
    const barrel = (x, y, z, parent = kit.group) => {
      kit.cyl(0.36, 0.4, 1.0, 'wood', x, y, z, { seg: 8, parent });
      kit.cyl(0.42, 0.42, 0.08, 'iron', x, y + 0.2, z, { seg: 8, parent });
      kit.cyl(0.42, 0.42, 0.08, 'iron', x, y + 0.75, z, { seg: 8, parent });
    };

    // ============================================================ hull
    {
      const xs = [];
      for (let x = -HALF_L; x <= HALF_L + 0.001; x += 1) xs.push(x);
      const bandMat = [hullUpper, hullUpper, hullMid, hullLow, hullLow];
      const pos = bandMat.map(() => []);
      for (let i = 0; i < xs.length - 1; i++) {
        const A = profile(xs[i]), B = profile(xs[i + 1]);
        for (const side of [1, -1]) {
          for (let k = 0; k < 5; k++) {
            // the gangway port: no bulwark above the deck where the gangplank comes aboard
            if (k === 0 && side === 1 && xs[i] >= GANGWAY[0] && xs[i + 1] <= GANGWAY[1]) continue;
            const a = [xs[i], Y(A[k][1]), side * A[k][0]], b = [xs[i + 1], Y(B[k][1]), side * B[k][0]];
            const c = [xs[i + 1], Y(B[k + 1][1]), side * B[k + 1][0]], d = [xs[i], Y(A[k + 1][1]), side * A[k + 1][0]];
            pos[k].push(...a, ...b, ...c, ...a, ...c, ...d);
          }
        }
      }
      const T = profile(-HALF_L); // flat transom at the stern
      for (let k = 0; k < 5; k++) {
        const x = -HALF_L;
        const a = [x, Y(T[k][1]), -T[k][0]], b = [x, Y(T[k][1]), T[k][0]], c = [x, Y(T[k + 1][1]), T[k + 1][0]], d = [x, Y(T[k + 1][1]), -T[k + 1][0]];
        pos[k].push(...a, ...b, ...c, ...a, ...c, ...d);
      }
      pos.forEach((p, k) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
        kit.mesh(faceted(g), bandMat[k], 0, 0, 0, on);
      });
      // rail caps and a yellow-ochre wale stripe
      for (let i = 0; i < xs.length - 1; i++) {
        for (const side of [1, -1]) {
          const A = profile(xs[i]), B = profile(xs[i + 1]);
          if (!(side === 1 && xs[i] >= GANGWAY[0] && xs[i + 1] <= GANGWAY[1])) {
            beam([xs[i], Y(A[0][1]) + 0.05, side * A[0][0]], [xs[i + 1], Y(B[0][1]) + 0.05, side * B[0][0]], 0.09, 'darkWood');
          }
          beam([xs[i], Y(2.9), side * A[2][0] * 1.01], [xs[i + 1], Y(2.9), side * B[2][0] * 1.01], 0.12, 'ochre');
        }
      }
    }

    // ============================================================ decks (visual slabs + physics)
    const outline = (x0, x1, f = 0.95) => {
      const s = new THREE.Shape();
      const n = Math.max(2, Math.ceil((x1 - x0) / 0.5));
      for (let i = 0; i <= n; i++) { const x = x0 + ((x1 - x0) * i) / n; i ? s.lineTo(x, f * halfBeam(x)) : s.moveTo(x, f * halfBeam(x)); }
      for (let i = n; i >= 0; i--) { const x = x0 + ((x1 - x0) * i) / n; s.lineTo(x, -f * halfBeam(x)); }
      return s;
    };
    const slab = (shape, top, thick, color) => {
      const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
      g.rotateX(Math.PI / 2);
      kit.mesh(faceted(g), color, 0, Y(top), 0, on);
    };
    const main = outline(-HALF_L, HALF_L - 0.3, 0.95);
    const hatch = new THREE.Path();
    hatch.moveTo(1, -0.9); hatch.lineTo(5.5, -0.9); hatch.lineTo(5.5, 0.9); hatch.lineTo(1, 0.9); hatch.closePath();
    main.holes.push(hatch);
    slab(main, DECK, 0.2, 'plank');
    slab(outline(-HALF_L, -6.5, 0.9), STERN_DECK, 0.25, 'plank');
    slab(outline(8, HALF_L - 0.4, 0.9), FORE_DECK, 0.25, 'plank');
    slab(outline(-11, 9, 0.84), HOLD, 0.2, 'darkWood');

    const floor = (x0, x1, z0, z1, y) => { const [cx, cz] = P((x0 + x1) / 2, (z0 + z1) / 2); kit.floor(cx, cz, x1 - x0, z1 - z0, Y(y)); };
    floor(-HALF_L, 1, -4.0, 4.0, DECK);
    floor(5.5, HALF_L, -4.0, 4.0, DECK);
    floor(1, 5.5, 0.9, 4.0, DECK);
    floor(1, 5.5, -4.0, -0.9, DECK);
    floor(-HALF_L, -6.5, -4.0, 4.0, STERN_DECK);
    floor(8, HALF_L, -3.5, 3.5, FORE_DECK);
    floor(-11, 9, -3.6, 3.6, HOLD);

    // rails all round the deck edge (a gap at the gangway), hold walls below
    const railZ = (x, f) => f * halfBeam(x) - 0.25;
    const seg = (x1, z1, x2, z2, y0, y1) => { const a = P(x1, z1), b = P(x2, z2); kit.segment(a[0], a[1], b[0], b[1], { r: 0.15, y0: Y(y0), y1: Y(y1) }); };
    for (let x = -HALF_L; x < HALF_L - 0.5; x += 1) {
      const x2 = Math.min(x + 1, HALF_L - 0.5);
      for (const side of [1, -1]) {
        if (side === 1 && x >= GANGWAY[0] && x2 <= GANGWAY[1]) continue;
        seg(x, side * railZ(x, 0.9), x2, side * railZ(x2, 0.9), DECK - 0.3, STERN_DECK + 3);
      }
    }
    seg(-HALF_L + 0.2, -3.2, -HALF_L + 0.2, 3.2, DECK - 0.3, STERN_DECK + 3);           // transom
    for (let x = -11; x < 9; x += 1) {
      for (const side of [1, -1]) seg(x, side * 0.8 * halfBeam(x), x + 1, side * 0.8 * halfBeam(x + 1), HOLD - 0.5, DECK - 0.1);
    }
    seg(-11, -3.1, -11, 3.1, HOLD - 0.5, DECK - 0.1);
    seg(9, -1.8, 9, 1.8, HOLD - 0.5, DECK - 0.1);
    seg(1, 0.85, 5.5, 0.85, HOLD - 0.5, DECK - 0.2);   // sides of the hatch stairs
    seg(1, -0.85, 5.5, -0.85, HOLD - 0.5, DECK - 0.2);

    // ============================================================ captain's cabin (under the sterncastle)
    {
      const [fx, fz0] = P(-6.5, -3.3), [, fz1] = P(-6.5, 3.3);
      kit.wall(fx, fz0, fx, fz1, { h: STERN_DECK - DECK, t: 0.2, y: Y(DECK), color: 'timber', doors: [{ at: 3.3, w: 1.2, h: 2.1 }] });
      kit.box(1.5, 0.15, 0.4, 'ochre', -6.5 + 0.1, Y(DECK) + 2.1, 0, { ...on, ry: Math.PI / 2 });
      // table with charts
      kit.box(1.4, 0.08, 2.2, 'wood', -9.5, Y(DECK) + 0.8, 0, on);
      for (const sx of [-0.6, 0.6]) for (const sz of [-1, 1]) kit.box(0.08, 0.8, 0.08, 'darkWood', -9.5 + sx, Y(DECK), sz, on);
      kit.box(0.9, 0.02, 1.2, 0xe8dcb0, -9.5, Y(DECK) + 0.88, -0.2, { ...on, ry: 0.2 });
      kit.box(0.6, 0.02, 0.8, 0xd9c89a, -9.4, Y(DECK) + 0.9, 0.6, { ...on, ry: -0.3 });
      kit.box(0.04, 0.03, 0.35, 'red', -9.4, Y(DECK) + 0.92, 0.6, { ...on, ry: 0.6 });
      kit.cyl(0.12, 0.12, 0.04, 'bronze', -9.8, Y(DECK) + 0.88, -0.6, { ...on, seg: 10 }); // compass
      kit.cyl(0.04, 0.05, 0.25, 'gold', -9.2, Y(DECK) + 0.88, 0.95, { ...on, seg: 6 });   // candle stick
      for (const sz of [-1.6, 1.6]) {
        kit.box(0.5, 0.45, 0.5, 'darkWood', -9.5, Y(DECK), sz, on);
        kit.box(0.5, 0.6, 0.08, 'darkWood', -9.5, Y(DECK) + 0.45, sz + Math.sign(sz) * 0.22, on);
      }
      const t = P(-9.5, 0); kit.solidBox(1.4, 2.2, t[0], t[1], Y(DECK), Y(DECK) + 0.9);
      // bunk against the port side, sea chest at its foot
      kit.box(2.1, 0.5, 0.9, 'darkWood', -10.2, Y(DECK), -2.5, on);
      kit.box(2.0, 0.15, 0.85, 'red', -10.2, Y(DECK) + 0.5, -2.5, on);
      kit.box(0.5, 0.15, 0.6, 'cloth', -11, Y(DECK) + 0.6, -2.5, on);
      const bk = P(-10.2, -2.5); kit.solidBox(2.1, 0.9, bk[0], bk[1], Y(DECK), Y(DECK) + 0.7);
      kit.box(1.0, 0.6, 0.6, 'wood', -8.4, Y(DECK), -2.6, on);
      kit.box(1.04, 0.1, 0.64, 'iron', -8.4, Y(DECK) + 0.35, -2.6, on);
      kit.box(0.14, 0.14, 0.05, 'gold', -8.4, Y(DECK) + 0.3, -2.28, on);
      const ch = P(-8.4, -2.6); kit.solidBox(1.0, 0.6, ch[0], ch[1], Y(DECK), Y(DECK) + 0.6);
      // stern windows and a hanging lantern
      for (const z of [-1.4, 0, 1.4]) kit.box(0.06, 0.8, 0.9, paneGlow, -HALF_L + 0.12, Y(DECK) + 1.2, z, on);
      kit.box(0.08, 0.3, 0.06, 'darkWood', -12.4, Y(DECK) + 1.5, 2.0, on); // a small shelf of books
      for (let i = 0; i < 5; i++) kit.box(0.12, 0.28, 0.22, [0x6b2a2a, 0x2f4e7a, 0x3f6b35, 0x8a5f3a, 0x5b3a7a][i], -12.3, Y(DECK) + 1.62, 1.6 + i * 0.16, on);
      kit.box(0.3, 0.06, 1.0, 'darkWood', -12.3, Y(DECK) + 1.55, 2.0, on);
      lantern(-9.5, Y(STERN_DECK) - 0.9, 0);
      beam([-9.5, Y(STERN_DECK) - 0.35, 0], [-9.5, Y(STERN_DECK) - 0.05, 0], 0.02, 'iron');
    }

    // ============================================================ stairs, forecastle wall, hatch
    for (const z of [-2.1, 2.1]) {
      const [x, zz] = P(-4.8, z);
      kit.stairs(x, zz, 1.1, 3.4, Y(DECK), Y(STERN_DECK), 'plank', { ry: -Math.PI / 2 });
    }
    seg(-6.5, -1.5, -6.5, 1.5, STERN_DECK - 0.2, STERN_DECK + 1.4);   // sterncastle front rail
    for (const s of [1, -1]) seg(-6.5, s * 2.75, -6.5, s * 3.3, STERN_DECK - 0.2, STERN_DECK + 1.4);
    kit.box(0.1, 1.0, 3.0, 'darkWood', -6.45, Y(STERN_DECK), 0, on);
    for (const z of [-1.4, 1.4]) kit.box(0.12, 1.0, 0.12, 'darkWood', -6.45, Y(STERN_DECK), z, on);
    for (const z of [-1.45, 1.45]) {
      const [x, zz] = P(6.8, z);
      kit.stairs(x, zz, 0.9, 2.4, Y(DECK), Y(FORE_DECK), 'plank', { ry: Math.PI / 2 });
    }
    {
      const [wx, wz0] = P(8, -2.6), [, wz1] = P(8, 2.6);
      kit.wall(wx, wz0, wx, wz1, { h: FORE_DECK - DECK, t: 0.2, y: Y(DECK), color: 'timber' });
      kit.box(0.15, 1.2, 0.6, 'darkWood', 7.85, Y(DECK), 0, on); // locked bosun's locker door
      seg(8, -0.95, 8, 0.95, FORE_DECK - 0.2, FORE_DECK + 1.4);
      kit.box(0.1, 1.0, 1.8, 'darkWood', 8.05, Y(FORE_DECK), 0, on);
    }
    for (const z of [-0.95, 0.95]) kit.box(4.7, 0.3, 0.15, 'darkWood', 3.25, Y(DECK), z, on);   // hatch coaming
    kit.box(0.15, 0.3, 2.0, 'darkWood', 5.6, Y(DECK), 0, on);
    {
      const [x, z] = P(3.25, 0);
      kit.stairs(x, z, 1.6, 4.5, Y(DECK), Y(HOLD), 'plank', { ry: Math.PI / 2 });
    }
    // hatch grating cover leaning aside
    kit.box(2.0, 0.08, 1.6, 'darkWood', 3.4, Y(DECK) + 0.25, -2.3, { ...on, rx: 0.15 });

    // ============================================================ masts, sails, rigging
    const mast = (x, base, h, r, yards) => {
      kit.cyl(r * 0.7, r, h, 'wood', x, Y(base) - 0.3, 0, { seg: 8, ...on });
      const [px, pz] = P(x, 0);
      kit.circle(px, pz, r + 0.05, { y0: Y(HOLD), y1: Y(base + h) });
      kit.box(1.6, 0.25, 1.6, 'darkWood', x, Y(base + h * 0.72), 0, on);   // fighting top
      for (const [yy, span, sailH] of yards) {
        kit.cyl(0.12, 0.12, span, 'darkWood', x + 0.25, Y(base + yy), -span / 2, { ...on, seg: 6, rx: Math.PI / 2 });
        if (sailH) {
          kit.box(0.08, sailH, span * 0.92, sailMat, x + 0.45, Y(base + yy - sailH) + 0.1, 0, on);
          kit.box(0.09, sailH * 0.22, span * 0.92, 'red', x + 0.47, Y(base + yy - sailH * 0.62), 0, on);
        }
      }
      return Y(base + h);
    };
    const mainTop = mast(-0.2, DECK, 22, 0.38, [[9.5, 12, 5.5], [16.5, 9, 5]]);
    const foreTop = mast(10.3, FORE_DECK, 16, 0.3, [[8.5, 9.5, 5], [14, 7, 0]]);
    const mizTop = mast(-10.4, STERN_DECK, 13, 0.25, []);
    kit.gable(5.2, 7.5, 0.08, sailMat, -10.0, Y(STERN_DECK) + 3.0, 0, { ...on, ry: Math.PI / 2, rz: -0.12 }); // lateen sail
    beam([-12.8, Y(STERN_DECK) + 3.2, 0], [-6.8, Y(STERN_DECK) + 11.5, 0], 0.08, 'darkWood');
    // bowsprit and stays
    const bowTip = [HALF_L + 6.5, Y(FORE_DECK + 3.8), 0];
    beam([HALF_L - 2.5, Y(FORE_DECK + 0.6), 0], bowTip, 0.2, 'wood');
    beam([-0.2, mainTop - 0.5, 0], [10.3, foreTop - 3, 0], 0.035, 'darkWood');
    beam([10.3, foreTop - 0.5, 0], bowTip, 0.035, 'darkWood');
    beam([-0.2, mainTop - 0.5, 0], [-10.4, mizTop - 1, 0], 0.035, 'darkWood');
    for (const side of [1, -1]) {
      for (const [mx, top, from, to] of [[-0.2, mainTop, -3, 2.5], [10.3, foreTop, 8.5, 12], [-10.4, mizTop, -12, -8.5]]) {
        for (let k = 0; k < 4; k++) {
          const hx = from + ((to - from) * k) / 3;
          beam([hx, Y(sheer(hx)), side * 0.9 * halfBeam(hx)], [mx, top - 1.5, side * 0.3], 0.025, 'darkWood');
        }
      }
    }
    // pennant on the mainmast (moves in the wind)
    const pennant = kit.box(2.4, 0.5, 0.04, 'red', -0.2 + 1.2, mainTop + 0.6, 0, on);
    kit.cyl(0.05, 0.05, 1.4, 'darkWood', -0.2, mainTop, 0, { ...on, seg: 4 });
    kit.dynamic(pennant);
    kit.animate((t) => { pennant.rotation.y = Math.sin(t * 2.3) * 0.25; pennant.scale.y = 1 + Math.sin(t * 5.1) * 0.08; });

    // ============================================================ deck fittings
    // whipstaff wheel on the sterncastle
    kit.box(0.5, 1.0, 0.5, 'darkWood', -8.3, Y(STERN_DECK), 0, on);
    kit.cyl(0.75, 0.75, 0.1, 'wood', -7.9, Y(STERN_DECK) + 1.5, 0, { ...on, seg: 10, rz: Math.PI / 2 });
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 4, hy = Y(STERN_DECK) + 1.5;
      beam([-7.95, hy - Math.cos(a) * 0.95, -Math.sin(a) * 0.95], [-7.95, hy + Math.cos(a) * 0.95, Math.sin(a) * 0.95], 0.03, 'darkWood');
    }
    const wh = P(-8.3, 0); kit.circle(wh[0], wh[1], 0.45, { y0: Y(STERN_DECK), y1: Y(STERN_DECK) + 2 });
    // stern lanterns
    lantern(-HALF_L - 0.2, Y(STERN_DECK) + 1.6, 1.4);
    lantern(-HALF_L - 0.2, Y(STERN_DECK) + 1.6, -1.4, ship, false);
    kit.box(0.5, 0.1, 3.2, 'iron', -HALF_L - 0.15, Y(STERN_DECK) + 1.55, 0, on);
    // ballista on the forecastle
    kit.cyl(0.35, 0.45, 0.8, 'darkWood', 10.9, Y(FORE_DECK), 0, { ...on, seg: 8 });
    kit.box(1.8, 0.2, 0.25, 'wood', 11.2, Y(FORE_DECK) + 0.8, 0, on);
    kit.box(0.25, 0.15, 2.0, 'darkWood', 11.7, Y(FORE_DECK) + 0.85, 0, on);
    kit.box(1.6, 0.06, 0.06, 'iron', 11.5, Y(FORE_DECK) + 1.0, 0, on);
    const bl = P(10.9, 0); kit.circle(bl[0], bl[1], 0.6, { y0: Y(FORE_DECK), y1: Y(FORE_DECK) + 1.5 });
    // capstan, barrels and coiled rope on the main deck
    kit.cyl(0.4, 0.5, 1.0, 'wood', -2.0, Y(DECK), -1.4, { ...on, seg: 8 });
    for (let i = 0; i < 4; i++) kit.box(1.6, 0.08, 0.1, 'darkWood', -2.0, Y(DECK) + 0.85, -1.4, { ...on, ry: (i * Math.PI) / 4 });
    const cp = P(-2.0, -1.4); kit.circle(cp[0], cp[1], 0.55, { y0: Y(DECK), y1: Y(DECK) + 1.2 });
    for (const [x, z] of [[6.8, -0.4], [7.3, 0.3]]) { barrel(x, Y(DECK), z, ship); const b = P(x, z); kit.circle(b[0], b[1], 0.42, { y0: Y(DECK), y1: Y(DECK) + 1 }); }
    kit.cyl(0.55, 0.55, 0.25, 0xb59a6a, 2.5, Y(DECK), 2.6, { ...on, seg: 10 });
    kit.cyl(0.3, 0.3, 0.26, 'darkWood', 2.5, Y(DECK), 2.6, { ...on, seg: 8 });
    // ship's boat lashed upside down on the -z side of the deck
    kit.gable(1.3, 0.55, 3.2, 'wood', -2.2, Y(DECK) + 0.2, -3.0 + 0.4, { ...on, ry: Math.PI / 2 });
    // figurehead: a white gull under the bowsprit
    {
      const bx = HALF_L + 0.3, by = Y(FORE_DECK) - 0.3;
      kit.ball(0.45, 0xf2efe8, bx, by, 0, on).scale.set(0.7, 0.45, 0.4);
      kit.ball(0.22, 0xf2efe8, bx + 0.45, by + 0.25, 0, on);
      kit.cone(0.08, 0.35, 'gold', bx + 0.65, by + 0.22, 0, { ...on, rz: -Math.PI / 2 });
      for (const s of [1, -1]) kit.box(0.8, 0.06, 1.4, 0xe2ddd2, bx - 0.15, by + 0.15, s * 0.7, { ...on, rx: s * 0.45 });
    }
    // anchor hanging at the bow on the river side (-z)
    {
      const ax = 10.2, az = -0.9 * halfBeam(10.2) - 0.25, ay = Y(2.4);
      kit.box(0.14, 2.2, 0.14, 'iron', ax, ay, az, on);
      kit.box(1.3, 0.14, 0.14, 'iron', ax, ay + 2.0, az, on);
      for (const s of [1, -1]) kit.box(0.14, 0.9, 0.14, 'iron', ax + s * 0.42, ay - 0.05, az, { ...on, rz: s * 0.7 });
      kit.cyl(0.18, 0.18, 0.08, 'iron', ax, ay + 2.25, az, { ...on, seg: 8, rx: Math.PI / 2 });
      beam([ax, ay + 2.3, az], [ax - 0.6, Y(sheer(ax - 0.6)), -0.9 * halfBeam(ax - 0.6)], 0.04, 'iron');
    }

    // ============================================================ the hold
    {
      const h = Y(HOLD);
      for (const [x, z, s] of [[-9.5, 2.2, 1.0], [-9.5, 1.1, 0.9], [-8.4, 2.4, 1.0], [-9.4, 2.2, 0.8]]) crate(x, h + (s === 0.8 ? 1.0 : 0), z, s, ship, 0.1);
      for (const [x, z] of [[-6.8, -2.4], [-6.0, -2.6], [-6.4, -1.8], [-4.2, 2.6], [-3.4, 2.5], [8.0, 1.0], [7.9, -1.0]]) barrel(x, h, z, ship);
      for (const [x, z] of [[-1.2, -2.7], [-0.4, -2.8], [-0.8, -2.3]]) kit.ball(0.45, 0xc9b38c, x, h + 0.3, z, on).scale.set(1, 0.6, 0.8); // sacks
      crate(-1.2, h, 2.7, 1.0, ship, 0.1);
      crate(-1.1, h + 1.0, 2.7, 0.75, ship, -0.1);
      kit.box(0.5, 0.03, 0.35, 0xe8dcb0, -1.1, h + 1.76, 2.7, { ...on, ry: 0.4 }); // "Fragile" label
      const solids = [[-9.5, 1.8, 1.4, 2.2], [-8.4, 2.4, 1.0, 1.0], [-6.4, -2.2, 1.6, 1.4], [-3.8, 2.55, 1.6, 0.9], [-0.8, -2.6, 1.8, 1.0], [-1.15, 2.7, 1.1, 1.1], [8.0, 1.0, 0.9, 0.9], [7.9, -1.0, 0.9, 0.9]];
      for (const [x, z, w, d] of solids) { const p = P(x, z); kit.solidBox(w, d, p[0], p[1], h, h + 1.8); }
      // hammocks slung between beams, aft part of the hold
      for (const z of [-1.6, 1.4]) {
        kit.box(2.4, 0.12, 0.8, 0xcfc2a0, 2.0 - 6.5, h + 1.5, z, { ...on, rz: 0.04 });
        beam([0.8 - 6.5, h + 1.55, z], [0.8 - 6.5, Y(DECK) - 0.2, z], 0.02, 'darkWood');
        beam([3.2 - 6.5, h + 1.55, z], [3.2 - 6.5, Y(DECK) - 0.2, z], 0.02, 'darkWood');
      }
      // deck beams overhead
      for (let x = -10; x <= 8; x += 2) if (x < 1 || x > 5.5) kit.box(0.25, 0.25, 6.4, 'darkWood', x, Y(DECK) - 0.45, 0, on);
      lantern(-5.0, Y(DECK) - 1.0, 0);
      lantern(7.5, Y(DECK) - 1.0, 0);
      // the ship's cat, asleep on a sack
      const cx = -0.6, cz = -2.5, cy = h + 0.62;
      kit.ball(0.2, 0x2b2b2b, cx, cy, cz, on).scale.set(1.3, 0.7, 0.9);
      kit.ball(0.12, 0x2b2b2b, cx + 0.25, cy + 0.05, cz, on);
      for (const s of [1, -1]) kit.cone(0.04, 0.08, 0x2b2b2b, cx + 0.26, cy + 0.13, cz + s * 0.06, on);
      kit.box(0.3, 0.05, 0.05, 0x2b2b2b, cx - 0.32, cy - 0.05, cz + 0.1, { ...on, ry: 0.6 });
    }

    // ============================================================ pier and gangplank
    const quay = 3.0;                    // jetty level (world)
    const pierTop = quay + 0.1;
    const pierZ0 = 11.5, pierZ1 = 14.8;  // place-local z range of the pier
    kit.box(3.0, 0.25, pierZ1 - pierZ0, 'plank', PIER_X, Y(pierTop) - 0.25, (pierZ0 + pierZ1) / 2);
    for (const x of [PIER_X - 1.35, PIER_X + 1.35]) for (const z of [pierZ0 + 0.2, (pierZ0 + pierZ1) / 2]) kit.cyl(0.18, 0.18, Y(pierTop) + 0.9, 'darkWood', x, -0.5, z, { seg: 6 });
    kit.floor(PIER_X, (pierZ0 + pierZ1) / 2, 3.0, pierZ1 - pierZ0, Y(pierTop));
    // the map's jetty tip slopes in the height grid: pave it flat at quay level
    kit.box(9.4, Y(quay) + 0.05, 5.0, 'stone', -4.45, -0.05 + 0, 16.9);
    kit.floor(-4.45, 16.9, 9.4, 5.0, Y(quay) + 0.05);
    kit.opening(PIER_X, 14.6, 6.4, 3.4); // let the pier through the jetty's quay edge
    // replace the quay edge either side of the pier
    for (const [x1, z1, x2, z2] of [[-8.9, 15.0, -6.25, 14.75], [-3.15, 14.4, -1.4, 14.2]]) kit.segment(x1, z1, x2, z2, { r: 0.5, y0: -20, y1: Y(quay + 2) });
    for (const s of [-1, 1]) kit.segment(PIER_X + s * 1.5, pierZ0, PIER_X + s * 1.5, 14.6, { r: 0.12, y0: Y(pierTop) - 1, y1: Y(pierTop) + 1.6 });
    for (const s of [-1, 1]) kit.segment(PIER_X + s * 1.5, pierZ0, PIER_X + s * 0.75, pierZ0, { r: 0.12, y0: Y(pierTop) - 1, y1: Y(pierTop) + 1.6 });
    for (const s of [-1, 1]) { kit.box(0.1, 0.9, 0.1, 'darkWood', PIER_X + s * 1.45, Y(pierTop), pierZ0 + 0.1); kit.box(0.08, 0.08, pierZ1 - pierZ0, 'darkWood', PIER_X + s * 1.45, Y(pierTop) + 0.9, (pierZ0 + pierZ1) / 2); }
    // gangplank: pier (z = pierZ0) up to the deck edge
    const gz0 = SZ + 3.3, gz1 = pierZ0 + 0.1;
    kit.ramp(PIER_X, (gz0 + gz1) / 2, 1.4, gz1 - gz0, Y(DECK), Y(pierTop));
    const slope = Math.atan2(DECK - pierTop, gz1 - gz0);
    kit.box(1.4, 0.12, Math.hypot(gz1 - gz0, DECK - pierTop) + 0.2, 'plank', PIER_X, Y((DECK + pierTop) / 2) - 0.12, (gz0 + gz1) / 2, { rx: slope });
    for (let i = 0; i < 6; i++) { const t = (i + 0.5) / 6; kit.box(1.4, 0.05, 0.08, 'darkWood', PIER_X, Y(lerp(DECK, pierTop, t)) - 0.02, lerp(gz0, gz1, t), { rx: slope }); }
    for (const s of [-1, 1]) {
      kit.segment(PIER_X + s * 0.75, gz0 + 0.3, PIER_X + s * 0.75, gz1, { r: 0.08, y0: Y(pierTop) - 1, y1: Y(DECK) + 1.6 });
      beam([PIER_X + s * 0.7, Y(DECK) + 1.0, gz0], [PIER_X + s * 0.7, Y(pierTop) + 1.0, gz1], 0.03, 0xb59a6a, kit.group);
    }
    lantern(PIER_X + 1.35, Y(pierTop) + 2.2, pierZ1 - 0.3, kit.group);
    kit.cyl(0.08, 0.1, 2.2, 'darkWood', PIER_X + 1.35, Y(pierTop), pierZ1 - 0.3, { seg: 6 });

    // ============================================================ the jetty: crane, booth, clutter
    const gy = (x, z) => Math.max(kit.groundAt(x, z), Y(quay) - 0.05);
    // bollards along the jetty edges
    for (const z of [17, 25, 30, 34]) for (const x of [-8.6, -0.8]) {
      kit.cyl(0.22, 0.28, 0.7, 'iron', x, gy(x, z), z, { seg: 8 });
      kit.circle(x, z, 0.3, { y0: gy(x, z), y1: gy(x, z) + 1 });
    }
    // treadwheel crane at the jetty tip, swinging a crate out over the basin
    {
      const cx = -1.7, cz = 22.0, g = gy(cx, cz);
      kit.box(3.0, 0.4, 3.0, 'darkStone', cx, g, cz);
      kit.box(0.6, 7.5, 0.6, 'darkWood', cx, g + 0.4, cz);
      for (const s of [-1, 1]) beam([cx + s * 1.2, g + 0.4, cz + 1.2], [cx, g + 6, cz], 0.12, 'darkWood', kit.group);
      kit.cyl(1.6, 1.6, 0.8, 'wood', cx - 0.2, g + 2.2, cz - 1.1, { seg: 14, rx: Math.PI / 2 });
      kit.cyl(0.45, 0.45, 0.9, 'darkWood', cx - 0.2, g + 2.2, cz - 1.15, { seg: 8, rx: Math.PI / 2 });
      kit.solidBox(3.0, 3.6, cx, cz - 0.3, g, g + 5);
      // jib reaching over the water (+x)
      beam([cx, g + 7.5, cz], [cx + 6.5, g + 8.5, cz], 0.18, 'darkWood', kit.group);
      beam([cx, g + 3.5, cz], [cx + 6.0, g + 8.3, cz], 0.12, 'darkWood', kit.group);
      const hook = new THREE.Group();
      hook.position.set(cx + 6.3, g + 8.4, cz);
      kit.group.add(hook);
      kit.cyl(0.03, 0.03, 4.0, 0xb59a6a, 0, -4.0, 0, { parent: hook, seg: 4 });
      crate(0, -5.0, 0, 1.0, hook);
      kit.dynamic(hook);
      kit.animate((t) => { hook.rotation.z = Math.sin(t * 0.9) * 0.05; hook.rotation.x = Math.sin(t * 0.7 + 1) * 0.04; });
    }
    // harbourmaster's booth
    kit.room({ x: -6.6, z: 30, w: 3.2, d: 3.4, h: 2.8, t: 0.25, wall: 'timber', floor: 'plank', base: null, roofColor: 'slate', roofH: 1.4,
      doors: { right: [{ at: 0, w: 1.0, h: 2.1 }] }, windows: { front: [{ at: 0, w: 0.9, h: 0.8, y: 1.3 }] } });
    kit.box(2.2, 0.08, 0.7, 'wood', -6.9, 0.95 + gy(-6.6, 30), 30.9);
    kit.box(0.5, 0.02, 0.4, 0xe8dcb0, -6.9, 1.04 + gy(-6.6, 30), 30.9, { ry: 0.3 });
    kit.box(1.4, 0.9, 0.05, 0x2c3440, -5.1, 1.4 + gy(-6.6, 30), 31.75); // tally board outside
    // crates, barrels, nets and rope near the pier
    for (const [x, z, s, ry] of [[-7.6, 19.0, 1.1, 0.1], [-7.4, 20.2, 1.0, -0.2], [-7.5, 19.5, 0.8, 0.3], [-2.4, 26.4, 1.0, 0.0], [-2.3, 27.6, 0.9, 0.4]]) {
      const stacked = s === 0.8 ? 1.1 : 0;
      crate(x, gy(x, z) + stacked, z, s, kit.group, ry);
      if (!stacked) kit.solidBox(s, s, x, z, gy(x, z), gy(x, z) + 2, ry);
    }
    for (const [x, z] of [[-3.2, 19.0], [-2.5, 19.3], [-2.9, 19.9], [-7.8, 25.0], [-7.6, 25.9]]) {
      barrel(x, gy(x, z), z);
      kit.circle(x, z, 0.42, { y0: gy(x, z), y1: gy(x, z) + 1 });
    }
    kit.box(2.2, 0.15, 1.6, 0x4a5a3a, -5.0, gy(-5, 25.5), 25.5, { ry: 0.4 });    // drying net
    kit.box(1.8, 0.12, 1.2, 0x5a5a42, -4.8, gy(-5, 25.5) + 0.12, 25.7, { ry: -0.2 });
    kit.cyl(0.5, 0.5, 0.22, 0xb59a6a, -3.6, gy(-3.6, 30), 30, { seg: 10 });
    kit.cyl(0.25, 0.25, 0.23, 'darkWood', -3.6, gy(-3.6, 30), 30, { seg: 8 });
    lantern(-8.6, gy(-8.6, 17) + 2.6, 16.3, kit.group);
    kit.cyl(0.08, 0.1, 2.6, 'darkWood', -8.6, gy(-8.6, 17), 16.3, { seg: 6 });

    // rowboats moored in the basins either side of the jetty, and one by the ship
    const rowboat = (x, z, ry) => {
      const w = Y(0);
      kit.gable(1.4, 0.55, 3.6, 'wood', x, w + 0.32, z, { ry, rz: Math.PI });
      kit.box(1.2, 0.06, 3.2, 'plank', x, w + 0.26, z, { ry });
      kit.box(1.3, 0.08, 0.3, 'darkWood', x, w + 0.42, z, { ry });
      kit.box(0.08, 0.05, 2.6, 'darkWood', x + 0.3, w + 0.5, z, { ry: ry + 0.2 });
    };
    rowboat(-13.5, 21.5, 0.15);
    rowboat(4.0, 24.0, -0.2);
    rowboat(SX - 6, SZ - 5.6, Math.PI / 2);

    // ============================================================ what you can read about
    const mainLoc = kit.info({ id: place.id, name: place.name, kind: place.kind, description: place.description, x: PIER_X, z: 20, radius: 12, labelHeight: Y(quay) + 7 });
    const sp = kit.toWorld(PIER_X, 24);
    mainLoc.spawn = { x: sp.x, z: sp.z };
    kit.info({ id: 'wandering-gull', name: 'The Wandering Gull', kind: 'Carrack', x: SX, z: SZ, radius: 14, labelHeight: Y(DECK) + 25, color: '#9fc4d8', travel: false,
      description: 'A three-masted carrack out of Baldur\'s Gate, Captain Maren Saltbrook commanding. She brings Amnian wine and Waterdhavian cloth upriver and takes Holmstead wool back to the coast.\n\nThe crew is ashore spending their pay. Have a look around: the captain\'s cabin is under the sterncastle and the hold is down the main hatch.' });
    const cab = P(-9.5, 0);
    const cabinLoc = kit.info({ id: 'gull-cabin', name: "Captain's Cabin", kind: 'The Wandering Gull', x: cab[0], z: cab[1], radius: 3.2, label: false, travel: false,
      description: 'Charts of the Sword Coast from Luskan to Baldur\'s Gate cover the table. One of them has a red ink circle somewhere out in the Trackless Sea, with no name next to it.\n\nThe captain\'s sea chest is locked, and the lock is better than the chest.' });
    const hold = P(-3, 0);
    const holdLoc = kit.info({ id: 'gull-hold', name: 'Cargo Hold', kind: 'The Wandering Gull', x: hold[0], z: hold[1], radius: 4, label: false, travel: false,
      description: 'Crates stamped with the seal of a Baldur\'s Gate trading coster, barrels of Amnian red and sacks of salt. A smaller crate on its own is marked "Fragile. Do not open below decks." in a careful hand.\n\nThe ship\'s cat is asleep on the salt and would like you to leave.' });

    // The cabin and hold only offer their story when you are actually inside them
    // (prompts otherwise only look at map distance, so they'd show up on deck too).
    const v = new THREE.Vector3();
    kit.animate(() => {
      const cam = window.world?.camera;
      if (!cam) return;
      const feet = cam.position.y - 1.7;
      v.copy(cam.position);
      kit.group.worldToLocal(v);
      const sx = v.x - SX, sz = v.z - SZ;
      const inShip = sx > -HALF_L && sx < HALF_L && Math.abs(sz) < 4;
      const inHold = inShip && feet > HOLD - 0.3 && feet < DECK - 1;
      const inCabin = inShip && sx < -6.5 && feet > DECK - 0.3 && feet < STERN_DECK - 1;
      for (const [loc, inside, home] of [[holdLoc, inHold, hold], [cabinLoc, inCabin, cab]]) {
        const w = inside ? cam.position : kit.toWorld(home[0], home[1]);
        loc.x = w.x; loc.z = w.z;
        loc.radius = inside ? 6 : 0;
      }
    });
  },
};
