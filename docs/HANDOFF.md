# Future — passaggio di consegne

Questo file riassume lo stato del progetto e le decisioni prese con Nicola, per chi
riprende il lavoro (un altro agente o un'altra macchina). Leggi prima `CLAUDE.md`,
`AGENTS.md`, `docs/OGLIGHT-RULES.md` e `docs/API-NOTES.md`.

## Dove sta il codice

- Repo: `nicolagalassi/ogame-future`.
- Le PR sono impilate, ognuna parte dalla precedente. **Il ramo `feat/messages` contiene tutto.**

| PR | Ramo | Contenuto |
|---|---|---|
| #1 | `feat/project-base` | guard di rete, storage, i18n, accountInfo una volta per sessione, `npm run check` |
| #2 | `feat/planet-menu` | menu pianeti affiancato (pianeta + luna), barra strumenti |
| #3 | `feat/dashboard` | plancia account, code di produzione, miniere più convenienti |
| #4 | `feat/fleet` | pulsanti flotta, riserve, fleetsave, spedizione, salto, scorciatoie |
| #5 | `feat/costs` | pannello costi sulle pagine tecnologia, pianificatore |
| #6 | `feat/messages` | riepiloghi in posta, diario spedizioni, barra a pulsanti con dati, giro impeccable |

Per partire: `git checkout feat/messages && npm ci && npm run check`.
Lo script compilato (non minificato) è `dist/future.user.js`.

## Regole che valgono sempre

- Ogni chiamata di rete passa da `src/core/guard.ts`; mai `fetch` diretto altrove.
- Mai `cp=` nelle chiamate di background. Le chiamate di background partono solo al
  caricamento pagina, al massimo una volta per sessione, oppure dal clic su Sync.
- L'invio di una flotta resta sempre un clic del giocatore.
- Niente probe diretto fuori da posta e galassia. Niente notifiche per eventi di gioco.
- I dati restano in locale (§1.9).
- **Regola di Nicola: se OGLight lo fa già, è permesso** anche se AGENTS.md lo vieterebbe
  (esempio: spostare il banner SALE a destra). OGLight è MIT: tenere "© 2019 Oz".
- Stile codice: apici singoli, righe lunghe, niente Prettier.
- Lingue: it, en, fr, de (`src/i18n/*.json`). Nicola scrive in italiano.

## Decisioni di Nicola

- Formato userscript (Tampermonkey); estensione più avanti. Nome provvisorio "Future".
- Grafica "ibrido adattivo", poi rifinita con le regole di impeccable (pbakaus/impeccable):
  niente bagliori, strisce laterali, gradienti decorativi, etichette maiuscole, icone a carattere;
  strisce di dati con linee sottili (`gap:1px` / ombre `#1F2C40` su celle `#0D1522`); testo ≥ 10px.
  Icone SVG condivise in `src/core/icons.ts`, `BASE_SHEET` in ogni finestra Shadow DOM.
- Menu pianeti affiancato: pianeta e luna sulla stessa riga, skin del pianeta sempre visibile,
  luna cliccabile, niente barre di deposito sulle lune.
- Barra in alto (opzione C): tre pulsanti con dati (Plancia +X/g, Piano −mancante, Diario oggi),
  sync e impostazioni a lato.
- Flotta: i pulsanti preparano tutto in fleet1; fleetsave come PrOGect (galassia/sistema vuoti =
  quelli del pianeta di partenza); la riserva non vale per le spedizioni; "ignora cibo".
- Flotta (2026-11-11): Trasporto (T) e Schiera (D) sono interruttori che restano accesi e aprono un
  pannello: galassia / sistema / posizione separati (vuoti = quelli del corpo), pianeta/luna, risorse
  (simboli M/C/D disegnati in `fleet/icons.ts`), poi CL o CP seleziona i cargo che servono, imposta
  destinazione e missione e carica. Navi scelte a mano restano. Senza riserve. La vecchia coppia trasporto/schieramento
  verso la luna principale (con le riserve) è la "Raccolta spedizioni", funzione secondaria (C, V).
  Icone della barra piene, niente neon.
- Regole per corpo (2026-11-06): navi, risorse, portale (lune) sono regole separate, ognuna con
  un interruttore globale (barra flotta; il portale anche nel dialogo del salto); cibo = "ignora
  cibo". Il fleetsave ha navi + risorse sue e ignora gli interruttori. "Copia su…" copia solo le
  regole scelte sui corpi scelti; ogni regola mostra Attiva/Spenta/Vuota e su quali altri corpi
  è uguale. Vecchi salvataggi: il portale usa le navi della riserva finché non ha la sua.
- Diario spedizioni: niente lista "ultime spedizioni"; navi con le immagini del CDN del gioco.
- Riepilogo spedizione in posta: esito e MSU sopra, navi centrate sotto, colore del riquadro
  per la dimensione (grigio normale, ciano grande, oro enorme), esaurimento sotto.

## Dati dalla posta (tipi visti nelle pagine reali)

41 spedizione (size "0/1/2" = enorme/grande/normale), 61 scoperta, 33 trasporto arrivato,
34 schieramento **o** rientro spedizione (da :16, coordinate di partenza nel testo),
32 riciclaggio, 25 combattimento, 48 combattimento a un round, spionaggio senza messagetype.

## Cosa manca

1. **Dashboard** (fatta il 2026-11-05 al posto della "Plancia", `src/modules/dashboard`): schede
   Riepilogo, Miniere, Strutture, Forme di vita, Navi, Difese, Rottamatore (solo calcolo, 35–75%).
   Verificato in gioco (s808-en, 2026-11-05): `selectedSpeciesId` arriva (14 pianeti, tutti
   Mechas = 3) e `speciesBuildings` contiene anche edifici di specie non attive (Umani e
   Rock'tal sui pianeti Mechas, con livelli > 0). Nomi: quelli letti dalle
   pagine del gioco (`tech.names`) vincono sulla tabella interna (`src/data/tech-names.ts`,
   forme di vita solo in inglese finché il giocatore non apre la pagina).
2. Telefono: barra d'azioni flotta fissa in basso con pulsanti grandi (serve una pagina
   flotta salvata da telefono).
3. **Galassia** (fatta il 2026-11-05, `src/modules/galaxy`, dati in `src/data/galaxy.ts`): striscia di
   riepilogo sopra la tabella (giocatori, inattivi, vacanza, lune, detriti in MSU), righe inattive e tue
   tinte, valore MSU sotto ogni campo detriti, mirino per segnare bersagli (lista con link alle coordinate,
   niente pulsante sonda), distintivo con la posizione accanto al giocatore: al passaggio del mouse una
   scheda con punti e posizioni (generale, economia, ricerca, militare, forme di vita, navi) da
   `/api/playerData.xml` come OGLight. Chiamata `user-view` del guard: solo API pubblica, senza cookie,
   in cache un'ora per giocatore. Detriti in posizione 16: stesso markup `.debris-content` delle righe
   (letto dal JS del gioco 13.1, test con quel markup).
4. Riepiloghi di spionaggio verificati su giocatori veri (2026-11-06). Nella posta 13.x a lista il
   riepilogo sta sotto la riga d'intestazione e il clic apre il report come la riga del gioco.
5. Domanda aperta: plancia, piano e diario restano finestre sopra il gioco o diventano pannelli?
6. Roadmap: nome definitivo, merge delle PR #1–#6, richiesta di
   tolleranza ai ToolDev (con le aree grigie: spostamento banner, "Ripeti" flotta).

7. **Backup** (fatto il 2026-11-06, `src/core/backup.ts`): Impostazioni → Backup dati → Esporta/Importa.
   File JSON locale con tutte le chiavi `future:*` (tutti gli universi e account); l'importazione unisce
   e scrive solo chiavi `future:*`. Nuovo grant `GM_listValues`.
8. accountInfo: a volte il gioco risponde "An error has occured!" (HTML). Ora quella risposta, o una
   senza pianeti, non sostituisce lo snapshot salvato; niente nuovi tentativi fino a Sync.

9. **Storico account** (2026-11-06, `src/engines/history.ts`): una voce al giorno (punti, posizione,
   produzione, flotta) quando la Panoramica mostra i punti; scheda Storico nella Dashboard con due
   grafici a una serie e la tabella dei giorni.
10. **Tabella spiate** (2026-11-06, `src/engines/raids.ts`, `src/modules/messages/spy-table.ts`): pannello dentro la
    scheda Spionaggio della posta, sopra l'intestazione colonne del gioco, con l'aspetto della posta e i pulsanti
    `<gradient-button>` del gioco. Un bersaglio per pianeta/luna, 3 giorni, ordinato per MSU all'ora di volo dal
    pianeta più vicino (formula verificata con `fleetHelper.calcDuration`). Per riga: attacco (fleet1 con `cp=`),
    simulatore del gioco, Osims (OS), OGame Simulator (OT), togli; niente sonda (§1.5.1). Galassie, sistemi, anello
    e velocità flotta da `/api/serverData.xml` (`src/data/server-data.ts`, al caricamento, cache 7 giorni).
    Chiave API dei report = `data-raw-hashcode`. Link Osims/OGame Simulator anche nei riepiloghi di spionaggio,
    link al convertitore Ogotcha (`ogotcha.oplanet.eu`) nei riepiloghi di combattimento: **da verificare** su un
    CR vero (nessuno in posta il 2026-11-06). Il guard non manda mai i cookie all'API pubblica `/api/*.xml`.
11. **Bersagli** (2026-11-06, al posto di rivali e mirino; `src/engines/marks.ts`, `src/engines/positions.ts`,
    `src/modules/marks/`), come i pinned players e tagged planets di OGLight: bandierina per giocatore (Da
    controllare, Bersaglio, Frigo, Pericolo, Amico, Commercio) in galassia, classifica e tabella spiate; colore
    per pianeta in galassia; clic = scelta, Maiusc+clic = ultima usata. **Barra laterale** a sinistra (cella
    Bersagli nella barra del menu pianeti, 2×2 con Dashboard/Piano/Diario), come il pannello di OGLight: resta aperta mentre si gira la galassia e tra le
    pagine. Giocatori per bandierina + Recenti; scheda con punti e pianeti/lune = API `playerData` + posizioni
    viste in galassia (nuove colonie col pallino, posizioni svuotate tolte), con detriti, attività pianeta/luna
    (`*`, minuti, 60; `?` se la lettura ha più di un'ora) ed età della lettura. Pianeti colorati per intervallo,
    colore e stato (`/api/players.xml`, cache 1 giorno). Clic sulle coordinate o tasto **M** = sistema in
    galassia col loader del gioco (`loadContentNew`, come le sue frecce), posizione evidenziata. La memoria
    posizioni registra solo giocatori segnati/recenti e pianeti colorati. Niente sonda (§1.5.1): le celle
    attività aprono la pagina flotta su pianeta/luna (come OGLight). Migrazione una tantum: vecchi bersagli →
    pianeti rossi, rivali → "Da controllare".
12. **Promemoria** (2026-11-06, `src/modules/reminders`): campanelle su Code in corso (Dashboard) e sulle
    flotte della lista eventi; avviso nella pagina. **Da verificare**: le campanelle sulla lista eventi,
    scritte sul markup noto di OGame (`tr.eventFleet[data-arrival-time]`, `td.arrivalTime`) senza flotte
    in volo da guardare.

13. **Classifica** (2026-11-06, `src/modules/highscore`, `src/data/highscore.ts`, `src/data/highscore-api.ts`):
    sotto ogni punteggio i punti fatti da mezzanotte (verde su, rosso giù). Base = prima lettura del giorno di
    `/api/highscore.xml` (user-view all'apertura della Classifica, max 1/ora per categoria, senza cookie), o
    l'ultima di ieri se presa dalle 23:00. Nicola non vuole servizi di altri (ostats non segue s808; PTRE, usato
    da OGLight, ha la foto esatta delle 00:00): idea per dopo, un servizio nostro (cron orario su highscore.xml,
    tabella, endpoint con CORS) su Proxmox o Supabase. In generale anche i giorni per raggiungere chi è davanti
    e la stella rivale. **Nota dev**: dopo un cambio di ramo che ricrea `dist/` va riavviato `npm run dev`.

15. **Piano** (2026-11-06, `src/modules/tech/planner-view.ts`, `groupByTech`/`accountGap` in `engines/planner.ts`):
    una riga per tecnologia ("Miniera di metallo · su 14 corpi · liv. 46") aperta sui pianeti (aperta da sola fino
    a 3), ogni costo mostrato una volta, rosso dove quel pianeta non ha le risorse (tooltip: quanto manca, le voci
    precedenti del pianeta contate prima). In alto: costo del piano, risorse dell'account (tutti i corpi + in
    viaggio), quanto manca all'account; la cella Piano della barra mostra questo (MSU). Icone: le tessere dello
    sprite del gioco lette dagli stili calcolati quando si apre una pagina tecnologie (`data/tech-icons.ts`,
    nessuna richiesta). Galassia: colonna giocatore come OGLight (stato prima del nome, rank e bandierina a
    destra, colonna più larga del nome pianeta), via il pulsante Bersagli.
14. **Grafica** (2026-11-06): tutte le finestre (`WINDOW_SHEET`) riprendono il menu pianeti: riquadri #111B2A
    con bordo #1F2C40, schede a segmenti, numeri monospazio, ciano per la selezione. Pila z-index sopra il
    footer del gioco (999999): barra laterale 1000000, finestre 1000001, popup 1000002-3.

16. **Import da OGLight** (2026-11-06, `src/engines/oglight-import.ts`): impostazioni del menu pianeti → "Da
    OGLight · Importa export" (anche "Importa" del backup riconosce il file). Il file "Export data" di OGLight
    (un universo, va importato nello stesso) diventa: pin → bandierine (rush/skull → Bersaglio, fridge → Frigo,
    star/ptre → Da controllare, money → Commercio), tag → colori (lime → verde, dblue → blu, …; gray no),
    `lastPinnedList` → Recenti, `pdb` → posizioni (solo giocatori/pianeti segnati). Quello che Future ha già
    resta. Statistiche (`stats`, aggregate per giorno): una voce riassuntiva per giorno nel Diario (`summary.count`
    + esiti), spedizioni + detriti pos. 16, scoperte; i giorni già registrati da Future non si importano (doppi).
    Raid + detriti raccolti → voci `kind: 'raid'`, riquadro "Raid" nel Diario (non contano come spedizioni).
    Carburante (`conso`) non portato: il Diario di Future non lo conta. Prova sul file reale di Nicola (Nembus):
    42 giocatori, 570 posizioni, 40.196 spedizioni, 14.178 scoperte, 138 raid su 220 giorni.

## Come si prova senza il gioco

I test (`npm test`, vitest + jsdom) usano fixture in `tests/`. Le anteprime grafiche sono state
fatte caricando le pagine di gioco salvate da Nicola in Chromium (Playwright) e iniettando
`dist/future.user.js`; le pagine salvate non sono nel repo perché contengono dati dell'account.

Dal 2026-11-05 c'è anche la prova sul gioco vero: `npm run dev` apre un Chrome dedicato che esegue
`dist/future.user.js` senza Tampermonkey e si pilota da riga di comando (harness portato da PrOGect,
`scripts/dev-browser.mjs`; comandi in `.claude/QUICK_START.md`).
