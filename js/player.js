// First-person walking: mouse look (pointer lock) or touch, WASD, run, jump.
// Uses js/engine/physics.js for ground, floors, stairs, decks and walls.

import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { WATER_LEVEL } from './world/terrain.js';

const EYE_HEIGHT = 1.7;
const BODY_HEIGHT = 1.8;
const WALK_SPEED = 5;    // m/s
const RUN_SPEED = 12;
const JUMP_SPEED = 6.5;
const GRAVITY = 22;
const BODY_RADIUS = 0.35;
const STEP = 0.5;        // you can walk up ledges this high

const UP = new THREE.Vector3(0, 1, 0);
const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _wish = new THREE.Vector3();

export class Player {
  constructor(camera, domElement, physics, bounds) {
    this.camera = camera;
    this.physics = physics;
    this.bounds = bounds; // [minX, minZ, maxX, maxZ]
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

  teleport(x, z, lookAtX, lookAtZ) {
    const feet = this.physics.ground(x, z, 1e6);
    this.camera.position.set(x, feet + EYE_HEIGHT, z);
    this.velocity.set(0, 0, 0);
    this.onGround = true;
    if (lookAtX !== undefined) this.camera.lookAt(lookAtX, feet + EYE_HEIGHT, lookAtZ);
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
    const feet = pos.y - EYE_HEIGHT;
    let speed = k.has('ShiftLeft') || k.has('ShiftRight') || t.run ? RUN_SPEED : WALK_SPEED;
    const swimming = feet < WATER_LEVEL - 0.6;
    if (swimming) speed *= 0.45;

    const accel = 1 - Math.exp(-(this.onGround || swimming ? 12 : 3) * dt);
    this.velocity.x += (_wish.x * speed - this.velocity.x) * accel;
    this.velocity.z += (_wish.z * speed - this.velocity.z) * accel;
    if ((k.has('Space') || this.touchJump) && (this.onGround || swimming)) {
      this.velocity.y = swimming ? 4 : JUMP_SPEED;
      this.onGround = false;
    }

    pos.x += this.velocity.x * dt;
    pos.z += this.velocity.z * dt;
    this.physics.collide(pos, feet, BODY_HEIGHT, BODY_RADIUS, STEP);
    const [x0, z0, x1, z1] = this.bounds;
    pos.x = THREE.MathUtils.clamp(pos.x, x0, x1);
    pos.z = THREE.MathUtils.clamp(pos.z, z0, z1);

    // Vertical: gravity, floors and ceilings.
    const ground = this.physics.ground(pos.x, pos.z, feet, STEP);
    const ceiling = this.physics.ceiling(pos.x, pos.z, feet, STEP);
    this.velocity.y -= GRAVITY * dt;
    let next = feet + this.velocity.y * dt;
    if (next + BODY_HEIGHT > ceiling) { next = ceiling - BODY_HEIGHT; this.velocity.y = Math.min(this.velocity.y, 0); }
    // Land, or stick to the floor when walking down stairs and slopes.
    if (next <= ground || (this.onGround && this.velocity.y <= 0 && next - ground < 0.6)) {
      next = ground;
      this.velocity.y = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }
    pos.y = next + EYE_HEIGHT;
  }
}
