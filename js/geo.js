// Geometry: loads Natural Earth coastlines, builds Voronoi province cells,
// adjacency, ports and hit-testing helpers.

export const LAT_MAX = 84;
export const LAT_MIN = -60;
export const WORLD_W = 360;
export const WORLD_H = LAT_MAX - LAT_MIN;

export const toWorld = (lon, lat) => ({ x: lon + 180, y: LAT_MAX - lat });
export const toLonLat = (x, y) => ({ lon: x - 180, lat: LAT_MAX - y });

let geoCache = null;
export async function loadGeo() {
  if (geoCache) return geoCache;
  const res = await fetch('assets/geo.json');
  geoCache = await res.json();
  return geoCache;
}

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function bboxOf(ring) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of ring) {
    if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
  }
  return { minX, minY, maxX, maxY };
}

function buildLandIndex(rawRings) {
  const CELL = 8;
  const grid = new Map();
  // Convert Natural Earth lon/lat rings into world pixels (0..360, 0..144).
  const rings = rawRings.map((ring) => ring.map(([lon, lat]) => [lon + 180, LAT_MAX - lat]));
  const boxes = rings.map(bboxOf);
  rings.forEach((ring, i) => {
    const b = boxes[i];
    const x0 = Math.floor(b.minX / CELL), x1 = Math.floor(b.maxX / CELL);
    const y0 = Math.floor(b.minY / CELL), y1 = Math.floor(b.maxY / CELL);
    for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
      const k = gx + ',' + gy;
      let arr = grid.get(k); if (!arr) { arr = []; grid.set(k, arr); }
      arr.push(i);
    }
  });
  return {
    pointInLand(x, y) {
      const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
      const arr = grid.get(gx + ',' + gy);
      if (!arr) return false;
      for (const i of arr) {
        const b = boxes[i];
        if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) continue;
        if (pointInRing(x, y, rings[i])) return true;
      }
      return false;
    },
    boxes,
  };
}

// Sutherland–Hodgman clipping of polygon by a·x + b·y <= c.
function clipPoly(poly, a, b, c) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const dp = a * p.x + b * p.y - c;
    const dq = a * q.x + b * q.y - c;
    if (dp <= 1e-9) out.push(p);
    if ((dp < -1e-9 && dq > 1e-9) || (dp > 1e-9 && dq < -1e-9)) {
      const t = dp / (dp - dq);
      out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    }
  }
  return out;
}

function polyArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    a += p.x * q.y - q.x * p.y;
  }
  return Math.abs(a / 2);
}

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToPolyEdge(x, y, poly) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((x - a.x) * dx + (y - a.y) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + dx * t, py = a.y + dy * t;
    const d = Math.hypot(x - px, y - py);
    if (d < best) best = d;
  }
  return best;
}

function inOrOnPoly(x, y, poly, eps = 1e-6) {
  return pointInPoly(x, y, poly) || distToPolyEdge(x, y, poly) <= eps;
}

function simplifyPoly(poly, tol = 0.02) {
  if (poly.length < 8) return poly;
  const keep = [poly[0]];
  let last = poly[0];
  for (let i = 1; i < poly.length; i++) {
    const p = poly[i];
    if (Math.hypot(p.x - last.x, p.y - last.y) > tol) { keep.push(p); last = p; }
  }
  return keep;
}

export function buildWorld(geo, provinces) {
  const seeds = provinces.map((p) => ({ ...toWorld(p.lon, p.lat), id: p.id }));
  const land = geo.land;
  const landIndex = buildLandIndex(land);
  const pointInLand = landIndex.pointInLand;

  const cells = new Array(seeds.length);
  const boxes = new Array(seeds.length);
  const R = { x0: 0, x1: WORLD_W, y0: 0, y1: WORLD_H };
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    let poly = [
      { x: R.x0, y: R.y0 }, { x: R.x1, y: R.y0 },
      { x: R.x1, y: R.y1 }, { x: R.x0, y: R.y1 },
    ];
    for (let j = 0; j < seeds.length; j++) {
      if (i === j) continue;
      const o = seeds[j];
      // Clip against every seed. Skipping distant seeds can leave a cell
      // extending across the world and painting over unrelated provinces.
      const a = 2 * (o.x - s.x), b = 2 * (o.y - s.y);
      const c = o.x * o.x + o.y * o.y - s.x * s.x - s.y * s.y;
      poly = clipPoly(poly, a, b, c);
      if (poly.length < 3) break;
    }
    poly = simplifyPoly(poly, 0.025);
    cells[i] = poly;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of poly) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    boxes[i] = { minX, minY, maxX, maxY };
  }

  // adjacency via shared Voronoi boundaries (midpoint inside both cells)
  for (const p of provinces) { p.neighbors = []; p.seaNeighbors = []; p.port = false; }
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    for (let j = i + 1; j < seeds.length; j++) {
      const o = seeds[j];
      const dx = o.x - s.x, dy = o.y - s.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 16) continue;
      const bi = boxes[i], bj = boxes[j];
      if (bi.maxX < bj.minX || bj.maxX < bi.minX || bi.maxY < bj.minY || bj.maxY < bi.minY) continue;
      const mx = (s.x + o.x) / 2, my = (s.y + o.y) / 2;
      if (!inOrOnPoly(mx, my, cells[i]) || !inOrOnPoly(mx, my, cells[j])) continue;
      // check whether the shared boundary is land or sea
      const samples = [
        [mx, my], [mx + (s.x - mx) * 0.45, my + (s.y - my) * 0.45],
        [mx + (o.x - mx) * 0.45, my + (o.y - my) * 0.45],
      ];
      let landCount = 0;
      for (const [x, y] of samples) if (pointInLand(x, y)) landCount++;
      const a = provinces[i], b = provinces[j];
      if (landCount >= 2) {
        a.neighbors.push(b.id); b.neighbors.push(a.id);
      } else if (dist < 18) {
        a.seaNeighbors.push(b.id); b.seaNeighbors.push(a.id);
      }
    }
  }

  // ports: any nearby water
  for (const p of provinces) {
    const s = toWorld(p.lon, p.lat);
    let port = false;
    for (const r of [0.5, 1.1]) {
      for (let k = 0; k < 12; k++) {
        const ang = (k / 12) * Math.PI * 2;
        if (!pointInLand(s.x + Math.cos(ang) * r, s.y + Math.sin(ang) * r)) { port = true; break; }
      }
      if (port) break;
    }
    p.port = port;
    p.x = s.x; p.y = s.y;
  }

  return {
    cells, boxes, seeds, land, lakes: geo.lakes, rivers: geo.rivers,
    pointInLand, pointInPoly, landIndex,
    provinceAt(x, y) {
      if (!pointInLand(x, y)) return null;
      let best = null, bd = Infinity;
      for (const s of seeds) {
        const d = (s.x - x) * (s.x - x) + (s.y - y) * (s.y - y);
        if (d < bd) { bd = d; best = s; }
      }
      return best ? provinces[best.id] : null;
    },
    bboxOfProvince(p) { return boxes[p.id]; },
    countryBBox(tag, provinces) {
      let b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
      for (const p of provinces) if (p.owner === tag) {
        b.minX = Math.min(b.minX, p.x); b.maxX = Math.max(b.maxX, p.x);
        b.minY = Math.min(b.minY, p.y); b.maxY = Math.max(b.maxY, p.y);
      }
      return b;
    },
  };
}

export function ringToPoints(ring) {
  return ring.map(([lon, lat]) => toWorld(lon, lat));
}

// BFS path over land/sea graph.
export function findPath(provinces, fromId, toId, opts = {}) {
  const { allowSea = true, canEnter = () => true } = opts;
  if (fromId === toId) return [fromId];
  const prev = new Map();
  const q = [fromId];
  prev.set(fromId, null);
  while (q.length) {
    const cur = q.shift();
    const p = provinces[cur];
    if (!p) continue;
    const links = allowSea ? [...p.neighbors, ...p.seaNeighbors] : p.neighbors;
    for (const n of links) {
      if (prev.has(n)) continue;
      if (!canEnter(n)) continue;
      prev.set(n, cur);
      if (n === toId) {
        const path = [n];
        let c = cur;
        while (c !== null) { path.push(c); c = prev.get(c); }
        return path.reverse();
      }
      q.push(n);
    }
  }
  return null;
}
