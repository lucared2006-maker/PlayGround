// Diplomacy, claims, wars and peace treaties.
import {
  clamp, rand, randInt, dateNum, relation, setRelation, addRelation, truceUntil, setTruce,
  isAtWar, warsOf, sideOf, warScore, countryName, notify, totalDev, ownedProvinces, dateShort,
} from './state.js';

export function aliveCountries(state) { return Object.values(state.countries).filter((c) => c.alive); }

export function neighborTags(state, tag) {
  const set = new Set();
  for (const p of state.provinces) {
    if (p.owner !== tag) continue;
    for (const n of p.neighbors || []) {
      const q = state.provinces[n];
      if (q?.owner && q.owner !== tag) set.add(q.owner);
    }
    for (const n of p.seaNeighbors || []) {
      const q = state.provinces[n];
      if (q?.owner && q.owner !== tag) set.add(q.owner);
    }
  }
  return [...set];
}

export function canImprove(state, a, b) {
  if (!state.countries[b]) return 'No such country.';
  if (relation(state, a, b) >= 200) return 'Relations are already excellent.';
  if (state.countries[a].treasury < 25) return 'Need 25 ducats.';
  return null;
}
export function improveRelations(state, a, b) {
  const err = canImprove(state, a, b); if (err) return { ok: false, msg: err };
  const c = state.countries[a];
  c.treasury -= 25;
  const gain = relation(state, a, b) > 100 ? 6 : 15;
  addRelation(state, a, b, gain);
  return { ok: true, msg: `Relations with ${countryName(state, b)} improved (+${gain}).` };
}

export function royalMarriage(state, a, b) {
  const ca = state.countries[a], cb = state.countries[b];
  if (!ca || !cb) return { ok: false, msg: 'No such country.' };
  if (ca.gov === 'republic' || ca.gov === 'oligarchy') return { ok: false, msg: 'Republics do not marry dynastically.' };
  if (isAtWar(state, a, b)) return { ok: false, msg: 'Cannot marry while at war.' };
  if (ca.marriages.includes(b)) return { ok: false, msg: 'Already joined in marriage.' };
  if (relation(state, a, b) < -50) return { ok: false, msg: 'Relations are too poor.' };
  ca.marriages.push(b); cb.marriages.push(a);
  addRelation(state, a, b, 25);
  ca.prestige += 2;
  return { ok: true, msg: `Royal marriage with ${cb.name}.` };
}

export function formAlliance(state, a, b) {
  const ca = state.countries[a], cb = state.countries[b];
  if (!ca || !cb) return { ok: false, msg: 'No such country.' };
  if (ca.allies.includes(b)) return { ok: false, msg: 'Already allied.' };
  if (isAtWar(state, a, b)) return { ok: false, msg: 'Cannot ally an enemy.' };
  if (ca.rivals.includes(b)) return { ok: false, msg: 'Rivals cannot ally.' };
  if (ca.allies.length >= 4) return { ok: false, msg: 'Alliance limit reached (4).' };
  if (relation(state, a, b) < 40) return { ok: false, msg: `Requires 40 relations (currently ${relation(state, a, b)}).` };
  ca.allies.push(b); cb.allies.push(a);
  addRelation(state, a, b, 20);
  return { ok: true, msg: `Alliance formed with ${cb.name}.` };
}

export function breakAlliance(state, a, b) {
  const ca = state.countries[a], cb = state.countries[b];
  if (!ca?.allies.includes(b)) return { ok: false, msg: 'Not allied.' };
  ca.allies = ca.allies.filter((x) => x !== b);
  cb.allies = cb.allies.filter((x) => x !== a);
  addRelation(state, a, b, -50);
  ca.prestige = Math.max(-100, ca.prestige - 10);
  return { ok: true, msg: `Alliance with ${cb.name} broken.` };
}

export function guarantee(state, a, b) {
  const ca = state.countries[a], cb = state.countries[b];
  if (!ca || !cb) return { ok: false, msg: 'No such country.' };
  if (ca.guarantees.includes(b)) return { ok: false, msg: 'Already guaranteed.' };
  if (relation(state, a, b) < 20) return { ok: false, msg: 'Requires 20 relations.' };
  if (ca.treasury < 20) return { ok: false, msg: 'Need 20 ducats.' };
  ca.treasury -= 20;
  ca.guarantees.push(b);
  addRelation(state, a, b, 10);
  return { ok: true, msg: `Independence of ${cb.name} guaranteed.` };
}

export function militaryAccess(state, a, b) {
  const ca = state.countries[a], cb = state.countries[b];
  if (!ca || !cb) return { ok: false, msg: 'No such country.' };
  if (ca.access.includes(b)) return { ok: false, msg: 'Access already granted.' };
  if (relation(state, a, b) < 0) return { ok: false, msg: 'Requires non-negative relations.' };
  if (ca.treasury < 15) return { ok: false, msg: 'Need 15 ducats.' };
  ca.treasury -= 15;
  ca.access.push(b);
  addRelation(state, a, b, 8);
  return { ok: true, msg: `Military access through ${cb.name} secured.` };
}

export function tradeAgreement(state, a, b) {
  const ca = state.countries[a], cb = state.countries[b];
  if (!ca || !cb) return { ok: false, msg: 'No such country.' };
  ca.tradeAgreements = ca.tradeAgreements || [];
  if (ca.tradeAgreements.includes(b)) return { ok: false, msg: 'Trade agreement already active.' };
  if (relation(state, a, b) < 20) return { ok: false, msg: 'Requires 20 relations.' };
  ca.tradeAgreements.push(b);
  addRelation(state, a, b, 10);
  return { ok: true, msg: `Trade agreement signed with ${cb.name}.` };
}

export function fabricateClaim(state, tag, provinceId) {
  const c = state.countries[tag];
  const p = state.provinces[provinceId];
  if (!c || !p) return { ok: false, msg: 'Invalid province.' };
  if (p.owner === tag) return { ok: false, msg: 'You already own this province.' };
  if (c.claims.includes(provinceId)) return { ok: false, msg: 'Claim already fabricated.' };
  if (c.fabricating) return { ok: false, msg: 'Diplomats are already fabricating a claim.' };
  const adjacent = ownedProvinces(state, tag).some((q) => (q.neighbors || []).includes(provinceId) || (q.seaNeighbors || []).includes(provinceId));
  if (!adjacent) return { ok: false, msg: 'Province must border your realm.' };
  if (c.treasury < 50) return { ok: false, msg: 'Need 50 ducats.' };
  c.treasury -= 50;
  c.fabricating = { provinceId, monthsLeft: 6, name: p.name };
  return { ok: true, msg: `Diplomats sent to fabricate a claim on ${p.name}.` };
}

export function tickClaims(state) {
  for (const c of Object.values(state.countries)) {
    if (!c.fabricating) continue;
    c.fabricating.monthsLeft--;
    if (c.fabricating.monthsLeft <= 0) {
      if (!c.claims.includes(c.fabricating.provinceId)) c.claims.push(c.fabricating.provinceId);
      if (c.tag === state.playerTag) notify(state, c.tag, `Claim on ${c.fabricating.name} fabricated.`);
      c.fabricating = null;
    }
  }
}

export function canDeclareWar(state, a, b) {
  const ca = state.countries[a], cb = state.countries[b];
  if (!ca || !cb) return 'No such country.';
  if (isAtWar(state, a, b)) return 'Already at war.';
  if (ca.allies.includes(b)) return 'Cannot attack an ally.';
  if (ca.overlord === b) return 'Cannot attack your overlord without a war of independence.';
  if (truceUntil(state, a, b) > dateNum(state.date)) return 'A truce is in force.';
  if (relation(state, a, b) > 100) return 'Relations are too good for a war.';
  return null;
}

export function declareWar(state, a, b, cb = 'conquest') {
  const err = canDeclareWar(state, a, b); if (err) return { ok: false, msg: err };
  const ca = state.countries[a], cbC = state.countries[b];
  const hasClaim = ca.claims.some((id) => state.provinces[id]?.owner === b);
  const war = {
    id: state.nextWarId++,
    name: `${ca.name}–${cbC.name} War`,
    attackers: [a], defenders: [b], leaderA: a, leaderB: b,
    score: 0, battleScore: 0, start: dateNum(state.date), cb: hasClaim ? 'claim' : cb,
    history: [], duration: 0,
  };
  state.wars.push(war);
  state.stats.wars++;
  ca.claims = ca.claims.filter((id) => state.provinces[id]?.owner !== b);
  setRelation(state, a, b, -150);
  // call allies and overlords
  for (const ally of [...cbC.allies]) {
    if (ally !== a && state.countries[ally]?.alive && !war.attackers.includes(ally) && !war.defenders.includes(ally)) {
      war.defenders.push(ally);
      addRelation(state, b, ally, 10);
      if (ally === state.playerTag) notify(state, ally, `You answer the call to arms against ${ca.name}.`);
    }
  }
  if (cbC.overlord && state.countries[cbC.overlord] && !war.defenders.includes(cbC.overlord)) {
    war.defenders.push(cbC.overlord);
    if (cbC.overlord === state.playerTag) notify(state, cbC.overlord, `Your vassal ${cbC.name} has been attacked by ${ca.name}!`);
  }
  for (const ally of [...ca.allies]) {
    if (ally !== b && state.countries[ally]?.alive && !war.attackers.includes(ally) && !war.defenders.includes(ally)) {
      if (relation(state, ally, a) >= 30 || state.countries[ally].vassals.includes(a)) {
        war.attackers.push(ally);
        if (ally === state.playerTag) notify(state, ally, `You join ${ca.name} in war against ${cbC.name}.`);
      }
    }
  }
  for (const v of ca.vassals) if (!war.attackers.includes(v) && state.countries[v]?.alive) war.attackers.push(v);
  // aggressive expansion
  const ae = hasClaim ? 8 : 16;
  ca.ae = (ca.ae || 0) + ae;
  for (const n of neighborTags(state, b)) {
    if (n === a) continue;
    addRelation(state, n, a, -Math.round(ae * 0.8));
  }
  for (const c of aliveCountries(state)) {
    if (c.tag === a) continue;
    addRelation(state, c.tag, a, -Math.round(ae * 0.2));
  }
  if (a === state.playerTag) notify(state, a, `War declared on ${cbC.name}.`);
  if (b === state.playerTag) notify(state, b, `${ca.name} has declared war on you!`);
  return { ok: true, msg: `War declared on ${cbC.name}.`, war };
}

export function updateWars(state) {
  for (const w of state.wars) {
    w.score = warScore(state, w);
    w.duration = dateNum(state.date) - w.start;
  }
}

export function occupiedBySide(state, war, side) {
  const own = side === 'attacker' ? war.attackers : war.defenders;
  const foe = side === 'attacker' ? war.defenders : war.attackers;
  return state.provinces.filter((p) => foe.includes(p.owner) && own.includes(p.controller));
}

export function warSideTags(war, side) { return side === 'attacker' ? war.attackers : war.defenders; }

export function peaceCost(state, provinceIds = [], gold = 0, releaseVassals = []) {
  let cost = 0;
  for (const id of provinceIds) {
    const p = state.provinces[id];
    if (p) cost += (p.dev.tax + p.dev.prod + p.dev.mp) * 0.9 + (p.capital ? 10 : 0);
  }
  cost += gold / 12;
  cost += releaseVassals.length * 18;
  return Math.round(cost);
}

export function evaluatePeace(state, war, tag, demands) {
  const side = sideOf(war, tag);
  if (!side) return { accept: false, msg: 'Not in this war.' };
  const score = side === 'attacker' ? war.score : -war.score;
  const cost = peaceCost(state, demands.provinces || [], demands.gold || 0, demands.releaseVassals || []);
  if (cost === 0) {
    const accept = Math.abs(war.score) <= 15 || (side === 'attacker' ? war.score >= 0 : war.score <= 0);
    return { accept, cost: 0, score, needed: 0, msg: accept ? 'White peace is acceptable.' : 'The enemy will not accept a white peace yet.' };
  }
  const accept = score >= cost - 3;
  return {
    accept, cost, score, needed: Math.max(0, cost),
    msg: accept ? 'The enemy will accept these terms.' : `War score ${score} is not enough (need about ${Math.ceil(cost)}).`,
  };
}

export function makePeace(state, war, tag, demands) {
  const side = sideOf(war, tag);
  if (!side) return { ok: false, msg: 'Not in this war.' };
  const ev = evaluatePeace(state, war, tag, demands);
  if (!ev.accept) return { ok: false, msg: ev.msg };
  const winnerTags = warSideTags(war, side);
  const loserTags = warSideTags(war, side === 'attacker' ? 'defender' : 'attacker');
  const receiver = tag;
  for (const id of demands.provinces || []) {
    const p = state.provinces[id];
    if (!p || !loserTags.includes(p.owner) || !winnerTags.includes(p.controller)) continue;
    const oldOwner = p.owner;
    p.owner = receiver;
    p.controller = receiver;
    p.autonomy = 30;
    p.unrest = clamp(p.unrest + 12, 0, 100);
    p.capital = false;
    state.stats.provincesTaken++;
    const old = state.countries[oldOwner];
    if (old && old.capital === id) {
      const rest = ownedProvinces(state, oldOwner);
      if (rest.length) { old.capital = rest[0].id; rest[0].capital = true; }
    }
  }
  const gold = Math.max(0, Math.round(demands.gold || 0));
  if (gold > 0) {
    const loser = state.countries[loserTags[0]];
    if (loser) loser.treasury = Math.round((loser.treasury - gold) * 100) / 100;
    const rec = state.countries[receiver];
    if (rec) rec.treasury = Math.round((rec.treasury + gold) * 100) / 100;
  }
  for (const v of demands.releaseVassals || []) {
    const c = state.countries[v];
    if (c && c.overlord) {
      const ov = state.countries[c.overlord];
      if (ov) ov.vassals = ov.vassals.filter((x) => x !== v);
      c.overlord = null;
    }
  }
  endWar(state, war, tag);
  return { ok: true, msg: 'Peace signed.' };
}

export function endWar(state, war, winnerTag) {
  const tags = [...war.attackers, ...war.defenders];
  // restore only provinces occupied by participants of this war
  for (const p of state.provinces) {
    if (p.owner && p.controller !== p.owner && tags.includes(p.owner) && tags.includes(p.controller)
      && !state.armies.some((a) => a.owner === 'REB' && a.provinceId === p.id)) {
      p.controller = p.owner;
      p.siege = null;
    }
  }
  for (const t of tags) {
    const c = state.countries[t];
    if (!c) continue;
    c.warExhaustion = clamp(c.warExhaustion + 3, 0, 20);
    c.prestige = clamp(c.prestige + (t === winnerTag ? 8 : -4), -100, 100);
  }
  for (let i = 0; i < tags.length; i++) for (let j = i + 1; j < tags.length; j++) {
    if (state.countries[tags[i]] && state.countries[tags[j]]) {
      setTruce(state, tags[i], tags[j], dateNum(state.date) + 1825);
      addRelation(state, tags[i], tags[j], 20);
    }
  }
  state.wars = state.wars.filter((w) => w !== war);
  if (tags.includes(state.playerTag)) notify(state, state.playerTag, 'Peace has been concluded.');
}

export function annexVassal(state, tag, vassalTag) {
  const c = state.countries[tag], v = state.countries[vassalTag];
  if (!c || !v || v.overlord !== tag) return { ok: false, msg: 'Not your vassal.' };
  if (relation(state, tag, vassalTag) < 100) return { ok: false, msg: 'Requires 100 relations with the vassal.' };
  if (warsOf(state, tag).length) return { ok: false, msg: 'Cannot annex while at war.' };
  if (c.treasury < 150) return { ok: false, msg: 'Need 150 ducats.' };
  if (c.points.adm < 100) return { ok: false, msg: 'Need 100 administrative points.' };
  c.treasury -= 150; c.points.adm -= 100;
  for (const p of state.provinces) {
    if (p.owner === vassalTag) { p.owner = tag; p.controller = tag; p.autonomy = 35; }
  }
  v.alive = false;
  v.overlord = null;
  c.vassals = c.vassals.filter((x) => x !== vassalTag);
  state.armies = state.armies.filter((a) => a.owner !== vassalTag);
  state.navies = state.navies.filter((n) => n.owner !== vassalTag);
  state.wars = state.wars.filter((w) => !w.attackers.includes(vassalTag) && !w.defenders.includes(vassalTag));
  c.prestige += 15;
  return { ok: true, msg: `${v.name} annexed.` };
}

export function aiSeekAlliance(state, c, targetTag) {
  if (!state.countries[targetTag]?.alive) return false;
  if (relation(state, c.tag, targetTag) < 50) return false;
  if (isAtWar(state, c.tag, targetTag)) return false;
  return formAlliance(state, c.tag, targetTag).ok;
}

export function aiAcceptAlliance(state, a, b) {
  if (!state.countries[a] || !state.countries[b]) return false;
  if (isAtWar(state, a, b)) return false;
  if (state.countries[a].rivals.includes(b)) return false;
  if (relation(state, a, b) < 30) return false;
  if (state.countries[a].allies.length >= 4) return false;
  return formAlliance(state, a, b).ok;
}

export function warLeaderSide(state, war, tag) { return sideOf(war, tag); }

export function autoPeaceAI(state, war) {
  // Both sides AI: resolve after a reasonable duration.
  if (war.attackers.includes(state.playerTag) || war.defenders.includes(state.playerTag)) return;
  const dur = dateNum(state.date) - war.start;
  if (dur < 800 && Math.abs(war.score) < 40) return;
  const a = state.countries[war.leaderA], d = state.countries[war.leaderB];
  if (!a || !d) { state.wars = state.wars.filter((w) => w !== war); return; }
  if (war.score >= 25) {
    const occupied = occupiedBySide(state, war, 'attacker');
    const demand = occupied.slice().sort((x, y) => (y.dev.tax + y.dev.prod + y.dev.mp) - (x.dev.tax + x.dev.prod + x.dev.mp))[0];
    makePeace(state, war, war.leaderA, { provinces: demand ? [demand.id] : [], gold: 0, releaseVassals: [] });
  } else if (war.score <= -25) {
    const occupied = occupiedBySide(state, war, 'defender');
    const demand = occupied[0];
    makePeace(state, war, war.leaderB, { provinces: demand ? [demand.id] : [], gold: 0, releaseVassals: [] });
  } else if (dur > 2400) {
    makePeace(state, war, war.leaderA, { provinces: [], gold: 0, releaseVassals: [] });
  }
}

export function diploStatus(state, a, b) {
  const ca = state.countries[a], cb = state.countries[b];
  if (!ca || !cb) return 'Unknown';
  if (isAtWar(state, a, b)) return 'At war';
  if (ca.allies.includes(b)) return 'Allied';
  if (ca.vassals.includes(b)) return 'Vassal';
  if (ca.overlord === b) return 'Overlord';
  if (ca.marriages.includes(b)) return 'Royal marriage';
  if (ca.rivals.includes(b)) return 'Rival';
  if (truceUntil(state, a, b) > dateNum(state.date)) return 'Truce';
  return 'Neutral';
}

// ── Coalitions ────────────────────────────────────────────────
// Aggressive expansion slowly binds threatened neighbours into a coalition.
export function updateCoalitions(state) {
  if (!Array.isArray(state.coalitions)) state.coalitions = [];
  const next = [];
  for (const target of aliveCountries(state)) {
    const ae = target.ae || 0;
    if (ae < 24) { target.ae = Math.max(0, ae - 0.35); continue; }
    const members = aliveCountries(state).filter((c) => {
      if (c.tag === target.tag) return false;
      if (target.allies.includes(c.tag) || target.vassals.includes(c.tag)) return false;
      if (target.overlord === c.tag || c.overlord === target.tag) return false;
      if (c.tag === state.playerTag && state.difficulty === 'easy') return false;
      if (isAtWar(state, c.tag, target.tag)) return false;
      const near = neighborTags(state, target.tag).includes(c.tag);
      const hostile = relation(state, c.tag, target.tag) <= -35;
      return hostile && (near || c.rivals.includes(target.tag) || relation(state, c.tag, target.tag) <= -80);
    });
    if (members.length >= 2) {
      next.push({ target: target.tag, members: members.map((c) => c.tag), formed: dateNum(state.date) });
    }
    target.ae = Math.max(0, ae - 0.25);
  }
  state.coalitions = next;
}

export function coalitionWarCheck(state) {
  if (!state.coalitions) return;
  for (const co of [...state.coalitions]) {
    const target = state.countries[co.target];
    if (!target?.alive) continue;
    if (warsOf(state, co.target).length) continue;
    const members = co.members.map((t) => state.countries[t]).filter((c) => c?.alive && c.tag !== state.playerTag);
    if (members.length < 2) continue;
    const strength = members.reduce((s, c) => s + (c.forceLimit || 0), 0);
    if (strength < (target.forceLimit || 1) * 1.35) continue;
    if (rand(state) > 0.08 * (state.difficulty === 'hard' ? 1.4 : 1)) continue;
    members.sort((a, b) => (b.forceLimit || 0) - (a.forceLimit || 0));
    const leader = members[0];
    const res = declareWar(state, leader.tag, co.target, 'coalition');
    if (!res.ok) continue;
    const war = res.war;
    for (const m of members.slice(1)) {
      if (!war.attackers.includes(m.tag) && !war.defenders.includes(m.tag)) {
        war.attackers.push(m.tag);
        addRelation(state, m.tag, leader.tag, 15);
      }
    }
    war.name = `Coalition against ${target.name}`;
    if (co.target === state.playerTag) notify(state, state.playerTag, `A coalition led by ${leader.name} has declared war on you!`);
    if (leader.tag === state.playerTag) notify(state, state.playerTag, `You lead a coalition war against ${target.name}.`);
  }
}
