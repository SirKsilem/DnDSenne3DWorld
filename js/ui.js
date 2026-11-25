// HUD: info panel, interaction prompt, compass/coordinates, start/pause overlay and minimap.

import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export class UI {
  constructor(worldName, subtitle) {
    this.message = $('message');
    this.prompt = $('prompt');
    this.info = $('info');
    this.overlay = $('overlay');
    this.coords = $('coords');
    this.openLocation = null;
    this.touch = false;
    this.north = [0, -1]; // world direction of north (x, z)
    document.title = worldName;
    $('world-name').textContent = worldName;
    if (subtitle) document.querySelector('#overlay .subtitle').textContent = subtitle;
  }

  setTouchMode(touch) {
    this.touch = touch;
    this.promptFor = null;
    document.body.classList.toggle('is-touch', touch);
    $('start').textContent = touch ? 'Tap to explore' : 'Click to explore';
  }

  setLoading(text) {
    this.message.hidden = false;
    this.message.textContent = text;
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
    hint.textContent = 'Check data/holmstead/places.json for typos (a missing comma or quote is the usual culprit) and the browser console (F12) for details.';
    this.message.append(strong, detail, hint);
  }

  setPrompt(loc) {
    // On touch screens the prompt is itself a button you tap.
    const show = loc && !this.openLocation;
    if (show && this.promptFor !== loc) {
      this.prompt.replaceChildren();
      if (this.touch) {
        this.prompt.append(`📜 Read about ${loc.name}`);
      } else {
        const kbd = document.createElement('kbd');
        kbd.textContent = 'E';
        this.prompt.append(kbd, ` Read about ${loc.name}`);
      }
    }
    this.promptFor = show ? loc : null;
    this.prompt.hidden = !show;
  }

  showInfo(loc) {
    this.openLocation = loc;
    $('info-type').textContent = loc.kind ?? '';
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
      b.style.setProperty('--accent', loc.color ?? '#e0b866');
      b.addEventListener('click', () => onPick(loc));
      wrap.append(b);
    }
  }

  // Where you are and which way you face — handy for placing new locations.
  setCoords(pos, dir) {
    const [nx, nz] = this.north;
    const ex = -nz, ez = nx; // east is 90° clockwise from north, seen from above
    const deg = (THREE.MathUtils.radToDeg(Math.atan2(dir.x * ex + dir.z * ez, dir.x * nx + dir.z * nz)) + 360) % 360;
    const heading = COMPASS[Math.round(deg / 45) % 8];
    this.coords.textContent = `x ${Math.round(pos.x)}  z ${Math.round(pos.z)}  ·  ${heading}`;
  }
}

/** The campaign map itself, with a "you are here" arrow. */
export class Minimap {
  constructor(canvas, image, bounds, locations) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.image = image;
    this.bounds = bounds;
    this.locations = locations;
    this.big = false;
    canvas.width = 640;
    canvas.height = Math.round((640 * image.height) / image.width);
    canvas.style.aspectRatio = `${image.width} / ${image.height}`;
  }

  toggle() {
    this.big = !this.big;
    this.canvas.classList.toggle('big', this.big);
  }

  draw(pos, dir) {
    const { ctx, canvas } = this;
    const [x0, z0, x1, z1] = this.bounds;
    const W = canvas.width, H = canvas.height;
    const mx = (x) => ((x - x0) / (x1 - x0)) * W;
    const mz = (z) => ((z - z0) / (z1 - z0)) * H;

    if (this.big) {
      ctx.drawImage(this.image, 0, 0, W, H);
    } else {
      // zoomed in around you: a 360 m window
      const span = 360, sx = (span / (x1 - x0)) * this.image.width, sy = (span / (z1 - z0)) * this.image.height;
      const cx = ((pos.x - x0) / (x1 - x0)) * this.image.width, cy = ((pos.z - z0) / (z1 - z0)) * this.image.height;
      ctx.fillStyle = '#cfc6b8';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(this.image, cx - sx / 2, cy - sy / 2, sx, sy, 0, 0, W, H);
    }
    const toMap = this.big
      ? (x, z) => [mx(x), mz(z)]
      : (x, z) => [W / 2 + ((x - pos.x) / 360) * W, H / 2 + ((z - pos.z) / 360) * H];

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    for (const loc of this.locations) {
      if (loc.district) continue;
      const [x, y] = toMap(loc.x, loc.z);
      if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
      ctx.beginPath();
      ctx.arc(x, y, this.big ? 6 : 9, 0, Math.PI * 2);
      ctx.fillStyle = loc.color ?? '#e0b866';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#1b1712';
      ctx.stroke();
      ctx.font = `600 ${this.big ? 13 : 20}px Cinzel, Georgia, serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(20, 16, 12, 0.85)';
      ctx.strokeText(loc.name, x, y - 10);
      ctx.fillStyle = '#f4ead5';
      ctx.fillText(loc.name, x, y - 10);
    }

    const [px, py] = toMap(pos.x, pos.z);
    const a = Math.atan2(dir.z, dir.x);
    const r = this.big ? 10 : 18;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.7, r * 0.6);
    ctx.lineTo(-r * 0.35, 0);
    ctx.lineTo(-r * 0.7, -r * 0.6);
    ctx.closePath();
    ctx.fillStyle = '#e0412c';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.restore();
  }
}
