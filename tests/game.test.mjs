import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildWorld } from '../js/geo.js';
import { PROVINCE_DATA } from '../js/data/provinces.js';
import { createGame, monthlyEconomy, relation, setRelation, totalDev, ownedProvinces, warsOf } from '../js/engine/state.js';
import { advanceDays } from '../js/engine/sim.js';
import { tickArmies, totalArmyMen } from '../js/engine/military.js';
import { evaluatePeace, makePeace, updateCoalitions, neighborTags } from '../js/engine/diplomacy.js';
import { runAI } from '../js/engine/ai.js';

function freshProvinces() {
  return PROVINCE_DATA.map(([name, lon, lat, terrain, good, tax, prod, mp, owner, culture, religion, opts = {}]) => ({
    ...opts, name, lon, lat, terrain, good, dev: { tax, prod, mp }, owner, culture, religion,
  }));
}

const geo = JSON.parse(fs.readFileSync(new URL('../assets/geo.json', import.meta.url), 'utf8'));

function makeGame(tag = 'FRA') {
  const provinces = freshProvinces();
  provinces.forEach((p, i) => { p.id = i; });
  buildWorld(geo, provinces);
  return createGame({ playerTag: tag, provinces, difficulty: 'normal', seed: 1444 });
}

test('province Voronoi cells partition the world without overlap', () => {
  const provinces = freshProvinces();
  provinces.forEach((p, i) => { p.id = i; });
  const world = buildWorld(geo, provinces);
  const area = (poly) => {
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      a += p.x * q.y - q.x * p.y;
    }
    return Math.abs(a / 2);
  };
  const total = world.cells.reduce((sum, cell) => sum + area(cell), 0);
  assert.ok(world.cells.every((cell) => cell.length >= 3), 'no empty cells');
  assert.ok(Math.abs(total - 360 * 144) < 1, `cells tile the world (got ${total})`);
});

test('economy produces finite income, expenses and treasury', () => {
  const s = makeGame();
  const c = s.countries.FRA;
  monthlyEconomy(s, c);
  assert.ok(Number.isFinite(c.income) && c.income > 0, 'income should be positive');
  assert.ok(Number.isFinite(c.expense) && c.expense > 0, 'expense should be positive');
  assert.ok(Number.isFinite(c.treasury), 'treasury should be finite');
  assert.ok(c.lastIncome.tax > 0 && c.lastIncome.production > 0, 'tax and production should exist');
  assert.ok(totalDev(s, 'FRA') > 0);
});

test('battles cause casualties and record a battle', () => {
  const s = makeGame();
  const fra = s.armies.find((a) => a.owner === 'FRA');
  const eng = s.armies.find((a) => a.owner === 'ENG');
  assert.ok(fra && eng, 'both armies exist');
  const before = totalArmyMen(s, 'FRA') + totalArmyMen(s, 'ENG');
  const province = s.countries.FRA.capital;
  fra.provinceId = province;
  eng.provinceId = province;
  for (let i = 0; i < 12; i++) tickArmies(s);
  const after = totalArmyMen(s, 'FRA') + totalArmyMen(s, 'ENG');
  assert.ok(s.stats.battles > 0, 'battle counter increased');
  assert.ok(after < before, 'troops were lost');
  assert.ok(Number.isFinite(fra.morale) && Number.isFinite(eng.morale));
});

test('peace treaty transfers an occupied province', () => {
  const s = makeGame();
  const war = s.wars.find((w) => (w.attackers.includes('FRA') && w.defenders.includes('ENG')) || (w.attackers.includes('ENG') && w.defenders.includes('FRA')));
  assert.ok(war, 'the Hundred Years War exists');
  assert.ok(war.attackers.includes('FRA') || war.defenders.includes('FRA'));
  const target = s.provinces.find((p) => p.owner === 'ENG' && !p.capital);
  target.controller = 'FRA';
  // France is the defender in the Hundred Years War, so its war score is the negative
  // of the attacker-perspective score.
  war.score = -40;
  war.battleScore = -40;
  const ev = evaluatePeace(s, war, 'FRA', { provinces: [target.id], gold: 0, releaseVassals: [] });
  assert.ok(ev.accept, 'AI accepts a modest demand at 40 war score');
  const res = makePeace(s, war, 'FRA', { provinces: [target.id], gold: 0, releaseVassals: [] });
  assert.ok(res.ok);
  assert.equal(target.owner, 'FRA');
  assert.ok(!s.wars.includes(war), 'war ended');
});

test('aggressive expansion forms a coalition of neighbours', () => {
  const s = makeGame();
  s.countries.FRA.ae = 45;
  const neighbours = neighborTags(s, 'FRA').slice(0, 3);
  assert.ok(neighbours.length >= 2, 'France has neighbours');
  for (const t of neighbours) setRelation(s, 'FRA', t, -120);
  updateCoalitions(s);
  const co = (s.coalitions || []).find((c) => c.target === 'FRA');
  assert.ok(co, 'a coalition formed');
  assert.ok(co.members.length >= 2);
  assert.ok(relation(s, 'FRA', co.members[0]) < 0);
});

test('a simulated year advances without NaN or crashes', () => {
  const s = makeGame();
  advanceDays(s, 366);
  assert.equal(s.date.y, 1445);
  for (const c of Object.values(s.countries)) {
    assert.ok(Number.isFinite(c.treasury), `${c.tag} treasury finite`);
    assert.ok(Number.isFinite(c.income), `${c.tag} income finite`);
    assert.ok(Number.isFinite(c.manpower), `${c.tag} manpower finite`);
  }
  assert.ok(s.log.length > 0);
});

test('AI can run a monthly turn independently', () => {
  const s = makeGame('ENG');
  for (let i = 0; i < 3; i++) runAI(s);
  assert.ok(Object.values(s.countries).every((c) => Number.isFinite(c.treasury)));
});

test('save serialization strips raw data but preserves HRE and reloads', () => {
  const s = makeGame();
  advanceDays(s, 45);
  const json = JSON.stringify(s, (key, value) => (key === 'flagsData' ? undefined : value));
  const loaded = JSON.parse(json);
  assert.equal(loaded.countries.FRA.flagsData, undefined);
  assert.equal(loaded.countries.BRA.hre, true, 'HRE marker survives');
  assert.ok(loaded.countries.FRA.personality);
  assert.ok(loaded.provinces.every((p) => Array.isArray(p.neighbors)));
  advanceDays(loaded, 30);
  assert.equal(loaded.playerTag, 'FRA');
  assert.ok(loaded.date.y >= 1444);
  assert.ok(ownedProvinces(loaded, 'FRA').length > 0);
  assert.ok(warsOf(loaded, 'FRA').length >= 1);
});
