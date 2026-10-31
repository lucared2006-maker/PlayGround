// Core state, economy, provinces and internal politics.
import {
  START_DATE, GOODS, TERRAIN, BUILDINGS, GOVERNMENTS, REFORMS, LAWS,
  TRADE_NODES, RELIGIONS, CULTURES, UNIT_TYPES, AI_PERSONALITIES, TECH_COST, DIFFICULTY,
} from '../data/constants.js';
import { COUNTRY_DATA } from '../data/countries.js';

// ── Utilities ──────────────────────────────────────────────────
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const round2 = (v) => Math.round(v * 100) / 100;
export const monthDays = (y, m) => [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
export const dateString = (d) => `${d.d} ${MONTHS[d.m - 1]} ${d.y}`;
export const dateShort = (d) => `${String(d.d).padStart(2, '0')}.${String(d.m).padStart(2, '0')}.${d.y}`;
export const dateNum = (d) => d.y * 372 + d.m * 31 + d.d;

export function addDays(date, n = 1) {
  const d = { ...date };
  for (let i = 0; i < n; i++) {
    d.d++;
    if (d.d > monthDays(d.y, d.m)) { d.d = 1; d.m++; if (d.m > 12) { d.m = 1; d.y++; } }
  }
  return d;
}

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function rand(state) {
  state.rngSeed = (state.rngSeed + 0x6D2B79F5) | 0;
  let t = Math.imul(state.rngSeed ^ (state.rngSeed >>> 15), 1 | state.rngSeed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const randInt = (state, a, b) => a + Math.floor(rand(state) * (b - a + 1));
export const pick = (state, arr) => arr[Math.floor(rand(state) * arr.length)];

export function getCountry(state, tag) { return state.countries[tag]; }
export function ownedProvinces(state, tag) { return state.provinces.filter((p) => p.owner === tag); }
export function controlledProvinces(state, tag) { return state.provinces.filter((p) => p.controller === tag); }
export function totalDev(state, tag) { return ownedProvinces(state, tag).reduce((s, p) => s + p.dev.tax + p.dev.prod + p.dev.mp, 0); }
export function countryArmies(state, tag) { return state.armies.filter((a) => a.owner === tag); }
export function countryNavy(state, tag) { return state.navies.filter((n) => n.owner === tag); }
export function armyMen(a) { return a.men.infantry + a.men.cavalry + a.men.archer + a.men.artillery + a.men.mercenary; }
export function navyShips(n) { return n.ships.galley + n.ships.cog + n.ships.caravel; }
export function relation(state, a, b) { return state.countries[a]?.diplo?.[b]?.rel ?? 0; }
export function setRelation(state, a, b, v) {
  const ca = state.countries[a], cb = state.countries[b];
  if (!ca || !cb) return;
  ca.diplo[b] = ca.diplo[b] || { rel: 0, truce: 0 };
  cb.diplo[a] = cb.diplo[a] || { rel: 0, truce: 0 };
  ca.diplo[b].rel = clamp(Math.round(v), -200, 200);
  cb.diplo[a].rel = ca.diplo[b].rel;
}
export function addRelation(state, a, b, v) { setRelation(state, a, b, relation(state, a, b) + v); }
export function truceUntil(state, a, b) { return state.countries[a]?.diplo?.[b]?.truce || 0; }
export function setTruce(state, a, b, until) {
  if (!state.countries[a] || !state.countries[b]) return;
  state.countries[a].diplo[b] = state.countries[a].diplo[b] || { rel: 0, truce: 0 };
  state.countries[b].diplo[a] = state.countries[b].diplo[a] || { rel: 0, truce: 0 };
  state.countries[a].diplo[b].truce = until;
  state.countries[b].diplo[a].truce = until;
}
export function isAtWar(state, a, b) {
  return state.wars.some((w) => (w.attackers.includes(a) && w.defenders.includes(b)) || (w.attackers.includes(b) && w.defenders.includes(a)));
}
export function warsOf(state, tag) { return state.wars.filter((w) => w.attackers.includes(tag) || w.defenders.includes(tag)); }
export function sideOf(war, tag) { return war.attackers.includes(tag) ? 'attacker' : war.defenders.includes(tag) ? 'defender' : null; }
export function warScore(state, war) {
  let s = war.battleScore || 0;
  for (const p of state.provinces) {
    const dev = p.dev.tax + p.dev.prod + p.dev.mp;
    if (war.defenders.includes(p.owner) && war.attackers.includes(p.controller)) s += dev * 0.35 + (p.capital ? 8 : 0);
    else if (war.attackers.includes(p.owner) && war.defenders.includes(p.controller)) s -= dev * 0.35 + (p.capital ? 8 : 0);
  }
  return clamp(Math.round(s), -100, 100);
}
export function countryName(state, tag) { return state.countries[tag]?.name || tag; }

// ── Initialisation ─────────────────────────────────────────────
export function createGame({ playerTag, provinces, difficulty = 'normal', seed = 1444 }) {
  const state = {
    version: 2,
    rngSeed: seed,
    date: { ...START_DATE },
    playerTag,
    difficulty,
    speed: 1,
    paused: true,
    provinces,
    countries: {},
    armies: [],
    navies: [],
    wars: [],
    nextArmyId: 1,
    nextNavyId: 1,
    nextWarId: 1,
    flags: {},
    log: [],
    notifications: [],
    pendingEvent: null,
    pendingPeace: null,
    trade: {},
    stats: { battles: 0, wars: 0, provincesTaken: 0, events: 0 },
    settings: { autosave: true, labels: true, animations: true },
  };

  provinces.forEach((p, i) => {
    p.id = i;
    p.owner = p.owner === '-' ? null : p.owner;
    p.controller = p.owner;
    p.dev = { tax: p.dev?.tax ?? p.tax ?? 3, prod: p.dev?.prod ?? p.prod ?? 3, mp: p.dev?.mp ?? p.mp ?? 3 };
    delete p.tax; delete p.prod; delete p.mp;
    p.pop = Math.round((p.dev.tax + p.dev.prod + p.dev.mp) * 6200 + 1500);
    p.autonomy = p.owner ? 15 + (p.fort || 0) * 4 : 0;
    p.unrest = 0;
    p.buildings = p.buildings || {};
    p.fort = p.fort || 0;
    p.construction = null;
    p.conversion = null;
    p.colony = null;
    p.capital = false;
    p.siege = null;
    p.occupiedMonths = 0;
    p.tradeNode = null;
    p.religiousUnity = 100;
    p.blockaded = false;
    // nearest trade node
    let best = null, bd = Infinity;
    for (const n of TRADE_NODES) {
      const dx = (p.lon - n.lon) * Math.cos(((p.lat + n.lat) / 2) * Math.PI / 180);
      const dy = p.lat - n.lat;
      const d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = n.id; }
    }
    p.tradeNode = best;
  });

  for (const [tag, raw] of Object.entries(COUNTRY_DATA)) {
    if (!provinces.some((p) => p.owner === tag)) continue;
    const c = {
      tag,
      name: raw.name,
      adj: raw.adj,
      color: raw.color,
      gov: raw.gov,
      religion: raw.religion,
      culture: raw.culture,
      capitalName: raw.capital,
      capital: provinces.find((p) => p.name === raw.capital && p.owner === tag)?.id ?? provinces.find((p) => p.owner === tag)?.id,
      tech: { adm: raw.tech[0], dip: raw.tech[1], mil: raw.tech[2] },
      points: { adm: 0, dip: 0, mil: 0 },
      treasury: raw.treasury ?? 50,
      inflation: 0,
      loans: [],
      manpower: 0,
      maxManpower: 0,
      stability: 0,
      prestige: 0,
      legitimacy: 90,
      republicanTradition: 60,
      warExhaustion: 0,
      corruption: 0,
      tolerance: 0,
      centralization: 20,
      accepted: [raw.culture],
      bonuses: {},
      reforms: [],
      laws: {},
      estates: {
        nobles: { loyalty: 50, influence: 30 },
        clergy: { loyalty: 50, influence: 25 },
        burghers: { loyalty: 50, influence: 25 },
        peasants: { loyalty: 50, influence: 20 },
      },
      diplo: {},
      allies: [],
      marriages: [],
      vassals: [],
      overlord: null,
      guarantees: [],
      access: [],
      rivals: [],
      claims: [],
      truces: {},
      royalMarriage: [],
      aiState: { lastDiplo: 0, lastWar: 0, lastBuild: 0, target: null },
      flags: {},
      ruler: {
        name: raw.ruler, title: raw.title,
        adm: raw.skills[0], dip: raw.skills[1], mil: raw.skills[2],
        age: raw.age,
        heir: raw.heir ? { name: raw.heir[0], age: raw.heir[1], adm: raw.heir[2], dip: raw.heir[3], mil: raw.heir[4] } : null,
        regency: !!raw.regency,
      },
      institutions: { renaissance: 0, printing: 0, colonialism: 0, enlightenment: 0 },
      modifiers: {},
      income: 0,
      expense: 0,
      lastIncome: {},
      forceLimit: 0,
      score: 0,
      alive: true,
      hre: !!raw.hre,
      ai: raw.ai || 'builder',
      personality: AI_PERSONALITIES[raw.ai || 'builder'] || AI_PERSONALITIES.builder,
      flagsData: raw,
    };
    c.diplo[tag] = { rel: 0, truce: 0 };
    // initial army
    const cap = c.capital;
    const dev = provinces.filter((p) => p.owner === tag).reduce((s, p) => s + p.dev.tax + p.dev.prod + p.dev.mp, 0);
    const regs = raw.army || [Math.max(1, Math.round(dev / 14)), Math.max(1, Math.round(dev / 45)), 0];
    c.armyStart = { infantry: regs[0] * 1000, cavalry: regs[1] * 1000, artillery: regs[2] * 1000 };
    c.navyStart = raw.navy || 0;
    state.countries[tag] = c;
  }

  // capitals & fortifications
  for (const c of Object.values(state.countries)) {
    const cap = state.provinces[c.capital];
    if (cap) { cap.capital = true; cap.fort = Math.max(cap.fort, c.gov === 'empire' ? 3 : 2); cap.autonomy = 5; }
  }

  // armies, navies, manpower
  for (const c of Object.values(state.countries)) {
    const cap = c.capital;
    if (cap != null) {
      if (c.armyStart.infantry + c.armyStart.cavalry + c.armyStart.artillery > 0) {
        state.armies.push(makeArmy(state, c.tag, cap, c.armyStart));
      }
    }
    if (c.navyStart > 0) {
      const home = state.provinces.find((p) => p.owner === c.tag && p.port) || state.provinces[c.capital];
      if (home) state.navies.push(makeNavy(state, c.tag, home.id, c.navyStart, c.tech.dip));
    }
    c.maxManpower = Math.round(provinces.filter((p) => p.owner === c.tag).reduce((s, p) => s + p.dev.mp, 0) * 320 * (1 + (c.modifiers.manpower || 0)) + 2500);
    c.manpower = c.maxManpower;
    // defaults laws
    c.laws.succession = c.gov === 'republic' || c.gov === 'oligarchy' ? 'succession_elective' : 'succession_primogeniture';
    c.laws.army = c.gov === 'tribal' || c.gov === 'horde' ? 'army_serf' : 'army_serf';
    c.laws.navy = 'navy_merchant';
    c.laws.tolerance = c.gov === 'republic' || c.gov === 'oligarchy' ? 'tolerance_plural' : 'tolerance_none';
    c.laws.economy = 'economy_mercantile';
    delete c.armyStart; delete c.navyStart;
  }

  initDiplomacy(state);
  recomputeAll(state);
  updateTrade(state);
  // Prime the economy display so the HUD is meaningful before the first
  // monthly tick. This does not add a month of income to the treasury.
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.normal;
  for (const c of Object.values(state.countries)) {
    const inc = incomeBreakdown(state, c);
    const exp = expenseBreakdown(state, c);
    const diffMod = c.tag === playerTag ? diff.playerBonus : diff.aiBonus;
    c.lastIncome = inc;
    c.income = inc.total * diffMod;
    c.expense = exp.total;
    c.net = inc.total * diffMod - exp.total;
  }
  return state;
}

function initDiplomacy(state) {
  const C = state.countries;
  for (const c of Object.values(C)) {
    const raw = c.flagsData || {};
    for (const a of raw.allies || []) if (C[a]) {
      if (!c.allies.includes(a)) c.allies.push(a);
      if (!C[a].allies.includes(c.tag)) C[a].allies.push(c.tag);
      setRelation(state, c.tag, a, 60);
    }
    for (const a of raw.royalMarriage || []) if (C[a]) {
      if (!c.marriages.includes(a)) c.marriages.push(a);
      if (!C[a].marriages.includes(c.tag)) C[a].marriages.push(c.tag);
      setRelation(state, c.tag, a, 40);
    }
    for (const a of raw.vassals || []) if (C[a]) {
      if (!c.vassals.includes(a)) c.vassals.push(a);
      C[a].overlord = c.tag;
      setRelation(state, c.tag, a, 80);
    }
    if (raw.vassalOf && C[raw.vassalOf]) {
      c.overlord = raw.vassalOf;
      if (!C[raw.vassalOf].vassals.includes(c.tag)) C[raw.vassalOf].vassals.push(c.tag);
      setRelation(state, c.tag, raw.vassalOf, 70);
    }
    for (const a of raw.rivals || []) if (C[a]) {
      c.rivals.push(a); if (!C[a].rivals.includes(c.tag)) C[a].rivals.push(c.tag);
      setRelation(state, c.tag, a, -120);
    }
  }
  // defaults: same religion/culture, neighbours, HRE
  for (const c of Object.values(C)) {
    for (const o of Object.values(C)) {
      if (c.tag === o.tag) continue;
      if (c.diplo[o.tag]) continue;
      let r = 0;
      if (c.religion === o.religion) r += 8;
      if (c.culture === o.culture) r += 8;
      if (c.hre && o.hre) r += 5;
      if (c.rivals.includes(o.tag)) r -= 60;
      setRelation(state, c.tag, o.tag, r);
    }
  }
  // historical wars
  for (const c of Object.values(C)) {
    for (const t of c.flagsData?.atWarWith || []) {
      if (C[t] && !state.wars.some((w) => (w.attackers.includes(c.tag) && w.defenders.includes(t)) || (w.attackers.includes(t) && w.defenders.includes(c.tag)))) {
        state.wars.push({
          id: state.nextWarId++, name: `${c.name}–${C[t].name} War`,
          attackers: [c.tag], defenders: [t], leaderA: c.tag, leaderB: t,
          score: 0, battleScore: 0, start: dateNum(state.date), cb: 'conquest', history: [], duration: 0,
        });
        setRelation(state, c.tag, t, -150);
        state.stats.wars++;
      }
    }
  }
}

export function makeArmy(state, owner, provinceId, men) {
  const id = state.nextArmyId++;
  return {
    id, owner, provinceId,
    men: { infantry: men.infantry || 0, cavalry: men.cavalry || 0, archer: men.archer || 0, artillery: men.artillery || 0, mercenary: men.mercenary || 0 },
    morale: 100,
    leader: makeLeader(state),
    move: null,
    siege: 0,
    battle: null,
  };
}
export function makeNavy(state, owner, provinceId, ships, tech = 3) {
  const id = state.nextNavyId++;
  const galley = Math.round(ships * 0.5), cog = Math.round(ships * 0.35), caravel = Math.max(0, ships - galley - cog);
  return { id, owner, provinceId, ships: { galley, cog, caravel }, morale: 100, move: null, mission: 'patrol' };
}
export function makeLeader(state) {
  const names = ['Jean de Bueil', 'John Talbot', 'Jan Žižka', 'Francesco Sforza', 'Hunyadi', 'Skanderbeg', 'Mehmed', 'Bertrand du Guesclin', 'Roger de Flor', 'Andrea Doria', 'John Hawkwood', 'Enguerrand de Coucy', 'Alfonso de Albuquerque', 'Vlad the Impaler'];
  return {
    name: names[randInt(state, 0, names.length - 1)],
    fire: randInt(state, 0, 3), shock: randInt(state, 0, 3),
    maneuver: randInt(state, 0, 3), siege: randInt(state, 0, 2),
  };
}

// ── Modifiers ──────────────────────────────────────────────────
export function computeModifiers(state, c) {
  const m = {
    tax: 0, production: 0, trade: 0, tradePower: 0, discipline: 0, manpower: 0,
    armyCost: 0, shipCost: 0, unrest: 0, tolerance: 0, missionary: 0,
    legitimacy: 0, points: 0, forceLimit: 0, colonize: 0, navy: 0, morale: 0,
  };
  const gov = GOVERNMENTS[c.gov];
  if (c.gov === 'monarchy') { m.manpower += 0.05; m.legitimacy += 5; }
  if (c.gov === 'republic') { m.trade += 0.1; m.tolerance += 1; m.points += 0.2; }
  if (c.gov === 'theocracy') { m.missionary += 0.02; m.unrest -= 0.05; }
  if (c.gov === 'oligarchy') { m.trade += 0.15; m.tax += 0.05; }
  if (c.gov === 'empire') { m.forceLimit += 0.2; m.legitimacy += 5; }
  if (c.gov === 'tribal') { m.armyCost -= 0.2; m.tax -= 0.15; m.manpower += 0.1; }
  if (c.gov === 'horde') { m.tax -= 0.25; m.manpower += 0.15; m.discipline += 0.05; }
  for (const r of c.reforms) {
    const ref = REFORMS[r]; if (!ref?.effects) continue;
    for (const [k, v] of Object.entries(ref.effects)) m[k] = (m[k] || 0) + v;
  }
  for (const l of Object.values(c.laws)) {
    if (l === 'army_serf') { m.armyCost -= 0.25; m.discipline -= 0.1; }
    if (l === 'army_professional') { m.discipline += 0.1; m.armyCost += 0.15; }
    if (l === 'navy_merchant') { m.tradePower += 0.2; m.shipCost -= 0.1; }
    if (l === 'navy_war') { m.navy += 0.15; }
    if (l === 'tolerance_none') { m.missionary += 0.02; m.tolerance -= 3; m.unrest += 0.05; }
    if (l === 'tolerance_plural') { m.tolerance += 3; m.missionary -= 0.01; m.unrest -= 0.05; }
    if (l === 'economy_mercantile') { m.tax += 0.1; m.production -= 0.05; }
    if (l === 'economy_agrarian') { m.production += 0.15; m.tax -= 0.05; }
    if (l === 'succession_salic') { m.legitimacy += 10; }
    if (l === 'succession_elective') { m.legitimacy += 5; }
  }
  const e = c.estates;
  if (e.nobles.loyalty > 60) { m.manpower += 0.1; m.discipline += 0.02; }
  if (e.nobles.loyalty < 30) { m.unrest += 0.1; }
  if (e.clergy.loyalty > 60) { m.missionary += 0.01; m.unrest -= 0.03; }
  if (e.burghers.loyalty > 60) { m.trade += 0.1; m.tax += 0.05; }
  if (e.peasants.loyalty > 60) { m.manpower += 0.05; m.unrest -= 0.03; }
  if (e.peasants.loyalty < 30) { m.unrest += 0.08; }
  m.tolerance += Math.floor(c.tech.adm / 6);
  m.tolerance += c.modifiers.toleranceBase || 0;
  if (c.stability > 0) m.unrest -= c.stability * 0.03;
  if (c.stability < 0) m.unrest += -c.stability * 0.04;
  m.unrest += c.warExhaustion * 0.004;
  if (c.prestige > 50) m.tradePower += 0.05;
  if (c.legitimacy < 50) m.unrest += 0.03;
  m.forceLimit += c.centralization / 500;
  if (c.bonuses) for (const [k, v] of Object.entries(c.bonuses)) m[k] = (m[k] || 0) + v;
  return m;
}

export function recomputeAll(state) {
  for (const c of Object.values(state.countries)) {
    c.modifiers = computeModifiers(state, c);
    c.forceLimit = Math.round(5 + totalDev(state, c.tag) * 0.25 + (c.modifiers.forceLimit || 0) * 20);
    const owned = ownedProvinces(state, c.tag);
    c.maxManpower = Math.round(owned.reduce((s, p) => s + p.dev.mp * 320 * (1 + (c.modifiers.manpower || 0)), 0) + 2500);
    c.manpower = Math.min(c.manpower, c.maxManpower);
  }
  recomputeUnrest(state);
}

// ── Trade ──────────────────────────────────────────────────────
export function updateTrade(state) {
  const nodes = {};
  for (const n of TRADE_NODES) nodes[n.id] = { ...n, value: 0, powers: {}, totalPower: 0 };
  for (const p of state.provinces) {
    if (!p.owner || !nodes[p.tradeNode]) continue;
    if (p.controller !== p.owner) continue;
    const v = (GOODS[p.good]?.price || 2) * p.dev.prod * 0.06 * (1 - p.autonomy / 100) * (1 + (p.buildings.workshop || 0) * 0.2);
    nodes[p.tradeNode].value += v;
  }
  // two passes of downstream flow
  for (let pass = 0; pass < 2; pass++) {
    for (const n of Object.values(nodes)) {
      if (n.down && nodes[n.down]) nodes[n.down].value += n.value * 0.18;
    }
  }
  for (const p of state.provinces) {
    if (!p.owner || !nodes[p.tradeNode]) continue;
    const c = state.countries[p.owner];
    if (!c || p.controller !== p.owner) continue;
    const n = nodes[p.tradeNode];
    const power = (p.dev.tax + p.dev.prod + p.dev.mp) * 0.4 + (p.port ? 1.2 : 0) + (p.buildings.market || 0) * 2 + (p.buildings.dock || 0) * 2;
    n.powers[p.owner] = (n.powers[p.owner] || 0) + power * (1 + (c.modifiers.tradePower || 0));
    n.totalPower += power * (1 + (c.modifiers.tradePower || 0));
  }
  for (const c of Object.values(state.countries)) {
    let income = 0;
    for (const n of Object.values(nodes)) {
      const power = n.powers[c.tag] || 0;
      if (!power || !n.totalPower) continue;
      income += n.value * (power / n.totalPower) * 0.20 * (1 + (c.modifiers.trade || 0));
    }
    c.tradeIncome = income;
  }
  state.trade = nodes;
}

// ── Economy ────────────────────────────────────────────────────
export const TAX_FACTOR = 0.18;
export const PROD_FACTOR = 0.05;

export function incomeBreakdown(state, c) {
  let tax = 0, production = 0, gold = 0, trade = c.tradeIncome || 0;
  const stabilityMod = 1 + c.stability * 0.03;
  for (const p of ownedProvinces(state, c.tag)) {
    if (p.controller !== c.tag) continue;
    const auto = 1 - p.autonomy / 100;
    tax += p.dev.tax * TAX_FACTOR * auto * (1 + (p.buildings.market || 0) * 0.12) * (1 + (c.modifiers.tax || 0)) * stabilityMod * (c.taxRate ?? 1);
    production += (GOODS[p.good]?.price || 2) * p.dev.prod * PROD_FACTOR * auto * (1 + (p.buildings.workshop || 0) * 0.2) * (1 + (c.modifiers.production || 0));
    if (p.good === 'gold') gold += p.dev.prod * 0.12;
  }
  const corruption = (tax + production + trade + gold) * (c.corruption / 100);
  const total = tax + production + trade + gold - corruption;
  return { tax, production, trade, gold, corruption, total, stabilityMod };
}

export function expenseBreakdown(state, c) {
  let army = 0;
  for (const a of countryArmies(state, c.tag)) {
    army += (a.men.infantry * UNIT_TYPES.infantry.upkeep + a.men.cavalry * UNIT_TYPES.cavalry.upkeep + a.men.archer * UNIT_TYPES.archer.upkeep + a.men.artillery * UNIT_TYPES.artillery.upkeep + a.men.mercenary * UNIT_TYPES.mercenary.upkeep) / 1000;
  }
  army *= (c.armyMaintenance ?? 0.85) * (1 + (c.modifiers.armyCost || 0));
  let navy = 0;
  for (const n of countryNavy(state, c.tag)) navy += navyShips(n) * 0.14 * (c.navyMaintenance ?? 0.8);
  let forts = 0;
  for (const p of ownedProvinces(state, c.tag)) forts += p.fort * 0.3 * (c.fortMaintenance ?? 0.8);
  let interest = 0;
  for (const l of c.loans) interest += l.amount * l.rate / 12;
  const court = 0.7 + totalDev(state, c.tag) * 0.01;
  const total = army + navy + forts + interest + court;
  return { army, navy, forts, interest, court, total };
}

export function monthlyEconomy(state, c) {
  const inc = incomeBreakdown(state, c);
  const exp = expenseBreakdown(state, c);
  const diff = DIFFICULTY[state.difficulty] || DIFFICULTY.normal;
  const diffMod = c.tag === state.playerTag ? diff.playerBonus : diff.aiBonus;
  c.lastIncome = inc;
  c.income = inc.total * diffMod;
  c.expense = exp.total;
  const net = inc.total * diffMod - exp.total;
  c.treasury = round2(c.treasury + net);
  c.net = net;
  if (c.treasury < 0) {
    if (c.loans.length < 8) {
      const amount = Math.max(50, Math.round((inc.total * 10 + 50) / 10) * 10);
      c.loans.push({ amount, rate: 0.05, taken: dateNum(state.date) });
      c.treasury = round2(c.treasury + amount);
      c.inflation = round2(c.inflation + 0.4);
      notify(state, c.tag, `A loan of ${amount} ducats was taken to cover the deficit.`);
    } else {
      c.treasury = 0;
      c.loans = [];
      c.inflation = round2(c.inflation + 5);
      c.stability = clamp(c.stability - 2, -3, 3);
      c.prestige = Math.max(-100, c.prestige - 40);
      c.corruption = Math.min(50, c.corruption + 5);
      notify(state, c.tag, 'The treasury has defaulted! Bankruptcy shakes the realm.');
    }
  }
  // inflation drift
  c.inflation = clamp(round2(c.inflation + c.loans.length * 0.02 - 0.01), 0, 40);
  // monarch points
  const cap = state.provinces[c.capital];
  const uni = ownedProvinces(state, c.tag).reduce((s, p) => s + (p.buildings.university || 0), 0);
  const gain = 1.6 + (c.ruler.adm + c.ruler.dip + c.ruler.mil) * 0.18 + uni * 0.15 + (cap?.dev.tax || 0) * 0.02 + (c.modifiers.points || 0);
  c.points.adm = Math.min(999, c.points.adm + gain + c.ruler.adm * 0.12);
  c.points.dip = Math.min(999, c.points.dip + gain + c.ruler.dip * 0.12);
  c.points.mil = Math.min(999, c.points.mil + gain + c.ruler.mil * 0.12);
  // manpower
  const regen = c.maxManpower * 0.014 * (1 + (c.modifiers.manpower || 0)) * (1 - c.warExhaustion / 120);
  c.manpower = Math.min(c.maxManpower, Math.round(c.manpower + regen));
  // war exhaustion
  const atWar = warsOf(state, c.tag).length > 0;
  c.warExhaustion = clamp(round2(c.warExhaustion + (atWar ? 0.35 : -0.18)), 0, 20);
  // estates drift
  for (const e of Object.values(c.estates)) {
    e.loyalty = clamp(round2(e.loyalty + (e.loyalty < 50 ? 0.6 : -0.25)), 0, 100);
    e.influence = clamp(round2(e.influence + (c.centralization > 50 ? -0.08 : 0.04)), 5, 80);
  }
  // score
  c.score = Math.round(totalDev(state, c.tag) + c.tech.adm * 8 + c.tech.dip * 8 + c.tech.mil * 8 + c.prestige + c.stability * 5 + c.treasury / 20);
}

export function recomputeUnrest(state) {
  for (const p of state.provinces) {
    if (!p.owner) { p.unrest = 0; continue; }
    const c = state.countries[p.owner];
    if (!c) { p.unrest = 0; continue; }
    const rel = RELIGIONS[p.religion], stateRel = RELIGIONS[c.religion];
    let u = 0;
    if (p.religion !== c.religion) u += rel?.group === stateRel?.group ? 4 : 11;
    if (p.culture !== c.culture) u += c.accepted.includes(p.culture) ? 2 : 7;
    u += p.autonomy * 0.12;
    u += (c.warExhaustion || 0) * 0.5;
    u += (c.modifiers.unrest || 0) * 40;
    u += (c.stability < 0 ? -c.stability * 4 : -c.stability * 2);
    u -= (p.buildings.temple || 0) * 3;
    u -= (p.buildings.courthouse || 0) * 2;
    u -= (c.modifiers.tolerance || 0) * 1.6;
    if (p.controller !== p.owner) u += 16;
    if (p.siege) u += 6;
    p.unrest = clamp(Math.round(u), 0, 100);
  }
}

export function religiousUnity(state, c) {
  let total = 0, same = 0;
  for (const p of ownedProvinces(state, c.tag)) {
    const dev = p.dev.tax + p.dev.prod + p.dev.mp;
    total += dev; if (p.religion === c.religion) same += dev;
  }
  return total ? Math.round((same / total) * 100) : 100;
}

// ── Province actions ──────────────────────────────────────────
export function developProvince(state, p, kind, actorTag = state.playerTag) {
  const c = state.countries[p.owner];
  if (!c || p.owner !== actorTag) return { ok: false, msg: 'Not your province.' };
  const cost = 40 + (p.dev.tax + p.dev.prod + p.dev.mp) * 3;
  const branch = kind === 'tax' ? 'adm' : kind === 'prod' ? 'dip' : 'mil';
  if (c.points[branch] < cost) return { ok: false, msg: `Need ${Math.ceil(cost)} ${branch.toUpperCase()} points.` };
  c.points[branch] -= cost;
  p.dev[kind === 'tax' ? 'tax' : kind === 'prod' ? 'prod' : 'mp']++;
  p.pop = Math.round(p.pop * 1.04);
  p.autonomy = Math.max(0, p.autonomy - 1);
  notify(state, c.tag, `Development increased in ${p.name}.`);
  return { ok: true, msg: `${p.name} developed.` };
}

export function startConstruction(state, p, type, actorTag = state.playerTag) {
  const c = state.countries[p.owner];
  if (!c || p.owner !== actorTag) return { ok: false, msg: 'Not your province.' };
  const b = BUILDINGS[type];
  if (!b) return { ok: false, msg: 'Unknown building.' };
  if (p.construction) return { ok: false, msg: 'Already under construction.' };
  if (type === 'dock' && !p.port) return { ok: false, msg: 'Requires a port.' };
  if (type === 'university' && c.tech.adm < 5) return { ok: false, msg: 'Requires Administrative Technology 5.' };
  if (type === 'fort' && p.fort >= 4) return { ok: false, msg: 'Fort already at maximum.' };
  if (type !== 'fort' && (p.buildings[type] || 0) >= 1) return { ok: false, msg: 'Already built here.' };
  if (c.treasury < b.cost) return { ok: false, msg: `Need ${b.cost} ducats.` };
  c.treasury -= b.cost;
  p.construction = { type, monthsLeft: b.months, total: b.months };
  notify(state, c.tag, `Construction of ${b.name} begun in ${p.name}.`);
  return { ok: true, msg: `${b.name} under construction.` };
}

export function startConversion(state, p, actorTag = state.playerTag) {
  const c = state.countries[p.owner];
  if (!c || p.owner !== actorTag) return { ok: false, msg: 'Not your province.' };
  if (p.religion === c.religion) return { ok: false, msg: 'Already follows the state religion.' };
  if (p.conversion) return { ok: false, msg: 'Missionaries already at work.' };
  const cost = 30 + (p.dev.tax + p.dev.prod + p.dev.mp) * 2;
  if (c.treasury < cost) return { ok: false, msg: `Need ${cost} ducats.` };
  c.treasury -= cost;
  const months = Math.round(8 + (p.dev.tax + p.dev.prod + p.dev.mp) * 0.6 - (c.modifiers.missionary || 0) * 100);
  p.conversion = { religion: c.religion, monthsLeft: Math.max(3, months), total: Math.max(3, months) };
  notify(state, c.tag, `Missionaries sent to ${p.name}.`);
  return { ok: true, msg: 'Missionaries dispatched.' };
}

export function acceptCulture(state, c, culture) {
  if (c.accepted.includes(culture)) return { ok: false, msg: 'Already accepted.' };
  const slots = 1 + Math.floor(c.tech.adm / 4) + (c.gov === 'empire' ? 1 : 0);
  if (c.accepted.length >= slots) return { ok: false, msg: `No accepted culture slots (${slots}). Raise Administrative tech.` };
  if (c.points.dip < 100) return { ok: false, msg: 'Need 100 diplomatic points.' };
  c.points.dip -= 100;
  c.accepted.push(culture);
  notify(state, c.tag, `${CULTURES[culture]?.name || culture} culture accepted.`);
  return { ok: true, msg: 'Culture accepted.' };
}

export function enactReform(state, c, id) {
  const r = REFORMS[id];
  if (!r) return { ok: false, msg: 'Unknown reform.' };
  if (c.reforms.includes(id)) return { ok: false, msg: 'Already enacted.' };
  if (c.points.adm < r.cost) return { ok: false, msg: `Need ${r.cost} administrative points.` };
  c.points.adm -= r.cost;
  c.reforms.push(id);
  c.centralization = clamp(c.centralization + (r.centralization || 0), 0, 100);
  c.modifiers = computeModifiers(state, c);
  notify(state, c.tag, `Reform enacted: ${r.name}.`);
  return { ok: true, msg: `${r.name} enacted.` };
}

export function enactLaw(state, c, category, id) {
  if (!LAWS[id]) return { ok: false, msg: 'Unknown law.' };
  c.laws[category] = id;
  c.modifiers = computeModifiers(state, c);
  notify(state, c.tag, `Law changed: ${LAWS[id].name}.`);
  return { ok: true, msg: 'Law enacted.' };
}

export function changeStability(state, c, delta) {
  c.stability = clamp(c.stability + delta, -3, 3);
}

export function estateAction(state, c, estate, action) {
  const e = c.estates[estate];
  if (!e) return { ok: false, msg: 'Unknown estate.' };
  if (action === 'diet') {
    if (c.treasury < 30) return { ok: false, msg: 'Need 30 ducats.' };
    c.treasury -= 30;
    for (const x of Object.values(c.estates)) x.loyalty = clamp(x.loyalty + 8, 0, 100);
    c.stability = clamp(c.stability + 1, -3, 3);
    return { ok: true, msg: 'The Diet has been called. Estates are pleased.' };
  }
  if (action === 'seize') {
    e.loyalty = clamp(e.loyalty - 20, 0, 100);
    e.influence = clamp(e.influence - 8, 0, 80);
    c.treasury += 80;
    c.centralization = clamp(c.centralization + 4, 0, 100);
    return { ok: true, msg: 'Estate lands seized for the crown.' };
  }
  if (action === 'privilege') {
    if (c.treasury < 20) return { ok: false, msg: 'Need 20 ducats.' };
    c.treasury -= 20;
    e.loyalty = clamp(e.loyalty + 15, 0, 100);
    e.influence = clamp(e.influence + 10, 0, 80);
    return { ok: true, msg: 'Privileges granted.' };
  }
  return { ok: false, msg: 'Unknown action.' };
}

// ── Ticking provinces ─────────────────────────────────────────
export function tickProvinces(state) {
  for (const p of state.provinces) {
    if (p.colony) {
      p.colony.monthsLeft--;
      if (p.colony.monthsLeft <= 0) {
        const tag = p.colony.tag;
        p.owner = tag; p.controller = tag; p.colony = null;
        p.autonomy = 50; p.pop = Math.max(800, Math.round(p.pop * 0.5));
        p.fort = 0; p.capital = false;
        const c = state.countries[tag];
        if (c) c.prestige += 3;
        notify(state, tag, `${p.name} has been colonised.`);
        recomputeAll(state);
      }
      continue;
    }
    if (!p.owner) continue;
    const c = state.countries[p.owner];
    if (!c) continue;
    // construction
    if (p.construction) {
      p.construction.monthsLeft--;
      if (p.construction.monthsLeft <= 0) {
        if (p.construction.type === 'fort') p.fort = Math.min(4, p.fort + 1);
        else p.buildings[p.construction.type] = (p.buildings[p.construction.type] || 0) + 1;
        if (p.owner === state.playerTag) notify(state, p.owner, `${BUILDINGS[p.construction.type]?.name || 'Building'} completed in ${p.name}.`);
        p.construction = null;
        recomputeAll(state);
      }
    }
    // conversion
    if (p.conversion) {
      const strength = 1 + (c.modifiers.missionary || 0) * 20 + (p.buildings.temple || 0) * 0.4;
      p.conversion.monthsLeft -= strength;
      if (p.conversion.monthsLeft <= 0) {
        p.religion = p.conversion.religion;
        p.conversion = null;
        p.unrest = clamp(p.unrest + 8, 0, 100);
        if (p.owner === state.playerTag) notify(state, p.owner, `${p.name} has been converted.`);
      }
    }
    // autonomy drift
    if (p.controller === p.owner) {
      const target = p.capital ? 0 : Math.max(5, 25 - (p.buildings.courthouse || 0) * 10 - c.centralization * 0.1);
      if (p.autonomy > target) p.autonomy = round2(Math.max(target, p.autonomy - 0.05));
      else if (p.autonomy < target) p.autonomy = round2(Math.min(target, p.autonomy + 0.02));
    }
    // unrest consequences
    if (p.controller === p.owner && p.unrest > 55 && rand(state) < 0.015) {
      spawnRebels(state, p);
    }
    if (p.controller !== p.owner) p.occupiedMonths++;
  }
}

export function spawnRebels(state, p) {
  if (!p.owner) return;
  const c = state.countries[p.owner];
  const existing = state.armies.find((a) => a.owner === 'REB' && a.target === p.owner && a.provinceId === p.id);
  if (existing) return;
  const men = Math.round((p.dev.tax + p.dev.prod + p.dev.mp) * 160 + 1200);
  const a = makeArmy(state, 'REB', p.id, { infantry: men, cavalry: Math.round(men * 0.2), artillery: 0 });
  a.target = p.owner;
  a.name = 'Rebels';
  state.armies.push(a);
  notify(state, p.owner, `Rebellion in ${p.name}! ${men} rebels have risen.`);
  if (p.owner === state.playerTag) state.stats.rebellions = (state.stats.rebellions || 0) + 1;
}

export function notify(state, tag, msg) {
  if (tag === state.playerTag) {
    state.notifications.unshift({ msg, date: dateShort(state.date) });
    if (state.notifications.length > 30) state.notifications.pop();
  }
  state.log.unshift({ date: dateNum(state.date), tag, msg });
  if (state.log.length > 300) state.log.pop();
}
