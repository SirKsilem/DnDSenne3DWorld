// Brightfurrow Farm (R4), outside the walls on the River Road.
// Farmhouse (walkable: hearth, table, beds, churn, spinning wheel) and a barn with its big
// doors open (walkable: hay, stalls, a cow and a horse, a loft), plus a fenced paddock with
// cows and sheep, haystacks, a well, a cart, a vegetable patch, a scarecrow and geese.
// The ground slopes here, so buildings sit on levelled stone foundations.

import * as THREE from 'three';
import { Kit } from '../engine/kit.js';

const COW = [0xf1ece0, 0x6b4a2e, 0x2a2420];
const WOOL = 0xefeadf;

/** A Kit for a building at local (lx, lz) of `kit`, on a level floor at the highest ground under its w × d footprint. */
function levelKit(kit, ctx, lx, lz, ry, w, d) {
  const angle = kit.origin.angle + ry;
  const p = kit.toWorld(lx, lz);
  const c = Math.cos(angle), s = Math.sin(angle);
  let hi = -Infinity, lo = Infinity;
  for (const ax of [-w / 2, 0, w / 2]) for (const az of [-d / 2, 0, d / 2]) {
    const h = ctx.heightAt(p.x + ax * c + az * s, p.z - ax * s + az * c);
    hi = Math.max(hi, h); lo = Math.min(lo, h);
  }
  const k = new Kit(ctx, { x: p.x, z: p.z, y: hi + 0.15, angle });
  const drop = hi + 0.15 - lo + 0.6;
  k.box(w + 0.5, drop, d + 0.5, 'stone', 0, -drop, 0); // foundation down into the slope
  k.floor(0, 0, w, d, 0.12);
  return k;
}

function cow(kit, x, z, ry, tint = 0, y = kit.groundAt(x, z)) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  kit.add(g);
  const body = COW[tint % COW.length], spot = tint === 0 ? 0x2a2420 : 0xf1ece0;
  kit.box(0.7, 0.75, 1.7, body, 0, 0.7, 0, { parent: g });
  kit.box(0.72, 0.4, 0.5, spot, 0, 0.95, 0.2, { parent: g });
  for (const sx of [-0.25, 0.25]) for (const sz of [-0.6, 0.6]) kit.box(0.16, 0.7, 0.16, body, sx, 0, sz, { parent: g });
  kit.box(0.42, 0.42, 0.55, body, 0, 1.05, 1.05, { parent: g });
  kit.box(0.3, 0.2, 0.15, 0xd8a8a0, 0, 1.02, 1.36, { parent: g });
  for (const sx of [-0.25, 0.25]) kit.box(0.2, 0.06, 0.06, 'bone', sx, 1.45, 1.0, { parent: g });
  kit.box(0.06, 0.45, 0.06, body, 0, 0.9, -0.88, { parent: g });
  kit.circle(x, z, 0.9, { y0: y, y1: y + 1.5 });
}

function horse(kit, x, z, ry, color = 0x7a4b2c, y = kit.groundAt(x, z)) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  kit.add(g);
  kit.box(0.6, 0.7, 1.7, color, 0, 0.95, 0, { parent: g });
  for (const sx of [-0.2, 0.2]) for (const sz of [-0.62, 0.62]) kit.box(0.14, 0.95, 0.14, color, sx, 0, sz, { parent: g });
  const neck = kit.box(0.32, 0.9, 0.35, color, 0, 1.4, 0.85, { parent: g });
  neck.rotation.x = 0.55;
  kit.box(0.28, 0.3, 0.7, color, 0, 2.05, 1.25, { parent: g });
  kit.box(0.1, 0.5, 0.5, 'black', 0, 1.6, 0.75, { parent: g });
  kit.box(0.1, 0.8, 0.12, 'black', 0, 0.75, -0.9, { parent: g });
}

function sheep(kit, x, z, ry) {
  const g = new THREE.Group();
  g.position.set(x, kit.groundAt(x, z), z);
  g.rotation.y = ry;
  kit.add(g);
  const b = kit.ball(0.5, WOOL, 0, 0.75, 0, { parent: g });
  b.scale.set(0.45, 0.42, 0.62);
  kit.box(0.24, 0.28, 0.3, 0x2a2420, 0, 0.8, 0.55, { parent: g });
  for (const sx of [-0.14, 0.14]) for (const sz of [-0.3, 0.3]) kit.box(0.08, 0.45, 0.08, 0x2a2420, sx, 0, sz, { parent: g });
  kit.circle(x, z, 0.55, { y0: kit.groundAt(x, z), y1: kit.groundAt(x, z) + 1 });
}

function goose(kit, x, z, ry) {
  const g = new THREE.Group();
  g.position.set(x, kit.groundAt(x, z), z);
  g.rotation.y = ry;
  kit.add(g);
  const b = kit.ball(0.25, 'whitewash', 0, 0.3, 0, { parent: g });
  b.scale.set(0.2, 0.18, 0.3);
  kit.box(0.07, 0.35, 0.07, 'whitewash', 0, 0.38, 0.2, { parent: g });
  kit.box(0.06, 0.05, 0.12, 0xe09a30, 0, 0.7, 0.27, { parent: g });
  kit.box(0.04, 0.15, 0.04, 0xe09a30, 0, 0.05, 0, { parent: g });
  return g;
}

/** Fence along local points, with posts, two rails and a collider. `gaps` = segment indexes left open. */
function fence(kit, pts, gaps = []) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az) - Math.PI / 2;
    const n = Math.max(1, Math.round(L / 2.4));
    for (let k = 0; k <= n; k++) {
      const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n;
      kit.box(0.14, 1.2, 0.14, 'darkWood', x, kit.groundAt(x, z) - 0.1, z);
    }
    if (gaps.includes(i)) continue;
    for (let k = 0; k < n; k++) {
      const x0 = ax + ((bx - ax) * k) / n, z0 = az + ((bz - az) * k) / n;
      const x1 = ax + ((bx - ax) * (k + 1)) / n, z1 = az + ((bz - az) * (k + 1)) / n;
      const y = (kit.groundAt(x0, z0) + kit.groundAt(x1, z1)) / 2;
      for (const h of [0.45, 0.9]) kit.box(L / n + 0.1, 0.09, 0.07, 'wood', (x0 + x1) / 2, y + h, (z0 + z1) / 2, { ry });
    }
    const y = Math.min(kit.groundAt(ax, az), kit.groundAt(bx, bz));
    kit.segment(ax, az, bx, bz, { r: 0.1, y0: y - 1, y1: y + 1.2 });
  }
}

export default {
  build(kit, place, ctx) {
    const W = Math.min(Math.max(place.w, 8), 12);
    const D = Math.min(Math.max(place.d, 6), 9);

    // ---------------------------------------------------------- farmhouse
    const H = 3.6;
    const house = levelKit(kit, ctx, 0, 0, 0, W, D);
    house.room({
      w: W, d: D, h: H, wall: 'whitewash', floor: 'plank', base: 'stone',
      doors: { front: [{ at: -W / 4, w: 1.3, h: 2.3 }] },
      windows: { front: [{ at: W / 4 }], left: [{ at: 0 }], right: [{ at: 0 }], back: [{ at: -1.5 }, { at: 1.5 }] },
      roof: 'gable', roofColor: 'thatch', ceiling: true, ceilingColor: 'wood', roofH: 3,
    });
    // timber frame on the outside
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) house.box(0.35, H, 0.35, 'timber', sx * W / 2, 0, sz * D / 2);
    house.box(W + 0.3, 0.25, 0.3, 'timber', 0, H - 0.25, D / 2 + 0.05);
    house.box(W + 0.3, 0.25, 0.3, 'timber', 0, H - 0.25, -D / 2 - 0.05);
    // doorstep down to the yard
    const stepH = house.origin.y - ctx.heightAt(...Object.values(house.toWorld(-W / 4, D / 2 + 0.8)));
    if (stepH > 0.25) house.stairs(-W / 4, D / 2 + 0.75, 1.6, 1.4, -stepH, 0.12, 'stone', { ry: Math.PI });
    // chimney over the hearth (left wall)
    const hx = -W / 2 + 0.9;
    house.box(1.4, H + 3.6, 1.2, 'stone', hx - 0.2, 0, 0);

    // hearth with a fire
    house.box(1.2, 1.4, 2.2, 'darkStone', hx, 0.12, 0, { solid: true });
    house.box(0.7, 0.9, 1.3, 'black', hx + 0.26, 0.12, 0);
    for (const dz of [-0.25, 0.25]) house.cyl(0.08, 0.08, 0.9, 'darkWood', hx + 0.25, 0.25, dz, { seg: 5, rx: Math.PI / 2 }).position.z = dz - 0.45;
    const fire = house.cone(0.3, 0.6, house.mat(0xffb040, { emissive: 0xff7a00, emissiveIntensity: 2 }), hx + 0.3, 0.25, 0, { seg: 6, shadow: false });
    house.dynamic(fire);
    house.animate((t) => { fire.scale.y = 0.6 * (1 + Math.sin(t * 12) * 0.15 + Math.sin(t * 7) * 0.1); });
    house.light(hx + 1, 1.2, 0, { color: 0xff8a3d, intensity: 25, distance: 11, flicker: 1 });
    house.box(0.4, 0.1, 2.4, 'wood', hx + 0.35, 1.55, 0); // mantel
    house.cyl(0.18, 0.2, 0.3, 'iron', hx + 0.5, 0.25, 0.2, { seg: 8 }); // pot

    // table with benches, bread and bowls
    const tx = -0.3, tz = 0.4;
    house.box(2.2, 0.08, 1, 'wood', tx, 0.82, tz);
    for (const ex of [-0.95, 0.95]) for (const ez of [-0.35, 0.35]) house.box(0.1, 0.75, 0.1, 'darkWood', tx + ex, 0.12, tz + ez);
    for (const ez of [-0.85, 0.85]) {
      house.box(2, 0.08, 0.32, 'wood', tx, 0.5, tz + ez);
      for (const ex of [-0.8, 0.8]) house.box(0.08, 0.38, 0.28, 'darkWood', tx + ex, 0.12, tz + ez);
    }
    house.ball(0.18, 0xc8924a, tx - 0.5, 0.95, tz).scale.set(0.25, 0.14, 0.18);
    for (const ex of [0, 0.5, -0.1]) house.cyl(0.14, 0.09, 0.08, 'wood', tx + ex + 0.2, 0.9, tz + (ex - 0.2) * 0.6, { seg: 8 });
    house.box(0.2, 0.25, 0.2, 0x9c7a5a, tx + 0.8, 0.9, tz - 0.2);
    house.solidBox(2.3, 2.1, tx, tz, 0.12, 1);

    // beds along the back wall, right side
    for (const [bx2, len] of [[W / 2 - 1.3, 2], [W / 2 - 3.1, 1.8]]) {
      const bz = -D / 2 + 1.25;
      house.box(1.2, 0.45, len, 'darkWood', bx2, 0.12, bz, { ry: Math.PI / 2 });
      house.box(1.1, 0.12, len - 0.1, 0x8e2a2a, bx2, 0.57, bz, { ry: Math.PI / 2 });
      house.box(0.5, 0.12, 0.8, 'cloth', bx2 + len / 2 - 0.35, 0.65, bz, { ry: Math.PI / 2 });
      house.solidBox(len, 1.2, bx2, bz, 0.12, 0.7);
    }
    // cradle, cupboard, churn, spinning wheel
    const cx2 = W / 2 - 0.8, cz2 = 0.6;
    house.box(0.9, 0.35, 0.5, 'wood', cx2, 0.2, cz2, { ry: Math.PI / 2 });
    for (const e of [-0.4, 0.4]) house.box(0.08, 0.08, 0.5, 'darkWood', cx2, 0.12, cz2 + e, { rz: 0.4 });
    house.box(0.6, 2, 1.4, 'darkWood', -W / 2 + 0.55, 0.12, -D / 2 + 1.4, { solid: true });
    house.box(0.05, 0.6, 0.5, 'wood', -W / 2 + 0.87, 1.1, -D / 2 + 1.05);
    house.box(0.05, 0.6, 0.5, 'wood', -W / 2 + 0.87, 1.1, -D / 2 + 1.75);
    for (let i = 0; i < 3; i++) house.cyl(0.08, 0.08, 0.18, 0xc9b38c, -W / 2 + 0.6, 2.12, -D / 2 + 1 + i * 0.4, { seg: 6 });
    house.cyl(0.25, 0.3, 0.9, 'wood', -W / 2 + 0.6, 0.12, D / 2 - 0.8, { seg: 8, solid: true });
    house.cyl(0.03, 0.03, 0.7, 'darkWood', -W / 2 + 0.6, 1, D / 2 - 0.8, { seg: 4 });
    const swx = W / 2 - 1.2, swz = D / 2 - 1.1;
    house.box(0.9, 0.1, 0.3, 'wood', swx, 0.55, swz);
    for (const e of [-0.35, 0.35]) house.box(0.08, 0.45, 0.08, 'darkWood', swx + e, 0.12, swz);
    house.cyl(0.45, 0.45, 0.06, 'wood', swx - 0.35, 1.05, swz - 0.03, { seg: 10, rz: Math.PI / 2 });
    house.box(0.06, 0.6, 0.06, 'darkWood', swx - 0.3, 0.6, swz);
    house.circle(swx, swz, 0.55, { y0: 0.12, y1: 1.2 });
    // herbs and hams hanging from the beams
    for (let i = 0; i < 5; i++) {
      house.box(0.02, 0.4, 0.02, 0x6b5b3a, -1.5 + i * 0.7, H - 0.65, -0.8);
      if (i % 2) house.ball(0.2, 0x8a4a30, -1.5 + i * 0.7, H - 0.8, -0.8).scale.set(0.16, 0.25, 0.16);
      else house.box(0.22, 0.3, 0.12, 'green', -1.5 + i * 0.7, H - 0.85, -0.8);
    }
    house.finalize();
    ctx.clickables.push(house.group);

    // ---------------------------------------------------------- barn (its doors face the yard, +z)
    const BW = 10, BD = 13, BH = 5.2, bxp = 17.5, bzp = 0;
    const barn = levelKit(kit, ctx, bxp, bzp, 0, BW, BD);
    barn.room({
      w: BW, d: BD, h: BH, wall: 0x8a3e2c, floor: 0x8a6a40, base: 'stone',
      doors: { front: [{ at: 0, w: 4, h: 3.8 }] }, windows: { left: [{ at: 2, y: 2.5 }], right: [{ at: -2, y: 2.5 }] },
      roof: 'gable', roofColor: 'roofBrown', roofH: 4, ceiling: true, ceilingColor: 'plank',
    });
    for (const sx of [-1, 1]) {
      const leaf = barn.box(2, 3.7, 0.15, 'wood', sx * 3.1, 0.12, BD / 2 + 0.9, { ry: sx * 1.2 });
      leaf.position.x = sx * 2.5; leaf.position.z = BD / 2 + 1;
      barn.box(0.12, 0.12, 2.1, 'darkWood', sx * 2.6, 2, BD / 2 + 1, { ry: sx * -0.37 });
    }
    barn.box(4.4, 0.3, 0.4, 'darkWood', 0, 3.8, BD / 2 + 0.05);
    const barnStep = barn.origin.y - ctx.heightAt(...Object.values(barn.toWorld(0, BD / 2 + 1.5)));
    if (barnStep > 0.25) barn.stairs(0, BD / 2 + 1.25, 4, 2, -barnStep, 0.12, 'plank', { ry: Math.PI, steps: 3 });
    barn.box(1.6, 1, 0.1, 'darkWood', 0, BH + 1, BD / 2 + 0.02); // loft hatch on the gable
    // loft (decorative) over the back third, with a ladder
    barn.box(BW - 0.4, 0.2, 4, 'plank', 0, 2.8, -BD / 2 + 2.2);
    for (const sx of [-2, 0, 2]) barn.box(0.25, 2.7, 0.25, 'darkWood', sx, 0.12, -BD / 2 + 4.1);
    for (let i = 0; i < 5; i++) barn.box(1.3, 0.6, 0.9, 'hay', -3.4 + i * 1.6, 3, -BD / 2 + 1.2 + (i % 2) * 1.2);
    for (const sx of [-0.25, 0.25]) barn.box(0.07, 3, 0.07, 'wood', 1 + sx, 0.12, -BD / 2 + 4.4, { rx: -0.15 });
    for (let i = 0; i < 6; i++) barn.box(0.6, 0.05, 0.05, 'wood', 1, 0.5 + i * 0.45, -BD / 2 + 4.35 + i * 0.07);
    // stalls on the left with a cow and a horse
    for (const sz of [-2, 2.2]) {
      barn.box(2.8, 1.3, 0.12, 'darkWood', -BW / 2 + 1.6, 0.12, sz - 1.9);
      barn.segment(-BW / 2, sz - 1.9, -BW / 2 + 3, sz - 1.9, { y0: 0, y1: 1.4 });
    }
    barn.box(0.12, 1.3, 7.2, 'darkWood', -BW / 2 + 3.05, 0.12, 0.1);
    barn.box(0.12, 0.12, 7.2, 'darkWood', -BW / 2 + 3.05, 1.2, 0.1);
    barn.segment(-BW / 2 + 3.05, -3.5, -BW / 2 + 3.05, 3.7, { y0: 0, y1: 1.4 });
    cow(barn, -BW / 2 + 1.5, 0.1, Math.PI / 2, 1, 0.12);
    horse(barn, -BW / 2 + 1.5, 4.2, Math.PI / 2, 0x7a4b2c, 0.12);
    barn.circle(-BW / 2 + 1.5, 4.2, 0.9, { y0: 0, y1: 2 });
    barn.box(0.5, 0.4, 1.4, 'wood', -BW / 2 + 0.4, 0.12, 0.1); // trough
    // hay bales, pitchforks, a lantern
    for (const [x, z, y] of [[3.2, -2, 0], [3.2, -0.8, 0], [3.2, -1.4, 0.6], [2.2, -2.2, 0]]) {
      barn.box(1.2, 0.6, 0.9, 'hay', x, 0.12 + y, z);
    }
    barn.solidBox(2.4, 2.2, 2.9, -1.5, 0.12, 1.2);
    for (const e of [0, 0.3]) {
      barn.cyl(0.03, 0.03, 1.7, 'wood', BW / 2 - 0.4 - e, 0.15, 1.5, { seg: 4, rz: 0.25 });
      for (const t of [-0.08, 0, 0.08]) barn.box(0.02, 0.3, 0.02, 'iron', BW / 2 - 0.85 - e, 1.75, 1.5 + t);
    }
    barn.box(0.3, 0.4, 0.3, 'iron', 0, BH - 1.2, 0.5);
    barn.light(0, BH - 1.3, 0.5, { color: 0xffc070, intensity: 14, distance: 12, flicker: 0.4 });
    barn.finalize();
    ctx.clickables.push(barn.group);

    // ---------------------------------------------------------- yard
    // paddock in front of the barn, gate toward the house
    fence(kit, [[10, 11], [6, 11], [6, 24], [25, 24], [25, 11], [10, 11]], [0]); // first side left open as the gate
    cow(kit, 12, 17, 0.6, 0);
    cow(kit, 18, 20, 2.4, 2);
    cow(kit, 21, 15, -1.2, 0);
    for (const [x, z, r] of [[9, 21, 1], [14, 13.5, -0.4], [22, 20, 2.8], [16, 22, 1.6]]) sheep(kit, x, z, r);
    kit.box(1.8, 0.45, 0.6, 'wood', 23, kit.groundAt(23, 12.3), 12.3); // water trough

    // haystacks behind the barn
    for (const [x, z, r] of [[25, -4, 1.8], [26, -8.5, 1.5]]) {
      const y = kit.groundAt(x, z);
      kit.cyl(r, r * 1.05, 1.6, 'hay', x, y - 0.1, z, { seg: 9 });
      kit.cone(r * 1.05, 1.6, 'hay', x, y + 1.5, z, { seg: 9 });
      kit.circle(x, z, r, { y0: y, y1: y + 3 });
    }

    // well
    const wx = -6, wz = 8, wy = kit.groundAt(wx, wz);
    kit.cyl(0.9, 1, 0.9, 'stone', wx, wy - 0.1, wz, { seg: 10, solid: true });
    kit.cyl(0.75, 0.75, 0.05, kit.mat(0x2a3a40), wx, wy + 0.78, wz, { seg: 10 });
    for (const sx of [-0.85, 0.85]) kit.box(0.15, 2.2, 0.15, 'darkWood', wx + sx, wy, wz);
    kit.gable(2.2, 0.7, 1.4, 'thatch', wx, wy + 2.2, wz, { ry: Math.PI / 2 });
    kit.cyl(0.07, 0.07, 1.7, 'wood', wx - 0.85, wy + 1.7, wz, { seg: 5, rz: -Math.PI / 2 });
    kit.cyl(0.18, 0.15, 0.3, 'wood', wx, wy + 1.1, wz, { seg: 7 });

    // cart by the barn
    const cx = 8.5, cz = 4.5, cy = kit.groundAt(cx, cz);
    kit.box(1.5, 0.5, 2.6, 'plank', cx, cy + 0.55, cz, { ry: 0.3 });
    for (const sx of [-0.85, 0.85]) {
      const wh = kit.cyl(0.55, 0.55, 0.1, 'darkWood', cx + sx * Math.cos(0.3) - 0.05, cy + 0.55, cz - sx * Math.sin(0.3), { seg: 10, rz: Math.PI / 2 });
      wh.rotation.y = 0.3;
    }
    for (const sx of [-0.45, 0.45]) kit.box(0.08, 0.08, 2.2, 'wood', cx + sx + 0.6, cy + 0.55, cz + 2, { ry: 0.3, rx: 0.15 });
    for (let i = 0; i < 3; i++) kit.box(0.55, 0.4, 0.7, 'hay', cx + (i - 1) * 0.15, cy + 1.05, cz + (i - 1) * 0.7, { ry: 0.3 });
    kit.solidBox(1.7, 2.8, cx, cz, cy, cy + 1.5, 0.3);

    // vegetable patch with a scarecrow
    const vx = -14, vz = 2;
    for (let r = 0; r < 6; r++) {
      const z = vz - 4 + r * 1.5;
      kit.box(7, 0.18, 0.8, 'dirt', vx, kit.groundAt(vx, z) - 0.05, z);
      for (let i = 0; i < 8; i++) {
        const x = vx - 3 + i * 0.85;
        const crop = r % 3 === 0 ? 0x7da04a : r % 3 === 1 ? 0x4f7a34 : 0xa0b45a;
        kit.ball(0.22 + (i % 2) * 0.06, crop, x, kit.groundAt(x, z) + 0.3, z);
      }
    }
    const sy = kit.groundAt(vx, vz + 0.75);
    kit.box(0.1, 2.2, 0.1, 'wood', vx, sy, vz + 0.75);
    kit.box(1.5, 0.08, 0.08, 'wood', vx, sy + 1.6, vz + 0.75);
    kit.box(0.5, 0.8, 0.3, 0x6b5b3a, vx, sy + 1.15, vz + 0.75);
    kit.ball(0.22, 'hay', vx, sy + 2.1, vz + 0.75);
    kit.cone(0.35, 0.4, 0x5b4a2a, vx, sy + 2.25, vz + 0.75, { seg: 6 });
    kit.box(1.1, 0.06, 0.06, 'black', vx - 0.95, sy + 1.62, vz + 0.75);

    // geese wandering about the yard
    const geese = [];
    for (let i = 0; i < 5; i++) {
      const g = goose(kit, -3 + i * 0.9, 12 + (i % 2) * 0.8, i * 1.3);
      kit.dynamic(g);
      geese.push({ g, x: g.position.x, z: g.position.z, seed: i * 2.1 });
    }
    kit.animate((t) => {
      for (const q of geese) {
        const a = t * 0.15 + q.seed;
        const x = q.x + Math.sin(a) * 2.5, z = q.z + Math.sin(a * 1.7) * 1.5;
        q.g.position.set(x, kit.groundAt(x, z), z);
        q.g.rotation.y = Math.atan2(Math.cos(a) * 2.5, Math.cos(a * 1.7) * 2.55);
      }
    });

    kit.info({
      id: place.id, name: place.name, kind: place.kind, description: place.description,
      radius: 24, labelHeight: house.origin.y - kit.origin.y + H + 5, color: '#8cc06f',
    });
    // clicking either building shows the farm
    house.group.userData.location = kit.mainLocation;
    barn.group.userData.location = kit.mainLocation;
  },
};
