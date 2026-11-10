// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  discountFrom,
  durationWeight,
  isoDurationMs,
  levelCost,
  matchShownLevel,
  rangeCost,
  rawCost,
  scaleDuration,
  techKind,
} from '../src/engines/tech';
import { addToPlan, inPlan, planCount, planMissing, planTotal, prune, removeFromPlan, type Plan } from '../src/engines/planner';
import { readTechDetails, readTechList } from '../src/data/tech-details';
import { renderTechPanel, watchTechPages, formatDuration } from '../src/modules/tech';
import { openPlanner, closePlanner } from '../src/modules/tech/planner-view';
import { MemoryStore, Store } from '../src/core/storage';
import { translator } from '../src/core/i18n';

const t = translator('it');

describe('tech costs', () => {
  it('knows the kind of each id', () => {
    expect(techKind(1)).toBe('building');
    expect(techKind(124)).toBe('research');
    expect(techKind(203)).toBe('unit');
    expect(techKind(401)).toBe('unit');
    expect(techKind(11101)).toBe('lfBuilding');
    expect(techKind(11201)).toBe('lfResearch');
    expect(techKind(9999)).toBeNull();
  });

  it('matches the game formula for buildings and research', () => {
    expect(rawCost(1, 1)).toEqual({ metal: 60, crystal: 15, deuterium: 0, energy: 0 });
    // Metal mine 30: 7.67M metal, 1.92M crystal.
    expect(rawCost(1, 30)).toEqual({ metal: 7670042, crystal: 1917510, deuterium: 0, energy: 0 });
    // Astrophysics uses 1.75.
    expect(rawCost(124, 2)).toEqual({ metal: 7000, crystal: 14000, deuterium: 7000, energy: 0 });
    // Graviton needs energy only, ×3 per level.
    expect(rawCost(199, 2).energy).toBe(900000);
  });

  it('scales lifeform techs with the level as well', () => {
    expect(rawCost(11101, 1)).toEqual({ metal: 7, crystal: 2, deuterium: 0, energy: 0 });
    expect(rawCost(11101, 2)).toEqual({ metal: 16, crystal: 4, deuterium: 0, energy: 0 });
  });

  it('reads the bonus out of the cost the game shows', () => {
    const raw = rawCost(1, 30);
    const shown = { metal: Math.floor(raw.metal * 0.9), crystal: Math.floor(raw.crystal * 0.9) };
    expect(discountFrom(1, 30, shown)).toBeCloseTo(0.1, 4);
    // Shown cost of level 30 does not fit level 29.
    expect(discountFrom(1, 29, shown)).toBeNull();
    const match = matchShownLevel(1, [29, 30, 31], shown);
    expect(match?.level).toBe(30);
    expect(match?.discount).toBeCloseTo(0.1, 4);
    expect(levelCost(1, 31, 0.1).metal).toBe(Math.floor(rawCost(1, 31).metal * 0.9));
  });

  it('sums a range of levels', () => {
    const r = rangeCost(1, 1, 3);
    expect(r.metal).toBe(60 + 90 + 135);
    expect(r.crystal).toBe(15 + 22 + 33);
  });

  it('scales the time shown by the game to other levels', () => {
    expect(scaleDuration(124, 5, 1000, 5)).toBe(1000);
    expect(scaleDuration(124, 5, 1000, 6)).toBeCloseTo(1750, 0);
    // Buildings below level 6 are faster: weight divides by 4 - L/2.
    expect(durationWeight(1, 2)).toBeCloseTo((90 + 22) / 3, 5);
    expect(durationWeight(203, 9)).toBe(1);
  });

  it('parses ISO durations', () => {
    expect(isoDurationMs('PT1H2M3S')).toBe(3723000);
    expect(isoDurationMs('P1DT1S')).toBe(86401000);
    expect(isoDurationMs('P2W')).toBe(1209600000);
    expect(isoDurationMs('garbage')).toBeNull();
    expect(formatDuration(3723000)).toBe('1h 2m 3s');
    expect(formatDuration(90061000)).toBe('1d 1h 1m');
  });
});

describe('planner', () => {
  const item = (id: number, level: number | undefined, metal: number, amount?: number) => ({
    id, level, amount, name: `#${id}`, cost: { metal, crystal: 0, deuterium: 0, energy: 0 }, added: 1,
  });

  it('adds without doubling a level and totals per body', () => {
    let plan: Plan = {};
    plan = addToPlan(plan, 10, [item(1, 31, 100), item(1, 32, 150)]);
    plan = addToPlan(plan, 10, [item(1, 32, 160)]);
    expect(plan['10']).toHaveLength(2);
    expect(planTotal(plan['10']!).metal).toBe(260);
    expect(planMissing(plan['10']!, { metal: 200, crystal: 0, deuterium: 0 }).metal).toBe(60);
    expect(inPlan(plan, 10, 1, 32)).toBe(true);
    expect(inPlan(plan, 11, 1, 32)).toBe(false);
    plan = addToPlan(plan, 10, [item(204, undefined, 30, 10), item(204, undefined, 30, 10)]);
    expect(planCount(plan)).toBe(4);
    plan = removeFromPlan(plan, 10, 0);
    expect(planCount(plan)).toBe(3);
  });

  it('drops reached levels: buildings on this body, research everywhere', () => {
    let plan: Plan = {};
    plan = addToPlan(plan, 10, [item(1, 31, 1), item(1, 32, 1), item(113, 12, 1)]);
    plan = addToPlan(plan, 20, [item(1, 31, 1), item(113, 13, 1)]);
    const out = prune(plan, 10, { 1: 31, 113: 12 });
    expect(out.changed).toBe(true);
    expect(out.plan['10']!.map((x) => x.level)).toEqual([32]);
    // Planet 20 keeps its mine 31 (other body) but loses nothing of research 13.
    expect(out.plan['20']!.map((x) => [x.id, x.level])).toEqual([
      [1, 31],
      [113, 13],
    ]);
    expect(prune(out.plan, 10, { 1: 30 }).changed).toBe(false);
  });
});

function techPage(opts: { id: number; built: number; target?: number; shown: Record<string, number>; amount?: boolean; panelLevel?: number }) {
  const costs = Object.entries(opts.shown)
    .map(([k, v]) => `<li class="resource ${k} icon sufficient tooltip" data-value="${v}">${v}</li>`)
    .join('');
  document.head.innerHTML = '';
  document.body.innerHTML = `
    <div id="resources_metal" data-raw="5000000"></div><div id="resources_crystal" data-raw="1000000"></div><div id="resources_deuterium" data-raw="0"></div>
    <div id="technologies"><ul>
      <li class="technology" data-technology="${opts.id}" aria-label="Miniera di metallo">
        <span class="level" data-value="${opts.built}">${opts.built}</span>
        ${opts.target ? `<span class="targetlevel" data-value="${opts.target}">${opts.target}</span>` : ''}
      </li>
    </ul></div>
    <div id="technologydetails_wrapper"><div id="technologydetails_content"></div></div>`;
  return `
    <div id="technologydetails" data-technology-id="${opts.id}">
      <div class="sprite sprite_large"></div>
      <div class="content"><h3>Miniera di metallo</h3>
        <div class="information"><span class="level" data-value="${opts.panelLevel ?? opts.built + 1}">Livello ${opts.built}</span>
          <ul class="narrow"><li class="build_duration"><strong>Durata:</strong><time class="value" datetime="PT2H">2h</time></li></ul>
        </div>
        <div class="costs"><p>Necessario:</p><ul class="ipiHintable">${costs}</ul></div>
        ${opts.amount ? '<div class="build_amount"><input id="build_amount" value="1"><button class="maximum">max</button></div>' : ''}
      </div>
    </div>`;
}

describe('tech panel', () => {
  const setup = (html: string) => {
    const store = new Store(new MemoryStore(), 'test');
    const readRes = () => ({ metal: 5000000, crystal: 1000000, deuterium: 0 });
    return { store, o: { doc: document, store, bodyId: 10, t, locale: 'it', have: readRes } };
  };

  it('reads the list and the details panel', () => {
    const raw = rawCost(1, 31);
    const html = techPage({ id: 1, built: 30, shown: { metal: raw.metal, crystal: raw.crystal } });
    document.getElementById('technologydetails_content')!.innerHTML = html;
    expect(readTechList(document)).toEqual([{ id: 1, name: 'Miniera di metallo', built: 30, level: 30 }]);
    const d = readTechDetails(document)!;
    expect(d.id).toBe(1);
    expect(d.shown.metal).toBe(raw.metal);
    expect(d.durationMs).toBe(7200000);
  });

  const btn = (i: number) => document.querySelectorAll<HTMLButtonElement>('.fut-tp-tools .fut-tp-btn')[i]!;
  const level = () => document.querySelector('.information .level')!.textContent;

  it('shows next level, cumulative, missing and adds the range to the plan', () => {
    const raw = rawCost(1, 31);
    const html = techPage({ id: 1, built: 30, shown: { metal: raw.metal, crystal: raw.crystal } });
    const { store, o } = setup(html);
    document.getElementById('technologydetails_content')!.innerHTML = html;
    const box = renderTechPanel(o, readTechDetails(document)!)!;
    expect(level()).toBe('30 → 31');
    expect(box.querySelector('.fut-tp-h:nth-child(2)')!.textContent).toBe('Liv. 31');
    // Metal 11.5M needed, 5M here: 6.5M missing.
    expect(box.querySelector('.fut-tp-short')!.getAttribute('title')).toBe((-(raw.metal - 5000000)).toLocaleString('it'));
    btn(2).click();
    btn(2).click();
    expect(level()).toBe('30 → 33');
    const sum = document.querySelectorAll('.fut-tp-v.fut-tp-sum')[0]!;
    expect(sum.getAttribute('title')).toBe(rangeCost(1, 31, 33).metal.toLocaleString('it'));
    expect(btn(3).title).toBe('Pianifica liv. 31–33');
    btn(3).click();
    expect(store.get<Plan>('planner', {})['10']!.map((x) => x.level)).toEqual([31, 32, 33]);
    expect(btn(3).classList.contains('on')).toBe(true);
    // Click again removes them.
    btn(3).click();
    expect(store.get<Plan>('planner', {})['10']).toBeUndefined();
    // The game's cost list and detail lines are hidden, the panel sits in .content.
    expect(document.getElementById('technologydetails')!.classList.contains('fut-tp-on')).toBe(true);
    expect(box.parentElement!.classList.contains('content')).toBe(true);
  });

  it('finds the right level when one is in construction and applies the discount', () => {
    // Level 31 in construction: the game shows the cost of 32 with 10% off.
    const raw = rawCost(1, 32);
    const html = techPage({ id: 1, built: 30, target: 31, shown: { metal: Math.floor(raw.metal * 0.9), crystal: Math.floor(raw.crystal * 0.9) } });
    const { o } = setup(html);
    document.getElementById('technologydetails_content')!.innerHTML = html;
    const box = renderTechPanel(o, readTechDetails(document)!)!;
    expect(level()).toBe('31 → 32');
    expect(box.querySelector('.fut-tp-disc')!.textContent).toContain('10,0%');
  });

  it('ships: any amount, also more than the game field allows', () => {
    const html = techPage({ id: 203, built: 0, shown: { metal: 6000, crystal: 6000 }, amount: true });
    const { store, o } = setup(html);
    document.getElementById('technologydetails_content')!.innerHTML = html;
    const details = readTechDetails(document)!;
    const box = renderTechPanel(o, details)!;
    const amount = document.querySelector<HTMLInputElement>('.fut-tp-amount')!;
    amount.value = '1000';
    amount.dispatchEvent(new Event('input'));
    expect(box.querySelectorAll('.fut-tp-v.fut-tp-sum')[0]!.getAttribute('title')).toBe((6000000).toLocaleString('it'));
    expect(Array.from(box.querySelectorAll('.fut-tp-short:not(.fut-tp-msu)')).map((x) => x.getAttribute('title'))).toEqual([(-1000000).toLocaleString('it'), (-5000000).toLocaleString('it')]);
    btn(0).click();
    expect(store.get<Plan>('planner', {})['10']![0]).toMatchObject({ id: 203, amount: 1000, cost: { metal: 6000000 } });
    // The game's own field still drives ours.
    details.amountInput!.value = '7';
    details.amountInput!.dispatchEvent(new Event('input'));
    return new Promise<void>((resolve) =>
      setTimeout(() => {
        expect(document.querySelector<HTMLInputElement>('.fut-tp-amount')!.value).toBe('7');
        resolve();
      }, 5),
    );
  });

  it('adds the panel when the game opens a details panel, and prunes the plan', async () => {
    const raw = rawCost(1, 31);
    const html = techPage({ id: 1, built: 30, shown: { metal: raw.metal, crystal: raw.crystal } });
    const { store, o } = setup(html);
    store.set('planner', addToPlan({}, 10, [{ id: 1, level: 30, name: 'x', cost: rawCost(1, 30), added: 1 }]));
    let changed = 0;
    watchTechPages({ ...o, onPlanChange: () => changed++ });
    expect(store.get<Plan>('planner', {})).toEqual({});
    expect(changed).toBe(1);
    document.getElementById('technologydetails_content')!.innerHTML = html;
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelectorAll('.fut-tp')).toHaveLength(1);
    expect(document.getElementById('fut-tp-style')).not.toBeNull();
  });
});

describe('plan by technology', () => {
  it('one group per technology over the bodies, missing per body and over the account', async () => {
    const { groupByTech, accountGap } = await import('../src/engines/planner');
    const c = (metal: number) => ({ metal, crystal: 0, deuterium: 0, energy: 0 });
    let plan = addToPlan({}, 10, [{ id: 1, level: 46, name: 'Miniera', cost: c(100), added: 1 }, { id: 2, level: 30, name: 'Cristallo', cost: c(50), added: 2 }]);
    plan = addToPlan(plan, 20, [{ id: 1, level: 45, name: 'Miniera', cost: c(80), added: 3 }, { id: 1, level: 46, name: 'Miniera', cost: c(100), added: 3 }]);
    const have: Record<number, { metal: number; crystal: number; deuterium: number }> = { 10: { metal: 120, crystal: 0, deuterium: 0 }, 20: { metal: 0, crystal: 0, deuterium: 0 } };
    const groups = groupByTech(plan, (id) => have[id] ?? null);
    expect(groups.map((g) => [g.name, g.rows.length, g.cost.metal])).toEqual([['Miniera', 2, 280], ['Cristallo', 1, 50]]);
    expect(groups[0]!.rows[1]).toMatchObject({ bodyId: 20, from: 45, to: 46, short: { metal: 180 } });
    // Body 10: the mine (100) fits in 120, the crystal mine after it lacks 30.
    expect(groups[0]!.rows[0]!.short!.metal).toBe(0);
    expect(groups[1]!.rows[0]!.short!.metal).toBe(30);
    expect(accountGap(plan, { metal: 300, crystal: 0, deuterium: 0 }).missing!.metal).toBe(30);
    expect(accountGap(plan, null).missing).toBeNull();
  });
});

describe('planner window', () => {
  it('by planet: one button brings everything, picked rows bring only themselves', () => {
    document.body.innerHTML = '';
    const store = new Store(new MemoryStore(), 'test');
    const c = (metal: number) => ({ metal, crystal: 0, deuterium: 0, energy: 0 });
    store.set('planner', addToPlan({}, 10, [
      { id: 1, level: 31, name: 'Miniera', cost: c(100), added: 1 },
      { id: 14, level: 5, name: 'Robot', cost: c(400), added: 2 },
    ]));
    let went = '';
    openPlanner({
      doc: document, store, snapshot: null, now: 0, locale: 'it', t,
      entries: [{ planetId: 10, moonId: null, name: 'Casa', coords: '1:2:3' } as never, { planetId: 20, moonId: null, name: 'Due', coords: '1:2:4' } as never],
      current: { id: 10, resources: { metal: 50, crystal: 0, deuterium: 0 } },
      href: 'https://s1-it.ogame.gameforge.com/game/index.php?page=ingame&component=supplies',
      navigate: (u) => (went = u),
    });
    const root = () => document.getElementById('fut-planner')!.shadowRoot!;
    // Opens by planet: one tile for the body, one row per planned thing.
    expect(root().querySelector('.seg [aria-pressed="true"]')!.textContent).toBe('Per pianeta');
    expect(root().querySelectorAll('.group.body')).toHaveLength(1);
    expect(root().querySelectorAll('.grow.pick')).toHaveLength(2);
    expect(root().querySelector('.bring-all')!.textContent).toBe('Porta tutto');
    root().querySelector<HTMLButtonElement>('.bring-all')!.click();
    expect(went).toContain('futdest=10');
    expect(store.get('plan.delivery', null)).toEqual({ target: 10, need: { metal: 450, crystal: 0, deuterium: 0 } });
    // Picking the second row: only its cost, less what the planet holds.
    root().querySelectorAll<HTMLButtonElement>('button.gbody')[1]!.click();
    expect(root().querySelector('.bring-all')!.textContent).toBe('Porta 1 scelti');
    root().querySelector<HTMLButtonElement>('.bring-all')!.click();
    expect(store.get('plan.delivery', null)).toEqual({ target: 10, need: { metal: 350, crystal: 0, deuterium: 0 } });
    closePlanner(document);
  });

  it('groups levels, shows totals and missing, removes and brings resources', () => {
    document.body.innerHTML = '';
    const store = new Store(new MemoryStore(), 'test');
    const c = (metal: number) => ({ metal, crystal: 50, deuterium: 0, energy: 0 });
    store.set('planner', addToPlan({}, 10, [
      { id: 1, level: 31, name: 'Miniera', cost: c(100), added: 1 },
      { id: 1, level: 32, name: 'Miniera', cost: c(150), added: 1 },
    ]));
    let changes = 0;
    let went = '';
    openPlanner({
      doc: document,
      store,
      entries: [
        { planetId: 10, moonId: null, name: 'Casa', coords: '1:2:3' } as never,
        { planetId: 20, moonId: null, name: 'Due', coords: '1:2:4' } as never,
      ],
      snapshot: null,
      current: { id: 10, resources: { metal: 60, crystal: 80, deuterium: 0 } },
      now: 0,
      locale: 'it',
      t,
      onChange: () => changes++,
      href: 'https://s1-it.ogame.gameforge.com/game/index.php?page=ingame&component=supplies',
      navigate: (u) => (went = u),
    });
    const root = document.getElementById('fut-planner')!.shadowRoot!;
    root.querySelector<HTMLButtonElement>('.seg [data-view="tech"]')!.click();
    expect(root.querySelectorAll('.group')).toHaveLength(1);
    expect(root.querySelector('.gtitle')!.textContent).toBe('Miniera');
    expect(root.querySelector('.gmeta')!.textContent).toBe('Casa [1:2:3] · liv. 31–32');
    // 250 metal needed, 60 here: shown once, in red, with what is missing in the tooltip.
    const metal = root.querySelector<HTMLElement>('.ghead .num.m')!;
    expect(metal.textContent).toBe('250');
    expect(metal.classList.contains('short')).toBe(true);
    expect(metal.title).toContain('190');
    root.querySelector<HTMLButtonElement>('.ib.bring')!.click();
    expect(went).toContain('cp=20');
    expect(went).toContain('futmode=plan');
    expect(went).toContain('futdest=10');
    expect(store.get('plan.delivery', null)).toEqual({ target: 10, need: { metal: 190, crystal: 20, deuterium: 0 } });
    root.querySelector<HTMLButtonElement>('.x')!.click();
    expect(changes).toBe(1);
    expect(root.querySelector('.empty')).not.toBeNull();
    closePlanner(document);
    expect(document.getElementById('fut-planner')).toBeNull();
  });
});

import { expeditionItemBoost, parseSpeciesBonuses, readActiveItems } from '../src/data/bonuses';
import { expeditionMax } from '../src/engines/fleet';

describe('expedition bonuses', () => {
  it('reads the lifeform booster and the active items', () => {
    expect(parseSpeciesBonuses({ data: { expedition: { ResultBooster: { totalBonus: { ResultBooster: 0.9184 } } } } }, 1)!.expedition).toBe(0.9184);
    expect(parseSpeciesBonuses({ data: { expedition: {} } }, 1)!.expedition).toBe(0);
    // An answer without the expedition section is broken, not "no bonus" (seen on s269-it, 2026-11-10).
    expect(parseSpeciesBonuses({}, 1)).toBeNull();
    expect(parseSpeciesBonuses({ data: {} }, 1)).toBeNull();
    document.body.innerHTML = `<div id="buffBar"><div data-uuid=""></div><div data-uuid="b0f6477d68c9683170cb8d32be2df1177669c5a0"></div><div data-uuid="615beac7f493e7724db5f6ef4f182e3be8d9545c"></div></div>`;
    const items = readActiveItems(document, 5)!;
    expect(items.uuids).toHaveLength(2);
    expect(expeditionItemBoost(items)).toBeCloseTo(0.4, 6);
    document.body.innerHTML = '';
    expect(readActiveItems(document)).toBeNull();
  });

  it('multiplies class, lifeform and item bonuses as OGLight does', () => {
    const plain = expeditionMax({ characterClass: 3, economySpeed: 8, classBooster: 0 }).max;
    expect(plain).toBe(5_000_000 * 24);
    const boosted = expeditionMax({ characterClass: 3, economySpeed: 8, classBooster: 0.5, lfBooster: 1, itemBoost: 0.4 }).max;
    expect(boosted).toBe(Math.round(5_000_000 * 24 * 1.5 * 2 * 1.4));
  });
});

import { pendingFor, prunePending } from '../src/engines/planner';

describe('resources sent to a planned body', () => {
  const ship = (target: number, metal: number, arriveAt: number) => ({ target, cargo: { metal, crystal: 0, deuterium: 0 }, sentAt: 0, arriveAt });

  it('counts shipments until the body was read after they landed', () => {
    const list = [ship(10, 100, 50), ship(10, 30, 200), ship(20, 5, 300)];
    expect(pendingFor(list, 10, 0)).toMatchObject({ metal: 130, arriveAt: 200 });
    expect(pendingFor(list, 10, 100).metal).toBe(30);
    const plan = addToPlan({}, 10, [{ id: 1, level: 5, name: 'x', cost: { metal: 1, crystal: 0, deuterium: 0, energy: 0 }, added: 1 }]);
    // Planet 20 has no plan, and the first shipment to 10 was already read.
    expect(prunePending(list, plan, () => 100)).toEqual([ship(10, 30, 200)]);
  });

  it('shows what was sent and offers to complete a partial delivery', () => {
    document.body.innerHTML = '';
    const store = new Store(new MemoryStore(), 'test');
    store.set('planner', addToPlan({}, 10, [{ id: 1, level: 31, name: 'Miniera', cost: { metal: 1000, crystal: 0, deuterium: 0, energy: 0 }, added: 1 }]));
    store.set('plan.sent', [ship(10, 600, 5_000)]);
    let went = '';
    openPlanner({
      doc: document, store, snapshot: null, now: 1_000, locale: 'it', t,
      entries: [{ planetId: 10, moonId: null, name: 'Casa', coords: '1:2:3' } as never, { planetId: 20, moonId: null, name: 'Due', coords: '1:2:4' } as never],
      current: { id: 10, resources: { metal: 0, crystal: 0, deuterium: 0 } },
      href: 'https://s1-it.ogame.gameforge.com/game/index.php?page=ingame&component=supplies',
      navigate: (u) => (went = u),
    });
    const root = document.getElementById('fut-planner')!.shadowRoot!;
    root.querySelector<HTMLButtonElement>('.seg [data-view="tech"]')!.click();
    expect(root.querySelector<HTMLElement>('.sent')!.title).toContain('600');
    const bring = root.querySelector<HTMLButtonElement>('.ib.bring')!;
    expect(bring.title).toContain("Completa l'invio");
    // 1000 needed, 600 on the way: only 400 lacking here.
    expect(root.querySelector<HTMLElement>('.ghead .num.m')!.title).toContain('400');
    bring.click();
    expect(went).toContain('cp=20');
    expect(store.get<{ need: { metal: number } } | null>('plan.delivery', null)!.need.metal).toBe(400);
    closePlanner(document);
  });
});

import { pruneByQueues, startBuild } from '../src/engines/planner';

describe('started builds leave the plan', () => {
  const cost = { metal: 100, crystal: 0, deuterium: 0, energy: 0 };
  it('on the click: level up to the started one, units by amount', () => {
    let plan = addToPlan({}, 10, [
      { id: 1, level: 46, name: 'Miniera di Metallo', cost, added: 1 },
      { id: 1, level: 47, name: 'Miniera di Metallo', cost, added: 1 },
      { id: 203, amount: 100, name: 'Cargo grande', cost: { ...cost, metal: 1000 }, added: 2 },
    ]);
    plan = startBuild(plan, 10, 1, { level: 46 }).plan;
    expect(plan['10']!.map((x) => x.level ?? x.amount)).toEqual([47, 100]);
    plan = startBuild(plan, 10, 203, { amount: 30 }).plan;
    expect(plan['10']![1]).toMatchObject({ amount: 70, cost: { metal: 700 } });
    plan = startBuild(plan, 10, 203, { amount: 500 }).plan;
    expect(plan['10']!.map((x) => x.id)).toEqual([1]);
  });

  it('from the construction queues, on any page', () => {
    const plan = addToPlan({}, 10, [
      { id: 1, level: 46, name: 'Miniera di Metallo', cost, added: 1 },
      { id: 1, level: 47, name: 'Miniera di Metallo', cost, added: 1 },
    ]);
    const out = pruneByQueues(plan, { '10': [{ name: 'Miniera di metallo', level: 46 }], '20': [{ name: 'Miniera di Metallo', level: 47 }] });
    expect(out.changed).toBe(true);
    expect(out.plan['10']!.map((x) => x.level)).toEqual([47]);
  });
});
