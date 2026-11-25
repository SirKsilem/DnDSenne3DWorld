// A fixed pool of point lights that follows the player.
//
// Places register as many light sources as they like (fires, forges, candles, lanterns),
// but only the POOL_SIZE nearest ones are actually lit. Keeping the number of real lights
// constant avoids shader recompiles and keeps phones fast.

import * as THREE from 'three';

export class LightPool {
  constructor(scene, size = 6) {
    this.slots = [];
    this.lights = [];
    for (let i = 0; i < size; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 10, 2);
      l.castShadow = false;
      scene.add(l);
      this.lights.push(l);
    }
    this.timer = 0;
    this.active = [];
  }

  /** color, intensity (candela-ish, ~5 for a candle, ~40 for a hearth), distance in metres, flicker 0..1 */
  add({ x, y, z, color = 0xffaa55, intensity = 20, distance = 12, flicker = 0 }) {
    const slot = { x, y, z, color: new THREE.Color(color), intensity, distance, flicker, seed: Math.random() * 100 };
    this.slots.push(slot);
    return slot;
  }

  update(cam, t, dt) {
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0.3;
      const near = [];
      for (const s of this.slots) {
        const d = (s.x - cam.x) ** 2 + (s.y - cam.y) ** 2 + (s.z - cam.z) ** 2;
        if (d < 60 * 60) near.push([d, s]);
      }
      near.sort((a, b) => a[0] - b[0]);
      this.active = near.slice(0, this.lights.length).map((n) => n[1]);
    }
    this.lights.forEach((l, i) => {
      const s = this.active[i];
      if (!s) { l.intensity = 0; return; }
      l.position.set(s.x, s.y, s.z);
      l.color.copy(s.color);
      l.distance = s.distance;
      const f = s.flicker ? 1 + s.flicker * (Math.sin(t * 13 + s.seed) * 0.12 + Math.sin(t * 7.7 + s.seed * 2) * 0.08) : 1;
      l.intensity = s.intensity * f;
    });
  }
}
