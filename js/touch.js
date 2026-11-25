// Touch controls for phones and tablets:
//  - left side of the screen: a joystick appears under your thumb; drag to walk,
//    drag past the ring to run
//  - right side: drag to look around, tap a building to read about it
//  - Jump button bottom-right

import * as THREE from 'three';

const LOOK_SPEED = 0.005;   // radians per pixel dragged
const STICK_RADIUS = 56;    // px, must match #joystick size in style.css
const RUN_DISTANCE = 1.5;   // drag this many radii from the centre to run
const TAP_TIME = 300;       // ms: shorter than this and barely moved = a tap
const TAP_MOVE = 12;        // px

/**
 * Decide whether to show touch controls. Phones and tablets have a "coarse" (finger)
 * primary pointer; laptops with touchscreens still count as desktop.
 * Add ?touch or ?desktop to the URL to force a mode.
 */
export function detectTouch() {
  const params = new URLSearchParams(location.search);
  if (params.has('touch')) return true;
  if (params.has('desktop')) return false;
  if (matchMedia('(pointer: coarse)').matches) return true;
  return navigator.maxTouchPoints > 0 && !matchMedia('(any-pointer: fine)').matches;
}

export class TouchControls {
  constructor({ area, joystick, stick, jumpButton, camera, player, onTap }) {
    this.area = area;
    this.joystick = joystick;
    this.stick = stick;
    this.camera = camera;
    this.player = player;
    this.onTap = onTap;
    this.moveTouch = null;
    this.lookTouch = null;
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');

    area.addEventListener('pointerdown', (e) => this.down(e));
    addEventListener('pointermove', (e) => this.drag(e));
    addEventListener('pointerup', (e) => this.up(e));
    addEventListener('pointercancel', (e) => this.up(e, true));
    area.addEventListener('contextmenu', (e) => e.preventDefault());

    const jump = (on) => (e) => { e.preventDefault(); player.touchJump = on; };
    jumpButton.addEventListener('pointerdown', jump(true));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) jumpButton.addEventListener(ev, jump(false));
  }

  down(e) {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    // A new finger always takes over, so a touch whose "lift" event got lost can't leave
    // the joystick stuck walking or the look-drag blocking taps.
    if (e.clientX < innerWidth * 0.45) {
      if (this.moveTouch) this.releaseStick();
      this.moveTouch = { id: e.pointerId, x: e.clientX, y: e.clientY };
      this.joystick.style.left = `${e.clientX}px`;
      this.joystick.style.top = `${e.clientY}px`;
      this.joystick.style.bottom = 'auto';
      this.joystick.classList.add('active');
    } else {
      this.lookTouch = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, time: e.timeStamp };
    }
  }

  drag(e) {
    const m = this.moveTouch, l = this.lookTouch;
    if (m && m.id === e.pointerId) {
      const dx = e.clientX - m.x, dy = e.clientY - m.y;
      const dist = Math.hypot(dx, dy);
      const k = dist > 0 ? Math.min(dist, STICK_RADIUS) / dist : 0;
      this.stick.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
      const run = dist > STICK_RADIUS * RUN_DISTANCE;
      this.joystick.classList.toggle('running', run);
      Object.assign(this.player.touchMove, { x: (dx * k) / STICK_RADIUS, y: (-dy * k) / STICK_RADIUS, run });
    } else if (l && l.id === e.pointerId) {
      this.euler.setFromQuaternion(this.camera.quaternion);
      this.euler.y -= (e.clientX - l.x) * LOOK_SPEED;
      this.euler.x -= (e.clientY - l.y) * LOOK_SPEED;
      this.euler.x = THREE.MathUtils.clamp(this.euler.x, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
      this.camera.quaternion.setFromEuler(this.euler);
      l.x = e.clientX;
      l.y = e.clientY;
    }
  }

  up(e, cancelled = false) {
    if (this.moveTouch && this.moveTouch.id === e.pointerId) this.releaseStick();
    const l = this.lookTouch;
    if (l && l.id === e.pointerId) {
      this.lookTouch = null;
      // Event timestamps are when the finger touched/lifted, so slow frames don't turn taps into drags.
      const isTap = e.timeStamp - l.time < TAP_TIME && Math.hypot(e.clientX - l.startX, e.clientY - l.startY) < TAP_MOVE;
      if (isTap && !cancelled) this.onTap(e.clientX, e.clientY);
    }
  }

  releaseStick() {
    this.moveTouch = null;
    this.stick.style.transform = '';
    this.joystick.classList.remove('active', 'running');
    this.joystick.style.left = this.joystick.style.top = this.joystick.style.bottom = '';
    Object.assign(this.player.touchMove, { x: 0, y: 0, run: false });
  }

  /** Drop all touches (e.g. when pausing) so the player doesn't keep walking. */
  reset() {
    this.releaseStick();
    this.lookTouch = null;
    this.player.touchJump = false;
  }
}
