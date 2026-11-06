/**
 * Backup of everything Future keeps (all universes and players of this install).
 *
 * COMPLIANCE (AGENTS.md §1.9): the file is built and read in the browser; it goes only
 * where the player saves it. No network call is involved.
 */
import type { KeyValueStore } from './storage';

const PREFIX = 'future:';
const VERSION = 1;

export interface BackupFile {
  app: 'future';
  version: number;
  at: number;
  data: Record<string, unknown>;
}

export function exportBackup(kv: KeyValueStore, now: number): BackupFile {
  const data: Record<string, unknown> = {};
  for (const key of kv.keys().filter((k) => k.startsWith(PREFIX)).sort()) data[key] = kv.get(key, null);
  return { app: 'future', version: VERSION, at: now, data };
}

/** Writes a backup back. Merges: keys missing from the file stay as they are. Returns the keys written. */
export function importBackup(kv: KeyValueStore, text: string): number {
  let file: Partial<BackupFile>;
  try { file = JSON.parse(text) as Partial<BackupFile>; } catch { throw new Error('backup: not JSON'); }
  if (!file || file.app !== 'future' || file.version !== VERSION || !file.data || typeof file.data !== 'object' || Array.isArray(file.data)) throw new Error('backup: not a Future backup');
  // Only Future's own keys: a hand-edited file cannot write anything else into the storage.
  const entries = Object.entries(file.data).filter(([k]) => k.startsWith(PREFIX));
  for (const [key, value] of entries) kv.set(key, value);
  return entries.length;
}

export const backupFileName = (now: number) => `future-backup-${new Date(now).toISOString().slice(0, 10)}.json`;

/** Saves the backup as a file through the browser's own download (no network). */
export function downloadBackup(doc: Document, kv: KeyValueStore, now: number): number {
  const file = exportBackup(kv, now);
  const url = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: 'application/json' }));
  const a = doc.createElement('a');
  a.href = url;
  a.download = backupFileName(now);
  doc.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0); // not a game action: frees the local file URL
  return Object.keys(file.data).length;
}
