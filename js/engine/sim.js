// Simulation loop, monthly/yearly processing and player actions.
import {
  clamp, rand, randInt, addDays, dateNum, dateShort, notify, recomputeAll, recomputeUnrest,
  monthlyEconomy, updateTrade, tickProvinces, ownedProvinces, totalDev,
  computeModifiers, countryArmies, armyMen, getCountry, religiousUnity, spawnRebels, warsOf,
} from './state.js';
import { tickArmies, tickNavies, totalArmyMen } from './military.js';
import { updateWars, endWar, makePeace, evaluatePeace, occupiedBySide, declareWar, tickClaims, updateCoalitions, coalitionWarCheck } from './diplomacy.js';
import { runAI } from './ai.js';
import { checkHistoricalEvents, randomEventCheck, tickDynamicHistory } from './events.js';
import { TECH_COST as COST } from '../data/constants.js';

export function advanceDay(state) {
  state.date = addDays(state.date, 1);
  tickArmies(state);
  tickNavies(state);
  if (state.date.d === 1) {
    monthlyTick(state);
    if (state.date.m === 1) yearlyTick(state);
  }
  if (state.date.y >= 1822) {
    state.gameOver = { victory: true, text: 'The campaign has reached 1821. Your dynasty endures.' };
  }
}

export function advanceDays(state, n) {
  for (let i = 0; i < n; i++) {
    if (state.gameOver) break;
    advanceDay(state);
  }
}

function monthlyTick(state) {
  recomputeAll(state);
  updateTrade(state);
  for (const c of Object.values(state.countries)) {
    if (!c.alive) continue;
    monthlyEconomy(state, c);
  }
  tickProvinces(state);
  tickClaims(state);
  checkHistoricalEvents(state);
  randomEventCheck(state);
  runAI(state);
  updateCoalitions(state);
  coalitionWarCheck(state);
  updateWars(state);
  recomputeUnrest(state);
  updateTrade(state);
  // collapse of states
  for (const c of Object.values(state.countries)) {
    if (!c.alive) continue;
    if (!ownedProvinces(state, c.tag).length) {
      c.alive = false;
      state.armies = state.armies.filter((a) => a.owner !== c.tag);
      state.navies = state.navies.filter((n) => n.owner !== c.tag);
      for (const w of [...state.wars]) {
        if (w.attackers.includes(c.tag) || w.defenders.includes(c.tag)) endWar(state, w, null);
      }
      for (const o of Object.values(state.countries)) {
        o.allies = o.allies.filter((t) => t !== c.tag);
        o.vassals = o.vassals.filter((t) => t !== c.tag);
        o.marriages = o.marriages.filter((t) => t !== c.tag);
      }
      if (c.tag === state.playerTag) state.gameOver = { victory: false, text: `${c.name} has been wiped from the map. Your dynasty is extinguished.` };
    }
  }
  // player defeat if no provinces
  if (state.playerTag && !ownedProvinces(state, state.playerTag).length) {
    state.gameOver = { victory: false, text: 'Your realm has fallen. The campaign is over.' };
  }
  // autosave flag twice a year
  if (state.date.m === 1 || state.date.m === 7) state.flags.autosaveDue = true;
}

function yearlyTick(state) {
  for (const c of Object.values(state.countries)) {
    if (!c.alive) continue;
    tickSuccession(state, c);
    c.prestige = clamp(c.prestige + (c.stability >= 0 ? 0.5 : -0.5), -100, 100);
    // estate influence grows with development
    const dev = totalDev(state, c.tag);
    if (dev > 0) c.estates.burghers.influence = clamp(c.estates.burghers.influence + 0.3, 5, 80);
    // legitimacy recovery
    if (c.gov !== 'republic' && c.gov !== 'oligarchy') c.legitimacy = clamp(c.legitimacy + 1, 0, 100);
    else c.republicanTradition = clamp(c.republicanTradition + 1, 0, 100);
  }
  tickDynamicHistory(state);
  // institution spread
  for (const c of Object.values(state.countries)) {
    if (!c.alive) continue;
    const dev = totalDev(state, c.tag);
    for (const k of Object.keys(c.institutions)) {
      if (c.institutions[k] >= 100) continue;
      const spread = dev * 0.02 + c.tech.adm * 0.3 + (c.buildings?.university || 0);
      c.institutions[k] = clamp(c.institutions[k] + spread, 0, 100);
    }
  }
}

function tickSuccession(state, c) {
  const r = c.ruler;
  if (!r) return;
  r.age++;
  if (r.heir) {
    r.heir.age++;
    if (r.heir.age >= 16 && r.regency) {
      r.regency = false;
      if (c.tag === state.playerTag) notify(state, c.tag, `${r.heir.name} has come of age and takes the throne.`);
    }
  }
  if (r.age < 18) return;
  let deathChance = 0.004 + Math.max(0, r.age - 40) * 0.0018;
  if (c.warExhaustion > 10) deathChance += 0.002;
  if (rand(state) > deathChance) return;
  if (c.gov === 'republic' || c.gov === 'oligarchy') {
    const names = ['Giovanni', 'Lorenzo', 'Piero', 'Francesco', 'Marco', 'Andrea', 'Tommaso', 'Niccolò'];
    c.ruler = {
      name: names[randInt(state, 0, names.length - 1)], title: c.gov === 'republic' ? 'Doge' : 'Lord',
      adm: randInt(state, 1, 5), dip: randInt(state, 1, 5), mil: randInt(state, 1, 5),
      age: randInt(state, 35, 60), heir: null, regency: false,
    };
    c.republicanTradition = clamp(c.republicanTradition + 3, 0, 100);
    if (c.tag === state.playerTag) notify(state, c.tag, `A new ${c.ruler.title} has been elected: ${c.ruler.name}.`);
    return;
  }
  if (r.heir && r.heir.age >= 1) {
    const heir = r.heir;
    c.ruler = { name: heir.name, title: r.title, adm: heir.adm, dip: heir.dip, mil: heir.mil, age: heir.age, heir: null, regency: heir.age < 16 };
    c.legitimacy = clamp(c.legitimacy + 5, 0, 100);
    c.stability = clamp(c.stability + (c.ruler.regency ? -1 : 0), -3, 3);
    if (c.tag === state.playerTag) notify(state, c.tag, `${c.ruler.name} succeeds to the throne.`);
    return;
  }
  // no heir: succession crisis
  c.legitimacy = clamp(c.legitimacy - 25, 0, 100);
  c.stability = clamp(c.stability - 1, -3, 3);
  const marr = c.marriages.filter((t) => state.countries[t]?.alive && state.countries[t].ruler);
  if (marr.length && rand(state) < 0.25) {
    const senior = marr.reduce((a, b) => totalDev(state, b) > totalDev(state, a) ? b : a, marr[0]);
    if (senior !== c.tag) {
      c.puSenior = senior;
      state.countries[senior].puJuniors = state.countries[senior].puJuniors || [];
      state.countries[senior].puJuniors.push(c.tag);
      c.ruler = { ...state.countries[senior].ruler, heir: null, regency: false };
      notify(state, c.tag, `A personal union has formed with ${state.countries[senior].name}.`);
      if (c.tag === state.playerTag) state.pendingEvent = {
        kind: 'historical', id: 'pu', title: 'A Personal Union',
        text: `Your monarch has died without an heir. The crown of ${c.name} has fallen to ${state.countries[senior].name} in personal union.`,
        choices: [{ label: 'Accept the union' }],
      };
      return;
    }
  }
  const names = ['Charles', 'Louis', 'Henry', 'Frederick', 'John', 'Philip', 'Alfonso', 'Casimir', 'Stephen', 'Ivan'];
  c.ruler = {
    name: names[randInt(state, 0, names.length - 1)] + ' ' + ['II', 'III', 'IV', 'V', 'VI'][randInt(state, 0, 4)],
    title: r.title, adm: randInt(state, 0, 4), dip: randInt(state, 0, 4), mil: randInt(state, 0, 4),
    age: randInt(state, 20, 45), heir: null, regency: false,
  };
  if (c.tag === state.playerTag) notify(state, c.tag, `A new ruler, ${c.ruler.name}, ascends amid a disputed succession.`);
  if (c.legitimacy < 35 && rand(state) < 0.45) {
    c.stability = clamp(c.stability - 1, -3, 3);
    const provinces = ownedProvinces(state, c.tag);
    for (const p of provinces.slice(0, 2)) spawnRebels(state, p);
    if (c.tag === state.playerTag) notify(state, c.tag, 'Civil war! Pretenders raise their banners.');
  }
}

// ── Player actions ────────────────────────────────────────────
export function researchTech(state, branch) {
  const c = state.countries[state.playerTag];
  if (!c) return { ok: false, msg: 'No country.' };
  const cost = COST(c.tech[branch]);
  if (c.tech[branch] >= 20) return { ok: false, msg: 'Maximum technology reached.' };
  if (c.points[branch] < cost) return { ok: false, msg: `Need ${Math.ceil(cost)} ${branch.toUpperCase()} points.` };
  c.points[branch] -= cost;
  c.tech[branch]++;
  c.modifiers = computeModifiers(state, c);
  if (branch === 'mil' && c.tech.mil === 7) notify(state, c.tag, 'Field artillery is now available.');
  return { ok: true, msg: `${branch.toUpperCase()} technology advanced to ${c.tech[branch]}.` };
}

export function embraceInstitution(state, key) {
  const c = state.countries[state.playerTag];
  if (!c.institutions[key] || c.institutions[key] < 50) return { ok: false, msg: 'The institution has not spread enough.' };
  if (c.treasury < 100) return { ok: false, msg: 'Need 100 ducats.' };
  c.treasury -= 100;
  c.institutions[key] = 100;
  c.embraced = (c.embraced || 0) + 1;
  return { ok: true, msg: 'Institution embraced. Technology costs reduced.' };
}

export function takeLoan(state) {
  const c = state.countries[state.playerTag];
  if (c.loans.length >= 8) return { ok: false, msg: 'Lenders refuse further credit.' };
  const amount = Math.max(50, Math.round(((c.income || 10) * 10 + 50) / 10) * 10);
  c.loans.push({ amount, rate: 0.05, taken: dateNum(state.date) });
  c.treasury = Math.round((c.treasury + amount) * 100) / 100;
  c.inflation = Math.round((c.inflation + 0.5) * 100) / 100;
  return { ok: true, msg: `Loan of ${amount} ducats taken.` };
}

export function repayLoan(state, index) {
  const c = state.countries[state.playerTag];
  const loan = c.loans[index];
  if (!loan) return { ok: false, msg: 'No such loan.' };
  if (c.treasury < loan.amount) return { ok: false, msg: 'Not enough ducats.' };
  c.treasury -= loan.amount;
  c.loans.splice(index, 1);
  return { ok: true, msg: 'Loan repaid.' };
}

export function increaseStability(state) {
  const c = state.countries[state.playerTag];
  if (c.stability >= 3) return { ok: false, msg: 'Stability is already at maximum.' };
  if (c.points.adm < 100) return { ok: false, msg: 'Need 100 administrative points.' };
  c.points.adm -= 100;
  c.stability = clamp(c.stability + 1, -3, 3);
  return { ok: true, msg: 'Stability improved.' };
}

export function startColony(state, provinceId) {
  const c = state.countries[state.playerTag];
  const p = state.provinces[provinceId];
  if (!c || !p) return { ok: false, msg: 'Invalid province.' };
  if (!state.flags.colonization) return { ok: false, msg: 'The age of colonisation has not yet begun.' };
  if (p.owner || p.colony) return { ok: false, msg: 'Province is already claimed.' };
  if (c.tech.dip < 5) return { ok: false, msg: 'Requires Diplomatic Technology 5.' };
  if (!ownedProvinces(state, c.tag).some((q) => q.port)) return { ok: false, msg: 'Requires a port.' };
  const dist = Math.min(...ownedProvinces(state, c.tag).map((o) => Math.hypot((o.lon - p.lon) * Math.cos(p.lat * Math.PI / 180), o.lat - p.lat)));
  if (dist > 60) return { ok: false, msg: 'Province is beyond your colonial range.' };
  if (c.treasury < 100) return { ok: false, msg: 'Need 100 ducats.' };
  c.treasury -= 100;
  p.colony = { tag: c.tag, monthsLeft: 30, total: 30 };
  notify(state, c.tag, `Colonists sent to ${p.name}.`);
  return { ok: true, msg: `Colonisation of ${p.name} begun.` };
}

export function playerPeace(state, warId, demands) {
  const war = state.wars.find((w) => w.id === warId);
  if (!war) return { ok: false, msg: 'War not found.' };
  return makePeace(state, war, state.playerTag, demands);
}

export function acceptPendingPeace(state) {
  const pp = state.pendingPeace;
  if (!pp) return { ok: false, msg: 'No offer.' };
  const war = state.wars.find((w) => w.id === pp.warId);
  if (!war) { state.pendingPeace = null; return { ok: false, msg: 'War is over.' }; }
  const res = makePeace(state, war, pp.from, pp.demands);
  state.pendingPeace = null;
  return res;
}

export function declinePendingPeace(state) {
  state.pendingPeace = null;
  return { ok: true, msg: 'Offer declined.' };
}

export function declareIndependence(state) {
  const c = state.countries[state.playerTag];
  if (!c.puSenior) return { ok: false, msg: 'You are not in a personal union.' };
  const senior = state.countries[c.puSenior];
  const res = declareWar(state, c.tag, c.puSenior, 'independence');
  return { ok: res.ok, msg: res.ok ? `War of independence declared against ${senior.name}.` : res.msg };
}

export function rankCountries(state) {
  return Object.values(state.countries).filter((c) => c.alive).sort((a, b) => b.score - a.score);
}

export function playerRank(state) {
  const r = rankCountries(state);
  return { rank: r.findIndex((c) => c.tag === state.playerTag) + 1, total: r.length };
}

export function forceEndTurn(state) { /* reserved for future */ }
