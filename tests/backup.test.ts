import { describe, expect, it } from 'vitest';
import { backupFileName, exportBackup, importBackup } from '../src/core/backup';
import { MemoryStore, Store } from '../src/core/storage';

describe('backup', () => {
  it('exports every Future key of every account, and nothing else', () => {
    const kv = new MemoryStore();
    new Store(kv, 'future:s1-it:7').set('exp.journal', { a: 1 });
    new Store(kv, 'future:s808-en:9').set('planetMenu.mode', 'side');
    kv.set('other-script', 1);
    const file = exportBackup(kv, 5);
    expect(file).toEqual({ app: 'future', version: 1, at: 5, data: { 'future:s1-it:7:exp.journal': { a: 1 }, 'future:s808-en:9:planetMenu.mode': 'side' } });
  });

  it('restores a backup into another install, merging', () => {
    const from = new MemoryStore();
    new Store(from, 'future:s1-it:7').set('exp.journal', { a: 1 });
    const to = new MemoryStore();
    to.set('future:s1-it:7:planetMenu.mode', 'compact');
    expect(importBackup(to, JSON.stringify(exportBackup(from, 5)))).toBe(1);
    expect(to.get('future:s1-it:7:exp.journal', null)).toEqual({ a: 1 });
    expect(to.get('future:s1-it:7:planetMenu.mode', null)).toBe('compact');
  });

  it('refuses files that are not a Future backup and never writes foreign keys', () => {
    const kv = new MemoryStore();
    expect(() => importBackup(kv, 'nope')).toThrow(/not JSON/);
    expect(() => importBackup(kv, JSON.stringify({ app: 'other', version: 1, data: {} }))).toThrow(/not a Future backup/);
    expect(() => importBackup(kv, JSON.stringify({ app: 'future', version: 1, data: [] }))).toThrow(/not a Future backup/);
    expect(importBackup(kv, JSON.stringify({ app: 'future', version: 1, at: 0, data: { 'evil': 1, 'future:x:1:a': 2 } }))).toBe(1);
    expect(kv.keys()).toEqual(['future:x:1:a']);
  });

  it('names the file by date', () => {
    expect(backupFileName(Date.UTC(2026, 10, 6))).toBe('future-backup-2026-11-06.json');
  });
});
