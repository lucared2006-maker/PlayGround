// Canvas map renderer with Voronoi provinces, pan/zoom and touch support.
import { TERRAIN, RELIGIONS, CULTURES, GOODS, MAP_MODES, TRADE_NODES } from './data/constants.js';
import { toWorld, LAT_MAX, WORLD_W, WORLD_H } from './geo.js';

const OCEAN = '#132630';
const OCEAN_DEEP = '#0c1b23';
const LAND = '#b8ab84';
const INK = '#211c14';

function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function blend(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${Math.round(A[0] + (B[0] - A[0]) * t)},${Math.round(A[1] + (B[1] - A[1]) * t)},${Math.round(A[2] + (B[2] - A[2]) * t)})`;
}
function shade(hex, amt) {
  const c = hexToRgb(hex);
  return `rgb(${Math.max(0, Math.min(255, Math.round(c[0] + amt)))},${Math.max(0, Math.min(255, Math.round(c[1] + amt)))},${Math.max(0, Math.min(255, Math.round(c[2] + amt)))})`;
}

export class MapRenderer {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.state = null;
    this.mode = 'political';
    this.cam = { x: 155, y: 18, zoom: 8 };
    this.selection = null;
    this.hover = null;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dirty = true;
    this.landPath = null;
    this.lakePath = null;
    this.riverPaths = [];
    this.provincePaths = [];
    this.borderPaths = [];
    this.borderHash = '';
    this.labels = true;
    this.pointers = new Map();
    this.pinch = null;
    this.drag = null;
    this.lastTap = 0;
    this.pendingTap = null;
    this.resize();
    this.buildPaths();
    window.addEventListener('resize', () => this.resize());
    this.bindEvents();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.w = w; this.h = h;
    this.dirty = true;
  }

  buildPaths() {
    const land = new Path2D();
    for (const ring of this.world.land) {
      if (ring.length < 3) continue;
      const p = ring[0];
      land.moveTo(p[0] + 180, LAT_MAX - p[1]);
      for (let i = 1; i < ring.length; i++) {
        const q = ring[i];
        land.lineTo(q[0] + 180, LAT_MAX - q[1]);
      }
      land.closePath();
    }
    this.landPath = land;
    const lakes = new Path2D();
    for (const ring of this.world.lakes || []) {
      if (ring.length < 3) continue;
      const p = ring[0];
      lakes.moveTo(p[0] + 180, LAT_MAX - p[1]);
      for (let i = 1; i < ring.length; i++) { const q = ring[i]; lakes.lineTo(q[0] + 180, LAT_MAX - q[1]); }
      lakes.closePath();
    }
    this.lakePath = lakes;
    this.riverPaths = (this.world.rivers || []).map((line) => {
      const p = new Path2D();
      line.forEach((pt, i) => {
        const x = pt[0] + 180, y = LAT_MAX - pt[1];
        if (i === 0) p.moveTo(x, y); else p.lineTo(x, y);
      });
      return p;
    });
    this.provincePaths = this.world.cells.map((poly) => {
      const p = new Path2D();
      if (!poly.length) return p;
      p.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) p.lineTo(poly[i].x, poly[i].y);
      p.closePath();
      return p;
    });
  }

  setState(state) { this.state = state; this.borderHash = ''; this.dirty = true; }
  setMode(mode) { this.mode = mode; this.dirty = true; }
  setSelection(p) { this.selection = p; this.dirty = true; }
  setLabels(v) { this.labels = v; this.dirty = true; }

  worldToScreen(x, y) {
    return { x: (x - this.cam.x) * this.cam.zoom, y: (y - this.cam.y) * this.cam.zoom };
  }
  screenToWorld(sx, sy) {
    return { x: this.cam.x + sx / this.cam.zoom, y: this.cam.y + sy / this.cam.zoom };
  }

  clampCam() {
    const z = this.cam.zoom;
    const visW = this.w / z, visH = this.h / z;
    this.cam.x = Math.max(-10, Math.min(WORLD_W - visW + 10, this.cam.x));
    this.cam.y = Math.max(-10, Math.min(WORLD_H - visH + 10, this.cam.y));
  }

  fitCountry(tag) {
    if (!this.state) return;
    const b = this.world.countryBBox(tag, this.state.provinces);
    if (!isFinite(b.minX)) return;
    this.fitBounds(b.minX, b.minY, b.maxX, b.maxY, 80);
  }

  fitBounds(minX, minY, maxX, maxY, pad = 40) {
    const w = Math.max(4, maxX - minX), h = Math.max(4, maxY - minY);
    const zoom = Math.min((this.w - pad * 2) / w, (this.h - pad * 2) / h);
    this.cam.zoom = Math.max(2.5, Math.min(42, zoom));
    this.cam.x = (minX + maxX) / 2 - this.w / (2 * this.cam.zoom);
    this.cam.y = (minY + maxY) / 2 - this.h / (2 * this.cam.zoom);
    this.clampCam();
    this.dirty = true;
  }

  focusProvince(p) {
    this.cam.x = p.x - this.w / (2 * this.cam.zoom);
    this.cam.y = p.y - this.h / (2 * this.cam.zoom);
    this.clampCam(); this.dirty = true;
  }

  zoomAt(factor, sx, sy) {
    const before = this.screenToWorld(sx, sy);
    this.cam.zoom = Math.max(2.2, Math.min(48, this.cam.zoom * factor));
    const after = this.screenToWorld(sx, sy);
    this.cam.x += before.x - after.x;
    this.cam.y += before.y - after.y;
    this.clampCam();
    this.dirty = true;
  }

  bindEvents() {
    const c = this.canvas;
    const pos = (e) => {
      const r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      const p = pos(e);
      this.pointers.set(e.pointerId, p);
      if (this.pointers.size === 1) {
        this.drag = { sx: p.x, sy: p.y, camX: this.cam.x, camY: this.cam.y, moved: 0, time: Date.now() };
      } else if (this.pointers.size === 2) {
        const pts = [...this.pointers.values()];
        this.pinch = {
          dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
          zoom: this.cam.zoom,
          mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
          worldMid: this.screenToWorld((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2),
        };
        this.drag = null;
      }
    });
    c.addEventListener('pointermove', (e) => {
      const p = pos(e);
      if (!this.pointers.has(e.pointerId)) {
        this.hover = p; return;
      }
      this.pointers.set(e.pointerId, p);
      if (this.pointers.size === 2 && this.pinch) {
        const pts = [...this.pointers.values()];
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        const z = Math.max(2.2, Math.min(48, this.pinch.zoom * (dist / Math.max(1, this.pinch.dist))));
        this.cam.zoom = z;
        this.cam.x = this.pinch.worldMid.x - mid.x / z;
        this.cam.y = this.pinch.worldMid.y - mid.y / z;
        this.clampCam();
        this.dirty = true;
      } else if (this.drag) {
        const dx = p.x - this.drag.sx, dy = p.y - this.drag.sy;
        this.drag.moved = Math.max(this.drag.moved, Math.hypot(dx, dy));
        this.cam.x = this.drag.camX - dx / this.cam.zoom;
        this.cam.y = this.drag.camY - dy / this.cam.zoom;
        this.clampCam();
        this.dirty = true;
      }
    });
    const end = (e) => {
      const p = this.pointers.get(e.pointerId) || pos(e);
      const wasDrag = this.drag;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (wasDrag && wasDrag.moved < 10 && Date.now() - wasDrag.time < 600) {
        const now = Date.now();
        if (now - this.lastTap < 320 && this.pendingTap) {
          // Second tap: cancel the pending selection and zoom instead.
          clearTimeout(this.pendingTap.timer);
          this.pendingTap = null;
          this.zoomAt(1.9, p.x, p.y);
          this.lastTap = 0;
        } else {
          this.lastTap = now;
          const w = this.screenToWorld(p.x, p.y);
          const prov = this.world.provinceAt(w.x, w.y);
          // Delay selection just long enough to recognise a double tap. The
          // province sheet would otherwise cover the map before tap two.
          const tap = { prov, point: { x: p.x, y: p.y } };
          tap.timer = setTimeout(() => {
            if (this.pendingTap !== tap) return;
            this.pendingTap = null;
            this.onSelect?.(prov, tap.point);
          }, 240);
          this.pendingTap = tap;
        }
      }
      if (this.pointers.size === 0) this.drag = null;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = pos(e);
      this.zoomAt(e.deltaY < 0 ? 1.12 : 0.89, p.x, p.y);
    }, { passive: false });
  }

  buildBorders() {
    if (!this.state) return;
    const map = new Map();
    const provinces = this.state.provinces;
    for (const p of provinces) {
      const poly = this.world.cells[p.id];
      if (!poly) continue;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        const ka = `${Math.round(a.x * 20)},${Math.round(a.y * 20)}`;
        const kb = `${Math.round(b.x * 20)},${Math.round(b.y * 20)}`;
        const key = ka < kb ? ka + '|' + kb : kb + '|' + ka;
        let e = map.get(key);
        if (!e) { e = { a, b, owners: new Set() }; map.set(key, e); }
        e.owners.add(p.owner || '-');
      }
    }
    const paths = [];
    for (const e of map.values()) {
      if (e.owners.size > 1) {
        const path = new Path2D();
        path.moveTo(e.a.x, e.a.y); path.lineTo(e.b.x, e.b.y);
        paths.push(path);
      }
    }
    this.borderPaths = paths;
  }

  render() {
    if (!this.dirty) return;
    this.dirty = false;
    const ctx = this.ctx;
    const { w, h, dpr, cam } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // ocean
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, OCEAN);
    g.addColorStop(1, OCEAN_DEEP);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // graticule
    ctx.strokeStyle = 'rgba(160,190,200,0.06)';
    ctx.lineWidth = 1;
    for (let lon = -180; lon <= 180; lon += 20) {
      const x = (lon + 180 - cam.x) * cam.zoom;
      if (x < 0 || x > w) continue;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let lat = -40; lat <= 80; lat += 20) {
      const y = (LAT_MAX - lat - cam.y) * cam.zoom;
      if (y < 0 || y > h) continue;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    ctx.save();
    ctx.setTransform(dpr * cam.zoom, 0, 0, dpr * cam.zoom, -cam.x * cam.zoom * dpr, -cam.y * cam.zoom * dpr);

    // land base
    ctx.fillStyle = LAND;
    ctx.fill(this.landPath);

    if (this.state) {
      ctx.save();
      ctx.clip(this.landPath);
      for (const p of this.state.provinces) {
        const box = this.world.boxes[p.id];
        if (!box) continue;
        const sx = (box.minX - cam.x) * cam.zoom, sy = (box.minY - cam.y) * cam.zoom;
        const ex = (box.maxX - cam.x) * cam.zoom, ey = (box.maxY - cam.y) * cam.zoom;
        if (ex < -10 || ey < -10 || sx > w + 10 || sy > h + 10) continue;
        const col = this.provinceColor(p);
        ctx.fillStyle = col;
        ctx.fill(this.provincePaths[p.id]);
        if (cam.zoom > 3.5) {
          ctx.strokeStyle = 'rgba(30,24,16,0.22)';
          ctx.lineWidth = 0.55 / cam.zoom;
          ctx.stroke(this.provincePaths[p.id]);
        }
      }
      ctx.restore();

      // country borders
      const hash = this.state.provinces.map((p) => p.owner || '-').join(',');
      if (hash !== this.borderHash) { this.borderHash = hash; this.buildBorders(); }
      ctx.strokeStyle = 'rgba(25,20,12,0.85)';
      // World-space widths must be divided by zoom so borders stay thin on screen.
      ctx.lineWidth = 1.5 / cam.zoom;
      for (const path of this.borderPaths) ctx.stroke(path);

      // selection
      if (this.selection) {
        ctx.strokeStyle = '#f2d675';
        ctx.lineWidth = 3 / cam.zoom;
        ctx.stroke(this.provincePaths[this.selection.id]);
      }
    }

    // lakes
    if (this.lakePath) {
      ctx.fillStyle = OCEAN;
      ctx.fill(this.lakePath);
      ctx.strokeStyle = 'rgba(160,200,210,0.35)';
      ctx.lineWidth = 0.8 / cam.zoom;
      ctx.stroke(this.lakePath);
    }
    // rivers
    if (cam.zoom > 3.2) {
      ctx.strokeStyle = 'rgba(70,130,160,0.55)';
      ctx.lineWidth = 1.1 / cam.zoom;
      for (const p of this.riverPaths) ctx.stroke(p);
    }
    // coast
    ctx.strokeStyle = 'rgba(20,30,35,0.8)';
    ctx.lineWidth = 1.2 / cam.zoom;
    ctx.stroke(this.landPath);
    ctx.restore();

    if (this.state) {
      this.drawMarkers(ctx);
      if (this.labels) this.drawLabels(ctx);
    }
  }

  provinceColor(p) {
    const st = this.state;
    const owner = p.owner ? st.countries[p.owner] : null;
    switch (this.mode) {
      case 'terrain': return TERRAIN[p.terrain]?.color || LAND;
      case 'religion': return RELIGIONS[p.religion]?.color || '#888';
      case 'culture': return CULTURES[p.culture]?.color || '#888';
      case 'economy': {
        const dev = p.dev.tax + p.dev.prod + p.dev.mp;
        const t = Math.min(1, dev / 30);
        return `rgb(${Math.round(190 - t * 120)},${Math.round(160 + t * 40)},${Math.round(90 - t * 40)})`;
      }
      case 'military': {
        if (!owner) return '#6a6a5a';
        return blend(shade(owner.color, -30), '#6a2a2a', Math.min(0.5, (p.fort || 0) * 0.15));
      }
      case 'trade': {
        const idx = TRADE_NODES.findIndex((n) => n.id === p.tradeNode);
        const hue = (idx * 47) % 360;
        return `hsl(${hue},35%,55%)`;
      }
      case 'political':
      default:
        if (!owner) return '#7d816c';
        return blend(owner.color, '#c8bb94', 0.22);
    }
  }

  drawMarkers(ctx) {
    const { cam } = this;
    // capitals
    for (const p of this.state.provinces) {
      if (!p.capital || !p.owner) continue;
      const s = this.worldToScreen(p.x, p.y);
      if (s.x < -20 || s.y < -20 || s.x > this.w + 20 || s.y > this.h + 20) continue;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.fillStyle = '#f6e6a8';
      ctx.strokeStyle = 'rgba(20,16,10,0.8)';
      ctx.lineWidth = 1.2;
      const r = cam.zoom > 7 ? 4.5 : 3;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + i * Math.PI / 5;
        const rr = i % 2 === 0 ? r : r * 0.45;
        ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // armies
    if (cam.zoom > 2.8) {
      const byProv = new Map();
      for (const a of this.state.armies) {
        if (a.owner === 'REB') continue;
        if (!byProv.has(a.provinceId)) byProv.set(a.provinceId, []);
        byProv.get(a.provinceId).push(a);
      }
      for (const [pid, stacks] of byProv) {
        const p = this.state.provinces[pid];
        if (!p) continue;
        const s = this.worldToScreen(p.x, p.y);
        if (s.x < -30 || s.y < -30 || s.x > this.w + 30 || s.y > this.h + 30) continue;
        stacks.forEach((a, i) => {
          const men = (a.men.infantry + a.men.cavalry + a.men.archer + a.men.artillery + a.men.mercenary) / 1000;
          if (men < 0.1) return;
          const col = this.state.countries[a.owner]?.color || '#999';
          const r = Math.max(7, Math.min(13, 5 + Math.log2(men + 1) * 2.2));
          const ox = (i % 3) * (r * 1.7) - (Math.min(stacks.length, 3) - 1) * r * 0.85;
          const oy = Math.floor(i / 3) * (r * 1.7);
          ctx.save();
          ctx.translate(s.x + ox, s.y - r - 2 + oy);
          ctx.fillStyle = shade(col, -15);
          ctx.strokeStyle = '#f2e6c8';
          ctx.lineWidth = 1.3;
          ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#fff8e6';
          ctx.font = `700 ${Math.max(7, r * 0.95)}px Georgia, serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(`${men.toFixed(1)}k`, 0, 0.5);
          ctx.restore();
        });
      }
      // rebels
      for (const a of this.state.armies.filter((x) => x.owner === 'REB')) {
        const p = this.state.provinces[a.provinceId];
        if (!p) continue;
        const s = this.worldToScreen(p.x, p.y);
        if (s.x < -20 || s.y < -20 || s.x > this.w + 20 || s.y > this.h + 20) continue;
        ctx.save();
        ctx.fillStyle = '#2b1b1b';
        ctx.strokeStyle = '#d8b06a';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(s.x, s.y - 8, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e8c87a';
        ctx.font = '700 9px Georgia, serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('REB', s.x, s.y - 7.5);
        ctx.restore();
      }
    }
    // navies
    for (const n of this.state.navies) {
      const p = this.state.provinces[n.provinceId];
      if (!p) continue;
      const s = this.worldToScreen(p.x, p.y);
      if (s.x < -20 || s.y < -20 || s.x > this.w + 20 || s.y > this.h + 20) continue;
      const count = n.ships.galley + n.ships.cog + n.ships.caravel;
      if (!count) continue;
      ctx.save();
      ctx.translate(s.x + 10, s.y + 8);
      ctx.fillStyle = 'rgba(20,30,40,0.85)';
      ctx.strokeStyle = '#9cc8d8';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#cfe8f0';
      ctx.font = '700 7px Georgia, serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(count), 0, 0.5);
      ctx.restore();
    }
  }

  drawLabels(ctx) {
    const { cam } = this;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Keep a simple screen-space collision list. Country names get priority,
    // then province names, so dense regions stay readable on a phone.
    const occupied = [];
    const fits = (x, y, width, height) => {
      const r = { l: x - width / 2 - 3, r: x + width / 2 + 3, t: y - height / 2 - 2, b: y + height / 2 + 2 };
      if (r.l < 0 || r.t < 0 || r.r > this.w || r.b > this.h) return false;
      return !occupied.some((o) => !(r.r < o.l || r.l > o.r || r.b < o.t || r.t > o.b));
    };
    const reserve = (x, y, width, height) => {
      occupied.push({ l: x - width / 2 - 3, r: x + width / 2 + 3, t: y - height / 2 - 2, b: y + height / 2 + 2 });
    };

    // country labels
    if (cam.zoom >= 3.2) {
      const done = new Set();
      for (const p of this.state.provinces) {
        if (!p.capital || !p.owner || done.has(p.owner)) continue;
        done.add(p.owner);
        const c = this.state.countries[p.owner];
        if (!c) continue;
        const s = this.worldToScreen(p.x, p.y);
        if (s.x < 20 || s.y < 20 || s.x > this.w - 20 || s.y > this.h - 20) continue;
        const size = Math.max(8, Math.min(14, cam.zoom * 0.6));
        const text = c.name.toUpperCase();
        ctx.font = `700 ${size}px Georgia, serif`;
        const tw = ctx.measureText(text).width;
        const ty = s.y - size - 6;
        if (!fits(s.x, ty, tw, size)) continue;
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(235,225,195,0.72)';
        ctx.strokeText(text, s.x, ty);
        ctx.fillStyle = 'rgba(32,26,18,0.92)';
        ctx.fillText(text, s.x, ty);
        reserve(s.x, ty, tw, size);
      }
    }

    // province labels
    if (cam.zoom >= 12) {
      ctx.font = `${Math.max(7, Math.min(11, 6 + cam.zoom * 0.13))}px Georgia, serif`;
      ctx.fillStyle = 'rgba(30,24,14,0.72)';
      for (const p of this.state.provinces) {
        const s = this.worldToScreen(p.x, p.y);
        if (s.x < 10 || s.y < 10 || s.x > this.w - 10 || s.y > this.h - 10) continue;
        if (p.capital) continue;
        const tw = ctx.measureText(p.name).width;
        if (!fits(s.x, s.y + 1, tw, 10)) continue;
        ctx.fillText(p.name, s.x, s.y + 1);
        reserve(s.x, s.y + 1, tw, 10);
      }
    }

    // trade node labels
    if (this.mode === 'trade' && cam.zoom >= 2.5) {
      ctx.font = '600 10px Georgia, serif';
      for (const n of TRADE_NODES) {
        const w = toWorld(n.lon, n.lat);
        const s = this.worldToScreen(w.x, w.y);
        if (s.x < 0 || s.y < 0 || s.x > this.w || s.y > this.h) continue;
        const tw = ctx.measureText(n.name).width;
        if (!fits(s.x, s.y - 10, tw, 12)) continue;
        ctx.fillStyle = 'rgba(20,30,35,0.75)';
        ctx.fillRect(s.x - 4, s.y - 4, 8, 8);
        ctx.fillStyle = '#f0e0b0';
        ctx.fillText(n.name, s.x, s.y - 10);
        reserve(s.x, s.y - 10, tw, 12);
      }
    }
  }

  hitTest(sx, sy) {
    const w = this.screenToWorld(sx, sy);
    return this.world.provinceAt(w.x, w.y);
  }
}
