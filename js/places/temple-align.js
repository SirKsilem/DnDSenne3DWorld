// Helper for the temple and the shrine: both are long buildings entered from a short end.
// If the place frame has its long side at the front, build in a turned frame instead so the
// long axis runs along z, with the entrance at whichever short end faces the most open street.

import { Kit } from '../engine/kit.js';

export function longAxisFrame(kit, place, ctx) {
  const w = place.w ?? 12, d = place.d ?? 12;
  if (d >= w) return { k: kit, w, d, own: false };
  const a = kit.origin.angle;
  const ux = Math.cos(a), uz = -Math.sin(a);   // local +x of the original frame, in world
  const px = Math.sin(a), pz = Math.cos(a);    // local +z
  const open = (sign) => {
    let n = 0;
    for (const s of [2, 5, 9, 13]) {
      for (const t of [-0.3, 0, 0.3]) {
        const x = kit.origin.x + sign * ux * (w / 2 + s) + px * t * d;
        const z = kit.origin.z + sign * uz * (w / 2 + s) + pz * t * d;
        if (!ctx.buildingAt?.(x, z)) n++;
      }
    }
    return n;
  };
  const delta = open(1) >= open(-1) ? Math.PI / 2 : -Math.PI / 2;
  const k = new Kit(ctx, { ...kit.origin, angle: a + delta });
  return { k, w: d, d: w, own: true };
}

/** Finish a frame made by longAxisFrame (the original kit is finalized by main.js). */
export function finishFrame(frame, ctx) {
  if (!frame.own) return;
  frame.k.finalize();
  ctx.clickables.push(frame.k.group);
}
