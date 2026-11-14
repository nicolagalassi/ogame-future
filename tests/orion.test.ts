import { describe, expect, it } from 'vitest';
import {
  balance, collectedOnly, emptyArchive, importLegacy, launchPlan, noRewards, noteBattle, noteFuel, orionEvents, orionTotals, otherSummary, poolAt, profit, projectMission, scansPossible, settle, shipMatcher, syncArchive, syncLedger, dueList,
  type Archive, type LedgerRecord, type Lithium, type PendingMap, type Rewards,
} from '../src/engines/orion';
import { durationHours, parseGameDate, readCollectDialog, readMissionCard, readScanCard } from '../src/data/orion';

const H = 3_600_000;
const NOW = new Date(2026, 10, 14, 12, 0, 0).getTime();
const rec = (coords: string, cost: number, endH: number, lithium = 0): LedgerRecord => ({ coords, name: coords, cost, lithium, endAt: NOW + endH * H, source: 'mission', at: NOW });
const rw = (r: Partial<Rewards>): Rewards => ({ ...noRewards(), ...r });

describe('orion profitability', () => {
  it('ranks by MSU per hour of lithium production; free ones first', () => {
    const p = profit(1_000_000, rw({ metal: 3_000_000, crystal: 2_000_000 }), 100_000);
    expect(p.msu).toBe(6_000_000);
    expect(p.index).toBe(600_000);
    expect(p.hours).toBe(10);
    const free = profit(1_000, rw({ metal: 10, lithium: 2_000 }), 100);
    expect(free.free).toBe(true);
    expect(free.index).toBeGreaterThan(p.index);
    expect(profit(0, rw({ metal: 5 }), 100).index).toBe(-1);
    // Without the production, per million lithium: same order.
    expect(profit(1_000_000, rw({ metal: 3_000_000 }), 0).index).toBe(3_000_000);
  });
});

describe('orion lithium timeline', () => {
  const l = (o: Partial<Lithium> = {}): Lithium => ({ now: 1_000, perHour: 100, stopsIn: Infinity, cap: Infinity, ...o });

  it('adds production, pays each anomaly at its end, stops with the conversion and at full storage', () => {
    const due = dueList([rec('1:1:1', 500, 2, 100)], NOW);
    expect(poolAt(l(), due, 1)).toBe(1_100);
    expect(poolAt(l(), due, 3)).toBe(1_000 + 300 - 400);
    expect(poolAt(l({ stopsIn: 1 }), due, 3)).toBe(1_100 - 400);
    expect(poolAt(l({ cap: 1_150 }), [], 10)).toBe(1_150);
    // Over the storage (a reward), production stays off until it falls below.
    expect(poolAt(l({ now: 2_000, cap: 1_150 }), [], 5)).toBe(2_000);
  });

  it('keeps back what the anomalies under way need, and finds the earliest launch that covers every wave', () => {
    const records = [rec('2:2:2', 1_500, 4)];
    const plan = launchPlan({ cost: 1_000, lithium: 0, msu: 10_000 }, 2, 4, l(), records, '9:9:9', NOW)!;
    // At 2h: 1200 in the bar, but at 4h the other one takes 1500 of 1400: 1400 − 1500 = −100 free.
    expect(plan.free).toBe(-100);
    expect(plan.covered).toBe(0);
    expect(plan.wait).not.toBeNull();
    const later = launchPlan({ cost: 1_000, lithium: 0, msu: 10_000 }, 2 + plan.wait!, 4, l(), records, '9:9:9', NOW)!;
    expect(later.covered).toBe(4);
    // Its own coordinates are not held back for itself.
    expect(launchPlan({ cost: 1_000, lithium: 0, msu: 10_000 }, 2, 4, l(), records, '2:2:2', NOW)!.covered).toBe(4);
    // The conversion stops first: never.
    expect(launchPlan({ cost: 5_000, lithium: 0, msu: 1 }, 1, 1, l({ stopsIn: 1 }), [], '', NOW)!.wait).toBeNull();
  });

  it('counts the scans the bar can pay without starving the anomalies under way', () => {
    expect(scansPossible(l(), [], 300, NOW)).toEqual({ cost: 300, free: 1_000, count: 3 });
    expect(scansPossible(l(), [rec('1:1:1', 1_000, 1)], 300, NOW)!.count).toBe(0);
    expect(scansPossible(l(), [rec('1:1:1', 1_000, 1)], 300, NOW)!.free).toBe(100);
  });

  it('projects a mission onto its last wave; the largest figure ever seen wins', () => {
    expect(projectMission({ cost: 2_567_018, lithium: 0 }, { incoming: 2, total: 7 }, 3600, undefined, NOW)).toEqual({ cost: 17_969_126, lithium: 0, partial: false, endAt: NOW + H });
    expect(projectMission({ cost: 100, lithium: 0 }, { incoming: 1, total: 7 }, 0, undefined, NOW).partial).toBe(true);
    expect(projectMission({ cost: 100, lithium: 0 }, { incoming: 1, total: 7 }, 0, rec('1:1:1', 700, 5), NOW).cost).toBe(700);
    const ledger = syncLedger({ a: { ...rec('3:3:3', 1, 1), source: 'scanner' }, b: rec('4:4:4', 1, 1) }, [{ coords: '5:5:5', name: 'X', cost: 10, lithium: 0, incoming: 2, total: 2, seconds: 60 }], NOW);
    expect(Object.keys(ledger).sort()).toEqual(['5:5:5', 'a']);
  });
});

describe('orion archive', () => {
  const seen = (id: string, coords = '1:1:1') => ({ id, name: 'Chaos', coords, level: 300, stars: 2, mode: 'PvE', kind: 'Battaglia', spawnedAt: NOW - H, wave: 1, waves: 3 });

  it('writes the anomalies listed and closes the ones gone', () => {
    let a = syncArchive(emptyArchive(), [seen('A'), seen('B', '2:2:2')], NOW);
    expect(a.entries.A).toMatchObject({ status: 'running', located: true, level: 300, wave: 1 });
    a = syncArchive(a, [{ ...seen('A'), level: 0, wave: 0 }], NOW + 1);
    expect(a.entries.A!.level).toBe(300);
    expect(a.entries.A!.wave).toBe(1);
    expect(a.entries.B).toMatchObject({ status: 'expired', endedAt: NOW + 1 });
  });

  it('counts only what really left the card', () => {
    const r = collectedOnly(rw({ metal: 100, crystal: 50, other: ['Caccia leggero 120', 'Esperienza 10'] }), rw({ metal: 100, crystal: 50, other: ['Caccia leggero 120', 'Esperienza 10'] }), rw({ metal: 40, crystal: 0, other: ['Caccia leggero 20'] }));
    expect(r).toMatchObject({ metal: 60, crystal: 50 });
    expect(r.other).toEqual(['Caccia leggero 100', 'Esperienza 10']);
  });

  it('settles a collect once the card cost went down, or the card stayed gone', () => {
    const archive: Archive = syncArchive(emptyArchive(), [seen('A')], NOW);
    const pending: PendingMap = { A: { at: NOW, via: 'dialog', cost: 500, rewards: rw({ metal: 1_000 }), before: rw({ metal: 1_000 }), cardCost: 500, cardValue: 1_000, wave: 2, waves: 2 } };
    // A wave arrived meanwhile (cost up): not a payout.
    let s = settle(pending, archive, new Map([['A', { cost: 800, value: 1_500, rewards: rw({ metal: 1_500 }) }]]), () => false, NOW + 1_000);
    expect(s.pending.A).toBeDefined();
    expect(s.archive.entries.A!.collections).toHaveLength(0);
    s = settle(pending, archive, new Map([['A', { cost: 0, value: 0, rewards: rw({}) }]]), () => false, NOW + 1_000);
    expect(s.archive.entries.A!.collections[0]).toMatchObject({ cost: 500, metal: 1_000, wave: 2 });
    // Gone: noted, then counted once it stayed gone.
    s = settle(pending, archive, new Map(), () => false, NOW + 1_000);
    expect(s.pending.A!.goneSince).toBe(NOW + 1_000);
    s = settle(s.pending, archive, new Map(), () => false, NOW + 5_000);
    expect(s.archive.entries.A!.collections).toHaveLength(1);
    // The card button with a dialog after it: Accept will be the collection.
    expect(settle({ A: { ...pending.A!, via: 'card' } }, archive, new Map(), () => true, NOW).pending).toEqual({});
  });

  it('notes fuel to anomalies and battles at them, sums a period', () => {
    let a: Archive = syncArchive(emptyArchive(), [seen('A', '5:100:8')], NOW);
    expect(noteFuel(a, { at: NOW, coords: '1:1:1', type: 1, mission: 3, deut: 100 })).toBeNull();
    a = noteFuel(a, { at: NOW, coords: '5:100:8', type: 1, mission: 3, deut: 1_000 })!;
    a = noteFuel(a, { at: NOW, coords: '6:6:6', type: 4, mission: 14, deut: 500 })!;
    expect(a.fuel).toHaveLength(2);
    expect(noteBattle(a, { id: 'm1', at: NOW, coords: '1:2:3', targetType: 'planet', lost: { 204: 1 }, won: false, draw: false }, NOW)).toBeNull();
    a = noteBattle(a, { id: 'm2', at: NOW, coords: '5:100:8', targetType: 'anomaly', targetId: 'A', lost: { 204: 10 }, won: true, draw: false }, NOW)!;
    expect(noteBattle(a, { id: 'm2', at: NOW, coords: '5:100:8', lost: {}, won: true, draw: false }, NOW)).toBeNull();
    a = { ...a, entries: { ...a.entries, A: { ...a.entries.A!, collections: [{ at: NOW, wave: 1, waves: 1, cost: 10, lithium: 2, metal: 1_000, crystal: 0, deuterium: 0, other: ['Caccia leggero 2', 'Esperienza 5', 'Esperienza 7'] }] } } };
    const shipOf = shipMatcher([[204, 'Caccia leggero'], [215, 'Incrociatore da battaglia'], [206, 'Incrociatore']]);
    expect(shipOf('Incrociatore da battaglia 3')).toEqual({ id: 215, n: 3 });
    // A flight to the player's own planet without the anomaly mission is not anomaly fuel.
    const t = orionTotals(orionEvents(a, new Set(['6:6:6']), NOW), shipOf);
    expect(t).toMatchObject({ collections: 1, paid: 10, back: 2, gain: 1_000, gotN: 2, gotMsu: 2 * 4_500, fuel: 1_500, battles: 1, lostN: 10, lostMsu: 45_000 });
    expect(balance(t)).toBe(1_000 + 9_000 - 45_000 - 4_500);
    expect(otherSummary(t.other, 'it')).toBe('Esperienza 12');
    expect(orionTotals(orionEvents(a, new Set(['5:100:8']), NOW), shipOf).fuel).toBe(500);
  });

  it('imports the Orion Calculator data once, what Future has wins', () => {
    const cur = { archive: syncArchive(emptyArchive(), [seen('A')], NOW), ledger: {}, ignored: {} };
    const out = importLegacy(cur, {
      archive: { entries: { A: { name: 'old' }, B: { name: 'Beta', coords: '2:2:2', collections: [{ at: 1, metal: 5 }] } }, fuel: [{ at: 1, coords: '2:2:2', deut: 9 }], battles: { x: { at: 1, lost: {} }, y: { v: 2, at: 2, entry: 'B', lost: { 204: 1 } } } },
      ledger: { '7:7:7': rec('7:7:7', 5, 1) },
      ignored: { '7:7:7': true },
    });
    expect(out.archive.entries.A!.name).toBe('Chaos');
    expect(out.archive.entries.B!.collections[0]).toMatchObject({ metal: 5, crystal: 0 });
    expect(out.archive.fuel).toHaveLength(1);
    expect(Object.keys(out.archive.battles)).toEqual(['y']);
    expect(out.ledger['7:7:7']).toBeDefined();
    expect(out.ignored['7:7:7']).toBe(true);
  });
});

describe('orion page readers', () => {
  it('reads a scanner card as the game draws it (s808, 13.x)', () => {
    document.body.innerHTML = `<div class="scannerResultCard"><div class="scannerResultName">Risorsa: Metallo</div>
      <div class="scannerResultTable"><div class="scannerResultRow header"></div><div class="scannerResultRow">
      <div class="cell">306</div><div class="cell"><a>[9:249:10]</a></div><div class="cell">1g 2o 40m</div><div class="cell">3</div><div class="cell">20.000</div><div class="cell">Battaglia</div>
      <div class="cell" data-tooltip-title="158.095"><lithium-icon></lithium-icon>158K</div></div></div>
      <div class="scannerResultRewardsList"><div class="rewardLine"><resource-icon class="metal"></resource-icon><span class="rewardName">Metallo</span><span class="rewardAmount">≈943.352</span></div>
      <div class="rewardLine"><lithium-icon></lithium-icon><span class="rewardName">Litio</span><span class="rewardAmount">1.000</span></div>
      <div class="rewardLine"><span class="rewardName">Caccia leggero</span><span class="rewardAmount">10 - 20</span></div></div></div>`;
    expect(readScanCard(document.querySelector('.scannerResultCard')!)).toEqual({ coords: '9:249:10', name: 'Risorsa: Metallo', cost: 158_095, rewards: { metal: 943_352, crystal: 0, deuterium: 0, lithium: 1_000, other: ['Caccia leggero 10 - 20'] }, hours: 26 + 40 / 60, waves: 3 });
  });

  it('reads a mission card and the collect dialog', () => {
    document.body.innerHTML = `<div class="anomalyMission pvp" data-space-object-id="777"><span class="missionNameText">Chaos</span><span class="missionLevel">Liv. 120</span>
      <div class="missionDifficultyStars"><img><img></div><div class="missionDetailsSubtitle"><span class="titleTypeIcon">PvP</span><span class="titleTypeIcon">Battaglia</span></div>
      <div class="spawnedCell">02.10.2026 09:05:49</div><div class="missionRouteLabels"><div class="routeLabelCell"><span class="nodeCoords">[1:2:3]</span></div><div class="routeLabelCell"><span class="nodeCoords">[4:5:6]</span></div></div>
      <span class="nodeWave">Ondata: 2 / 7</span><span id="despawn_777" data-seconds="7200"></span>
      <div class="rewardsCell"><div class="rewardLine"><resource-icon class="crystal"></resource-icon><span class="rewardAmount">2.000</span></div></div>
      <div class="missionActionBar"><button class="collectRewards"><span class="btnSub">Costi del litio: 2.567.018</span></button></div></div>
      <div class="orionCollectRewards" data-space-object-id="777"><div class="collectWaveRow affordable"><span class="cwWave">1</span><div class="cwRewards"><div class="rewardLine"><resource-icon class="metal"></resource-icon><span class="rewardAmount">500</span></div></div></div>
      <div class="collectWaveRow"><span class="cwWave">2</span></div><span class="collectTotalValue">1.234</span></div>`;
    expect(readMissionCard(document.querySelector('.anomalyMission')!)).toMatchObject({ id: '777', name: 'Chaos', coords: '4:5:6', cost: 2_567_018, incoming: 2, total: 7, seconds: 7200, level: 120, stars: 2, mode: 'PvP', kind: 'Battaglia', spawnedAt: parseGameDate('02.10.2026 09:05:49'), rewards: { crystal: 2_000 } });
    expect(readCollectDialog(document.querySelector('.orionCollectRewards')!)).toEqual({ id: '777', waves: [1], rewards: { metal: 500, crystal: 0, deuterium: 0, lithium: 0, other: [] }, cost: 1_234 });
    expect(durationHours('45m 10s')).toBeCloseTo(0.75 + 10 / 3600);
  });
});
