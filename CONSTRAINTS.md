# Constraints

Last reviewed: 2026-11-17 by Nicola (scelte: base e conformità bloccano; copertura, dipendenze e dimensione avvisano fino al 2026-12-01, poi bloccano; tutto in `npm run check` e nell'hook pre-push).

Questo file è la regola; `scripts/constraints.json` ne copia i numeri per gli script. Se i due divergono vale questo file.
Un controllo rosso si risolve correggendo il codice, non questo file. Abbassare una soglia o aggiungere un'eccezione è una decisione di Nicola, in un commit a parte.

## Floor (sempre, blocca)

Controllato da `node scripts/floor-guard.mjs` sulle righe cambiate rispetto a `origin/main` (src, tests, scripts, questo file).

- Nessuna soppressione nuova: `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, `eslint-disable`, `istanbul ignore`
- Nessun lavoro lasciato a metà: `throw new Error('not implemented')`, `catch {}` vuoto, `TODO` al posto del codice
- Nessun test reso più facile: `.skip`, `.only`, `.todo`, file di test cancellato, `expect` tolto da un test che resta
- Questo file non si indebolisce per far passare una modifica: soglia abbassata, regola tolta o eccezione nuova vengono segnalate

## Conformità AGENTS.md (sempre, blocca)

Controllato da `node scripts/constraints.mjs src` (sorgenti) e `dist` (file pubblicato). Ogni regola viene da AGENTS.md o da CLAUDE.md.

| Regola | Perché | Controllo |
|--------|--------|-----------|
| Rete solo da `src/core/guard.ts` | §1.3, §4: un solo punto che decide cosa parte | nessun `fetch(`, `XMLHttpRequest`, `GM_xmlhttpRequest`, `sendBeacon`, `WebSocket`, `EventSource`, `$.ajax` fuori dal guard (in `src/main.ts` solo la riga che gli passa `fetch`) |
| `guard.request` solo in `src/data/` | i moduli chiedono i dati al livello data, così le chiamate restano poche e visibili | regola sui sorgenti |
| Niente `cp=` in una chiamata di rete | §4.2: cambia il pianeta attivo della sessione | riga con `.request(` e `cp=`; i link `cp=` cliccati dal giocatore sono ammessi |
| Notifiche solo nei promemoria manuali | §1.4: niente avvisi per eventi di gioco | `Notification` solo in `src/modules/reminders/index.ts` e `src/modules/settings/index.ts` |
| Nessun `setInterval` nuovo | un timer non deve chiamare il server; quelli esistenti aggiornano solo la pagina | ammesso solo in `src/modules/planet-menu/index.ts` (età dei dati) |
| Build non minificata | il codice pubblicato si legge (AGENTS.md, CLAUDE.md) | `minify: false` in `scripts/build.mjs`; in `dist` riga più lunga ≤ 2000 caratteri e media ≤ 120 (oggi 522 e 51) |
| Credito OGLight | licenza MIT del codice e delle tabelle riprese | `dist/future.user.js` contiene "2019 Oz" |
| La versione sale | Tampermonkey aggiorna solo se `@version` cresce | se `src/` o `dist/` cambiano rispetto a `origin/main`, la versione in `package.json` è maggiore; `@version` del dist è uguale a `package.json` |

## Enforced with numbers (avviso fino al 2026-12-01, poi blocca)

| Dimension | Rule | Checked by | Runs at |
|-----------|------|-----------|---------|
| Types | Zero errori | `tsc --noEmit` | `npm run check` |
| Coverage | Righe cambiate in `src/engines/` coperte ≥ 80% | `vitest run --coverage` + `node scripts/constraints.mjs coverage` | `npm run check` |
| Dependencies | Niente a high o sopra | `node scripts/constraints.mjs audit` (`npm audit`) | pre-push (`npm run check:push`) |
| Size | `dist/future.user.js` ≤ 1050000 byte | `node scripts/constraints.mjs dist` | `npm run check` |

Perché questi numeri:
- **80% delle righe cambiate**: obbliga a un test per ogni calcolo nuovo (ROI, MSU, spedizioni) senza contare le righe di configurazione. Solo `src/engines/`, dove un numero sbagliato toglie fiducia al giocatore; l'interfaccia si controlla in gioco.
- **high o sopra**: sotto è quasi sempre rumore. È l'unico controllo esterno: lo decide il database delle vulnerabilità di npm, non i nostri test.
- **1050000 byte**: oggi 958027 (2026-11-17); circa 10% di margine per le funzioni dei prossimi mesi. Superarlo chiede di alzare il tetto qui, con il motivo, o di togliere peso.

## Measured, not yet enforced

| Metric | Today | Direction |
|--------|-------|-----------|
| Copertura righe di `src/engines/` | 97.12% (2026-11-17) | must not fall (tolleranza 0.5) |
| Copertura righe di tutto `src/` | 78.38% (2026-11-17) | must not fall |

## Exceptions

| ID | Rule | Path | Reason | Owner | Expires |
|----|------|------|--------|-------|---------|

Nessuna. Da sapere: oggi `npm audit` trova 1 alta e 3 critiche, tutte nella catena di Vitest 2 (strumenti di sviluppo, mai nello script pubblicato). È un avviso fino al 2026-12-01; prima di quella data va fatto l'aggiornamento a Vitest 5, altrimenti il pre-push si ferma.

## Dove gira

- `npm run check` (prima di ogni push, CLAUDE.md): typecheck → regole dei sorgenti → floor → test con copertura → build → regole del dist e copertura. Circa 15 secondi.
- `npm run check:push`: `check` più `npm audit`. Lo lancia l'hook `.git/hooks/pre-push`, da installare una volta per clone con `npm run hooks`.
- Le sessioni di Claude Code sul web non hanno l'hook: lì `npm run check:push` va lanciato a mano prima del push.
- Uscita: 0 pulito (o solo avvisi), 1 violazione bloccante, 2 il controllo non ha potuto girare (mai letto come pulito).
