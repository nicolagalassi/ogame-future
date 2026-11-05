/**
 * Future bootstrap. Runs once per game page.
 * Network calls are allowed only until bootstrap ends (see core/guard.ts).
 */
import { NetworkGuard } from './core/guard';
import { GMStore, Store, serverNamespace } from './core/storage';
import { IdleSaver } from './core/idle-saver';
import { detectLocale, translator } from './core/i18n';
import { SNAPSHOT_KEY, hydrateAccountOncePerSession, type AccountSnapshot } from './data/account-info';
import { currentBodyId, readCurrentResources, readPlanetList } from './data/planet-list';
import { applyPageResources } from './engines/resources';
import { renderPlanetMenu, type MenuMode } from './modules/planet-menu';

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

  const draw = (mode: MenuMode) =>
    renderPlanetMenu({
      doc: document,
      entries: readPlanetList(document),
      snapshot,
      mode,
      now: Date.now(),
      locale,
      t,
      onModeChange: (next) => {
        store.set('planetMenu.mode', next);
        draw(next);
      },
    });
  draw(store.get<MenuMode>('planetMenu.mode', 'stacked'));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void bootstrap(), { once: true });
} else {
  void bootstrap();
}
