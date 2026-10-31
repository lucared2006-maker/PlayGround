// Application bootstrap, campaign lifecycle, save system and game loop.
import { loadGeo, buildWorld } from './geo.js';
import { PROVINCE_DATA } from './data/provinces.js';
import { createGame, dateShort } from './engine/state.js';
import { advanceDay, playerRank } from './engine/sim.js';
import { orderMove, orderNavy } from './engine/military.js';
import { MapRenderer } from './map.js';
import { UI } from './ui.js';

const SAVE_PREFIX = 'europa1444.save.';
const META_PREFIX = 'europa1444.meta.';
const SLOTS = ['auto', '1', '2', '3'];

const app = {
  state: null,
  preview: null,
  world: null,
  baseProvinces: null,
  map: null,
  ui: null,
  lastFrame: 0,
  acc: 0,
};

window.__europa = app;

function freshProvinces() {
  return PROVINCE_DATA.map((row) => {
    const [name, lon, lat, terrain, good, tax, prod, mp, owner, culture, religion, opts = {}] = row;
    return {
      ...opts, name, lon, lat, terrain, good,
      dev: { tax, prod, mp }, owner, culture, religion,
    };
  });
}

function hasStorage() {
  try {
    const k = '__europa_test__';
    localStorage.setItem(k, '1');
    localStorage.removeItem(k);
    return true;
  } catch { return false; }
}

function readMeta(slot) {
  try { return JSON.parse(localStorage.getItem(META_PREFIX + slot) || 'null'); } catch { return null; }
}

function storageAvailable() { return hasStorage(); }

app.hasAnySave = () => SLOTS.some((s) => readMeta(s));
app.getSaveMeta = (slot) => readMeta(slot);
app.playerRank = () => (app.state ? playerRank(app.state) : { rank: 0, total: 0 });

app.beginCampaign = (tag, difficulty = 'normal') => {
  if (!tag) { app.ui?.showToast('Choose a realm first.', 'war'); return; }
  // Clone the boot provinces so every campaign keeps the geometry metadata
  // (centres, neighbours, ports) that buildWorld attached to them.
  const provinces = structuredClone(app.baseProvinces || freshProvinces());
  const state = createGame({
    playerTag: tag,
    provinces,
    difficulty,
    seed: (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0,
  });
  app.state = state;
  state.paused = true;
  state.speed = 1;
  app.map.setState(state);
  app.map.setLabels(state.settings.labels !== false);
  app.map.setSelection(state.provinces[state.countries[tag].capital]);
  app.map.fitCountry(tag);
  app.map.dirty = true;
  app.ui.resetForGame();
  app.lastFrame = performance.now();
  app.acc = 0;
  const c = state.countries[tag];
  app.ui.showToast(`${c.name} — ${c.ruler.title} ${c.ruler.name}. The year is 1444.`, 'good');
  app.ui.refresh(true);
};

app.continueCampaign = () => {
  if (readMeta('auto')) app.loadGame('auto');
  else if (readMeta('1')) app.loadGame('1');
  else app.ui?.showToast('No saved campaign found.', 'war');
};

app.setSpeed = (n) => {
  const st = app.state;
  if (!st || st.gameOver) return;
  st.paused = n === 0;
  if (n > 0) st.speed = n;
  app.acc = 0;
  app.lastFrame = performance.now();
  app.ui?.refresh(true);
};

app.setMapMode = (mode) => {
  if (!app.map) return;
  app.map.setMode(mode);
  app.ui?.refresh(true);
};

app.saveGame = (slot = '1') => {
  const st = app.state;
  if (!st) return { ok: false, msg: 'No campaign to save.' };
  if (!storageAvailable()) {
    app.ui?.showToast('Local storage is unavailable in this browser.', 'war');
    return { ok: false, msg: 'Storage unavailable.' };
  }
  try {
    const json = JSON.stringify(st, (key, value) => (key === 'flagsData' ? undefined : value));
    localStorage.setItem(SAVE_PREFIX + slot, json);
    const c = st.countries[st.playerTag];
    localStorage.setItem(META_PREFIX + slot, JSON.stringify({
      date: dateShort(st.date), name: c?.name || 'Unknown', tag: st.playerTag,
      year: st.date.y, score: c?.score || 0, ts: Date.now(),
      bytes: json.length,
    }));
    if (slot !== 'auto') app.ui?.showToast(`Campaign saved to ${slot === 'auto' ? 'autosave' : 'slot ' + slot}.`, 'good');
    if (app.ui?.panelTab === 'more') app.ui.renderPanel(true);
    return { ok: true };
  } catch (err) {
    console.error('Save failed', err);
    app.ui?.showToast('Save failed: storage is full. Delete a slot or export your campaign.', 'war');
    return { ok: false, msg: String(err) };
  }
};

app.autosave = () => {
  if (app.state?.settings?.autosave !== false) app.saveGame('auto');
};

function applyLoadedState(data) {
  if (!data || typeof data !== 'object' || !data.countries || !data.provinces || !data.playerTag) {
    throw new Error('This file is not a valid Europa 1444 campaign.');
  }
  if (!data.countries[data.playerTag]) throw new Error('The saved player realm is missing.');
  data.paused = true;
  data.pendingPeace = data.pendingPeace || null;
  data.pendingEvent = data.pendingEvent || null;
  data.notifications = data.notifications || [];
  data.settings = data.settings || { autosave: true, labels: true, animations: true };
  data.coalitions = data.coalitions || [];
  // Older saves may predate geometry metadata on provinces. Restore it from
  // the boot world so pathfinding, labels and markers keep working.
  if (app.baseProvinces) {
    for (const p of data.provinces) {
      const base = app.baseProvinces[p.id];
      if (!base) continue;
      p.x = base.x; p.y = base.y;
      p.neighbors = Array.isArray(p.neighbors) ? p.neighbors : base.neighbors.slice();
      p.seaNeighbors = Array.isArray(p.seaNeighbors) ? p.seaNeighbors : base.seaNeighbors.slice();
      p.port = typeof p.port === 'boolean' ? p.port : base.port;
    }
  }
  app.state = data;
  app.map.setState(data);
  app.map.setLabels(data.settings.labels !== false);
  const cap = data.provinces[data.countries[data.playerTag].capital];
  if (cap) app.map.setSelection(cap);
  app.map.fitCountry(data.playerTag);
  app.map.dirty = true;
  app.ui.resetForGame();
  app.ui.lastMonthKey = '';
  app.lastFrame = performance.now();
  app.acc = 0;
  app.ui.showToast(`Campaign loaded — ${dateShort(data.date)}.`, 'good');
  app.ui.refresh(true);
}

app.loadGame = (slot = 'auto') => {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_PREFIX + slot); } catch { raw = null; }
  if (!raw) { app.ui?.showToast('That save slot is empty.', 'war'); return { ok: false, msg: 'Empty slot.' }; }
  try {
    applyLoadedState(JSON.parse(raw));
    app.ui?.closeModal();
    return { ok: true };
  } catch (err) {
    console.error('Load failed', err);
    app.ui?.showToast(`Load failed: ${err.message}`, 'war');
    return { ok: false, msg: String(err) };
  }
};

app.deleteSave = (slot) => {
  if (!slot) return;
  if (!window.confirm(`Delete ${slot === 'auto' ? 'the autosave' : 'save slot ' + slot}?`)) return;
  try {
    localStorage.removeItem(SAVE_PREFIX + slot);
    localStorage.removeItem(META_PREFIX + slot);
    app.ui?.showToast('Save deleted.', 'good');
    if (app.ui?.panelTab === 'more') app.ui.renderPanel(true);
    if (app.ui && !app.ui.el.start.classList.contains('hidden')) app.ui.renderStart();
  } catch (err) { console.error(err); }
};

app.exportGame = () => {
  const st = app.state;
  if (!st) return;
  const json = JSON.stringify(st, (key, value) => (key === 'flagsData' ? undefined : value));
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const c = st.countries[st.playerTag];
  a.href = url;
  a.download = `europa1444-${(c?.tag || 'save')}-${st.date.y}-${String(st.date.m).padStart(2, '0')}-${String(st.date.d).padStart(2, '0')}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  app.ui?.showToast('Campaign exported as JSON.', 'good');
};

app.importGame = async (file) => {
  if (!file) return;
  try {
    const text = await file.text();
    applyLoadedState(JSON.parse(text));
    app.ui?.closeModal();
  } catch (err) {
    console.error('Import failed', err);
    app.ui?.showToast(`Import failed: ${err.message}`, 'war');
  }
};

app.toStartScreen = () => {
  if (app.state && !app.state.gameOver) {
    const ok = window.confirm('Return to the main menu? Unsaved progress will be lost.');
    if (!ok) return;
  }
  app.state = null;
  app.ui?.closeModal();
  app.ui?.closeSheet();
  app.ui?.closePanel();
  app.map.setState(app.preview);
  app.map.setSelection(null);
  app.map.setLabels(true);
  app.map.fitBounds(168, 20, 222, 52);
  app.map.dirty = true;
  app.ui?.renderStart();
  app.ui?.refresh(true);
};

app.onSelectProvince = (prov) => {
  const ui = app.ui;
  if (!ui) return;
  const onStart = !ui.el.start.classList.contains('hidden');
  if (onStart) {
    if (prov?.owner) ui.selectStartCountry(prov.owner, false);
    return;
  }
  if (!app.state) return;
  // The world hit-test returns boot/preview province objects; resolve the id
  // against the live campaign so the sheet and actions use current data.
  prov = app.state.provinces[prov?.id] || prov;
  if (ui.armyTarget) {
    const army = ui.armyTarget;
    const res = orderMove(app.state, army, prov.id);
    ui.showToast(res.msg, res.ok ? 'good' : 'war');
    ui.clearTarget();
    app.map.setSelection(prov);
    app.map.dirty = true;
    ui.refresh(true);
    return;
  }
  if (ui.navyTarget) {
    const navy = ui.navyTarget;
    const res = orderNavy(app.state, navy, prov.id);
    ui.showToast(res.msg, res.ok ? 'good' : 'war');
    ui.clearTarget();
    app.map.setSelection(prov);
    app.map.dirty = true;
    ui.refresh(true);
    return;
  }
  if (!prov) { ui.closeSheet(); app.map.setSelection(null); return; }
  app.map.setSelection(prov);
  ui.openProvince(prov);
};

function tickLoop(now) {
  const st = app.state;
  const ui = app.ui;
  const dt = Math.min(300, now - (app.lastFrame || now));
  app.lastFrame = now;
  if (st && !st.paused && !st.gameOver && !st.pendingEvent && !st.pendingPeace && !(ui && ui.modalKind)) {
    const dps = [0, 1.6, 3.2, 6.5, 13][st.speed || 1] || 1.6;
    app.acc += (dt / 1000) * dps;
    let steps = Math.min(32, Math.floor(app.acc));
    if (steps > 0) {
      app.acc -= steps;
      for (let i = 0; i < steps; i++) {
        advanceDay(st);
        if (st.pendingEvent || st.pendingPeace || st.gameOver) break;
      }
      app.map.dirty = true;
      if (st.flags.autosaveDue && st.settings.autosave) {
        st.flags.autosaveDue = false;
        app.saveGame('auto');
      }
      ui?.refresh();
    }
  } else {
    app.acc = 0;
  }
  app.map?.render();
  requestAnimationFrame(tickLoop);
}

async function boot() {
  const loaderSub = document.getElementById('loader-sub');
  try {
    if (loaderSub) loaderSub.textContent = 'Drawing the map of the known world…';
    const geo = await loadGeo();
    const provinces = freshProvinces();
    provinces.forEach((p, i) => { p.id = i; });
    app.world = buildWorld(geo, provinces);
    app.baseProvinces = structuredClone(provinces);
    const canvas = document.getElementById('map');
    app.map = new MapRenderer(canvas, app.world);
    app.map.onSelect = (prov) => app.onSelectProvince(prov);
    app.preview = createGame({ playerTag: null, provinces: structuredClone(app.baseProvinces), difficulty: 'normal', seed: 1444 });
    app.map.setState(app.preview);
    app.map.fitBounds(168, 20, 222, 52);
    app.map.setLabels(true);
    app.map.dirty = true;

    app.ui = new UI(app);
    app.ui.renderStart();
    if (!storageAvailable() && app.ui.el.continueBtn) app.ui.el.continueBtn.disabled = true;

    document.getElementById('loading')?.classList.add('hidden');
    app.lastFrame = performance.now();
    requestAnimationFrame(tickLoop);
    console.info(`Europa 1444 ready: ${Object.keys(app.preview.countries).length} realms, ${provinces.length} provinces.`);
  } catch (err) {
    console.error(err);
    if (loaderSub) loaderSub.textContent = `Failed to start: ${err.message}`;
  }
}

document.addEventListener('change', (e) => {
  if (e.target?.id === 'import-file') {
    app.importGame(e.target.files?.[0]);
    e.target.value = '';
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && app.state && !app.state.paused) {
    app.state.paused = true;
    app.ui?.refresh(true);
  }
});

window.addEventListener('beforeunload', () => {
  if (app.state && app.state.settings?.autosave) {
    try { app.autosave(); } catch { /* ignore */ }
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker registration failed', err));
  });
}

boot();
