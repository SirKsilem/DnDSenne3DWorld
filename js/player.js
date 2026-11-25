// First-person walking: mouse look (pointer lock), WASD, run, jump,
// following the terrain and bumping into buildings, trees and rocks.

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { heightAt, WATER_LEVEL, WORLD_SIZE } from './terrain.js';

const EYE_HEIGHT = 1.7;
const WALK_SPEED = 6;    // m/s
const RUN_SPEED = 14;
const JUMP_SPEED = 7;
const GRAVITY = 22;
const BODY_RADIUS = 0.45;

const UP = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _wish = new THREE.Vector3();

export class Player {
  constructor(camera, domElement, colliders) {
    this.camera = camera;
    this.colliders = colliders;
    this.controls = new PointerLockControls(camera, domElement);
    this.velocity = new THREE.Vector3();
    this.keys = new Set();
    this.touchMove = { x: 0, y: 0, run: false }; // set by the on-screen joystick (js/touch.js)
    this.touchJump = false;
    this.onGround = false;

    addEventListener('keydown', (e) => this.keys.add(e.code));
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    this.controls.addEventListener('unlock', () => this.keys.clear());
  }

  get position() { return this.camera.position; }

  // Feet never go deeper than ~1 m under water, so lakes are wadeable rather than a trap.
  groundAt(x, z) {
    return Math.max(heightAt(x, z), WATER_LEVEL - 1.1) + EYE_HEIGHT;
  }

  teleport(x, z, lookAtX, lookAtZ) {
    const y = this.groundAt(x, z);
    this.camera.position.set(x, y, z);
    this.velocity.set(0, 0, 0);
    if (lookAtX !== undefined) this.camera.lookAt(lookAtX, y, lookAtZ);
  }

  update(dt) {
    const k = this.keys;
    const t = this.touchMove;
    const forward = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) + t.y;
    const strafe = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + t.x;

    this.camera.getWorldDirection(_fwd);
    _fwd.y = 0;
    _fwd.normalize();
    _right.crossVectors(_fwd, UP);
    _wish.set(0, 0, 0).addScaledVector(_fwd, forward).addScaledVector(_right, strafe);
    if (_wish.lengthSq() > 1) _wish.normalize(); // keys give full speed; a half-pushed joystick walks slower

    const pos = this.camera.position;
    let speed = k.has('ShiftLeft') || k.has('ShiftRight') || t.run ? RUN_SPEED : WALK_SPEED;
    if (heightAt(pos.x, pos.z) < WATER_LEVEL - 0.6) speed *= 0.45; // wading

    const accel = 1 - Math.exp(-(this.onGround ? 12 : 3) * dt);
    this.velocity.x += (_wish.x * speed - this.velocity.x) * accel;
    this.velocity.z += (_wish.z * speed - this.velocity.z) * accel;
    if ((k.has('Space') || this.touchJump) && this.onGround) {
      this.velocity.y = JUMP_SPEED;
      this.onGround = false;
    }
    this.velocity.y -= GRAVITY * dt;
    pos.addScaledVector(this.velocity, dt);

    // Push out of any collision circle we walked into.
    for (const c of this.colliders) {
      const dx = pos.x - c.x, dz = pos.z - c.z, min = c.r + BODY_RADIUS;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min) {
        const d = Math.sqrt(d2) || 0.0001;
        pos.x = c.x + (dx / d) * min;
        pos.z = c.z + (dz / d) * min;
      }
    }

    const limit = WORLD_SIZE / 2 - 4;
    pos.x = THREE.MathUtils.clamp(pos.x, -limit, limit);
    pos.z = THREE.MathUtils.clamp(pos.z, -limit, limit);

    const ground = this.groundAt(pos.x, pos.z);
    // Snap to the ground when landing, or when walking downhill (so we don't "bounce" down slopes).
    if (pos.y <= ground || (this.velocity.y <= 0 && pos.y - ground < 0.5)) {
      pos.y = ground;
      this.velocity.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
  }
}
