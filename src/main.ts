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
import { applyPageResources, mergeNewerResources } from './engines/resources';
import { SCORE_KEY, watchScore, type Score } from './data/score';
import { HISTORY_KEY, recordDay, type History } from './engines/history';
import { loadServerDataOnPageLoad } from './data/server-data';
import { highlightPosition, isGalaxyPage, TARGETS_KEY, watchGalaxy } from './modules/galaxy';
import { nextInSide, onSideNavigate, openSide, refreshSide, restoreSide, toggleSide } from './modules/marks/side';
import { renderDock } from './modules/dock';
import { loadMarks, MARKS_KEY, migrateOld, type Marks } from './engines/marks';
import { convertOglight, convertOglightStats, isOglightDb } from './engines/oglight-import';
import { POSITIONS_KEY, type Positions } from './engines/positions';
import { QUEUES_KEY, loadQueuesOnPageLoad, syncQueuesOnUserClick, type QueueSnapshot } from './data/queues';
import { ITEMS_KEY, LF_BONUS_KEY, fetchLfBonuses, hydrateLfOncePerSession, readActiveItems, type LfBonuses } from './data/bonuses';
import { openSettings, type Section } from './modules/settings';
import { dayFigures, openDashboard } from './modules/dashboard';
import { TECH_NAMES_KEY, learnTechNames, type TechNames } from './data/tech-names';
import { readTechList } from './data/tech-details';
import { LF_SLOTS_KEY, readLfSlots, rememberLfSlots, type LfSlots } from './data/lf-slots';
import { isFleetDispatch } from './data/fleet-page';
import { renderFleetTools } from './modules/fleet';
import { watchJumpgate } from './modules/fleet/jumpgate';
import { mountTouchBar, registerActions, switchBodyUrl } from './modules/shortcuts';
import { nextBody } from './engines/fleet';
import { watchTechPages } from './modules/tech';
import { accountResources, openPlanner } from './modules/tech/planner-view';
import { accountGap, PLAN_KEY, pendingFor, planCount, pruneByQueues, SENT_KEY, type Plan, type Shipment } from './engines/planner';
import { estimateResources } from './engines/resources';
import { entriesIn, JOURNAL_KEY, periodRange, periodStats, type Journal } from './engines/expeditions';
import { isMessagesPage, ownPlayerId } from './data/messages';
import { watchMessages } from './modules/messages';
import { openJournal } from './modules/messages/journal-view';
import { isHighscorePage, watchHighscore } from './modules/highscore';
import { bellButton, clockOffset, startReminders, watchEventList } from './modules/reminders';
import { renderPlanetMenu, watchPlanetBar, type MenuMode, type MenuSettings } from './modules/planet-menu';
import { TECH_ICONS_KEY, type TechIcon } from './data/tech-icons';

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
  // Points since midnight from the public highscore (until 0.3.7): replaced by PTRE's snapshot.
  for (const type of [0, 1, 2, 3, 8]) if (store.get(`hs.daily.${type}`, null) !== null) store.set(`hs.daily.${type}`, null);
  const locale = detectLocale(document);
  const t = translator(locale);
  let snapshot: AccountSnapshot | null = store.get<AccountSnapshot | null>(SNAPSHOT_KEY, null);
  const saver = new IdleSaver(() => {
    if (!snapshot) return;
    // Merge, do not replace: other tabs may have saved newer amounts of other bodies meanwhile.
    const stored = store.get<AccountSnapshot | null>(SNAPSHOT_KEY, null);
    store.set(SNAPSHOT_KEY, stored ? mergeNewerResources(stored, snapshot) : snapshot);
  });
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
    showFleet: store.get<boolean>('planetMenu.fleet', false),
    totalView: store.get<string>('planetMenu.totalView', 'msu') === 'sum' ? 'sum' : 'msu',
  };
  /** What the whole account still misses for the plan, in MSU (resources on the way count as there). */
  const planGap = (): number | null => {
    const plan = store.get<Plan>(PLAN_KEY, {});
    const sent = store.get<Shipment[]>(SENT_KEY, []);
    const now = Date.now();
    const here = currentBodyId(document);
    const onScreen = readCurrentResources(document);
    const stock = (id: number) => {
      const body = snapshot?.bodies.find((b) => b.id === id);
      return here === id && onScreen ? onScreen : body ? estimateResources(body, now) : null;
    };
    const inFlight = { metal: 0, crystal: 0, deuterium: 0 };
    for (const key of Object.keys(plan)) {
      const id = Number(key);
      const p = pendingFor(sent, id, here === id ? now : (snapshot?.bodies.find((b) => b.id === id)?.resourcesAt ?? 0));
      inFlight.metal += p.metal;
      inFlight.crystal += p.crystal;
      inFlight.deuterium += p.deuterium;
    }
    const gap = accountGap(plan, accountResources(snapshot?.bodies ?? [], stock, inFlight)).missing;
    return gap ? gap.metal + gap.crystal * 1.5 + gap.deuterium * 3 : null;
  };
  /** Redraws the inbox panels after a choice in the settings (set once the inbox is watched). */
  let refreshInbox: (() => void) | null = null;
  let refreshFleet: (() => void) | null = null;
  // Planet menu facts the settings show (whether the side view fits, colonies); updated by the menu.
  let menuCtx = { roomy: true, colonies: '' };
  const openFutureSettings = (section?: Section) =>
    openSettings({
      doc: document,
      store,
      t,
      menu: {
        settings,
        canSide: menuCtx.roomy,
        onChange: (next) => {
          settings = next;
          store.set('planetMenu.mode', next.mode);
          store.set('planetMenu.totals', next.showTotals);
          store.set('planetMenu.fleet', next.showFleet === true);
          store.set('planetMenu.totalView', next.totalView ?? 'msu');
          draw();
        },
      },
      backup: {
        onExport: () => downloadBackup(document, gm, Date.now()),
        onImport: (text) => {
          // OGLight's "Export data" file: converted into this universe's marks and positions.
          let json: unknown = null;
          try { json = JSON.parse(text); } catch { /* not JSON: importBackup says so */ }
          if (!isOglightDb(json)) return importBackup(gm, text);
          const out = convertOglight(json, loadMarks(store.get<Partial<Marks> | null>(MARKS_KEY, null)), store.get<Positions>(POSITIONS_KEY, {}), Date.now());
          store.set(MARKS_KEY, out.marks);
          store.set(POSITIONS_KEY, out.positions);
          const days = convertOglightStats(json.stats ?? {}, store.get<Journal>(JOURNAL_KEY, {}));
          store.set(JOURNAL_KEY, days.journal);
          return t('settings.oglightDone', { players: out.players, planets: out.planets, seen: out.seen, exp: days.expeditions.toLocaleString(locale), raids: days.raids.toLocaleString(locale), days: days.days });
        },
      },
      notes: [menuCtx.colonies, snapshot ? t('toolbar.lastSync', { time: new Date(snapshot.fetchedAt).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }) : ''].filter(Boolean),
      onMailChange: () => refreshInbox?.(),
      bodies: readPlanetList(document).flatMap((b) => [
        ...(b.planetId ? [{ id: b.planetId, label: `${b.name} [${b.coords}]` }] : []),
        ...(b.moonId ? [{ id: b.moonId, label: `${b.name} [${b.coords}] · ${t('fleet.typeMoon')}` }] : []),
      ]),
      onFleetChange: () => {
        refreshFleet?.();
        mountTouchBar(document, store, t);
      },
      section,
    });
  /** Draws the dock under the game's menu (set once the targets side bar is ready, below). */
  let drawDock: (() => void) | null = null;
  const draw = () => {
    drawDock?.();
    renderPlanetMenu({
      doc: document,
      entries: readPlanetList(document),
      snapshot,
      queues,
      settings,
      now: Date.now(),
      locale,
      t,
      onOpenSettings: (ctx) => {
        menuCtx = ctx;
        openFutureSettings();
      },
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
          icons: store.get<Record<string, TechIcon>>(TECH_ICONS_KEY, {}),
          now: Date.now(),
          locale,
          t,
        }),
      planCount: planCount(store.get<Plan>(PLAN_KEY, {})),
      planGap: planGap(),
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
      // COMPLIANCE: runs only from the Sync button's click (reason 'user-sync', no cp).
      onSync: async () => {
        try {
          const [account, queue] = await Promise.allSettled([
            syncAccountOnUserClick(deps),
            syncQueuesOnUserClick({ guard, store, ids: bodyIds }),
            fetchLfBonuses({ guard, store }, 'user-sync'),
          ]);
          if (queue.status === 'fulfilled') queues = queue.value;
          if (account.status === 'rejected') {
            console.warn(`[${t('app.name')}]`, account.reason);
            return false;
          }
          snapshot = account.value;
          draw();
          return true;
        } catch (error) {
          console.warn(`[${t('app.name')}]`, error);
          return false;
        }
      },
    });
  };
  draw();
  // The game reloads the planet bar by itself now and then: draw the menu again when it does.
  watchPlanetBar(document, draw);

  const currentId = currentBodyId(document);
  const list = readPlanetList(document);

  // Keyboard, as in OGLight: I / O = previous / next planet (from a moon: previous / next moon).
  // A normal page change with cp, the same as clicking the planet list.
  if (currentId) {
    const go = (backwards: boolean) => {
      const id = nextBody(list, currentId, { backwards });
      if (id) location.assign(switchBodyUrl(location.href, id));
    };
    registerActions(document, store, t, { 'planet.prev': () => go(true), 'planet.next': () => go(false) });
    // Jump gate dialog: keeps reserve 1 of this moon at home.
    watchJumpgate(document, store, currentId, t);
  }

  // Building, research, shipyard and defence pages: cost panel and construction plan.
  if (currentId) {
    watchTechPages({ doc: document, store, bodyId: currentId, t, locale, have: () => readCurrentResources(document), onPlanChange: () => draw() });
  }

  // Targets side bar: stays open across pages as the player left it; M = next position of its list.
  const side = { doc: document, store, guard, t, locale };
  // Dock under the game's menu: journal and targets at a glance; redrawn with the planet menu.
  drawDock = () => {
    const journal = store.get<Journal>(JOURNAL_KEY, {});
    const stats = (period: 'today' | 'week') => {
      const st = periodStats(entriesIn(journal, periodRange(period, Date.now())));
      return { count: st.count, net: st.netMsu };
    };
    renderDock({
      doc: document,
      t,
      locale,
      journal: { today: stats('today'), week: stats('week') },
      marks: loadMarks(store.get<Partial<Marks> | null>(MARKS_KEY, null)),
      onOpenJournal: () => openJournal({ doc: document, store, now: Date.now(), locale, t }),
      onOpenTargets: (view) => (view ? openSide(side, view) : toggleSide(side)),
    });
  };
  drawDock();
  onSideNavigate(highlightPosition);
  restoreSide(side);
  registerActions(document, store, t, { 'targets.next': () => void nextInSide(document) });
  const pageMeta = (name: string) => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ?? '';

  // Manual reminders: due ones are shown on the page; bells on the game's event list.
  const reminders = { doc: document, store, t, locale, offset: clockOffset(document, Date.now()) };
  startReminders(reminders);
  watchEventList(reminders);

  // Highscore: gap to the player, days to catch up, rival star.
  if (isHighscorePage(document)) watchHighscore({ doc: document, store, locale, t, guard });

  // Inbox: a summary on each report; expedition reports go into the journal.
  if (isMessagesPage(document))
    refreshInbox = watchMessages({
      doc: document, store, playerId: ownPlayerId(document), locale, t,
      // "Diario oggi" in the toolbar follows the reports as they are read.
      onJournal: () => draw(),
      onOpenJournal: () => openJournal({ doc: document, store, now: Date.now(), locale, t }),
      spy: {
        bases: (snapshot?.bodies ?? []).map((b) => ({ id: b.id, name: b.name, coords: b.coords, moon: b.type === 'moon' })),
        researches: snapshot?.researches ?? {},
        classId: Number(pageMeta('ogame-player-characterclass-id')) || 0,
        server: pageMeta('ogame-universe').split('.')[0] ?? '',
        lang: pageMeta('ogame-ui-language') || pageMeta('ogame-language'),
        allianceClass: Number(pageMeta('ogame-allianceclass-id')) || 0,
        lf: store.get<LfBonuses | null>(LF_BONUS_KEY, null),
      },
    });

  // Fleet page helpers: reserves and fleetsave, on the game's own form.
  if (isFleetDispatch(document) && currentId) {
    const bodies = readPlanetList(document).map(({ planetId, moonId, name, coords }) => ({ planetId, moonId, name, coords }));
    const fleet = { doc: document, store, bodyId: currentId, bodies, t, locale, onOpenSettings: () => openFutureSettings('fleet') };
    renderFleetTools(fleet);
    refreshFleet = () => renderFleetTools(fleet);
  }

  // Galaxy view: system summary, marks, debris in MSU, targets and the scores card.
  if (isGalaxyPage(document)) {
    const ownPlanetIds = new Set(readPlanetList(document).flatMap((e) => (e.planetId ? [e.planetId] : [])));
    watchGalaxy({ doc: document, store, guard, ownPlanetIds, locale, t, onSystem: refreshSide, onPlayer: (id) => openSide(side, { tab: 'players', player: id }) });
    // Touch bar: the game's own galaxy arrows (the keyboard already moves them).
    const arrow = (key: string) => () => document.querySelector<HTMLElement>(`#galaxycomponent .galaxy_icons[onclick*="'${key}'"]`)?.click();
    registerActions(document, store, t, { 'galaxy.left': arrow('ArrowLeft'), 'galaxy.right': arrow('ArrowRight'), 'galaxy.down': arrow('ArrowDown'), 'galaxy.up': arrow('ArrowUp') });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void bootstrap(), { once: true });
} else {
  void bootstrap();
}
