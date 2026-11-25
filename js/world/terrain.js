// Terrain from the height grid made by tools/extract_map.py, textured with ground.jpg
// (streets, fields, roads and grass painted from the original map).

import * as THREE from 'three';

export const WATER_LEVEL = 0;

export async function loadHeightmap(url, meta) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status}).`);
  const data = new Int16Array(await res.arrayBuffer());
  const { cols, rows, cell, x0, z0, scale } = meta;

  function sample(i, j) { return data[j * cols + i] * scale; }

  /** Ground height at world (x, z), smoothly interpolated. */
  function heightAt(x, z) {
    let fx = (x - x0) / cell, fz = (z - z0) / cell;
    fx = Math.min(Math.max(fx, 0), cols - 1.001);
    fz = Math.min(Math.max(fz, 0), rows - 1.001);
    const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j;
    const a = data[j * cols + i], b = data[j * cols + i + 1];
    const c = data[(j + 1) * cols + i], d = data[(j + 1) * cols + i + 1];
    return ((a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz) * scale;
  }
  return { heightAt, sample, meta };
}

/** Terrain mesh; `step` = how many height cells per triangle (bigger = fewer triangles). */
export function createTerrain(hm, texture, bounds, step = 2) {
  const { cols, rows, cell, x0, z0 } = hm.meta;
  const nx = Math.floor((cols - 1) / step) + 1;
  const nz = Math.floor((rows - 1) / step) + 1;
  const pos = new Float32Array(nx * nz * 3);
  const uv = new Float32Array(nx * nz * 2);
  const [bx0, bz0, bx1, bz1] = bounds;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      const x = x0 + i * step * cell, z = z0 + j * step * cell;
      pos[k * 3] = x;
      pos[k * 3 + 1] = hm.sample(i * step, j * step);
      pos[k * 3 + 2] = z;
      uv[k * 2] = (x - bx0) / (bx1 - bx0);
      uv[k * 2 + 1] = 1 - (z - bz0) / (bz1 - bz0);
    }
  }
  const index = [];
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: texture }));
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

export function createWater(bounds) {
  const [x0, z0, x1, z1] = bounds;
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(x1 - x0, z1 - z0),
    new THREE.MeshPhongMaterial({ color: 0x3d6670, specular: 0x6f8f99, shininess: 60, transparent: true, opacity: 0.88 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set((x0 + x1) / 2, WATER_LEVEL, (z0 + z1) / 2);
  water.receiveShadow = true;
  water.name = 'water';
  return water;
}

/** Grass all around the edge of the map, out to the horizon. */
export function createOuterGround(bounds, y = 1.5) {
  const [x0, z0, x1, z1] = bounds;
  const F = 4000;
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x5f8040 });
  const rect = (ax, az, bx, bz) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(bx - ax, bz - az), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((ax + bx) / 2, y, (az + bz) / 2);
    g.add(m);
  };
  rect(x0 - F, z0 - F, x1 + F, z0);
  rect(x0 - F, z1, x1 + F, z1 + F);
  rect(x0 - F, z0, x0, z1);
  rect(x1, z0, x1 + F, z1);
  return g;
}
