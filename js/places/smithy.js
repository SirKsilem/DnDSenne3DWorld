// Hammerfall Forge (B5): a stone-and-timber smithy with an open front, so the forge glow
// shows from the street. Walkable inside: forge, bellows, anvil, quench trough, grindstone,
// weapon racks, armour stand, tools and a workbench.

const BRICK = 0x8a4a35;
const LEATHER = 0x6b3f22;
const STEEL = 0xb8bcc2;

export default {
  build(kit, place) {
    const W = Math.min(Math.max(place.w, 10), 18);
    const D = Math.min(Math.max(place.d, 9), 14);
    const H = 4.4;
    const hw = W / 2, hd = D / 2;

    // Shell: stone walls, a wide open front between two timber posts.
    kit.room({
      w: W, d: D, h: H, wall: 'stone', floor: 0x5a4a3a, base: 'darkStone',
      doors: { front: [{ at: 0, w: W - 3, h: 3.6 }] },
      windows: { left: [{ at: -1.5 }, { at: 1.5 }], right: [{ at: 0 }] },
      roof: 'gable', roofColor: 'slate', ceiling: true, ceilingColor: 'wood',
    });
    // timber framing on the outside: corner posts, a beam over the opening, a band under the eaves
    for (const sx of [-1, 1]) {
      kit.box(0.45, H, 0.45, 'timber', sx * (hw - 1.3), 0, hd + 0.05);
      kit.box(0.4, H, 0.4, 'timber', sx * hw, 0, hd);
      kit.box(0.4, H, 0.4, 'timber', sx * hw, 0, -hd);
    }
    kit.box(W - 2.2, 0.5, 0.5, 'timber', 0, 3.6, hd + 0.05);
    for (const sx of [-1, 1]) kit.box(0.25, 0.3, D, 'timber', sx * (hw + 0.12), H - 0.4, 0);
    kit.box(W, 0.3, 0.25, 'timber', 0, H - 0.4, -hd - 0.12);

    // Forge: brick hearth against the back wall, left side, with a hood and a tall chimney.
    const fx = -hw + 2.4, fz = -hd + 1.5;
    kit.box(3, 1, 2, BRICK, fx, 0, fz, { solid: true });
    kit.box(3.2, 0.12, 2.2, 'darkStone', fx, 1, fz);
    const coals = kit.box(2.2, 0.16, 1.3, kit.mat(0xff6a20, { emissive: 0xff4a00, emissiveIntensity: 1.6 }), fx, 1.05, fz);
    kit.dynamic(coals);
    for (let i = 0; i < 7; i++) {
      kit.ball(0.12 + (i % 3) * 0.04, 'black', fx - 0.9 + i * 0.3, 1.2, fz + ((i * 37) % 5 - 2) * 0.2);
    }
    const flame = kit.cone(0.35, 0.7, kit.mat(0xffb040, { emissive: 0xff7a00, emissiveIntensity: 2.2 }), fx, 1.15, fz, { seg: 6, shadow: false });
    kit.dynamic(flame);
    const hood = kit.cone(2.1, 1.6, BRICK, fx, 2.4, fz, { seg: 4, ry: Math.PI / 4 });
    hood.scale.set(2.1, 1.6, 1.6);
    kit.box(1.1, H - 3.9 + 0.2, 1.1, BRICK, fx, 3.9, fz);
    kit.box(1.2, 8, 1.2, BRICK, fx, H, fz);             // chimney through the roof
    kit.box(1.5, 0.3, 1.5, 'darkStone', fx, H + 8, fz);
    kit.light(fx, 1.8, fz + 0.8, { color: 0xff7a2a, intensity: 45, distance: 15, flicker: 1 });
    kit.animate((t) => {
      const f = 1 + Math.sin(t * 11) * 0.15 + Math.sin(t * 6.3) * 0.1;
      coals.material.emissiveIntensity = 1.4 * f;
      flame.scale.set(0.35 * (2 - f), 0.7 * f, 0.35 * (2 - f));
    });

    // A lantern hanging from the beams over the middle of the shop.
    kit.box(0.04, 0.8, 0.04, 'iron', 1, H - 1.05, 0.5);
    kit.box(0.35, 0.45, 0.35, kit.mat(0xffd27a, { emissive: 0xffa040, emissiveIntensity: 1.2 }), 1, H - 1.5, 0.5, { shadow: false });
    kit.cone(0.3, 0.25, 'iron', 1, H - 1.05, 0.5, { seg: 4 });
    kit.light(1, H - 1.6, 0.5, { color: 0xffc070, intensity: 16, distance: 12, flicker: 0.3 });

    // Bellows beside the forge, pointing at the fire.
    const bx = fx + 2.3, bz = fz + 0.2;
    const bel = kit.box(1.5, 0.45, 0.9, LEATHER, bx, 0.75, bz, { ry: 0.25 });
    bel.rotation.z = 0.12;
    kit.box(1.6, 0.08, 1, 'darkWood', bx, 0.7, bz, { ry: 0.25 });
    kit.box(1.6, 0.08, 1, 'darkWood', bx, 1.22, bz, { ry: 0.25 });
    kit.cyl(0.05, 0.05, 1.2, 'darkWood', bx + 0.6, 1.25, bz - 0.15, { seg: 4, rz: Math.PI / 2 });
    kit.box(0.15, 0.75, 0.15, 'darkWood', bx - 0.5, 0, bz);
    kit.box(0.15, 0.75, 0.15, 'darkWood', bx + 0.5, 0, bz);
    kit.solidBox(1.7, 1.1, bx, bz, 0, 1.3, 0.25);

    // Anvil on a stump, hammer and tongs.
    const ax = fx + 1.2, az = fz + 3.2;
    kit.cyl(0.42, 0.48, 0.55, 'wood', ax, 0, az, { seg: 8 });
    kit.box(0.35, 0.25, 0.3, 'iron', ax, 0.55, az);
    kit.box(0.9, 0.18, 0.34, 'iron', ax, 0.8, az);
    kit.cone(0.14, 0.45, 'iron', ax + 0.45, 0.89, az, { seg: 6, rz: -Math.PI / 2 });
    kit.box(0.08, 0.06, 0.45, 'darkWood', ax - 0.1, 0.99, az + 0.05, { ry: 0.4 });
    kit.box(0.18, 0.12, 0.12, 'iron', ax - 0.18, 0.98, az - 0.15, { ry: 0.4 });
    kit.box(0.04, 0.04, 0.6, 'iron', ax + 0.15, 0.99, az + 0.1, { ry: -0.5 });
    kit.circle(ax, az, 0.6, { y0: 0, y1: 1.1 });

    // Quench trough with water, by the left wall.
    const qx = -hw + 1, qz = fz + 3.3;
    kit.box(0.8, 0.7, 1.8, 'wood', qx, 0, qz, { solid: true });
    kit.box(0.6, 0.05, 1.6, kit.mat(0x3d6670), qx, 0.62, qz);

    // Grindstone on its frame, front right.
    const gx = hw - 2, gz = hd - 2.2;
    kit.box(0.12, 0.7, 1, 'darkWood', gx - 0.25, 0, gz);
    kit.box(0.12, 0.7, 1, 'darkWood', gx + 0.25, 0, gz);
    const wheel = kit.cyl(0.5, 0.5, 0.18, 'paleStone', gx - 0.09, 0.85, gz, { seg: 10, rz: Math.PI / 2 });
    wheel.position.y = 0.85;
    kit.cyl(0.04, 0.04, 0.9, 'iron', gx - 0.45, 0.85, gz, { seg: 4, rz: Math.PI / 2 });
    kit.solidBox(0.9, 1.2, gx, gz, 0, 1.3);

    // Weapon racks on the right wall: swords, axes and spears.
    const rx = hw - 0.45;
    for (const rz of [-hd + 1.6, -hd + 4]) {
      kit.box(0.2, 0.15, 2, 'darkWood', rx, 0.4, rz);
      kit.box(0.2, 0.15, 2, 'darkWood', rx, 1.7, rz);
      for (const e of [-0.95, 0.95]) kit.box(0.15, 1.9, 0.15, 'darkWood', rx, 0, rz + e);
      for (let i = 0; i < 5; i++) {
        const z = rz - 0.8 + i * 0.4;
        if (i % 2 === 0) {
          kit.box(0.04, 1.1, 0.08, STEEL, rx - 0.12, 0.5, z);               // blade
          kit.box(0.05, 0.06, 0.32, 'bronze', rx - 0.12, 1.55, z);          // crossguard
          kit.box(0.05, 0.25, 0.05, LEATHER, rx - 0.12, 1.6, z);            // grip
        } else {
          kit.cyl(0.03, 0.03, 1.5, 'wood', rx - 0.12, 0.3, z, { seg: 4 });  // axe haft
          kit.box(0.04, 0.3, 0.3, STEEL, rx - 0.12, 1.55, z + 0.12);        // axe head
        }
      }
    }
    for (let i = 0; i < 4; i++) {
      const z = -hd + 5.6 + i * 0.3;
      kit.cyl(0.03, 0.03, 2.6, 'wood', rx - 0.1, 0, z, { seg: 4, rz: 0.06 });
      kit.cone(0.06, 0.3, STEEL, rx - 0.1 + 0.16, 2.58, z, { seg: 4 });
    }
    kit.solidBox(0.6, 6.4, rx - 0.1, -hd + 3.6, 0, 2.6);

    // Armour stand with a mail shirt and helm.
    const sx2 = hw - 2.2, sz2 = -hd + 1.4;
    kit.box(0.6, 0.08, 0.6, 'darkWood', sx2, 0, sz2);
    kit.cyl(0.05, 0.05, 1.3, 'darkWood', sx2, 0.08, sz2, { seg: 4 });
    kit.box(0.62, 0.75, 0.34, kit.mat(0x7f858c), sx2, 0.85, sz2);
    kit.box(0.9, 0.16, 0.36, kit.mat(0x7f858c), sx2, 1.45, sz2);
    kit.ball(0.2, 'iron', sx2, 1.85, sz2, { detail: 1 });
    kit.box(0.5, 0.06, 0.5, 'iron', sx2, 1.72, sz2);
    kit.circle(sx2, sz2, 0.45, { y0: 0, y1: 2 });

    // Horseshoes, tongs and hammers hanging on the back wall.
    for (let i = 0; i < 8; i++) {
      const x = fx + 2 + i * 0.35, y = 2.2 + (i % 2) * 0.35;
      kit.box(0.2, 0.22, 0.05, 'iron', x, y, -hd + 0.25);
      kit.box(0.04, 0.15, 0.05, 'iron', x, y + 0.22, -hd + 0.25);
    }
    for (let i = 0; i < 4; i++) {
      kit.box(0.05, 0.7, 0.05, 'darkWood', fx + 5.2 + i * 0.4, 1.7, -hd + 0.25);
      kit.box(0.22, 0.12, 0.1, 'iron', fx + 5.2 + i * 0.4, 2.35, -hd + 0.25);
    }

    // Coal heap and a workbench with tools.
    for (let i = 0; i < 9; i++) {
      kit.ball(0.35 - (i % 3) * 0.06, 'black', -hw + 1 + (i % 3) * 0.45, 0.15 + Math.floor(i / 3) * 0.2, -hd + 3.6 + ((i * 13) % 4) * 0.12);
    }
    kit.circle(-hw + 1.4, -hd + 3.8, 0.9, { y0: 0, y1: 0.8 });
    const wx = 0.4, wz = -hd + 0.9;
    kit.box(2.4, 0.15, 0.9, 'wood', wx, 0.85, wz);
    for (const ex of [-1.05, 1.05]) for (const ez of [-0.35, 0.35]) kit.box(0.12, 0.85, 0.12, 'darkWood', wx + ex, 0, wz + ez);
    kit.box(0.5, 0.1, 0.3, 'iron', wx - 0.6, 1, wz);
    kit.box(0.08, 0.06, 0.5, 'wood', wx + 0.2, 1, wz, { ry: 0.6 });
    kit.box(0.4, 0.25, 0.3, 'iron', wx + 0.8, 1, wz - 0.1);
    kit.solidBox(2.5, 1, wx, wz, 0, 1.1);

    // Outside: hanging sign with an anvil, a barrel and a hitching rail.
    const sgx = hw - 0.6, sgz = hd + 1.3;
    kit.box(0.15, 0.15, 1.5, 'darkWood', sgx, 3.4, hd + 0.6);
    kit.box(0.04, 0.4, 0.04, 'iron', sgx, 3, sgz - 0.5);
    kit.box(0.04, 0.4, 0.04, 'iron', sgx, 3, sgz + 0.3);
    kit.box(0.1, 0.9, 1.2, 'wood', sgx, 2.2, sgz - 0.1);
    kit.box(0.14, 0.15, 0.7, 'iron', sgx, 2.55, sgz - 0.1);
    kit.box(0.14, 0.2, 0.25, 'iron', sgx, 2.35, sgz - 0.1);
    kit.box(0.14, 0.1, 0.5, 'iron', sgx, 2.28, sgz - 0.1);
    kit.cyl(0.4, 0.4, 1, 'wood', -hw + 0.6, 0, hd + 1, { seg: 8, solid: true });
    kit.box(0.12, 0.12, 2.6, 'darkWood', -hw - 1.4, 1, hd - 1.8);
    for (const ez of [-1.2, 1.2]) kit.box(0.15, 1.1, 0.15, 'darkWood', -hw - 1.4, 0, hd - 1.8 + ez);
    kit.solidBox(0.3, 2.6, -hw - 1.4, hd - 1.8, 0, 1.1);

    kit.info({
      id: place.id, name: place.name, kind: place.kind, description: place.description,
      radius: Math.max(W, D) / 2 + 6, labelHeight: H + Math.min(W, D) * 0.45 + 2.5, color: '#e9845f',
    });
  },
};

