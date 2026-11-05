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
3. Galassia (serve una pagina galassia salvata con giocatori e un campo detriti).
4. Verificare in gioco i riepiloghi di spionaggio su un giocatore vero.
5. Domanda aperta: plancia, piano e diario restano finestre sopra il gioco o diventano pannelli?
6. Roadmap: classifiche e giocatori, storico account, confronto rivali, promemoria manuali,
   backup/esportazione completa, nome definitivo, merge delle PR #1–#6, richiesta di
   tolleranza ai ToolDev (con le aree grigie: spostamento banner, "Ripeti" flotta).

## Come si prova senza il gioco

I test (`npm test`, vitest + jsdom) usano fixture in `tests/`. Le anteprime grafiche sono state
fatte caricando le pagine di gioco salvate da Nicola in Chromium (Playwright) e iniettando
`dist/future.user.js`; le pagine salvate non sono nel repo perché contengono dati dell'account.

Dal 2026-11-05 c'è anche la prova sul gioco vero: `npm run dev` apre un Chrome dedicato che esegue
`dist/future.user.js` senza Tampermonkey e si pilota da riga di comando (harness portato da PrOGect,
`scripts/dev-browser.mjs`; comandi in `.claude/QUICK_START.md`).
