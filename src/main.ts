/**
 * Future bootstrap. Runs once per game page.
 * Network calls are allowed only until bootstrap ends (see core/guard.ts).
 */
import { NetworkGuard } from './core/guard';
import { GMStore, Store, serverNamespace } from './core/storage';
import { downloadBackup, importBackup } from './core/backup';
import { IdleSaver } from './core/idle-saver';
import { detectLocale, translator } from './core/i18n';
import { SNAPSHOT_KEY, hydrateAccountOncePerSession, syncAccountOnUserClick, type AccountSnapshot } from './data/account-info';
import { currentBodyId, readCurrentResources, readPlanetList } from './data/planet-list';
import { applyPageResources } from './engines/resources';
import { SCORE_KEY, watchScore, type Score } from './data/score';
import { HISTORY_KEY, recordDay, type History } from './engines/history';
import { loadServerDataOnPageLoad } from './data/server-data';
import { highlightPosition, isGalaxyPage, TARGETS_KEY, watchGalaxy } from './modules/galaxy';
import { nextInSide, onSideNavigate, refreshSide, restoreSide, toggleSide } from './modules/marks/side';
import { loadMarks, MARKS_KEY, migrateOld, type Marks } from './engines/marks';
import { QUEUES_KEY, loadQueuesOnPageLoad, syncQueuesOnUserClick, type QueueSnapshot } from './data/queues';
import { ITEMS_KEY, fetchLfBonuses, hydrateLfOncePerSession, readActiveItems } from './data/bonuses';
import { dayFigures, openDashboard } from './modules/dashboard';
import { TECH_NAMES_KEY, learnTechNames, type TechNames } from './data/tech-names';
import { readTechList } from './data/tech-details';
import { LF_SLOTS_KEY, readLfSlots, rememberLfSlots, type LfSlots } from './data/lf-slots';
import { isFleetDispatch } from './data/fleet-page';
import { renderFleetTools } from './modules/fleet';
import { watchJumpgate } from './modules/fleet/jumpgate';
import { registerShortcuts, switchBodyUrl } from './modules/shortcuts';
import { nextBody } from './engines/fleet';
import { watchTechPages } from './modules/tech';
import { openPlanner } from './modules/tech/planner-view';
import { PLAN_KEY, pendingFor, planCount, planMissing, pruneByQueues, SENT_KEY, type Plan, type Shipment } from './engines/planner';
import { estimateResources } from './engines/resources';
import { entriesIn, JOURNAL_KEY, periodRange, periodStats, type Journal } from './engines/expeditions';
import { isMessagesPage, ownPlayerId } from './data/messages';
import { watchMessages } from './modules/messages';
import { openJournal } from './modules/messages/journal-view';
import { isHighscorePage, watchHighscore } from './modules/highscore';
import { bellButton, clockOffset, startReminders, watchEventList } from './modules/reminders';
import { renderPlanetMenu, type MenuMode, type MenuSettings } from './modules/planet-menu';

async function bootstrap(): Promise<void> {
  const namespace = serverNamespace(document);
  if (!namespace) return; // not a logged-in game page

  const guard = new NetworkGuard((input, init) => fetch(input, init), window.location.origin);
  const gm = new GMStore();
  const store = new Store(gm, namespace);
  // One-time move of the galaxy targets and rivals kept before 2026-11-06 into the new marks.
  const moved = migrateOld(loadMarks(store.get<Partial<Marks> | null>(MARKS_KEY, null)), {
    targets: store.get<{ coords: string; planet: string; player: string; at: number }[]>(TARGETS_KEY, []),
    rivals: store.get<{ id: number; name: string; at: number }[]>('rivals.list', []),
  });
  if (moved) {
    store.set(MARKS_KEY, moved);
    store.set(TARGETS_KEY, []);
    store.set('rivals.list', []);
  }
  if (store.get('rivals.points', null) !== null) store.set('rivals.points', null);
  const locale = detectLocale(document);
  const t = translator(locale);
  let snapshot: AccountSnapshot | null = store.get<AccountSnapshot | null>(SNAPSHOT_KEY, null);
  const saver = new IdleSaver(() => store.set(SNAPSHOT_KEY, snapshot));
  window.addEventListener('beforeunload', () => saver.saveNow());

  const bodyIds = readPlanetList(document).flatMap((e) => [e.planetId, e.moonId]).filter((id): id is number => id !== null);
  let queues: QueueSnapshot | null = store.get<QueueSnapshot | null>(QUEUES_KEY, null);
  try {
    const [account, queue, lf] = await Promise.allSettled([
      hydrateAccountOncePerSession({ guard, store, session: window.sessionStorage }),
      loadQueuesOnPageLoad({ guard, store, ids: bodyIds }),
      // Lifeform bonuses for the expedition size: once per session, like accountInfo.
      hydrateLfOncePerSession({ guard, store, session: window.sessionStorage }),
      // Universe size and fleet speeds: public API, at most once a week.
      loadServerDataOnPageLoad({ guard, store, origin: location.origin }),
    ]);
    if (lf.status === 'rejected') console.warn(`[${t('app.name')}]`, lf.reason);
    if (account.status === 'fulfilled') snapshot = account.value;
    else console.warn(`[${t('app.name')}]`, account.reason);
    if (queue.status === 'fulfilled') queues = queue.value;
    else console.warn(`[${t('app.name')}]`, queue.reason);
  } finally {
    // COMPLIANCE: from here on no background call can leave the page (AGENTS.md §4).
    guard.closePageLoadWindow();
  }

  // Keep the viewed body exact by reading the game's resource bar: no network call.
  const bodyId = currentBodyId(document);
  const onPage = readCurrentResources(document);
  if (snapshot && bodyId && onPage && applyPageResources(snapshot, bodyId, onPage, Date.now())) saver.markDirty();

  // Planned levels already in the construction queues leave the plan, on every page.
  if (queues) {
    const pruned = pruneByQueues(store.get<Plan>(PLAN_KEY, {}), queues.bodies);
    if (pruned.changed) store.set(PLAN_KEY, pruned.plan);
  }

  // Active items are listed on the overview's buff bar only: keep the last list seen.
  const items = readActiveItems(document);
  if (items) store.set(ITEMS_KEY, items);

  // Technology names in the player's language, from any technology page the player opens.
  const techNames = store.get<TechNames>(TECH_NAMES_KEY, {});
  const techList = readTechList(document);
  if (learnTechNames(techNames, techList)) store.set(TECH_NAMES_KEY, techNames);

  // Lifeform research slots in use on this planet, from the game's own page (lifeforms mix).
  const lfSlots = store.get<LfSlots>(LF_SLOTS_KEY, {});
  const seenSlots = readLfSlots(document, techList);
  if (seenSlots && bodyId && rememberLfSlots(lfSlots, bodyId, seenSlots)) store.set(LF_SLOTS_KEY, lfSlots);

  // Points are on the overview page only, typed in by the game's own script after load: keep the last value seen.
  watchScore(document, () => Date.now(), (score) => {
    store.set(SCORE_KEY, score);
    // History: one entry per day from what is already known (page DOM + stored snapshot), no network.
    store.set(HISTORY_KEY, recordDay(store.get<History>(HISTORY_KEY, []), { at: score.at, points: score.points, rank: score.rank, ...dayFigures(snapshot) }));
  });

  const deps = { guard, store, session: window.sessionStorage };
  const storedMode = store.get<string>('planetMenu.mode', 'side');
  let settings: MenuSettings = {
    // 'stacked' was the previous layout: it maps to the side-by-side one.
    mode: (storedMode === 'compact' ? 'compact' : 'side') as MenuMode,
    showTotals: store.get<boolean>('planetMenu.totals', true),
    markIdle: store.get<boolean>('planetMenu.markIdle', false),
  };
  /** What the plan still misses over all bodies, in MSU (resources on the way count as there). */
  const planGap = (): number | null => {
    const plan = store.get<Plan>(PLAN_KEY, {});
    const sent = store.get<Shipment[]>(SENT_KEY, []);
    const now = Date.now();
    const here = currentBodyId(document);
    const onScreen = readCurrentResources(document);
    let total = 0;
    let known = false;
    for (const [key, items] of Object.entries(plan)) {
      const id = Number(key);
      const body = snapshot?.bodies.find((b) => b.id === id);
      const have = here === id && onScreen ? onScreen : body ? estimateResources(body, now) : null;
      if (!have || !items.length) continue;
      known = true;
      const p = pendingFor(sent, id, here === id ? now : (body?.resourcesAt ?? 0));
      const gap = planMissing(items, { metal: have.metal + p.metal, crystal: have.crystal + p.crystal, deuterium: have.deuterium + p.deuterium });
      total += gap.metal + gap.crystal * 1.5 + gap.deuterium * 3;
    }
    return known ? total : null;
  };
  const draw = () =>
    renderPlanetMenu({
      doc: document,
      entries: readPlanetList(document),
      snapshot,
      queues,
      settings,
      now: Date.now(),
      locale,
      t,
      onSettingsChange: (next) => {
        settings = next;
        store.set('planetMenu.mode', next.mode);
        store.set('planetMenu.totals', next.showTotals);
        store.set('planetMenu.markIdle', next.markIdle);
        draw();
      },
      onBackupExport: () => downloadBackup(document, gm, Date.now()),
      onBackupImport: (text) => importBackup(gm, text),
      onOpenDashboard: () =>
        openDashboard({
          doc: document,
          snapshot,
          entries: readPlanetList(document),
          score: store.get<Score | null>(SCORE_KEY, null),
          history: store.get<History>(HISTORY_KEY, []),
          bell: (r) => bellButton(document, store, t, r),
          queues,
          names: techNames,
          lfSlots,
          now: Date.now(),
          locale,
          t,
        }),
      planCount: planCount(store.get<Plan>(PLAN_KEY, {})),
      planGap: planGap(),
      journalToday: (() => {
        const s = periodStats(entriesIn(store.get<Journal>(JOURNAL_KEY, {}), periodRange('today', Date.now())));
        return { count: s.count, net: s.netMsu };
      })(),
      onOpenPlanner: () => {
        const id = currentBodyId(document);
        const resources = readCurrentResources(document);
        openPlanner({
          doc: document,
          store,
          entries: readPlanetList(document),
          snapshot,
          current: id && resources ? { id, resources } : null,
          now: Date.now(),
          locale,
          t,
          onChange: () => draw(),
          href: location.href,
          navigate: (url) => location.assign(url),
        });
      },
      onOpenJournal: () => openJournal({ doc: document, store, now: Date.now(), locale, t }),
      // COMPLIANCE: runs only from the Sync button's click (reason 'user-sync', no cp).
      onSync: async () => {
        try {
          const [account, queue] = await Promise.allSettled([
            syncAccountOnUserClick(deps),
            syncQueuesOnUserClick({ guard, store, ids: bodyIds }),
            fetchLfBonuses({ guard, store }, 'user-sync'),
          ]);
          if (account.status === 'fulfilled') snapshot = account.value;
          if (queue.status === 'fulfilled') queues = queue.value;
          draw();
        } catch (error) {
          console.warn(`[${t('app.name')}]`, error);
        }
      },
    });
  draw();

  const currentId = currentBodyId(document);
  const list = readPlanetList(document);

  // Keyboard, as in OGLight: I / O = previous / next planet (from a moon: previous / next moon).
  // A normal page change with cp, the same as clicking the planet list.
  if (currentId) {
    const go = (backwards: boolean) => {
      const id = nextBody(list, currentId, { backwards });
      if (id) location.assign(switchBodyUrl(location.href, id));
    };
    registerShortcuts(document, [
      { key: 'i', label: 'shortcut.prev', run: () => go(true) },
      { key: 'o', label: 'shortcut.next', run: () => go(false) },
    ]);
    // Jump gate dialog: keeps reserve 1 of this moon at home.
    watchJumpgate(document, store, currentId, t);
  }

  // Building, research, shipyard and defence pages: cost panel and construction plan.
  if (currentId) {
    watchTechPages({ doc: document, store, bodyId: currentId, t, locale, have: () => readCurrentResources(document), onPlanChange: () => draw() });
  }

  // Targets side bar: stays open across pages as the player left it; M = next position of its list.
  const side = { doc: document, store, guard, t, locale };
  const openTargetsHere = () => toggleSide(side);
  onSideNavigate(highlightPosition);
  restoreSide(side);
  registerShortcuts(document, [{ key: 'm', label: 'shortcut.nextTarget', run: () => void nextInSide(document) }]);
  const pageMeta = (name: string) => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? '';

  // Manual reminders: due ones are shown on the page; bells on the game's event list.
  const reminders = { doc: document, store, t, locale, offset: clockOffset(document, Date.now()) };
  startReminders(reminders);
  watchEventList(reminders);

  // Highscore: gap to the player, days to catch up, rival star.
  if (isHighscorePage(document)) watchHighscore({ doc: document, store, locale, t, guard });

  // Inbox: a summary on each report; expedition reports go into the journal.
  if (isMessagesPage(document))
    watchMessages({
      doc: document, store, playerId: ownPlayerId(document), locale, t,
      spy: {
        bases: (snapshot?.bodies ?? []).map((b) => ({ id: b.id, name: b.name, coords: b.coords, moon: b.type === 'moon' })),
        researches: snapshot?.researches ?? {},
        classId: Number(pageMeta('ogame-player-characterclass-id')) || 0,
        server: pageMeta('ogame-universe').split('.')[0] ?? '',
        lang: pageMeta('ogame-ui-language') || pageMeta('ogame-language'),
      },
    });

  // Fleet page helpers: reserves and fleetsave, on the game's own form.
  if (isFleetDispatch(document) && currentId) {
    const bodies = readPlanetList(document).map(({ planetId, moonId, name, coords }) => ({ planetId, moonId, name, coords }));
    renderFleetTools({ doc: document, store, bodyId: currentId, bodies, t, locale });
  }

  // Galaxy view: system summary, marks, debris in MSU, targets and the scores card.
  if (isGalaxyPage(document)) {
    const ownPlanetIds = new Set(readPlanetList(document).flatMap((e) => (e.planetId ? [e.planetId] : [])));
    watchGalaxy({ doc: document, store, guard, ownPlanetIds, locale, t, onOpenTargets: openTargetsHere, onSystem: refreshSide });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void bootstrap(), { once: true });
} else {
  void bootstrap();
}
