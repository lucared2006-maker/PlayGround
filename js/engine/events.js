// Historical timeline, dynamic history and random events.
import {
  HISTORICAL_EVENTS, RANDOM_EVENTS, RELIGIONS,
} from '../data/constants.js';
import {
  clamp, rand, randInt, notify, ownedProvinces, spawnRebels, totalDev,
} from './state.js';
import { declareWar, endWar, makePeace } from './diplomacy.js';

function scopeCountries(state, scope) {
  const all = Object.values(state.countries).filter((c) => c.alive);
  if (scope === 'world') return all;
  if (scope === 'christian') return all.filter((c) => RELIGIONS[c.religion]?.group === 'christian');
  if (scope === 'hre') return all.filter((c) => c.hre);
  if (scope === 'italy') return all.filter((c) => ['MIL', 'VEN', 'GEN', 'FLO', 'PAP', 'NAP', 'SIE', 'MAN', 'FER', 'MOD', 'SAV'].includes(c.tag));
  if (scope === 'iberia') return all.filter((c) => ['CAS', 'ARA', 'POR', 'NAV', 'GRA'].includes(c.tag));
  return all;
}

export function checkHistoricalEvents(state) {
  for (const ev of HISTORICAL_EVENTS) {
    const key = 'hist_' + ev.id;
    if (state.flags[key]) continue;
    const reached = state.date.y > ev.year || (state.date.y === ev.year && state.date.m >= ev.month);
    if (!reached) continue;
    if (ev.condition && !ev.condition(state)) continue;
    state.flags[key] = true;
    applyHistorical(state, ev);
    state.stats.events++;
    const affected = scopeCountries(state, ev.scope);
    if (affected.some((c) => c.tag === state.playerTag) || ev.scope === 'world') {
      state.pendingEvent = {
        kind: 'historical', id: ev.id, title: ev.title, text: ev.text,
        date: `${ev.month}/${ev.year}`, choices: [{ label: 'Continue' }],
      };
    }
    for (const c of affected) notify(state, c.tag, `${ev.title} (${ev.year})`);
  }
}

function applyHistorical(state, ev) {
  const e = ev.effects || {};
  const all = Object.values(state.countries).filter((c) => c.alive);
  if (e.prestigeAll) for (const c of all) c.prestige = clamp(c.prestige + e.prestigeAll, -100, 100);
  if (e.stabilityAll) for (const c of all) c.stability = clamp(c.stability + e.stabilityAll, -3, 3);
  if (e.toleranceAll) for (const c of all) { c.bonuses = c.bonuses || {}; c.bonuses.tolerance = (c.bonuses.tolerance || 0) + e.toleranceAll; }
  if (e.inflationAll) for (const c of all) c.inflation = clamp(c.inflation + e.inflationAll, 0, 40);
  if (e.ottomanPrestige && state.countries.OTT) state.countries.OTT.prestige = clamp(state.countries.OTT.prestige + e.ottomanPrestige, -100, 100);
  if (e.byzStability && state.countries.BYZ) state.countries.BYZ.stability = clamp(state.countries.BYZ.stability + e.byzStability, -3, 3);
  if (e.prestige) for (const [t, v] of Object.entries(e.prestige)) if (state.countries[t]) state.countries[t].prestige = clamp(state.countries[t].prestige + v, -100, 100);
  if (e.stability) for (const [t, v] of Object.entries(e.stability)) if (state.countries[t]) state.countries[t].stability = clamp(state.countries[t].stability + v, -3, 3);
  if (e.techBonus) for (const c of all) { c.points.adm += 60; c.points.dip += 60; c.points.mil += 60; }
  if (e.tradeBonus) for (const c of all) { c.bonuses = c.bonuses || {}; c.bonuses.trade = (c.bonuses.trade || 0) + e.tradeBonus; }
  if (e.fortCost) state.flags.fortCostMod = e.fortCost;
  if (e.colonization) state.flags.colonization = true;
  if (e.institution) for (const c of all) c.institutions[e.institution] = Math.min(100, (c.institutions[e.institution] || 0) + 25);
  if (e.war) {
    const [a, b] = e.war;
    if (state.countries[a]?.alive && state.countries[b]?.alive) declareWar(state, a, b, 'historical');
  }
  if (e.spawnProtestant && !state.flags.reformation) {
    state.flags.reformation = true;
    const catholic = state.provinces.filter((p) => p.owner && p.religion === 'catholic' && p.lon > -12 && p.lon < 32 && p.lat > 38);
    for (const p of catholic) if (rand(state) < 0.38) p.religion = 'protestant';
    for (const c of all) {
      if (c.religion !== 'catholic') continue;
      const own = ownedProvinces(state, c.tag);
      const prot = own.filter((p) => p.religion === 'protestant').length;
      if (own.length && prot / own.length > 0.45 && rand(state) < 0.7) {
        c.religion = 'protestant';
        c.stability = clamp(c.stability - 1, -3, 3);
        notify(state, c.tag, `${c.name} has adopted the Protestant faith.`);
      }
    }
    notify(state, state.playerTag, 'The Reformation has begun. Religious unity is shaken across Christendom.');
  }
  if (e.catholicUnrest) {
    for (const p of state.provinces) if (p.religion === 'catholic') p.unrest = clamp(p.unrest + e.catholicUnrest, 0, 100);
  }
  if (e.italianUnrest) {
    for (const p of state.provinces) if (p.lon > 6 && p.lon < 19 && p.lat > 36 && p.lat < 47) p.unrest = clamp(p.unrest + e.italianUnrest, 0, 100);
  }
  if (e.imperialUnrest) {
    for (const p of state.provinces) if (p.owner && state.countries[p.owner]?.hre) p.unrest = clamp(p.unrest + e.imperialUnrest, 0, 100);
  }
  if (e.religiousWar) state.flags.religiousWar = true;
  if (e.revolution) {
    const c = state.countries[e.revolution];
    if (c) {
      c.gov = 'republic';
      c.stability = -2;
      c.legitimacy = 30;
      c.ruler = { name: 'Revolutionary Convention', title: 'First Consul', adm: 3, dip: 3, mil: 4, age: 40, heir: null, regency: false };
      c.prestige += 15;
      state.flags.revolution = true;
      notify(state, c.tag, 'The old order has fallen. A republic is proclaimed!');
      for (const p of ownedProvinces(state, c.tag)) if (rand(state) < 0.2) spawnRebels(state, p);
    }
  }
  if (e.napoleon) {
    const c = state.countries.FRA;
    if (c) {
      c.tech.mil = Math.min(20, c.tech.mil + 2);
      c.prestige += 30;
      c.forceLimit = Math.round(c.forceLimit * 1.3);
      c.stability = clamp(c.stability + 1, -3, 3);
      notify(state, 'FRA', 'Napoleon Bonaparte has crowned himself Emperor of the French.');
    }
  }
  if (e.peace) {
    // White peace all AI wars, tolerance boost
    state.wars = state.wars.filter((w) => {
      if (w.attackers.includes(state.playerTag) || w.defenders.includes(state.playerTag)) return true;
      return false;
    });
    for (const c of all) { c.bonuses = c.bonuses || {}; c.bonuses.tolerance = (c.bonuses.tolerance || 0) + 1; }
  }
}

export function randomEventCheck(state) {
  if (state.pendingEvent) return;
  for (const c of Object.values(state.countries)) {
    if (!c.alive) continue;
    const chance = c.tag === state.playerTag ? 0.035 : 0.012;
    if (rand(state) > chance) continue;
    const pool = RANDOM_EVENTS.filter((ev) => !ev.religion || ev.religion === c.religion);
    if (!pool.length) continue;
    const totalW = pool.reduce((s, e) => s + e.weight, 0);
    let roll = rand(state) * totalW, ev = pool[0];
    for (const e of pool) { roll -= e.weight; if (roll <= 0) { ev = e; break; } }
    if (c.tag === state.playerTag) {
      state.pendingEvent = {
        kind: 'random', id: ev.id, title: ev.title, text: ev.text,
        choices: ev.choices.map((ch) => ({ label: ch.label })),
        choiceEffects: ev.choices.map((ch) => ch.effects),
      };
      state.stats.events++;
      return;
    } else {
      const ch = ev.choices[randInt(state, 0, ev.choices.length - 1)];
      applyRandomEffects(state, c, ch.effects);
      notify(state, c.tag, ev.title);
    }
  }
}

export function chooseEvent(state, index) {
  const pe = state.pendingEvent;
  if (!pe) return;
  if (pe.kind === 'random' && pe.choiceEffects) {
    const c = state.countries[state.playerTag];
    const effects = pe.choiceEffects[index];
    if (effects) applyRandomEffects(state, c, effects);
  }
  state.pendingEvent = null;
}

function applyRandomEffects(state, c, e) {
  if (!c) return;
  if (e.treasury) c.treasury = Math.round((c.treasury + e.treasury) * 100) / 100;
  if (e.stability) c.stability = clamp(c.stability + e.stability, -3, 3);
  if (e.prestige) c.prestige = clamp(c.prestige + e.prestige, -100, 100);
  if (e.legitimacy) c.legitimacy = clamp(c.legitimacy + e.legitimacy, 0, 100);
  if (e.manpower) c.manpower = clamp(c.manpower + e.manpower, 0, c.maxManpower);
  if (e.inflation) c.inflation = clamp(c.inflation + e.inflation, 0, 40);
  if (e.tolerance) { c.bonuses = c.bonuses || {}; c.bonuses.tolerance = (c.bonuses.tolerance || 0) + e.tolerance; }
  if (e.trade) { c.bonuses = c.bonuses || {}; c.bonuses.trade = (c.bonuses.trade || 0) + e.trade / 100; }
  if (e.armyMorale) for (const a of state.armies.filter((x) => x.owner === c.tag)) a.morale = clamp(a.morale + e.armyMorale, 0, 100);
  if (e.pop) for (const p of ownedProvinces(state, c.tag)) p.pop = Math.max(500, Math.round(p.pop * (1 + e.pop)));
  if (e.development) {
    const cap = state.provinces[c.capital];
    if (cap) { cap.dev.tax += 1; cap.pop = Math.round(cap.pop * 1.03); }
  }
  if (e.unrest) for (const p of ownedProvinces(state, c.tag)) p.unrest = clamp(p.unrest + e.unrest, 0, 100);
  if (e.noblesLoyalty) c.estates.nobles.loyalty = clamp(c.estates.nobles.loyalty + e.noblesLoyalty, 0, 100);
  if (e.clergyLoyalty) c.estates.clergy.loyalty = clamp(c.estates.clergy.loyalty + e.clergyLoyalty, 0, 100);
  if (e.burghersLoyalty) c.estates.burghers.loyalty = clamp(c.estates.burghers.loyalty + e.burghersLoyalty, 0, 100);
  if (e.peasantsLoyalty) c.estates.peasants.loyalty = clamp(c.estates.peasants.loyalty + e.peasantsLoyalty, 0, 100);
  if (e.relationNeighbors) {
    for (const p of ownedProvinces(state, c.tag)) {
      for (const n of p.neighbors || []) {
        const o = state.provinces[n]?.owner;
        if (o && o !== c.tag && state.countries[o]) c.diplo[o].rel = clamp(c.diplo[o].rel + e.relationNeighbors, -200, 200);
      }
    }
  }
}

// Yearly dynamic religion and culture changes.
export function tickDynamicHistory(state) {
  if (state.flags.reformation) {
    for (const p of state.provinces) {
      if (p.owner && p.religion === 'catholic' && p.lon > -12 && p.lon < 32 && rand(state) < 0.004) p.religion = 'protestant';
    }
  }
  for (const p of state.provinces) {
    if (!p.owner) continue;
    const c = state.countries[p.owner];
    if (!c) continue;
    if (p.culture !== c.culture && c.accepted.includes(p.culture) && p.religion === c.religion && p.autonomy < 15 && rand(state) < 0.006) {
      p.culture = c.culture;
      p.unrest = clamp(p.unrest + 4, 0, 100);
      if (c.tag === state.playerTag) notify(state, c.tag, `${p.name} has assimilated into ${c.culture} culture.`);
    }
  }
}
