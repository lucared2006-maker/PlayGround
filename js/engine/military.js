// Armies, navies, movement, battles and sieges.
import {
  UNIT_TYPES, SHIP_TYPES, TERRAIN,
} from '../data/constants.js';
import {
  clamp, rand, randInt, isAtWar, warsOf, makeArmy, makeNavy, notify, armyMen,
  navyShips, relation,
} from './state.js';

const STEP_DAYS = { plains: 4, farmland: 4, forest: 6, hills: 6, mountains: 9, marsh: 8, desert: 7, steppe: 4, tundra: 7, jungle: 8 };
const SEA_DAYS = 10;

export function canEnter(state, tag, p) {
  if (!p) return false;
  if (!p.owner) return false;
  if (p.owner === tag) return true;
  const c = state.countries[tag];
  if (!c) return false;
  if (p.controller === tag) return true;
  if (c.allies.includes(p.owner) || c.allies.includes(p.controller)) return true;
  if (c.vassals.includes(p.owner) || c.overlord === p.owner) return true;
  if (c.access.includes(p.owner)) return true;
  if (isAtWar(state, tag, p.owner) || (p.controller && isAtWar(state, tag, p.controller))) return true;
  return false;
}

export function findArmyPath(state, tag, fromId, toId) {
  if (fromId === toId) return [fromId];
  const prev = new Map();
  const q = [fromId];
  prev.set(fromId, null);
  while (q.length) {
    const cur = q.shift();
    const p = state.provinces[cur];
    if (!p) continue;
    const links = [...(p.neighbors || []), ...(p.seaNeighbors || [])];
    for (const n of links) {
      if (prev.has(n)) continue;
      const np = state.provinces[n];
      if (!canEnter(state, tag, np)) continue;
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

export function orderMove(state, army, targetId) {
  if (!army || army.owner !== state.playerTag) return { ok: false, msg: 'Not your army.' };
  if (army.battle) return { ok: false, msg: 'The army is in battle.' };
  const path = findArmyPath(state, army.owner, army.provinceId, targetId);
  if (!path) return { ok: false, msg: 'No route: territory is neutral or unreachable.' };
  if (path.length === 1) { army.move = null; return { ok: true, msg: 'Army is already there.' }; }
  const target = state.provinces[targetId];
  if (path.some((id, i) => i > 0 && !canEnter(state, army.owner, state.provinces[id]))) return { ok: false, msg: 'Route blocked.' };
  army.move = { path, index: 0, daysLeft: moveDays(state, path[0], path[1]), total: path.length - 1 };
  army.siege = 0;
  return { ok: true, msg: `Marching to ${target.name}.` };
}

function moveDays(state, fromId, toId) {
  const a = state.provinces[fromId], b = state.provinces[toId];
  if (a.neighbors?.includes(toId)) return STEP_DAYS[b.terrain] || 5;
  return SEA_DAYS;
}

export function tickArmies(state) {
  // movement
  for (const a of state.armies) {
    if (a.owner === 'REB') continue;
    if (a.move) {
      a.move.daysLeft--;
      if (a.move.daysLeft <= 0) {
        a.move.index++;
        const next = a.move.path[a.move.index];
        a.provinceId = next;
        a.siege = 0;
        if (a.move.index >= a.move.path.length - 1) a.move = null;
        else a.move.daysLeft = moveDays(state, a.provinceId, a.move.path[a.move.index + 1]);
        const p = state.provinces[next];
        if (p.owner === state.playerTag && p.controller !== p.owner) a.siege = 1;
      }
    }
  }
  // battles
  const byProv = new Map();
  for (const a of state.armies) {
    if (armyMen(a) <= 0) continue;
    if (!byProv.has(a.provinceId)) byProv.set(a.provinceId, []);
    byProv.get(a.provinceId).push(a);
  }
  for (const [pid, stacks] of byProv) {
    if (stacks.length < 2) continue;
    const processed = new Set();
    for (let i = 0; i < stacks.length; i++) {
      for (let j = i + 1; j < stacks.length; j++) {
        const A = stacks[i], B = stacks[j];
        if (processed.has(A) || processed.has(B)) continue;
        const hostile = A.owner === 'REB' ? B.owner === A.target : B.owner === 'REB' ? A.owner === B.target : isAtWar(state, A.owner, B.owner);
        if (!hostile) continue;
        fightRound(state, A, B, state.provinces[pid]);
        processed.add(A); processed.add(B);
      }
    }
  }
  // sieges, attrition, morale
  for (const a of state.armies) {
    const p = state.provinces[a.provinceId];
    if (!p) continue;
    if (a.owner === 'REB') {
      if (p.controller !== 'REB' && p.owner) {
        a.siege = (a.siege || 0) + 12;
        if (a.siege >= 100) { p.controller = 'REB'; a.siege = 0; }
      }
      continue;
    }
    const c = state.countries[a.owner];
    if (!c) continue;
    const hostileHere = state.armies.some((b) => b !== a && armyMen(b) > 0 && b.provinceId === a.provinceId &&
      (b.owner === 'REB' ? a.owner === b.target : isAtWar(state, a.owner, b.owner)));
    if (hostileHere) { a.siege = 0; continue; }
    // morale
    if (!a.move) {
      const friendly = p.owner === a.owner || p.controller === a.owner;
      a.morale = clamp(a.morale + (friendly ? 1.8 : 0.8), 0, 100);
    }
    // siege
    if (!a.move && p.controller !== a.owner) {
      if (p.controller === 'REB' || (p.owner && isAtWar(state, a.owner, p.owner)) || (p.controller && isAtWar(state, a.owner, p.controller))) {
        const fort = p.fort || 0;
        const arty = a.men.artillery / 1000;
        const rate = fort === 0 ? 25 : ((armyMen(a) / 2200) + arty * 1.2 + (a.leader?.siege || 0) * 0.4) / (fort + 1) * 0.55;
        a.siege = clamp(a.siege + rate, 0, 100);
        p.siege = { progress: Math.round(a.siege), by: a.owner };
        if (a.siege >= 100) {
          const old = p.controller;
          p.controller = a.owner;
          p.siege = null;
          a.siege = 0;
          p.occupiedMonths = 0;
          if (p.owner === state.playerTag) notify(state, p.owner, `${p.name} has fallen to ${state.countries[a.owner]?.name || a.owner}!`);
          else if (a.owner === state.playerTag) notify(state, a.owner, `${p.name} captured.`);
          const war = state.wars.find((w) => w.attackers.includes(a.owner) && w.defenders.includes(p.owner));
          if (war) war.battleScore = (war.battleScore || 0) + (p.capital ? 4 : 1);
        }
      }
    }
    // attrition
    const supply = 2500 + (p.dev.tax + p.dev.prod + p.dev.mp) * 700;
    if (armyMen(a) > supply) {
      const loss = Math.max(1, Math.round((armyMen(a) - supply) * 0.006));
      applyLosses(a, loss);
      if (rand(state) < 0.02) a.morale = clamp(a.morale - 1, 0, 100);
    }
    if (a.morale <= 0) retreat(state, a);
  }
  state.armies = state.armies.filter((a) => armyMen(a) > 0);
}

function fightRound(state, A, B, p) {
  const ca = state.countries[A.owner], cb = state.countries[B.owner];
  const ra = A.owner === 'REB' ? { modifiers: { discipline: 0 }, tech: { mil: 1 } } : ca;
  const rb = B.owner === 'REB' ? { modifiers: { discipline: 0 }, tech: { mil: 1 } } : cb;
  if (!ra || !rb) return;
  const terrain = TERRAIN[p.terrain] || TERRAIN.plains;
  const defA = p.owner === A.owner ? terrain.defense : 0;
  const defB = p.owner === B.owner ? terrain.defense : 0;
  const powerA = stackPower(A, ra, defA, p);
  const powerB = stackPower(B, rb, defB, p);
  if (powerA <= 0 || powerB <= 0) return;
  const ratioA = powerA / (powerA + powerB);
  const lossA = Math.min(armyMen(A) * 0.14, powerB * 0.00075 * (0.75 + rand(state) * 0.5));
  const lossB = Math.min(armyMen(B) * 0.14, powerA * 0.00075 * (0.75 + rand(state) * 0.5));
  applyLosses(A, Math.round(lossA));
  applyLosses(B, Math.round(lossB));
  A.morale = clamp(A.morale - (3.2 + lossA / Math.max(400, armyMen(A)) * 90) * (0.85 + rand(state) * 0.3), 0, 100);
  B.morale = clamp(B.morale - (3.2 + lossB / Math.max(400, armyMen(B)) * 90) * (0.85 + rand(state) * 0.3), 0, 100);
  A.battle = B.id; B.battle = A.id;
  state.stats.battles++;
  // battle warscore
  const war = state.wars.find((w) => (w.attackers.includes(A.owner) && w.defenders.includes(B.owner)) || (w.attackers.includes(B.owner) && w.defenders.includes(A.owner)));
  if (war) {
    const aSide = war.attackers.includes(A.owner) ? 1 : -1;
    war.battleScore = clamp((war.battleScore || 0) + (lossB - lossA) / 5000 * aSide, -45, 45);
  }
  if (A.morale <= 0 || armyMen(A) < 400) retreat(state, A);
  if (B.morale <= 0 || armyMen(B) < 400) retreat(state, B);
  if (armyMen(A) > 0) A.battle = null;
  if (armyMen(B) > 0) B.battle = null;
}

function stackPower(a, c, defense, p) {
  const m = c.modifiers || {};
  const tech = c.tech?.mil || 1;
  const base = a.men.infantry * 1 + a.men.cavalry * 1.18 + a.men.archer * 0.82 + a.men.artillery * 2.1 + a.men.mercenary * 0.95;
  const terrainCav = (p.terrain === 'mountains' || p.terrain === 'forest') ? 0.8 : 1;
  const leader = 1 + ((a.leader?.fire || 0) + (a.leader?.shock || 0)) * 0.025;
  return base * terrainCav * (1 + tech * 0.035) * (1 + (m.discipline || 0)) * (0.6 + a.morale / 160) * leader * (1 + defense);
}

function applyLosses(a, loss) {
  const total = armyMen(a);
  if (total <= 0) return;
  const ratio = Math.min(1, loss / total);
  for (const k of Object.keys(a.men)) a.men[k] = Math.max(0, Math.round(a.men[k] * (1 - ratio)));
}

export function retreat(state, a) {
  const p = state.provinces[a.provinceId];
  if (!p) { a.morale = 100; return; }
  const links = [...(p.neighbors || []), ...(p.seaNeighbors || [])];
  const options = links.filter((id) => {
    const q = state.provinces[id];
    return q && (q.owner === a.owner || q.controller === a.owner || q.owner === null);
  });
  const target = options.length ? options[randInt(state, 0, options.length - 1)] : null;
  if (target) {
    a.provinceId = target;
    a.move = null;
    a.siege = 0;
    a.morale = 15;
  } else {
    a.men = { infantry: 0, cavalry: 0, archer: 0, artillery: 0, mercenary: 0 };
    a.morale = 0;
  }
  a.battle = null;
  if (a.owner === state.playerTag) notify(state, a.owner, `An army has retreated from ${p.name}.`);
}

// ── Recruitment ───────────────────────────────────────────────
export function recruit(state, tag, provinceId, type, count = 1) {
  const c = state.countries[tag];
  const p = state.provinces[provinceId];
  const ut = UNIT_TYPES[type];
  if (!c || !p || !ut) return { ok: false, msg: 'Invalid recruitment.' };
  if (p.owner !== tag || p.controller !== tag) return { ok: false, msg: 'You must control the province.' };
  if (type === 'artillery' && c.tech.mil < ut.tech) return { ok: false, msg: `Requires Military Technology ${ut.tech}.` };
  const cost = ut.cost * count;
  if (c.treasury < cost) return { ok: false, msg: `Need ${cost} ducats.` };
  const mpCost = type === 'mercenary' ? 0 : ut.men * count;
  if (type !== 'mercenary' && c.manpower < mpCost) return { ok: false, msg: 'Not enough manpower.' };
  if (countryArmies(state, tag).reduce((s, a) => s + armyMen(a), 0) + ut.men * count > c.forceLimit * 1200) {
    return { ok: false, msg: `Force limit reached (${c.forceLimit} regiments).` };
  }
  c.treasury -= cost;
  c.manpower -= mpCost;
  let army = state.armies.find((a) => a.owner === tag && a.provinceId === provinceId && !a.move && !a.battle);
  if (!army) {
    army = makeArmy(state, tag, provinceId, { infantry: 0, cavalry: 0, archer: 0, artillery: 0 });
    state.armies.push(army);
  }
  army.men[type] = (army.men[type] || 0) + ut.men * count;
  if (tag === state.playerTag) notify(state, tag, `${count} ${ut.name} recruited in ${p.name}.`);
  return { ok: true, msg: `${count} ${ut.name} recruited.` };
}

export function buildShip(state, tag, provinceId, type, count = 1) {
  const c = state.countries[tag];
  const p = state.provinces[provinceId];
  const st = SHIP_TYPES[type];
  if (!c || !p || !st) return { ok: false, msg: 'Invalid ship.' };
  if (!p.port || p.owner !== tag || p.controller !== tag) return { ok: false, msg: 'Requires a controlled port.' };
  if (c.tech.dip < st.tech) return { ok: false, msg: `Requires Diplomatic Technology ${st.tech}.` };
  const cost = Math.round(st.cost * count * (1 + (c.modifiers.shipCost || 0)));
  if (c.treasury < cost) return { ok: false, msg: `Need ${cost} ducats.` };
  c.treasury -= cost;
  let navy = state.navies.find((n) => n.owner === tag && n.provinceId === provinceId);
  if (!navy) { navy = makeNavy(state, tag, provinceId, 0); state.navies.push(navy); }
  navy.ships[type] = (navy.ships[type] || 0) + count;
  if (tag === state.playerTag) notify(state, tag, `${count} ${st.name} launched in ${p.name}.`);
  return { ok: true, msg: `${count} ${st.name} launched.` };
}

export function splitArmy(state, army) {
  if (army.owner !== state.playerTag) return { ok: false, msg: 'Not your army.' };
  if (armyMen(army) < 2000) return { ok: false, msg: 'Army too small to split.' };
  const men = {};
  for (const k of Object.keys(army.men)) { men[k] = Math.floor(army.men[k] / 2); army.men[k] -= men[k]; }
  const b = makeArmy(state, army.owner, army.provinceId, men);
  b.morale = army.morale;
  state.armies.push(b);
  return { ok: true, msg: 'Army split.' };
}

export function mergeArmies(state, tag, provinceId) {
  const stacks = state.armies.filter((a) => a.owner === tag && a.provinceId === provinceId && !a.move);
  if (stacks.length < 2) return { ok: false, msg: 'No armies to merge.' };
  const main = stacks[0];
  for (let i = 1; i < stacks.length; i++) {
    const s = stacks[i];
    for (const k of Object.keys(main.men)) main.men[k] += s.men[k];
    main.morale = Math.min(main.morale, s.morale);
    state.armies = state.armies.filter((a) => a !== s);
  }
  return { ok: true, msg: 'Armies merged.' };
}

export function disbandArmy(state, army) {
  if (army.owner !== state.playerTag) return { ok: false, msg: 'Not your army.' };
  const c = state.countries[army.owner];
  c.manpower = Math.min(c.maxManpower, c.manpower + Math.round(armyMen(army) * 0.4));
  state.armies = state.armies.filter((a) => a !== army);
  return { ok: true, msg: 'Army disbanded.' };
}

// ── Navies ────────────────────────────────────────────────────
export function orderNavy(state, navy, targetId) {
  if (navy.owner !== state.playerTag) return { ok: false, msg: 'Not your fleet.' };
  const from = state.provinces[navy.provinceId], to = state.provinces[targetId];
  if (!from || !to) return { ok: false, msg: 'Invalid destination.' };
  if (!to.port) return { ok: false, msg: 'Fleets can only sail to ports.' };
  const links = [...(from.seaNeighbors || []), ...(from.neighbors || [])];
  if (!links.includes(targetId)) return { ok: false, msg: 'Destination is not adjacent by sea.' };
  navy.move = { to: targetId, daysLeft: 8 };
  return { ok: true, msg: `Fleet sailing to ${to.name}.` };
}

export function tickNavies(state) {
  for (const n of state.navies) {
    if (n.move) {
      n.move.daysLeft--;
      if (n.move.daysLeft <= 0) { n.provinceId = n.move.to; n.move = null; }
    }
  }
  // naval combat & blockade
  const byProv = new Map();
  for (const n of state.navies) {
    if (!byProv.has(n.provinceId)) byProv.set(n.provinceId, []);
    byProv.get(n.provinceId).push(n);
  }
  for (const [pid, fleets] of byProv) {
    if (fleets.length > 1) {
      for (let i = 0; i < fleets.length; i++) for (let j = i + 1; j < fleets.length; j++) {
        if (!isAtWar(state, fleets[i].owner, fleets[j].owner)) continue;
        const A = fleets[i], B = fleets[j];
        const pa = navyPower(state, A), pb = navyPower(state, B);
        if (pa <= 0 || pb <= 0) continue;
        const dmgA = Math.min(navyShips(A), pb * 0.012);
        const dmgB = Math.min(navyShips(B), pa * 0.012);
        removeShips(A, dmgA); removeShips(B, dmgB);
        A.morale = clamp(A.morale - 4, 0, 100); B.morale = clamp(B.morale - 4, 0, 100);
        if (navyShips(A) <= 0) state.navies = state.navies.filter((n) => n !== A);
        if (navyShips(B) <= 0) state.navies = state.navies.filter((n) => n !== B);
      }
    }
    // blockade of enemy port
    const p = state.provinces[pid];
    if (p && p.port && p.owner) {
      const blockader = fleets.find((f) => f.owner !== p.owner && isAtWar(state, f.owner, p.owner));
      if (blockader && blockader.mission === 'blockade') {
        p.blockaded = true;
        const war = state.wars.find((w) => w.attackers.includes(blockader.owner) && w.defenders.includes(p.owner));
        if (war) war.battleScore = clamp((war.battleScore || 0) + 0.03, -45, 45);
      }
    }
  }
  for (const p of state.provinces) {
    if (p.blockaded && !state.navies.some((n) => n.provinceId === p.id && n.owner !== p.owner && n.mission === 'blockade' && isAtWar(state, n.owner, p.owner))) p.blockaded = false;
  }
}

function navyPower(state, n) {
  const c = state.countries[n.owner];
  const tech = c?.tech.dip || 1;
  const mods = c?.modifiers || {};
  return (n.ships.galley * 2 + n.ships.cog * 3 + n.ships.caravel * 4) * (1 + tech * 0.03) * (1 + (mods.navy || 0)) * (0.5 + n.morale / 180);
}
function removeShips(n, amount) {
  let left = Math.round(amount);
  for (const k of ['caravel', 'cog', 'galley']) {
    const take = Math.min(n.ships[k], left);
    n.ships[k] -= take; left -= take;
    if (left <= 0) break;
  }
}

export function navalStrength(state, tag) {
  return countryNavies(state, tag).reduce((s, n) => s + n.ships.galley * 2 + n.ships.cog * 3 + n.ships.caravel * 4, 0);
}
export function countryNavies(state, tag) { return state.navies.filter((n) => n.owner === tag); }
export function countryArmies(state, tag) { return state.armies.filter((a) => a.owner === tag); }
export function totalArmyMen(state, tag) { return countryArmies(state, tag).reduce((s, a) => s + armyMen(a), 0); }
