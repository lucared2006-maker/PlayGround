// Strategic AI: economy, recruitment, diplomacy, war and colonisation.
import {
  TECH_COST, UNIT_TYPES, BUILDINGS, REFORMS,
} from '../data/constants.js';
import {
  clamp, rand, randInt, dateNum, notify, ownedProvinces, totalDev, relation,
  addRelation, isAtWar, warsOf, countryArmies, countryNavy, armyMen, navyShips,
  startConstruction, startConversion, developProvince, computeModifiers,
  monthlyEconomy, getCountry, pick,
} from './state.js';
import {
  neighborTags, formAlliance, improveRelations, royalMarriage, fabricateClaim,
  declareWar, evaluatePeace, makePeace, occupiedBySide, autoPeaceAI, aiAcceptAlliance, endWar,
} from './diplomacy.js';
import {
  recruit, buildShip, findArmyPath, totalArmyMen, canEnter,
} from './military.js';

const AI_BUILD_PRIORITY = ['market', 'workshop', 'temple', 'barracks', 'courthouse', 'dock'];

export function runAI(state) {
  const atWar = {};
  for (const c of Object.values(state.countries)) {
    if (!c.alive || c.tag === state.playerTag) continue;
    atWar[c.tag] = warsOf(state, c.tag).length > 0;
    aiBudget(state, c, atWar[c.tag]);
    aiEconomy(state, c, atWar[c.tag]);
    if (state.date.m % 3 === 0) aiDiplomacy(state, c);
    if (state.date.m === 1) aiWarDecision(state, c);
    aiWar(state, c);
    aiColonise(state, c);
    aiPeace(state, c);
  }
  for (const w of [...state.wars]) autoPeaceAI(state, w);
}

function aiBudget(state, c, atWar) {
  const inc = c.income || 10;
  c.taxRate = c.treasury < 15 ? 1.3 : c.treasury > 400 ? 0.9 : 1.0;
  c.armyMaintenance = atWar ? 1.0 : c.treasury < 30 ? 0.6 : 0.85;
  c.navyMaintenance = 0.7;
  c.fortMaintenance = 0.7;
}

function aiEconomy(state, c, atWar) {
  const dev = totalDev(state, c.tag);
  // research
  for (const branch of ['adm', 'dip', 'mil']) {
    const cost = TECH_COST(c.tech[branch]);
    if (c.points[branch] >= cost && c.tech[branch] < 20) {
      c.points[branch] -= cost;
      c.tech[branch]++;
    }
  }
  // stability and reforms
  if (c.stability < 1 && c.points.adm > 120 && rand(state) < 0.15) {
    c.points.adm -= 100; c.stability = clamp(c.stability + 1, -3, 3);
  }
  if (c.points.adm > 220 && c.reforms.length < 5 && rand(state) < 0.12) {
    const options = Object.keys(REFORMS).filter((r) => !c.reforms.includes(r) && REFORMS[r].cost <= c.points.adm);
    if (options.length) {
      const r = pick(state, options);
      c.points.adm -= REFORMS[r].cost;
      c.reforms.push(r);
      c.centralization = clamp(c.centralization + (REFORMS[r].centralization || 0), 0, 100);
      c.modifiers = computeModifiers(state, c);
    }
  }
  // recruitment
  const men = totalArmyMen(state, c.tag);
  const target = c.forceLimit * 950 * (atWar ? 0.95 : 0.62);
  if (men < target && c.manpower > 2500 && c.treasury > 40) {
    const prov = state.provinces[c.capital] && state.provinces[c.capital].controller === c.tag
      ? state.provinces[c.capital]
      : ownedProvinces(state, c.tag).find((p) => p.controller === c.tag);
    if (prov) {
      let type = 'infantry';
      const cavRatio = countryArmies(state, c.tag).reduce((s, a) => s + a.men.cavalry, 0) / Math.max(1, men);
      if (cavRatio < 0.3 && c.treasury > 70) type = 'cavalry';
      if (c.tech.mil >= 7 && c.treasury > 140 && rand(state) < 0.3) type = 'artillery';
      const count = Math.max(1, Math.min(3, Math.floor(c.treasury / (UNIT_TYPES[type].cost * 2))));
      recruit(state, c.tag, prov.id, type, count);
    }
  }
  // navy
  if (c.tech.dip >= 3 && c.treasury > 120 && rand(state) < 0.08) {
    const port = ownedProvinces(state, c.tag).find((p) => p.port && p.controller === c.tag);
    if (port && countryNavy(state, c.tag).reduce((s, n) => s + navyShips(n), 0) < 6 + dev / 20) {
      buildShip(state, c.tag, port.id, c.tech.dip >= 7 ? 'caravel' : 'cog', 1);
    }
  }
  // building
  if (c.treasury > 130 && rand(state) < 0.22) {
    const options = ownedProvinces(state, c.tag).filter((p) => !p.construction && p.controller === c.tag);
    if (options.length) {
      const p = pick(state, options);
      let type = pick(state, AI_BUILD_PRIORITY);
      if (type === 'dock' && !p.port) type = 'market';
      if (type === 'university' && c.tech.adm < 5) type = 'temple';
      startConstruction(state, p, type, c.tag);
    }
  }
  // development
  if (c.points.dip > 180 && rand(state) < 0.1) {
    const p = state.provinces[c.capital];
    if (p) developProvince(state, p, 'prod', c.tag);
  }
  // conversion
  if (c.treasury > 100 && rand(state) < 0.05) {
    const p = ownedProvinces(state, c.tag).find((x) => x.religion !== c.religion && !x.conversion && x.controller === c.tag);
    if (p) startConversion(state, p, c.tag);
  }
}

function aiDiplomacy(state, c) {
  const neighbors = neighborTags(state, c.tag);
  if (!neighbors.length) return;
  // improve relations with a neighbour
  if (c.treasury > 60 && rand(state) < 0.6) {
    const target = pick(state, neighbors);
    if (target && relation(state, c.tag, target) < 120) improveRelations(state, c.tag, target);
  }
  // alliance
  if (c.allies.length < 2 && c.treasury > 30 && rand(state) < 0.35) {
    const candidates = neighbors.filter((t) => t !== state.playerTag && !c.allies.includes(t) && relation(state, c.tag, t) > 35 && !c.rivals.includes(t) && state.countries[t].alive);
    if (candidates.length) formAlliance(state, c.tag, pick(state, candidates));
  }
  // marriage
  if (['monarchy', 'empire'].includes(c.gov) && c.marriages.length < 3 && c.treasury > 20 && rand(state) < 0.2) {
    const candidates = neighbors.filter((t) => t !== state.playerTag && !c.marriages.includes(t) && state.countries[t].alive && relation(state, c.tag, t) > 0);
    if (candidates.length) royalMarriage(state, c.tag, pick(state, candidates));
  }
  // claim
  if (c.claims.length < 2 && c.treasury > 120 && !c.fabricating && c.personality.aggression > 0.8 && rand(state) < 0.22) {
    const targets = [];
    for (const n of neighbors) {
      const tp = state.provinces.filter((p) => p.owner === n);
      for (const p of tp) if (ownedProvinces(state, c.tag).some((q) => (q.neighbors || []).includes(p.id) || (q.seaNeighbors || []).includes(p.id))) targets.push(p);
    }
    if (targets.length) fabricateClaim(state, c.tag, pick(state, targets).id);
  }
  // guarantee weaker friendly neighbour
  if (c.guarantees.length < 2 && c.treasury > 100 && rand(state) < 0.08) {
    const weak = neighbors.filter((t) => totalDev(state, t) < totalDev(state, c.tag) * 0.5 && relation(state, c.tag, t) > 30);
    if (weak.length) c.guarantees.push(pick(state, weak));
  }
}

function aiWarDecision(state, c) {
  if (warsOf(state, c.tag).length > 0) return;
  if (c.treasury < 60 || c.manpower < 2500) return;
  if (rand(state) > 0.55 * c.personality.aggression) return;
  const neighbors = neighborTags(state, c.tag).filter((t) => state.countries[t]?.alive);
  const targets = [];
  for (const t of neighbors) {
    const o = state.countries[t];
    if (!o || c.allies.includes(t) || c.vassals.includes(t) || c.overlord === t) continue;
    if (isAtWar(state, c.tag, t)) continue;
    if ((c.diplo[t]?.truce || 0) > dateNum(state.date)) continue;
    const myMen = totalArmyMen(state, c.tag) + c.forceLimit * 250;
    const theirMen = totalArmyMen(state, t) + o.forceLimit * 250;
    const hasClaim = c.claims.some((id) => state.provinces[id]?.owner === t);
    const weak = myMen > theirMen * (1.35 - c.personality.aggression * 0.15);
    const hostile = relation(state, c.tag, t) < -10;
    if ((hasClaim || hostile || c.personality.aggression > 1.2) && weak) {
      targets.push({ t, score: (hasClaim ? 2 : 0) + (theirMen / Math.max(1, myMen)) * -1 + (relation(state, c.tag, t) < -50 ? 1 : 0) });
    }
  }
  if (!targets.length) return;
  targets.sort((a, b) => b.score - a.score);
  const target = targets[0].t;
  if (target === state.playerTag) {
    // AI is more cautious about the human player on easy
    if (state.difficulty === 'easy' && rand(state) < 0.4) return;
  }
  declareWar(state, c.tag, target, c.claims.some((id) => state.provinces[id]?.owner === target) ? 'claim' : 'conquest');
}

function aiWar(state, c) {
  const wars = warsOf(state, c.tag);
  if (!wars.length) {
    // return home / merge
    for (const a of countryArmies(state, c.tag)) {
      if (a.move || a.battle) continue;
      const p = state.provinces[a.provinceId];
      if (p && p.owner !== c.tag && p.controller !== c.tag) {
        const path = findArmyPath(state, c.tag, a.provinceId, c.capital);
        if (path) a.move = { path, index: 0, daysLeft: 5, total: path.length - 1 };
      }
    }
    return;
  }
  const enemyTags = new Set();
  for (const w of wars) {
    for (const t of [...w.attackers, ...w.defenders]) if (t !== c.tag) enemyTags.add(t);
  }
  // merge stacks
  const byProv = new Map();
  for (const a of countryArmies(state, c.tag)) {
    if (!byProv.has(a.provinceId)) byProv.set(a.provinceId, []);
    byProv.get(a.provinceId).push(a);
  }
  for (const stacks of byProv.values()) {
    if (stacks.length < 2) continue;
    const main = stacks[0];
    for (let i = 1; i < stacks.length; i++) {
      for (const k of Object.keys(main.men)) main.men[k] += stacks[i].men[k];
      state.armies = state.armies.filter((a) => a !== stacks[i]);
    }
  }
  // recapture and siege
  for (const a of countryArmies(state, c.tag)) {
    if (a.move || a.battle) continue;
    const here = state.provinces[a.provinceId];
    if (!here) continue;
    // already in an enemy province -> siege handles
    if (here.owner && enemyTags.has(here.owner) && here.controller !== c.tag) continue;
    if (here.owner === c.tag && here.controller !== c.tag) continue; // siege already in progress
    // find closest enemy province
    let best = null, bestScore = Infinity;
    for (const p of state.provinces) {
      if (!p.owner || !enemyTags.has(p.owner)) continue;
      if (p.controller === c.tag) continue;
      const dist = Math.hypot(p.x - here.x, p.y - here.y);
      if (dist > 45) continue;
      const path = findArmyPath(state, c.tag, a.provinceId, p.id);
      if (!path) continue;
      const score = path.length + (p.fort || 0) * 2 + (p.capital ? 2 : 0);
      if (score < bestScore) { bestScore = score; best = { p, path }; }
    }
    if (best && best.p.id !== a.provinceId) {
      a.move = { path: best.path, index: 0, daysLeft: 5, total: best.path.length - 1 };
      a.siege = 0;
    }
  }
}

function aiColonise(state, c) {
  if (!state.flags.colonization) return;
  if (c.tech.dip < 5 || c.treasury < 150) return;
  if (!ownedProvinces(state, c.tag).some((p) => p.port)) return;
  if (rand(state) > 0.02) return;
  const owned = ownedProvinces(state, c.tag);
  const targets = state.provinces.filter((p) => !p.owner && !p.colony && p.lon !== undefined &&
    Math.min(...owned.map((o) => Math.hypot((o.lon - p.lon) * Math.cos(p.lat * Math.PI / 180), o.lat - p.lat))) < 55);
  if (!targets.length) return;
  const p = pick(state, targets);
  c.treasury -= 80;
  p.colony = { tag: c.tag, monthsLeft: 24, total: 24 };
  if (c.tag === state.playerTag) notify(state, c.tag, `Colonists sent to ${p.name}.`);
}

function aiPeace(state, c) {
  const wars = warsOf(state, c.tag);
  for (const w of wars) {
    if (w.offerSent) continue;
    const side = w.attackers.includes(c.tag) ? 'attacker' : 'defender';
    const score = side === 'attacker' ? w.score : -w.score;
    const playerInvolved = w.attackers.includes(state.playerTag) || w.defenders.includes(state.playerTag);
    if (!playerInvolved) continue;
    if (w.duration < 365) continue;
    if (score > 25) {
      const occupied = occupiedBySide(state, w, side);
      const demand = occupied.sort((a, b) => (b.dev.tax + b.dev.prod + b.dev.mp) - (a.dev.tax + a.dev.prod + a.dev.mp))[0];
      if (demand) {
        state.pendingPeace = {
          warId: w.id, from: c.tag, to: state.playerTag,
          title: `${c.name} Offers Peace`,
          text: `${c.name} is willing to end the war. They demand ${demand.name} and the war will be over.`,
          demands: { provinces: [demand.id], gold: 0, releaseVassals: [] },
        };
        w.offerSent = true;
      }
    } else if (score < -25) {
      state.pendingPeace = {
        warId: w.id, from: c.tag, to: state.playerTag,
        title: `${c.name} Seeks Peace`,
        text: `${c.name} has been worsted and offers a white peace.`,
        demands: { provinces: [], gold: 0, releaseVassals: [] },
      };
      w.offerSent = true;
    }
  }
}

export function aiTechValue(c) {
  return c.tech.adm + c.tech.dip + c.tech.mil;
}
