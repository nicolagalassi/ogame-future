/**
 * Future bootstrap. Runs once per game page.
 * Network calls are allowed only until bootstrap ends (see core/guard.ts).
 */
import { NetworkGuard } from './core/guard';
import { GMStore, Store, serverNamespace } from './core/storage';
import { IdleSaver } from './core/idle-saver';
import { detectLocale, translator } from './core/i18n';
import { SNAPSHOT_KEY, hydrateAccountOncePerSession, syncAccountOnUserClick, type AccountSnapshot } from './data/account-info';
import { currentBodyId, readCurrentResources, readPlanetList } from './data/planet-list';
import { applyPageResources } from './engines/resources';
import { SCORE_KEY, readScore, type Score } from './data/score';
import { QUEUES_KEY, loadQueuesOnPageLoad, syncQueuesOnUserClick, type QueueSnapshot } from './data/queues';
import { ITEMS_KEY, fetchLfBonuses, hydrateLfOncePerSession, readActiveItems } from './data/bonuses';
import { openDashboard } from './modules/dashboard';
import { isFleetDispatch } from './data/fleet-page';
import { renderFleetTools } from './modules/fleet';
import { watchJumpgate } from './modules/fleet/jumpgate';
import { registerShortcuts, switchBodyUrl } from './modules/shortcuts';
import { nextBody } from './engines/fleet';
import { watchTechPages } from './modules/tech';
import { openPlanner } from './modules/tech/planner-view';
import { PLAN_KEY, planCount, type Plan } from './engines/planner';
import { renderPlanetMenu, type MenuMode, type MenuSettings } from './modules/planet-menu';

async function bootstrap(): Promise<void> {
  const namespace = serverNamespace(document);
  if (!namespace) return; // not a logged-in game page

  const guard = new NetworkGuard((input, init) => fetch(input, init), window.location.origin);
  const store = new Store(new GMStore(), namespace);
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

  // Active items are listed on the overview's buff bar only: keep the last list seen.
  const items = readActiveItems(document);
  if (items) store.set(ITEMS_KEY, items);

  // Points are on the overview page only: keep the last value seen.
  const seenScore = readScore(document, Date.now());
  if (seenScore) store.set(SCORE_KEY, seenScore);

  const deps = { guard, store, session: window.sessionStorage };
  const storedMode = store.get<string>('planetMenu.mode', 'side');
  let settings: MenuSettings = {
    // 'stacked' was the previous layout: it maps to the side-by-side one.
    mode: (storedMode === 'compact' ? 'compact' : 'side') as MenuMode,
    showTotals: store.get<boolean>('planetMenu.totals', true),
    markIdle: store.get<boolean>('planetMenu.markIdle', false),
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
      onOpenDashboard: () =>
        openDashboard({
          doc: document,
          snapshot,
          entries: readPlanetList(document),
          score: store.get<Score | null>(SCORE_KEY, null),
          queues,
          now: Date.now(),
          locale,
          t,
        }),
      planCount: planCount(store.get<Plan>(PLAN_KEY, {})),
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

  // Fleet page helpers: reserves and fleetsave, on the game's own form.
  if (isFleetDispatch(document) && currentId) {
    const bodies = readPlanetList(document).map(({ planetId, moonId, name, coords }) => ({ planetId, moonId, name, coords }));
    renderFleetTools({ doc: document, store, bodyId: currentId, bodies, t, locale });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void bootstrap(), { once: true });
} else {
  void bootstrap();
}
