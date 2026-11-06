# 2026-11-06 — Correzioni e backup

- accountInfo: risposta non JSON o senza pianeti non cancella più lo snapshot; il tentativo vale per la sessione (§4.1).
- Posta 13.x a lista: riepilogo spionaggio sotto `.msgFilteredHeaderRow`, clic = clic sulla riga del gioco. Verificato su 11 report veri.
- Detriti pos. 16: markup dal JS del gioco, test aggiunto (parser già corretto).
- Backup: `src/core/backup.ts`, pulsanti nel pannello impostazioni, `KeyValueStore.keys()` + grant `GM_listValues`. Verificato nel browser dev (export 19 valori, import, file non valido).
