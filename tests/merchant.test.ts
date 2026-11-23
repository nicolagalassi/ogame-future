import { describe, expect, it, vi } from 'vitest';
import { fetchImportExport, forgetImportExportRead, importExportOncePerSession, IMPORT_EXPORT_KEY, parseImportExport } from '../src/data/import-export';
import { isTraderPage, markMerchant, MERCHANT_CLASS } from '../src/modules/merchant';
import { NetworkGuard } from '../src/core/guard';
import { MemoryStore, Store } from '../src/core/storage';

class Session {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { this.data.set(k, v); }
}

describe('import/export offer', () => {
  it('reads strings or booleans; anything else says nothing', () => {
    expect(parseImportExport({ hasBought: 'false', gotItem: 'false', rarity: 'uncommon' })).toBe(true);
    expect(parseImportExport({ hasBought: true, gotItem: false })).toBe(true);
    expect(parseImportExport({ hasBought: 'true', gotItem: 'true' })).toBe(false);
    expect(parseImportExport({ hasBought: true })).toBe(false);
    expect(parseImportExport({ other: 1 })).toBeNull();
    expect(parseImportExport('An error has occured!')).toBeNull();
    expect(parseImportExport(null)).toBeNull();
  });

  it('one call per session, none after a failure; again after the Merchant page or on Sync; errors keep the stored state', async () => {
    let answer = '{"hasBought":"false","gotItem":"false"}';
    const fetchImpl = vi.fn(async () => new Response(answer));
    const guard = new NetworkGuard(fetchImpl, 'https://s1-it.ogame.gameforge.com');
    const store = new Store(new MemoryStore(), 'ie');
    const session = new Session();
    expect(await importExportOncePerSession({ guard, store, session, now: () => 5 })).toEqual({ available: true, at: 5 });
    expect(await importExportOncePerSession({ guard, store, session })).toEqual({ available: true, at: 5 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(guard.log.every((e) => e.reason === 'page-load' && e.allowed && !e.url.includes('cp='))).toBe(true);
    forgetImportExportRead(store, session);
    answer = '{"hasBought":"true","gotItem":"true"}';
    expect(await importExportOncePerSession({ guard, store, session, now: () => 9 })).toEqual({ available: false, at: 9 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    answer = '<html>An error has occured!</html>';
    guard.closePageLoadWindow();
    expect(await fetchImportExport({ guard, store }, 'user-sync')).toEqual({ available: false, at: 9 });
    expect(store.get(IMPORT_EXPORT_KEY, null)).toEqual({ available: false, at: 9 });
    // A failed first read is not retried on the next page.
    const s2 = new Session();
    const failing = new NetworkGuard(vi.fn(async () => { throw new Error('down'); }), 'https://s1-it.ogame.gameforge.com');
    await expect(importExportOncePerSession({ guard: failing, store: new Store(new MemoryStore(), 'x'), session: s2 })).rejects.toThrow();
    expect(s2.getItem('x:importexport.read')).toBe('1');
  });

  it('the Merchant label is coloured through a class on body; the menu item itself is never written to', () => {
    document.head.innerHTML = '';
    document.body.innerHTML = '<ul id="menuTable"><li><a class="menubutton" data-ipi-hint="ipiToolbarTrader" href="#"><span class="textlabel">Mercante</span></a></li></ul>';
    const item = document.querySelector('.menubutton')!;
    const before = item.outerHTML;
    markMerchant(document, { available: true, at: 1 });
    expect(document.body.classList.contains(MERCHANT_CLASS)).toBe(true);
    expect(document.getElementById('fut-merchant-style')!.textContent).toContain('ipiToolbarTrader');
    markMerchant(document, { available: false, at: 2 });
    expect(document.body.classList.contains(MERCHANT_CLASS)).toBe(false);
    markMerchant(document, null);
    expect(document.body.classList.contains(MERCHANT_CLASS)).toBe(false);
    expect(item.outerHTML).toBe(before);
    expect(document.querySelectorAll('#fut-merchant-style')).toHaveLength(1);
    expect(isTraderPage('https://x/game/index.php?page=ingame&component=traderOverview')).toBe(true);
    expect(isTraderPage('https://x/game/index.php?page=ingame&component=trader&page2')).toBe(true);
    expect(isTraderPage('https://x/game/index.php?page=ingame&component=overview')).toBe(false);
  });
});
