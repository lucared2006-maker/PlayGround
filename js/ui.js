// Touch-first user interface: HUD, province sheets, realm panels and modals.
import {
  RELIGIONS, CULTURES, GOODS, TERRAIN, BUILDINGS, UNIT_TYPES, SHIP_TYPES,
  TECH_COST, TECH_NAMES, GOVERNMENTS, REFORMS, LAWS, ESTATES, TRADE_NODES,
  MAP_MODES, DIFFICULTY, AI_PERSONALITIES,
} from './data/constants.js';
import {
  MONTHS, dateShort, dateNum, ownedProvinces, totalDev, armyMen, navyShips,
  countryArmies, countryNavy, relation, warsOf, isAtWar, sideOf, warScore,
  religiousUnity, controlledProvinces, expenseBreakdown,
} from './engine/state.js';
import {
  neighborTags, diploStatus, evaluatePeace, peaceCost, canDeclareWar,
  improveRelations, royalMarriage, formAlliance, breakAlliance, guarantee,
  militaryAccess, tradeAgreement, fabricateClaim, declareWar, annexVassal,
} from './engine/diplomacy.js';
import {
  recruit, buildShip, splitArmy, mergeArmies, disbandArmy, totalArmyMen, navalStrength,
} from './engine/military.js';
import {
  researchTech, embraceInstitution, takeLoan, repayLoan, increaseStability,
  startColony, declareIndependence, playerPeace, acceptPendingPeace, declinePendingPeace,
} from './engine/sim.js';
import {
  developProvince, startConstruction, startConversion, acceptCulture, enactReform,
  enactLaw, estateAction,
} from './engine/state.js';
import { chooseEvent } from './engine/events.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, d = 1) => (Number.isFinite(+v) ? (+v).toFixed(d) : '0');
const int = (v) => Math.round(+v || 0).toLocaleString('en-US');
const signed = (v, d = 1) => `${+v >= 0 ? '+' : ''}${num(v, d)}`;
const pct = (v) => `${Math.round(+v || 0)}%`;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function menText(men) {
  const total = men.infantry + men.cavalry + men.archer + men.artillery + men.mercenary;
  if (total >= 1000) return `${(total / 1000).toFixed(total >= 10000 ? 0 : 1)}k`;
  return String(total);
}
function compText(men) {
  const bits = [];
  if (men.infantry) bits.push(`${int(men.infantry)} inf`);
  if (men.cavalry) bits.push(`${int(men.cavalry)} cav`);
  if (men.archer) bits.push(`${int(men.archer)} arc`);
  if (men.artillery) bits.push(`${int(men.artillery)} art`);
  if (men.mercenary) bits.push(`${int(men.mercenary)} mer`);
  return bits.join(' · ') || 'No troops';
}
function flag(tag, state, cls = '') {
  const c = state?.countries?.[tag];
  return `<span class="flag ${cls}" style="background:${c?.color || '#666'}"></span>`;
}
function bar(value, max, cls = '') {
  const v = clamp(max ? (value / max) * 100 : 0, 0, 100);
  return `<div class="bar ${cls}"><span style="width:${v}%"></span></div>`;
}
function techName(branch, level) {
  const list = TECH_NAMES[branch] || [];
  return list[Math.min(list.length - 1, Math.max(0, Math.floor((level - 1) / 2.5)))] || 'Age of Discovery';
}
function statusClass(status) {
  if (status === 'At war') return 'war';
  if (status === 'Allied' || status === 'Vassal' || status === 'Royal marriage') return 'good';
  if (status === 'Rival') return 'war';
  return '';
}

export class UI {
  constructor(app) {
    this.app = app;
    this.panelTab = null;
    this.countryTag = null;
    this.sheetProvince = null;
    this.armyTarget = null;
    this.navyTarget = null;
    this.startTag = null;
    this.modalKind = null;
    this.shownEvent = null;
    this.shownPeace = null;
    this.shownGameOver = null;
    this.seenNotifs = new Set();
    this.lastHudAt = 0;
    this.lastMonthKey = '';
    this.diploFilter = 'neighbours';
    this.recruitProvince = null;
    this.buildProvince = null;
    this.peaceWarId = null;

    const $ = (id) => document.getElementById(id);
    this.el = {
      hud: $('hud'), hudRes: $('hud-res'), day: $('date-day'), month: $('date-month'), year: $('date-year'),
      speed: [...document.querySelectorAll('.speed')],
      mapModeBtn: $('map-mode-btn'), mapModeIcon: $('map-mode-icon'), mapModeName: $('map-mode-name'),
      toasts: $('toasts'), sheet: $('sheet'), panel: $('panel'), modal: $('modal'), tabs: $('tabs'),
      start: $('start'), startHint: $('start-hint'), search: $('country-search'),
      quick: $('quick-picks'), list: $('country-list'), difficulty: $('difficulty'),
      begin: $('begin-btn'), continueBtn: $('continue-btn'), randomBtn: $('random-btn'), helpBtn: $('help-btn'),
      loading: $('loading'), loaderSub: $('loader-sub'),
    };

    this.banner = document.createElement('div');
    this.banner.className = 'target-banner hidden';
    this.banner.id = 'target-banner';
    document.body.appendChild(this.banner);

    this.bind();
  }

  get state() { return this.app.state; }

  bind() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (!el) {
        if (e.target.id === 'modal' && !['event', 'gameover', 'peace'].includes(this.modalKind)) this.closeModal();
        return;
      }
      this.action(el.dataset.action, el, e);
    });
    document.addEventListener('change', (e) => {
      const el = e.target.closest('[data-change]');
      if (el) this.change(el.dataset.change, el);
    });
    this.el.search?.addEventListener('input', () => this.renderStartList());
    this.el.begin?.addEventListener('click', () => this.app.beginCampaign(this.startTag, this.el.difficulty.value));
    this.el.continueBtn?.addEventListener('click', () => this.app.continueCampaign());
    this.el.randomBtn?.addEventListener('click', () => {
      const tags = Object.values(this.app.preview?.countries || {}).filter((c) => c.alive).map((c) => c.tag);
      if (tags.length) this.selectStartCountry(tags[Math.floor(Math.random() * tags.length)], true);
    });
    this.el.helpBtn?.addEventListener('click', () => this.showHelp());
    this.el.speed.forEach((b) => b.addEventListener('click', () => this.app.setSpeed(+b.dataset.speed)));
    this.el.tabs?.querySelectorAll('.tab').forEach((b) => {
      b.addEventListener('click', () => {
        if (b.dataset.tab === 'map') this.closePanel();
        else this.openPanel(b.dataset.tab);
      });
    });
  }

  // ── Actions ────────────────────────────────────────────────
  action(action, el, e) {
    const st = this.state;
    const d = el.dataset;
    switch (action) {
      case 'noop': break;
      case 'close-sheet': this.closeSheet(); break;
      case 'close-panel': this.closePanel(); break;
      case 'close-modal': this.closeModal(); break;
      case 'menu': this.showMenu(); break;
      case 'map-modes': this.showMapModes(); break;
      case 'set-map-mode': this.app.setMapMode(d.mode); this.closeModal(); break;
      case 'open-panel': this.closeModal(); this.openPanel(d.tab); break;
      case 'open-province': {
        const p = st?.provinces?.[+d.prov];
        if (p) { this.app.map.setSelection(p); this.openProvince(p); }
        break;
      }
      case 'open-country': this.openCountryPanel(d.tag); break;
      case 'start-country': this.selectStartCountry(d.tag, true); break;
      case 'begin': this.app.beginCampaign(this.startTag, this.el.difficulty.value); break;
      case 'event-choice': this.chooseEvent(+d.index); break;
      case 'research': this.do(researchTech(st, d.branch)); break;
      case 'embrace': this.do(embraceInstitution(st, d.key)); break;
      case 'loan': this.do(takeLoan(st)); break;
      case 'repay': this.do(repayLoan(st, +d.index)); break;
      case 'stability': this.do(increaseStability(st)); break;
      case 'reform': this.do(enactReform(st, st.countries[st.playerTag], d.id)); break;
      case 'estate': this.do(estateAction(st, st.countries[st.playerTag], d.estate, d.estateAction)); break;
      case 'accept-culture': this.do(acceptCulture(st, st.countries[st.playerTag], d.culture)); break;
      case 'develop': this.do(developProvince(st, st.provinces[+d.prov], d.kind)); break;
      case 'build': this.showBuild(+d.prov); break;
      case 'build-do': {
        const result = startConstruction(st, st.provinces[+d.prov], d.type);
        this.do(result);
        if (result.ok) this.closeModal();
        break;
      }
      case 'convert': this.do(startConversion(st, st.provinces[+d.prov])); break;
      case 'colonize': this.do(startColony(st, +d.prov)); break;
      case 'fabricate': this.do(fabricateClaim(st, st.playerTag, +d.prov)); break;
      case 'improve': this.do(improveRelations(st, st.playerTag, d.tag)); break;
      case 'marry': this.do(royalMarriage(st, st.playerTag, d.tag)); break;
      case 'ally': this.do(formAlliance(st, st.playerTag, d.tag)); break;
      case 'break-ally': this.do(breakAlliance(st, st.playerTag, d.tag)); break;
      case 'guarantee': this.do(guarantee(st, st.playerTag, d.tag)); break;
      case 'access': this.do(militaryAccess(st, st.playerTag, d.tag)); break;
      case 'trade-deal': this.do(tradeAgreement(st, st.playerTag, d.tag)); break;
      case 'declare-war': this.do(declareWar(st, st.playerTag, d.tag)); break;
      case 'annex': this.do(annexVassal(st, st.playerTag, d.tag)); break;
      case 'independence': this.do(declareIndependence(st)); break;
      case 'select-army': this.beginArmyMove(+d.army); break;
      case 'select-navy': this.beginNavyMove(+d.navy); break;
      case 'cancel-target': this.clearTarget(); break;
      case 'army-split': this.do(splitArmy(st, st.armies.find((a) => a.id === +d.army))); break;
      case 'army-merge': this.do(mergeArmies(st, st.playerTag, +d.prov)); break;
      case 'army-disband': this.do(disbandArmy(st, st.armies.find((a) => a.id === +d.army))); break;
      case 'recruit': this.do(recruit(st, st.playerTag, +d.prov, d.type, 1)); break;
      case 'ship': this.do(buildShip(st, st.playerTag, +d.prov, d.type, 1)); break;
      case 'peace-open': this.showPeace(+d.war); break;
      case 'peace-sign': this.signPeace(+d.war); break;
      case 'peace-white': this.signPeace(+d.war, true); break;
      case 'peace-accept': this.do(acceptPendingPeace(st)); this.closeModal(); break;
      case 'peace-decline': this.do(declinePendingPeace(st)); this.closeModal(); break;
      case 'save': this.app.saveGame(d.slot); break;
      case 'load': this.app.loadGame(d.slot); break;
      case 'delete-save': this.app.deleteSave(d.slot); break;
      case 'export': this.app.exportGame(); break;
      case 'import': document.getElementById('import-file')?.click(); break;
      case 'toggle-labels': st.settings.labels = !st.settings.labels; this.app.map.setLabels(st.settings.labels); this.renderPanel(); break;
      case 'toggle-autosave': st.settings.autosave = !st.settings.autosave; this.renderPanel(); break;
      case 'restart': this.app.toStartScreen(); break;
      case 'help': this.showHelp(); break;
      case 'new-campaign': this.app.toStartScreen(); break;
      case 'filter-diplo': this.diploFilter = d.filter; this.renderPanel(); break;
      case 'set-recruit-prov': this.recruitProvince = +d.prov; this.renderPanel(); break;
      case 'close-banner': this.clearTarget(); break;
      default: break;
    }
  }

  change(kind, el) {
    const st = this.state;
    if (!st) return;
    if (kind === 'law') {
      this.do(enactLaw(st, st.countries[st.playerTag], el.dataset.cat, el.value));
    } else if (kind === 'recruit-prov') {
      this.recruitProvince = +el.value;
      this.renderPanel();
    } else if (kind === 'build-prov') {
      this.buildProvince = +el.value;
      this.renderPanel();
    }
  }

  do(result) {
    if (result?.msg) this.showToast(result.msg, result.ok ? 'good' : 'war');
    this.app.map.dirty = true;
    this.refresh(true);
    if (this.panelTab) this.renderPanel(true);
    if (this.sheetProvince) this.openProvince(this.sheetProvince, true);
  }

  // ── Start screen ───────────────────────────────────────────
  renderStart() {
    if (!this.app.preview) return;
    this.el.start?.classList.remove('hidden');
    this.el.loading?.classList.add('hidden');
    this.el.hud?.classList.add('hidden');
    this.el.tabs?.classList.add('hidden');
    this.el.mapModeBtn?.classList.add('hidden');
    this.renderQuickPicks();
    this.renderStartList();
    const hasSave = this.app.hasAnySave?.();
    if (this.el.continueBtn) this.el.continueBtn.disabled = !hasSave;
  }

  renderQuickPicks() {
    if (!this.el.quick) return;
    const picks = ['FRA', 'ENG', 'OTT', 'CAS', 'AUS', 'VEN', 'POL', 'MNG', 'BYZ', 'MUS'];
    this.el.quick.innerHTML = picks.filter((t) => this.app.preview?.countries?.[t]).map((t) => {
      const c = this.app.preview.countries[t];
      return `<button class="quick-pick ${this.startTag === t ? 'selected' : ''}" data-action="start-country" data-tag="${t}">
        ${flag(t, this.app.preview)}<span>${esc(c.name)}</span></button>`;
    }).join('');
  }

  renderStartList() {
    if (!this.el.list || !this.app.preview) return;
    const q = (this.el.search?.value || '').trim().toLowerCase();
    const st = this.app.preview;
    const rows = Object.values(st.countries).filter((c) => c.alive).filter((c) => {
      if (!q) return true;
      return `${c.name} ${c.adj} ${c.tag} ${c.culture} ${c.religion} ${c.gov}`.toLowerCase().includes(q);
    }).map((c) => {
      const dev = totalDev(st, c.tag);
      const provinces = ownedProvinces(st, c.tag).length;
      return `<div class="country-row ${this.startTag === c.tag ? 'selected' : ''}" data-action="start-country" data-tag="${c.tag}">
        ${flag(c.tag, st, 'lg')}
        <div><div class="name">${esc(c.name)}</div><div class="meta">${esc(GOVERNMENTS[c.gov]?.name || c.gov)} · ${esc(CULTURES[c.culture]?.name || c.culture)} · ${esc(RELIGIONS[c.religion]?.name || c.religion)}</div></div>
        <div class="dev"><b>${dev}</b>${provinces} prov.</div>
      </div>`;
    }).join('');
    this.el.list.innerHTML = rows || '<div class="empty">No realm matches that search.</div>';
    if (this.startTag) {
      const c = st.countries[this.startTag];
      this.el.startHint.innerHTML = `<b>${esc(c.name)}</b> — ${esc(GOVERNMENTS[c.gov]?.name || c.gov)}, ${esc(c.ruler.title)} ${esc(c.ruler.name)} · ${ownedProvinces(st, c.tag).length} provinces · ${totalDev(st, c.tag)} development`;
      if (this.el.begin) this.el.begin.disabled = false;
    } else {
      this.el.startHint.textContent = 'Tap a province on the map, or choose a realm below.';
      if (this.el.begin) this.el.begin.disabled = true;
    }
  }

  selectStartCountry(tag, fit = false) {
    if (!this.app.preview?.countries?.[tag]) return;
    this.startTag = tag;
    this.renderQuickPicks();
    this.renderStartList();
    if (fit) {
      this.app.map.fitCountry(tag);
      const cap = this.app.preview.countries[tag].capital;
      if (cap != null) this.app.map.setSelection(this.app.preview.provinces[cap]);
    }
  }

  resetForGame() {
    this.startTag = null;
    this.panelTab = null;
    this.sheetProvince = null;
    this.armyTarget = null;
    this.navyTarget = null;
    this.modalKind = null;
    this.shownEvent = null;
    this.shownPeace = null;
    this.shownGameOver = null;
    this.seenNotifs = new Set((this.state?.notifications || []).map((n) => n.date + n.msg));
    this.recruitProvince = null;
    this.buildProvince = null;
    this.closeModal();
    this.closeSheet();
    this.closePanel();
    this.el.start?.classList.add('hidden');
    this.el.hud?.classList.remove('hidden');
    this.el.tabs?.classList.remove('hidden');
    this.el.mapModeBtn?.classList.remove('hidden');
    this.refresh(true);
  }

  // ── HUD & refresh ─────────────────────────────────────────
  refresh(force = false) {
    const st = this.state;
    if (!st) return;
    const now = performance.now();
    if (!force && now - this.lastHudAt < 140) return;
    this.lastHudAt = now;
    this.el.day.textContent = st.date.d;
    this.el.month.textContent = MONTHS[st.date.m - 1];
    this.el.year.textContent = st.date.y;
    const speed = st.paused || st.gameOver ? 0 : (st.speed || 1);
    this.el.speed.forEach((b) => b.classList.toggle('active', +b.dataset.speed === speed));
    this.renderHud();
    const mode = MAP_MODES[this.app.map.mode] || MAP_MODES.political;
    if (this.el.mapModeIcon) this.el.mapModeIcon.textContent = mode.icon;
    if (this.el.mapModeName) this.el.mapModeName.textContent = mode.name;
    this.updateBanner();
    this.flushNotifications();
    this.checkInterrupts();
    const key = `${st.date.y}-${st.date.m}`;
    if (key !== this.lastMonthKey) {
      this.lastMonthKey = key;
      if (this.panelTab && ['realm', 'economy', 'diplomacy', 'military'].includes(this.panelTab)) this.renderPanel(true);
      if (this.sheetProvince) this.openProvince(this.sheetProvince, true);
    }
  }

  renderHud() {
    const st = this.state;
    const c = st.countries[st.playerTag];
    if (!c || !this.el.hudRes) return;
    const net = (c.income || 0) - (c.expense || 0);
    const wars = warsOf(st, st.playerTag).length;
    const rank = this.app.playerRank?.() || { rank: 0, total: 0 };
    const chips = [
      `<button class="chip click" data-action="open-panel" data-tab="realm">${flag(c.tag, st)}<b>${esc(c.name)}</b></button>`,
      `<button class="chip click" data-action="open-panel" data-tab="economy"><span class="sym">◈</span><b>${int(c.treasury)}</b><span class="${net >= 0 ? 'good' : 'bad'}">${signed(net)}/mo</span></button>`,
      `<button class="chip click ${c.stability < 0 ? 'neg' : ''}" data-action="open-panel" data-tab="realm"><span class="sym">⚖</span><b>${c.stability >= 0 ? '+' : ''}${c.stability}</b><span>stab</span></button>`,
      `<button class="chip click" data-action="open-panel" data-tab="military"><span class="sym">⚔</span><b>${int(totalArmyMen(st, c.tag) / 1000)}k</b><span>/ ${int(c.forceLimit)}k</span></button>`,
      `<button class="chip click" data-action="open-panel" data-tab="military"><span class="sym">👥</span><b>${int(c.manpower / 1000)}k</b><span>mp</span></button>`,
      `<button class="chip click" data-action="open-panel" data-tab="realm"><span class="sym">♔</span><b>${Math.round(c.legitimacy)}</b><span>legit</span></button>`,
      `<button class="chip click" data-action="open-panel" data-tab="diplomacy"><span class="sym">★</span><b>${Math.round(c.prestige)}</b><span>prestige</span></button>`,
    ];
    if (wars) chips.push(`<button class="chip click war" data-action="open-panel" data-tab="diplomacy"><span class="sym">⚑</span><b>${wars}</b><span>war${wars > 1 ? 's' : ''}</span></button>`);
    if (c.warExhaustion > 0.5) chips.push(`<span class="chip ${c.warExhaustion > 8 ? 'neg' : ''}"><span class="sym">☠</span><b>${num(c.warExhaustion, 1)}</b><span>exhaustion</span></span>`);
    if ((c.ae || 0) > 0) chips.push(`<span class="chip ${c.ae > 30 ? 'neg' : ''}"><span class="sym">⚑</span><b>${Math.round(c.ae)}</b><span>AE</span></span>`);
    chips.push(`<span class="chip"><span class="sym">#</span><b>${rank.rank || '—'}</b><span>/ ${rank.total}</span></span>`);
    this.el.hudRes.innerHTML = chips.join('');
  }

  flushNotifications() {
    const st = this.state;
    const list = st.notifications || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const n = list[i];
      const key = `${n.date}|${n.msg}`;
      if (this.seenNotifs.has(key)) continue;
      this.seenNotifs.add(key);
      this.showToast(n.msg, /war|rebel|fallen|declared|defeat|plague/i.test(n.msg) ? 'war' : '');
    }
    if (this.seenNotifs.size > 400) this.seenNotifs = new Set([...this.seenNotifs].slice(-200));
  }

  showToast(msg, kind = '') {
    if (!this.el.toasts) return;
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.textContent = msg;
    this.el.toasts.appendChild(t);
    while (this.el.toasts.children.length > 3) this.el.toasts.firstChild.remove();
    setTimeout(() => t.remove(), 5200);
  }

  checkInterrupts() {
    const st = this.state;
    if (st.pendingEvent && this.shownEvent !== st.pendingEvent) {
      this.shownEvent = st.pendingEvent;
      st.paused = true;
      this.showEventModal(st.pendingEvent);
    }
    if (st.pendingPeace && this.shownPeace !== st.pendingPeace) {
      this.shownPeace = st.pendingPeace;
      st.paused = true;
      this.showPeaceOffer(st.pendingPeace);
    }
    if (st.gameOver && this.shownGameOver !== st.gameOver) {
      this.shownGameOver = st.gameOver;
      st.paused = true;
      this.showGameOver(st.gameOver);
    }
  }

  updateBanner() {
    if (this.armyTarget) {
      const a = this.armyTarget;
      this.banner.innerHTML = `<span>⚔ Select a destination for ${menText(a.men)} troops</span><button class="btn small" data-action="cancel-target">Cancel</button>`;
      this.banner.classList.remove('hidden');
    } else if (this.navyTarget) {
      this.banner.innerHTML = `<span>⛵ Select a friendly or allied port for the fleet</span><button class="btn small" data-action="cancel-target">Cancel</button>`;
      this.banner.classList.remove('hidden');
    } else {
      this.banner.classList.add('hidden');
    }
  }

  clearTarget() {
    this.armyTarget = null;
    this.navyTarget = null;
    this.updateBanner();
  }

  beginArmyMove(id) {
    const a = this.state.armies.find((x) => x.id === id);
    if (!a || a.owner !== this.state.playerTag) return;
    this.armyTarget = a;
    this.navyTarget = null;
    this.closeSheet();
    this.closePanel();
    this.showToast('Tap any province to march there. Enemy land requires military access or war.');
    this.updateBanner();
  }

  beginNavyMove(id) {
    const n = this.state.navies.find((x) => x.id === id);
    if (!n || n.owner !== this.state.playerTag) return;
    this.navyTarget = n;
    this.armyTarget = null;
    this.closeSheet();
    this.closePanel();
    this.showToast('Tap a coastal port to sail the fleet there.');
    this.updateBanner();
  }

  // ── Province sheet ────────────────────────────────────────
  openProvince(p, keepScroll = false) {
    const st = this.state;
    if (!st || !p) return;
    this.sheetProvince = p;
    const oldScroll = keepScroll ? this.el.sheet.scrollTop : 0;
    const owner = p.owner ? st.countries[p.owner] : null;
    const controller = p.controller ? st.countries[p.controller] : null;
    const dev = p.dev.tax + p.dev.prod + p.dev.mp;
    const mine = p.owner === st.playerTag;
    const armiesHere = st.armies.filter((a) => a.provinceId === p.id && a.owner !== 'REB');
    const naviesHere = st.navies.filter((n) => n.provinceId === p.id);
    const buildingList = Object.entries(p.buildings || {}).filter(([, v]) => v).map(([k]) => BUILDINGS[k]?.name || k);
    if (p.fort) buildingList.push(`Fortress ${p.fort}`);
    const actions = [];
    if (mine) {
      actions.push(`<button class="btn small" data-action="develop" data-prov="${p.id}" data-kind="tax">Tax +1 · ${Math.ceil(40 + dev * 3)} ADM</button>`);
      actions.push(`<button class="btn small" data-action="develop" data-prov="${p.id}" data-kind="prod">Prod +1 · ${Math.ceil(40 + dev * 3)} DIP</button>`);
      actions.push(`<button class="btn small" data-action="develop" data-prov="${p.id}" data-kind="mp">Manpower +1 · ${Math.ceil(40 + dev * 3)} MIL</button>`);
      actions.push(`<button class="btn small" data-action="build" data-prov="${p.id}">Construct…</button>`);
      if (p.religion !== st.countries[st.playerTag].religion) actions.push(`<button class="btn small" data-action="convert" data-prov="${p.id}">Send Missionaries</button>`);
    } else if (!p.owner) {
      if (st.flags.colonization) actions.push(`<button class="btn small gold" data-action="colonize" data-prov="${p.id}">Colonise · 100 ducats</button>`);
      else actions.push('<span class="faint small">The age of colonisation has not begun.</span>');
    } else {
      actions.push(`<button class="btn small" data-action="fabricate" data-prov="${p.id}">Fabricate Claim · 50</button>`);
      actions.push(`<button class="btn small" data-action="improve" data-tag="${p.owner}">Improve Relations · 25</button>`);
      actions.push(`<button class="btn small" data-action="open-country" data-tag="${p.owner}">Court of ${esc(owner.name)}</button>`);
      if (canDeclareWar(st, st.playerTag, p.owner) === null) actions.push(`<button class="btn small danger" data-action="declare-war" data-tag="${p.owner}">Declare War</button>`);
    }
    const armyHtml = armiesHere.length ? armiesHere.map((a) => {
      const isMine = a.owner === st.playerTag;
      const c = st.countries[a.owner];
      return `<div class="peace-prov"><span class="flag" style="background:${c?.color || '#666'}"></span>
        <span class="nm">${esc(c?.name || a.owner)} · ${compText(a.men)}</span>
        <span class="dv">${Math.round(a.morale)} morale${a.move ? ' · marching' : ''}</span>
        ${isMine ? `<button class="btn small" data-action="select-army" data-army="${a.id}">March</button>` : ''}
      </div>`;
    }).join('') : '';
    const navyHtml = naviesHere.length ? naviesHere.map((n) => {
      const c = st.countries[n.owner];
      const count = navyShips(n);
      return `<div class="peace-prov"><span class="flag" style="background:${c?.color || '#666'}"></span>
        <span class="nm">${esc(c?.name || n.owner)} · ${count} ships</span>
        <span class="dv">${Math.round(n.morale)} morale</span>
        ${n.owner === st.playerTag ? `<button class="btn small" data-action="select-navy" data-navy="${n.id}">Sail</button>` : ''}
      </div>`;
    }).join('') : '';

    this.el.sheet.innerHTML = `
      <div class="sheet-head">
        <div class="title">
          <h3>${esc(p.name)}</h3>
          <div class="owner-line">${owner ? `${flag(p.owner, st)} <span>${esc(owner.name)}</span> · ${esc(GOVERNMENTS[owner.gov]?.name || owner.gov)}` : '<span class="faint">Unclaimed land</span>'}
            ${p.capital ? ' · <span class="tag gold">Capital</span>' : ''}
            ${p.controller !== p.owner && p.controller ? ` · <span class="tag war">Occupied by ${esc(controller?.name || p.controller)}</span>` : ''}
          </div>
        </div>
        <button class="close-x" data-action="close-sheet">✕</button>
      </div>
      <div class="stat-strip">
        <div class="stat"><div class="label">Development</div><div class="value gold">${dev}</div></div>
        <div class="stat"><div class="label">Population</div><div class="value">${int(p.pop)}</div></div>
        <div class="stat"><div class="label">Unrest</div><div class="value ${p.unrest > 25 ? 'bad' : ''}">${Math.round(p.unrest)}</div></div>
        <div class="stat"><div class="label">Autonomy</div><div class="value">${Math.round(p.autonomy)}%</div></div>
      </div>
      <div class="grid2">
        <div class="card">
          <div class="kv"><span>Terrain</span><b>${esc(TERRAIN[p.terrain]?.name || p.terrain)}</b></div>
          <div class="kv"><span>Goods</span><b>${esc(GOODS[p.good]?.name || p.good)} · ${num(GOODS[p.good]?.price || 2)}</b></div>
          <div class="kv"><span>Tax / Prod / MP</span><b>${p.dev.tax} / ${p.dev.prod} / ${p.dev.mp}</b></div>
          <div class="kv"><span>Fort level</span><b>${p.fort || 0}</b></div>
        </div>
        <div class="card">
          <div class="kv"><span>Religion</span><b>${esc(RELIGIONS[p.religion]?.name || p.religion)}</b></div>
          <div class="kv"><span>Culture</span><b>${esc(CULTURES[p.culture]?.name || p.culture)}</b></div>
          <div class="kv"><span>Trade node</span><b>${esc(TRADE_NODES.find((n) => n.id === p.tradeNode)?.name || '—')}</b></div>
          <div class="kv"><span>Port</span><b>${p.port ? 'Yes' : 'No'}</b></div>
        </div>
      </div>
      <div class="card">
        <div class="row between"><span class="small dim">Buildings</span><span class="small">${buildingList.length ? esc(buildingList.join(', ')) : 'None'}</span></div>
        ${p.construction ? `<div class="small warn" style="margin-top:6px">${esc(BUILDINGS[p.construction.type]?.name || p.construction.type)} under construction — ${p.construction.monthsLeft} months left.</div>` : ''}
        ${p.conversion ? `<div class="small warn" style="margin-top:6px">Missionaries at work — ${Math.ceil(p.conversion.monthsLeft)} months left.</div>` : ''}
        ${p.siege ? `<div class="small danger" style="margin-top:6px">Under siege — ${p.siege.progress}%</div>` : ''}
        ${p.colony ? `<div class="small warn" style="margin-top:6px">Colony of ${esc(st.countries[p.colony.tag]?.name || p.colony.tag)} — ${p.colony.monthsLeft} months left.</div>` : ''}
      </div>
      ${armyHtml ? `<div class="section-title">Armies</div><div class="card">${armyHtml}</div>` : ''}
      ${navyHtml ? `<div class="section-title">Fleets</div><div class="card">${navyHtml}</div>` : ''}
      ${actions.length ? `<div class="btn-row">${actions.join('')}</div>` : ''}
    `;
    this.el.sheet.classList.remove('hidden');
    this.el.panel.classList.add('hidden');
    if (keepScroll) this.el.sheet.scrollTop = oldScroll;
  }

  closeSheet() {
    this.sheetProvince = null;
    this.el.sheet?.classList.add('hidden');
  }

  showBuild(provId) {
    const st = this.state;
    const p = st.provinces[provId];
    if (!p) return;
    this.buildProvince = provId;
    const rows = Object.entries(BUILDINGS).map(([key, b]) => {
      const lvl = key === 'fort' ? (p.fort || 0) : (p.buildings[key] || 0);
      const max = key === 'fort' ? 4 : 1;
      const disabled = lvl >= max || (key === 'dock' && !p.port) || (key === 'university' && st.countries[st.playerTag].tech.adm < 5);
      return `<div class="peace-prov">
        <span class="nm">${b.icon} <b>${esc(b.name)}</b><div class="dv">${esc(b.desc)}</div></span>
        <span class="dv">${lvl}/${max} · ${b.cost} ducats</span>
        <button class="btn small ${disabled ? '' : 'gold'}" ${disabled ? 'disabled' : ''} data-action="build-do" data-prov="${provId}" data-type="${key}">${lvl ? 'Max' : 'Build'}</button>
      </div>`;
    }).join('');
    this.showModal(`<h2>Construction in ${esc(p.name)}</h2>
      <div class="event-date">Treasury: ${int(st.countries[st.playerTag].treasury)} ducats</div>
      <div style="margin-top:12px">${rows}</div>
      <button class="btn block modal-close" data-action="close-modal">Close</button>`, 'build');
  }

  // ── Panels ────────────────────────────────────────────────
  openPanel(tab) {
    this.panelTab = tab;
    this.closeSheet();
    this.el.panel.classList.remove('hidden');
    this.el.tabs.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    this.renderPanel();
  }

  closePanel() {
    this.panelTab = null;
    this.countryTag = null;
    this.el.panel?.classList.add('hidden');
    this.el.tabs?.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === 'map'));
  }

  panelHead(title, sub = '') {
    return `<div class="panel-head">
      <button class="back-btn" data-action="close-panel">‹</button>
      <div><h2>${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
      <div class="spacer"></div>
    </div>`;
  }

  renderPanel(keepScroll = false) {
    if (!this.panelTab || !this.state) return;
    const st = this.state;
    const old = keepScroll ? this.el.panel.scrollTop : 0;
    let html = '';
    switch (this.panelTab) {
      case 'realm': html = this.realmPanel(st); break;
      case 'economy': html = this.economyPanel(st); break;
      case 'diplomacy': html = this.diplomacyPanel(st); break;
      case 'military': html = this.militaryPanel(st); break;
      case 'tech': html = this.techPanel(st); break;
      case 'more': html = this.morePanel(st); break;
      case 'country': html = this.countryPanel(st); break;
      default: html = this.realmPanel(st);
    }
    this.el.panel.innerHTML = html;
    this.el.panel.scrollTop = old;
  }

  realmPanel(st) {
    const c = st.countries[st.playerTag];
    if (!c) return this.panelHead('Realm');
    const gov = GOVERNMENTS[c.gov] || {};
    const r = c.ruler;
    const rank = this.app.playerRank?.() || { rank: 0, total: 0 };
    const unity = religiousUnity(st, c);
    const dev = totalDev(st, c.tag);
    const est = Object.entries(c.estates).map(([key, e]) => {
      const info = ESTATES[key];
      return `<div class="card estate">
        <div class="row between"><b>${info.icon} ${esc(info.name)}</b><span class="small dim">${Math.round(e.loyalty)} loyal</span></div>
        <div class="small faint">${esc(info.desc)}</div>
        <div class="row" style="margin-top:6px">${bar(e.loyalty, 100, e.loyalty < 30 ? 'red' : 'green')}<span class="small">${Math.round(e.influence)}% infl.</span></div>
        <div class="btn-row">
          <button class="btn small" data-action="estate" data-estate="${key}" data-estate-action="privilege">Privilege · 20</button>
          <button class="btn small danger" data-action="estate" data-estate="${key}" data-estate-action="seize">Seize</button>
        </div>
      </div>`;
    }).join('');
    const reforms = Object.entries(REFORMS).map(([id, rf]) => {
      const done = c.reforms.includes(id);
      return `<div class="peace-prov">
        <span class="nm"><b>${esc(rf.name)}</b><div class="dv">${esc(rf.desc)}</div></span>
        <span class="dv">${rf.cost} ADM</span>
        <button class="btn small ${done ? '' : 'gold'}" ${done || c.points.adm < rf.cost ? 'disabled' : ''} data-action="reform" data-id="${id}">${done ? 'Enacted' : 'Enact'}</button>
      </div>`;
    }).join('');
    const lawCats = ['succession', 'army', 'navy', 'tolerance', 'economy'];
    const laws = lawCats.map((cat) => {
      const opts = Object.entries(LAWS).filter(([id]) => id.startsWith(cat + '_') || (cat === 'succession' && id.startsWith('succession_')));
      return `<div class="kv"><span>${cat[0].toUpperCase() + cat.slice(1)} law</span><select data-change="law" data-cat="${cat}" style="max-width:56%;background:var(--panel-2);color:var(--ink);border:1px solid var(--border);border-radius:4px;padding:3px">
        ${opts.map(([id, l]) => `<option value="${id}" ${c.laws[cat] === id ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}
      </select></div>`;
    }).join('');
    const cultures = Object.keys(CULTURES).filter((k) => ownedProvinces(st, c.tag).some((p) => p.culture === k) && !c.accepted.includes(k));
    const cultureHtml = cultures.length ? cultures.map((k) => `<button class="btn small" data-action="accept-culture" data-culture="${k}">${esc(CULTURES[k].name)} · 100 DIP</button>`).join('') : '<span class="faint small">All your cultures are accepted.</span>';
    return `${this.panelHead(`${flag(c.tag, st, 'lg')} ${esc(c.name)}`, `${esc(gov.name || c.gov)} · ${esc(r.title)} ${esc(r.name)} · rank ${rank.rank}/${rank.total}`)}
      <div class="card highlight">
        <div class="row between"><div><div class="small faint">Ruler</div><b style="font-family:var(--serif);font-size:17px">${esc(r.name)}</b><div class="small dim">${esc(r.title)} · age ${r.age}${r.regency ? ' · regency' : ''}</div></div>
          <div class="center"><div class="small faint">ADM / DIP / MIL</div><div class="big" style="font-size:20px">${r.adm} · ${r.dip} · ${r.mil}</div></div></div>
        <div class="small dim" style="margin-top:6px">${r.heir ? `Heir: ${esc(r.heir.name)}, age ${r.heir.age} (${r.heir.adm}/${r.heir.dip}/${r.heir.mil})` : 'No heir — succession is uncertain.'}</div>
      </div>
      <div class="grid3">
        <div class="card center"><div class="small faint">Stability</div><div class="big" style="font-size:20px" class="${c.stability < 0 ? 'bad' : ''}">${c.stability >= 0 ? '+' : ''}${c.stability}</div><button class="btn small" ${c.stability >= 3 || c.points.adm < 100 ? 'disabled' : ''} data-action="stability">Raise · 100 ADM</button></div>
        <div class="card center"><div class="small faint">${c.gov === 'republic' || c.gov === 'oligarchy' ? 'Republican tradition' : 'Legitimacy'}</div><div class="big" style="font-size:20px">${Math.round(c.gov === 'republic' || c.gov === 'oligarchy' ? c.republicanTradition : c.legitimacy)}</div><div class="small faint">Prestige ${Math.round(c.prestige)}</div></div>
        <div class="card center"><div class="small faint">Development</div><div class="big" style="font-size:20px">${dev}</div><div class="small faint">${ownedProvinces(st, c.tag).length} provinces</div></div>
      </div>
      <div class="grid3">
        <div class="card center"><div class="small faint">Religious unity</div><div class="big" style="font-size:20px">${unity}%</div></div>
        <div class="card center"><div class="small faint">War exhaustion</div><div class="big" style="font-size:20px" class="${c.warExhaustion > 8 ? 'bad' : ''}">${num(c.warExhaustion, 1)}</div></div>
        <div class="card center"><div class="small faint">Centralization</div><div class="big" style="font-size:20px">${Math.round(c.centralization)}</div></div>
      </div>
      <div class="card">
        <div class="kv"><span>Government</span><b>${esc(gov.name || c.gov)}</b></div>
        <div class="kv"><span>State religion</span><b>${esc(RELIGIONS[c.religion]?.name || c.religion)}</b></div>
        <div class="kv"><span>Primary culture</span><b>${esc(CULTURES[c.culture]?.name || c.culture)}</b></div>
        <div class="kv"><span>Corruption / Inflation</span><b>${num(c.corruption)}% / ${num(c.inflation)}%</b></div>
        <div class="kv"><span>Aggressive expansion</span><b class="${c.ae > 30 ? 'bad' : ''}">${Math.round(c.ae || 0)}</b></div>
        <div class="kv"><span>Personal union</span><b>${c.puSenior ? `Junior partner of ${esc(st.countries[c.puSenior]?.name || c.puSenior)}` : (c.puJuniors?.length ? `Senior over ${c.puJuniors.map((t) => st.countries[t]?.name).join(', ')}` : 'None')}</b></div>
      </div>
      ${c.puSenior ? `<button class="btn block danger" data-action="independence">Declare War of Independence</button>` : ''}
      <div class="section-title">Estates</div>
      <div class="scroll-x">${est}</div>
      <div class="btn-row"><button class="btn" data-action="estate" data-estate="nobles" data-estate-action="diet">Call the Diet · 30</button></div>
      <div class="section-title">Accepted cultures</div>
      <div class="card"><div class="small dim" style="margin-bottom:6px">Accepted: ${c.accepted.map((k) => esc(CULTURES[k]?.name || k)).join(', ')}</div><div class="btn-row">${cultureHtml}</div></div>
      <div class="section-title">Reforms</div>
      <div class="card">${reforms}</div>
      <div class="section-title">Laws</div>
      <div class="card">${laws}</div>`;
  }

  economyPanel(st) {
    const c = st.countries[st.playerTag];
    if (!c) return this.panelHead('Economy');
    const inc = c.lastIncome || { tax: 0, production: 0, trade: 0, gold: 0, corruption: 0, total: 0 };
    const detail = expenseBreakdown(st, c);
    const exp = detail.total;
    const net = (c.income || 0) - exp;
    const loans = c.loans.map((l, i) => `<div class="peace-prov"><span class="nm">Loan of ${int(l.amount)} at ${Math.round(l.rate * 100)}%<div class="dv">Interest ${num(l.amount * l.rate / 12)}/month</div></span><button class="btn small" ${c.treasury < l.amount ? 'disabled' : ''} data-action="repay" data-index="${i}">Repay</button></div>`).join('');
    const nodes = Object.values(st.trade || {}).map((n) => {
      const power = n.powers?.[c.tag] || 0;
      if (!power) return null;
      const share = n.totalPower ? power / n.totalPower : 0;
      return { n, share };
    }).filter(Boolean).sort((a, b) => b.share - a.share).slice(0, 10);
    const tradeHtml = nodes.length ? nodes.map(({ n, share }) => `<div class="kv"><span>${esc(n.name)}</span><b>${Math.round(share * 100)}% · ${num(n.value * share * 0.2)}/mo</b></div>`).join('') : '<div class="empty">No trade presence yet.</div>';
    const buildings = {};
    for (const p of ownedProvinces(st, c.tag)) for (const [k, v] of Object.entries(p.buildings || {})) if (v) buildings[k] = (buildings[k] || 0) + v;
    const buildingHtml = Object.entries(buildings).map(([k, v]) => `<div class="kv"><span>${BUILDINGS[k]?.icon || ''} ${esc(BUILDINGS[k]?.name || k)}</span><b>${v}</b></div>`).join('') || '<div class="empty">No buildings yet. Open a province to construct.</div>';
    const constructions = ownedProvinces(st, c.tag).filter((p) => p.construction).map((p) => `<div class="kv"><span>${esc(p.name)}</span><b>${esc(BUILDINGS[p.construction.type]?.name || p.construction.type)} · ${p.construction.monthsLeft} mo</b></div>`).join('');
    const topProvinces = ownedProvinces(st, c.tag).slice().sort((a, b) => (b.dev.tax + b.dev.prod + b.dev.mp) - (a.dev.tax + a.dev.prod + a.dev.mp)).slice(0, 8);
    return `${this.panelHead(`${flag(c.tag, st, 'lg')} Economy`, `Treasury ${int(c.treasury)} ducats · ${signed(net)}/month`)}
      <div class="grid2">
        <div class="card center"><div class="small faint">Monthly income</div><div class="big">${num(c.income || 0)}</div></div>
        <div class="card center"><div class="small faint">Monthly expense</div><div class="big" style="color:#d8a080">${num(exp)}</div></div>
      </div>
      <div class="section-title">Income</div>
      <div class="card">
        <div class="kv"><span>Taxation</span><b>${num(inc.tax)}</b></div>
        <div class="kv"><span>Production</span><b>${num(inc.production)}</b></div>
        <div class="kv"><span>Trade</span><b>${num(inc.trade)}</b></div>
        <div class="kv"><span>Gold</span><b>${num(inc.gold)}</b></div>
        <div class="kv"><span>Corruption</span><b class="bad">−${num(inc.corruption)}</b></div>
        <div class="kv"><span>Total</span><b class="good">${num(inc.total)}</b></div>
      </div>
      <div class="section-title">Expenses</div>
      <div class="card">
        <div class="kv"><span>Army maintenance</span><b>${num(detail.army)}</b></div>
        <div class="kv"><span>Navy maintenance</span><b>${num(detail.navy)}</b></div>
        <div class="kv"><span>Forts</span><b>${num(detail.forts)}</b></div>
        <div class="kv"><span>Loan interest</span><b>${num(detail.interest)}</b></div>
        <div class="kv"><span>Court</span><b>${num(detail.court)}</b></div>
        <div class="kv"><span>Total</span><b class="bad">${num(exp)}</b></div>
      </div>
      <div class="section-title">Debt & inflation</div>
      <div class="card">
        <div class="kv"><span>Inflation</span><b>${num(c.inflation)}%</b></div>
        <div class="kv"><span>Loans</span><b>${c.loans.length} / 8</b></div>
        ${loans || '<div class="faint small" style="padding:6px 0">No outstanding loans.</div>'}
        <div class="btn-row"><button class="btn" ${c.loans.length >= 8 ? 'disabled' : ''} data-action="loan">Take Loan</button></div>
      </div>
      <div class="section-title">Trade nodes</div>
      <div class="card">${tradeHtml}</div>
      <div class="section-title">Buildings</div>
      <div class="card">${buildingHtml}${constructions ? `<div class="divider"></div>${constructions}` : ''}</div>
      <div class="section-title">Provinces</div>
      <div class="card">${topProvinces.map((p) => `<div class="peace-prov"><span class="nm">${esc(p.name)}</span><span class="dv">${p.dev.tax + p.dev.prod + p.dev.mp} dev · ${int(p.pop)} pop</span><button class="btn small" data-action="open-province" data-prov="${p.id}">Open</button></div>`).join('')}</div>`;
  }

  diplomacyPanel(st) {
    const c = st.countries[st.playerTag];
    if (!c) return this.panelHead('Diplomacy');
    const wars = warsOf(st, st.playerTag).map((w) => {
      const side = sideOf(w, st.playerTag);
      const enemy = side === 'attacker' ? w.defenders : w.attackers;
      const score = side === 'attacker' ? w.score : -w.score;
      const occupied = st.provinces.filter((p) => enemy.includes(p.owner) && (side === 'attacker' ? w.attackers : w.defenders).includes(p.controller));
      return `<div class="card">
        <div class="row between"><b>${esc(w.name)}</b><span class="tag ${score > 0 ? 'good' : 'war'}">${score >= 0 ? '+' : ''}${Math.round(score)} war score</span></div>
        <div class="small dim">${esc(enemy.map((t) => st.countries[t]?.name || t).join(', '))} · ${occupied.length} occupied provinces · ${Math.round(w.duration / 30)} months</div>
        <div class="btn-row"><button class="btn small gold" data-action="peace-open" data-war="${w.id}">Negotiate Peace</button></div>
      </div>`;
    }).join('') || '<div class="empty">Your realm is at peace.</div>';
    const filters = [['neighbours', 'Neighbours'], ['powers', 'Great Powers'], ['all', 'All Realms']];
    let tags;
    if (this.diploFilter === 'neighbours') tags = neighborTags(st, st.playerTag);
    else if (this.diploFilter === 'powers') tags = Object.values(st.countries).filter((x) => x.alive).sort((a, b) => b.score - a.score).slice(0, 12).map((x) => x.tag);
    else tags = Object.values(st.countries).filter((x) => x.alive && x.tag !== st.playerTag).sort((a, b) => relation(st, st.playerTag, b.tag) - relation(st, st.playerTag, a.tag)).map((x) => x.tag);
    tags = [...new Set(tags)].filter((t) => st.countries[t]?.alive && t !== st.playerTag);
    const rows = tags.map((t) => {
      const o = st.countries[t];
      const rel = relation(st, st.playerTag, t);
      const status = diploStatus(st, st.playerTag, t);
      return `<div class="peace-prov">
        ${flag(t, st)}<span class="nm"><b>${esc(o.name)}</b><div class="dv">${esc(status)} · relations ${rel >= 0 ? '+' : ''}${rel} · ${totalDev(st, t)} dev</div></span>
        <button class="btn small" data-action="open-country" data-tag="${t}">Court</button>
      </div>`;
    }).join('') || '<div class="empty">No neighbours known.</div>';
    const treatyList = (label, arr) => arr.length ? `<div class="kv"><span>${label}</span><b>${arr.map((t) => esc(st.countries[t]?.name || t)).join(', ')}</b></div>` : '';
    const coalitions = (st.coalitions || []).map((co) => {
      const target = st.countries[co.target];
      const involves = co.target === st.playerTag || co.members.includes(st.playerTag);
      if (!involves) return '';
      return `<div class="card ${co.target === st.playerTag ? 'highlight' : ''}"><b>Coalition against ${esc(target?.name || co.target)}</b><div class="small dim">${co.members.map((t) => esc(st.countries[t]?.name || t)).join(', ')}</div></div>`;
    }).join('');
    return `${this.panelHead(`${flag(c.tag, st, 'lg')} Diplomacy`, `Prestige ${Math.round(c.prestige)} · aggressive expansion ${Math.round(c.ae || 0)}`)}
      <div class="section-title">Wars</div>
      ${wars}
      ${coalitions ? `<div class="section-title">Coalitions</div>${coalitions}` : ''}
      <div class="section-title">Treaties & subjects</div>
      <div class="card">
        ${treatyList('Allies', c.allies) || '<div class="kv"><span>Allies</span><b>None</b></div>'}
        ${treatyList('Royal marriages', c.marriages) || '<div class="kv"><span>Royal marriages</span><b>None</b></div>'}
        ${treatyList('Vassals', c.vassals) || '<div class="kv"><span>Vassals</span><b>None</b></div>'}
        ${treatyList('Guarantees', c.guarantees) || '<div class="kv"><span>Guarantees</span><b>None</b></div>'}
        ${treatyList('Military access', c.access) || '<div class="kv"><span>Military access</span><b>None</b></div>'}
        ${treatyList('Trade agreements', c.tradeAgreements || []) || '<div class="kv"><span>Trade agreements</span><b>None</b></div>'}
        <div class="kv"><span>Claims</span><b>${c.claims.length} provinces</b></div>
      </div>
      <div class="section-title">Relations</div>
      <div class="btn-row">${filters.map(([id, label]) => `<button class="btn small ${this.diploFilter === id ? 'gold' : ''}" data-action="filter-diplo" data-filter="${id}">${label}</button>`).join('')}</div>
      <div class="card" style="margin-top:8px">${rows}</div>`;
  }

  militaryPanel(st) {
    const c = st.countries[st.playerTag];
    if (!c) return this.panelHead('Military');
    const armies = countryArmies(st, st.playerTag);
    const navies = countryNavy(st, st.playerTag);
    const armyRows = armies.map((a) => {
      const p = st.provinces[a.provinceId];
      return `<div class="card">
        <div class="army-card">
          <div class="men">${menText(a.men)}</div>
          <div style="flex:1"><div class="small">${esc(p?.name || 'Unknown')}</div><div class="meta">${compText(a.men)} · morale ${Math.round(a.morale)}%${a.move ? ' · marching' : ''}${a.siege ? ' · besieging' : ''}</div></div>
          <div class="small dim">${esc(a.leader?.name || 'No commander')}<br>${a.leader ? `${a.leader.fire}/${a.leader.shock}/${a.leader.maneuver}/${a.leader.siege}` : ''}</div>
        </div>
        <div class="row" style="margin-top:8px">${bar(a.morale, 100, a.morale < 35 ? 'red' : 'green')}</div>
        <div class="btn-row">
          <button class="btn small gold" data-action="select-army" data-army="${a.id}">March</button>
          <button class="btn small" data-action="army-split" data-army="${a.id}">Split</button>
          <button class="btn small" data-action="army-merge" data-prov="${a.provinceId}">Merge</button>
          <button class="btn small danger" data-action="army-disband" data-army="${a.id}">Disband</button>
        </div>
      </div>`;
    }).join('') || '<div class="empty">No armies. Recruit below.</div>';
    const navyRows = navies.map((n) => {
      const p = st.provinces[n.provinceId];
      return `<div class="card"><div class="army-card"><div class="men">${navyShips(n)}</div><div style="flex:1"><div class="small">${esc(p?.name || 'At sea')}</div><div class="meta">${n.ships.galley} galley · ${n.ships.cog} cog · ${n.ships.caravel} caravel · morale ${Math.round(n.morale)}%</div></div>
        <button class="btn small gold" data-action="select-navy" data-navy="${n.id}">Sail</button></div></div>`;
    }).join('') || '<div class="empty">No fleets.</div>';
    const controlled = ownedProvinces(st, st.playerTag).filter((p) => p.controller === st.playerTag);
    const recProv = controlled.find((p) => p.id === this.recruitProvince) || st.provinces[c.capital] || controlled[0];
    const provSelect = `<select data-change="recruit-prov" style="width:100%;background:var(--panel-2);color:var(--ink);border:1px solid var(--border);border-radius:4px;padding:7px;margin-bottom:8px">
      ${controlled.map((p) => `<option value="${p.id}" ${recProv?.id === p.id ? 'selected' : ''}>${esc(p.name)} · ${p.dev.tax + p.dev.prod + p.dev.mp} dev</option>`).join('')}
    </select>`;
    const unitRows = Object.entries(UNIT_TYPES).map(([key, u]) => `<div class="peace-prov">
      <span class="nm">${u.icon} <b>${esc(u.name)}</b><div class="dv">${int(u.men)} men · ${u.cost} ducats · ${u.upkeep}/mo${key === 'artillery' ? ` · requires MIL ${u.tech}` : ''}</div></span>
      <button class="btn small ${key === 'mercenary' ? 'danger' : 'gold'}" data-action="recruit" data-prov="${recProv?.id ?? ''}" data-type="${key}" ${recProv ? '' : 'disabled'}>Recruit</button>
    </div>`).join('');
    const ports = controlled.filter((p) => p.port);
    const shipRows = ports.length ? Object.entries(SHIP_TYPES).map(([key, s]) => `<div class="peace-prov"><span class="nm">${esc(s.name)}<div class="dv">${s.cost} ducats · power ${s.power} · DIP ${s.tech}</div></span><button class="btn small" data-action="ship" data-prov="${ports[0].id}" data-type="${key}">Build</button></div>`).join('') : '<div class="empty">No controlled port.</div>';
    return `${this.panelHead(`${flag(c.tag, st, 'lg')} Military`, `Force limit ${int(c.forceLimit)}k · ${int(totalArmyMen(st, c.tag) / 1000)}k fielded`)}
      <div class="grid3">
        <div class="card center"><div class="small faint">Army</div><div class="big" style="font-size:20px">${int(totalArmyMen(st, c.tag) / 1000)}k</div></div>
        <div class="card center"><div class="small faint">Manpower</div><div class="big" style="font-size:20px">${int(c.manpower / 1000)}k</div><div class="small faint">of ${int(c.maxManpower / 1000)}k</div></div>
        <div class="card center"><div class="small faint">Navy</div><div class="big" style="font-size:20px">${int(navalStrength(st, c.tag))}</div><div class="small faint">${navies.length} fleets</div></div>
      </div>
      <div class="card"><div class="kv"><span>War exhaustion</span><b>${num(c.warExhaustion)}</b></div><div class="kv"><span>Discipline</span><b>${Math.round((c.modifiers.discipline || 0) * 100)}%</b></div><div class="kv"><span>Manpower recovery</span><b>${Math.round((c.modifiers.manpower || 0) * 100)}%</b></div></div>
      <div class="section-title">Armies</div>${armyRows}
      <div class="section-title">Fleets</div>${navyRows}
      <div class="section-title">Recruit</div>
      <div class="card">${provSelect}${unitRows}</div>
      <div class="section-title">Shipyard</div>
      <div class="card">${shipRows}</div>`;
  }

  techPanel(st) {
    const c = st.countries[st.playerTag];
    if (!c) return this.panelHead('Technology');
    const branches = [['adm', 'Administrative', 'Government, development and ideas'], ['dip', 'Diplomatic', 'Trade, colonisation and the navy'], ['mil', 'Military', 'Troops, tactics and fortifications']];
    const branchHtml = branches.map(([key, name, desc]) => {
      const lvl = c.tech[key];
      const cost = TECH_COST(lvl);
      const max = lvl >= 20;
      return `<div class="card"><div class="tech-branch">
        <div class="lvl">${lvl}</div>
        <div class="info"><div class="name"><b>${name}</b> — ${esc(techName(key, lvl))}</div><div class="desc">${desc}</div>
        <div class="row" style="margin-top:6px">${bar(c.points[key], max ? 1 : cost)}<span class="small mono">${Math.floor(c.points[key])} / ${max ? '—' : cost}</span></div></div>
        <button class="btn small gold" ${max || c.points[key] < cost ? 'disabled' : ''} data-action="research" data-branch="${key}">${max ? 'Max' : 'Research'}</button>
      </div></div>`;
    }).join('');
    const inst = Object.entries(c.institutions).map(([key, value]) => {
      const names = { renaissance: 'Renaissance', printing: 'Printing Press', colonialism: 'Colonialism', enlightenment: 'Enlightenment' };
      return `<div class="card"><div class="row between"><b>${names[key] || key}</b><span class="small">${Math.round(value)}%</span></div><div class="row" style="margin-top:6px">${bar(value, 100)}</div>
        <div class="btn-row"><button class="btn small" ${value < 50 || c.treasury < 100 || value >= 100 ? 'disabled' : ''} data-action="embrace" data-key="${key}">Embrace · 100</button></div></div>`;
    }).join('');
    return `${this.panelHead(`${flag(c.tag, st, 'lg')} Technology`, `Monarch points ${Math.floor(c.points.adm)} / ${Math.floor(c.points.dip)} / ${Math.floor(c.points.mil)}`)}
      <div class="card highlight"><div class="kv"><span>Administrative points</span><b>${Math.floor(c.points.adm)}</b></div><div class="kv"><span>Diplomatic points</span><b>${Math.floor(c.points.dip)}</b></div><div class="kv"><span>Military points</span><b>${Math.floor(c.points.mil)}</b></div><div class="small faint" style="margin-top:6px">Points accrue monthly from your ruler's skills, universities and the capital.</div></div>
      <div class="section-title">Branches</div>${branchHtml}
      <div class="section-title">Institutions</div>${inst}
      <div class="section-title">Milestones</div>
      <div class="card"><div class="kv"><span>Military 7</span><b>Field artillery</b></div><div class="kv"><span>Administrative 5</span><b>Universities</b></div><div class="kv"><span>Diplomatic 5</span><b>Colonisation range</b></div><div class="kv"><span>Administrative 8</span><b>Extra accepted culture</b></div></div>`;
  }

  morePanel(st) {
    const c = st.countries[st.playerTag];
    if (!c) return this.panelHead('More');
    const slots = ['auto', '1', '2', '3'].map((slot) => {
      const meta = this.app.getSaveMeta?.(slot);
      return `<div class="peace-prov">
        <span class="nm"><b>${slot === 'auto' ? 'Autosave' : `Slot ${slot}`}</b><div class="dv">${meta ? `${esc(meta.name)} · ${esc(meta.date)} · ${meta.ts ? new Date(meta.ts).toLocaleDateString() : ''}` : 'Empty'}</div></span>
        <button class="btn small" data-action="save" data-slot="${slot}">Save</button>
        <button class="btn small ${meta ? '' : ''}" ${meta ? '' : 'disabled'} data-action="load" data-slot="${slot}">Load</button>
        <button class="btn small danger" ${meta ? '' : 'disabled'} data-action="delete-save" data-slot="${slot}">✕</button>
      </div>`;
    }).join('');
    const log = (st.log || []).slice(0, 24).map((l) => `<div class="timeline-item"><div class="when">${esc(this.logDate(l.date))}</div>${esc(l.msg)}</div>`).join('') || '<div class="empty">Nothing has happened yet.</div>';
    const rank = this.app.playerRank?.() || { rank: 0, total: 0 };
    return `${this.panelHead(`${flag(c.tag, st, 'lg')} Campaign`, `Rank ${rank.rank}/${rank.total} · ${st.difficulty} difficulty`)}
      <div class="section-title">Saves</div>
      <div class="card">${slots}</div>
      <div class="btn-row"><button class="btn" data-action="export">Export Save</button><button class="btn" data-action="import">Import Save</button><input id="import-file" type="file" accept="application/json" style="display:none"></div>
      <div class="section-title">Settings</div>
      <div class="card">
        <div class="kv"><span>Autosave twice a year</span><button class="btn small ${st.settings.autosave ? 'green' : ''}" data-action="toggle-autosave">${st.settings.autosave ? 'On' : 'Off'}</button></div>
        <div class="kv"><span>Map labels</span><button class="btn small ${st.settings.labels ? 'green' : ''}" data-action="toggle-labels">${st.settings.labels ? 'On' : 'Off'}</button></div>
        <div class="kv"><span>Difficulty</span><b>${esc(DIFFICULTY[st.difficulty]?.name || st.difficulty)}</b></div>
      </div>
      <div class="section-title">Statistics</div>
      <div class="card">
        <div class="kv"><span>Battles fought</span><b>${st.stats.battles || 0}</b></div>
        <div class="kv"><span>Wars started</span><b>${st.stats.wars || 0}</b></div>
        <div class="kv"><span>Provinces taken</span><b>${st.stats.provincesTaken || 0}</b></div>
        <div class="kv"><span>Events witnessed</span><b>${st.stats.events || 0}</b></div>
        <div class="kv"><span>Score</span><b>${Math.round(c.score)}</b></div>
      </div>
      <div class="section-title">Chronicle</div>
      <div class="card"><div class="timeline">${log}</div></div>
      <div class="section-title">Actions</div>
      <div class="btn-row"><button class="btn" data-action="help">How to Play</button><button class="btn" data-action="restart">Main Menu</button></div>
      <div class="small faint center" style="margin-top:18px">Europa 1444 · an offline grand strategy sandbox</div>`;
  }

  logDate(n) {
    if (!n) return '';
    const y = Math.floor(n / 372);
    const rem = n % 372;
    const m = Math.max(1, Math.min(12, Math.floor(rem / 31)));
    const d = Math.max(1, rem % 31);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  }

  // ── Country panel ─────────────────────────────────────────
  openCountryPanel(tag) {
    if (!this.state?.countries?.[tag]) return;
    if (tag === this.state.playerTag) { this.openPanel('realm'); return; }
    this.countryTag = tag;
    this.panelTab = 'country';
    this.closeSheet();
    this.el.panel.classList.remove('hidden');
    this.el.tabs.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    this.renderPanel();
  }

  countryPanel(st) {
    const t = this.countryTag;
    const c = st.countries[t];
    const me = st.countries[st.playerTag];
    if (!c || !me) return this.panelHead('Court');
    const status = diploStatus(st, st.playerTag, t);
    const rel = relation(st, st.playerTag, t);
    const atWar = isAtWar(st, st.playerTag, t);
    const war = warsOf(st, st.playerTag).find((w) => w.attackers.includes(t) || w.defenders.includes(t));
    const army = totalArmyMen(st, t);
    const navy = navalStrength(st, t);
    const provs = ownedProvinces(st, t);
    const actions = [];
    if (!atWar) {
      if (rel < 200) actions.push(`<button class="btn small" data-action="improve" data-tag="${t}">Improve Relations · 25</button>`);
      if (!me.allies.includes(t) && !me.rivals.includes(t)) actions.push(`<button class="btn small" data-action="ally" data-tag="${t}">Form Alliance</button>`);
      if (me.allies.includes(t)) actions.push(`<button class="btn small danger" data-action="break-ally" data-tag="${t}">Break Alliance</button>`);
      if (!me.marriages.includes(t) && c.gov !== 'republic' && c.gov !== 'oligarchy') actions.push(`<button class="btn small" data-action="marry" data-tag="${t}">Royal Marriage</button>`);
      if (!me.guarantees.includes(t)) actions.push(`<button class="btn small" data-action="guarantee" data-tag="${t}">Guarantee · 20</button>`);
      if (!me.access.includes(t)) actions.push(`<button class="btn small" data-action="access" data-tag="${t}">Military Access · 15</button>`);
      if (!(me.tradeAgreements || []).includes(t)) actions.push(`<button class="btn small" data-action="trade-deal" data-tag="${t}">Trade Agreement</button>`);
      if (canDeclareWar(st, st.playerTag, t) === null) actions.push(`<button class="btn small danger" data-action="declare-war" data-tag="${t}">Declare War</button>`);
    } else if (war) {
      actions.push(`<button class="btn small gold" data-action="peace-open" data-war="${war.id}">Negotiate Peace</button>`);
    }
    if (c.overlord === st.playerTag) actions.push(`<button class="btn small gold" data-action="annex" data-tag="${t}">Annex Vassal</button>`);
    if (me.overlord === t) actions.push(`<button class="btn small danger" data-action="independence">Declare Independence</button>`);
    const theirClaims = c.claims.filter((id) => st.provinces[id]?.owner === st.playerTag);
    return `${this.panelHead(`${flag(t, st, 'lg')} ${esc(c.name)}`, `${esc(GOVERNMENTS[c.gov]?.name || c.gov)} · ${esc(c.ruler.title)} ${esc(c.ruler.name)} · ${esc(status)}`)}
      <div class="card highlight">
        <div class="row between"><div><div class="small faint">Ruler</div><b style="font-family:var(--serif);font-size:17px">${esc(c.ruler.name)}</b><div class="small dim">Age ${c.ruler.age} · ${c.ruler.adm}/${c.ruler.dip}/${c.ruler.mil} · ${esc(AI_PERSONALITIES[c.ai]?.name || c.ai)} AI</div></div>
        <div class="center"><div class="small faint">Relations</div><div class="big" style="font-size:24px;color:${rel >= 0 ? '#9ac88a' : '#d88070'}">${rel >= 0 ? '+' : ''}${rel}</div><div class="small dim">${esc(status)}</div></div></div>
      </div>
      <div class="grid3">
        <div class="card center"><div class="small faint">Provinces</div><div class="big" style="font-size:20px">${provs.length}</div></div>
        <div class="card center"><div class="small faint">Development</div><div class="big" style="font-size:20px">${totalDev(st, t)}</div></div>
        <div class="card center"><div class="small faint">Army</div><div class="big" style="font-size:20px">${int(army / 1000)}k</div></div>
      </div>
      <div class="card">
        <div class="kv"><span>Capital</span><b>${esc(st.provinces[c.capital]?.name || c.capitalName || '—')}</b></div>
        <div class="kv"><span>Religion / culture</span><b>${esc(RELIGIONS[c.religion]?.name || c.religion)} · ${esc(CULTURES[c.culture]?.name || c.culture)}</b></div>
        <div class="kv"><span>Technology</span><b>${c.tech.adm} / ${c.tech.dip} / ${c.tech.mil}</b></div>
        <div class="kv"><span>Navy strength</span><b>${int(navy)}</b></div>
        <div class="kv"><span>Treasury</span><b>${int(c.treasury)}</b></div>
        <div class="kv"><span>Stability / prestige</span><b>${c.stability >= 0 ? '+' : ''}${c.stability} · ${Math.round(c.prestige)}</b></div>
        ${theirClaims.length ? `<div class="kv"><span>Claims on you</span><b class="bad">${theirClaims.map((id) => esc(st.provinces[id].name)).join(', ')}</b></div>` : ''}
        ${c.allies.length ? `<div class="kv"><span>Allies</span><b>${c.allies.map((x) => esc(st.countries[x]?.name || x)).join(', ')}</b></div>` : ''}
        ${c.vassals.length ? `<div class="kv"><span>Vassals</span><b>${c.vassals.map((x) => esc(st.countries[x]?.name || x)).join(', ')}</b></div>` : ''}
      </div>
      ${actions.length ? `<div class="btn-row">${actions.join('')}</div>` : '<div class="empty">No diplomatic options available.</div>'}
      <div class="section-title">Their provinces</div>
      <div class="card">${provs.slice(0, 12).map((p) => `<div class="peace-prov"><span class="nm">${esc(p.name)}</span><span class="dv">${p.dev.tax + p.dev.prod + p.dev.mp} dev</span><button class="btn small" data-action="open-province" data-prov="${p.id}">Open</button></div>`).join('') || '<div class="empty">No provinces.</div>'}</div>`;
  }

  // ── Modals ────────────────────────────────────────────────
  showModal(html, kind) {
    this.modalKind = kind;
    this.el.modal.innerHTML = `<div class="modal-card">${html}</div>`;
    this.el.modal.classList.remove('hidden');
  }

  closeModal() {
    this.modalKind = null;
    this.el.modal?.classList.add('hidden');
    if (this.el.modal) this.el.modal.innerHTML = '';
  }

  showEventModal(ev) {
    const choices = ev.choices.map((ch, i) => `<button class="btn ${i === 0 ? 'gold' : ''}" data-action="event-choice" data-index="${i}">${esc(ch.label)}</button>`).join('');
    this.showModal(`<div class="event-date">${esc(ev.date || dateShort(this.state.date))} · ${ev.kind === 'historical' ? 'Historical Event' : 'Realm Event'}</div>
      <h2>${esc(ev.title)}</h2><p>${esc(ev.text)}</p><div class="choices">${choices}</div>`, 'event');
  }

  chooseEvent(index) {
    chooseEvent(this.state, index);
    this.shownEvent = null;
    this.closeModal();
    this.refresh(true);
    if (this.panelTab) this.renderPanel(true);
  }

  showPeaceOffer(pp) {
    this.showModal(`<div class="event-date">Diplomatic Offer</div><h2>${esc(pp.title)}</h2><p>${esc(pp.text)}</p>
      <div class="choices"><button class="btn gold" data-action="peace-accept">Accept Terms</button><button class="btn" data-action="peace-decline">Decline</button></div>`, 'peace');
  }

  showPeace(warId) {
    const st = this.state;
    const war = st.wars.find((w) => w.id === warId);
    if (!war) return;
    this.peaceWarId = warId;
    const side = sideOf(war, st.playerTag);
    const enemy = side === 'attacker' ? war.defenders : war.attackers;
    const friend = side === 'attacker' ? war.attackers : war.defenders;
    const score = side === 'attacker' ? war.score : -war.score;
    const occupied = st.provinces.filter((p) => enemy.includes(p.owner) && friend.includes(p.controller) && !p.capital);
    const rows = occupied.length ? occupied.map((p) => `<label class="peace-prov"><input type="checkbox" class="peace-prov-cb" value="${p.id}">
      <span class="nm">${esc(p.name)}</span><span class="dv">${p.dev.tax + p.dev.prod + p.dev.mp} dev · ${esc(st.countries[p.owner]?.name || p.owner)}</span></label>`).join('') : '<div class="empty">No enemy provinces occupied. Win battles and sieges to raise your war score.</div>';
    const maxGold = Math.max(0, Math.min(500, Math.floor((st.countries[enemy[0]]?.treasury || 0))));
    this.showModal(`<h2>Negotiate Peace</h2><div class="event-date">${esc(war.name)} · war score ${score >= 0 ? '+' : ''}${Math.round(score)}</div>
      <p>Select the provinces you wish to demand. You must occupy them and have enough war score. A white peace ends the war with no gains.</p>
      <div style="margin:10px 0">${rows}</div>
      <div class="kv"><span>Gold demand</span><input id="peace-gold" type="number" min="0" max="${maxGold}" value="0" style="width:90px;background:var(--panel-2);color:var(--ink);border:1px solid var(--border);border-radius:4px;padding:5px"></div>
      <div class="choices"><button class="btn gold" data-action="peace-sign" data-war="${warId}">Send Peace Offer</button>
      <button class="btn" data-action="peace-white" data-war="${warId}">White Peace</button>
      <button class="btn ghost" data-action="close-modal">Cancel</button></div>`, 'peace');
  }

  signPeace(warId, white = false) {
    const st = this.state;
    const ids = white ? [] : [...this.el.modal.querySelectorAll('.peace-prov-cb:checked')].map((el) => +el.value);
    const gold = white ? 0 : Math.max(0, Math.min(500, +(document.getElementById('peace-gold')?.value || 0)));
    const res = playerPeace(st, warId, { provinces: ids, gold, releaseVassals: [] });
    if (!res.ok) { this.showToast(res.msg, 'war'); return; }
    this.showToast(res.msg, 'good');
    this.closeModal();
    this.refresh(true);
    if (this.panelTab) this.renderPanel(true);
  }

  showGameOver(go) {
    const st = this.state;
    const c = st.countries[st.playerTag];
    this.showModal(`<div class="event-date">${go.victory ? 'Campaign Complete' : 'Campaign Ended'}</div>
      <h2>${go.victory ? 'A Dynasty Endures' : 'The Realm Has Fallen'}</h2>
      <p>${esc(go.text)}</p>
      <div class="card"><div class="kv"><span>Final date</span><b>${dateShort(st.date)}</b></div>
        <div class="kv"><span>Development</span><b>${c ? totalDev(st, c.tag) : 0}</b></div>
        <div class="kv"><span>Provinces</span><b>${c ? ownedProvinces(st, c.tag).length : 0}</b></div>
        <div class="kv"><span>Battles / wars</span><b>${st.stats.battles || 0} / ${st.stats.wars || 0}</b></div></div>
      <div class="choices"><button class="btn gold" data-action="new-campaign">New Campaign</button>
      <button class="btn" data-action="load" data-slot="auto">Load Autosave</button></div>`, 'gameover');
  }

  showMapModes() {
    const active = this.app.map.mode;
    const opts = Object.entries(MAP_MODES).map(([key, m]) => `<button class="btn map-mode-opt ${key === active ? 'active' : ''}" data-action="set-map-mode" data-mode="${key}"><span>${m.icon}</span>${esc(m.name)}</button>`).join('');
    this.showModal(`<h2>Map Modes</h2><p>Change how the world is painted. Political shows realms; the others reveal terrain, faith, culture, development, forts and trade.</p><div class="map-mode-grid">${opts}</div><button class="btn block modal-close" data-action="close-modal">Close</button>`, 'mapmode');
  }

  showMenu() {
    const st = this.state;
    const c = st.countries[st.playerTag];
    this.showModal(`<div class="event-date">${dateShort(st.date)} · ${esc(c?.name || '')}</div><h2>Campaign Menu</h2>
      <div class="choices">
        <button class="btn gold" data-action="save" data-slot="auto">Save to Autosave</button>
        <button class="btn" data-action="open-panel" data-tab="more">Saves &amp; Settings</button>
        <button class="btn" data-action="help">How to Play</button>
        <button class="btn" data-action="restart">Return to Main Menu</button>
        <button class="btn ghost" data-action="close-modal">Resume</button>
      </div>`, 'menu');
  }

  showHelp() {
    this.showModal(`<h2>How to Play</h2>
      <p><b>The map.</b> Drag to pan, pinch or scroll to zoom, tap a province to inspect it. Use the map-mode button on the left to switch between political, terrain, religion, culture, development, military and trade views.</p>
      <p><b>Time.</b> The game begins on 1 January 1444. Use the speed controls to pause or run at one of four speeds. Events and peace offers pause the campaign automatically.</p>
      <p><b>Your realm.</b> The Realm tab holds your ruler, stability, legitimacy, estates, reforms and laws. The Economy tab shows income, expenses, loans and trade. The Military tab recruits regiments and fleets. The Tech tab spends monarch points on administration, diplomacy and war.</p>
      <p><b>War.</b> Select an army and tap a destination to march. Armies siege enemy provinces; occupied land raises your war score. Open Diplomacy to negotiate peace. You cannot enter neutral territory without military access, an alliance, or a war.</p>
      <p><b>Diplomacy.</b> Improve relations, marry, ally, guarantee, trade and fabricate claims. Aggressive expansion provokes coalitions. Vassals can be annexed once relations are high.</p>
      <p><b>Save.</b> Campaigns autosave twice a year. Manual saves live in More → Saves, and can be exported as JSON. Everything runs offline.</p>
      <button class="btn block modal-close gold" data-action="close-modal">Understood</button>`, 'help');
  }
}
