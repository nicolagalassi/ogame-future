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

  try {
    snapshot = await hydrateAccountOncePerSession({ guard, store, session: window.sessionStorage });
  } catch (error) {
    console.warn(`[${t('app.name')}]`, error);
  } finally {
    // COMPLIANCE: from here on no background call can leave the page (AGENTS.md §4).
    guard.closePageLoadWindow();
  }

  // Keep the viewed body exact by reading the game's resource bar: no network call.
  const bodyId = currentBodyId(document);
  const onPage = readCurrentResources(document);
  if (snapshot && bodyId && onPage && applyPageResources(snapshot, bodyId, onPage, Date.now())) saver.markDirty();

  const deps = { guard, store, session: window.sessionStorage };
  const storedMode = store.get<string>('planetMenu.mode', 'side');
  let settings: MenuSettings = {
    // 'stacked' was the previous layout: it maps to the side-by-side one.
    mode: (storedMode === 'compact' ? 'compact' : 'side') as MenuMode,
    showTotals: store.get<boolean>('planetMenu.totals', true),
  };
  const draw = () =>
    renderPlanetMenu({
      doc: document,
      entries: readPlanetList(document),
      snapshot,
      settings,
      now: Date.now(),
      locale,
      t,
      onSettingsChange: (next) => {
        settings = next;
        store.set('planetMenu.mode', next.mode);
        store.set('planetMenu.totals', next.showTotals);
        draw();
      },
      // COMPLIANCE: runs only from the Sync button's click (reason 'user-sync', no cp).
      onSync: async () => {
        try {
          snapshot = await syncAccountOnUserClick(deps);
          draw();
        } catch (error) {
          console.warn(`[${t('app.name')}]`, error);
        }
      },
    });
  draw();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void bootstrap(), { once: true });
} else {
  void bootstrap();
}
