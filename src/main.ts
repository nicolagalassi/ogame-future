/**
 * Future bootstrap. Runs once per game page.
 * Network calls are allowed only until bootstrap ends (see core/guard.ts).
 */
import { NetworkGuard } from './core/guard';
import { GMStore, Store, serverNamespace } from './core/storage';
import { IdleSaver } from './core/idle-saver';
import { detectLocale, translator } from './core/i18n';
import { hydrateAccountOncePerSession } from './data/account-info';

async function bootstrap(): Promise<void> {
  const namespace = serverNamespace(document);
  if (!namespace) return; // not a logged-in game page

  const guard = new NetworkGuard((input, init) => fetch(input, init), window.location.origin);
  const store = new Store(new GMStore(), namespace);
  const t = translator(detectLocale(document));
  const saver = new IdleSaver(() => store.set('lastSavedAt', Date.now()));
  window.addEventListener('beforeunload', () => saver.saveNow());

  try {
    const account = await hydrateAccountOncePerSession({ guard, store, session: window.sessionStorage });
    if (account) console.info(`[${t('app.name')}] ${account.bodies.length} pianeti/lune caricati`);
  } catch (error) {
    console.warn(`[${t('app.name')}]`, error);
  } finally {
    // COMPLIANCE: from here on no background call can leave the page (AGENTS.md §4).
    guard.closePageLoadWindow();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void bootstrap(), { once: true });
} else {
  void bootstrap();
}
