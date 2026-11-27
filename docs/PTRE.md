# PTRE in Future

PTRE (https://ptre.chez.gg) è il database di team per OGame: rapporti di spionaggio, attività dei giocatori,
pianeti e lune, bersagli condivisi. Nicola (2026-11-27) vuole la sincronizzazione «se presente, come OGLight».

## Regola di fondo

- Si copia **solo quello che OGLight fa già** (colonna OGLight della tabella di compatibilità di PTRE): è
  l'eccezione di progetto di AGENTS.md (docs/OGLIGHT-RULES.md). Le righe solo-EasyPTRE (amici e falange,
  Galaxy Event Explorer, sincronizzazione ricerche e forme di vita) restano fuori finché un ToolDev non le approva.
- **Niente senza team key.** Finché il giocatore non salva la key in Impostazioni › PTRE, Future chiama solo la
  classifica pubblica (`api_get_ranks.php`, già prima). Il testo accanto al campo dice cosa parte (AGENTS.md §1.9).
- **Tutto passa dal guard** (`src/core/guard.ts`): solo gli script in `PTRE_SCRIPTS`, mai cookie, mai durante il
  caricamento ('page-load'); le chiamate con la key solo da click ('user-sync'); la key è mascherata nel log.
- La key non va nei backup (`core/backup` SECRETS), non passa con «Da un altro universo», si cancella con
  «Azzera le impostazioni».
- `tool=future` (mai `oglight`). PTRE non documenta un'API né una registrazione: da chiarire con GeGe, lo
  sviluppatore di PTRE (Discord https://discord.gg/WsJGC9G), prima della pubblicazione.
- Non si copia `oglight_update_version.php` (telemetria d'installazione di OGLight).

## Fasi

| Fase | Cosa | Script PTRE | Stato |
|---|---|---|---|
| 0 | guard, client, team key + consenso, errori di PTRE | — | 0.3.179 |
| 1a | «Salva su PTRE» su un rapporto della tabella spiate (click) | `oglight_import.php` (`sr_id`) | 0.3.179, provato da Nicola sul suo universo (PTRE accetta `tool=future`) |
| 1b | info giocatore: grafico attività e miglior rapporto (click sulla scheda) | `oglight_get_player_infos.php` | 0.3.181, provato da Nicola |
| 1c | bandierina «PTRE» (nel menu solo con la key) e sincronizzazione bersagli del team (click, nella lista PTRE della barra laterale); chi torna da PTRE prende la bandierina solo se non ne ha una | `api_sync_target_list.php` | 0.3.182, provato da Nicola su un universo vecchio (su quello appena creato PTRE dava 0 bersagli) |
| 2 | «Invii mentre giochi» (Impostazioni › PTRE, spento di default): per ogni tabella che il gioco disegna in galassia, pianeti/lune nuovi, cambiati o spariti (memoria `ptre.galaxyIds`) e attività dei giocatori seguiti (bandierina o recenti); controspionaggi letti in posta, una volta per rapporto (`ptre.counterSent`); pianeti del giocatore da PTRE all'apertura della scheda, al massimo ogni ora (`ptre.planetsAt`) | `oglight_import_player_activity.php`, `api_galaxy_import_infos.php`, `api_galaxy_get_infos.php` (motivo guard 'user-browse', solo `PTRE_BROWSE`) | 0.3.184 |

La prova di 1a è passata il 2026-11-27 sul suo universo (sul server di test PTS i team non sembrano attivi).
In fase 2 un invio per sistema disegnato dal gioco, mai per ridisegno di Future o per giro dell'observer (§1.3).

## Formati (dal sorgente di OGLight 5.4.2 nel repo, classe `PTRE`)

- Parametri comuni in query: `tool`, `team_key`, `country`, `univers`, `version`. Risposta JSON `{code, message, message_verbose}`; `code == 1` = ok.
- Corpo JSON come stringa, senza `Content-Type` (come OGLight: niente preflight CORS).
- Key: `TM-XXXX-XXXX-XXXX-XXXX` (18 caratteri senza trattini, inizia con TM).

## Differenze da OGLight (fase 2)

- I propri pianeti non partono: nella tabella del gioco la riga del giocatore non porta il suo id.
- La dimensione della luna parte come -1: la tabella che Future legge non la mostra.
- `old_name`, `old_rank`, `old_score`, `old_fleet`, `timestamp_api` partono vuoti (-1/false): Future non
  tiene lo storico per posizione di tutti i giocatori come il `pdb` di OGLight; `old_player_id` sì.
