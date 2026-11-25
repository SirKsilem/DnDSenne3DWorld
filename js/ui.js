// HUD: info panel, interaction prompt, coordinates readout, start/pause overlay and minimap.

import * as THREE from 'three';
import { WORLD_SIZE, WATER_LEVEL, heightAt, terrainColor } from './terrain.js';
import { TYPES } from './locations.js';

const $ = (id) => document.getElementById(id);
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export class UI {
  constructor(worldName) {
    this.message = $('message');
    this.prompt = $('prompt');
    this.info = $('info');
    this.overlay = $('overlay');
    this.coords = $('coords');
    this.openLocation = null;
    document.title = worldName;
    $('world-name').textContent = worldName;
    if (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) {
      $('touch-note').hidden = false;
    }
  }

  hideMessage() { this.message.hidden = true; }

  showError(err) {
    this.message.hidden = false;
    this.message.className = 'error';
    this.message.replaceChildren();
    const strong = document.createElement('strong');
    strong.textContent = 'The world failed to load.';
    const detail = document.createElement('p');
    detail.textContent = err?.message ?? String(err);
    const hint = document.createElement('p');
    hint.textContent = 'Check data/locations.json for typos (a missing comma or quote is the usual culprit) and the browser console (F12) for details.';
    this.message.append(strong, detail, hint);
  }

  setPrompt(loc) {
    if (loc && !this.openLocation) {
      this.prompt.textContent = '';
      const kbd = document.createElement('kbd');
      kbd.textContent = 'E';
      this.prompt.append(kbd, ` Read about ${loc.name}`);
      this.prompt.hidden = false;
    } else {
      this.prompt.hidden = true;
    }
  }

  showInfo(loc) {
    this.openLocation = loc;
    $('info-type').textContent = loc.subtitle ?? TYPES[loc.type].label;
    $('info-name').textContent = loc.name;
    const desc = $('info-desc');
    desc.replaceChildren();
    // Blank lines in the description start a new paragraph.
    for (const para of String(loc.description || 'No description yet.').split(/\n\s*\n/)) {
      const p = document.createElement('p');
      p.textContent = para.trim();
      desc.append(p);
    }
    this.info.hidden = false;
    this.prompt.hidden = true;
  }

  hideInfo() {
    this.openLocation = null;
    this.info.hidden = true;
  }

  setOverlay(visible) { this.overlay.hidden = !visible; }

  buildTravelList(locations, onPick) {
    const wrap = $('travel');
    wrap.replaceChildren();
    for (const loc of locations) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = loc.name;
      b.style.setProperty('--accent', TYPES[loc.type].color);
      b.addEventListener('click', () => onPick(loc));
      wrap.append(b);
    }
  }

  // Shows where you are — handy for finding x/z values when adding locations.
  setCoords(pos, dir) {
    const deg = (THREE.MathUtils.radToDeg(Math.atan2(dir.x, -dir.z)) + 360) % 360;
    const heading = COMPASS[Math.round(deg / 45) % 8];
    this.coords.textContent = `x ${Math.round(pos.x)}  z ${Math.round(pos.z)}  ·  ${heading}`;
  }
}

export class Minimap {
  constructor(canvas, locations, lakes) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.locations = locations;
    this.lakes = lakes;
    this.big = false;
    this.base = this.renderBase(220);
  }

  toggle() {
    this.big = !this.big;
    this.canvas.classList.toggle('big', this.big);
  }

  // Pre-render the terrain once: colours plus simple hill shading.
  renderBase(N) {
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(N, N);
    const col = new THREE.Color(), rgb = { r: 0, g: 0, b: 0 };
    const water = new THREE.Color(0x3d7fa3);
    const step = WORLD_SIZE / N;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = -WORLD_SIZE / 2 + (i + 0.5) * step;
        const z = -WORLD_SIZE / 2 + (j + 0.5) * step;
        const h = heightAt(x, z);
        if (h < WATER_LEVEL) col.copy(water);
        else terrainColor(x, z, col);
        col.getRGB(rgb, THREE.SRGBColorSpace);
        const shade = h < WATER_LEVEL ? 1 : THREE.MathUtils.clamp(1 + (heightAt(x - step, z - step) - h) * 0.12, 0.6, 1.3);
        const o = (j * N + i) * 4;
        img.data[o] = Math.min(255, rgb.r * 255 * shade);
        img.data[o + 1] = Math.min(255, rgb.g * 255 * shade);
        img.data[o + 2] = Math.min(255, rgb.b * 255 * shade);
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  draw(pos, dir) {
    const { ctx, canvas } = this;
    const S = canvas.width;
    const k = S / WORLD_SIZE;
    const toMap = (v) => (v + WORLD_SIZE / 2) * k;

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.base, 0, 0, S, S);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    if (this.big) {
      ctx.font = 'italic 14px "EB Garamond", Georgia, serif';
      ctx.fillStyle = 'rgba(230, 245, 255, 0.9)';
      for (const l of this.lakes) if (l.name) ctx.fillText(l.name, toMap(l.x), toMap(l.z) + 5);
    }

    for (const loc of this.locations) {
      const x = toMap(loc.x), y = toMap(loc.z);
      ctx.beginPath();
      ctx.arc(x, y, this.big ? 7 : 12, 0, Math.PI * 2);
      ctx.fillStyle = TYPES[loc.type].color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#1b1712';
      ctx.stroke();
      if (this.big) {
        ctx.font = '600 13px Cinzel, Georgia, serif';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(20, 16, 12, 0.85)';
        ctx.strokeText(loc.name, x, y - 9);
        ctx.fillStyle = '#f4ead5';
        ctx.fillText(loc.name, x, y - 9);
      }
    }

    // Player arrow (north is up, so the arrow points along the camera's x/z direction).
    const px = toMap(pos.x), py = toMap(pos.z);
    const a = Math.atan2(dir.z, dir.x);
    const r = this.big ? 9 : 14;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.7, r * 0.6);
    ctx.lineTo(-r * 0.35, 0);
    ctx.lineTo(-r * 0.7, -r * 0.6);
    ctx.closePath();
    ctx.fillStyle = '#ff4d3a';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.restore();
  }
}
