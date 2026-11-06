// ==UserScript==
// @name         Future
// @namespace    https://github.com/nicolagalassi/ogame-future
// @version      0.1.0
// @description  Future: userscript per la gestione e lo sviluppo dell'account OGame
// @author       Nicola Galassi
// @license      MIT
// @match        https://*.ogame.gameforge.com/game/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_listValues
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==
// Portions derived from OGLight, Copyright (c) 2019 Oz, MIT License.

"use strict";
(() => {
  // src/core/guard.ts
  var GuardError = class extends Error {
    constructor(message) {
      super(message);
      this.name = "GuardError";
    }
  };
  var NetworkGuard = class {
    constructor(fetchImpl, gameOrigin, now = () => Date.now()) {
      this.fetchImpl = fetchImpl;
      this.gameOrigin = gameOrigin;
      this.now = now;
      this.pageLoadOpen = true;
      this.log = [];
    }
    /** Called once bootstrap is done: from here on only user-initiated calls pass. */
    closePageLoadWindow() {
      this.pageLoadOpen = false;
    }
    get isPageLoadOpen() {
      return this.pageLoadOpen;
    }
    async request(url, reason, init = {}) {
      const refusal = this.check(url, reason);
      this.log.push({ at: this.now(), url, reason, allowed: refusal === null, why: refusal ?? void 0 });
      if (refusal !== null) throw new GuardError(refusal);
      const isGame = this.isGameUrl(url) && !this.isPublicApi(url);
      return this.fetchImpl(url, {
        ...init,
        credentials: isGame ? "include" : "omit",
        headers: isGame ? { "X-Requested-With": "XMLHttpRequest", ...init.headers ?? {} } : init.headers
      });
    }
    check(url, reason) {
      if (reason === "page-load" && !this.pageLoadOpen) {
        return "Background call refused: the page has finished loading (AGENTS.md \xA74).";
      }
      if (reason === "user-view" && !this.isPublicApi(url)) {
        return "Call refused: 'user-view' reaches only the universe's public API (AGENTS.md \xA76).";
      }
      if (this.isGameUrl(url) && new URL(url, this.gameOrigin).searchParams.has("cp")) {
        return "Call refused: the cp parameter changes the active planet (AGENTS.md \xA74.2).";
      }
      return null;
    }
    isPublicApi(url) {
      return this.isGameUrl(url) && /^\/api\/\w+\.xml$/.test(new URL(url, this.gameOrigin).pathname);
    }
    isGameUrl(url) {
      return new URL(url, this.gameOrigin).origin === new URL(this.gameOrigin).origin;
    }
  };

  // src/core/storage.ts
  var GMStore = class {
    get(key2, fallback) {
      return GM_getValue(key2, fallback);
    }
    set(key2, value) {
      GM_setValue(key2, value);
    }
    keys() {
      return GM_listValues();
    }
  };
  var Store = class {
    constructor(kv, namespace) {
      this.kv = kv;
      this.namespace = namespace;
    }
    get(key2, fallback) {
      return this.kv.get(`${this.namespace}:${key2}`, fallback);
    }
    set(key2, value) {
      this.kv.set(`${this.namespace}:${key2}`, value);
    }
  };
  function serverNamespace(doc) {
    const meta = (name) => doc.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ?? null;
    const universe = meta("ogame-universe");
    const player = meta("ogame-player-id");
    return universe && player ? `future:${universe}:${player}` : null;
  }

  // src/core/backup.ts
  var PREFIX = "future:";
  var VERSION = 1;
  function exportBackup(kv, now) {
    const data = {};
    for (const key2 of kv.keys().filter((k) => k.startsWith(PREFIX)).sort()) data[key2] = kv.get(key2, null);
    return { app: "future", version: VERSION, at: now, data };
  }
  function importBackup(kv, text) {
    let file;
    try {
      file = JSON.parse(text);
    } catch {
      throw new Error("backup: not JSON");
    }
    if (!file || file.app !== "future" || file.version !== VERSION || !file.data || typeof file.data !== "object" || Array.isArray(file.data)) throw new Error("backup: not a Future backup");
    const entries = Object.entries(file.data).filter(([k]) => k.startsWith(PREFIX));
    for (const [key2, value] of entries) kv.set(key2, value);
    return entries.length;
  }
  var backupFileName = (now) => `future-backup-${new Date(now).toISOString().slice(0, 10)}.json`;
  function downloadBackup(doc, kv, now) {
    const file = exportBackup(kv, now);
    const url = URL.createObjectURL(new Blob([JSON.stringify(file)], { type: "application/json" }));
    const a = doc.createElement("a");
    a.href = url;
    a.download = backupFileName(now);
    doc.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    return Object.keys(file.data).length;
  }

  // src/core/idle-saver.ts
  var IdleSaver = class {
    constructor(flush, idleMs = 1e4, target = window) {
      this.flush = flush;
      this.idleMs = idleMs;
      this.dirty = false;
      this.timer = null;
      for (const type of ["mousemove", "keydown", "click", "scroll"]) {
        target.addEventListener(type, () => this.reschedule(), { passive: true });
      }
    }
    markDirty() {
      this.dirty = true;
      this.reschedule();
    }
    /** Saves immediately, e.g. before the page unloads. */
    saveNow() {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      if (!this.dirty) return;
      this.dirty = false;
      this.flush();
    }
    reschedule() {
      if (!this.dirty) return;
      if (this.timer) clearTimeout(this.timer);
      this.timer = setTimeout(() => this.saveNow(), this.idleMs);
    }
  };

  // src/i18n/it.json
  var it_default = {
    "app.name": "Future",
    "sync.button": "Sincronizza dati account",
    "sync.done": "Dati aggiornati",
    "data.missing": "Dati mancanti su {count} pianeti: apri la loro panoramica",
    "guard.refused": "Chiamata bloccata per rispettare le regole di OGame",
    "planetMenu.moon": "Luna",
    "planetMenu.compact": "Compatto",
    "res.metal": "Metallo",
    "res.crystal": "Cristallo",
    "res.deuterium": "Deuterio",
    "planetMenu.idle": "Nessuna costruzione in corso",
    "planetMenu.side": "Affiancato",
    "planetMenu.toSide": "Vista affiancata (con risorse)",
    "planetMenu.toCompact": "Vista compatta",
    "planetMenu.noRoom": "Schermo troppo stretto per la vista affiancata",
    "toolbar.settings": "Impostazioni",
    "toolbar.lastSync": "ultimo aggiornamento {time}",
    "settings.view": "Vista del menu",
    "settings.totals": "Totali risorse",
    "settings.on": "S\xEC",
    "settings.off": "No",
    "planetMenu.age": "Minuti dall'ultimo aggiornamento dei dati (apri il pianeta per aggiornarli)",
    "dash.title": "Dashboard",
    "dash.close": "Chiudi",
    "dash.noData": "nessun dato: premi Sincronizza",
    "dash.points": "Punti",
    "dash.rank": "Posizione {rank} su {of}",
    "dash.pointsHint": "apri la Panoramica per leggerli",
    "dash.stock": "Risorse sui corpi (MSU)",
    "dash.stockNote": "pianeti e lune, stima attuale",
    "dash.prodHour": "Produzione oraria (MSU)",
    "dash.prodDay": "{value} al giorno",
    "dash.bodies": "Pianeti / Lune",
    "dash.bodiesNote": "con dati salvati",
    "dash.idle": "Pianeti fermi",
    "dash.idleNote": "nessuna costruzione in corso",
    "dash.production": "Produzione",
    "dash.dayShort": "g",
    "dash.daysShort": "g",
    "dash.msuHint": "Barre in MSU (3:2:1): metallo, cristallo \xD71,5, deuterio \xD73.",
    "dash.checks": "Da controllare",
    "dash.allGood": "Tutto a posto.",
    "dash.bodiesTable": "Pianeti e lune",
    "dash.showMoons": "Mostra lune",
    "dash.hideMoons": "Nascondi lune",
    "dash.colBody": "Corpo",
    "dash.colMines": "Miniere M\xB7C\xB7D",
    "dash.colProd": "MSU/giorno",
    "dash.colFull": "Pieno tra",
    "dash.colAge": "Dati",
    "dash.full": "pieno",
    "dash.idleTag": "fermo",
    "dash.total": "Totale",
    "dash.tableHint": "Clicca un titolo per ordinare. Le risorse sono stimate dall'ultima lettura pi\xF9 la produzione; apri un pianeta per avere il valore esatto.",
    "alert.missing": "Dati mancanti su {count} pianeti",
    "alert.full": "Depositi pieni su {count} pianeti",
    "alert.soonFull": "{count} pianeti pieni entro 6 ore",
    "alert.idle": "{count} pianeti senza costruzioni",
    "alert.stale": "Dati vecchi pi\xF9 di un'ora su {count} corpi",
    "settings.markIdle": "Segna pianeti senza costruzioni",
    "queue.building": "Edificio",
    "queue.research": "Ricerca",
    "queue.ship": "Cantiere",
    "queue.lfbuilding": "Edificio forma di vita",
    "queue.lfresearch": "Ricerca forma di vita",
    "dash.queues": "Code attive",
    "dash.queuesNone": "nessuna costruzione in corso",
    "dash.queuesUnknown": "non ancora lette",
    "dash.moves": "Miniere pi\xF9 convenienti",
    "dash.movesNone": "Servono i livelli delle miniere: premi Sincronizza.",
    "dash.movesHint": "Giorni per ripagare il costo con la produzione in pi\xF9 (MSU). Stima: non conta energia n\xE9 sconti delle forme di vita.",
    "dash.colQueue": "In corso",
    "mine.metal": "Miniera di metallo",
    "mine.crystal": "Miniera di cristallo",
    "mine.deuterium": "Sintetizzatore di deuterio",
    "fleet.reserveShips": "Navi",
    "fleet.reserveRes": "Risorse",
    "fleet.noShips": "Nessuna nave su questo pianeta.",
    "fleet.fleetsave": "Fleetsave",
    "fleet.galaxy": "Galassia (vuoto = questa)",
    "fleet.system": "Sistema (vuoto = questo)",
    "fleet.position": "Posizione",
    "fleet.type": "Tipo",
    "fleet.typePlanet": "Pianeta",
    "fleet.typeMoon": "Luna",
    "fleet.typeDebris": "Campo detriti",
    "fleet.mission": "Missione",
    "fleet.speed": "Velocit\xE0",
    "fleet.fleetsaveHint": "Lascia vuoti galassia e sistema per usare quelli del pianeta da cui parti, come in PrOGect. Senza posizione il fleetsave \xE8 spento.",
    "fleet.save": "Salva",
    "fleet.saved": "Salvato.",
    "fleet.copied": "Copiato su {count} corpi.",
    "fleet.reserve": "Riserva",
    "fleet.summaryShips": "{count} navi",
    "fleet.noReserve": "Nessuna riserva impostata",
    "fleet.resMinusReserve": "Risorse \u2212 riserva",
    "fleet.resLoaded": "Caricate {cargo} risorse: controlla e premi Invia flotta",
    "mission.1": "Attacco",
    "mission.3": "Trasporto",
    "mission.4": "Schieramento",
    "mission.5": "Stazionamento",
    "mission.6": "Spionaggio",
    "mission.8": "Raccolta",
    "mission.15": "Spedizione",
    "fleet.editTitlePlanet": "Riserve e fleetsave di {body}",
    "fleet.editTitleMoon": "Riserve e fleetsave della luna {body}",
    "fleet.copyPlanets": "Copia su tutti i pianeti ({count})",
    "fleet.copyMoons": "Copia su tutte le lune ({count})",
    "fleet.settingsTitle": "Impostazioni flotta",
    "fleet.transportTitle": "Trasporti e schieramenti",
    "fleet.mainShip": "Nave principale",
    "fleet.secondShip": "Nave secondaria (se la prima non basta)",
    "fleet.none": "Nessuna",
    "fleet.expeditionTitle": "Spedizioni",
    "fleet.expeditionShip": "Nave da carico",
    "fleet.bestShip": "La migliore disponibile",
    "fleet.expeditionValue": "Carico da coprire",
    "fleet.auto": "automatico",
    "fleet.expeditionExtras": "Aggiungi 1 nave grande, 1 sonda e 1 pathfinder",
    "fleet.expeditionHint": "Automatico = il massimo che una spedizione pu\xF2 riportare (classe, velocit\xE0 universo, bonus classe). Puoi scrivere un valore fisso (es. 150M) o una percentuale (es. 50%).",
    "fleet.repeatTitle": "Ripeti",
    "fleet.repeat": "Dopo l'invio passa al pianeta o luna successivo, gi\xE0 pronto",
    "fleet.repeatHint": "Vale per Luna, Trasporto, Schiera, Spedizione e Fleetsave. L'invio resta sempre un tuo click; il giro si ferma quando torna al primo.",
    "fleet.repeatShort": "Ripeti",
    "fleet.on": "s\xEC",
    "fleet.off": "no",
    "fleet.repeatNext": "Inviata. Passo a {body}\u2026",
    "fleet.repeatDone": "Giro completato.",
    "fleet.pickDest": "scegli destinazione",
    "fleet.btn.moon": "Su luna",
    "fleet.btn.transport": "Trasporto",
    "fleet.btn.deploy": "Schiera",
    "fleet.btn.expedition": "Spedizione",
    "fleet.btn.fleetsave": "Fleetsave",
    "fleet.btn.all": "Tutte \u2212 riserva",
    "fleet.tip.moon": "Trasporta le risorse sulla luna di questo pianeta, con i cargo necessari",
    "fleet.tip.transport": "Trasporta le risorse (meno la riserva) alla destinazione scelta",
    "fleet.tip.deploy": "Schiera tutte le navi (meno la riserva) con le risorse che portano",
    "fleet.tip.expedition": "Spedizione in posizione 16 di questo sistema, con la nave migliore",
    "fleet.tip.fleetsave": "Prepara il fleetsave di questo pianeta o luna",
    "fleet.tip.all": "Seleziona tutte le navi meno la riserva",
    "fleet.ok.cargo": "Pronto: {ships} navi, {cargo} risorse. Premi Avanti e Invia flotta",
    "fleet.ok.ships": "{ships} navi selezionate",
    "fleet.ok.expedition": "Spedizione pronta: {ships} navi per {target} di carico. Premi Avanti e Invia flotta",
    "fleet.err.noShips": "Nessuna nave disponibile oltre la riserva",
    "fleet.err.noResources": "Nessuna risorsa da trasportare oltre la riserva",
    "fleet.err.noExpSlots": "Nessuno slot spedizione libero",
    "fleet.err.noMoon": "Questo pianeta non ha una luna",
    "fleet.err.noDest": "Scegli prima la destinazione",
    "fleet.err.noFleetsave": "Nessun fleetsave impostato: aprilo da Riserve e fleetsave",
    "fleet.err.notReady": "La pagina flotta non \xE8 ancora pronta, riprova",
    "fleet.err.page1": "Torna alla prima pagina della flotta per usare questi pulsanti",
    "fleet.tabPlanet": "Questo pianeta",
    "fleet.tabMoon": "Questa luna",
    "fleet.tabGeneral": "Generali",
    "fleet.close": "Chiudi",
    "fleet.favTitle": "Destinazioni preferite",
    "fleet.favTransport": "Trasporto verso",
    "fleet.favDeploy": "Schiera verso",
    "fleet.tip.cargo": "Carica le risorse lasciando la riserva e il deuterio per il volo",
    "fleet.reserve1Title": "Riserva 1 \xB7 trasporti e schieramenti",
    "fleet.reserve1Hint": "Resta sul corpo con Su luna, Trasporto, Schiera, Spedizione e Tutte \u2212 riserva.",
    "fleet.reserve2Title": "Riserva 2 \xB7 solo fleetsave",
    "fleet.reserve2Hint": "Resta sul corpo solo quando premi Fleetsave. Vuota = parte tutto.",
    "fleet.btn.last": "Ultima",
    "fleet.tip.last": "Ripete l'ultima flotta inviata: stesse navi, destinazione, missione e velocit\xE0",
    "fleet.err.noLast": "Nessuna flotta inviata finora",
    "fleet.jumpgateKeep": "Riserva 1 di questa luna",
    "shortcut.prev": "Pianeta precedente",
    "shortcut.next": "Pianeta successivo",
    "fleet.shortcutsTitle": "Scorciatoie da tastiera",
    "tech.prev": "Livello precedente",
    "tech.next": "Livello successivo",
    "tech.reset": "Torna al prossimo livello",
    "tech.level": "Liv. {level}",
    "tech.range": "da {from} \u2192 {to}",
    "tech.fromNow": "ora {from}",
    "tech.colLevel": "Liv. {level}",
    "tech.colTotal": "Totale",
    "tech.colMissing": "Mancano",
    "tech.colOne": "Per unit\xE0",
    "tech.res.metal": "Metallo",
    "tech.res.crystal": "Cristallo",
    "tech.res.deuterium": "Deuterio",
    "tech.res.energy": "Energia",
    "tech.time": "Tempo",
    "tech.addOne": "Pianifica liv. {level}",
    "tech.addRange": "Pianifica liv. {from}\u2013{to}",
    "tech.inPlan": "Nel piano \u2713",
    "tech.addHint": "Aggiunge al piano di costruzione di questo pianeta/luna",
    "tech.removeHint": "Clic per togliere questi livelli dal piano",
    "tech.discount": "Sconto applicato dal gioco: {pct}%",
    "tech.amount": "Quantit\xE0: {n}",
    "tech.addUnits": "Pianifica \xD7{n}",
    "tech.added": "Aggiunto \u2713",
    "plan.title": "Piano di costruzione",
    "plan.titleCount": "Piano di costruzione ({n})",
    "plan.sub": "Una riga per cosa da fare, aperta sui pianeti. In rosso quello che manca su quel pianeta.",
    "plan.moonOf": "Luna di {name}",
    "plan.clear": "Svuota",
    "plan.colItem": "Cosa",
    "plan.level": "liv. {level}",
    "plan.remove": "Togli dal piano",
    "plan.total": "Totale",
    "plan.missingHere": "Mancano qui",
    "plan.ready": "Risorse sufficienti \u2713",
    "plan.empty": "Il piano \xE8 vuoto. Apri un edificio o una ricerca e usa \xABPianifica\xBB.",
    "plan.grandTotal": "Costo totale del piano",
    "plan.grandMissing": "Mancano in totale",
    "tech.rangeShort": "{from}\u2192{to}",
    "tech.rangeHint": "Totale dei livelli da {from} a {to}",
    "tech.discountShort": "\u2212{pct}%",
    "fleet.reserveOff": "Riserve spente: partono anche le navi e le risorse in riserva.",
    "fleet.reserveShort": "Riserve",
    "fleet.reserveToggleHint": "Accende o spegne le riserve 1 e 2 senza cancellarle. Le spedizioni non usano mai la riserva.",
    "fleet.foodShort": "Ignora cibo",
    "fleet.foodHint": "Il cibo resta sul pianeta in ogni flotta, anche con i tasti del gioco.",
    "fleet.err.noDelivery": "Nessuna consegna del piano in corso.",
    "fleet.ok.delivery": "Consegna pronta: {ships} navi con {cargo} risorse (mancavano {left}). Premi Avanti e Invia flotta.",
    "tech.timeHint": "Tempo del liv. {level} \xB7 totale da {from} a {to}",
    "tech.amountHint": "Quantit\xE0 da pianificare: anche pi\xF9 di quelle che puoi pagare adesso",
    "plan.items": "{n} voci",
    "plan.levels": "liv. {from}\u2013{to}",
    "plan.bring": "Porta qui le risorse",
    "plan.bringHint": "Apre la flotta sul prossimo pianeta con un trasporto verso qui di quello che manca. Dopo ogni invio passa al pianeta successivo finch\xE9 non manca pi\xF9 niente.",
    "plan.unknownHere": "Risorse qui non note: premi Aggiorna",
    "plan.complete": "Completa l'invio",
    "plan.sentArriving": "Inviate \xB7 arrivo {time}",
    "plan.sentArrived": "Inviate \xB7 arrivate (non ancora lette)",
    "plan.missingAfterSent": "Mancano ancora",
    "plan.allSent": "Tutto inviato \u2713",
    "msg.out.resource": "Risorse",
    "msg.out.darkmatter": "Materia oscura",
    "msg.out.ship": "Navi",
    "msg.out.nothing": "Niente",
    "msg.out.trader": "Mercante",
    "msg.out.item": "Oggetto",
    "msg.out.blackhole": "Buco nero",
    "msg.out.early": "Rientro anticipato",
    "msg.out.late": "Ritardo",
    "msg.out.pirate": "Pirati",
    "msg.out.alien": "Alieni",
    "msg.out.artefact": "Artefatti",
    "msg.out.lifeform": "Esperienza forme di vita",
    "msg.out.unknown": "Altro",
    "msg.size.0": "Enorme",
    "msg.size.1": "Grande",
    "msg.size.2": "Normale",
    "msg.depletion": "Esaurimento {n}",
    "msg.discovery": "Scoperta",
    "msg.lfXp": "+{n} XP",
    "msg.artefacts": "{n} artefatti",
    "msg.msuHint": "Valore in unit\xE0 metallo (1 cristallo = 1,5, 1 deuterio = 3)",
    "msg.toggle": "Clic: mostra o nasconde il testo del gioco",
    "msg.res.metal": "Metallo",
    "msg.res.crystal": "Cristallo",
    "msg.res.deuterium": "Deuterio",
    "msg.res.food": "Cibo",
    "msg.res.darkMatter": "Materia oscura",
    "msg.spy.loot": "Bottino",
    "msg.spy.cargo": "{n}\xD7 {ship}",
    "msg.spy.fleet": "Flotta",
    "msg.spy.def": "Difesa",
    "msg.spy.active": "Attivo ora",
    "msg.spy.activity": "Attivo {n} min fa",
    "msg.spy.inactive": "Nessuna attivit\xE0",
    "msg.spy.counter": "Spiato da {name} [{coords}]",
    "msg.spy.attacked": "Gi\xE0 attaccato",
    "msg.transport": "Consegna",
    "msg.deploy": "Flotta arrivata",
    "msg.recycle": "Riciclaggio",
    "msg.empty": "Senza risorse",
    "msg.debrisLeft": "Restano {n}",
    "msg.combat.won": "Vinta",
    "msg.combat.lost": "Persa",
    "msg.combat.draw": "Pareggio",
    "msg.combat.unknown": "Battaglia",
    "msg.combat.loot": "Bottino",
    "msg.combat.raided": "Razziati",
    "msg.combat.losses": "Perdite",
    "msg.combat.debris": "Detriti",
    "exp.title": "Diario spedizioni",
    "exp.sub": "Dai report di spedizione che apri nella posta: niente richieste al server",
    "exp.period.today": "Oggi",
    "exp.period.yesterday": "Ieri",
    "exp.period.week": "7 giorni",
    "exp.period.month": "30 giorni",
    "exp.period.all": "Tutto",
    "exp.empty": "Ancora nessuna spedizione: apri la posta, scheda Flotte \u2192 Spedizioni, e i report entrano qui.",
    "exp.emptyPeriod": "Nessuna spedizione in questo periodo.",
    "exp.count": "Spedizioni",
    "exp.discoveries": "+ {n} scoperte",
    "exp.resources": "Risorse",
    "exp.dm": "Materia oscura",
    "exp.shipsFound": "Navi trovate",
    "exp.lost": "Navi perse",
    "exp.net": "Guadagno netto",
    "exp.average": "Media a spedizione",
    "exp.lfXp": "Esperienza FV",
    "exp.outcomes": "Esiti",
    "exp.ships": "Navi",
    "exp.byDay": "Giorno per giorno",
    "exp.day": "Giorno",
    "exp.countShort": "N.",
    "exp.dmShort": "MO",
    "exp.shipsShort": "Navi (MSU)",
    "exp.fold": "Nella posta, nascondi il testo del gioco sotto il riepilogo",
    "exp.export": "Esporta",
    "exp.exportHint": "Scarica il diario in un file JSON (backup)",
    "exp.clear": "Svuota",
    "exp.clearConfirm": "Clic di nuovo per cancellare tutto",
    "ship.202": "Cargo Leggero",
    "ship.203": "Cargo Pesante",
    "ship.204": "Caccia Leggero",
    "ship.205": "Caccia Pesante",
    "ship.206": "Incrociatore",
    "ship.207": "Nave da Battaglia",
    "ship.208": "Colonizzatrice",
    "ship.209": "Riciclatrice",
    "ship.210": "Sonda spia",
    "ship.211": "Bombardiere",
    "ship.212": "Satellite Solare",
    "ship.213": "Corazzata",
    "ship.214": "Morte Nera",
    "ship.215": "Incrociatore da Battaglia",
    "ship.217": "Crawler",
    "ship.218": "Reaper",
    "ship.219": "Pathfinder",
    "msg.return": "Rientro spedizione",
    "bar.dash": "Dashboard",
    "bar.perDay": "/g",
    "bar.dashHint": "produzione al giorno in MSU",
    "bar.plan": "Piano \xB7 {n}",
    "bar.planEmpty": "Piano",
    "bar.ready": "Pronto",
    "bar.planHint": "quanto manca all'account, in MSU, contando le risorse in viaggio",
    "bar.journal": "Diario oggi",
    "bar.journalHint": "{n} spedizioni oggi, guadagno netto in MSU",
    "dash.tab.summary": "Riepilogo",
    "dash.tab.mines": "Miniere",
    "dash.tab.facilities": "Strutture",
    "dash.tab.lifeforms": "Forme di vita",
    "dash.tab.ships": "Navi",
    "dash.tab.defence": "Difese",
    "dash.tab.scrap": "Rottamatore",
    "dash.prodDayK": "Produzione al giorno (MSU)",
    "dash.prodHourNote": "{value} all'ora",
    "dash.fleetValue": "Flotta (MSU)",
    "dash.defValue": "Difese (MSU)",
    "dash.unitsNote": "{n} unit\xE0, a costo pieno",
    "dash.research": "Ricerche",
    "dash.average": "Media",
    "dash.planets": "Pianeti",
    "dash.moons": "Lune",
    "dash.moon": "Luna",
    "dash.minesHint": "In azzurro il livello pi\xF9 alto dell'account. Produzione dall'ultima lettura di accountInfo.",
    "dash.lfHint": "Ogni pianeta mostra le proprie tecnologie attive: edifici della sua specie e, per ogni slot, la ricerca in uso. Le ricerche in corsivo sono stimate: apri la pagina Ricerca forme di vita del pianeta per leggerle esatte.",
    "dash.lfGuess": "Stimata: apri la pagina Ricerca forme di vita di questo pianeta per il dato esatto.",
    "dash.lfNone": "Nessun livello di questa specie nei dati del gioco.",
    "dash.lfBuildings": "Edifici",
    "dash.lfResearch": "Ricerche",
    "lf.1": "Umani",
    "lf.2": "Rock'tal",
    "lf.3": "Mecha",
    "lf.4": "Kaelesh",
    "dash.unitsNone": "Nessuna unit\xE0 nei dati salvati.",
    "dash.valueMsu": "Valore MSU",
    "dash.scrapHint": "Solo calcolo: il Rottamatore del gioco restituisce il 35% del costo, fino al 75% contrattando. La vendita la fai nella pagina del Mercante.",
    "dash.scrapRate": "Resa",
    "dash.scrapAll": "Tutto",
    "dash.scrapNone": "Azzera",
    "dash.unit": "Unit\xE0",
    "dash.owned": "Presenti",
    "dash.toScrap": "Da rottamare",
    "galaxy.players": "{count} giocatori",
    "galaxy.inactive": "{count} inattivi",
    "galaxy.longInactive": "di cui {count} da 28 giorni",
    "galaxy.vacation": "{count} in vacanza",
    "galaxy.moons": "{count} lune",
    "galaxy.debris": "Detriti {msu} MSU in {count} campi",
    "galaxy.deep": "Spazio profondo {msu} MSU",
    "galaxy.noDebris": "Nessun campo detriti",
    "galaxy.targets": "Bersagli ({count})",
    "galaxy.rankTitle": "Punti e classifiche di {name}",
    "galaxy.score.total": "Generale",
    "galaxy.score.economy": "Economia",
    "galaxy.score.research": "Ricerca",
    "galaxy.score.military": "Militare",
    "galaxy.score.lifeform": "Forme di vita",
    "galaxy.ships": "{count} navi",
    "galaxy.loading": "Lettura dall'API pubblica\u2026",
    "galaxy.apiError": "API pubblica non raggiungibile. Riprova pi\xF9 tardi.",
    "galaxy.apiAge": "API pubblica, ore {time}",
    "galaxy.own": "Tuo",
    "settings.backup": "Backup dati",
    "settings.backupExport": "Esporta",
    "settings.backupImport": "Importa",
    "settings.backupSaved": "Salvati {n} valori nel file",
    "settings.backupRestored": "Ripristinati {n} valori: ricarica la pagina",
    "settings.backupBad": "Il file non \xE8 un backup di Future",
    "dash.tab.history": "Storico",
    "dash.historyEmpty": "Lo storico si riempie da solo: un punto al giorno ogni volta che apri la Panoramica. Torna domani per vedere le prime variazioni.",
    "dash.historySpan": "Ultimi {n} g",
    "dash.historyPerDay": "{v}/g",
    "dash.historyUp": "\u2191{n} posizioni",
    "dash.historyDown": "\u2193{n} posizioni",
    "dash.historyReal": "su {n} g",
    "dash.historyFew": "pochi giorni registrati",
    "dash.historyProd": "Produzione al giorno (MSU)",
    "dash.historyDays": "Giorni registrati",
    "dash.historyDay": "Giorno",
    "dash.historyDelta": "Variazione",
    "dash.historyRank": "Posizione",
    "spy.title": "Tabella spiate",
    "spy.sub": "{n} bersagli \xB7 bottino {msu} MSU",
    "spy.hideDefended": "Nascondi difesi",
    "spy.inactiveOnly": "Solo inattivi",
    "spy.noSpeed": "Apri una volta la pagina Flotta: Future legge la velocit\xE0 delle navi e calcola tempi di volo e MSU all'ora.",
    "spy.none": "Nessun report di spionaggio negli ultimi 3 giorni. I report che apri in posta finiscono qui da soli.",
    "spy.noneFiltered": "Nessun bersaglio con questi filtri.",
    "spy.col.target": "Bersaglio",
    "spy.col.age": "Et\xE0",
    "spy.col.loot": "Bottino MSU",
    "spy.col.ships": "Cargo",
    "spy.col.def": "Difesa",
    "spy.col.rate": "MSU/ora",
    "spy.col.actions": "",
    "spy.attackHint": "Attacca da {name}: apre la pagina Flotta con il bersaglio inserito, navi e invio restano a te",
    "spy.remove": "Togli dalla tabella",
    "spy.hint": "Un bersaglio per pianeta o luna, l'ultimo report vince; restano 3 giorni anche se cancelli i report. MSU/ora = bottino diviso il volo di andata e ritorno dal tuo pianeta pi\xF9 vicino al 100%; sotto, il volo di andata. OS = Osims, OT = OGame Simulator.",
    "spy.status.inactive": "i",
    "spy.status.longinactive": "I",
    "spy.status.vacation": "v",
    "spy.status.banned": "b",
    "spy.status.noob": "n",
    "spy.status.strong": "s",
    "spy.status.honorableTarget": "o",
    "spy.status.outlaw": "fuorilegge",
    "spy.status.admin": "admin",
    "dash.queuesTitle": "Code in corso",
    "dash.queuesHint": "Campanella: avviso nella pagina quando finisce.",
    "remind.add": "Avvisami quando finisce",
    "remind.remove": "Togli il promemoria",
    "remind.now": "Adesso ({time})",
    "remind.late": "Finito alle {time}",
    "remind.ok": "OK",
    "remind.return": "(ritorno)",
    "spy.simGame": "Simulatore del gioco",
    "spy.simOsims": "Simula con Osims (nuova scheda, con le tue ricerche di combattimento)",
    "spy.simOgameTools": "Simula con OGame Simulator (nuova scheda, con le tue ricerche di combattimento)",
    "spy.from": "Da {name} [{coords}], andata al 100%",
    "msg.combat.converter": "Convertitore",
    "msg.combat.converterHint": "Apre il rapporto nel convertitore Ogotcha (nuova scheda)",
    "hs.days": "ti avvicini: {n} g",
    "hs.today": "{n} punti da mezzanotte (base alle {time})",
    "hs.never": "al ritmo attuale no",
    "hs.etaMine": "Al tuo ritmo degli ultimi 7 giorni (+{mine}/g)",
    "hs.passToday": "lo superi oggi",
    "hs.note": "Sotto i punti: quanto ha fatto oggi ogni giocatore, dalla classifica pubblica delle {time}.",
    "hs.noteWaiting": "Lettura della classifica pubblica per i punti di oggi\u2026",
    "mark.flag.watch": "Da controllare",
    "mark.flag.target": "Bersaglio",
    "mark.flag.farm": "Frigo",
    "mark.flag.danger": "Pericolo",
    "mark.flag.friend": "Amico",
    "mark.flag.trade": "Commercio",
    "mark.tag.red": "Rosso",
    "mark.tag.orange": "Arancio",
    "mark.tag.yellow": "Giallo",
    "mark.tag.green": "Verde",
    "mark.tag.blue": "Blu",
    "mark.tag.violet": "Viola",
    "mark.none": "Togli",
    "mark.change": "clic per cambiare, Maiusc+clic per l'ultimo usato",
    "mark.flagAdd": "Segna il giocatore (Maiusc+clic: l'ultima bandierina)",
    "mark.tagAdd": "Colora il pianeta (Maiusc+clic: l'ultimo colore)",
    "marks.title": "Bersagli",
    "marks.sub": "{players} giocatori \xB7 {planets} pianeti",
    "marks.tab.players": "Giocatori",
    "marks.tab.planets": "Pianeti",
    "marks.recent": "Recenti",
    "marks.noRecent": "Nessun giocatore aperto di recente.",
    "marks.noPlayers": "Nessun giocatore con questa bandierina. Mettila dalla galassia, dalla classifica o dalla tabella spiate.",
    "marks.openSheet": "Apri la scheda del giocatore",
    "marks.playersHint": "Clic sul nome: punti, posizioni e tutti i pianeti e lune dall'API pubblica.",
    "marks.back": "Torna all'elenco",
    "marks.write": "Scrivi messaggio",
    "marks.profile": "Profilo",
    "marks.rank": "Classifica",
    "marks.ships": "Navi",
    "marks.planets": "Pianeti {n} \xB7 lune {moons}",
    "marks.from": "Da",
    "marks.to": "a",
    "marks.hide.vacation": "Nascondi vacanza",
    "marks.hide.banned": "Nascondi bannati",
    "marks.hide.inactive": "Nascondi inattivi",
    "marks.noneInRange": "Nessun pianeta colorato in questo intervallo con questi filtri.",
    "marks.noPlanets": "Nessun pianeta colorato. In galassia usa il pallino a destra del nome del pianeta.",
    "marks.planetsHint": "{n} pianeti \xB7 le coordinate mostrano il sistema in galassia",
    "marks.keyNext": "prossima posizione",
    "marks.footData": "galassia + API pubblica",
    "marks.fleetPlanet": "Flotta verso il pianeta {coords} (attivit\xE0 del pianeta)",
    "marks.fleetMoon": "Flotta verso la luna {coords} (attivit\xE0 della luna)",
    "marks.ago": "{n}{u}",
    "marks.unit.m": "m",
    "marks.unit.h": "h",
    "marks.unit.d": "g",
    "marks.seenOnly": "Visto in galassia, l'API non lo elenca ancora \xB7 clic: mostra il sistema",
    "marks.showSystem": "Mostra il sistema in galassia",
    "marks.col.coords": "Coord.",
    "marks.col.debris": "CD",
    "marks.col.planet": "Pian.",
    "marks.col.moon": "Luna",
    "marks.col.seen": "Visto",
    "marks.col.who": "Pianeta \xB7 giocatore",
    "shortcut.nextTarget": "Bersagli: prossima posizione",
    "plan.lacksHere": "qui mancano {n}",
    "plan.clearAll": "Svuota piano",
    "plan.clearConfirm": "Sicuro? Clic di nuovo",
    "plan.account": "Risorse dell'account",
    "plan.accountNote": "tutti i pianeti e lune + in viaggio",
    "plan.accountUnknown": "premi Aggiorna per leggerle",
    "plan.accountCovered": "L'account copre il piano",
    "plan.accountMissing": "Mancano all'account",
    "plan.onBodies": "su {n} corpi",
    "plan.collapse": "Chiudi i pianeti",
    "plan.expand": "Mostra i pianeti",
    "plan.removeAll": "Togli da tutti i {n} corpi",
    "plan.readyHere": "Qui le risorse bastano",
    "bar.targets": "Bersagli",
    "bar.targetsHint": "Barra laterale dei bersagli (giocatori segnati e pianeti colorati) \xB7 M: prossima posizione"
  };

  // src/i18n/en.json
  var en_default = {
    "app.name": "Future",
    "sync.button": "Sync account data",
    "sync.done": "Data updated",
    "data.missing": "Missing data on {count} planets: open their overview",
    "guard.refused": "Call blocked to respect OGame rules",
    "planetMenu.moon": "Moon",
    "planetMenu.compact": "Compact",
    "res.metal": "Metal",
    "res.crystal": "Crystal",
    "res.deuterium": "Deuterium",
    "planetMenu.idle": "Nothing under construction",
    "planetMenu.side": "Side by side",
    "planetMenu.toSide": "Side-by-side view (with resources)",
    "planetMenu.toCompact": "Compact view",
    "planetMenu.noRoom": "Screen too narrow for the side-by-side view",
    "toolbar.settings": "Settings",
    "toolbar.lastSync": "last update {time}",
    "settings.view": "Menu view",
    "settings.totals": "Resource totals",
    "settings.on": "On",
    "settings.off": "Off",
    "planetMenu.age": "Minutes since the data was last updated (open the planet to refresh)",
    "dash.title": "Dashboard",
    "dash.close": "Close",
    "dash.noData": "no data: press Sync",
    "dash.points": "Points",
    "dash.rank": "Rank {rank} of {of}",
    "dash.pointsHint": "open the Overview to read them",
    "dash.stock": "Resources on bodies (MSU)",
    "dash.stockNote": "planets and moons, current estimate",
    "dash.prodHour": "Hourly production (MSU)",
    "dash.prodDay": "{value} per day",
    "dash.bodies": "Planets / Moons",
    "dash.bodiesNote": "with stored data",
    "dash.idle": "Idle planets",
    "dash.idleNote": "nothing under construction",
    "dash.production": "Production",
    "dash.dayShort": "d",
    "dash.daysShort": "d",
    "dash.msuHint": "Bars in MSU (3:2:1): metal, crystal \xD71.5, deuterium \xD73.",
    "dash.checks": "To check",
    "dash.allGood": "All good.",
    "dash.bodiesTable": "Planets and moons",
    "dash.showMoons": "Show moons",
    "dash.hideMoons": "Hide moons",
    "dash.colBody": "Body",
    "dash.colMines": "Mines M\xB7C\xB7D",
    "dash.colProd": "MSU/day",
    "dash.colFull": "Full in",
    "dash.colAge": "Data",
    "dash.full": "full",
    "dash.idleTag": "idle",
    "dash.total": "Total",
    "dash.tableHint": "Click a header to sort. Resources are estimated from the last reading plus production; open a planet for the exact value.",
    "alert.missing": "Missing data on {count} planets",
    "alert.full": "Storage full on {count} planets",
    "alert.soonFull": "{count} planets full within 6 hours",
    "alert.idle": "{count} planets with nothing under construction",
    "alert.stale": "Data older than an hour on {count} bodies",
    "settings.markIdle": "Mark planets with nothing under construction",
    "queue.building": "Building",
    "queue.research": "Research",
    "queue.ship": "Shipyard",
    "queue.lfbuilding": "Lifeform building",
    "queue.lfresearch": "Lifeform research",
    "dash.queues": "Active queues",
    "dash.queuesNone": "nothing under construction",
    "dash.queuesUnknown": "not read yet",
    "dash.moves": "Best mine upgrades",
    "dash.movesNone": "Mine levels needed: press Sync.",
    "dash.movesHint": "Days to pay back the cost with the extra production (MSU). Estimate: energy and lifeform discounts not counted.",
    "dash.colQueue": "Running",
    "mine.metal": "Metal mine",
    "mine.crystal": "Crystal mine",
    "mine.deuterium": "Deuterium synthesizer",
    "fleet.reserveShips": "Ships",
    "fleet.reserveRes": "Resources",
    "fleet.noShips": "No ships on this planet.",
    "fleet.fleetsave": "Fleetsave",
    "fleet.galaxy": "Galaxy (empty = this one)",
    "fleet.system": "System (empty = this one)",
    "fleet.position": "Position",
    "fleet.type": "Type",
    "fleet.typePlanet": "Planet",
    "fleet.typeMoon": "Moon",
    "fleet.typeDebris": "Debris field",
    "fleet.mission": "Mission",
    "fleet.speed": "Speed",
    "fleet.fleetsaveHint": "Leave galaxy and system empty to use the origin planet's, as in PrOGect. No position = fleetsave off.",
    "fleet.save": "Save",
    "fleet.saved": "Saved.",
    "fleet.copied": "Copied to {count} bodies.",
    "fleet.reserve": "Reserve",
    "fleet.summaryShips": "{count} ships",
    "fleet.noReserve": "No reserve set",
    "fleet.resMinusReserve": "Resources \u2212 reserve",
    "fleet.resLoaded": "Loaded {cargo} resources: check and press Send fleet",
    "mission.1": "Attack",
    "mission.3": "Transport",
    "mission.4": "Deployment",
    "mission.5": "ACS Defend",
    "mission.6": "Espionage",
    "mission.8": "Harvest",
    "mission.15": "Expedition",
    "fleet.editTitlePlanet": "Reserves and fleetsave of {body}",
    "fleet.editTitleMoon": "Reserves and fleetsave of moon {body}",
    "fleet.copyPlanets": "Copy to all planets ({count})",
    "fleet.copyMoons": "Copy to all moons ({count})",
    "fleet.settingsTitle": "Fleet settings",
    "fleet.transportTitle": "Transports and deployments",
    "fleet.mainShip": "Main ship",
    "fleet.secondShip": "Second ship (if the first is not enough)",
    "fleet.none": "None",
    "fleet.expeditionTitle": "Expeditions",
    "fleet.expeditionShip": "Cargo ship",
    "fleet.bestShip": "Best available",
    "fleet.expeditionValue": "Cargo to cover",
    "fleet.auto": "automatic",
    "fleet.expeditionExtras": "Add 1 big ship, 1 probe and 1 pathfinder",
    "fleet.expeditionHint": "Automatic = the most an expedition can bring back (class, universe speed, class bonus). You can type a fixed value (e.g. 150M) or a percentage (e.g. 50%).",
    "fleet.repeatTitle": "Repeat",
    "fleet.repeat": "After sending, open the next planet or moon already prepared",
    "fleet.repeatHint": "Works for Moon, Transport, Deploy, Expedition and Fleetsave. Sending is always your click; the round stops when it gets back to the first.",
    "fleet.repeatShort": "Repeat",
    "fleet.on": "on",
    "fleet.off": "off",
    "fleet.repeatNext": "Sent. Moving to {body}\u2026",
    "fleet.repeatDone": "Round complete.",
    "fleet.pickDest": "pick destination",
    "fleet.btn.moon": "To moon",
    "fleet.btn.transport": "Transport",
    "fleet.btn.deploy": "Deploy",
    "fleet.btn.expedition": "Expedition",
    "fleet.btn.fleetsave": "Fleetsave",
    "fleet.btn.all": "All \u2212 reserve",
    "fleet.tip.moon": "Transport the resources to this planet's moon with the cargo ships needed",
    "fleet.tip.transport": "Transport the resources (minus the reserve) to the chosen destination",
    "fleet.tip.deploy": "Deploy every ship (minus the reserve) with the resources they carry",
    "fleet.tip.expedition": "Expedition to position 16 of this system with the best ship",
    "fleet.tip.fleetsave": "Prepare this planet or moon's fleetsave",
    "fleet.tip.all": "Select every ship minus the reserve",
    "fleet.ok.cargo": "Ready: {ships} ships, {cargo} resources. Press Next and Send fleet",
    "fleet.ok.ships": "{ships} ships selected",
    "fleet.ok.expedition": "Expedition ready: {ships} ships for {target} cargo. Press Next and Send fleet",
    "fleet.err.noShips": "No ships available beyond the reserve",
    "fleet.err.noResources": "No resources to move beyond the reserve",
    "fleet.err.noExpSlots": "No free expedition slot",
    "fleet.err.noMoon": "This planet has no moon",
    "fleet.err.noDest": "Pick a destination first",
    "fleet.err.noFleetsave": "No fleetsave set: open Reserves and fleetsave",
    "fleet.err.notReady": "The fleet page is not ready yet, try again",
    "fleet.err.page1": "Go back to fleet page 1 to use these buttons",
    "fleet.tabPlanet": "This planet",
    "fleet.tabMoon": "This moon",
    "fleet.tabGeneral": "General",
    "fleet.close": "Close",
    "fleet.favTitle": "Favourite destinations",
    "fleet.favTransport": "Transport to",
    "fleet.favDeploy": "Deploy to",
    "fleet.tip.cargo": "Load the resources, keeping the reserve and the flight's deuterium",
    "fleet.reserve1Title": "Reserve 1 \xB7 transports and deployments",
    "fleet.reserve1Hint": "Stays here with To moon, Transport, Deploy, Expedition and All \u2212 reserve.",
    "fleet.reserve2Title": "Reserve 2 \xB7 fleetsave only",
    "fleet.reserve2Hint": "Stays here only when you press Fleetsave. Empty = everything leaves.",
    "fleet.btn.last": "Last",
    "fleet.tip.last": "Repeat the last fleet sent: same ships, target, mission and speed",
    "fleet.err.noLast": "No fleet sent yet",
    "fleet.jumpgateKeep": "Reserve 1 of this moon",
    "shortcut.prev": "Previous planet",
    "shortcut.next": "Next planet",
    "fleet.shortcutsTitle": "Keyboard shortcuts",
    "tech.prev": "Previous level",
    "tech.next": "Next level",
    "tech.reset": "Back to the next level",
    "tech.level": "Lv. {level}",
    "tech.range": "from {from} \u2192 {to}",
    "tech.fromNow": "now {from}",
    "tech.colLevel": "Lv. {level}",
    "tech.colTotal": "Total",
    "tech.colMissing": "Missing",
    "tech.colOne": "Per unit",
    "tech.res.metal": "Metal",
    "tech.res.crystal": "Crystal",
    "tech.res.deuterium": "Deuterium",
    "tech.res.energy": "Energy",
    "tech.time": "Time",
    "tech.addOne": "Plan lv. {level}",
    "tech.addRange": "Plan lv. {from}\u2013{to}",
    "tech.inPlan": "In plan \u2713",
    "tech.addHint": "Adds to this planet/moon's construction plan",
    "tech.removeHint": "Click to remove these levels from the plan",
    "tech.discount": "Discount applied by the game: {pct}%",
    "tech.amount": "Amount: {n}",
    "tech.addUnits": "Plan \xD7{n}",
    "tech.added": "Added \u2713",
    "plan.title": "Construction plan",
    "plan.titleCount": "Construction plan ({n})",
    "plan.sub": "One line per thing to build, opening onto its planets. Red: what that planet lacks.",
    "plan.moonOf": "Moon of {name}",
    "plan.clear": "Clear",
    "plan.colItem": "What",
    "plan.level": "lv. {level}",
    "plan.remove": "Remove from plan",
    "plan.total": "Total",
    "plan.missingHere": "Missing here",
    "plan.ready": "Enough resources \u2713",
    "plan.empty": "The plan is empty. Open a building or research and use \u201CPlan\u201D.",
    "plan.grandTotal": "Total plan cost",
    "plan.grandMissing": "Missing overall",
    "tech.rangeShort": "{from}\u2192{to}",
    "tech.rangeHint": "Total of levels {from} to {to}",
    "tech.discountShort": "\u2212{pct}%",
    "fleet.reserveOff": "Reserves off: ships and resources in reserve leave too.",
    "fleet.reserveShort": "Reserves",
    "fleet.reserveToggleHint": "Turns reserves 1 and 2 on or off without deleting them. Expeditions never use the reserve.",
    "fleet.foodShort": "Ignore food",
    "fleet.foodHint": "Food stays on the planet in every fleet, also with the game's own buttons.",
    "fleet.err.noDelivery": "No plan delivery in progress.",
    "fleet.ok.delivery": "Delivery ready: {ships} ships with {cargo} resources ({left} were missing). Press Next and Send fleet.",
    "tech.timeHint": "Time of lv. {level} \xB7 total {from} to {to}",
    "tech.amountHint": "Amount to plan: also more than you can pay for now",
    "plan.items": "{n} items",
    "plan.levels": "lv. {from}\u2013{to}",
    "plan.bring": "Bring resources here",
    "plan.bringHint": "Opens the fleet page on the next planet with a transport of what is missing to here. After each send it moves to the next planet until nothing is missing.",
    "plan.unknownHere": "Resources here unknown: press Sync",
    "plan.complete": "Complete the delivery",
    "plan.sentArriving": "Sent \xB7 arriving {time}",
    "plan.sentArrived": "Sent \xB7 arrived (not read yet)",
    "plan.missingAfterSent": "Still missing",
    "plan.allSent": "All sent \u2713",
    "msg.out.resource": "Resources",
    "msg.out.darkmatter": "Dark Matter",
    "msg.out.ship": "Ships",
    "msg.out.nothing": "Nothing",
    "msg.out.trader": "Merchant",
    "msg.out.item": "Item",
    "msg.out.blackhole": "Black hole",
    "msg.out.early": "Early return",
    "msg.out.late": "Delay",
    "msg.out.pirate": "Pirates",
    "msg.out.alien": "Aliens",
    "msg.out.artefact": "Artefacts",
    "msg.out.lifeform": "Lifeform experience",
    "msg.out.unknown": "Other",
    "msg.size.0": "Huge",
    "msg.size.1": "Large",
    "msg.size.2": "Normal",
    "msg.depletion": "Depletion {n}",
    "msg.discovery": "Discovery",
    "msg.lfXp": "+{n} XP",
    "msg.artefacts": "{n} artefacts",
    "msg.msuHint": "Value in metal units (1 crystal = 1.5, 1 deuterium = 3)",
    "msg.toggle": "Click: show or hide the game's text",
    "msg.res.metal": "Metal",
    "msg.res.crystal": "Crystal",
    "msg.res.deuterium": "Deuterium",
    "msg.res.food": "Food",
    "msg.res.darkMatter": "Dark Matter",
    "msg.spy.loot": "Loot",
    "msg.spy.cargo": "{n}\xD7 {ship}",
    "msg.spy.fleet": "Fleet",
    "msg.spy.def": "Defence",
    "msg.spy.active": "Active now",
    "msg.spy.activity": "Active {n} min ago",
    "msg.spy.inactive": "No activity",
    "msg.spy.counter": "Spied by {name} [{coords}]",
    "msg.spy.attacked": "Already attacked",
    "msg.transport": "Delivery",
    "msg.deploy": "Fleet arrived",
    "msg.recycle": "Recycling",
    "msg.empty": "No resources",
    "msg.debrisLeft": "{n} left",
    "msg.combat.won": "Won",
    "msg.combat.lost": "Lost",
    "msg.combat.draw": "Draw",
    "msg.combat.unknown": "Battle",
    "msg.combat.loot": "Loot",
    "msg.combat.raided": "Raided",
    "msg.combat.losses": "Losses",
    "msg.combat.debris": "Debris",
    "exp.title": "Expedition journal",
    "exp.sub": "From the expedition reports you open in the inbox: no server requests",
    "exp.period.today": "Today",
    "exp.period.yesterday": "Yesterday",
    "exp.period.week": "7 days",
    "exp.period.month": "30 days",
    "exp.period.all": "All",
    "exp.empty": "No expeditions yet: open the inbox, Fleets \u2192 Expeditions, and the reports land here.",
    "exp.emptyPeriod": "No expeditions in this period.",
    "exp.count": "Expeditions",
    "exp.discoveries": "+ {n} discoveries",
    "exp.resources": "Resources",
    "exp.dm": "Dark Matter",
    "exp.shipsFound": "Ships found",
    "exp.lost": "Ships lost",
    "exp.net": "Net gain",
    "exp.average": "Average per expedition",
    "exp.lfXp": "LF experience",
    "exp.outcomes": "Outcomes",
    "exp.ships": "Ships",
    "exp.byDay": "Day by day",
    "exp.day": "Day",
    "exp.countShort": "No.",
    "exp.dmShort": "DM",
    "exp.shipsShort": "Ships (MSU)",
    "exp.fold": "In the inbox, fold the game's text under the summary",
    "exp.export": "Export",
    "exp.exportHint": "Download the journal as a JSON file (backup)",
    "exp.clear": "Clear",
    "exp.clearConfirm": "Click again to delete everything",
    "ship.202": "Small Cargo",
    "ship.203": "Large Cargo",
    "ship.204": "Light Fighter",
    "ship.205": "Heavy Fighter",
    "ship.206": "Cruiser",
    "ship.207": "Battleship",
    "ship.208": "Colony Ship",
    "ship.209": "Recycler",
    "ship.210": "Espionage Probe",
    "ship.211": "Bomber",
    "ship.212": "Solar Satellite",
    "ship.213": "Destroyer",
    "ship.214": "Deathstar",
    "ship.215": "Battlecruiser",
    "ship.217": "Crawler",
    "ship.218": "Reaper",
    "ship.219": "Pathfinder",
    "msg.return": "Expedition return",
    "bar.dash": "Dashboard",
    "bar.perDay": "/d",
    "bar.dashHint": "production per day in MSU",
    "bar.plan": "Plan \xB7 {n}",
    "bar.planEmpty": "Plan",
    "bar.ready": "Ready",
    "bar.planHint": "what the account still misses, in MSU, resources on the way included",
    "bar.journal": "Today",
    "bar.journalHint": "{n} expeditions today, net gain in MSU",
    "dash.tab.summary": "Summary",
    "dash.tab.mines": "Mines",
    "dash.tab.facilities": "Facilities",
    "dash.tab.lifeforms": "Lifeforms",
    "dash.tab.ships": "Ships",
    "dash.tab.defence": "Defence",
    "dash.tab.scrap": "Scrap merchant",
    "dash.prodDayK": "Daily production (MSU)",
    "dash.prodHourNote": "{value} per hour",
    "dash.fleetValue": "Fleet (MSU)",
    "dash.defValue": "Defence (MSU)",
    "dash.unitsNote": "{n} units, at full cost",
    "dash.research": "Research",
    "dash.average": "Average",
    "dash.planets": "Planets",
    "dash.moons": "Moons",
    "dash.moon": "Moon",
    "dash.minesHint": "Highest level in the account in blue. Production from the last accountInfo reading.",
    "dash.lfHint": "Each planet shows its own active technologies: buildings of its species and, per slot, the research in use. Italic research is a guess: open the planet's Lifeform Research page to read it exactly.",
    "dash.lfGuess": "Guess: open this planet's Lifeform Research page for the exact data.",
    "dash.lfNone": "No level of this species in the game data.",
    "dash.lfBuildings": "Buildings",
    "dash.lfResearch": "Research",
    "lf.1": "Humans",
    "lf.2": "Rock'tal",
    "lf.3": "Mechas",
    "lf.4": "Kaelesh",
    "dash.unitsNone": "No units in the stored data.",
    "dash.valueMsu": "Value MSU",
    "dash.scrapHint": "Calculation only: the game's scrap merchant gives back 35% of the cost, up to 75% by bargaining. You sell on the Merchant page.",
    "dash.scrapRate": "Rate",
    "dash.scrapAll": "All",
    "dash.scrapNone": "Clear",
    "dash.unit": "Unit",
    "dash.owned": "Owned",
    "dash.toScrap": "To scrap",
    "galaxy.players": "{count} players",
    "galaxy.inactive": "{count} inactive",
    "galaxy.longInactive": "{count} for 28+ days",
    "galaxy.vacation": "{count} on vacation",
    "galaxy.moons": "{count} moons",
    "galaxy.debris": "Debris {msu} MSU in {count} fields",
    "galaxy.deep": "Deep space {msu} MSU",
    "galaxy.noDebris": "No debris fields",
    "galaxy.targets": "Targets ({count})",
    "galaxy.rankTitle": "Points and ranks of {name}",
    "galaxy.score.total": "Overall",
    "galaxy.score.economy": "Economy",
    "galaxy.score.research": "Research",
    "galaxy.score.military": "Military",
    "galaxy.score.lifeform": "Lifeforms",
    "galaxy.ships": "{count} ships",
    "galaxy.loading": "Reading the public API\u2026",
    "galaxy.apiError": "Public API unreachable. Try again later.",
    "galaxy.apiAge": "Public API, {time}",
    "galaxy.own": "Yours",
    "settings.backup": "Data backup",
    "settings.backupExport": "Export",
    "settings.backupImport": "Import",
    "settings.backupSaved": "Saved {n} values to the file",
    "settings.backupRestored": "Restored {n} values: reload the page",
    "settings.backupBad": "The file is not a Future backup",
    "dash.tab.history": "History",
    "dash.historyEmpty": "The history fills itself: one point a day whenever you open the Overview. Come back tomorrow to see the first changes.",
    "dash.historySpan": "Last {n} d",
    "dash.historyPerDay": "{v}/d",
    "dash.historyUp": "\u2191{n} places",
    "dash.historyDown": "\u2193{n} places",
    "dash.historyReal": "over {n} d",
    "dash.historyFew": "few days recorded",
    "dash.historyProd": "Production per day (MSU)",
    "dash.historyDays": "Recorded days",
    "dash.historyDay": "Day",
    "dash.historyDelta": "Change",
    "dash.historyRank": "Rank",
    "spy.title": "Spy table",
    "spy.sub": "{n} targets \xB7 loot {msu} MSU",
    "spy.hideDefended": "Hide defended",
    "spy.inactiveOnly": "Inactive only",
    "spy.noSpeed": "Open the Fleet page once: Future reads the ship speeds and works out flight times and MSU per hour.",
    "spy.none": "No espionage reports in the last 3 days. Reports you open in the inbox land here by themselves.",
    "spy.noneFiltered": "No target matches these filters.",
    "spy.col.target": "Target",
    "spy.col.age": "Age",
    "spy.col.loot": "Loot MSU",
    "spy.col.ships": "Cargo",
    "spy.col.def": "Defence",
    "spy.col.rate": "MSU/hour",
    "spy.col.actions": "",
    "spy.attackHint": "Attack from {name}: opens the Fleet page with the target filled in; ships and Send stay with you",
    "spy.remove": "Remove from the table",
    "spy.hint": "One target per planet or moon, the newest report wins; kept 3 days even if you delete the reports. MSU/hour = loot divided by the round trip from your nearest planet at 100%; below, the one-way flight. OS = Osims, OT = OGame Simulator.",
    "spy.status.inactive": "i",
    "spy.status.longinactive": "I",
    "spy.status.vacation": "v",
    "spy.status.banned": "b",
    "spy.status.noob": "n",
    "spy.status.strong": "s",
    "spy.status.honorableTarget": "h",
    "spy.status.outlaw": "outlaw",
    "spy.status.admin": "admin",
    "dash.queuesTitle": "Running queues",
    "dash.queuesHint": "Bell: a message on the page when it ends.",
    "remind.add": "Remind me when it ends",
    "remind.remove": "Remove the reminder",
    "remind.now": "Now ({time})",
    "remind.late": "Ended at {time}",
    "remind.ok": "OK",
    "remind.return": "(return)",
    "spy.simGame": "Game's battle simulator",
    "spy.simOsims": "Simulate with Osims (new tab, with your combat research)",
    "spy.simOgameTools": "Simulate with OGame Simulator (new tab, with your combat research)",
    "spy.from": "From {name} [{coords}], one way at 100%",
    "msg.combat.converter": "Converter",
    "msg.combat.converterHint": "Opens the report in the Ogotcha converter (new tab)",
    "hs.days": "catch up: {n} d",
    "hs.today": "{n} points since midnight (base at {time})",
    "hs.never": "not at this pace",
    "hs.etaMine": "At your pace of the last 7 days (+{mine}/d)",
    "hs.passToday": "you pass today",
    "hs.note": "Under the points: what each player made today, from the public highscore of {time}.",
    "hs.noteWaiting": "Reading the public highscore for today's points\u2026",
    "mark.flag.watch": "Watch",
    "mark.flag.target": "Target",
    "mark.flag.farm": "Farm",
    "mark.flag.danger": "Danger",
    "mark.flag.friend": "Friend",
    "mark.flag.trade": "Trade",
    "mark.tag.red": "Red",
    "mark.tag.orange": "Orange",
    "mark.tag.yellow": "Yellow",
    "mark.tag.green": "Green",
    "mark.tag.blue": "Blue",
    "mark.tag.violet": "Violet",
    "mark.none": "Remove",
    "mark.change": "click to change, Shift+click for the last one used",
    "mark.flagAdd": "Flag the player (Shift+click: last flag)",
    "mark.tagAdd": "Colour the planet (Shift+click: last colour)",
    "marks.title": "Targets",
    "marks.sub": "{players} players \xB7 {planets} planets",
    "marks.tab.players": "Players",
    "marks.tab.planets": "Planets",
    "marks.recent": "Recent",
    "marks.noRecent": "No player opened lately.",
    "marks.noPlayers": "No player with this flag. Set it from the galaxy, the highscore or the spy table.",
    "marks.openSheet": "Open the player's sheet",
    "marks.playersHint": "Click a name: points, ranks and every planet and moon from the public API.",
    "marks.back": "Back to the list",
    "marks.write": "Write message",
    "marks.profile": "Profile",
    "marks.rank": "Highscore",
    "marks.ships": "Ships",
    "marks.planets": "Planets {n} \xB7 moons {moons}",
    "marks.from": "From",
    "marks.to": "to",
    "marks.hide.vacation": "Hide vacation",
    "marks.hide.banned": "Hide banned",
    "marks.hide.inactive": "Hide inactive",
    "marks.noneInRange": "No coloured planet in this range with these filters.",
    "marks.noPlanets": "No coloured planet. In the galaxy view use the dot to the right of the planet name.",
    "marks.planetsHint": "{n} planets \xB7 coordinates show the system in the galaxy",
    "marks.keyNext": "next position",
    "marks.footData": "galaxy + public API",
    "marks.fleetPlanet": "Fleet to planet {coords} (planet activity)",
    "marks.fleetMoon": "Fleet to moon {coords} (moon activity)",
    "marks.ago": "{n}{u}",
    "marks.unit.m": "m",
    "marks.unit.h": "h",
    "marks.unit.d": "d",
    "marks.seenOnly": "Seen in the galaxy, not in the API yet \xB7 click: show the system",
    "marks.showSystem": "Show the system in the galaxy",
    "marks.col.coords": "Coords",
    "marks.col.debris": "DF",
    "marks.col.planet": "Plan.",
    "marks.col.moon": "Moon",
    "marks.col.seen": "Seen",
    "marks.col.who": "Planet \xB7 player",
    "shortcut.nextTarget": "Targets: next position",
    "plan.lacksHere": "{n} missing here",
    "plan.clearAll": "Clear plan",
    "plan.clearConfirm": "Sure? Click again",
    "plan.account": "Account resources",
    "plan.accountNote": "all planets and moons + on the way",
    "plan.accountUnknown": "press Sync to read them",
    "plan.accountCovered": "The account covers the plan",
    "plan.accountMissing": "Account still misses",
    "plan.onBodies": "on {n} bodies",
    "plan.collapse": "Hide the planets",
    "plan.expand": "Show the planets",
    "plan.removeAll": "Remove from all {n} bodies",
    "plan.readyHere": "Enough resources here",
    "bar.targets": "Targets",
    "bar.targetsHint": "Targets side bar (flagged players and coloured planets) \xB7 M: next position"
  };

  // src/i18n/fr.json
  var fr_default = {
    "app.name": "Future",
    "sync.button": "Synchroniser le compte",
    "sync.done": "Donn\xE9es mises \xE0 jour",
    "data.missing": "Donn\xE9es manquantes sur {count} plan\xE8tes : ouvrez leur vue d'ensemble",
    "guard.refused": "Appel bloqu\xE9 pour respecter les r\xE8gles d'OGame",
    "planetMenu.moon": "Lune",
    "planetMenu.compact": "Compact",
    "res.metal": "M\xE9tal",
    "res.crystal": "Cristal",
    "res.deuterium": "Deut\xE9rium",
    "planetMenu.idle": "Aucune construction en cours",
    "planetMenu.side": "C\xF4te \xE0 c\xF4te",
    "planetMenu.toSide": "Vue c\xF4te \xE0 c\xF4te (avec ressources)",
    "planetMenu.toCompact": "Vue compacte",
    "planetMenu.noRoom": "\xC9cran trop \xE9troit pour la vue c\xF4te \xE0 c\xF4te",
    "toolbar.settings": "Param\xE8tres",
    "toolbar.lastSync": "derni\xE8re mise \xE0 jour {time}",
    "settings.view": "Vue du menu",
    "settings.totals": "Totaux des ressources",
    "settings.on": "Oui",
    "settings.off": "Non",
    "planetMenu.age": "Minutes depuis la derni\xE8re mise \xE0 jour (ouvrez la plan\xE8te pour actualiser)",
    "dash.title": "Tableau de bord",
    "dash.close": "Fermer",
    "dash.noData": "aucune donn\xE9e : appuyez sur Synchroniser",
    "dash.points": "Points",
    "dash.rank": "Rang {rank} sur {of}",
    "dash.pointsHint": "ouvrez la Vue d'ensemble pour les lire",
    "dash.stock": "Ressources (MSU)",
    "dash.stockNote": "plan\xE8tes et lunes, estimation",
    "dash.prodHour": "Production horaire (MSU)",
    "dash.prodDay": "{value} par jour",
    "dash.bodies": "Plan\xE8tes / Lunes",
    "dash.bodiesNote": "avec donn\xE9es",
    "dash.idle": "Plan\xE8tes \xE0 l'arr\xEAt",
    "dash.idleNote": "aucune construction",
    "dash.production": "Production",
    "dash.dayShort": "j",
    "dash.daysShort": "j",
    "dash.msuHint": "Barres en MSU (3:2:1) : m\xE9tal, cristal \xD71,5, deut\xE9rium \xD73.",
    "dash.checks": "\xC0 v\xE9rifier",
    "dash.allGood": "Tout va bien.",
    "dash.bodiesTable": "Plan\xE8tes et lunes",
    "dash.showMoons": "Afficher les lunes",
    "dash.hideMoons": "Masquer les lunes",
    "dash.colBody": "Corps",
    "dash.colMines": "Mines M\xB7C\xB7D",
    "dash.colProd": "MSU/jour",
    "dash.colFull": "Plein dans",
    "dash.colAge": "Donn\xE9es",
    "dash.full": "plein",
    "dash.idleTag": "arr\xEAt",
    "dash.total": "Total",
    "dash.tableHint": "Cliquez un titre pour trier. Ressources estim\xE9es depuis la derni\xE8re lecture plus la production.",
    "alert.missing": "Donn\xE9es manquantes sur {count} plan\xE8tes",
    "alert.full": "Hangars pleins sur {count} plan\xE8tes",
    "alert.soonFull": "{count} plan\xE8tes pleines d'ici 6 heures",
    "alert.idle": "{count} plan\xE8tes sans construction",
    "alert.stale": "Donn\xE9es de plus d'une heure sur {count} corps",
    "settings.markIdle": "Signaler les plan\xE8tes sans construction",
    "queue.building": "B\xE2timent",
    "queue.research": "Recherche",
    "queue.ship": "Chantier",
    "queue.lfbuilding": "B\xE2timent forme de vie",
    "queue.lfresearch": "Recherche forme de vie",
    "dash.queues": "Files actives",
    "dash.queuesNone": "aucune construction",
    "dash.queuesUnknown": "pas encore lues",
    "dash.moves": "Mines les plus rentables",
    "dash.movesNone": "Niveaux des mines requis : Synchroniser.",
    "dash.movesHint": "Jours pour rembourser le co\xFBt (MSU). Estimation sans \xE9nergie ni r\xE9ductions formes de vie.",
    "dash.colQueue": "En cours",
    "mine.metal": "Mine de m\xE9tal",
    "mine.crystal": "Mine de cristal",
    "mine.deuterium": "Synth\xE9tiseur de deut\xE9rium",
    "fleet.reserveShips": "Vaisseaux",
    "fleet.reserveRes": "Ressources",
    "fleet.noShips": "Aucun vaisseau ici.",
    "fleet.fleetsave": "Fleetsave",
    "fleet.galaxy": "Galaxie (vide = celle-ci)",
    "fleet.system": "Syst\xE8me (vide = celui-ci)",
    "fleet.position": "Position",
    "fleet.type": "Type",
    "fleet.typePlanet": "Plan\xE8te",
    "fleet.typeMoon": "Lune",
    "fleet.typeDebris": "Champ de d\xE9bris",
    "fleet.mission": "Mission",
    "fleet.speed": "Vitesse",
    "fleet.fleetsaveHint": "Galaxie et syst\xE8me vides = ceux de la plan\xE8te de d\xE9part. Sans position, fleetsave d\xE9sactiv\xE9.",
    "fleet.save": "Enregistrer",
    "fleet.saved": "Enregistr\xE9.",
    "fleet.copied": "Copi\xE9 sur {count} corps.",
    "fleet.reserve": "R\xE9serve",
    "fleet.summaryShips": "{count} vaisseaux",
    "fleet.noReserve": "Aucune r\xE9serve",
    "fleet.resMinusReserve": "Ressources \u2212 r\xE9serve",
    "fleet.resLoaded": "{cargo} ressources charg\xE9es : v\xE9rifiez et envoyez",
    "mission.1": "Attaquer",
    "mission.3": "Transporter",
    "mission.4": "Stationner",
    "mission.5": "Stationner (alli\xE9)",
    "mission.6": "Espionner",
    "mission.8": "Recycler",
    "mission.15": "Exp\xE9dition",
    "fleet.editTitlePlanet": "R\xE9serves et fleetsave de {body}",
    "fleet.editTitleMoon": "R\xE9serves et fleetsave de la lune {body}",
    "fleet.copyPlanets": "Copier sur toutes les plan\xE8tes ({count})",
    "fleet.copyMoons": "Copier sur toutes les lunes ({count})",
    "fleet.settingsTitle": "R\xE9glages flotte",
    "fleet.transportTitle": "Transports et stationnements",
    "fleet.mainShip": "Vaisseau principal",
    "fleet.secondShip": "Vaisseau secondaire (si le premier ne suffit pas)",
    "fleet.none": "Aucun",
    "fleet.expeditionTitle": "Exp\xE9ditions",
    "fleet.expeditionShip": "Vaisseau cargo",
    "fleet.bestShip": "Le meilleur disponible",
    "fleet.expeditionValue": "Fret \xE0 couvrir",
    "fleet.auto": "automatique",
    "fleet.expeditionExtras": "Ajouter 1 gros vaisseau, 1 sonde et 1 \xE9claireur",
    "fleet.expeditionHint": "Automatique = le maximum qu'une exp\xE9dition peut rapporter (classe, vitesse de l'univers, bonus de classe). Vous pouvez saisir une valeur fixe (ex. 150M) ou un pourcentage (ex. 50%).",
    "fleet.repeatTitle": "R\xE9p\xE9ter",
    "fleet.repeat": "Apr\xE8s l'envoi, ouvrir la plan\xE8te ou lune suivante d\xE9j\xE0 pr\xEAte",
    "fleet.repeatHint": "Pour Lune, Transport, Stationner, Exp\xE9dition et Fleetsave. L'envoi reste votre clic ; le tour s'arr\xEAte au retour au premier.",
    "fleet.repeatShort": "R\xE9p\xE9ter",
    "fleet.on": "oui",
    "fleet.off": "non",
    "fleet.repeatNext": "Envoy\xE9e. Passage \xE0 {body}\u2026",
    "fleet.repeatDone": "Tour termin\xE9.",
    "fleet.pickDest": "choisir la destination",
    "fleet.btn.moon": "Vers lune",
    "fleet.btn.transport": "Transport",
    "fleet.btn.deploy": "Stationner",
    "fleet.btn.expedition": "Exp\xE9dition",
    "fleet.btn.fleetsave": "Fleetsave",
    "fleet.btn.all": "Tout \u2212 r\xE9serve",
    "fleet.tip.moon": "Transporter les ressources vers la lune de cette plan\xE8te avec les cargos n\xE9cessaires",
    "fleet.tip.transport": "Transporter les ressources (moins la r\xE9serve) vers la destination choisie",
    "fleet.tip.deploy": "Stationner tous les vaisseaux (moins la r\xE9serve) avec les ressources qu'ils portent",
    "fleet.tip.expedition": "Exp\xE9dition en position 16 de ce syst\xE8me avec le meilleur vaisseau",
    "fleet.tip.fleetsave": "Pr\xE9parer le fleetsave de cette plan\xE8te ou lune",
    "fleet.tip.all": "S\xE9lectionner tous les vaisseaux moins la r\xE9serve",
    "fleet.ok.cargo": "Pr\xEAt : {ships} vaisseaux, {cargo} ressources. Appuyez sur Suivant puis Envoyer",
    "fleet.ok.ships": "{ships} vaisseaux s\xE9lectionn\xE9s",
    "fleet.ok.expedition": "Exp\xE9dition pr\xEAte : {ships} vaisseaux pour {target} de fret. Suivant puis Envoyer",
    "fleet.err.noShips": "Aucun vaisseau disponible au-del\xE0 de la r\xE9serve",
    "fleet.err.noResources": "Aucune ressource \xE0 transporter au-del\xE0 de la r\xE9serve",
    "fleet.err.noExpSlots": "Aucun emplacement d'exp\xE9dition libre",
    "fleet.err.noMoon": "Cette plan\xE8te n'a pas de lune",
    "fleet.err.noDest": "Choisissez d'abord la destination",
    "fleet.err.noFleetsave": "Aucun fleetsave d\xE9fini : ouvrez R\xE9serves et fleetsave",
    "fleet.err.notReady": "La page flotte n'est pas encore pr\xEAte, r\xE9essayez",
    "fleet.err.page1": "Revenez \xE0 la page 1 de la flotte pour ces boutons",
    "fleet.tabPlanet": "Cette plan\xE8te",
    "fleet.tabMoon": "Cette lune",
    "fleet.tabGeneral": "G\xE9n\xE9ral",
    "fleet.close": "Fermer",
    "fleet.favTitle": "Destinations favorites",
    "fleet.favTransport": "Transport vers",
    "fleet.favDeploy": "Stationner vers",
    "fleet.tip.cargo": "Charger les ressources en gardant la r\xE9serve et le deut\xE9rium du vol",
    "fleet.reserve1Title": "R\xE9serve 1 \xB7 transports et stationnements",
    "fleet.reserve1Hint": "Reste ici avec Vers lune, Transport, Stationner, Exp\xE9dition et Tout \u2212 r\xE9serve.",
    "fleet.reserve2Title": "R\xE9serve 2 \xB7 fleetsave uniquement",
    "fleet.reserve2Hint": "Reste ici uniquement avec Fleetsave. Vide = tout part.",
    "fleet.btn.last": "Derni\xE8re",
    "fleet.tip.last": "R\xE9p\xE9ter la derni\xE8re flotte : m\xEAmes vaisseaux, cible, mission et vitesse",
    "fleet.err.noLast": "Aucune flotte envoy\xE9e",
    "fleet.jumpgateKeep": "R\xE9serve 1 de cette lune",
    "shortcut.prev": "Plan\xE8te pr\xE9c\xE9dente",
    "shortcut.next": "Plan\xE8te suivante",
    "fleet.shortcutsTitle": "Raccourcis clavier",
    "tech.prev": "Niveau pr\xE9c\xE9dent",
    "tech.next": "Niveau suivant",
    "tech.reset": "Revenir au prochain niveau",
    "tech.level": "Niv. {level}",
    "tech.range": "de {from} \u2192 {to}",
    "tech.fromNow": "actuel {from}",
    "tech.colLevel": "Niv. {level}",
    "tech.colTotal": "Total",
    "tech.colMissing": "Manque",
    "tech.colOne": "Par unit\xE9",
    "tech.res.metal": "M\xE9tal",
    "tech.res.crystal": "Cristal",
    "tech.res.deuterium": "Deut\xE9rium",
    "tech.res.energy": "\xC9nergie",
    "tech.time": "Dur\xE9e",
    "tech.addOne": "Planifier niv. {level}",
    "tech.addRange": "Planifier niv. {from}\u2013{to}",
    "tech.inPlan": "Planifi\xE9 \u2713",
    "tech.addHint": "Ajoute au plan de construction de cette plan\xE8te/lune",
    "tech.removeHint": "Cliquer pour retirer ces niveaux du plan",
    "tech.discount": "R\xE9duction appliqu\xE9e par le jeu : {pct}%",
    "tech.amount": "Quantit\xE9 : {n}",
    "tech.addUnits": "Planifier \xD7{n}",
    "tech.added": "Ajout\xE9 \u2713",
    "plan.title": "Plan de construction",
    "plan.titleCount": "Plan de construction ({n})",
    "plan.sub": "Une ligne par chose \xE0 construire, ouverte sur ses plan\xE8tes. En rouge : ce qui manque sur cette plan\xE8te.",
    "plan.moonOf": "Lune de {name}",
    "plan.clear": "Vider",
    "plan.colItem": "Quoi",
    "plan.level": "niv. {level}",
    "plan.remove": "Retirer du plan",
    "plan.total": "Total",
    "plan.missingHere": "Manque ici",
    "plan.ready": "Ressources suffisantes \u2713",
    "plan.empty": "Le plan est vide. Ouvrez un b\xE2timent ou une recherche et utilisez \xAB Planifier \xBB.",
    "plan.grandTotal": "Co\xFBt total du plan",
    "plan.grandMissing": "Manque au total",
    "tech.rangeShort": "{from}\u2192{to}",
    "tech.rangeHint": "Total des niveaux {from} \xE0 {to}",
    "tech.discountShort": "\u2212{pct}%",
    "fleet.reserveOff": "R\xE9serves d\xE9sactiv\xE9es : vaisseaux et ressources en r\xE9serve partent aussi.",
    "fleet.reserveShort": "R\xE9serves",
    "fleet.reserveToggleHint": "Active ou d\xE9sactive les r\xE9serves 1 et 2 sans les effacer. Les exp\xE9ditions n'utilisent jamais la r\xE9serve.",
    "fleet.foodShort": "Ignorer la nourriture",
    "fleet.foodHint": "La nourriture reste sur la plan\xE8te dans chaque flotte, m\xEAme avec les boutons du jeu.",
    "fleet.err.noDelivery": "Aucune livraison du plan en cours.",
    "fleet.ok.delivery": "Livraison pr\xEAte : {ships} vaisseaux avec {cargo} ressources (il manquait {left}). Appuyez sur Suivant puis Envoyer.",
    "tech.timeHint": "Dur\xE9e du niv. {level} \xB7 total de {from} \xE0 {to}",
    "tech.amountHint": "Quantit\xE9 \xE0 planifier : m\xEAme plus que ce que vous pouvez payer maintenant",
    "plan.items": "{n} \xE9l\xE9ments",
    "plan.levels": "niv. {from}\u2013{to}",
    "plan.bring": "Amener les ressources ici",
    "plan.bringHint": "Ouvre la flotte sur la plan\xE8te suivante avec un transport de ce qui manque vers ici. Apr\xE8s chaque envoi, passe \xE0 la plan\xE8te suivante jusqu'\xE0 ce que rien ne manque.",
    "plan.unknownHere": "Ressources ici inconnues : appuyez sur Actualiser",
    "plan.complete": "Compl\xE9ter l'envoi",
    "plan.sentArriving": "Envoy\xE9es \xB7 arriv\xE9e {time}",
    "plan.sentArrived": "Envoy\xE9es \xB7 arriv\xE9es (pas encore lues)",
    "plan.missingAfterSent": "Manque encore",
    "plan.allSent": "Tout envoy\xE9 \u2713",
    "msg.out.resource": "Ressources",
    "msg.out.darkmatter": "Antimati\xE8re",
    "msg.out.ship": "Vaisseaux",
    "msg.out.nothing": "Rien",
    "msg.out.trader": "Marchand",
    "msg.out.item": "Objet",
    "msg.out.blackhole": "Trou noir",
    "msg.out.early": "Retour anticip\xE9",
    "msg.out.late": "Retard",
    "msg.out.pirate": "Pirates",
    "msg.out.alien": "Aliens",
    "msg.out.artefact": "Artefacts",
    "msg.out.lifeform": "Exp\xE9rience forme de vie",
    "msg.out.unknown": "Autre",
    "msg.size.0": "\xC9norme",
    "msg.size.1": "Grand",
    "msg.size.2": "Normal",
    "msg.depletion": "\xC9puisement {n}",
    "msg.discovery": "D\xE9couverte",
    "msg.lfXp": "+{n} XP",
    "msg.artefacts": "{n} artefacts",
    "msg.msuHint": "Valeur en unit\xE9s m\xE9tal (1 cristal = 1,5, 1 deut\xE9rium = 3)",
    "msg.toggle": "Clic : afficher ou masquer le texte du jeu",
    "msg.res.metal": "M\xE9tal",
    "msg.res.crystal": "Cristal",
    "msg.res.deuterium": "Deut\xE9rium",
    "msg.res.food": "Nourriture",
    "msg.res.darkMatter": "Antimati\xE8re",
    "msg.spy.loot": "Butin",
    "msg.spy.cargo": "{n}\xD7 {ship}",
    "msg.spy.fleet": "Flotte",
    "msg.spy.def": "D\xE9fense",
    "msg.spy.active": "Actif maintenant",
    "msg.spy.activity": "Actif il y a {n} min",
    "msg.spy.inactive": "Aucune activit\xE9",
    "msg.spy.counter": "Espionn\xE9 par {name} [{coords}]",
    "msg.spy.attacked": "D\xE9j\xE0 attaqu\xE9",
    "msg.transport": "Livraison",
    "msg.deploy": "Flotte arriv\xE9e",
    "msg.recycle": "Recyclage",
    "msg.empty": "Sans ressources",
    "msg.debrisLeft": "Reste {n}",
    "msg.combat.won": "Gagn\xE9e",
    "msg.combat.lost": "Perdue",
    "msg.combat.draw": "\xC9galit\xE9",
    "msg.combat.unknown": "Combat",
    "msg.combat.loot": "Butin",
    "msg.combat.raided": "Pill\xE9",
    "msg.combat.losses": "Pertes",
    "msg.combat.debris": "D\xE9bris",
    "exp.title": "Journal des exp\xE9ditions",
    "exp.sub": "D'apr\xE8s les rapports d'exp\xE9dition ouverts dans la messagerie : aucune requ\xEAte au serveur",
    "exp.period.today": "Aujourd'hui",
    "exp.period.yesterday": "Hier",
    "exp.period.week": "7 jours",
    "exp.period.month": "30 jours",
    "exp.period.all": "Tout",
    "exp.empty": "Aucune exp\xE9dition : ouvrez la messagerie, Flottes \u2192 Exp\xE9ditions, et les rapports arrivent ici.",
    "exp.emptyPeriod": "Aucune exp\xE9dition sur cette p\xE9riode.",
    "exp.count": "Exp\xE9ditions",
    "exp.discoveries": "+ {n} d\xE9couvertes",
    "exp.resources": "Ressources",
    "exp.dm": "Antimati\xE8re",
    "exp.shipsFound": "Vaisseaux trouv\xE9s",
    "exp.lost": "Vaisseaux perdus",
    "exp.net": "Gain net",
    "exp.average": "Moyenne par exp\xE9dition",
    "exp.lfXp": "Exp\xE9rience FV",
    "exp.outcomes": "R\xE9sultats",
    "exp.ships": "Vaisseaux",
    "exp.byDay": "Jour par jour",
    "exp.day": "Jour",
    "exp.countShort": "Nb",
    "exp.dmShort": "AM",
    "exp.shipsShort": "Vaisseaux (MSU)",
    "exp.fold": "Dans la messagerie, replier le texte du jeu sous le r\xE9sum\xE9",
    "exp.export": "Exporter",
    "exp.exportHint": "T\xE9l\xE9charger le journal en JSON (sauvegarde)",
    "exp.clear": "Vider",
    "exp.clearConfirm": "Cliquez encore pour tout effacer",
    "ship.202": "Petit transporteur",
    "ship.203": "Grand transporteur",
    "ship.204": "Chasseur l\xE9ger",
    "ship.205": "Chasseur lourd",
    "ship.206": "Croiseur",
    "ship.207": "Vaisseau de bataille",
    "ship.208": "Vaisseau de colonisation",
    "ship.209": "Recycleur",
    "ship.210": "Sonde d'espionnage",
    "ship.211": "Bombardier",
    "ship.212": "Satellite solaire",
    "ship.213": "Destructeur",
    "ship.214": "\xC9toile de la mort",
    "ship.215": "Traqueur",
    "ship.217": "Foreuse",
    "ship.218": "Faucheur",
    "ship.219": "\xC9claireur",
    "msg.return": "Retour d'exp\xE9dition",
    "bar.dash": "Tableau",
    "bar.perDay": "/j",
    "bar.dashHint": "production par jour en MSU",
    "bar.plan": "Plan \xB7 {n}",
    "bar.planEmpty": "Plan",
    "bar.ready": "Pr\xEAt",
    "bar.planHint": "ce qui manque au compte, en MSU, ressources en route comprises",
    "bar.journal": "Aujourd'hui",
    "bar.journalHint": "{n} exp\xE9ditions aujourd'hui, gain net en MSU",
    "dash.tab.summary": "R\xE9sum\xE9",
    "dash.tab.mines": "Mines",
    "dash.tab.facilities": "Installations",
    "dash.tab.lifeforms": "Formes de vie",
    "dash.tab.ships": "Vaisseaux",
    "dash.tab.defence": "D\xE9fense",
    "dash.tab.scrap": "Ferrailleur",
    "dash.prodDayK": "Production par jour (MSU)",
    "dash.prodHourNote": "{value} par heure",
    "dash.fleetValue": "Flotte (MSU)",
    "dash.defValue": "D\xE9fense (MSU)",
    "dash.unitsNote": "{n} unit\xE9s, au co\xFBt plein",
    "dash.research": "Recherches",
    "dash.average": "Moyenne",
    "dash.planets": "Plan\xE8tes",
    "dash.moons": "Lunes",
    "dash.moon": "Lune",
    "dash.minesHint": "En bleu, le niveau le plus haut du compte. Production depuis la derni\xE8re lecture d'accountInfo.",
    "dash.lfHint": "Chaque plan\xE8te montre ses propres technologies actives : b\xE2timents de son esp\xE8ce et, par emplacement, la recherche utilis\xE9e. Les recherches en italique sont estim\xE9es : ouvrez la page Recherche formes de vie de la plan\xE8te pour les lire exactement.",
    "dash.lfGuess": "Estimation : ouvrez la page Recherche formes de vie de cette plan\xE8te pour la donn\xE9e exacte.",
    "dash.lfNone": "Aucun niveau de cette esp\xE8ce dans les donn\xE9es du jeu.",
    "dash.lfBuildings": "B\xE2timents",
    "dash.lfResearch": "Recherches",
    "lf.1": "Humains",
    "lf.2": "Rock'tal",
    "lf.3": "M\xE9cas",
    "lf.4": "Kaelesh",
    "dash.unitsNone": "Aucune unit\xE9 dans les donn\xE9es.",
    "dash.valueMsu": "Valeur MSU",
    "dash.scrapHint": "Calcul uniquement : le ferrailleur rend 35 % du co\xFBt, jusqu'\xE0 75 % en n\xE9gociant. La vente se fait sur la page du Marchand.",
    "dash.scrapRate": "Taux",
    "dash.scrapAll": "Tout",
    "dash.scrapNone": "Vider",
    "dash.unit": "Unit\xE9",
    "dash.owned": "Pr\xE9sents",
    "dash.toScrap": "\xC0 ferrailler",
    "galaxy.players": "{count} joueurs",
    "galaxy.inactive": "{count} inactifs",
    "galaxy.longInactive": "dont {count} depuis 28 jours",
    "galaxy.vacation": "{count} en vacances",
    "galaxy.moons": "{count} lunes",
    "galaxy.debris": "D\xE9bris {msu} MSU dans {count} champs",
    "galaxy.deep": "Espace lointain {msu} MSU",
    "galaxy.noDebris": "Aucun champ de d\xE9bris",
    "galaxy.targets": "Cibles ({count})",
    "galaxy.rankTitle": "Points et classements de {name}",
    "galaxy.score.total": "G\xE9n\xE9ral",
    "galaxy.score.economy": "\xC9conomie",
    "galaxy.score.research": "Recherche",
    "galaxy.score.military": "Militaire",
    "galaxy.score.lifeform": "Formes de vie",
    "galaxy.ships": "{count} vaisseaux",
    "galaxy.loading": "Lecture de l'API publique\u2026",
    "galaxy.apiError": "API publique injoignable. R\xE9essayez plus tard.",
    "galaxy.apiAge": "API publique, {time}",
    "galaxy.own": "\xC0 vous",
    "settings.backup": "Sauvegarde des donn\xE9es",
    "settings.backupExport": "Exporter",
    "settings.backupImport": "Importer",
    "settings.backupSaved": "{n} valeurs enregistr\xE9es dans le fichier",
    "settings.backupRestored": "{n} valeurs restaur\xE9es : rechargez la page",
    "settings.backupBad": "Ce fichier n'est pas une sauvegarde de Future",
    "dash.tab.history": "Historique",
    "dash.historyEmpty": "L'historique se remplit tout seul : un point par jour chaque fois que vous ouvrez la Vue d'ensemble. Revenez demain pour voir les premi\xE8res variations.",
    "dash.historySpan": "{n} derniers j",
    "dash.historyPerDay": "{v}/j",
    "dash.historyUp": "\u2191{n} places",
    "dash.historyDown": "\u2193{n} places",
    "dash.historyReal": "sur {n} j",
    "dash.historyFew": "peu de jours enregistr\xE9s",
    "dash.historyProd": "Production par jour (MSU)",
    "dash.historyDays": "Jours enregistr\xE9s",
    "dash.historyDay": "Jour",
    "dash.historyDelta": "Variation",
    "dash.historyRank": "Classement",
    "spy.title": "Tableau d'espionnage",
    "spy.sub": "{n} cibles \xB7 butin {msu} MSU",
    "spy.hideDefended": "Masquer les d\xE9fendus",
    "spy.inactiveOnly": "Inactifs seulement",
    "spy.noSpeed": "Ouvrez une fois la page Flotte : Future lit la vitesse des vaisseaux et calcule les temps de vol et les MSU par heure.",
    "spy.none": "Aucun rapport d'espionnage ces 3 derniers jours. Les rapports ouverts dans la messagerie arrivent ici tout seuls.",
    "spy.noneFiltered": "Aucune cible avec ces filtres.",
    "spy.col.target": "Cible",
    "spy.col.age": "\xC2ge",
    "spy.col.loot": "Butin MSU",
    "spy.col.ships": "Cargos",
    "spy.col.def": "D\xE9fense",
    "spy.col.rate": "MSU/heure",
    "spy.col.actions": "",
    "spy.attackHint": "Attaquer depuis {name} : ouvre la page Flotte avec la cible remplie ; vaisseaux et envoi restent \xE0 vous",
    "spy.remove": "Retirer du tableau",
    "spy.hint": "Une cible par plan\xE8te ou lune, le rapport le plus r\xE9cent l'emporte ; gard\xE9s 3 jours m\xEAme si vous supprimez les rapports. MSU/heure = butin divis\xE9 par l'aller-retour depuis votre plan\xE8te la plus proche \xE0 100 % ; dessous, l'aller. OS = Osims, OT = OGame Simulator.",
    "spy.status.inactive": "i",
    "spy.status.longinactive": "I",
    "spy.status.vacation": "v",
    "spy.status.banned": "b",
    "spy.status.noob": "d",
    "spy.status.strong": "f",
    "spy.status.honorableTarget": "h",
    "spy.status.outlaw": "hors-la-loi",
    "spy.status.admin": "admin",
    "dash.queuesTitle": "Files en cours",
    "dash.queuesHint": "Cloche : un message sur la page \xE0 la fin.",
    "remind.add": "Me pr\xE9venir \xE0 la fin",
    "remind.remove": "Retirer le rappel",
    "remind.now": "Maintenant ({time})",
    "remind.late": "Termin\xE9 \xE0 {time}",
    "remind.ok": "OK",
    "remind.return": "(retour)",
    "spy.simGame": "Simulateur du jeu",
    "spy.simOsims": "Simuler avec Osims (nouvel onglet, avec vos recherches de combat)",
    "spy.simOgameTools": "Simuler avec OGame Simulator (nouvel onglet, avec vos recherches de combat)",
    "spy.from": "Depuis {name} [{coords}], aller \xE0 100 %",
    "msg.combat.converter": "Convertisseur",
    "msg.combat.converterHint": "Ouvre le rapport dans le convertisseur Ogotcha (nouvel onglet)",
    "hs.days": "rattrap\xE9 en {n} j",
    "hs.today": "{n} points depuis minuit (base \xE0 {time})",
    "hs.never": "pas \xE0 ce rythme",
    "hs.etaMine": "\xC0 votre rythme des 7 derniers jours (+{mine}/j)",
    "hs.passToday": "d\xE9pass\xE9 aujourd'hui",
    "hs.note": "Sous les points : ce que chaque joueur a fait aujourd'hui, d'apr\xE8s le classement public de {time}.",
    "hs.noteWaiting": "Lecture du classement public pour les points du jour\u2026",
    "mark.flag.watch": "\xC0 surveiller",
    "mark.flag.target": "Cible",
    "mark.flag.farm": "Ferme",
    "mark.flag.danger": "Danger",
    "mark.flag.friend": "Ami",
    "mark.flag.trade": "Commerce",
    "mark.tag.red": "Rouge",
    "mark.tag.orange": "Orange",
    "mark.tag.yellow": "Jaune",
    "mark.tag.green": "Vert",
    "mark.tag.blue": "Bleu",
    "mark.tag.violet": "Violet",
    "mark.none": "Retirer",
    "mark.change": "clic pour changer, Maj+clic pour le dernier utilis\xE9",
    "mark.flagAdd": "Marquer le joueur (Maj+clic : dernier drapeau)",
    "mark.tagAdd": "Colorer la plan\xE8te (Maj+clic : derni\xE8re couleur)",
    "marks.title": "Cibles",
    "marks.sub": "{players} joueurs \xB7 {planets} plan\xE8tes",
    "marks.tab.players": "Joueurs",
    "marks.tab.planets": "Plan\xE8tes",
    "marks.recent": "R\xE9cents",
    "marks.noRecent": "Aucun joueur ouvert r\xE9cemment.",
    "marks.noPlayers": "Aucun joueur avec ce drapeau. Ajoutez-le depuis la galaxie, le classement ou le tableau d'espionnage.",
    "marks.openSheet": "Ouvrir la fiche du joueur",
    "marks.playersHint": "Clic sur un nom : points, classements et toutes les plan\xE8tes et lunes depuis l'API publique.",
    "marks.back": "Retour \xE0 la liste",
    "marks.write": "\xC9crire un message",
    "marks.profile": "Profil",
    "marks.rank": "Classement",
    "marks.ships": "Vaisseaux",
    "marks.planets": "Plan\xE8tes {n} \xB7 lunes {moons}",
    "marks.from": "De",
    "marks.to": "\xE0",
    "marks.hide.vacation": "Masquer vacances",
    "marks.hide.banned": "Masquer bannis",
    "marks.hide.inactive": "Masquer inactifs",
    "marks.noneInRange": "Aucune plan\xE8te color\xE9e dans cette zone avec ces filtres.",
    "marks.noPlanets": "Aucune plan\xE8te color\xE9e. Dans la galaxie, utilisez le point \xE0 droite du nom de la plan\xE8te.",
    "marks.planetsHint": "{n} plan\xE8tes \xB7 les coordonn\xE9es affichent le syst\xE8me en galaxie",
    "marks.keyNext": "position suivante",
    "marks.footData": "galaxie + API publique",
    "marks.fleetPlanet": "Flotte vers la plan\xE8te {coords} (activit\xE9 de la plan\xE8te)",
    "marks.fleetMoon": "Flotte vers la lune {coords} (activit\xE9 de la lune)",
    "marks.ago": "{n}{u}",
    "marks.unit.m": "m",
    "marks.unit.h": "h",
    "marks.unit.d": "j",
    "marks.seenOnly": "Vue en galaxie, pas encore dans l'API \xB7 clic : afficher le syst\xE8me",
    "marks.showSystem": "Afficher le syst\xE8me en galaxie",
    "marks.col.coords": "Coord.",
    "marks.col.debris": "CDR",
    "marks.col.planet": "Plan.",
    "marks.col.moon": "Lune",
    "marks.col.seen": "Vu",
    "marks.col.who": "Plan\xE8te \xB7 joueur",
    "shortcut.nextTarget": "Cibles : position suivante",
    "plan.lacksHere": "il manque {n} ici",
    "plan.clearAll": "Vider le plan",
    "plan.clearConfirm": "S\xFBr ? Cliquez encore",
    "plan.account": "Ressources du compte",
    "plan.accountNote": "toutes les plan\xE8tes et lunes + en route",
    "plan.accountUnknown": "appuyez sur Actualiser",
    "plan.accountCovered": "Le compte couvre le plan",
    "plan.accountMissing": "Manque au compte",
    "plan.onBodies": "sur {n} corps",
    "plan.collapse": "Masquer les plan\xE8tes",
    "plan.expand": "Afficher les plan\xE8tes",
    "plan.removeAll": "Retirer des {n} corps",
    "plan.readyHere": "Ressources suffisantes ici",
    "bar.targets": "Cibles",
    "bar.targetsHint": "Barre lat\xE9rale des cibles (joueurs marqu\xE9s et plan\xE8tes color\xE9es) \xB7 M : position suivante"
  };

  // src/i18n/de.json
  var de_default = {
    "app.name": "Future",
    "sync.button": "Kontodaten synchronisieren",
    "sync.done": "Daten aktualisiert",
    "data.missing": "Fehlende Daten auf {count} Planeten: \xF6ffne ihre \xDCbersicht",
    "guard.refused": "Aufruf blockiert, um die OGame-Regeln einzuhalten",
    "planetMenu.moon": "Mond",
    "planetMenu.compact": "Kompakt",
    "res.metal": "Metall",
    "res.crystal": "Kristall",
    "res.deuterium": "Deuterium",
    "planetMenu.idle": "Kein Bau im Gange",
    "planetMenu.side": "Nebeneinander",
    "planetMenu.toSide": "Ansicht nebeneinander (mit Rohstoffen)",
    "planetMenu.toCompact": "Kompakte Ansicht",
    "planetMenu.noRoom": "Bildschirm zu schmal f\xFCr die Ansicht nebeneinander",
    "toolbar.settings": "Einstellungen",
    "toolbar.lastSync": "letzte Aktualisierung {time}",
    "settings.view": "Men\xFCansicht",
    "settings.totals": "Rohstoffsummen",
    "settings.on": "An",
    "settings.off": "Aus",
    "planetMenu.age": "Minuten seit der letzten Aktualisierung (Planeten \xF6ffnen zum Aktualisieren)",
    "dash.title": "Dashboard",
    "dash.close": "Schlie\xDFen",
    "dash.noData": "keine Daten: Synchronisieren dr\xFCcken",
    "dash.points": "Punkte",
    "dash.rank": "Platz {rank} von {of}",
    "dash.pointsHint": "\xDCbersicht \xF6ffnen, um sie zu lesen",
    "dash.stock": "Rohstoffe (MSU)",
    "dash.stockNote": "Planeten und Monde, Sch\xE4tzung",
    "dash.prodHour": "St\xFCndliche Produktion (MSU)",
    "dash.prodDay": "{value} pro Tag",
    "dash.bodies": "Planeten / Monde",
    "dash.bodiesNote": "mit Daten",
    "dash.idle": "Unt\xE4tige Planeten",
    "dash.idleNote": "kein Bau im Gange",
    "dash.production": "Produktion",
    "dash.dayShort": "T",
    "dash.daysShort": "T",
    "dash.msuHint": "Balken in MSU (3:2:1): Metall, Kristall \xD71,5, Deuterium \xD73.",
    "dash.checks": "Zu pr\xFCfen",
    "dash.allGood": "Alles in Ordnung.",
    "dash.bodiesTable": "Planeten und Monde",
    "dash.showMoons": "Monde zeigen",
    "dash.hideMoons": "Monde ausblenden",
    "dash.colBody": "K\xF6rper",
    "dash.colMines": "Minen M\xB7K\xB7D",
    "dash.colProd": "MSU/Tag",
    "dash.colFull": "Voll in",
    "dash.colAge": "Daten",
    "dash.full": "voll",
    "dash.idleTag": "unt\xE4tig",
    "dash.total": "Summe",
    "dash.tableHint": "Zum Sortieren auf eine \xDCberschrift klicken. Rohstoffe gesch\xE4tzt aus letzter Lesung plus Produktion.",
    "alert.missing": "Fehlende Daten auf {count} Planeten",
    "alert.full": "Speicher voll auf {count} Planeten",
    "alert.soonFull": "{count} Planeten in 6 Stunden voll",
    "alert.idle": "{count} Planeten ohne Bau",
    "alert.stale": "Daten \xE4lter als eine Stunde auf {count} K\xF6rpern",
    "settings.markIdle": "Planeten ohne Bau markieren",
    "queue.building": "Geb\xE4ude",
    "queue.research": "Forschung",
    "queue.ship": "Werft",
    "queue.lfbuilding": "Lebensform-Geb\xE4ude",
    "queue.lfresearch": "Lebensform-Forschung",
    "dash.queues": "Aktive Auftr\xE4ge",
    "dash.queuesNone": "kein Bau im Gange",
    "dash.queuesUnknown": "noch nicht gelesen",
    "dash.moves": "Lohnendste Minen",
    "dash.movesNone": "Minenstufen n\xF6tig: Synchronisieren.",
    "dash.movesHint": "Tage bis zur Amortisation (MSU). Sch\xE4tzung ohne Energie und Lebensform-Rabatte.",
    "dash.colQueue": "L\xE4uft",
    "mine.metal": "Metallmine",
    "mine.crystal": "Kristallmine",
    "mine.deuterium": "Deuteriumsynthetisierer",
    "fleet.reserveShips": "Schiffe",
    "fleet.reserveRes": "Rohstoffe",
    "fleet.noShips": "Keine Schiffe hier.",
    "fleet.fleetsave": "Fleetsave",
    "fleet.galaxy": "Galaxie (leer = diese)",
    "fleet.system": "System (leer = dieses)",
    "fleet.position": "Position",
    "fleet.type": "Typ",
    "fleet.typePlanet": "Planet",
    "fleet.typeMoon": "Mond",
    "fleet.typeDebris": "Tr\xFCmmerfeld",
    "fleet.mission": "Auftrag",
    "fleet.speed": "Geschwindigkeit",
    "fleet.fleetsaveHint": "Galaxie und System leer = die des Startplaneten. Ohne Position ist Fleetsave aus.",
    "fleet.save": "Speichern",
    "fleet.saved": "Gespeichert.",
    "fleet.copied": "Auf {count} K\xF6rper kopiert.",
    "fleet.reserve": "Reserve",
    "fleet.summaryShips": "{count} Schiffe",
    "fleet.noReserve": "Keine Reserve",
    "fleet.resMinusReserve": "Rohstoffe \u2212 Reserve",
    "fleet.resLoaded": "{cargo} Rohstoffe geladen: pr\xFCfen und senden",
    "mission.1": "Angreifen",
    "mission.3": "Transport",
    "mission.4": "Stationieren",
    "mission.5": "Halten",
    "mission.6": "Spionage",
    "mission.8": "Abbau",
    "mission.15": "Expedition",
    "fleet.editTitlePlanet": "Reserven und Fleetsave von {body}",
    "fleet.editTitleMoon": "Reserven und Fleetsave des Mondes {body}",
    "fleet.copyPlanets": "Auf alle Planeten kopieren ({count})",
    "fleet.copyMoons": "Auf alle Monde kopieren ({count})",
    "fleet.settingsTitle": "Flotteneinstellungen",
    "fleet.transportTitle": "Transporte und Stationierungen",
    "fleet.mainShip": "Hauptschiff",
    "fleet.secondShip": "Zweitschiff (wenn das erste nicht reicht)",
    "fleet.none": "Keins",
    "fleet.expeditionTitle": "Expeditionen",
    "fleet.expeditionShip": "Frachtschiff",
    "fleet.bestShip": "Bestes verf\xFCgbares",
    "fleet.expeditionValue": "Abzudeckende Ladung",
    "fleet.auto": "automatisch",
    "fleet.expeditionExtras": "1 gro\xDFes Schiff, 1 Sonde und 1 Pathfinder dazu",
    "fleet.expeditionHint": "Automatisch = das Maximum, das eine Expedition bringen kann (Klasse, Universumsgeschwindigkeit, Klassenbonus). Du kannst einen festen Wert (z. B. 150M) oder Prozent (z. B. 50%) eingeben.",
    "fleet.repeatTitle": "Wiederholen",
    "fleet.repeat": "Nach dem Senden den n\xE4chsten Planeten oder Mond vorbereitet \xF6ffnen",
    "fleet.repeatHint": "F\xFCr Mond, Transport, Stationieren, Expedition und Fleetsave. Senden bleibt dein Klick; die Runde endet beim ersten.",
    "fleet.repeatShort": "Wiederholen",
    "fleet.on": "an",
    "fleet.off": "aus",
    "fleet.repeatNext": "Gesendet. Weiter zu {body}\u2026",
    "fleet.repeatDone": "Runde abgeschlossen.",
    "fleet.pickDest": "Ziel w\xE4hlen",
    "fleet.btn.moon": "Zum Mond",
    "fleet.btn.transport": "Transport",
    "fleet.btn.deploy": "Stationieren",
    "fleet.btn.expedition": "Expedition",
    "fleet.btn.fleetsave": "Fleetsave",
    "fleet.btn.all": "Alle \u2212 Reserve",
    "fleet.tip.moon": "Rohstoffe mit den n\xF6tigen Frachtern auf den Mond dieses Planeten bringen",
    "fleet.tip.transport": "Rohstoffe (minus Reserve) zum gew\xE4hlten Ziel transportieren",
    "fleet.tip.deploy": "Alle Schiffe (minus Reserve) mit ihrer Ladung stationieren",
    "fleet.tip.expedition": "Expedition auf Position 16 dieses Systems mit dem besten Schiff",
    "fleet.tip.fleetsave": "Fleetsave dieses Planeten oder Mondes vorbereiten",
    "fleet.tip.all": "Alle Schiffe minus Reserve ausw\xE4hlen",
    "fleet.ok.cargo": "Bereit: {ships} Schiffe, {cargo} Rohstoffe. Weiter und Flotte senden dr\xFCcken",
    "fleet.ok.ships": "{ships} Schiffe ausgew\xE4hlt",
    "fleet.ok.expedition": "Expedition bereit: {ships} Schiffe f\xFCr {target} Ladung. Weiter und Senden",
    "fleet.err.noShips": "Keine Schiffe \xFCber die Reserve hinaus",
    "fleet.err.noResources": "Keine Rohstoffe \xFCber die Reserve hinaus",
    "fleet.err.noExpSlots": "Kein freier Expeditionsslot",
    "fleet.err.noMoon": "Dieser Planet hat keinen Mond",
    "fleet.err.noDest": "Zuerst ein Ziel w\xE4hlen",
    "fleet.err.noFleetsave": "Kein Fleetsave gesetzt: Reserven und Fleetsave \xF6ffnen",
    "fleet.err.notReady": "Flottenseite noch nicht bereit, nochmal versuchen",
    "fleet.err.page1": "F\xFCr diese Kn\xF6pfe zur\xFCck zu Flottenseite 1",
    "fleet.tabPlanet": "Dieser Planet",
    "fleet.tabMoon": "Dieser Mond",
    "fleet.tabGeneral": "Allgemein",
    "fleet.close": "Schlie\xDFen",
    "fleet.favTitle": "Lieblingsziele",
    "fleet.favTransport": "Transport nach",
    "fleet.favDeploy": "Stationieren nach",
    "fleet.tip.cargo": "Rohstoffe laden, Reserve und Flug-Deuterium bleiben",
    "fleet.reserve1Title": "Reserve 1 \xB7 Transporte und Stationierungen",
    "fleet.reserve1Hint": "Bleibt hier bei Zum Mond, Transport, Stationieren, Expedition und Alle \u2212 Reserve.",
    "fleet.reserve2Title": "Reserve 2 \xB7 nur Fleetsave",
    "fleet.reserve2Hint": "Bleibt nur beim Fleetsave hier. Leer = alles fliegt.",
    "fleet.btn.last": "Letzte",
    "fleet.tip.last": "Letzte Flotte wiederholen: gleiche Schiffe, Ziel, Mission und Geschwindigkeit",
    "fleet.err.noLast": "Noch keine Flotte gesendet",
    "fleet.jumpgateKeep": "Reserve 1 dieses Mondes",
    "shortcut.prev": "Vorheriger Planet",
    "shortcut.next": "N\xE4chster Planet",
    "fleet.shortcutsTitle": "Tastenk\xFCrzel",
    "tech.prev": "Vorherige Stufe",
    "tech.next": "N\xE4chste Stufe",
    "tech.reset": "Zur\xFCck zur n\xE4chsten Stufe",
    "tech.level": "St. {level}",
    "tech.range": "von {from} \u2192 {to}",
    "tech.fromNow": "jetzt {from}",
    "tech.colLevel": "St. {level}",
    "tech.colTotal": "Gesamt",
    "tech.colMissing": "Fehlt",
    "tech.colOne": "Pro Einheit",
    "tech.res.metal": "Metall",
    "tech.res.crystal": "Kristall",
    "tech.res.deuterium": "Deuterium",
    "tech.res.energy": "Energie",
    "tech.time": "Dauer",
    "tech.addOne": "St. {level} planen",
    "tech.addRange": "St. {from}\u2013{to} planen",
    "tech.inPlan": "Geplant \u2713",
    "tech.addHint": "F\xFCgt zum Bauplan dieses Planeten/Mondes hinzu",
    "tech.removeHint": "Klicken, um diese Stufen aus dem Plan zu entfernen",
    "tech.discount": "Vom Spiel angewendeter Rabatt: {pct}%",
    "tech.amount": "Anzahl: {n}",
    "tech.addUnits": "\xD7{n} planen",
    "tech.added": "Hinzugef\xFCgt \u2713",
    "plan.title": "Bauplan",
    "plan.titleCount": "Bauplan ({n})",
    "plan.sub": "Eine Zeile pro Bauvorhaben, aufklappbar auf die Planeten. Rot: was auf diesem Planeten fehlt.",
    "plan.moonOf": "Mond von {name}",
    "plan.clear": "Leeren",
    "plan.colItem": "Was",
    "plan.level": "St. {level}",
    "plan.remove": "Aus dem Plan entfernen",
    "plan.total": "Gesamt",
    "plan.missingHere": "Fehlt hier",
    "plan.ready": "Genug Ressourcen \u2713",
    "plan.empty": "Der Plan ist leer. \xD6ffne ein Geb\xE4ude oder eine Forschung und nutze \u201EPlanen\u201C.",
    "plan.grandTotal": "Gesamtkosten des Plans",
    "plan.grandMissing": "Fehlt insgesamt",
    "tech.rangeShort": "{from}\u2192{to}",
    "tech.rangeHint": "Summe der Stufen {from} bis {to}",
    "tech.discountShort": "\u2212{pct}%",
    "fleet.reserveOff": "Reserven aus: auch Schiffe und Ressourcen in Reserve fliegen mit.",
    "fleet.reserveShort": "Reserven",
    "fleet.reserveToggleHint": "Schaltet Reserve 1 und 2 ein oder aus, ohne sie zu l\xF6schen. Expeditionen nutzen nie die Reserve.",
    "fleet.foodShort": "Nahrung ignorieren",
    "fleet.foodHint": "Nahrung bleibt bei jeder Flotte auf dem Planeten, auch mit den Kn\xF6pfen des Spiels.",
    "fleet.err.noDelivery": "Keine Plan-Lieferung aktiv.",
    "fleet.ok.delivery": "Lieferung bereit: {ships} Schiffe mit {cargo} Ressourcen (es fehlten {left}). Weiter und Flotte senden dr\xFCcken.",
    "tech.timeHint": "Dauer St. {level} \xB7 gesamt {from} bis {to}",
    "tech.amountHint": "Zu planende Anzahl: auch mehr, als du jetzt bezahlen kannst",
    "plan.items": "{n} Eintr\xE4ge",
    "plan.levels": "St. {from}\u2013{to}",
    "plan.bring": "Ressourcen hierher bringen",
    "plan.bringHint": "\xD6ffnet die Flotte auf dem n\xE4chsten Planeten mit einem Transport des Fehlenden hierher. Nach jedem Senden geht es zum n\xE4chsten Planeten, bis nichts mehr fehlt.",
    "plan.unknownHere": "Ressourcen hier unbekannt: Aktualisieren dr\xFCcken",
    "plan.complete": "Lieferung vervollst\xE4ndigen",
    "plan.sentArriving": "Gesendet \xB7 Ankunft {time}",
    "plan.sentArrived": "Gesendet \xB7 angekommen (noch nicht gelesen)",
    "plan.missingAfterSent": "Fehlt noch",
    "plan.allSent": "Alles gesendet \u2713",
    "msg.out.resource": "Rohstoffe",
    "msg.out.darkmatter": "Dunkle Materie",
    "msg.out.ship": "Schiffe",
    "msg.out.nothing": "Nichts",
    "msg.out.trader": "H\xE4ndler",
    "msg.out.item": "Gegenstand",
    "msg.out.blackhole": "Schwarzes Loch",
    "msg.out.early": "Fr\xFChe R\xFCckkehr",
    "msg.out.late": "Versp\xE4tung",
    "msg.out.pirate": "Piraten",
    "msg.out.alien": "Aliens",
    "msg.out.artefact": "Artefakte",
    "msg.out.lifeform": "Lebensform-Erfahrung",
    "msg.out.unknown": "Sonstiges",
    "msg.size.0": "Riesig",
    "msg.size.1": "Gro\xDF",
    "msg.size.2": "Normal",
    "msg.depletion": "Ersch\xF6pfung {n}",
    "msg.discovery": "Entdeckung",
    "msg.lfXp": "+{n} EP",
    "msg.artefacts": "{n} Artefakte",
    "msg.msuHint": "Wert in Metalleinheiten (1 Kristall = 1,5, 1 Deuterium = 3)",
    "msg.toggle": "Klick: Text des Spiels ein- oder ausblenden",
    "msg.res.metal": "Metall",
    "msg.res.crystal": "Kristall",
    "msg.res.deuterium": "Deuterium",
    "msg.res.food": "Nahrung",
    "msg.res.darkMatter": "Dunkle Materie",
    "msg.spy.loot": "Beute",
    "msg.spy.cargo": "{n}\xD7 {ship}",
    "msg.spy.fleet": "Flotte",
    "msg.spy.def": "Verteidigung",
    "msg.spy.active": "Jetzt aktiv",
    "msg.spy.activity": "Vor {n} Min. aktiv",
    "msg.spy.inactive": "Keine Aktivit\xE4t",
    "msg.spy.counter": "Spioniert von {name} [{coords}]",
    "msg.spy.attacked": "Schon angegriffen",
    "msg.transport": "Lieferung",
    "msg.deploy": "Flotte angekommen",
    "msg.recycle": "Recycling",
    "msg.empty": "Ohne Rohstoffe",
    "msg.debrisLeft": "{n} \xFCbrig",
    "msg.combat.won": "Gewonnen",
    "msg.combat.lost": "Verloren",
    "msg.combat.draw": "Unentschieden",
    "msg.combat.unknown": "Kampf",
    "msg.combat.loot": "Beute",
    "msg.combat.raided": "Gepl\xFCndert",
    "msg.combat.losses": "Verluste",
    "msg.combat.debris": "Tr\xFCmmer",
    "exp.title": "Expeditionstagebuch",
    "exp.sub": "Aus den Expeditionsberichten, die du im Postfach \xF6ffnest: keine Serveranfragen",
    "exp.period.today": "Heute",
    "exp.period.yesterday": "Gestern",
    "exp.period.week": "7 Tage",
    "exp.period.month": "30 Tage",
    "exp.period.all": "Alles",
    "exp.empty": "Noch keine Expeditionen: \xD6ffne das Postfach, Flotten \u2192 Expeditionen, dann landen die Berichte hier.",
    "exp.emptyPeriod": "Keine Expeditionen in diesem Zeitraum.",
    "exp.count": "Expeditionen",
    "exp.discoveries": "+ {n} Entdeckungen",
    "exp.resources": "Rohstoffe",
    "exp.dm": "Dunkle Materie",
    "exp.shipsFound": "Gefundene Schiffe",
    "exp.lost": "Verlorene Schiffe",
    "exp.net": "Nettogewinn",
    "exp.average": "Schnitt pro Expedition",
    "exp.lfXp": "LF-Erfahrung",
    "exp.outcomes": "Ergebnisse",
    "exp.ships": "Schiffe",
    "exp.byDay": "Tag f\xFCr Tag",
    "exp.day": "Tag",
    "exp.countShort": "Anz.",
    "exp.dmShort": "DM",
    "exp.shipsShort": "Schiffe (MSU)",
    "exp.fold": "Im Postfach den Spieltext unter der Zusammenfassung einklappen",
    "exp.export": "Exportieren",
    "exp.exportHint": "Tagebuch als JSON-Datei herunterladen (Backup)",
    "exp.clear": "Leeren",
    "exp.clearConfirm": "Nochmal klicken, um alles zu l\xF6schen",
    "ship.202": "Kleiner Transporter",
    "ship.203": "Gro\xDFer Transporter",
    "ship.204": "Leichter J\xE4ger",
    "ship.205": "Schwerer J\xE4ger",
    "ship.206": "Kreuzer",
    "ship.207": "Schlachtschiff",
    "ship.208": "Kolonieschiff",
    "ship.209": "Recycler",
    "ship.210": "Spionagesonde",
    "ship.211": "Bomber",
    "ship.212": "Solarsatellit",
    "ship.213": "Zerst\xF6rer",
    "ship.214": "Todesstern",
    "ship.215": "Schlachtkreuzer",
    "ship.217": "Crawler",
    "ship.218": "Reaper",
    "ship.219": "Pathfinder",
    "msg.return": "Expeditionsr\xFCckkehr",
    "bar.dash": "Dashboard",
    "bar.perDay": "/T",
    "bar.dashHint": "Produktion pro Tag in MSU",
    "bar.plan": "Plan \xB7 {n}",
    "bar.planEmpty": "Plan",
    "bar.ready": "Bereit",
    "bar.planHint": "was dem Konto fehlt, in MSU, inkl. unterwegs",
    "bar.journal": "Heute",
    "bar.journalHint": "{n} Expeditionen heute, Nettogewinn in MSU",
    "dash.tab.summary": "\xDCbersicht",
    "dash.tab.mines": "Minen",
    "dash.tab.facilities": "Anlagen",
    "dash.tab.lifeforms": "Lebensformen",
    "dash.tab.ships": "Schiffe",
    "dash.tab.defence": "Verteidigung",
    "dash.tab.scrap": "Schrotth\xE4ndler",
    "dash.prodDayK": "Produktion pro Tag (MSU)",
    "dash.prodHourNote": "{value} pro Stunde",
    "dash.fleetValue": "Flotte (MSU)",
    "dash.defValue": "Verteidigung (MSU)",
    "dash.unitsNote": "{n} Einheiten, voller Preis",
    "dash.research": "Forschung",
    "dash.average": "Durchschnitt",
    "dash.planets": "Planeten",
    "dash.moons": "Monde",
    "dash.moon": "Mond",
    "dash.minesHint": "Blau: h\xF6chste Stufe im Account. Produktion aus der letzten accountInfo-Abfrage.",
    "dash.lfHint": "Jeder Planet zeigt seine eigenen aktiven Technologien: Geb\xE4ude seiner Spezies und je Slot die genutzte Forschung. Kursive Forschung ist gesch\xE4tzt: \xF6ffne die Lebensform-Forschungsseite des Planeten f\xFCr den genauen Wert.",
    "dash.lfGuess": "Sch\xE4tzung: \xF6ffne die Lebensform-Forschungsseite dieses Planeten f\xFCr den genauen Wert.",
    "dash.lfNone": "Keine Stufe dieser Spezies in den Spieldaten.",
    "dash.lfBuildings": "Geb\xE4ude",
    "dash.lfResearch": "Forschung",
    "lf.1": "Menschen",
    "lf.2": "Rock'tal",
    "lf.3": "Mechas",
    "lf.4": "Kaelesh",
    "dash.unitsNone": "Keine Einheiten in den gespeicherten Daten.",
    "dash.valueMsu": "Wert MSU",
    "dash.scrapHint": "Nur Berechnung: der Schrotth\xE4ndler gibt 35 % der Kosten zur\xFCck, mit Verhandeln bis 75 %. Verkauft wird auf der H\xE4ndlerseite.",
    "dash.scrapRate": "Quote",
    "dash.scrapAll": "Alle",
    "dash.scrapNone": "Leeren",
    "dash.unit": "Einheit",
    "dash.owned": "Vorhanden",
    "dash.toScrap": "Verschrotten",
    "galaxy.players": "{count} Spieler",
    "galaxy.inactive": "{count} inaktiv",
    "galaxy.longInactive": "davon {count} seit 28 Tagen",
    "galaxy.vacation": "{count} im Urlaub",
    "galaxy.moons": "{count} Monde",
    "galaxy.debris": "Tr\xFCmmer {msu} MSU in {count} Feldern",
    "galaxy.deep": "Tiefer Raum {msu} MSU",
    "galaxy.noDebris": "Keine Tr\xFCmmerfelder",
    "galaxy.targets": "Ziele ({count})",
    "galaxy.rankTitle": "Punkte und R\xE4nge von {name}",
    "galaxy.score.total": "Gesamt",
    "galaxy.score.economy": "Wirtschaft",
    "galaxy.score.research": "Forschung",
    "galaxy.score.military": "Milit\xE4r",
    "galaxy.score.lifeform": "Lebensformen",
    "galaxy.ships": "{count} Schiffe",
    "galaxy.loading": "Lese die \xF6ffentliche API\u2026",
    "galaxy.apiError": "\xD6ffentliche API nicht erreichbar. Sp\xE4ter erneut versuchen.",
    "galaxy.apiAge": "\xD6ffentliche API, {time}",
    "galaxy.own": "Deins",
    "settings.backup": "Datensicherung",
    "settings.backupExport": "Exportieren",
    "settings.backupImport": "Importieren",
    "settings.backupSaved": "{n} Werte in der Datei gespeichert",
    "settings.backupRestored": "{n} Werte wiederhergestellt: Seite neu laden",
    "settings.backupBad": "Die Datei ist keine Future-Sicherung",
    "dash.tab.history": "Verlauf",
    "dash.historyEmpty": "Der Verlauf f\xFCllt sich von selbst: ein Punkt pro Tag, wann immer du die \xDCbersicht \xF6ffnest. Komm morgen wieder, um die ersten \xC4nderungen zu sehen.",
    "dash.historySpan": "Letzte {n} T",
    "dash.historyPerDay": "{v}/T",
    "dash.historyUp": "\u2191{n} Pl\xE4tze",
    "dash.historyDown": "\u2193{n} Pl\xE4tze",
    "dash.historyReal": "\xFCber {n} T",
    "dash.historyFew": "wenige Tage erfasst",
    "dash.historyProd": "Produktion pro Tag (MSU)",
    "dash.historyDays": "Erfasste Tage",
    "dash.historyDay": "Tag",
    "dash.historyDelta": "\xC4nderung",
    "dash.historyRank": "Platz",
    "spy.title": "Spionagetabelle",
    "spy.sub": "{n} Ziele \xB7 Beute {msu} MSU",
    "spy.hideDefended": "Verteidigte ausblenden",
    "spy.inactiveOnly": "Nur Inaktive",
    "spy.noSpeed": "\xD6ffne einmal die Flottenseite: Future liest die Schiffsgeschwindigkeiten und berechnet Flugzeiten und MSU pro Stunde.",
    "spy.none": "Keine Spionageberichte in den letzten 3 Tagen. Berichte, die du im Postfach \xF6ffnest, landen von selbst hier.",
    "spy.noneFiltered": "Kein Ziel passt zu diesen Filtern.",
    "spy.col.target": "Ziel",
    "spy.col.age": "Alter",
    "spy.col.loot": "Beute MSU",
    "spy.col.ships": "Transporter",
    "spy.col.def": "Verteid.",
    "spy.col.rate": "MSU/Stunde",
    "spy.col.actions": "",
    "spy.attackHint": "Angriff von {name}: \xF6ffnet die Flottenseite mit eingetragenem Ziel; Schiffe und Senden bleiben bei dir",
    "spy.remove": "Aus der Tabelle entfernen",
    "spy.hint": "Ein Ziel pro Planet oder Mond, der neueste Bericht gilt; 3 Tage gespeichert, auch wenn du die Berichte l\xF6schst. MSU/Stunde = Beute geteilt durch Hin- und R\xFCckflug von deinem n\xE4chsten Planeten bei 100 %; darunter der Hinflug. OS = Osims, OT = OGame Simulator.",
    "spy.status.inactive": "i",
    "spy.status.longinactive": "I",
    "spy.status.vacation": "u",
    "spy.status.banned": "g",
    "spy.status.noob": "n",
    "spy.status.strong": "s",
    "spy.status.honorableTarget": "e",
    "spy.status.outlaw": "Ge\xE4chtet",
    "spy.status.admin": "Admin",
    "dash.queuesTitle": "Laufende Auftr\xE4ge",
    "dash.queuesHint": "Glocke: eine Meldung auf der Seite, wenn es fertig ist.",
    "remind.add": "Erinnere mich, wenn es fertig ist",
    "remind.remove": "Erinnerung entfernen",
    "remind.now": "Jetzt ({time})",
    "remind.late": "Fertig um {time}",
    "remind.ok": "OK",
    "remind.return": "(R\xFCckflug)",
    "spy.simGame": "Kampfsimulator des Spiels",
    "spy.simOsims": "Mit Osims simulieren (neuer Tab, mit deiner Kampfforschung)",
    "spy.simOgameTools": "Mit OGame Simulator simulieren (neuer Tab, mit deiner Kampfforschung)",
    "spy.from": "Von {name} [{coords}], Hinflug bei 100 %",
    "msg.combat.converter": "Konverter",
    "msg.combat.converterHint": "\xD6ffnet den Bericht im Ogotcha-Konverter (neuer Tab)",
    "hs.days": "eingeholt in {n} T",
    "hs.today": "{n} Punkte seit Mitternacht (Basis {time})",
    "hs.never": "nicht bei diesem Tempo",
    "hs.etaMine": "Bei deinem Tempo der letzten 7 Tage (+{mine}/T)",
    "hs.passToday": "heute \xFCberholt",
    "hs.note": "Unter den Punkten: was jeder Spieler heute gemacht hat, laut \xF6ffentlicher Rangliste von {time}.",
    "hs.noteWaiting": "\xD6ffentliche Rangliste f\xFCr die heutigen Punkte wird gelesen\u2026",
    "mark.flag.watch": "Beobachten",
    "mark.flag.target": "Ziel",
    "mark.flag.farm": "Farm",
    "mark.flag.danger": "Gefahr",
    "mark.flag.friend": "Freund",
    "mark.flag.trade": "Handel",
    "mark.tag.red": "Rot",
    "mark.tag.orange": "Orange",
    "mark.tag.yellow": "Gelb",
    "mark.tag.green": "Gr\xFCn",
    "mark.tag.blue": "Blau",
    "mark.tag.violet": "Violett",
    "mark.none": "Entfernen",
    "mark.change": "Klick zum \xC4ndern, Umschalt+Klick f\xFCr die zuletzt benutzte",
    "mark.flagAdd": "Spieler markieren (Umschalt+Klick: letzte Flagge)",
    "mark.tagAdd": "Planet f\xE4rben (Umschalt+Klick: letzte Farbe)",
    "marks.title": "Ziele",
    "marks.sub": "{players} Spieler \xB7 {planets} Planeten",
    "marks.tab.players": "Spieler",
    "marks.tab.planets": "Planeten",
    "marks.recent": "Zuletzt",
    "marks.noRecent": "Zuletzt kein Spieler ge\xF6ffnet.",
    "marks.noPlayers": "Kein Spieler mit dieser Flagge. Setze sie in der Galaxie, der Rangliste oder der Spionagetabelle.",
    "marks.openSheet": "Spielerblatt \xF6ffnen",
    "marks.playersHint": "Klick auf einen Namen: Punkte, R\xE4nge und alle Planeten und Monde aus der \xF6ffentlichen API.",
    "marks.back": "Zur\xFCck zur Liste",
    "marks.write": "Nachricht schreiben",
    "marks.profile": "Profil",
    "marks.rank": "Rangliste",
    "marks.ships": "Schiffe",
    "marks.planets": "Planeten {n} \xB7 Monde {moons}",
    "marks.from": "Von",
    "marks.to": "bis",
    "marks.hide.vacation": "Urlaub ausblenden",
    "marks.hide.banned": "Gesperrte ausblenden",
    "marks.hide.inactive": "Inaktive ausblenden",
    "marks.noneInRange": "Kein gef\xE4rbter Planet in diesem Bereich mit diesen Filtern.",
    "marks.noPlanets": "Kein gef\xE4rbter Planet. Nutze in der Galaxie den Punkt rechts vom Planetennamen.",
    "marks.planetsHint": "{n} Planeten \xB7 Koordinaten zeigen das System in der Galaxie",
    "marks.keyNext": "n\xE4chste Position",
    "marks.footData": "Galaxie + \xF6ffentliche API",
    "marks.fleetPlanet": "Flotte zum Planeten {coords} (Aktivit\xE4t des Planeten)",
    "marks.fleetMoon": "Flotte zum Mond {coords} (Aktivit\xE4t des Mondes)",
    "marks.ago": "{n}{u}",
    "marks.unit.m": "m",
    "marks.unit.h": "h",
    "marks.unit.d": "T",
    "marks.seenOnly": "In der Galaxie gesehen, noch nicht in der API \xB7 Klick: System zeigen",
    "marks.showSystem": "System in der Galaxie zeigen",
    "marks.col.coords": "Koord.",
    "marks.col.debris": "TF",
    "marks.col.planet": "Plan.",
    "marks.col.moon": "Mond",
    "marks.col.seen": "Gesehen",
    "marks.col.who": "Planet \xB7 Spieler",
    "shortcut.nextTarget": "Ziele: n\xE4chste Position",
    "plan.lacksHere": "hier fehlen {n}",
    "plan.clearAll": "Plan leeren",
    "plan.clearConfirm": "Sicher? Nochmal klicken",
    "plan.account": "Ressourcen des Kontos",
    "plan.accountNote": "alle Planeten und Monde + unterwegs",
    "plan.accountUnknown": "Aktualisieren dr\xFCcken",
    "plan.accountCovered": "Das Konto deckt den Plan",
    "plan.accountMissing": "Dem Konto fehlen",
    "plan.onBodies": "auf {n} K\xF6rpern",
    "plan.collapse": "Planeten ausblenden",
    "plan.expand": "Planeten zeigen",
    "plan.removeAll": "Von allen {n} K\xF6rpern entfernen",
    "plan.readyHere": "Hier reichen die Ressourcen",
    "bar.targets": "Ziele",
    "bar.targetsHint": "Seitenleiste der Ziele (markierte Spieler und farbige Planeten) \xB7 M: n\xE4chste Position"
  };

  // src/core/i18n.ts
  var dictionaries = { it: it_default, en: en_default, fr: fr_default, de: de_default };
  function detectLocale(doc) {
    const lang = doc.querySelector('meta[name="ogame-ui-language"]')?.getAttribute("content") ?? doc.querySelector('meta[name="ogame-language"]')?.getAttribute("content") ?? doc.documentElement.lang;
    const short = (lang ?? "").slice(0, 2).toLowerCase();
    return short in dictionaries ? short : "en";
  }
  function translator(locale) {
    const dict = dictionaries[locale];
    return (key2, vars = {}) => {
      const text = dict[key2] ?? dictionaries.en[key2] ?? key2;
      return text.replace(/\{(\w+)\}/g, (_, name) => String(vars[name] ?? `{${name}}`));
    };
  }

  // src/data/account-info.ts
  var ACCOUNT_INFO_PATH = "/game/index.php?page=componentOnly&component=externaldataexport&action=accountInfo&asJson=1";
  var num = (v) => typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;
  var record = (v) => {
    if (!v || typeof v !== "object") return {};
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, num(x)]));
  };
  function toBody(raw, type, fetchedAt) {
    const prod = raw.production ?? {};
    const res = raw.resources ?? {};
    return {
      id: num(raw.id),
      type,
      name: typeof raw.name === "string" ? raw.name : "",
      coords: `${num(raw.galaxy)}:${num(raw.system)}:${num(raw.position)}`,
      siblingId: raw.siblingId == null ? null : num(raw.siblingId),
      production: { metal: num(prod.metal), crystal: num(prod.crystal), deuterium: num(prod.deuterium) },
      resources: { metal: num(res.metal), crystal: num(res.crystal), deuterium: num(res.deuterium) },
      storage: { metal: num(res.metalStorage), crystal: num(res.crystalStorage), deuterium: num(res.deuteriumStorage) },
      resourcesAt: fetchedAt,
      species: num(raw.selectedSpeciesId) % 10,
      levels: {
        ...record(raw.buildings),
        ...record(raw.ships),
        ...record(raw.defenses),
        ...record(raw.speciesBuildings),
        ...record(raw.speciesResearches)
      }
    };
  }
  function parseAccountInfo(json2, fetchedAt) {
    const data = json2 ?? {};
    const list = (v) => Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : [];
    return {
      fetchedAt,
      bodies: [
        ...list(data.planets).map((b) => toBody(b, "planet", fetchedAt)),
        ...list(data.moons).map((b) => toBody(b, "moon", fetchedAt))
      ],
      researches: record(data.researches)
    };
  }
  var SNAPSHOT_KEY = "account.snapshot";
  var sessionKey = (store) => `${store.namespace}:account.hydrated`;
  async function fetchAccount(deps, reason) {
    const now = deps.now ?? (() => Date.now());
    deps.session.setItem(sessionKey(deps.store), "1");
    const response = await deps.guard.request(ACCOUNT_INFO_PATH, reason);
    const text = await response.text();
    let json2;
    try {
      json2 = JSON.parse(text);
    } catch {
      throw new Error(`accountInfo: not JSON (${text.slice(0, 40).trim()})`);
    }
    const snapshot = parseAccountInfo(json2, now());
    if (!snapshot.bodies.some((b) => b.type === "planet")) throw new Error("accountInfo: no planets in the answer");
    deps.store.set(SNAPSHOT_KEY, snapshot);
    return snapshot;
  }
  async function hydrateAccountOncePerSession(deps) {
    const stored = deps.store.get(SNAPSHOT_KEY, null);
    if (deps.session.getItem(sessionKey(deps.store)) === "1") return stored;
    return fetchAccount(deps, "page-load");
  }
  function syncAccountOnUserClick(deps) {
    return fetchAccount(deps, "user-sync");
  }

  // src/data/planet-list.ts
  var idFromLink = (a) => {
    const href = a?.getAttribute("href");
    if (!href) return null;
    const cp = new URLSearchParams(href.split("?")[1] ?? "").get("cp");
    const id = Number(cp?.split("#")[0]);
    return Number.isFinite(id) && id > 0 ? id : null;
  };
  function readPlanetList(doc) {
    return Array.from(doc.querySelectorAll("#planetList .smallplanet")).map((element) => {
      const planetLink = element.querySelector("a.planetlink");
      const moonLink = element.querySelector("a.moonlink");
      const coords = (element.querySelector(".planet-koords")?.textContent ?? "").replace(/[[\]\s]/g, "");
      const current2 = element.classList.contains("hightlightMoon") ? "moon" : element.classList.contains("hightlightPlanet") ? "planet" : null;
      return {
        element,
        planetLink,
        moonLink,
        planetId: idFromLink(planetLink),
        moonId: idFromLink(moonLink),
        name: element.querySelector(".planet-name")?.textContent?.trim() ?? "",
        coords,
        current: current2,
        construction: {
          planet: element.querySelector("a.constructionIcon:not(.moon)"),
          moon: element.querySelector("a.constructionIcon.moon")
        }
      };
    });
  }
  function readCurrentResources(doc) {
    const raw = (id) => {
      const el5 = doc.getElementById(id);
      const value = el5?.getAttribute("data-raw") ?? el5?.textContent?.replace(/\D/g, "");
      const n = Number(value);
      return value != null && value !== "" && Number.isFinite(n) ? n : null;
    };
    const metal = raw("resources_metal");
    const crystal = raw("resources_crystal");
    const deuterium = raw("resources_deuterium");
    return metal == null || crystal == null || deuterium == null ? null : { metal, crystal, deuterium };
  }
  function currentBodyId(doc) {
    const id = Number(doc.querySelector('meta[name="ogame-planet-id"]')?.getAttribute("content"));
    return Number.isFinite(id) && id > 0 ? id : null;
  }

  // src/engines/resources.ts
  var KEYS = ["metal", "crystal", "deuterium"];
  function estimateResources(body, now) {
    const seconds = Math.max(0, (now - body.resourcesAt) / 1e3);
    const out = { metal: 0, crystal: 0, deuterium: 0 };
    for (const key2 of KEYS) {
      const start = body.resources[key2];
      const grown = body.type === "planet" ? start + body.production[key2] * seconds / 3600 : start;
      const cap = effectiveStorage(body)[key2];
      out[key2] = cap > 0 ? Math.max(start, Math.min(grown, cap)) : grown;
    }
    return out;
  }
  function storageCapacity(level2) {
    return 5e3 * Math.floor(2.5 * Math.exp(20 * level2 / 33));
  }
  var STORAGE_BUILDING = { metal: "22", crystal: "23", deuterium: "24" };
  function effectiveStorage(body) {
    const out = { metal: 0, crystal: 0, deuterium: 0 };
    for (const k of KEYS) {
      const level2 = body.levels[STORAGE_BUILDING[k]] ?? body.levels[`${k}Storage`];
      out[k] = body.storage[k] > 0 ? body.storage[k] : level2 !== void 0 ? storageCapacity(level2) : 0;
    }
    return out;
  }
  function storageFill(body, amount) {
    const cap = effectiveStorage(body);
    if (KEYS.every((k) => cap[k] <= 0)) return null;
    const fill = (k) => cap[k] > 0 ? Math.min(1, amount[k] / cap[k]) : 0;
    return { metal: fill("metal"), crystal: fill("crystal"), deuterium: fill("deuterium") };
  }
  function applyPageResources(snapshot, bodyId, res, now) {
    const body = snapshot.bodies.find((b) => b.id === bodyId);
    if (!body) return false;
    body.resources = { ...res };
    body.resourcesAt = now;
    return true;
  }
  function totals(snapshot, now) {
    const stock2 = { metal: 0, crystal: 0, deuterium: 0 };
    const perHour = { metal: 0, crystal: 0, deuterium: 0 };
    for (const body of snapshot.bodies) {
      const r = estimateResources(body, now);
      for (const k of KEYS) {
        stock2[k] += r[k];
        if (body.type === "planet") perHour[k] += body.production[k];
      }
    }
    return { stock: stock2, perHour };
  }

  // src/data/score.ts
  var SCORE_KEY = "account.score";
  function readScore(doc, now) {
    const text = doc.getElementById("scoreContentField")?.textContent?.trim();
    if (!text) return null;
    const numbers = (text.match(/\d[\d.,\s  ]*/g) ?? []).map((n) => Number(n.replace(/[^\d]/g, "")));
    const [points, rank, of] = numbers;
    if (points === void 0 || !Number.isFinite(points)) return null;
    return { points, rank: rank ?? null, of: of ?? null, at: now };
  }
  function watchScore(doc, now, onScore) {
    const field = doc.getElementById("scoreContentField");
    if (!field) return;
    const typed = () => /\)\s*$/.test(field.textContent ?? "");
    const seen = typed() ? readScore(doc, now()) : null;
    if (seen) return onScore(seen);
    const view = doc.defaultView;
    if (!view) return;
    const observer = new view.MutationObserver(() => {
      const score = typed() ? readScore(doc, now()) : null;
      if (!score) return;
      observer.disconnect();
      onScore(score);
    });
    observer.observe(field, { childList: true, characterData: true, subtree: true });
  }

  // src/engines/history.ts
  var HISTORY_KEY = "account.history";
  var HISTORY_MAX = 730;
  var dayKey = (at) => {
    const d = new Date(at);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  function recordDay(history, entry) {
    const day = dayKey(entry.at);
    const prev = history.find((d) => d.day === day);
    const next = { ...entry, day, prodDay: entry.prodDay || prev?.prodDay || 0, fleet: entry.fleet || prev?.fleet || 0 };
    const out = history.filter((d) => d.day !== day).concat(next).sort((a, b) => a.day < b.day ? -1 : a.day > b.day ? 1 : 0);
    return out.slice(-HISTORY_MAX);
  }
  function changeOver(history, days) {
    const last2 = history.at(-1);
    if (!last2 || history.length < 2) return null;
    const limit = last2.at - days * 864e5;
    const base = [...history].reverse().find((d) => d.at <= limit + 36e5) ?? history[0];
    if (base === last2) return null;
    const span = Math.max(1, Math.round((last2.at - base.at) / 864e5));
    return {
      days: span,
      points: last2.points - base.points,
      rank: last2.rank !== null && base.rank !== null ? base.rank - last2.rank : null,
      perDay: (last2.points - base.points) / span
    };
  }

  // src/data/server-data.ts
  var SERVER_DATA_KEY = "server.data";
  var TTL = 7 * 24 * 36e5;
  function parseServerData(xml, now) {
    const doc = new DOMParser().parseFromString(xml, "text/html");
    const root = doc.querySelector("serverdata");
    const num4 = (tag) => Number(root?.querySelector(tag)?.textContent?.trim());
    const galaxies = num4("galaxies"), systems = num4("systems");
    if (!root || !galaxies || !systems) return null;
    return {
      at: now,
      galaxies,
      systems,
      donutGalaxy: num4("donutGalaxy") === 1,
      donutSystem: num4("donutSystem") === 1,
      speedFleetWar: num4("speedFleetWar") || 1,
      speedFleetPeaceful: num4("speedFleetPeaceful") || 1
    };
  }
  async function loadServerDataOnPageLoad(deps) {
    const now = deps.now ?? Date.now();
    const cached = deps.store.get(SERVER_DATA_KEY, null);
    if (cached && now - cached.at < TTL) return cached;
    const res = await deps.guard.request(`${deps.origin}/api/serverData.xml`, "page-load");
    const fresh = res.ok ? parseServerData(await res.text(), now) : null;
    if (!fresh) return cached;
    deps.store.set(SERVER_DATA_KEY, fresh);
    return fresh;
  }

  // src/engines/marks.ts
  var FLAGS = ["watch", "target", "farm", "danger", "friend", "trade"];
  var TAGS = ["red", "orange", "yellow", "green", "blue", "violet"];
  var MARKS_KEY = "marks";
  var RECENT_MAX = 30;
  var EMPTY_MARKS = { players: {}, planets: {}, recent: [], lastFlag: "watch", lastTag: "red" };
  var loadMarks = (stored) => ({ ...EMPTY_MARKS, ...stored ?? {}, players: { ...stored?.players ?? {} }, planets: { ...stored?.planets ?? {} }, recent: [...stored?.recent ?? []] });
  function flagPlayer(m, id, name, flag, now) {
    const players = { ...m.players };
    if (flag) players[String(id)] = { flag, name: name || players[String(id)]?.name || "", at: now };
    else delete players[String(id)];
    return { ...m, players, lastFlag: flag ?? m.lastFlag };
  }
  function tagPlanet(m, coords, tag, info, now) {
    const planets = { ...m.planets };
    if (tag) planets[coords] = { ...info, tag, at: now };
    else delete planets[coords];
    return { ...m, planets, lastTag: tag ?? m.lastTag };
  }
  function rememberRecent(m, id, name) {
    return { ...m, recent: [{ id, name }, ...m.recent.filter((r) => r.id !== id)].slice(0, RECENT_MAX) };
  }
  var coordsValue = (c) => {
    const [g, s, p] = c.split(":").map(Number);
    return (g ?? 0) * 1e6 + (s ?? 0) * 1e3 + (p ?? 0);
  };
  function planetsInRange(m, from, to, filter = {}) {
    const lo = Math.min(coordsValue(`${from}:0`), coordsValue(`${to}:0`));
    const hi = Math.max(coordsValue(`${from}:999`), coordsValue(`${to}:999`));
    return Object.entries(m.planets).filter(([c, p]) => {
      const v = coordsValue(c);
      return v >= lo && v <= hi && (!filter.tags || filter.tags.includes(p.tag)) && !p.statuses.some((s) => filter.hide?.includes(s));
    }).sort((a, b) => coordsValue(a[0]) - coordsValue(b[0]));
  }
  function migrateOld(m, old) {
    if (!old.targets.length && !old.rivals.length) return null;
    let next = m;
    for (const x of old.targets) if (!next.planets[x.coords]) next = tagPlanet(next, x.coords, "red", { planet: x.planet, player: x.player, playerId: null, statuses: [], moon: false }, x.at);
    for (const r of old.rivals) if (!next.players[String(r.id)]) next = flagPlayer(next, r.id, r.name, "watch", r.at);
    return { ...next, lastFlag: m.lastFlag, lastTag: m.lastTag };
  }

  // src/engines/positions.ts
  var POSITIONS_KEY = "positions";
  var MAX = 4e3;
  function recordSystem(db, galaxy, system, rows, keep, now) {
    let next = null;
    const put = (coords, seen) => {
      next ?? (next = { ...db });
      if (seen) next[coords] = seen;
      else delete next[coords];
    };
    const byPos = new Map(rows.map((r) => [r.position, r]));
    for (let p = 1; p <= 15; p++) {
      const coords = `${galaxy}:${system}:${p}`;
      const r = byPos.get(p);
      const owner = r?.planetId && r.playerId ? r.playerId : 0;
      if (owner && (keep(owner, coords) || db[coords])) {
        put(coords, { player: owner, name: r.planetName, moon: !!r.moonId, debris: Math.round(r.debris), act: [r.activity.planet, r.moonId ? r.activity.moon : null], at: now });
      } else if (!owner && db[coords]) {
        if (db[coords].player) put(coords, { player: 0, name: "", moon: false, debris: Math.round(r?.debris ?? 0), act: [null, null], at: now });
      }
    }
    if (!next) return null;
    const all2 = next;
    const keys = Object.keys(all2);
    if (keys.length > MAX) for (const k of keys.sort((a, b) => all2[a].at - all2[b].at).slice(0, keys.length - MAX)) delete all2[k];
    return all2;
  }
  var coordsValue2 = (c) => c.split(":").reduce((s, n) => s * 1e3 + Number(n), 0);
  function planetsOf(id, api, db) {
    const out = /* @__PURE__ */ new Map();
    const apiAt = api?.updated ?? api?.at ?? 0;
    for (const p of api?.planets ?? []) {
      const seen = db[p.coords];
      if (seen && seen.player !== id && seen.at > apiAt) continue;
      out.set(p.coords, { coords: p.coords, name: seen?.player === id ? seen.name || p.name : p.name, moon: seen?.player === id && seen.at > apiAt ? seen.moon : !!p.moon, seen: seen?.player === id ? seen : null, fresh: false });
    }
    for (const [coords, seen] of Object.entries(db)) {
      if (seen.player === id && !out.has(coords)) out.set(coords, { coords, name: seen.name, moon: seen.moon, seen, fresh: true });
    }
    return [...out.values()].sort((a, b) => coordsValue2(a.coords) - coordsValue2(b.coords));
  }
  function ageParts(ms) {
    const min = Math.max(0, Math.floor(ms / 6e4));
    if (min < 60) return { n: min, unit: "m" };
    if (min < 48 * 60) return { n: Math.floor(min / 60), unit: "h" };
    return { n: Math.floor(min / 1440), unit: "d" };
  }

  // src/core/icons.ts
  var PATHS = {
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    moon: '<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>',
    eye: '<path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    warn: '<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
    farm: '<path d="M4 20.5V10l8-5.5 8 5.5v10.5z"/><path d="M9.5 20.5v-6h5v6"/>',
    user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c.8-4 3.8-6 7.5-6s6.7 2 7.5 6"/>',
    swap: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
    flag: '<path d="M5.5 21V4M5.5 4.5h11l-2.5 4 2.5 4h-11"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
    bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    target: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    back: '<path d="M19 12H5.5M11 5.5L4.5 12l6.5 6.5"/>',
    pen: '<path d="M4 20l1-4.5L16 4.5l3.5 3.5L8.5 19z"/><path d="M13.5 7l3.5 3.5"/>',
    chart: '<path d="M4 20.5h16"/><path d="M7 17v-5M12 17V6.5M17 17v-8"/>',
    planet: '<circle cx="12" cy="12" r="6"/><path d="M3 15.5c2.5 1.6 15.5-3.5 18-7"/>',
    fleet: '<path d="M3.5 12h11l5-4.5v9l-5-4.5"/><path d="M6.5 8.5L9 12l-2.5 3.5"/>'
  };
  function icon(doc, name, size = 14, cls = "fut-ico") {
    const svg2 = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg2.setAttribute("viewBox", "0 0 24 24");
    svg2.setAttribute("width", String(size));
    svg2.setAttribute("height", String(size));
    svg2.setAttribute("fill", "none");
    svg2.setAttribute("stroke", "currentColor");
    svg2.setAttribute("stroke-width", "2.2");
    svg2.setAttribute("stroke-linecap", "round");
    svg2.setAttribute("stroke-linejoin", "round");
    svg2.setAttribute("aria-hidden", "true");
    svg2.setAttribute("class", cls);
    svg2.innerHTML = PATHS[name];
    return svg2;
  }

  // src/modules/marks/picker.ts
  var FLAG_ICONS = { watch: "eye", target: "target", farm: "farm", danger: "warn", friend: "user", trade: "swap" };
  var FLAG_COLORS = { watch: "#4FD1E8", target: "#FF7A7A", farm: "#7BC47F", danger: "#F5B547", friend: "#7FB8FF", trade: "#B58CDB" };
  var TAG_COLORS = { red: "#E5484D", orange: "#F08A3C", yellow: "#E3C52B", green: "#46B35E", blue: "#3E8EDE", violet: "#9A6BD8" };
  var POP_ID = "fut-mk-pop";
  var MARKS_CSS = `
.fut-mk { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; margin: 0 2px; padding: 0;
  border: 1px solid #2E4356; border-radius: 4px; background: #0D1522; color: #4A5B72; cursor: pointer; vertical-align: middle; }
.fut-mk:hover, .fut-mk:focus-visible { border-color: #617C8D; color: #C9D4E2; outline: none; }
.fut-mk.on { border-color: currentColor; background: #0D1522; }
.fut-mk-dot { width: 9px; height: 9px; border-radius: 50%; border: 1px solid #4A5B72; }
.fut-mk.on .fut-mk-dot { border-color: transparent; }
#fut-mk-pop { position: fixed; z-index: 1000003; display: flex; gap: 3px; padding: 5px; border: 1px solid #2E4356; border-radius: 8px;
  background: #111B2A; box-shadow: 0 8px 22px rgba(0,0,0,0.55); font: 11px Verdana, Arial, sans-serif; }
#fut-mk-pop button { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; padding: 0; border: 1px solid #1F2C40;
  border-radius: 6px; background: #0A111C; color: #8A9BB0; cursor: pointer; }
#fut-mk-pop button:hover, #fut-mk-pop button:focus-visible { border-color: currentColor; outline: none; }
#fut-mk-pop button[aria-pressed="true"] { background: #12283A; border-color: currentColor; }
#fut-mk-pop .fut-mk-dot { width: 12px; height: 12px; }`;
  function ensureMarksStyle(doc) {
    if (doc.getElementById("fut-mk-style")) return;
    const style = doc.createElement("style");
    style.id = "fut-mk-style";
    style.textContent = MARKS_CSS;
    doc.head.append(style);
  }
  var readMarks = (store) => loadMarks(store.get(MARKS_KEY, null));
  function closePop(doc) {
    doc.getElementById(POP_ID)?.remove();
  }
  function openPop(doc, anchor, items) {
    closePop(doc);
    const pop = doc.createElement("div");
    pop.id = POP_ID;
    pop.setAttribute("role", "menu");
    pop.append(...items);
    doc.body.append(pop);
    const box = anchor.getBoundingClientRect();
    const view = doc.defaultView;
    pop.style.left = `${Math.max(6, Math.min(box.left - 4, (view?.innerWidth ?? 1200) - pop.offsetWidth - 6))}px`;
    pop.style.top = `${box.bottom + 4 + pop.offsetHeight > (view?.innerHeight ?? 800) ? box.top - 4 - pop.offsetHeight : box.bottom + 4}px`;
    items.find((b) => b.getAttribute("aria-pressed") === "true")?.focus() ?? items[0]?.focus();
    const away = (e) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !pop.contains(e.target)) {
        closePop(doc);
        doc.removeEventListener("mousedown", away, true);
        doc.removeEventListener("keydown", away, true);
        if (e instanceof KeyboardEvent) anchor.focus();
      }
    };
    doc.addEventListener("mousedown", away, true);
    doc.addEventListener("keydown", away, true);
  }
  function paintFlag(b, flag, t, name) {
    b.replaceChildren(icon(b.ownerDocument, flag ? FLAG_ICONS[flag] : "flag", 11));
    b.classList.toggle("on", !!flag);
    b.style.color = flag ? FLAG_COLORS[flag] : "";
    b.title = flag ? `${t(`mark.flag.${flag}`)} \xB7 ${t("mark.change")}` : t("mark.flagAdd");
    b.setAttribute("aria-label", `${b.title}: ${name}`);
  }
  function paintTag(b, tag, t, coords) {
    const dot = b.ownerDocument.createElement("span");
    dot.className = "fut-mk-dot";
    if (tag) dot.style.background = TAG_COLORS[tag];
    b.replaceChildren(dot);
    b.classList.toggle("on", !!tag);
    b.title = tag ? `${t(`mark.tag.${tag}`)} \xB7 ${t("mark.change")}` : t("mark.tagAdd");
    b.setAttribute("aria-label", `${b.title}: [${coords}]`);
  }
  var all = (root, sel) => [...root.querySelectorAll(sel)];
  function everyRoot(doc) {
    return [doc, ...[...doc.querySelectorAll('[id^="fut-"]')].map((h6) => h6.shadowRoot).filter((r) => !!r)];
  }
  function flagButton(o, id, name) {
    const { doc, store, t } = o;
    const b = doc.createElement("button");
    b.type = "button";
    b.className = "fut-mk fut-mk-flag";
    b.dataset.futFlag = String(id);
    b.setAttribute("aria-haspopup", "menu");
    paintFlag(b, readMarks(store).players[String(id)]?.flag, t, name);
    const set = (flag) => {
      const next = flagPlayer(readMarks(store), id, name, flag, Date.now());
      store.set(MARKS_KEY, next);
      for (const root of everyRoot(doc)) for (const x of all(root, `[data-fut-flag="${id}"]`)) paintFlag(x, flag ?? void 0, t, name);
      o.onChange?.();
    };
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const m = readMarks(store);
      const current2 = m.players[String(id)]?.flag;
      if (e.shiftKey) return set(current2 === m.lastFlag ? null : m.lastFlag);
      const items = [...FLAGS, null].map((flag) => {
        const it = doc.createElement("button");
        it.type = "button";
        it.setAttribute("role", "menuitemradio");
        it.setAttribute("aria-pressed", String((current2 ?? null) === flag));
        it.title = flag ? t(`mark.flag.${flag}`) : t("mark.none");
        it.setAttribute("aria-label", it.title);
        it.append(icon(doc, flag ? FLAG_ICONS[flag] : "close", 13));
        if (flag) it.style.color = FLAG_COLORS[flag];
        it.addEventListener("click", () => {
          closePop(doc);
          set(flag);
          b.focus();
        });
        return it;
      });
      openPop(doc, b, items);
    });
    return b;
  }
  function tagButton(o, coords, info) {
    const { doc, store, t } = o;
    const b = doc.createElement("button");
    b.type = "button";
    b.className = "fut-mk fut-mk-tag";
    b.dataset.futTag = coords;
    b.setAttribute("aria-haspopup", "menu");
    paintTag(b, readMarks(store).planets[coords]?.tag, t, coords);
    const set = (tag) => {
      store.set(MARKS_KEY, tagPlanet(readMarks(store), coords, tag, info, Date.now()));
      for (const root of everyRoot(doc)) for (const x of all(root, `[data-fut-tag="${coords}"]`)) paintTag(x, tag ?? void 0, t, coords);
      o.onChange?.();
    };
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const m = readMarks(store);
      const current2 = m.planets[coords]?.tag;
      if (e.shiftKey) return set(current2 === m.lastTag ? null : m.lastTag);
      const items = [...TAGS, null].map((tag) => {
        const it = doc.createElement("button");
        it.type = "button";
        it.setAttribute("role", "menuitemradio");
        it.setAttribute("aria-pressed", String((current2 ?? null) === tag));
        it.title = tag ? t(`mark.tag.${tag}`) : t("mark.none");
        it.setAttribute("aria-label", it.title);
        if (tag) {
          const dot = doc.createElement("span");
          dot.className = "fut-mk-dot";
          dot.style.background = TAG_COLORS[tag];
          dot.style.borderColor = "transparent";
          it.append(dot);
        } else it.append(icon(doc, "close", 13));
        it.addEventListener("click", () => {
          closePop(doc);
          set(tag);
          b.focus();
        });
        return it;
      });
      openPop(doc, b, items);
    });
    return b;
  }

  // src/core/format.ts
  function formatUnits(value, locale = "it") {
    const abs = Math.abs(value);
    const units = [
      [1e12, "T"],
      [1e9, "G"],
      [1e6, "M"],
      [1e3, "k"]
    ];
    for (const [size, suffix] of units) {
      if (abs >= size * 0.9995) {
        const n = value / size;
        const digits = Math.abs(n) >= 100 ? 0 : 1;
        return `${n.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })}${suffix}`;
      }
    }
    return Math.round(value).toLocaleString(locale);
  }

  // src/data/galaxy.ts
  var KNOWN = ["vacation", "banned", "longinactive", "inactive", "noob", "strong", "honorableTarget", "outlaw", "admin", "active"];
  var int = (text) => {
    const digits = (text ?? "").replace(/[^\d]/g, "");
    return digits ? Number(digits) : null;
  };
  function readDebris(container) {
    const items = [...container?.querySelectorAll(".debris-content") ?? []];
    if (!items.length) return null;
    const [metal, crystal, deuterium] = items.map((li) => int(li.textContent) ?? 0);
    const d = { metal: metal ?? 0, crystal: crystal ?? 0, deuterium: deuterium ?? 0 };
    return d.metal + d.crystal + d.deuterium > 0 ? d : null;
  }
  function statusesOf(cell) {
    const found = /* @__PURE__ */ new Set();
    for (const node of cell?.querySelectorAll('[class*="status_abbr_"]') ?? []) {
      for (const cls of node.classList) {
        const s = cls.replace("status_abbr_", "");
        if (cls.startsWith("status_abbr_") && KNOWN.includes(s)) found.add(s);
      }
    }
    if (found.size > 1) found.delete("active");
    return KNOWN.filter((s) => found.has(s));
  }
  function readActivity(cell) {
    const a = cell?.querySelector(".activity");
    if (!a) return null;
    if (a.classList.contains("minute15")) return "*";
    const min = int(a.textContent);
    return min !== null && min > 0 ? min : null;
  }
  function readGalaxy(doc) {
    const content = doc.getElementById("galaxyContent");
    if (!content) return null;
    const galaxy = int(doc.getElementById("galaxy_input")?.value);
    const system = int(doc.getElementById("system_input")?.value);
    if (!galaxy || !system) return null;
    const rows = [];
    for (const row of content.querySelectorAll(".galaxyRow.ctContentRow")) {
      const position = int(row.querySelector(".cellPosition")?.textContent);
      if (!position) continue;
      const nameCell = row.querySelector(".cellPlayerName");
      const playerSpan = nameCell?.querySelector(".playerName");
      const rel = playerSpan?.getAttribute("rel") ?? "";
      const playerName = playerSpan ? [...playerSpan.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim() : "";
      rows.push({
        position,
        row,
        planetId: int(row.querySelector("[data-planet-id]")?.getAttribute("data-planet-id")),
        planetName: row.querySelector(".cellPlanetName")?.textContent?.trim() ?? "",
        moonId: int(row.querySelector("[data-moon-id]")?.getAttribute("data-moon-id")),
        playerId: rel.startsWith("player") ? int(rel) : null,
        playerName,
        statuses: statusesOf(nameCell ?? null),
        rank: int(nameCell?.querySelector(".rank a")?.textContent),
        alliance: [...row.querySelector(".cellAlliance > span")?.childNodes ?? []].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim(),
        debris: readDebris(row.querySelector(".cellDebris")),
        activity: { planet: readActivity(row.querySelector(".cellPlanet")), moon: readActivity(row.querySelector(".cellMoon")) }
      });
    }
    return { galaxy, system, rows, deepDebris: readDebris(doc.getElementById("expeditionDebrisSlotDebrisContainer")) };
  }
  var debrisMsu = (d) => d.metal + d.crystal * 1.5 + d.deuterium * 3;

  // src/data/player-api.ts
  var PLAYER_SCORES_KEY = "galaxy.players";
  var TTL2 = 60 * 60 * 1e3;
  var KEEP = 400;
  var SCORE_TYPES = { total: 0, economy: 1, research: 2, military: 3, lifeform: 8 };
  function parsePlayerData(xml, now) {
    const doc = new DOMParser().parseFromString(xml, "text/html");
    const root = doc.querySelector("playerdata");
    const id = Number(root?.getAttribute("id"));
    if (!root || !id) return null;
    const scores = {};
    for (const [key2, type] of Object.entries(SCORE_TYPES)) {
      const pos = root.querySelector(`positions position[type="${type}"]`);
      const points = Number(pos?.getAttribute("score"));
      const rank = Number(pos?.textContent?.trim());
      if (pos && Number.isFinite(points) && Number.isFinite(rank)) scores[key2] = { points: Math.floor(points), rank };
    }
    const ships = Number(root.querySelector('positions position[type="3"]')?.getAttribute("ships"));
    const planets = [...root.querySelectorAll("planets planet")].map((p) => {
      const m = p.querySelector("moon");
      return {
        id: Number(p.getAttribute("id")) || 0,
        name: p.getAttribute("name") ?? "",
        coords: p.getAttribute("coords") ?? "",
        moon: m ? { id: Number(m.getAttribute("id")) || 0, name: m.getAttribute("name") ?? "", size: Number(m.getAttribute("size")) || 0 } : null
      };
    }).filter((p) => /^\d+:\d+:\d+$/.test(p.coords));
    const ts = Number(root.getAttribute("timestamp"));
    return { id, name: root.getAttribute("name") ?? "", at: now, updated: ts > 0 ? ts * 1e3 : void 0, scores, ships: Number.isFinite(ships) && ships > 0 ? ships : null, planets };
  }
  async function playerScores(guard, store, origin, id, now) {
    const cache = store.get(PLAYER_SCORES_KEY, {});
    const hit = cache[String(id)];
    if (hit && hit.planets && now - hit.at < TTL2) return hit;
    const res = await guard.request(`${origin}/api/playerData.xml?id=${id}`, "user-view");
    if (!res.ok) return hit ?? null;
    const fresh = parsePlayerData(await res.text(), now);
    if (!fresh) return hit ?? null;
    cache[String(id)] = fresh;
    const ids = Object.keys(cache).sort((a, b) => (cache[b]?.at ?? 0) - (cache[a]?.at ?? 0));
    for (const old of ids.slice(KEEP)) delete cache[old];
    store.set(PLAYER_SCORES_KEY, cache);
    return fresh;
  }

  // src/modules/galaxy/style.ts
  var GALAXY_CSS = `
.fut-g-bar {
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; margin: 4px 0 6px; padding: 6px 10px;
  border: 1px solid #1F2C40; border-radius: 7px; background: #111B2A;
  font: 12px/16px Arial, Helvetica, sans-serif; color: #C9D4E2; text-align: left;
}
.fut-g-bar b { color: #E6EDF5; font-family: Consolas, "JetBrains Mono", monospace; }
.fut-g-muted { color: #8A9BB0; }
.fut-g-inact { color: #9BE36D; }
.fut-g-vac { color: #7FB8FF; }
.fut-g-deb { color: #F5B547; }
/* Rows: a light tint on the cells, the game's own colours stay. */
#galaxyContent .galaxyRow.fut-g-inactive .galaxyCell { background-color: rgba(155,227,109,0.07); }
#galaxyContent .galaxyRow.fut-g-own .galaxyCell { background-color: rgba(79,209,232,0.08); }
#galaxyContent .galaxyRow.fut-g-tagged .cellPlanetName { box-shadow: inset 3px 0 0 var(--fut-tag); }

/* The position the side bar (or the link) asked for: the planet menu's cyan frame. */
#galaxyContent .galaxyRow.fut-g-hl { box-shadow: inset 0 0 0 1px #4FD1E8, inset 3px 0 0 #4FD1E8; }
#galaxyContent .galaxyRow.fut-g-hl .galaxyCell { background-color: rgba(79,209,232,0.12); }

#galaxyContent .cellPlanetName { position: relative; }
/* Planet colour: at the right of the name, faint until the row is pointed at or the planet has one. */
#galaxyContent .cellPlanetName .fut-mk-tag { position: absolute; right: 3px; top: 50%; transform: translateY(-50%); margin: 0; opacity: 0; transition: opacity 120ms ease-out; }
#galaxyContent .galaxyRow:hover .fut-mk-tag, #galaxyContent .fut-mk-tag:focus-visible, #galaxyContent .fut-mk-tag.on { opacity: 1; }
.fut-g-rank:focus-visible { outline: 2px solid #4FD1E8; outline-offset: 1px; }

/* Player column, as OGLight lays it out: status first, the name with all the room left, rank and
   flag on the right. The planet name gives up some width to the player name. */
#galaxyContent .galaxyRow .cellPlanetName { flex: 0.72 1 0% !important; }
#galaxyContent .galaxyRow .cellPlayerName { flex: 1.28 1 0% !important; }
#galaxyContent .galaxyRow.ctContentRow .cellPlayerName { justify-content: flex-start !important; gap: 3px; padding: 0 3px 0 5px; box-sizing: border-box; }
#galaxyContent .cellPlayerName > pre { order: -1; flex: none; margin: 0; }
#galaxyContent .cellPlayerName > .playerName { flex: 0 1 auto; min-width: 0; }
.fut-g-rank {
  margin-left: auto; flex: none; padding: 0 2px; border: 0; border-radius: 3px; background: none;
  color: #8A9BB0; font: 10px/14px Consolas, "JetBrains Mono", monospace; cursor: help;
}
.fut-g-rank:hover { background: #16243A; color: #E6EDF5; }
/* The flag stays out of the way until the row is pointed at, or the player has one. */
#galaxyContent .cellPlayerName .fut-mk-flag { flex: none; width: 16px; height: 16px; margin: 0; border-color: transparent; background: none; opacity: 0; transition: opacity 120ms ease-out; }
#galaxyContent .galaxyRow:hover .fut-mk-flag, #galaxyContent .fut-mk-flag:focus-visible { opacity: 1; }
#galaxyContent .cellPlayerName .fut-mk-flag.on { opacity: 1; border-color: transparent; }
#galaxyContent .cellDebris { position: relative; }
.fut-g-dval { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%); padding: 0 3px; border-radius: 3px; background: rgba(5,10,18,0.85);
  color: #C9D4E2; font: 10px/12px Consolas, "JetBrains Mono", monospace; white-space: nowrap; pointer-events: none; }
.fut-g-dval.big { color: #F5B547; font-weight: 700; }

.fut-g-card {
  position: fixed; z-index: 1000002; width: 250px; padding: 10px 12px; border: 1px solid #2C3E57; border-radius: 8px;
  background: #0A111C; box-shadow: 0 10px 30px rgba(0,0,0,0.6); font: 12px/16px Arial, Helvetica, sans-serif; color: #C9D4E2;
  text-align: left; pointer-events: none;
}
.fut-g-card h4 { margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #E6EDF5; }
.fut-g-card table { width: 100%; border-collapse: collapse; }
.fut-g-card td { padding: 2px 0; border-bottom: 1px solid #16202F; font-variant-numeric: tabular-nums; white-space: nowrap; }
.fut-g-card td + td { text-align: right; font-family: Consolas, "JetBrains Mono", monospace; }
.fut-g-card td.r { color: #4FD1E8; padding-left: 10px; }
.fut-g-card p { margin: 6px 0 0; color: #8A9BB0; font-size: 11px; }
.fut-g-card .err { color: #FF7A7A; }
`;

  // src/modules/galaxy/index.ts
  var TARGETS_KEY = "galaxy.targets";
  var BIG_DEBRIS = 1e6;
  var highlight = "";
  function highlightPosition(coords) {
    highlight = coords;
  }
  var isGalaxyPage = (doc) => new URL(doc.location?.href ?? "http://x/").searchParams.get("component") === "galaxy";
  var coordsOf = (s, r) => `${s.galaxy}:${s.system}:${r.position}`;
  function systemSummary(s, ownPlanetIds) {
    const players = /* @__PURE__ */ new Set();
    const inactive = /* @__PURE__ */ new Set();
    const longInactive = /* @__PURE__ */ new Set();
    const vacation = /* @__PURE__ */ new Set();
    let moons = 0;
    let debris = 0;
    let fields = 0;
    for (const r of s.rows) {
      const who = r.playerId ?? r.playerName;
      if (r.moonId) moons++;
      if (r.debris) {
        fields++;
        debris += debrisMsu(r.debris);
      }
      if (!who || r.planetId && ownPlanetIds.has(r.planetId)) continue;
      players.add(who);
      if (r.statuses.includes("vacation")) vacation.add(who);
      else if (r.statuses.includes("longinactive")) longInactive.add(who);
      if (!r.statuses.includes("vacation") && (r.statuses.includes("inactive") || r.statuses.includes("longinactive"))) inactive.add(who);
    }
    return { players: players.size, inactive: inactive.size, longInactive: longInactive.size, vacation: vacation.size, moons, debris, fields, deep: s.deepDebris ? debrisMsu(s.deepDebris) : 0 };
  }
  function el(doc, tag, cls = "", text = "") {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }
  var isOurs = (n) => n instanceof Element && (/(^|\s)fut-/.test(n.getAttribute("class") ?? "") || !!n.closest('.fut-mk, [class*="fut-g-"]'));
  function watchGalaxy(o) {
    const { doc } = o;
    const component = doc.getElementById("galaxycomponent") ?? doc.getElementById("galaxyContent")?.parentElement;
    if (!component || !doc.defaultView) return;
    if (!doc.getElementById("fut-galaxy-css")) {
      const style = el(doc, "style");
      style.id = "fut-galaxy-css";
      style.textContent = GALAXY_CSS;
      doc.head.append(style);
    }
    ensureMarksStyle(doc);
    highlight = (() => {
      const q = new URL(doc.location.href).searchParams;
      return q.get("galaxy") && q.get("system") && q.get("position") ? `${q.get("galaxy")}:${q.get("system")}:${q.get("position")}` : "";
    })();
    let queued = false;
    const run = () => {
      queued = false;
      const content = doc.getElementById("galaxyContent");
      if (!content) return;
      remember(o);
      decorate(o, content);
      o.onSystem?.();
    };
    new doc.defaultView.MutationObserver((records) => {
      const theirs = records.some((r) => ![...r.addedNodes, ...r.removedNodes].every(isOurs));
      if (!theirs || queued) return;
      queued = true;
      setTimeout(run, 30);
    }).observe(component, { childList: true, subtree: true });
    run();
  }
  function remember(o) {
    const s = readGalaxy(o.doc);
    if (!s) return;
    const marks = loadMarks(o.store.get(MARKS_KEY, null));
    const recent = new Set(marks.recent.map((r) => r.id));
    const keep = (id, coords) => !!marks.players[String(id)] || recent.has(id) || !!marks.planets[coords];
    const rows = s.rows.filter((r) => !(r.planetId && o.ownPlanetIds.has(r.planetId))).map((r) => ({ ...r, debris: r.debris ? debrisMsu(r.debris) : 0 }));
    const next = recordSystem(o.store.get(POSITIONS_KEY, {}), s.galaxy, s.system, rows, keep, Date.now());
    if (next) o.store.set(POSITIONS_KEY, next);
  }
  function decorate(o, content) {
    const { doc, store, t, locale } = o;
    const s = readGalaxy(doc);
    if (!s) return;
    const marks = loadMarks(store.get(MARKS_KEY, null));
    const redraw = () => decorate(o, content);
    const picker = { doc, store, t, onChange: redraw };
    for (const r of s.rows) {
      const coords = coordsOf(s, r);
      const own = r.planetId !== null && o.ownPlanetIds.has(r.planetId);
      const inactive = !r.statuses.includes("vacation") && (r.statuses.includes("inactive") || r.statuses.includes("longinactive"));
      const tag = marks.planets[coords]?.tag;
      r.row.classList.toggle("fut-g-own", own);
      r.row.classList.toggle("fut-g-inactive", inactive && !own);
      r.row.classList.toggle("fut-g-tagged", !!tag);
      r.row.classList.toggle("fut-g-hl", coords === highlight);
      const rowStyle = r.row.style;
      if (tag) rowStyle.setProperty("--fut-tag", TAG_COLORS[tag]);
      else rowStyle.removeProperty("--fut-tag");
      const nameCell = r.row.querySelector(".cellPlanetName");
      if (nameCell && r.planetId && !own && !nameCell.querySelector(".fut-mk-tag"))
        nameCell.append(tagButton(picker, coords, { planet: r.planetName, player: r.playerName, playerId: r.playerId, statuses: r.statuses, moon: !!r.moonId }));
      else if (nameCell && (own || !r.planetId)) nameCell.querySelector(".fut-mk-tag")?.remove();
      const playerCell = r.row.querySelector(".cellPlayerName");
      if (playerCell && r.playerId && r.rank && !playerCell.querySelector(".fut-g-rank")) {
        const id = r.playerId;
        const badge = el(doc, "button", "fut-g-rank", `#${r.rank.toLocaleString(locale)}`);
        badge.type = "button";
        badge.setAttribute("aria-label", t("galaxy.rankTitle", { name: r.playerName }));
        const show2 = () => void openCard(o, badge, id, r.playerName);
        badge.addEventListener("mouseenter", show2);
        badge.addEventListener("focus", show2);
        badge.addEventListener("mouseleave", () => closeCard(doc));
        badge.addEventListener("blur", () => closeCard(doc));
        playerCell.querySelector(".playerName")?.after(badge);
        if (!own) badge.after(flagButton(picker, id, r.playerName));
      }
      const debrisCell = r.row.querySelector(".cellDebris");
      if (debrisCell && r.debris && !debrisCell.querySelector(".fut-g-dval")) {
        const msu4 = debrisMsu(r.debris);
        debrisCell.append(el(doc, "span", `fut-g-dval${msu4 >= BIG_DEBRIS ? " big" : ""}`, formatUnits(msu4, locale)));
      }
    }
    renderBar(o, content, s);
  }
  function renderBar(o, content, s) {
    const { doc, t, locale } = o;
    const sum = systemSummary(s, o.ownPlanetIds);
    const bar = el(doc, "div", "fut-g-bar");
    bar.id = "fut-galaxy-bar";
    const part = (cls, text) => bar.append(el(doc, "span", cls, text));
    bar.append(el(doc, "b", "", `${s.galaxy}:${s.system}`));
    part("", t("galaxy.players", { count: sum.players }));
    part("fut-g-inact", t("galaxy.inactive", { count: sum.inactive }) + (sum.longInactive ? ` (${t("galaxy.longInactive", { count: sum.longInactive })})` : ""));
    part("fut-g-vac", t("galaxy.vacation", { count: sum.vacation }));
    part("fut-g-muted", t("galaxy.moons", { count: sum.moons }));
    part(sum.debris >= BIG_DEBRIS ? "fut-g-deb" : "fut-g-muted", sum.fields ? t("galaxy.debris", { msu: formatUnits(sum.debris, locale), count: sum.fields }) : t("galaxy.noDebris"));
    if (sum.deep) part(sum.deep >= BIG_DEBRIS ? "fut-g-deb" : "fut-g-muted", t("galaxy.deep", { msu: formatUnits(sum.deep, locale) }));
    doc.getElementById(bar.id)?.remove();
    content.before(bar);
  }
  var CARD_ID = "fut-galaxy-card";
  var cardFor = 0;
  function closeCard(doc) {
    cardFor = 0;
    doc.getElementById(CARD_ID)?.remove();
  }
  async function openCard(o, anchor, id, name) {
    const { doc, t, locale } = o;
    closeCard(doc);
    cardFor = id;
    const card = el(doc, "div", "fut-g-card");
    card.id = CARD_ID;
    card.setAttribute("role", "tooltip");
    card.append(el(doc, "h4", "", t("galaxy.rankTitle", { name })));
    const note = el(doc, "p", "", t("galaxy.loading"));
    card.append(note);
    doc.body.append(card);
    const place2 = () => {
      const box = anchor.getBoundingClientRect();
      const view = doc.defaultView;
      const h6 = card.offsetHeight;
      const below = box.bottom + 6 + h6 <= (view?.innerHeight ?? 800);
      card.style.left = `${Math.max(8, Math.min(box.left, (view?.innerWidth ?? 1200) - card.offsetWidth - 8))}px`;
      card.style.top = `${below ? box.bottom + 6 : Math.max(8, box.top - 6 - h6)}px`;
    };
    place2();
    let data = null;
    try {
      data = await playerScores(o.guard, o.store, doc.location.origin, id, Date.now());
    } catch {
      data = null;
    }
    if (cardFor !== id || !card.isConnected) return;
    if (!data) {
      note.textContent = t("galaxy.apiError");
      note.className = "err";
      return;
    }
    const table = el(doc, "table");
    for (const key2 of Object.keys(SCORE_TYPES)) {
      const v = data.scores[key2];
      if (!v) continue;
      const tr = el(doc, "tr");
      tr.append(el(doc, "td", "", t(`galaxy.score.${key2}`)), el(doc, "td", "", formatUnits(v.points, locale)), el(doc, "td", "r", `#${v.rank.toLocaleString(locale)}`));
      table.append(tr);
    }
    note.before(table);
    const parts = [t("galaxy.apiAge", { time: new Date(data.at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) })];
    if (data.ships) parts.unshift(t("galaxy.ships", { count: data.ships.toLocaleString(locale) }));
    note.textContent = parts.join(" \xB7 ");
    place2();
  }

  // src/data/fleet-dispatcher.ts
  function pageWindow() {
    return typeof unsafeWindow !== "undefined" && unsafeWindow || window;
  }
  function getDispatcher(win = pageWindow()) {
    return win.fleetDispatcher ?? null;
  }
  function whenDispatcherReady(win = pageWindow(), timeoutMs = 5e3) {
    const ready = getDispatcher(win);
    if (ready) return Promise.resolve(ready);
    return new Promise((resolve) => {
      const started = Date.now();
      const check = () => {
        const fd = getDispatcher(win);
        if (fd) return resolve(fd);
        if (Date.now() - started > timeoutMs) return resolve(null);
        setTimeout(check, 50);
      };
      check();
    });
  }
  function shipCapacity(fd, id) {
    const data = fd.fleetHelper.shipsData?.[String(id)];
    return data?.cargoCapacity || data?.baseCargoCapacity || 0;
  }
  function shipsOnPlanet(fd) {
    return Object.fromEntries(fd.shipsOnPlanet.map((s) => [String(s.id), s.number]));
  }
  var SHIPS_INFO_KEY = "ships.info";
  function readShipsInfo(fd) {
    const data = fd.fleetHelper?.shipsData;
    if (!data) return null;
    const out = {};
    for (const [id, s] of Object.entries(data)) out[id] = { name: s.name ?? "", capacity: s.cargoCapacity || s.baseCargoCapacity || 0, speed: s.speed || 0 };
    return Object.keys(out).length ? out : null;
  }

  // src/data/universe-players.ts
  var UNIVERSE_PLAYERS_KEY = "universe.players";
  var TTL3 = 24 * 36e5;
  function parsePlayersXml(xml, now) {
    const doc = new DOMParser().parseFromString(xml, "text/html");
    const root = doc.querySelector("players");
    if (!root) return null;
    const players = {};
    for (const p of root.querySelectorAll("player")) {
      const id = p.getAttribute("id");
      if (id) players[id] = [p.getAttribute("name") ?? "", p.getAttribute("status") ?? ""];
    }
    return Object.keys(players).length ? { at: now, players } : null;
  }
  function statusNames(letters) {
    const out = [];
    if (letters.includes("v")) out.push("vacation");
    if (letters.includes("b")) out.push("banned");
    if (letters.includes("I")) out.push("longinactive");
    else if (letters.includes("i")) out.push("inactive");
    if (letters.includes("o")) out.push("outlaw");
    if (letters.includes("a")) out.push("admin");
    return out;
  }
  async function universePlayers(deps) {
    const now = deps.now ?? Date.now();
    const cached = deps.store.get(UNIVERSE_PLAYERS_KEY, null);
    if (cached && now - cached.at < TTL3) return cached;
    const res = await deps.guard.request(`${deps.origin}/api/players.xml`, "user-view");
    const fresh = res.ok ? parsePlayersXml(await res.text(), now) : null;
    if (!fresh) return cached;
    deps.store.set(UNIVERSE_PLAYERS_KEY, fresh);
    return fresh;
  }

  // src/modules/marks/side.ts
  var SIDE_ID = "fut-side";
  var SIDE_W = 330;
  var VIEW_KEY = "marks.view";
  var HOUR = 36e5;
  var last = null;
  var sheetData = /* @__PURE__ */ new Map();
  var uni = null;
  var SCORE_LOOK = [
    ["total", "star", "#F5B547"],
    ["economy", "swap", "#7FB8FF"],
    ["research", "eye", "#4FE0B0"],
    ["lifeform", "user", "#E58CDB"],
    ["military", "fleet", "#FF7A7A"]
  ];
  var CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.side {
  position: fixed; left: 0; top: 0; bottom: 0; z-index: 1000000; width: ${SIDE_W}px; display: flex; flex-direction: column; gap: 6px;
  padding: 8px; background: #0B121D; border-right: 1px solid #1F2C40; box-shadow: 6px 0 24px rgba(0,0,0,0.45);
  font: 11px Arial, Helvetica, sans-serif; color: #C9D4E2; overflow: hidden;
}
button { font: inherit; color: inherit; }
button:focus-visible, a:focus-visible, input:focus-visible { outline: 1px solid #4FD1E8; outline-offset: -1px; }
.mono, .coords, .num { font-family: Consolas, "JetBrains Mono", monospace; font-variant-numeric: tabular-nums; }

/* Head: back, title, close: the planet menu's toolbar look. */
.head { display: flex; align-items: center; gap: 4px; min-height: 30px; padding: 0 2px 0 4px; border: 1px solid #1F2C40; border-radius: 6px; background: #111B2A; }
.title { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center; gap: 4px; font: 700 12px Arial, sans-serif; color: #E6EDF5; white-space: nowrap; overflow: hidden; }
.title .name { overflow: hidden; text-overflow: ellipsis; }
.title a { color: #8A9BB0; font-weight: 400; text-decoration: none; }
.title a:hover { color: #4FD1E8; }
.ib { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 5px; background: none; color: #8A9BB0; cursor: pointer; flex: none; text-decoration: none; }
.ib:hover { background: #16243A; color: #E6EDF5; }

/* Tabs and filters: the settings chips of the planet menu. */
.chips { display: flex; flex-wrap: wrap; gap: 3px; }
.chip { display: inline-flex; align-items: center; justify-content: center; gap: 4px; flex: 1 0 auto; min-width: 30px; height: 24px; padding: 0 6px; border-radius: 5px; border: 1px solid #1F2C40; background: #0A111C; color: #B4C2D3; cursor: pointer; }
.chip:hover { border-color: #2C5A73; }
.chip[aria-pressed="true"] { border-color: currentColor; background: #12283A; color: #E6EDF5; font-weight: 700; }
.chip .n { font: 10px Consolas, monospace; color: #8A9BB0; }
.seg { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #1F2C40; border-radius: 6px; overflow: hidden; }
.seg button { height: 24px; border: 0; background: #0B121D; color: #8A9BB0; cursor: pointer; }
.seg button + button { border-left: 1px solid #1F2C40; }
.seg button[aria-pressed="true"] { background: #12283A; color: #E6EDF5; font-weight: 700; box-shadow: inset 0 -2px 0 #4FD1E8; }

/* Scores: the toolbar cells, two per line. */
.scores { display: grid; grid-template-columns: 1fr 1fr; gap: 2px; }
.score { display: flex; align-items: center; gap: 6px; height: 26px; padding: 0 8px; border: 1px solid #1F2C40; border-radius: 6px; background: #111B2A; min-width: 0; }
.score b { flex: 1; text-align: right; font: 700 12px Consolas, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.score i { font: normal 10px Consolas, monospace; color: #8A9BB0; }
.actions { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; border: 1px solid #1F2C40; border-radius: 6px; background: #0B121D; overflow: hidden; }
.actions a, .actions button { display: flex; align-items: center; justify-content: center; height: 26px; border: 0; background: none; color: #8A9BB0; text-decoration: none; cursor: pointer; }
.actions > * + * { border-left: 1px solid #1F2C40 !important; }
.actions a:hover, .actions button:hover { background: #111D2D; color: #E6EDF5; }

.range { display: flex; align-items: center; gap: 4px; color: #8A9BB0; }
.range input { width: 64px; height: 22px; padding: 0 5px; border: 1px solid #1F2C40; border-radius: 5px; background: #0A111C; color: #E6EDF5; font: 11px Consolas, monospace; }

/* Rows: the planet menu's .fut-row, one line each. */
.scroll { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; padding-right: 2px; scrollbar-color: #2A3B55 #0B121D; scrollbar-width: thin; }
.cols, .row { display: grid; align-items: center; gap: 4px; min-height: 26px; padding: 0 4px; }
.cols { min-height: 18px; color: #4A5B72; font-size: 10px; }
.row { border: 1px solid #1F2C40; border-radius: 6px; background: #111B2A; }
.row.gap { margin-top: 4px; }
.row.active { border-color: #4FD1E8; background: rgba(79,209,232,0.14); box-shadow: inset 3px 0 0 #4FD1E8; }
.pl .cols, .pl .row { grid-template-columns: 18px 64px 1fr 34px 34px 40px; }
.tg .cols, .tg .row { grid-template-columns: 18px 64px 1fr 34px 40px 20px; }
.ps .row { grid-template-columns: 18px 1fr auto auto; }
.idx { color: #4A5B72; font: 10px Consolas, monospace; text-align: right; }
.coords { all: unset; display: inline-flex; align-items: center; gap: 3px; padding: 2px 4px; border-radius: 4px; color: #C9D4E2; font: 11px Consolas, monospace; cursor: pointer; }
.coords:hover { background: #1D3350; color: #E6EDF5; }
.row.active .coords { color: #8BE4F2; }
.coords.new::after { content: ''; width: 5px; height: 5px; border-radius: 50%; background: #4FD1E8; }
.cell-r { text-align: right; font: 11px Consolas, monospace; color: #8A9BB0; white-space: nowrap; overflow: hidden; }
.cell-r.has { color: #C9D4E2; }
.cell-r.big { color: #F5B547; font-weight: 700; }
.txt { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #E6EDF5; }
.txt .who { color: #8A9BB0; }
.pname { all: unset; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #E6EDF5; font-weight: 700; cursor: pointer; }
.pname:hover, .pname:focus-visible { color: #4FD1E8; }
.rank { color: #8A9BB0; font: 10px Consolas, monospace; }
.act { display: inline-flex; align-items: center; justify-content: flex-end; gap: 2px; height: 20px; padding: 0 3px; border-radius: 4px; font: 700 11px Consolas, monospace; text-decoration: none; color: #4A5B72; }
.act svg { color: #617C8D; flex: none; }
a.act:hover { background: #1D3350; }
.act.on { color: #EF7676; } .act.mid { color: #E3BB28; } .act.off { color: #38C56E; } .act.unknown { color: #617C8D; font-weight: 400; }
.age { text-align: right; font: 10px Consolas, monospace; }
.age.fresh { color: #38C56E; } .age.warm { color: #E3BB28; } .age.old { color: #EF7676; } .age.none { color: #4A5B72; }
.st-inactive { color: #9BE36D !important; } .st-longinactive { color: #8A9BB0 !important; } .st-vacation { color: #7FDBFF !important; } .st-banned { color: #FF7A7A !important; text-decoration: line-through; }
.foot { display: flex; justify-content: space-between; gap: 6px; color: #617C8D; font-size: 10px; }
kbd { padding: 0 4px; border: 1px solid #2E4356; border-radius: 3px; background: #0D1522; color: #C9D4E2; font: 10px Consolas, monospace; }
.empty { margin: 4px 0; padding: 14px 10px; border: 1px dashed #1F2C40; border-radius: 6px; color: #8A9BB0; text-align: center; line-height: 1.4; }
.err { color: #EF7676; }
.fut-mk { margin: 0; }
` + MARKS_CSS;
  function h(doc, tag, cls = "", text) {
    const n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (text !== void 0) n.textContent = text;
    return n;
  }
  var galaxyHref = (coords) => {
    const [g, s, p] = coords.split(":");
    return `/game/index.php?page=ingame&component=galaxy&galaxy=${g}&system=${s}&position=${p}`;
  };
  var fleetHref = (coords, type) => {
    const [g, s, p] = coords.split(":");
    return `/game/index.php?page=ingame&component=fleetdispatch&galaxy=${g}&system=${s}&position=${p}&type=${type}`;
  };
  var readView = (o) => {
    return { open: false, tab: "players", flagTab: "watch", player: null, from: "", to: "", tags: [...TAGS], hide: ["vacation", "banned"], ...o.store.get(VIEW_KEY, {}) };
  };
  var readMarks2 = (store) => loadMarks(store.get(MARKS_KEY, null));
  function shownSystem(doc) {
    const g = doc.getElementById("galaxy_input")?.value;
    const s = doc.getElementById("system_input")?.value;
    return doc.getElementById("galaxyContent") && g && s ? `${Number(g)}:${Number(s)}` : null;
  }
  var onGo = null;
  function onSideNavigate(fn) {
    onGo = fn;
  }
  function showInGalaxy(doc, coords) {
    const [g, s] = coords.split(":").map(Number);
    const win = pageWindow();
    if (shownSystem(doc) && typeof win.loadContentNew === "function" && g && s) {
      onGo?.(coords);
      const gi = doc.getElementById("galaxy_input");
      const si = doc.getElementById("system_input");
      if (gi) gi.value = String(g);
      if (si) si.value = String(s);
      win.galaxy = g;
      win.system = s;
      win.loadContentNew(g, s);
    } else doc.location.assign(galaxyHref(coords));
  }
  function isSideOpen(doc) {
    return !!doc.getElementById(SIDE_ID);
  }
  function closeSide(doc, store) {
    doc.getElementById(SIDE_ID)?.remove();
    store.set(VIEW_KEY, { ...store.get(VIEW_KEY, {}), open: false });
  }
  function toggleSide(o) {
    if (isSideOpen(o.doc)) closeSide(o.doc, o.store);
    else openSide(o, { open: true });
  }
  function restoreSide(o) {
    if (readView(o).open) openSide(o, {});
  }
  function refreshSide() {
    if (last && isSideOpen(last.doc)) openSide(last, {});
  }
  function nextInSide(doc) {
    const root = doc.getElementById(SIDE_ID)?.shadowRoot;
    const all2 = [...root?.querySelectorAll("[data-coords]") ?? []];
    if (!all2.length) return false;
    let at = -1;
    all2.forEach((e, i) => {
      if (e.closest(".row")?.classList.contains("active")) at = i;
    });
    const target = all2[(at + 1) % all2.length];
    showInGalaxy(doc, target.dataset.coords);
    return true;
  }
  function openSide(o, change) {
    last = o;
    const { doc, store, t, locale } = o;
    const view = { ...readView(o), ...change, open: true };
    store.set(VIEW_KEY, view);
    const keepScroll = doc.getElementById(SIDE_ID)?.shadowRoot?.querySelector(".scroll")?.scrollTop ?? 0;
    const marks = readMarks2(store);
    const positions = store.get(POSITIONS_KEY, {});
    const go = (next) => openSide(o, next);
    const picker = { doc, store, t, onChange: () => openSide(o, {}) };
    const here = shownSystem(doc);
    let host = doc.getElementById(SIDE_ID);
    if (!host) {
      host = h(doc, "div");
      host.id = SIDE_ID;
      host.lang = locale;
      host.attachShadow({ mode: "open" });
      doc.body.append(host);
    }
    const root = host.shadowRoot;
    const style = h(doc, "style");
    style.textContent = CSS;
    const side = h(doc, "aside", "side");
    side.setAttribute("aria-label", t("marks.title"));
    const head = h(doc, "header", "head");
    const title = h(doc, "div", "title");
    if (view.player !== null) {
      const back = iconButton(doc, "back", t("marks.back"));
      back.addEventListener("click", () => go({ player: null }));
      head.append(back);
    } else head.append(h(doc, "span", "ib"));
    head.append(title);
    const x = iconButton(doc, "close", t("dash.close"));
    x.addEventListener("click", () => closeSide(doc, store));
    head.append(x);
    side.append(head);
    const scroll = h(doc, "div", "scroll");
    if (view.player !== null) playerSheet(o, side, scroll, title, view.player, marks, positions, picker, here);
    else {
      title.append(h(doc, "span", "name", t("marks.title")));
      const seg = h(doc, "div", "seg");
      for (const id of ["players", "planets"]) {
        const b = h(doc, "button", "", t(`marks.tab.${id}`));
        b.type = "button";
        b.setAttribute("aria-pressed", String(view.tab === id));
        b.addEventListener("click", () => go({ tab: id }));
        seg.append(b);
      }
      side.append(seg);
      if (view.tab === "players") playersList(o, side, scroll, view, marks, picker, go);
      else taggedList(o, side, scroll, view, marks, positions, picker, go, here);
    }
    side.append(scroll);
    const foot = h(doc, "div", "foot");
    const key2 = h(doc, "span", "");
    key2.append(h(doc, "kbd", "", "M"), doc.createTextNode(` ${t("marks.keyNext")}`));
    foot.append(key2, h(doc, "span", "", t("marks.footData")));
    side.append(foot);
    root.replaceChildren(style, side);
    scroll.scrollTop = keepScroll;
  }
  function iconButton(doc, name, label) {
    const b = h(doc, "button", "ib");
    b.type = "button";
    b.title = label;
    b.setAttribute("aria-label", label);
    b.append(icon(doc, name, 14));
    return b;
  }
  function playersList(o, side, scroll, view, marks, picker, go) {
    const { doc, t, locale } = o;
    const chips = h(doc, "div", "chips");
    const counts = Object.values(marks.players).reduce((c, p) => (c[p.flag] = (c[p.flag] ?? 0) + 1, c), {});
    for (const f of [...FLAGS, "recent"]) {
      const b = h(doc, "button", "chip");
      b.type = "button";
      b.title = t(f === "recent" ? "marks.recent" : `mark.flag.${f}`);
      b.setAttribute("aria-label", b.title);
      b.setAttribute("aria-pressed", String(view.flagTab === f));
      if (f !== "recent") b.style.color = FLAG_COLORS[f];
      b.append(icon(doc, f === "recent" ? "eye" : FLAG_ICONS[f], 12), h(doc, "span", "n", String(f === "recent" ? marks.recent.length : counts[f] ?? 0)));
      b.addEventListener("click", () => go({ flagTab: f }));
      chips.append(b);
    }
    side.append(chips);
    const list = view.flagTab === "recent" ? marks.recent : Object.entries(marks.players).filter(([, p]) => p.flag === view.flagTab).map(([id, p]) => ({ id: Number(id), name: p.name })).sort((a, b) => a.name.localeCompare(b.name));
    if (!list.length) {
      scroll.append(h(doc, "p", "empty", t(view.flagTab === "recent" ? "marks.noRecent" : "marks.noPlayers")));
      return;
    }
    const cache = o.store.get(PLAYER_SCORES_KEY, {});
    const wrap = h(doc, "div", "ps");
    list.forEach((p, i) => {
      const row = h(doc, "div", "row");
      const name = h(doc, "button", "pname", p.name || `#${p.id}`);
      name.type = "button";
      name.title = t("marks.openSheet");
      name.addEventListener("click", () => go({ player: p.id }));
      const rank = cache[String(p.id)]?.scores.total?.rank;
      row.append(h(doc, "span", "idx", String(i + 1)), name, h(doc, "span", "rank", rank ? `#${rank.toLocaleString(locale)}` : ""), flagButton(picker, p.id, p.name));
      wrap.append(row);
    });
    scroll.append(wrap);
  }
  function activityCell(doc, t, coords, type, value, seen, now) {
    const a = h(doc, "a", "act");
    a.href = fleetHref(coords, type);
    a.title = t(type === 1 ? "marks.fleetPlanet" : "marks.fleetMoon", { coords });
    a.append(icon(doc, type === 1 ? "planet" : "moon", 10));
    if (!seen || now - seen.at > HOUR) {
      a.classList.add("unknown");
      a.append(doc.createTextNode("?"));
    } else {
      a.classList.add(value === "*" ? "on" : value === null ? "off" : "mid");
      a.append(doc.createTextNode(value === null ? "60" : String(value)));
    }
    return a;
  }
  function ageCell(doc, t, seen, now, locale) {
    if (!seen) return h(doc, "span", "age none", "\u2014");
    const ms = now - seen.at;
    const { n, unit } = ageParts(ms);
    const el5 = h(doc, "span", `age ${ms < HOUR ? "fresh" : ms < 3 * 864e5 ? "warm" : "old"}`, t("marks.ago", { n, u: t(`marks.unit.${unit}`) }));
    el5.title = new Date(seen.at).toLocaleString(locale);
    return el5;
  }
  function coordsButton(doc, t, coords, fresh = false) {
    const b = h(doc, "button", `coords${fresh ? " new" : ""}`, coords);
    b.type = "button";
    b.dataset.coords = coords;
    b.title = fresh ? t("marks.seenOnly") : t("marks.showSystem");
    b.addEventListener("click", () => showInGalaxy(doc, coords));
    return b;
  }
  function playerSheet(o, side, scroll, title, id, marks, positions, picker, here) {
    const { doc, store, t, locale } = o;
    const known = marks.players[String(id)]?.name || marks.recent.find((r) => r.id === id)?.name || "";
    const data = sheetData.get(id);
    const name = data?.name || known || `#${id}`;
    title.append(h(doc, "span", "name", name));
    const rank = data?.scores.total?.rank;
    if (rank) {
      const a = h(doc, "a", "mono", `#${rank.toLocaleString(locale)}`);
      a.href = `/game/index.php?page=ingame&component=highscore&site=${Math.max(1, Math.ceil(rank / 100))}&category=1&searchRelId=${id}`;
      a.title = t("marks.rank");
      title.append(a);
    }
    title.append(flagButton(picker, id, name));
    if (!sheetData.has(id)) {
      scroll.append(h(doc, "p", "empty", t("galaxy.loading")));
      void playerScores(o.guard, store, doc.location.origin, id, Date.now()).catch(() => null).then((fresh) => {
        sheetData.set(id, fresh);
        if (fresh) {
          let m = rememberRecent(readMarks2(store), id, fresh.name || known);
          const flagged = m.players[String(id)];
          if (flagged && !flagged.name) m = flagPlayer(m, id, fresh.name, flagged.flag, Date.now());
          store.set(MARKS_KEY, m);
        }
        refreshSide();
      });
      return;
    }
    const scores = h(doc, "div", "scores");
    for (const [key2, ico, color] of SCORE_LOOK) {
      const v = data?.scores[key2];
      const cell = h(doc, "div", "score");
      cell.title = t(`galaxy.score.${key2}`);
      const ic = icon(doc, ico, 12);
      ic.style.color = color;
      const b = h(doc, "b", "", v ? formatUnits(v.points, locale) : "\u2014");
      b.style.color = color;
      cell.append(ic, b);
      if (v) cell.append(h(doc, "i", "", `#${v.rank.toLocaleString(locale)}`));
      scores.append(cell);
    }
    const ships = h(doc, "div", "score");
    ships.title = t("marks.ships");
    ships.append(icon(doc, "fleet", 12), h(doc, "b", "", data?.ships ? data.ships.toLocaleString(locale) : "\u2014"));
    scores.append(ships);
    side.append(scores);
    const actions = h(doc, "div", "actions");
    const link = (ico, label, href) => {
      const a = h(doc, "a");
      a.href = href;
      a.title = label;
      a.setAttribute("aria-label", label);
      a.append(icon(doc, ico, 13));
      actions.append(a);
    };
    link("pen", t("marks.write"), `/game/index.php?page=ingame&component=chat&playerId=${id}`);
    link("user", t("marks.profile"), `/game/index.php?page=ingame&component=playerprofile&profileId=${id}`);
    link("chart", t("marks.rank"), `/game/index.php?page=ingame&component=highscore&category=1&searchRelId=${id}${rank ? `&site=${Math.max(1, Math.ceil(rank / 100))}` : ""}`);
    side.append(actions);
    if (!data) {
      scroll.append(h(doc, "p", "empty err", t("galaxy.apiError")));
      return;
    }
    const lines = planetsOf(id, data, positions);
    const now = Date.now();
    const wrap = h(doc, "div", "pl");
    const cols = h(doc, "div", "cols");
    cols.append(h(doc, "span", ""), h(doc, "span", "", t("marks.col.coords")), h(doc, "span", "cell-r", t("marks.col.debris")), h(doc, "span", "cell-r", t("marks.col.planet")), h(doc, "span", "cell-r", t("marks.col.moon")), h(doc, "span", "cell-r", t("marks.col.seen")));
    wrap.append(cols);
    let lastSystem = "";
    lines.forEach((p, i) => {
      const system = p.coords.split(":").slice(0, 2).join(":");
      const row = h(doc, "div", `row${i > 0 && system !== lastSystem ? " gap" : ""}${system === here ? " active" : ""}`);
      lastSystem = system;
      row.title = p.name;
      const debris = p.seen?.debris ?? 0;
      row.append(
        h(doc, "span", "idx", String(i + 1)),
        coordsButton(doc, t, p.coords, p.fresh),
        h(doc, "span", `cell-r${debris ? " has" : ""}${debris >= 1e6 ? " big" : ""}`, p.seen ? formatUnits(debris, locale) : "\u2014"),
        activityCell(doc, t, p.coords, 1, p.seen?.act[0] ?? null, p.seen, now),
        p.moon ? activityCell(doc, t, p.coords, 3, p.seen?.act[1] ?? null, p.seen, now) : h(doc, "span", ""),
        ageCell(doc, t, p.seen, now, locale)
      );
      wrap.append(row);
    });
    scroll.append(wrap);
    scroll.append(h(doc, "p", "foot", t("marks.planets", { n: lines.length, moons: lines.filter((l) => l.moon).length }) + " \xB7 " + t("galaxy.apiAge", { time: new Date(data.at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) })));
  }
  function taggedList(o, side, scroll, view, marks, positions, picker, go, here) {
    const { doc, t, locale } = o;
    const range = h(doc, "div", "range");
    const input = (value, label, placeholder) => {
      const i = h(doc, "input");
      i.value = value;
      i.placeholder = placeholder;
      i.inputMode = "numeric";
      i.setAttribute("aria-label", label);
      return i;
    };
    const from = input(view.from, t("marks.from"), "1:1");
    const to = input(view.to, t("marks.to"), "9:499");
    const apply = () => {
      const ok = (v) => !v.trim() || /^\d{1,2}:\d{1,3}$/.test(v.trim());
      if (ok(from.value) && ok(to.value)) go({ from: from.value.trim(), to: to.value.trim() });
    };
    for (const i of [from, to]) i.addEventListener("change", apply);
    range.append(h(doc, "span", "", t("marks.from")), from, h(doc, "span", "", t("marks.to")), to);
    side.append(range);
    const chips = h(doc, "div", "chips");
    for (const tag of TAGS) {
      const b = h(doc, "button", "chip");
      b.type = "button";
      const on = view.tags.includes(tag);
      b.title = t(`mark.tag.${tag}`);
      b.setAttribute("aria-label", b.title);
      b.setAttribute("aria-pressed", String(on));
      b.style.color = TAG_COLORS[tag];
      const dot = h(doc, "span", "fut-mk-dot");
      dot.style.background = TAG_COLORS[tag];
      dot.style.borderColor = "transparent";
      b.append(dot);
      b.addEventListener("click", () => go({ tags: on ? view.tags.filter((x) => x !== tag) : [...view.tags, tag] }));
      chips.append(b);
    }
    side.append(chips);
    const hides = h(doc, "div", "chips");
    for (const st of ["vacation", "banned", "inactive"]) {
      const b = h(doc, "button", "chip", t(`marks.hide.${st}`));
      b.type = "button";
      const on = view.hide.includes(st);
      b.setAttribute("aria-pressed", String(on));
      b.addEventListener("click", () => go({ hide: on ? view.hide.filter((x) => x !== st) : [...view.hide, st] }));
      hides.append(b);
    }
    side.append(hides);
    const statusOf = (playerId, saved) => {
      const row = playerId ? uni?.players[String(playerId)] : void 0;
      return row ? statusNames(row[1]) : saved;
    };
    const withStatus = { ...marks, planets: Object.fromEntries(Object.entries(marks.planets).map(([c, p]) => [c, { ...p, statuses: statusOf(p.playerId, p.statuses) }])) };
    const hide = view.hide.flatMap((s) => s === "inactive" ? ["inactive", "longinactive"] : [s]);
    const list = planetsInRange(withStatus, view.from || "1:0", view.to || "99:999", { tags: view.tags, hide });
    if (!uni) void universePlayers({ guard: o.guard, store: o.store, origin: doc.location.origin }).catch(() => null).then((u) => {
      if (u) {
        uni = u;
        refreshSide();
      }
    });
    if (!list.length) {
      scroll.append(h(doc, "p", "empty", t(Object.keys(marks.planets).length ? "marks.noneInRange" : "marks.noPlanets")));
      return;
    }
    const now = Date.now();
    const wrap = h(doc, "div", "tg");
    const cols = h(doc, "div", "cols");
    cols.append(h(doc, "span", ""), h(doc, "span", "", t("marks.col.coords")), h(doc, "span", "", t("marks.col.who")), h(doc, "span", "cell-r", t("marks.col.planet")), h(doc, "span", "cell-r", t("marks.col.seen")), h(doc, "span", ""));
    wrap.append(cols);
    list.forEach(([coords, p], i) => {
      const system = coords.split(":").slice(0, 2).join(":");
      const seenRaw = positions[coords];
      const seen = seenRaw && (!p.playerId || seenRaw.player === p.playerId) ? seenRaw : null;
      const row = h(doc, "div", `row${system === here ? " active" : ""}`);
      const txt = h(doc, "span", "txt", p.planet || "?");
      txt.append(h(doc, "span", `who${p.statuses[0] ? ` st-${p.statuses[0]}` : ""}`, p.player ? ` \xB7 ${p.player}` : ""));
      txt.title = `${p.planet} \xB7 ${p.player}`;
      row.append(h(doc, "span", "idx", String(i + 1)), coordsButton(doc, t, coords), txt, activityCell(doc, t, coords, 1, seen?.act[0] ?? null, seen, now), ageCell(doc, t, seen, now, locale), tagButton(picker, coords, p));
      wrap.append(row);
    });
    scroll.append(wrap);
    scroll.append(h(doc, "p", "foot", t("marks.planetsHint", { n: list.length })));
  }

  // src/data/queues.ts
  var QUEUES_KEY = "queues";
  var PRODUCTION_QUEUE_PATH = "/game/index.php?page=ajax&component=productionqueue&ajax=1";
  var QUEUE_MIN_INTERVAL_MS = 6e4;
  var QUEUE_KINDS = ["building", "lfbuilding", "research", "lfresearch", "ship"];
  var SELECTORS = [
    ["building", "building"],
    ["research", "research"],
    ["ship", "ship"],
    ["ship", "ship_2nd"],
    ["lfbuilding", "lifeformBuilding"],
    ["lfresearch", "lifeformResearch"]
  ];
  function parseProductionQueue(html, ids, now) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const bodies = {};
    for (const id of ids) {
      const items = [];
      for (const [kind, cls] of SELECTORS) {
        const time = doc.querySelector(`time.${cls}${id}`);
        if (!time) continue;
        const details = time.closest(".productionDetails");
        const name = details?.querySelector(".productionName")?.childNodes[0]?.textContent?.trim() ?? "";
        const level2 = Number(details?.querySelector(".productionLevel")?.textContent?.replace(/\D/g, "") || 0);
        const end = Number(time.getAttribute("data-end")) * 1e3;
        if (Number.isFinite(end) && end > 0) items.push({ kind, name, level: level2, end });
      }
      bodies[String(id)] = items;
    }
    return { at: now, bodies };
  }
  var queueLabel = (i, locale) => i.kind === "ship" ? `${i.level ? `${i.level.toLocaleString(locale)}\xD7 ` : ""}${i.name}` : `${i.name}${i.level ? ` \u2192 ${i.level}` : ""}`;
  function activeItems(items, now) {
    return (items ?? []).filter((i) => i.end > now).sort((a, b) => QUEUE_KINDS.indexOf(a.kind) - QUEUE_KINDS.indexOf(b.kind));
  }
  async function fetchQueues(deps, reason) {
    const now = deps.now ?? (() => Date.now());
    const response = await deps.guard.request(PRODUCTION_QUEUE_PATH, reason);
    const snapshot = parseProductionQueue(await response.text(), deps.ids, now());
    deps.store.set(QUEUES_KEY, snapshot);
    return snapshot;
  }
  async function loadQueuesOnPageLoad(deps) {
    const now = (deps.now ?? (() => Date.now()))();
    const stored = deps.store.get(QUEUES_KEY, null);
    if (stored && now - stored.at < QUEUE_MIN_INTERVAL_MS) return stored;
    return fetchQueues(deps, "page-load");
  }
  function syncQueuesOnUserClick(deps) {
    return fetchQueues(deps, "user-sync");
  }

  // src/data/bonuses.ts
  var SPECIES_BONUSES_PATH = "/game/index.php?page=componentOnly&component=externaldataexport&action=speciesBonuses&asJson=1";
  var LF_BONUS_KEY = "lf.bonuses";
  var ITEMS_KEY = "items.active";
  var EXPEDITION_ITEMS = {
    "83e5d5b5e3e6ba16eb73edd6731a25ed1feff8a1": 0.1,
    f2f1bf68ded681adf6b45b24a8084b3861a5ce94: 0.15,
    d831a85f8f53defc3e51b7551401b21fb98c28ad: 0.2,
    fd38bf4fa0e07377c2a18556424eee14a6700654: 0.25,
    "7e05baae79bde905f5b2c89bb881d7ff04e8fa73": 0.3,
    "23c859c9f8b4ea7c562719ac829bfc9799250b33": 0.35,
    a5ab323cadd8c172957451f8ddd9950f1c101966: 0.4,
    "6c482898a61fa9ad20e9ce330975f07aa1f76520": 0.15,
    "335efdb763687e956dfe6a330ceddd32f174d753": 0.2,
    "75154767d49fc6867c9d7465a095371993377c88": 0.25,
    b9d9a0d57544363a4ac5531fa01f4b0b17256e24: 0.3,
    edd5cb7bfed46a64d4351fa6f4ef2076dc305e10: 0.35,
    "505fa6275e34b816d5059e26632dcaa8c18bde9a": 0.4,
    "586b20cfd60ef85c6670b62435ca2f44f1071bd8": 0.1,
    e4b33192361f45f4c61691844d0e8ec95fa5a231: 0.15,
    "03ece11ef535f5ef49b203ff50a0466fda5a76e2": 0.2,
    "0049d2538081bea1dc5264a2899a194fe79107f1": 0.25,
    "5e42748915b5cab0ca7fd8e58e842ae9abb12745": 0.3,
    "2466f93d624ef96ffcc9e36f8c953699f525a5eb": 0.35,
    "3876b353a7f99b28520a82df01cd86c31b4cbfe0": 0.4,
    be998009fff22d7eea987cf974a25cacc06d330c: 0.1,
    "93eab867affae30157fc660899d9eac7d3b4f971": 0.15,
    "01c49a959ed989bd1b86abf0526f91ac0b716bfe": 0.2,
    "4cfd5bef27f891a1608b0d1e595cf8bf8cb144c0": 0.25,
    "9c069cb845b9225f9bb191f15d4f6abb0e7e144e": 0.3,
    "1b709fc34003e171528ec345430cbb2e3aa090e5": 0.35,
    b0f6477d68c9683170cb8d32be2df1177669c5a0: 0.4
  };
  function parseSpeciesBonuses(json2, at) {
    const data = (json2 ?? {}).data;
    const value = Number(data?.expedition?.ResultBooster?.totalBonus?.ResultBooster);
    return { expedition: Number.isFinite(value) && value > 0 ? value : 0, at };
  }
  var sessionKey2 = (store) => `${store.namespace}:lf.hydrated`;
  async function fetchLfBonuses(deps, reason, now = Date.now()) {
    const response = await deps.guard.request(SPECIES_BONUSES_PATH, reason);
    const bonuses = parseSpeciesBonuses(await response.json(), now);
    deps.store.set(LF_BONUS_KEY, bonuses);
    return bonuses;
  }
  async function hydrateLfOncePerSession(deps) {
    const stored = deps.store.get(LF_BONUS_KEY, null);
    if (stored && deps.session.getItem(sessionKey2(deps.store)) === "1") return stored;
    const fresh = await fetchLfBonuses(deps, "page-load");
    deps.session.setItem(sessionKey2(deps.store), "1");
    return fresh;
  }
  function readActiveItems(doc, now = Date.now()) {
    const bar = doc.getElementById("buffBar");
    if (!bar) return null;
    const uuids = Array.from(bar.querySelectorAll("[data-uuid]")).map((e) => e.dataset.uuid ?? "").filter((u) => /^[0-9a-f]{40}$/.test(u));
    return { uuids: [...new Set(uuids)], at: now };
  }
  function expeditionItemBoost(items) {
    return (items?.uuids ?? []).reduce((sum, u) => sum + (EXPEDITION_ITEMS[u] ?? 0), 0);
  }

  // src/core/sheet.ts
  var WINDOW_SHEET = `
:host {
  all: initial;
  --bg: #0B121D; --surface: #0D1522; --raised: #111B2A; --line: #1F2C40; --line-soft: #16202F;
  --text: #E6EDF5; --text-2: #C9D4E2; --muted: #8A9BB0; --faint: #4A5B72;
  --accent: #4FD1E8; --accent-soft: #12283A; --warn: #F5B547; --ok: #4FE0B0; --bad: #FF7A7A;
  --m: #B8C2CC; --c: #7FB8FF; --d: #4FE0B0; --dm: #B58CDB;
  --mono: Consolas, "JetBrains Mono", monospace;
  --panel-w: 860px;
}
* { box-sizing: border-box; }
.backdrop {
  position: fixed; inset: 0; z-index: 1000001; display: flex; justify-content: center; align-items: flex-start;
  padding: 40px 16px; background: rgba(3,6,12,0.72); overflow-y: auto;
  font: 12px/1.35 Arial, Helvetica, sans-serif; color: var(--text-2);
}
/* The planet menu's language: a dark column of tiles (#111B2A, hairline #1F2C40, 6-7px corners),
   small grey labels, monospace numbers, cyan for what is selected. */
.panel {
  width: min(var(--panel-w), 100%); display: flex; flex-direction: column; gap: 8px; padding: 8px;
  border: 1px solid var(--line); border-radius: 9px; background: var(--bg); box-shadow: 0 20px 60px rgba(0,0,0,0.6);
}
.head { display: flex; align-items: center; gap: 10px; min-height: 38px; padding: 4px 4px 4px 12px; border: 1px solid var(--line); border-radius: 7px; background: var(--raised); }
.titles { flex: 1; display: flex; align-items: baseline; flex-wrap: wrap; gap: 2px 10px; min-width: 0; }
h2 { margin: 0; font-size: 14px; font-weight: 700; color: var(--text); }
h3 { margin: 0 0 6px; font-size: 12px; font-weight: 700; color: var(--text); }
h4 { margin: 10px 0 4px; font-size: 11px; font-weight: 700; color: var(--text-2); }
.sub { color: var(--muted); font-size: 11px; }
.close {
  flex: none; width: 28px; height: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center;
  border-radius: 5px; border: 0; background: none; color: var(--muted); line-height: 1; cursor: pointer;
}
.close:hover { background: #16243A; color: var(--text); }
.mono { font-family: var(--mono); }
.m { color: var(--m); } .c { color: var(--c); } .d { color: var(--d); } .dm { color: var(--dm); }
.neg { color: var(--bad); } .pos { color: var(--ok); }

/* Tabs: one segmented strip, the one in use lit like the selected planet. */
.tabs { display: flex; flex-wrap: wrap; gap: 0; border: 1px solid var(--line); border-radius: 7px; background: var(--bg); overflow: hidden; }
.tab { flex: 1 0 auto; height: 28px; padding: 0 12px; border: 0; border-right: 1px solid var(--line); background: none; color: var(--muted); font: 12px Arial, sans-serif; cursor: pointer; }
.tab:last-child { border-right: 0; }
.tab:hover { background: #111D2D; color: var(--text); }
.tab[aria-pressed="true"] { background: var(--accent-soft); color: var(--text); font-weight: 700; box-shadow: inset 0 -2px 0 var(--accent); }

/* Key numbers: the planet menu toolbar, one cell each. */
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0; border: 1px solid var(--line); border-radius: 7px; background: var(--raised); overflow: hidden; }
.kpi { display: flex; flex-direction: column; gap: 1px; padding: 6px 10px 7px; min-width: 0; box-shadow: 1px 0 0 var(--line), 0 1px 0 var(--line); }
.kpi .label { color: var(--muted); font-size: 10px; }
.kpi .value { font: 700 15px/18px var(--mono); color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.kpi .note, .kpi .detail { color: var(--muted); font-size: 10px; }
.kpi.accent .value { color: var(--accent); }
.kpi.warn .value { color: var(--warn); }

/* Sections: tiles, like the planet rows. */
.card { padding: 8px 10px; border: 1px solid var(--line); border-radius: 7px; background: var(--raised); min-width: 0; }
.hint { margin: 6px 0 0; color: var(--muted); font-size: 10px; }
.empty { margin: 0; padding: 14px; text-align: center; color: var(--muted); border: 1px dashed var(--line); border-radius: 7px; }

/* Buttons: the settings chips. One filled action, ghost for the rest. */
.act { height: 24px; padding: 0 10px; border: 1px solid #2B6F7D; border-radius: 5px; background: var(--accent-soft); color: var(--text); font: 700 11px Arial, sans-serif; cursor: pointer; }
.act:hover { border-color: var(--accent); }
.act.ghost { border-color: var(--line); background: #0A111C; color: #B4C2D3; font-weight: 400; }
.act.ghost:hover, .act.danger { border-color: var(--bad); color: var(--bad); }

/* Browser surfaces. */
button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible { outline: 1px solid var(--accent); outline-offset: 1px; }
.backdrop, .scroll, .table-wrap { scrollbar-color: #2A3B55 var(--bg); scrollbar-width: thin; }
::selection { background: #2B6F7D; color: #fff; }
.num, td, .value, .kpi-line { font-variant-numeric: tabular-nums; }
`;

  // src/engines/account.ts
  var KEYS2 = ["metal", "crystal", "deuterium"];
  var msu = (r) => r.metal + r.crystal * 1.5 + r.deuterium * 3;
  function bodyRows(snapshot, entries, now, queues = null) {
    if (!snapshot) return [];
    const byId = new Map(snapshot.bodies.map((b) => [b.id, b]));
    const rows = [];
    for (const entry of entries) {
      for (const type of ["planet", "moon"]) {
        const id = type === "planet" ? entry.planetId : entry.moonId;
        const body = id ? byId.get(id) : void 0;
        if (!body) continue;
        const amount = estimateResources(body, now);
        const cap = effectiveStorage(body);
        const perHour = type === "planet" ? { ...body.production } : { metal: 0, crystal: 0, deuterium: 0 };
        const toFull = (k) => {
          if (cap[k] <= 0) return null;
          if (amount[k] >= cap[k]) return 0;
          return perHour[k] > 0 ? (cap[k] - amount[k]) / perHour[k] : null;
        };
        rows.push({
          id: body.id,
          type,
          name: type === "planet" ? entry.name || body.name : body.name || entry.name,
          coords: entry.coords || body.coords,
          amount,
          perHour,
          fill: storageFill(body, amount),
          hoursToFull: { metal: toFull("metal"), crystal: toFull("crystal"), deuterium: toFull("deuterium") },
          ageMinutes: Math.max(0, Math.floor((now - body.resourcesAt) / 6e4)),
          mines: { metal: body.levels["1"] ?? 0, crystal: body.levels["2"] ?? 0, deuterium: body.levels["3"] ?? 0 },
          idle: type !== "planet" ? null : queues ? !activeItems(queues.bodies[String(body.id)], now).some((i) => i.kind === "building" || i.kind === "lfbuilding") : !entry.construction.planet
        });
      }
    }
    return rows;
  }
  function summarize(rows) {
    const stock2 = { metal: 0, crystal: 0, deuterium: 0 };
    const perHour = { metal: 0, crystal: 0, deuterium: 0 };
    for (const row of rows) for (const k of KEYS2) {
      stock2[k] += row.amount[k];
      perHour[k] += row.perHour[k];
    }
    return {
      stock: stock2,
      perHour,
      planets: rows.filter((r) => r.type === "planet").length,
      moons: rows.filter((r) => r.type === "moon").length,
      idle: rows.filter((r) => r.idle === true).length
    };
  }
  var SOON_FULL_HOURS = 6;
  var STALE_MINUTES = 60;
  function accountAlerts(rows, snapshot, entries) {
    const label = (r) => `${r.name} [${r.coords}]`;
    const known = new Set((snapshot?.bodies ?? []).map((b) => b.id));
    const missing2 = entries.filter((e) => e.planetId && !known.has(e.planetId) || e.moonId && !known.has(e.moonId));
    const planets = rows.filter((r) => r.type === "planet");
    const minHours = (r) => {
      const hours = KEYS2.map((k) => r.hoursToFull[k]).filter((h6) => h6 !== null);
      return hours.length ? Math.min(...hours) : null;
    };
    const full = planets.filter((r) => minHours(r) === 0 || r.fill !== null && KEYS2.some((k) => r.fill[k] >= 0.9));
    const soon = planets.filter((r) => !full.includes(r) && (minHours(r) ?? Infinity) <= SOON_FULL_HOURS);
    const idle = planets.filter((r) => r.idle === true);
    const stale = rows.filter((r) => r.ageMinutes > STALE_MINUTES);
    const out = [];
    const push = (level2, key2, list) => {
      if (list.length) out.push({ level: level2, key: key2, count: list.length, names: list.map(label) });
    };
    push("warn", "alert.missing", missing2);
    push("warn", "alert.full", full);
    push("warn", "alert.soonFull", soon);
    push("info", "alert.idle", idle);
    push("info", "alert.stale", stale);
    return out;
  }

  // src/modules/planet-menu/style.ts
  var MENU_WIDTH = 228;
  var NATIVE_WIDTH = 137;
  var L = "#planetbarcomponent #planetList.fut-menu";
  var MOON_W = 68;
  var PLANET_MENU_CSS = `
#planetbarcomponent.fut-wide #rechts,
#planetbarcomponent.fut-wide #cutty,
#planetbarcomponent.fut-wide #myPlanets { width: ${MENU_WIDTH}px !important; }

/* GRAY AREA: requires ToolDev approval before publishing \u2014 see AGENTS.md \xA71.7 / \xA73.
   The wider menu would sit under the skyscraper banner, so the banner is shifted right
   by exactly the extra width, as tolerated OGLight does (margin-left on the banner
   component). The banner is never hidden, resized, faded or covered. */
body.fut-banner-shift #bannerskyscrapercomponent { margin-left: ${MENU_WIDTH - NATIVE_WIDTH + 8}px !important; }

/* The colony counter makes room for Future's toolbar, as OGLight does (#countColonies hidden);
   the count stays available in the toolbar tooltip and in the settings panel. */
body.fut-on #planetbarcomponent #countColonies { display: none !important; }

#planetbarcomponent:not(.fut-wide) #planetList.fut-menu,
#planetbarcomponent:not(.fut-wide) .fut-toolbar,
#planetbarcomponent:not(.fut-wide) .fut-settings,
#planetbarcomponent:not(.fut-wide) .fut-totals { width: ${NATIVE_WIDTH}px !important; }
${L} { width: 100% !important; display: flex !important; flex-direction: column; gap: 2px; padding: 0 !important; background: none !important; }
${L} .smallplanet.fut-row {
  position: relative !important; display: flex !important; flex-direction: row; align-items: stretch;
  width: 100% !important; height: 40px !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important;
  border: 1px solid #1F2C40; border-radius: 7px; background: #111B2A !important; overflow: hidden; box-sizing: border-box;
}
${L} .smallplanet.fut-current { border-color: #2C5A73; }

/* Planet: small skin behind name and coords, resources in a column on the right. */
${L} a.planetlink {
  position: relative !important; display: flex !important; align-items: center; gap: 3px;
  left: auto !important; top: auto !important; flex: 1; min-width: 0; width: auto !important; height: 100% !important;
  padding: 0 4px 0 28px !important; margin: 0 !important; box-sizing: border-box; overflow: hidden !important;
  background: none !important; text-decoration: none !important;
}
${L} a.planetlink:hover { background: rgba(79,209,232,0.08) !important; }
${L} a.planetlink .planetBarSpaceObjectContainer {
  position: absolute !important; left: -6px !important; top: 0 !important;
  width: 40px !important; height: 40px !important; margin: 0 !important; opacity: 0.85;
}
${L} .planetBarSpaceObjectHighlightContainer { display: none !important; }
${L} a.planetlink img.planetPic { position: static !important; width: 40px !important; height: 40px !important; margin: 0 !important; }
${L} .fut-name {
  position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column;
  text-shadow: 0 1px 2px #000, 0 0 4px #000, 0 0 6px #000;
}
${L} .fut-name .planet-name,
${L} .fut-name .planet-koords {
  position: static !important; display: block !important; margin: 0 !important; padding: 0 !important;
  width: auto !important; max-width: none !important; height: auto !important; line-height: 1.15 !important;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left !important; background: none !important;
}
${L} .fut-name .planet-name { font: 700 12px Arial, sans-serif !important; color: #E6EDF5 !important; }
${L} .fut-name .planet-koords { font: 11px monospace !important; color: #C9D4E2 !important; }

/* Resources: one per line (metal, crystal, deuterium). */
${L} .fut-res {
  position: relative; flex-shrink: 0; width: 50px; display: flex; flex-direction: column; justify-content: center;
  gap: 0; font: 11px/12px monospace; text-align: right;
}
${L} .fut-cell { display: block; padding: 0 2px; border-radius: 2px; white-space: nowrap; overflow: hidden; }
/* Storage fill painted behind the number (planets only): no extra space needed. */
${L} .fut-cell.fut-has-fill {
  background: linear-gradient(90deg, color-mix(in srgb, currentColor 26%, transparent) var(--fut-fill),
    rgba(255,255,255,0.04) var(--fut-fill)) !important;
}
${L} .fut-m, .fut-totals .fut-m { color: #B8C2CC; }
${L} .fut-c, .fut-totals .fut-c { color: #7FB8FF; }
${L} .fut-d, .fut-totals .fut-d { color: #4FE0B0; }
${L} .fut-full { color: #F5B547 !important; font-weight: 700; }
${L} .fut-missing { color: #8A9BB0; }

/* Moon: its own tile on the right of the same row. */
${L} a.moonlink {
  position: relative !important; display: flex !important; align-items: center; justify-content: flex-end;
  left: auto !important; top: auto !important; right: auto !important; bottom: auto !important;
  flex-shrink: 0; width: ${MOON_W}px !important; height: 100% !important; margin: 0 !important; padding: 0 2px 0 0 !important;
  box-sizing: border-box; background: #16243A !important; border-left: 1px solid #22344F; text-decoration: none !important;
}
${L} a.moonlink:hover { background: #1D3350 !important; }
${L} a.moonlink .planetBarSpaceObjectContainer {
  position: absolute !important; left: 3px !important; top: 6px !important; width: 16px !important; height: 16px !important;
  display: flex !important; align-items: center; justify-content: center; margin: 0 !important;
}
${L} a.moonlink img.icon-moon { position: static !important; width: 16px !important; height: 16px !important; margin: 0 !important; }
${L} a.moonlink .fut-res { width: 46px; }
${L} .fut-nomoon { flex-shrink: 0; width: ${MOON_W}px; border-left: 1px solid #1A2638; background: #0D1522; }

/* Skin that failed to load (game CDN 502): a plain sphere keeps the row's shape. */
${L} img.fut-noskin { visibility: hidden; }
${L} .planetBarSpaceObjectContainer:has(img.fut-noskin) {
  border-radius: 50%; background: radial-gradient(circle at 35% 35%, #8A9BB0, #2A3A50 65%, #0A111C) !important;
}

/* Selection: the body you are on (planet OR moon) gets a cyan frame and a bar on the left. */
${L} a.planetlink.active, ${L} a.moonlink.active {
  background: rgba(79,209,232,0.18) !important; box-shadow: inset 0 0 0 1px #4FD1E8, inset 3px 0 0 #4FD1E8 !important;
}
${L} a.planetlink.active .planet-name { color: #8BE4F2 !important; }

/* Data age: minutes since this body's numbers were last read (green < 15, amber < 30, red after). */
${L} .fut-age {
  position: absolute; left: 1px; top: 1px; z-index: 2; min-width: 14px; padding: 0 2px; border-radius: 4px;
  font: 700 10px/12px Arial, sans-serif; text-align: center; background: rgba(5,10,18,0.8); pointer-events: none;
}
${L} a.moonlink .fut-age { left: 1px; top: auto; bottom: 1px; }
${L} .fut-age-fresh { color: #38C56E; }
${L} .fut-age-warm { color: #E3BB28; }
${L} .fut-age-old { color: #EF7676; }

/* Running queues: one coloured stripe per kind (OGLight colours), details in the tooltip. */
${L} .fut-queue { display: flex; gap: 2px; margin-top: 2px; height: 3px; }
${L} .fut-q { display: block; width: 12px; height: 3px; border-radius: 2px; background: currentColor; }
${L} a.moonlink .fut-queue { position: absolute; left: 3px; bottom: 3px; margin: 0; }
${L} a.moonlink .fut-q { width: 8px; }
${L} .fut-q-building { color: #FF8200; }
${L} .fut-q-research { color: #32FB2F; }
${L} .fut-q-ship { color: #FFEB00; }
${L} .fut-q-lfbuilding { color: #FF79BD; }
${L} .fut-q-lfresearch { color: #42AFFF; }

/* Queue: the game's own construction icon (kept clickable) on the skin, or an amber dot when idle. */
${L} .smallplanet .constructionIcon,
${L} .smallplanet a.alert {
  position: absolute !important; left: 1px !important; top: auto !important; bottom: 1px !important; right: auto !important; z-index: 2;
  width: 12px !important; height: 12px !important; border-radius: 50%;
  background-color: rgba(79,209,232,0.35) !important; box-shadow: 0 0 0 1px #0A111C;
}
${L} .smallplanet a.constructionIcon.moon { left: auto !important; right: 2px !important; top: 1px !important; bottom: auto !important; }
${L} .fut-idle {
  position: absolute; left: 3px; bottom: 3px; width: 6px; height: 6px; border-radius: 50%;
  background: #F5B547; box-shadow: 0 0 0 1px #0A111C;
}

/* Compact: the game's width, 30px rows, no numbers, moon as a square button. */
${L}.fut-mode-compact .smallplanet.fut-row { height: 34px !important; }
${L}.fut-mode-compact a.planetlink { padding-left: 30px !important; }
${L}.fut-mode-compact a.planetlink .planetBarSpaceObjectContainer,
${L}.fut-mode-compact a.planetlink img.planetPic { width: 36px !important; height: 36px !important; }
${L}.fut-mode-compact .fut-name .planet-name { font-size: 11px !important; }
${L}.fut-mode-compact .fut-name .planet-koords { font-size: 10px !important; }
${L}.fut-mode-compact .fut-res,
${L}.fut-mode-compact .fut-nomoon { display: none; }
${L}.fut-mode-compact a.moonlink { width: 32px !important; padding: 0 !important; }
${L}.fut-mode-compact a.moonlink .planetBarSpaceObjectContainer { left: 6px !important; top: 7px !important; width: 18px !important; height: 18px !important; }
${L}.fut-mode-compact a.moonlink img.icon-moon { width: 18px !important; height: 18px !important; }

/* Toolbar: replaces the colony counter. Three data buttons, then sync and settings stacked. */
#planetbarcomponent .fut-toolbar {
  box-sizing: border-box; display: grid !important; height: auto !important; padding: 0 !important; grid-template-columns: repeat(2, minmax(0, 1fr)) 24px; margin: 0 0 3px;
  border: 1px solid #1F2C40; border-radius: 6px; background: #0B121D; overflow: hidden;
}
#planetbarcomponent .fut-cell {
  box-sizing: border-box !important; height: auto !important; width: auto !important; box-shadow: none !important; border-radius: 0 !important; font: inherit;
  display: flex; flex-direction: column; align-items: flex-start; gap: 1px; min-width: 0; padding: 4px 6px 5px; margin: 0;
  border: 0 !important; border-right: 1px solid #1F2C40 !important; border-bottom: 1px solid #1F2C40 !important; background: none !important; color: inherit; text-align: left; cursor: pointer;
}
#planetbarcomponent .fut-toolbar > .fut-cell:nth-child(n+3) { border-bottom: 0 !important; }
#planetbarcomponent .fut-cell:hover:not(:disabled) { background: #111D2D !important; }
#planetbarcomponent .fut-cell:hover:not(:disabled) .fut-cell-k { color: #C9D4E2; }
#planetbarcomponent .fut-cell:focus-visible, #planetbarcomponent .fut-tool:focus-visible { outline: 1px solid #4FD1E8; outline-offset: -2px; }
#planetbarcomponent .fut-cell:disabled { cursor: default; }
#planetbarcomponent .fut-cell-k { max-width: 100%; font: 10px/12px Arial, sans-serif; color: #8A9BB0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#planetbarcomponent .fut-cell-v { max-width: 100%; font: 700 12px/14px Consolas, "JetBrains Mono", monospace; color: #E6EDF5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#planetbarcomponent .fut-cell-v.fut-warn { color: #F5B547; } .fut-cell-v.fut-ok { color: #4FE0B0; }
#planetbarcomponent .fut-side { display: flex; flex-direction: column; grid-column: 3; grid-row: 1 / span 2; }
#planetbarcomponent .fut-tool {
  position: relative; flex: 1; display: flex; align-items: center; justify-content: center; width: 100%; padding: 0;
  border: 0 !important; border-radius: 0 !important; background: none !important; box-shadow: none !important; color: #8A9BB0; cursor: pointer; height: auto !important; min-height: 0 !important;
}
#planetbarcomponent .fut-tool + .fut-tool { border-top: 1px solid #1F2C40 !important; }
#planetbarcomponent .fut-tool svg { width: 11px; height: 11px; }
#planetbarcomponent .fut-tool:hover { background: #111D2D !important; color: #E6EDF5; }
#planetbarcomponent .fut-tool:disabled { opacity: 0.35; cursor: default; background: none; }
#planetbarcomponent .fut-tool[aria-expanded="true"] { background: #12283A !important; color: #4FD1E8; }
#planetbarcomponent .fut-tool.fut-stale { color: #F5B547; }
#planetbarcomponent .fut-tool.fut-busy svg { animation: fut-spin 1s linear infinite; }
#planetbarcomponent:not(.fut-wide) .fut-cell { padding: 3px 3px 4px; }
#planetbarcomponent:not(.fut-wide) .fut-cell-v { font-size: 10px; }
#planetbarcomponent:not(.fut-wide) .fut-cell-k { font-size: 10px; }
@keyframes fut-spin { to { transform: rotate(360deg); } }

.fut-settings {
  box-sizing: border-box; margin: 0 0 3px; padding: 6px 8px; border: 1px solid #1F2C40; border-radius: 7px;
  background: #111B2A; font: 11px Arial, sans-serif; color: #C9D4E2; display: flex; flex-direction: column; gap: 5px;
}
.fut-settings[hidden] { display: none; }
.fut-set-row { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.fut-set-label { flex: 1 0 100%; color: #8A9BB0; }
.fut-chip {
  flex: 1; height: 22px; border-radius: 5px; border: 1px solid #1F2C40; background: #0A111C;
  color: #B4C2D3; font: 11px Arial, sans-serif; cursor: pointer;
}
.fut-chip[aria-pressed="true"] { border-color: #4FD1E8; background: #12283A; color: #E6EDF5; font-weight: 700; }
.fut-chip:disabled { opacity: 0.4; cursor: default; }
.fut-set-note { color: #8A9BB0; }

.fut-totals {
  box-sizing: border-box; margin-top: 4px; padding: 6px 8px; border-radius: 7px;
  border: 1px solid #1F2C40; background: #111B2A; display: grid; grid-template-columns: 1fr auto;
  gap: 2px 6px; font: 11px monospace;
}
.fut-totals .fut-rate { color: #8A9BB0; text-align: right; }
.fut-totals .fut-msu { color: #4FD1E8; }
`;

  // src/modules/planet-menu/index.ts
  var STYLE_ID = "fut-planet-menu-style";
  var panelOpen = false;
  var ICONS = {
    journal: '<path d="M5 3.5h11a3 3 0 0 1 3 3V20.5H8a3 3 0 0 1-3-3z" fill="none" stroke-width="2"/><path d="M5 17.5a3 3 0 0 1 3-3h11" fill="none" stroke-width="2"/><path stroke="none" d="M9.5 6.5l1 2.2 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3L6.2 9l2.3-.3z"/>',
    planner: '<path d="M9 6h11M9 12h11M9 18h11" fill="none" stroke-width="2.2"/><path stroke="none" d="M3 4.5h3v3H3zM3 10.5h3v3H3zM3 16.5h3v3H3z"/>',
    dashboard: '<path stroke="none" d="M3 3h8v10H3zM13 3h8v6h-8zM13 11h8v10h-8zM3 15h8v6H3z"/>',
    side: '<path stroke="none" d="M2 5h12v14H2zM16 5h6v14h-6z"/>',
    compact: '<path stroke="none" d="M3 4h18v3H3zM3 10.5h18v3H3zM3 17h18v3H3z"/>',
    sync: '<path d="M20 12a8 8 0 0 1-14.3 4.9M4 12a8 8 0 0 1 14.3-4.9" fill="none" stroke-width="2.2"/><path d="M19 3v5h-5M5 21v-5h5" fill="none" stroke-width="2.2"/>',
    settings: '<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" fill="none" stroke-width="2.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" fill="none" stroke-width="2.2"/>'
  };
  function el2(doc, tag, className, text) {
    const node = doc.createElement(tag);
    node.className = className;
    if (text !== void 0) node.textContent = text;
    return node;
  }
  function iconButton2(doc, icon2, title, onClick) {
    const button3 = el2(doc, "button", `fut-tool fut-tool-${icon2}`);
    button3.type = "button";
    button3.title = title;
    button3.setAttribute("aria-label", title);
    button3.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor" stroke="currentColor">${ICONS[icon2]}</svg>`;
    button3.addEventListener("click", (event) => {
      event.preventDefault();
      onClick();
    });
    return button3;
  }
  function resourceColumn(doc, body, now, locale, withStorage) {
    const box = el2(doc, "span", "fut-res");
    if (!body) {
      for (const cls of ["fut-m", "fut-c", "fut-d"]) box.append(el2(doc, "span", `fut-cell ${cls} fut-missing`, "\u2014"));
      return box;
    }
    const amount = estimateResources(body, now);
    const fill = withStorage ? storageFill(body, amount) : null;
    const cell = (key2, cls) => {
      const full = fill !== null && fill[key2] >= 0.9;
      const node = el2(doc, "span", full ? `fut-cell ${cls} fut-full` : `fut-cell ${cls}`, formatUnits(amount[key2], locale));
      if (fill !== null) {
        const pct = Math.round(fill[key2] * 100);
        node.style.setProperty("--fut-fill", `${pct}%`);
        node.classList.add("fut-has-fill");
        node.title = `${pct}%`;
      }
      box.append(node);
    };
    cell("metal", "fut-m");
    cell("crystal", "fut-c");
    cell("deuterium", "fut-d");
    return box;
  }
  function guardSkin(img) {
    if (img.dataset.futSkin) return;
    img.dataset.futSkin = "1";
    const fail = () => {
      const fallback = img.dataset.defaultSrc;
      if (fallback && img.dataset.futSkin === "1" && img.getAttribute("src") !== fallback) {
        img.dataset.futSkin = "retry";
        img.src = fallback;
        return;
      }
      img.classList.add("fut-noskin");
    };
    img.addEventListener("error", fail);
    img.addEventListener("load", () => img.classList.remove("fut-noskin"));
    if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) fail();
  }
  function dataAge(resourcesAt, now) {
    const minutes = Math.max(0, Math.floor((now - resourcesAt) / 6e4));
    const cls = minutes < 15 ? "fut-age-fresh" : minutes <= 30 ? "fut-age-warm" : "fut-age-old";
    const text = minutes < 60 ? String(minutes) : minutes < 1440 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 1440)}d`;
    return { text, cls };
  }
  function ageBadge(doc, body, now, t) {
    if (!body || !body.resourcesAt) return null;
    const { text, cls } = dataAge(body.resourcesAt, now);
    const badge = el2(doc, "span", `fut-age ${cls}`, text);
    badge.dataset.at = String(body.resourcesAt);
    badge.title = t("planetMenu.age");
    return badge;
  }
  var ageTimer = null;
  function startAgeClock(doc) {
    if (ageTimer !== null) return;
    ageTimer = setInterval(() => {
      doc.querySelectorAll(".fut-age").forEach((badge) => {
        const { text, cls } = dataAge(Number(badge.dataset.at), Date.now());
        badge.textContent = text;
        badge.className = `fut-age ${cls}`;
      });
    }, 6e4);
  }
  function remaining(end, now) {
    const min = Math.max(0, Math.round((end - now) / 6e4));
    if (min < 60) return `${min}m`;
    const hours = Math.floor(min / 60);
    return hours < 48 ? `${hours}h ${String(min % 60).padStart(2, "0")}m` : `${Math.floor(hours / 24)}d ${hours % 24}h`;
  }
  function queueStripes(doc, items, now, t, locale) {
    if (!items.length) return null;
    const box = el2(doc, "span", "fut-queue");
    box.title = items.map((i) => `${t(`queue.${i.kind}`)}: ${queueLabel(i, locale)} \xB7 ${remaining(i.end, now)}`).join("\n");
    for (const i of items) box.append(el2(doc, "span", `fut-q fut-q-${i.kind}`));
    return box;
  }
  function clearPlanetMenu(doc) {
    doc.querySelectorAll(".fut-res, .fut-moon-label, .fut-menu-bar, .fut-toolbar, .fut-settings, .fut-totals, .fut-idle, .fut-nomoon, .fut-age, .fut-queue").forEach((n) => n.remove());
    doc.querySelectorAll(".fut-name").forEach((wrap) => wrap.replaceWith(...Array.from(wrap.childNodes)));
    doc.querySelectorAll(".fut-row").forEach((n) => n.classList.remove("fut-row", "fut-current", "fut-building"));
  }
  function canWiden(doc) {
    const banner = doc.getElementById("bannerskyscrapercomponent");
    const view = doc.documentElement.clientWidth;
    if (!banner) return true;
    const rect = banner.getBoundingClientRect();
    const shifted = rect.right + (MENU_WIDTH - NATIVE_WIDTH + 8);
    return rect.width === 0 || shifted <= view;
  }
  function formatTime(at, locale) {
    return new Date(at).toLocaleString(locale, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }
  function toolbar(o, colonies) {
    const { doc, t } = o;
    const bar = el2(doc, "div", "fut-toolbar");
    if (colonies) bar.title = colonies;
    const fmt = (n) => formatUnits(n, o.locale);
    const msu4 = (r) => r.metal + r.crystal * 1.5 + r.deuterium * 3;
    const cell = (label, value, cls, title, onClick) => {
      const b = el2(doc, "button", "fut-cell");
      b.type = "button";
      b.title = title;
      b.append(el2(doc, "span", "fut-cell-k", label), el2(doc, "span", `fut-cell-v ${cls}`.trim(), value));
      if (onClick) b.addEventListener("click", onClick);
      else b.disabled = true;
      bar.append(b);
    };
    const perDay = o.snapshot ? msu4(totals(o.snapshot, o.now).perHour) * 24 : null;
    cell(t("bar.dash"), perDay === null ? "\u2014" : `+${fmt(perDay)}${t("bar.perDay")}`, "", `${t("dash.title")}${perDay === null ? "" : ` \xB7 ${t("bar.dashHint")}`}`, o.onOpenDashboard);
    const count2 = o.planCount ?? 0;
    const gap = o.planGap;
    const planValue = !count2 ? "\u2014" : gap === null || gap === void 0 ? "?" : gap > 0 ? `\u2212${fmt(gap)}` : t("bar.ready");
    const planCls = !count2 || gap === null || gap === void 0 ? "" : gap > 0 ? "fut-warn" : "fut-ok";
    cell(count2 ? t("bar.plan", { n: count2 > 99 ? "99+" : count2 }) : t("bar.planEmpty"), planValue, planCls, `${t("plan.title")} \xB7 ${count2 && gap ? t("bar.planHint") : t("plan.title")}`, o.onOpenPlanner);
    const today = o.journalToday;
    cell(
      t("bar.journal"),
      today && today.count ? `${today.net >= 0 ? "+" : "\u2212"}${fmt(Math.abs(today.net))}` : "\u2014",
      today && today.count ? today.net >= 0 ? "fut-ok" : "fut-warn" : "",
      today && today.count ? `${t("exp.title")} \xB7 ${t("bar.journalHint", { n: today.count })}` : t("exp.title"),
      o.onOpenJournal
    );
    const marked = o.targetsCount ?? 0;
    cell(t("bar.targets"), marked ? String(marked) : "\u2014", "", t("bar.targetsHint"), o.onOpenTargets);
    const side = el2(doc, "div", "fut-side");
    const lastSync = o.snapshot ? t("toolbar.lastSync", { time: formatTime(o.snapshot.fetchedAt, o.locale) }) : "";
    const sync = iconButton2(doc, "sync", [t("sync.button"), lastSync].filter(Boolean).join(" \xB7 "), () => {
      if (sync.classList.contains("fut-busy")) return;
      sync.classList.add("fut-busy");
      o.onSync().finally(() => sync.classList.remove("fut-busy"));
    });
    if (!o.snapshot || o.now - o.snapshot.fetchedAt > 36e5) sync.classList.add("fut-stale");
    const gear = iconButton2(doc, "settings", t("toolbar.settings"), () => {
      panelOpen = !panelOpen;
      gear.setAttribute("aria-expanded", String(panelOpen));
      doc.querySelector(".fut-settings")?.toggleAttribute("hidden", !panelOpen);
    });
    gear.setAttribute("aria-expanded", String(panelOpen));
    side.append(sync, gear);
    bar.append(side);
    return bar;
  }
  function settingsPanel(o, mode, roomy, colonies) {
    const { doc, t } = o;
    const panel = el2(doc, "div", "fut-settings");
    panel.toggleAttribute("hidden", !panelOpen);
    const row = (label, ...controls) => {
      const line = el2(doc, "div", "fut-set-row");
      line.append(el2(doc, "span", "fut-set-label", label), ...controls);
      panel.append(line);
    };
    const choice = (text, pressed, onClick, disabled = false) => {
      const b = el2(doc, "button", "fut-chip", text);
      b.type = "button";
      b.setAttribute("aria-pressed", String(pressed));
      b.disabled = disabled;
      b.addEventListener("click", onClick);
      return b;
    };
    row(
      t("settings.view"),
      choice(t("planetMenu.side"), mode === "side", () => o.onSettingsChange({ ...o.settings, mode: "side" }), !roomy),
      choice(t("planetMenu.compact"), mode === "compact", () => o.onSettingsChange({ ...o.settings, mode: "compact" }))
    );
    row(
      t("settings.totals"),
      choice(t("settings.on"), o.settings.showTotals, () => o.onSettingsChange({ ...o.settings, showTotals: true })),
      choice(t("settings.off"), !o.settings.showTotals, () => o.onSettingsChange({ ...o.settings, showTotals: false }))
    );
    row(
      t("settings.markIdle"),
      choice(t("settings.on"), o.settings.markIdle, () => o.onSettingsChange({ ...o.settings, markIdle: true })),
      choice(t("settings.off"), !o.settings.markIdle, () => o.onSettingsChange({ ...o.settings, markIdle: false }))
    );
    if (o.onBackupExport && o.onBackupImport) {
      const action = (text, onClick) => {
        const b = el2(doc, "button", "fut-chip", text);
        b.type = "button";
        b.addEventListener("click", onClick);
        return b;
      };
      const exportBackup2 = o.onBackupExport;
      const importBackup2 = o.onBackupImport;
      const note = el2(doc, "div", "fut-set-note");
      note.setAttribute("role", "status");
      const picker = el2(doc, "input", "");
      picker.type = "file";
      picker.accept = "application/json,.json";
      picker.hidden = true;
      picker.addEventListener("change", () => {
        const file = picker.files?.[0];
        picker.value = "";
        if (!file) return;
        file.text().then((text) => {
          note.textContent = t("settings.backupRestored", { n: importBackup2(text) });
        }).catch(() => {
          note.textContent = t("settings.backupBad");
        });
      });
      row(
        t("settings.backup"),
        action(t("settings.backupExport"), () => {
          note.textContent = t("settings.backupSaved", { n: exportBackup2() });
        }),
        action(t("settings.backupImport"), () => picker.click())
      );
      panel.append(picker, note);
    }
    if (colonies) panel.append(el2(doc, "div", "fut-set-note", colonies));
    if (o.snapshot) panel.append(el2(doc, "div", "fut-set-note", t("toolbar.lastSync", { time: formatTime(o.snapshot.fetchedAt, o.locale) })));
    return panel;
  }
  function renderPlanetMenu(o) {
    const { doc } = o;
    const list = doc.getElementById("planetList");
    if (!list) return;
    if (!doc.getElementById(STYLE_ID)) {
      const style = el2(doc, "style", "");
      style.id = STYLE_ID;
      style.textContent = PLANET_MENU_CSS;
      doc.head.append(style);
    }
    clearPlanetMenu(doc);
    const roomy = canWiden(doc);
    const mode = roomy ? o.settings.mode : "compact";
    const wide = mode === "side";
    doc.getElementById("planetbarcomponent")?.classList.toggle("fut-wide", wide);
    doc.body.classList.toggle("fut-banner-shift", wide);
    doc.body.classList.add("fut-on");
    list.classList.add("fut-menu");
    list.classList.toggle("fut-mode-compact", mode === "compact");
    list.classList.toggle("fut-mode-side", mode === "side");
    const byId = new Map((o.snapshot?.bodies ?? []).map((b) => [b.id, b]));
    for (const entry of o.entries) {
      entry.element.classList.add("fut-row");
      if (entry.current) entry.element.classList.add("fut-current");
      const link = entry.planetLink;
      if (link) {
        const wrap = el2(doc, "span", "fut-name");
        link.querySelectorAll(".planet-name, .planet-koords").forEach((n) => wrap.append(n));
        const planetBody = entry.planetId ? byId.get(entry.planetId) : void 0;
        link.append(wrap, resourceColumn(doc, planetBody, o.now, o.locale, true));
        const age = ageBadge(doc, planetBody, o.now, o.t);
        if (age) link.append(age);
        const pq = entry.planetId ? queueStripes(doc, activeItems(o.queues?.bodies[String(entry.planetId)], o.now), o.now, o.t, o.locale) : null;
        if (pq) wrap.append(pq);
        if (entry.construction.planet) entry.element.classList.add("fut-building");
        else if (o.settings.markIdle) {
          const idle = el2(doc, "span", "fut-idle");
          idle.title = o.t("planetMenu.idle");
          link.append(idle);
        }
      }
      const moon = entry.moonLink;
      if (moon) {
        const moonBody = entry.moonId ? byId.get(entry.moonId) : void 0;
        moon.append(resourceColumn(doc, moonBody, o.now, o.locale, false));
        const age = ageBadge(doc, moonBody, o.now, o.t);
        if (age) moon.append(age);
        const mq = entry.moonId ? queueStripes(doc, activeItems(o.queues?.bodies[String(entry.moonId)], o.now), o.now, o.t, o.locale) : null;
        if (mq) moon.append(mq);
      } else {
        link?.after(el2(doc, "span", "fut-nomoon"));
      }
      entry.element.querySelectorAll("img.planetPic, img.icon-moon").forEach(guardSkin);
    }
    startAgeClock(doc);
    const colonies = (doc.getElementById("countColonies")?.textContent ?? "").replace(/\s+/g, " ").trim();
    list.before(toolbar(o, colonies), settingsPanel(o, mode, roomy, colonies));
    if (o.snapshot && o.settings.showTotals) {
      const { stock: stock2, perHour } = totals(o.snapshot, o.now);
      const msu4 = (r) => r.metal + r.crystal * 1.5 + r.deuterium * 3;
      const box = el2(doc, "div", "fut-totals");
      const line = (label, value, rate, cls) => {
        box.append(el2(doc, "span", cls, `${label} ${formatUnits(value, o.locale)}`));
        box.append(el2(doc, "span", "fut-rate", `+${formatUnits(rate * 24, o.locale)}/24h`));
      };
      line(o.t("res.metal"), stock2.metal, perHour.metal, "fut-m");
      line(o.t("res.crystal"), stock2.crystal, perHour.crystal, "fut-c");
      line(o.t("res.deuterium"), stock2.deuterium, perHour.deuterium, "fut-d");
      line("MSU", msu4(stock2), msu4(perHour), "fut-msu");
      list.after(box);
    }
  }

  // src/engines/roi.ts
  var MINES = {
    metal: { id: "1", base: [60, 15], factor: 1.5 },
    crystal: { id: "2", base: [48, 24], factor: 1.6 },
    deuterium: { id: "3", base: [225, 75], factor: 1.5 }
  };
  var WEIGHT = { metal: 1, crystal: 1.5, deuterium: 3 };
  function mineCost(mine, level2) {
    const { base, factor } = MINES[mine];
    const k = Math.pow(factor, level2);
    return { metal: Math.floor(base[0] * k), crystal: Math.floor(base[1] * k), deuterium: 0 };
  }
  function mineGainRatio(level2) {
    if (level2 <= 0) return 0;
    return (level2 + 1) * 1.1 / level2 - 1;
  }
  function bestUpgrades(snapshot, entries, limit = 5) {
    if (!snapshot) return [];
    const byId = new Map(snapshot.bodies.map((b) => [b.id, b]));
    const moves = [];
    for (const entry of entries) {
      const body = entry.planetId ? byId.get(entry.planetId) : void 0;
      if (!body || body.type !== "planet") continue;
      for (const mine of Object.keys(MINES)) {
        const level2 = body.levels[MINES[mine].id] ?? 0;
        const ratio = mineGainRatio(level2);
        const gain = body.production[mine] * ratio;
        if (gain <= 0) continue;
        const cost = mineCost(mine, level2);
        const costMsu = cost.metal + cost.crystal * 1.5;
        const gainPerHour = gain * WEIGHT[mine];
        moves.push({
          planetId: body.id,
          name: entry.name || body.name,
          coords: entry.coords || body.coords,
          mine,
          from: level2,
          cost,
          costMsu,
          gainPerHour,
          days: costMsu / (gainPerHour * 24)
        });
      }
    }
    return moves.sort((a, b) => a.days - b.days).slice(0, limit);
  }

  // src/data/tech-table.ts
  var TECH_TABLE = {
    1: [60, 15, 0, 1.5, 0, 2, 0, 2],
    2: [48, 24, 0, 1.6, 0, 2, 0, 2],
    3: [225, 75, 0, 1.5, 0, 2, 0, 2],
    4: [75, 30, 0, 1.5, 0, 2, 0, 2],
    12: [900, 360, 180, 1.8, 0, 2, 0, 2],
    14: [400, 120, 200, 2, 0, 2, 0, 2],
    15: [1e6, 5e5, 1e5, 2, 0, 2, 0, 2],
    21: [400, 200, 100, 2, 0, 2, 0, 2],
    22: [1e3, 0, 0, 2, 0, 2, 0, 2],
    23: [1e3, 500, 0, 2, 0, 2, 0, 2],
    24: [1e3, 1e3, 0, 2, 0, 2, 0, 2],
    31: [200, 400, 200, 2, 0, 2, 0, 2],
    33: [0, 5e4, 1e5, 2, 1e3, 2, 0, 2],
    34: [2e4, 4e4, 0, 2, 0, 2, 0, 2],
    36: [200, 0, 50, 5, 50, 2.5, 0, 2],
    41: [2e4, 4e4, 2e4, 2, 0, 2, 0, 2],
    42: [2e4, 4e4, 2e4, 2, 0, 2, 0, 2],
    43: [2e6, 4e6, 2e6, 2, 0, 2, 0, 2],
    44: [2e4, 2e4, 1e3, 2, 0, 2, 0, 2],
    106: [200, 1e3, 200, 2, 0, 2, 0, 2],
    108: [0, 400, 600, 2, 0, 2, 0, 2],
    109: [800, 200, 0, 2, 0, 2, 0, 2],
    110: [200, 600, 0, 2, 0, 2, 0, 2],
    111: [1e3, 0, 0, 2, 0, 2, 0, 2],
    113: [0, 800, 400, 2, 0, 2, 0, 2],
    114: [0, 4e3, 2e3, 2, 0, 2, 0, 2],
    115: [400, 0, 600, 2, 0, 2, 0, 2],
    117: [2e3, 4e3, 600, 2, 0, 2, 0, 2],
    118: [1e4, 2e4, 6e3, 2, 0, 2, 0, 2],
    120: [200, 100, 0, 2, 0, 2, 0, 2],
    121: [1e3, 300, 100, 2, 0, 2, 0, 2],
    122: [2e3, 4e3, 1e3, 2, 0, 2, 0, 2],
    123: [24e4, 4e5, 16e4, 2, 0, 2, 0, 2],
    124: [4e3, 8e3, 4e3, 1.75, 0, 2, 0, 2],
    199: [0, 0, 0, 3, 3e5, 3, 0, 2],
    202: [2e3, 2e3, 0, 2, 0, 2, 0, 2],
    203: [6e3, 6e3, 0, 2, 0, 2, 0, 2],
    204: [3e3, 1e3, 0, 2, 0, 2, 0, 2],
    205: [6e3, 4e3, 0, 2, 0, 2, 0, 2],
    206: [2e4, 7e3, 2e3, 2, 0, 2, 0, 2],
    207: [45e3, 15e3, 0, 2, 0, 2, 0, 2],
    208: [1e4, 2e4, 1e4, 2, 0, 2, 0, 2],
    209: [1e4, 6e3, 2e3, 2, 0, 2, 0, 2],
    210: [0, 1e3, 0, 2, 0, 2, 0, 2],
    211: [5e4, 25e3, 15e3, 2, 0, 2, 0, 2],
    212: [0, 2e3, 500, 2, 0, 2, 0, 2],
    213: [6e4, 5e4, 15e3, 2, 0, 2, 0, 2],
    214: [5e6, 4e6, 1e6, 2, 0, 2, 0, 2],
    215: [3e4, 4e4, 15e3, 2, 0, 2, 0, 2],
    217: [2e3, 2e3, 1e3, 2, 0, 2, 0, 2],
    218: [85e3, 55e3, 2e4, 2, 0, 2, 0, 2],
    219: [8e3, 15e3, 8e3, 2, 0, 2, 0, 2],
    401: [2e3, 0, 0, 2, 0, 2, 0, 2],
    402: [1500, 500, 0, 2, 0, 2, 0, 2],
    403: [6e3, 2e3, 0, 2, 0, 2, 0, 2],
    404: [2e4, 15e3, 2e3, 2, 0, 2, 0, 2],
    405: [5e3, 3e3, 0, 2, 0, 2, 0, 2],
    406: [5e4, 5e4, 3e4, 2, 0, 2, 0, 2],
    407: [1e4, 1e4, 0, 2, 0, 2, 0, 2],
    408: [5e4, 5e4, 0, 2, 0, 2, 0, 2],
    502: [8e3, 0, 2e3, 2, 0, 2, 0, 2],
    503: [12e3, 2500, 1e4, 2, 0, 2, 0, 2],
    11101: [7, 2, 0, 1.2, 0, 2, 40, 1.21],
    11102: [5, 2, 0, 1.23, 8, 1.02, 40, 1.25],
    11103: [2e4, 25e3, 1e4, 1.3, 10, 1.08, 16e3, 1.25],
    11104: [5e3, 3200, 1500, 1.7, 15, 1.25, 16e3, 1.6],
    11105: [5e4, 4e4, 5e4, 1.7, 30, 1.25, 64e3, 1.7],
    11106: [9e3, 6e3, 3e3, 1.5, 40, 1.1, 2e3, 1.3],
    11107: [25e3, 13e3, 7e3, 1.09, 0, 2, 12e3, 1.17],
    11108: [5e4, 25e3, 15e3, 1.5, 80, 1.1, 28e3, 1.2],
    11109: [75e3, 2e4, 25e3, 1.09, 50, 1.02, 4e4, 1.2],
    11110: [15e4, 3e4, 15e3, 1.12, 60, 1.03, 52e3, 1.2],
    11111: [8e4, 35e3, 6e4, 1.5, 90, 1.05, 9e4, 1.3],
    11112: [25e4, 125e3, 125e3, 1.15, 100, 1.02, 95e3, 1.2],
    11201: [5e3, 2500, 500, 1.3, 0, 2, 1e3, 1.2],
    11202: [7e3, 1e4, 5e3, 1.5, 0, 2, 2e3, 1.3],
    11203: [15e3, 1e4, 5e3, 1.3, 0, 2, 2500, 1.3],
    11204: [2e4, 15e3, 7500, 1.3, 0, 2, 3500, 1.3],
    11205: [25e3, 2e4, 1e4, 1.3, 0, 2, 4500, 1.2],
    11206: [35e3, 25e3, 15e3, 1.5, 0, 2, 5e3, 1.3],
    11207: [7e4, 4e4, 2e4, 1.3, 0, 2, 8e3, 1.3],
    11208: [8e4, 5e4, 2e4, 1.5, 0, 2, 6e3, 1.3],
    11209: [32e4, 24e4, 1e5, 1.5, 0, 2, 6500, 1.4],
    11210: [32e4, 24e4, 1e5, 1.5, 0, 2, 7e3, 1.4],
    11211: [12e4, 3e4, 25e3, 1.5, 0, 2, 7500, 1.3],
    11212: [1e5, 4e4, 3e4, 1.3, 0, 2, 1e4, 1.3],
    11213: [2e5, 1e5, 1e5, 1.3, 0, 2, 8500, 1.3],
    11214: [16e4, 12e4, 5e4, 1.5, 0, 2, 9e3, 1.4],
    11215: [16e4, 12e4, 5e4, 1.5, 0, 2, 9500, 1.4],
    11216: [32e4, 24e4, 1e5, 1.5, 0, 2, 1e4, 1.4],
    11217: [3e5, 18e4, 12e4, 1.5, 0, 2, 11e3, 1.3],
    11218: [5e5, 3e5, 2e5, 1.2, 0, 2, 13e3, 1.3],
    12101: [9, 3, 0, 1.2, 0, 2, 40, 1.21],
    12102: [7, 2, 0, 1.2, 10, 1.03, 40, 1.21],
    12103: [4e4, 1e4, 15e3, 1.3, 15, 1.1, 16e3, 1.25],
    12104: [5e3, 3800, 1e3, 1.7, 20, 1.35, 16e3, 1.6],
    12105: [5e4, 4e4, 5e4, 1.65, 60, 1.3, 64e3, 1.7],
    12106: [1e4, 8e3, 1e3, 1.4, 40, 1.1, 2e3, 1.3],
    12107: [2e4, 15e3, 1e4, 1.2, 0, 2, 16e3, 1.25],
    12108: [5e4, 35e3, 15e3, 1.5, 80, 1.3, 4e4, 1.4],
    12109: [85e3, 44e3, 25e3, 1.4, 90, 1.1, 4e4, 1.2],
    12110: [12e4, 5e4, 2e4, 1.4, 90, 1.1, 52e3, 1.2],
    12111: [25e4, 15e4, 1e5, 1.8, 120, 1.3, 9e4, 1.3],
    12112: [25e4, 125e3, 125e3, 1.5, 100, 1.1, 95e3, 1.3],
    12201: [1e4, 6e3, 1e3, 1.5, 0, 2, 1e3, 1.3],
    12202: [7500, 12500, 5e3, 1.5, 0, 2, 2e3, 1.3],
    12203: [15e3, 1e4, 5e3, 1.5, 0, 2, 2500, 1.3],
    12204: [2e4, 15e3, 7500, 1.3, 0, 2, 3500, 1.4],
    12205: [25e3, 2e4, 1e4, 1.5, 0, 2, 4500, 1.3],
    12206: [5e4, 5e4, 2e4, 1.5, 0, 2, 5e3, 1.3],
    12207: [7e4, 4e4, 2e4, 1.5, 0, 2, 5500, 1.3],
    12208: [16e4, 12e4, 5e4, 1.5, 0, 2, 6e3, 1.4],
    12209: [75e3, 55e3, 25e3, 1.5, 0, 2, 6500, 1.3],
    12210: [85e3, 4e4, 35e3, 1.5, 0, 2, 7e3, 1.3],
    12211: [12e4, 3e4, 25e3, 1.5, 0, 2, 7500, 1.3],
    12212: [1e5, 4e4, 3e4, 1.5, 0, 2, 8e3, 1.3],
    12213: [2e5, 1e5, 1e5, 1.2, 0, 2, 8500, 1.3],
    12214: [22e4, 11e4, 11e4, 1.3, 0, 2, 9e3, 1.3],
    12215: [24e4, 12e4, 12e4, 1.3, 0, 2, 9500, 1.3],
    12216: [25e4, 25e4, 25e4, 1.4, 0, 2, 1e4, 1.4],
    12217: [5e5, 3e5, 2e5, 1.5, 0, 2, 13e3, 1.3],
    12218: [3e5, 18e4, 12e4, 1.7, 0, 2, 11e3, 1.4],
    13101: [6, 2, 0, 1.21, 0, 2, 40, 1.22],
    13102: [5, 2, 0, 1.18, 8, 1.02, 48, 1.2],
    13103: [3e4, 2e4, 1e4, 1.3, 13, 1.08, 16e3, 1.25],
    13104: [5e3, 3800, 1e3, 1.8, 10, 1.2, 16e3, 1.6],
    13105: [5e4, 4e4, 5e4, 1.8, 40, 1.2, 64e3, 1.7],
    13106: [7500, 7e3, 1e3, 1.3, 0, 2, 2e3, 1.3],
    13107: [35e3, 15e3, 1e4, 1.5, 40, 1.05, 16e3, 1.4],
    13108: [5e4, 2e4, 3e4, 1.07, 40, 1.01, 12e3, 1.17],
    13109: [1e5, 1e4, 3e3, 1.14, 80, 1.04, 4e4, 1.3],
    13110: [1e5, 4e4, 2e4, 1.5, 60, 1.1, 52e3, 1.2],
    13111: [55e3, 5e4, 3e4, 1.5, 70, 1.05, 5e4, 1.3],
    13112: [25e4, 125e3, 125e3, 1.4, 100, 1.05, 95e3, 1.4],
    13201: [1e4, 6e3, 1e3, 1.5, 0, 2, 1e3, 1.3],
    13202: [7500, 12500, 5e3, 1.3, 0, 2, 2e3, 1.3],
    13203: [15e3, 1e4, 5e3, 1.5, 0, 2, 2500, 1.4],
    13204: [2e4, 15e3, 7500, 1.3, 0, 2, 3500, 1.3],
    13205: [16e4, 12e4, 5e4, 1.5, 0, 2, 4500, 1.4],
    13206: [5e4, 5e4, 2e4, 1.5, 0, 2, 5e3, 1.3],
    13207: [7e4, 4e4, 2e4, 1.3, 0, 2, 5500, 1.3],
    13208: [16e4, 12e4, 5e4, 1.5, 0, 2, 6e3, 1.4],
    13209: [16e4, 12e4, 5e4, 1.5, 0, 2, 6500, 1.4],
    13210: [85e3, 4e4, 35e3, 1.2, 0, 2, 7e3, 1.3],
    13211: [12e4, 3e4, 25e3, 1.3, 0, 2, 7500, 1.3],
    13212: [16e4, 12e4, 5e4, 1.5, 0, 2, 8e3, 1.4],
    13213: [2e5, 1e5, 1e5, 1.5, 0, 2, 8500, 1.3],
    13214: [16e4, 12e4, 5e4, 1.5, 0, 2, 9e3, 1.4],
    13215: [32e4, 24e4, 1e5, 1.5, 0, 2, 9500, 1.4],
    13216: [32e4, 24e4, 1e5, 1.5, 0, 2, 1e4, 1.4],
    13217: [5e5, 3e5, 2e5, 1.5, 0, 2, 13e3, 1.3],
    13218: [3e5, 18e4, 12e4, 1.7, 0, 2, 11e3, 1.4],
    14101: [4, 3, 0, 1.21, 0, 2, 40, 1.22],
    14102: [6, 3, 0, 1.2, 9, 1.02, 40, 1.22],
    14103: [2e4, 15e3, 15e3, 1.3, 10, 1.08, 16e3, 1.25],
    14104: [7500, 5e3, 800, 1.8, 15, 1.3, 16e3, 1.7],
    14105: [6e4, 3e4, 5e4, 1.8, 30, 1.3, 64e3, 1.8],
    14106: [8500, 5e3, 3e3, 1.25, 0, 2, 2e3, 1.35],
    14107: [15e3, 15e3, 5e3, 1.2, 0, 2, 12e3, 1.2],
    14108: [75e3, 25e3, 3e4, 1.05, 30, 1.03, 16e3, 1.18],
    14109: [87500, 25e3, 3e4, 1.2, 40, 1.02, 4e4, 1.2],
    14110: [15e4, 3e4, 3e4, 1.4, 140, 1.05, 52e3, 1.8],
    14111: [75e3, 5e4, 55e3, 1.2, 90, 1.04, 9e4, 1.3],
    14112: [5e5, 25e4, 25e4, 1.4, 100, 1.05, 95e3, 1.3],
    14201: [1e4, 6e3, 1e3, 1.5, 0, 2, 1e3, 1.4],
    14202: [7500, 12500, 5e3, 1.5, 0, 2, 2e3, 1.3],
    14203: [15e3, 1e4, 5e3, 1.5, 0, 2, 2500, 1.4],
    14204: [2e4, 15e3, 7500, 1.5, 0, 2, 3500, 1.4],
    14205: [25e3, 2e4, 1e4, 1.5, 0, 2, 4500, 1.4],
    14206: [5e4, 5e4, 2e4, 1.3, 0, 2, 5e3, 1.4],
    14207: [7e4, 4e4, 2e4, 1.5, 0, 2, 5500, 1.3],
    14208: [8e4, 5e4, 2e4, 1.2, 0, 2, 6e3, 1.2],
    14209: [32e4, 24e4, 1e5, 1.5, 0, 2, 6500, 1.4],
    14210: [85e3, 4e4, 35e3, 1.2, 0, 2, 7e3, 1.2],
    14211: [12e4, 3e4, 25e3, 1.5, 0, 2, 7500, 1.4],
    14212: [1e5, 4e4, 3e4, 1.5, 0, 2, 8e3, 1.3],
    14213: [2e5, 1e5, 1e5, 1.5, 0, 2, 8500, 1.3],
    14214: [16e4, 12e4, 5e4, 1.5, 0, 2, 9e3, 1.4],
    14215: [24e4, 12e4, 12e4, 1.5, 0, 2, 9500, 1.4],
    14216: [32e4, 24e4, 1e5, 1.5, 0, 2, 1e4, 1.4],
    14217: [5e5, 3e5, 2e5, 1.5, 0, 2, 13e3, 1.3],
    14218: [3e5, 18e4, 12e4, 1.7, 0, 2, 11e3, 1.4]
  };

  // src/engines/tech.ts
  var ZERO_COST = { metal: 0, crystal: 0, deuterium: 0, energy: 0 };
  function techKind(id) {
    if (!TECH_TABLE[id]) return null;
    if (id < 100) return "building";
    if (id < 200) return "research";
    if (id < 600) return "unit";
    const group = Math.floor(id % 1e3 / 100);
    return group === 1 ? "lfBuilding" : "lfResearch";
  }
  var isLevelled = (id) => {
    const kind = techKind(id);
    return kind !== null && kind !== "unit";
  };
  function rawCost(id, level2) {
    const row = TECH_TABLE[id];
    const kind = techKind(id);
    if (!row || !kind) return { ...ZERO_COST };
    const [m, c, d, factor, energy, energyFactor] = row;
    if (kind === "unit") return { metal: m, crystal: c, deuterium: d, energy: 0 };
    const k = Math.pow(factor, level2 - 1);
    if (kind === "lfBuilding" || kind === "lfResearch") {
      return { metal: Math.floor(m * k * level2), crystal: Math.floor(c * k * level2), deuterium: Math.floor(d * k * level2), energy: 0 };
    }
    return {
      metal: Math.floor(m * k),
      crystal: Math.floor(c * k),
      deuterium: Math.floor(d * k),
      energy: Math.floor(energy * Math.pow(energyFactor, level2 - 1))
    };
  }
  var KEYS3 = ["metal", "crystal", "deuterium", "energy"];
  function main(cost) {
    let best = null;
    for (const key2 of KEYS3) if (cost[key2] > 0 && (best === null || cost[key2] > cost[best])) best = key2;
    return best;
  }
  function discountFrom(id, level2, shown) {
    const raw = rawCost(id, level2);
    const key2 = main(raw);
    if (!key2) return null;
    const value = shown[key2];
    if (value === void 0 || !(value > 0)) return null;
    const ratio = value / raw[key2];
    if (ratio > 1.001 || ratio < 0.2) return null;
    return Math.max(0, 1 - ratio);
  }
  function matchShownLevel(id, candidates, shown) {
    let best = null;
    for (const level2 of new Set(candidates.filter((l) => l >= 1))) {
      const discount = discountFrom(id, level2, shown);
      if (discount === null) continue;
      if (!best || discount < best.discount) best = { level: level2, discount };
    }
    return best;
  }
  function levelCost(id, level2, discount = 0) {
    const raw = rawCost(id, level2);
    const keep = 1 - discount;
    return {
      metal: Math.floor(raw.metal * keep),
      crystal: Math.floor(raw.crystal * keep),
      deuterium: Math.floor(raw.deuterium * keep),
      energy: Math.floor(raw.energy * keep)
    };
  }
  function addCost(a, b) {
    return { metal: a.metal + b.metal, crystal: a.crystal + b.crystal, deuterium: a.deuterium + b.deuterium, energy: Math.max(a.energy, b.energy) };
  }
  function scaleCost(a, n) {
    return { metal: a.metal * n, crystal: a.crystal * n, deuterium: a.deuterium * n, energy: a.energy };
  }
  function rangeCost(id, from, to, discount = 0) {
    let total = { ...ZERO_COST };
    for (let level2 = from; level2 <= to; level2++) total = addCost(total, levelCost(id, level2, discount));
    return total;
  }
  function durationWeight(id, level2) {
    const row = TECH_TABLE[id];
    const kind = techKind(id);
    if (!row || !kind) return 0;
    if (kind === "unit") return 1;
    if (kind === "lfBuilding" || kind === "lfResearch") return level2 * Math.pow(row[7], level2);
    const raw = rawCost(id, level2);
    const sum = raw.metal + raw.crystal;
    if (kind === "research") return sum;
    const flat = id === 15 || id === 41 || id === 42 || id === 43;
    return sum / (flat ? 1 : Math.max(4 - level2 / 2, 1));
  }
  function scaleDuration(id, shownLevel, shownMs, level2) {
    const base = durationWeight(id, shownLevel);
    return base > 0 ? shownMs * durationWeight(id, level2) / base : 0;
  }
  function missing(cost, have) {
    return {
      metal: Math.max(0, Math.ceil(cost.metal - have.metal)),
      crystal: Math.max(0, Math.ceil(cost.crystal - have.crystal)),
      deuterium: Math.max(0, Math.ceil(cost.deuterium - have.deuterium)),
      energy: 0
    };
  }
  function isoDurationMs(value) {
    const m = /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(value.trim());
    if (!m) return null;
    const [w = 0, d = 0, h6 = 0, min = 0, s = 0] = m.slice(1).map((x) => Number(x ?? 0));
    return ((((w * 7 + d) * 24 + h6) * 60 + min) * 60 + s) * 1e3;
  }

  // src/data/tech-names.ts
  var TECH_NAMES_KEY = "tech.names";
  var MINES2 = [1, 2, 3, 4, 12, 212, 217, 22, 23, 24];
  var PLANET_FACILITIES = [14, 15, 21, 31, 33, 34, 36, 44];
  var MOON_FACILITIES = [41, 42, 43, 14, 21, 22, 23, 24];
  var RESEARCH = [106, 108, 109, 110, 111, 113, 114, 115, 117, 118, 120, 121, 122, 123, 124, 199];
  var SHIPS = [202, 203, 204, 205, 206, 207, 208, 209, 210, 211, 213, 214, 215, 218, 219, 212, 217];
  var DEFENCES = [401, 402, 403, 404, 405, 406, 407, 408, 502, 503];
  var SPECIES = [1, 2, 3, 4];
  var lfBuildings = (s) => Array.from({ length: 12 }, (_, i) => 1e4 + s * 1e3 + 101 + i);
  var speciesOf = (id) => {
    const s = Math.floor(id % 1e4 / 1e3);
    return id > 1e4 && s >= 1 && s <= 4 ? s : null;
  };
  var EN = {
    1: "Metal Mine",
    2: "Crystal Mine",
    3: "Deuterium Synthesizer",
    4: "Solar Plant",
    12: "Fusion Reactor",
    14: "Robotics Factory",
    15: "Nanite Factory",
    21: "Shipyard",
    22: "Metal Storage",
    23: "Crystal Storage",
    24: "Deuterium Tank",
    31: "Research Lab",
    33: "Terraformer",
    34: "Alliance Depot",
    36: "Space Dock",
    41: "Lunar Base",
    42: "Sensor Phalanx",
    43: "Jump Gate",
    44: "Missile Silo",
    106: "Espionage",
    108: "Computer",
    109: "Weapons",
    110: "Shielding",
    111: "Armour",
    113: "Energy",
    114: "Hyperspace",
    115: "Combustion Drive",
    117: "Impulse Drive",
    118: "Hyperspace Drive",
    120: "Laser",
    121: "Ion",
    122: "Plasma",
    123: "Intergalactic Research Network",
    124: "Astrophysics",
    199: "Graviton",
    202: "Small Cargo",
    203: "Large Cargo",
    204: "Light Fighter",
    205: "Heavy Fighter",
    206: "Cruiser",
    207: "Battleship",
    208: "Colony Ship",
    209: "Recycler",
    210: "Espionage Probe",
    211: "Bomber",
    212: "Solar Satellite",
    213: "Destroyer",
    214: "Deathstar",
    215: "Battlecruiser",
    217: "Crawler",
    218: "Reaper",
    219: "Pathfinder",
    401: "Rocket Launcher",
    402: "Light Laser",
    403: "Heavy Laser",
    404: "Gauss Cannon",
    405: "Ion Cannon",
    406: "Plasma Turret",
    407: "Small Shield Dome",
    408: "Large Shield Dome",
    502: "Anti-Ballistic Missile",
    503: "Interplanetary Missile"
  };
  var LF_EN = {
    1: {
      b: ["Residential Sector", "Biosphere Farm", "Research Centre", "Academy of Sciences", "Neuro-Calibration Centre", "High Energy Smelting", "Food Silo", "Fusion-Powered Production", "Skyscraper", "Biotech Lab", "Metropolis", "Planetary Shield"],
      r: ["Intergalactic Envoys", "High-Performance Extractors", "Fusion Drives", "Stealth Field Generator", "Orbital Den", "Research AI", "High-Performance Terraformer", "Enhanced Production Technologies", "Light Fighter Mk II", "Cruiser Mk II", "Improved Lab Technology", "Plasma Terraformer", "Low-Temperature Drives", "Bomber Mk II", "Destroyer Mk II", "Battlecruiser Mk II", "Robot Assistants", "Supercomputer"]
    },
    2: {
      b: ["Meditation Enclave", "Crystal Farm", "Rune Technologium", "Rune Forge", "Oriktorium", "Magma Forge", "Disruption Chamber", "Megalith", "Crystal Refinery", "Deuterium Synthesiser", "Mineral Research Centre", "Advanced Recycling Plant"],
      r: ["Volcanic Batteries", "Acoustic Scanning", "High Energy Pump Systems", "Cargo Hold Expansion", "Magma-Powered Production", "Geothermal Power Plants", "Depth Sounding", "Ion Crystal Enhancement", "Improved Stellarator", "Hardened Diamond Drill Heads", "Seismic Mining Technology", "Magma-Powered Pump Systems", "Ion Crystal Modules", "Optimised Silo Construction", "Diamond Energy Transmitter", "Obsidian Shield Reinforcement", "Rune Shields", "Rock'tal Collector Enhancement"]
    },
    3: {
      b: ["Assembly Line", "Fusion Cell Factory", "Robotics Research Centre", "Update Network", "Quantum Computer Centre", "Automatised Assembly Centre", "High-Performance Transformer", "Microchip Assembly Line", "Production Assembly Hall", "High-Performance Synthesiser", "Chip Mass Production", "Nano Repair Bots"],
      r: ["Catalyser Technology", "Plasma Drive", "Efficiency Module", "Depot AI", "General Overhaul (Light Fighter)", "Automated Transport Lines", "Improved Drone AI", "Experimental Recycling Technology", "General Overhaul (Cruiser)", "Slingshot Autopilot", "High-Temperature Superconductors", "General Overhaul (Battleship)", "Artificial Swarm Intelligence", "General Overhaul (Battlecruiser)", "General Overhaul (Bomber)", "General Overhaul (Destroyer)", "Experimental Weapons Technology", "Mechan General Enhancement"]
    },
    4: {
      b: ["Sanctuary", "Antimatter Condenser", "Vortex Chamber", "Halls of Realisation", "Forum of Transcendence", "Antimatter Convector", "Cloning Laboratory", "Chrysalis Accelerator", "Bio Modifier", "Psionic Modulator", "Ship Manufacturing Hall", "Supra Refractor"],
      r: ["Heat Recovery", "Sulphide Process", "Psionic Network", "Telekinetic Tractor Beam", "Enhanced Sensor Technology", "Neuromodal Compressor", "Neuro-Interface", "Interplanetary Analysis Network", "Overclocking (Heavy Fighter)", "Telekinetic Drive", "Sixth Sense", "Psychoharmoniser", "Efficient Swarm Intelligence", "Overclocking (Large Cargo)", "Gravitation Sensors", "Overclocking (Battleship)", "Psionic Shield Matrix", "Kaelesh Discoverer Enhancement"]
    }
  };
  var IT = {
    1: "Miniera di metallo",
    2: "Miniera di cristallo",
    3: "Sintetizzatore di deuterio",
    4: "Centrale solare",
    12: "Centrale a fusione",
    14: "Fabbrica dei robot",
    15: "Fabbrica di naniti",
    21: "Cantiere spaziale",
    22: "Deposito di metallo",
    23: "Deposito di cristallo",
    24: "Cisterna di deuterio",
    31: "Laboratorio di ricerca",
    33: "Terraformer",
    34: "Deposito dell'alleanza",
    36: "Porto spaziale",
    41: "Base lunare",
    42: "Falange di sensori",
    43: "Portale iperspaziale",
    44: "Silos missilistico",
    106: "Spionaggio",
    108: "Computer",
    109: "Armi",
    110: "Scudi",
    111: "Corazze",
    113: "Energia",
    114: "Iperspazio",
    115: "Propulsore a combustione",
    117: "Propulsore a impulso",
    118: "Propulsore iperspaziale",
    120: "Laser",
    121: "Ionica",
    122: "Plasma",
    123: "Rete di ricerca intergalattica",
    124: "Astrofisica",
    199: "Gravitoni",
    217: "Crawler",
    218: "Reaper",
    219: "Pathfinder",
    401: "Lanciamissili",
    402: "Laser leggero",
    403: "Laser pesante",
    404: "Cannone Gauss",
    405: "Cannone ionico",
    406: "Cannone al plasma",
    407: "Cupola scudo piccola",
    408: "Cupola scudo potente",
    502: "Missili anti-balistici",
    503: "Missili interplanetari"
  };
  var BUILT_IN = { it: IT };
  function techName(id, locale, learned = {}, t) {
    const seen = learned[String(id)];
    if (seen) return seen;
    const local = BUILT_IN[locale]?.[id];
    if (local) return local;
    if (t && id >= 202 && id <= 219) {
      const ship = t(`ship.${id}`);
      if (ship !== `ship.${id}`) return ship;
    }
    const s = speciesOf(id);
    if (s) {
      const group = Math.floor(id % 1e3 / 100) === 1 ? LF_EN[s].b : LF_EN[s].r;
      return group[id % 100 - 1] ?? String(id);
    }
    return EN[id] ?? String(id);
  }
  function learnTechNames(names, list) {
    let changed = false;
    for (const e of list) {
      if (!e.name || e.name === String(e.id) || names[String(e.id)] === e.name) continue;
      names[String(e.id)] = e.name;
      changed = true;
    }
    return changed;
  }

  // src/data/lf-slots.ts
  var LF_SLOTS_KEY = "lf.slots";
  var isLfResearch = (id) => speciesOf(id) !== null && Math.floor(id % 1e3 / 100) === 2;
  var slotOf = (id) => id % 100;
  function readLfSlots(doc, list) {
    const component = new URL(doc.location?.href ?? "http://x/").searchParams.get("component");
    if (component !== "lfresearch") return null;
    const ids = list.map((e) => e.id).filter(isLfResearch);
    return ids.length ? ids.sort((a, b) => slotOf(a) - slotOf(b)) : null;
  }
  function rememberLfSlots(slots, bodyId, ids) {
    const key2 = String(bodyId);
    if (slots[key2]?.join() === ids.join()) return false;
    slots[key2] = ids;
    return true;
  }
  var lvl = (b, id) => b.levels[String(id)] ?? 0;
  function activeLfBuildings(body) {
    const s = body.species;
    if (!SPECIES.includes(s)) return [];
    return lfBuildings(s).map((id) => ({ id, level: lvl(body, id), guessed: false }));
  }
  function activeLfResearch(body, seen) {
    const out = [];
    for (let slot = 1; slot <= 18; slot++) {
      const known = seen?.find((id) => slotOf(id) === slot);
      if (known) {
        out.push({ id: known, level: lvl(body, known), guessed: false });
        continue;
      }
      let best = null;
      for (const s of SPECIES) {
        const id = 1e4 + s * 1e3 + 200 + slot;
        const level2 = lvl(body, id);
        if (level2 <= 0) continue;
        if (!best || level2 > best.level || level2 === best.level && s === body.species) best = { id, level: level2, guessed: true };
      }
      if (best) out.push(best);
    }
    return out;
  }

  // src/data/messages.ts
  var json = (value, fallback) => {
    if (!value || value === "-") return fallback;
    try {
      return JSON.parse(value) ?? fallback;
    } catch {
      return fallback;
    }
  };
  var int2 = (value) => {
    const n = Number.parseInt(value ?? "", 10);
    return Number.isFinite(n) ? n : 0;
  };
  var num2 = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  function readRes(raw) {
    return {
      metal: num2(raw.metal),
      crystal: num2(raw.crystal),
      deuterium: num2(raw.deuterium ?? raw.deut),
      food: num2(raw.food),
      darkMatter: num2(raw.darkMatter ?? raw.darkmatter)
    };
  }
  function readUnits(raw) {
    const out = {};
    for (const [key2, value] of Object.entries(raw)) {
      const id = Math.abs(Number(key2));
      const amount = typeof value === "object" && value ? num2(value.amount) : num2(value);
      if (id > 0 && amount) out[id] = (out[id] ?? 0) + amount;
    }
    return out;
  }
  function outcome(type, d, artefacts, lfXp) {
    if (type === 61) return artefacts > 0 ? "artefact" : lfXp > 0 ? "lifeform" : "nothing";
    const nav = json(d.rawNavigation, {});
    switch (d.rawExpeditionresult) {
      case "ressources":
      case "resources":
        return "resource";
      case "darkmatter":
        return "darkmatter";
      case "nothing":
        return "nothing";
      case "shipwrecks":
        return "ship";
      case "trader":
        return "trader";
      case "items":
        return "item";
      case "fleetLost":
        return "blackhole";
      case "navigation":
        return (nav.returnTimeMultiplier ?? 1) < 1 ? "early" : "late";
      case "combatPirates":
        return "pirate";
      case "combatAliens":
        return "alien";
      default:
        return "unknown";
    }
  }
  var SIZES = { huge: 0, big: 1, normal: 2 };
  function readMessage(msg, ownPlayerId2) {
    const raw = msg.querySelector(".rawMessageData");
    const id = msg.getAttribute("data-msg-id");
    if (!raw || !id) return null;
    const d = raw.dataset;
    const type = int2(d.rawMessagetype);
    const at = int2(d.rawTimestamp || d.rawDatetime) * 1e3 || Date.now();
    if (type === 41 || type === 61 || d.rawExpeditionresult !== void 0) {
      const artefacts = int2(d.rawArtifactsfound);
      const lfXp = int2(d.rawLifeformgainedexperience);
      const result = outcome(type, d, artefacts, lfXp);
      const items = json(d.rawItemsgained, null);
      const first = Array.isArray(items) ? items[0] : items && typeof items === "object" ? Object.values(items)[0] : null;
      const sizeRaw = d.rawSize ?? d.rawArtifactssize ?? "";
      const sized = !["nothing", "trader", "blackhole", "lifeform", "unknown"].includes(result);
      return {
        kind: type === 61 ? "discovery" : "expedition",
        id,
        at,
        result,
        size: !sized ? -1 : sizeRaw in SIZES ? SIZES[sizeRaw] : /^[0-2]$/.test(sizeRaw) ? Number(sizeRaw) : -1,
        depletion: int2(d.rawDepletion),
        res: readRes(json(d.rawResourcesgained, {})),
        ships: readUnits(json(d.rawTechnologiesgained, {})),
        lost: readUnits(json(d.rawShipslost, {})),
        item: first && typeof first === "object" ? String(first.name ?? "") || null : null,
        lfXp,
        lifeform: int2(d.rawLifeform),
        artefacts,
        coords: d.rawCoords || d.rawCoordinates || null
      };
    }
    if (d.rawCoordinates !== void 0 && d.rawResources !== void 0 && d.rawLoot !== void 0) {
      if (d.rawTargetplayerid === "99999") return null;
      const counter = int2(d.rawTargetplayerid) === ownPlayerId2 && ownPlayerId2 > 0;
      const hiddenFleet = d.rawHiddenships === "1";
      const hiddenDef = d.rawHiddendef === "1";
      const isActive = int2(d.rawActive) === 1;
      let activity = d.rawActivity === void 0 ? -1 : int2(d.rawActivity);
      if (activity === -1 || !isActive && activity < 15) activity = 60;
      else if (isActive && activity < 15) activity = 0;
      return {
        kind: "spy",
        id,
        at,
        coords: d.rawCoordinates,
        moon: int2(d.rawTargetplanettype) === 3,
        playerId: int2(d.rawTargetplayerid),
        playerName: d.rawPlayername ?? "",
        statuses: json(d.rawPlayerstatus, []).filter((x) => typeof x === "string"),
        counter,
        sourceName: d.rawSourceplayername ?? "",
        sourceCoords: d.rawSourceplanetcoordinates ?? "",
        activity,
        res: { metal: int2(d.rawMetal), crystal: int2(d.rawCrystal), deuterium: int2(d.rawDeuterium), food: int2(d.rawFood) },
        loot: int2(d.rawLoot) / 100,
        fleetValue: hiddenFleet ? -1 : int2(d.rawFleetvalue),
        defValue: hiddenDef ? -1 : int2(d.rawDefensevalue),
        attacked: int2(d.rawAttacking) === 1,
        apiKey: d.rawHashcode ?? ""
      };
    }
    if (d.rawResult !== void 0 && d.rawFleets !== void 0) return readCombat(id, at, d, ownPlayerId2);
    if (type === 48)
      return {
        kind: "combat",
        id,
        at,
        coords: d.rawCoords || d.rawTargetplanetcoordinates || null,
        attacker: true,
        winner: "lost",
        loot: { metal: 0, crystal: 0, deuterium: 0 },
        lost: readUnits(json(d.rawShipslost, {})),
        debris: { metal: 0, crystal: 0, deuterium: 0 },
        apiKey: d.rawHashcode ?? ""
      };
    const place2 = (side) => {
      const coords = d[`raw${side === "source" ? "Source" : "Target"}planetcoordinates`];
      if (!coords) return null;
      return { name: d[`raw${side === "source" ? "Source" : "Target"}planetname`] ?? "", coords, moon: int2(d[`raw${side === "source" ? "Source" : "Target"}planettype`]) === 3 };
    };
    const recycled = readRes(json(d.rawRecycledresources, {}));
    if (type === 32 || recycled.metal + recycled.crystal + recycled.deuterium > 0) {
      const field = readRes(json(d.rawDebrisresources, {}));
      return {
        kind: "recycle",
        id,
        at,
        coords: d.rawCoords || d.rawTargetcoordinates || null,
        res: { metal: recycled.metal, crystal: recycled.crystal, deuterium: recycled.deuterium, food: 0 },
        from: null,
        to: null,
        left: { metal: Math.max(0, field.metal - recycled.metal), crystal: Math.max(0, field.crystal - recycled.crystal), deuterium: Math.max(0, field.deuterium - recycled.deuterium) }
      };
    }
    const cargo = readRes(json(d.rawCargo, {}));
    if (type === 33 || type === 34 || cargo.metal + cargo.crystal + cargo.deuterium + cargo.food > 0) {
      let from = place2("source");
      if (!from) {
        const seen = /\[(\d+:\d+:\d+)\]/.exec(msg.querySelector(".msgContent")?.textContent ?? "");
        if (seen) from = { name: "", coords: seen[1], moon: false };
      }
      const back = type === 34 && from?.coords.split(":")[2] === "16";
      return {
        kind: back ? "return" : type === 34 ? "deploy" : "transport",
        id,
        at,
        coords: d.rawTargetplanetcoordinates || d.rawCoords || null,
        res: { metal: cargo.metal, crystal: cargo.crystal, deuterium: cargo.deuterium, food: cargo.food },
        from,
        to: place2("target")
      };
    }
    return null;
  }
  function readCombat(id, at, d, own) {
    const fleets = json(d.rawFleets, []);
    const rounds = json(d.rawCombatrounds, []);
    const result = json(d.rawResult, {});
    const defender = json(d.rawDefenderspaceobject, {});
    const mine = (Array.isArray(fleets) ? fleets : []).filter((f) => f.player?.id === own);
    const ownIds = new Set(mine.map((f) => f.fleetId));
    const sides = new Set(mine.map((f) => f.side));
    const attacker = sides.has("attacker");
    const winner = result.winner === "none" ? "draw" : result.winner && sides.has(result.winner) ? "won" : result.winner ? "lost" : "unknown";
    const pick = (list, key2) => {
      const of = (r) => num2(list?.find((x) => x.resource === r)?.[key2]);
      return { metal: of("metal"), crystal: of("crystal"), deuterium: of("deuterium") };
    };
    let loot = { metal: 0, crystal: 0, deuterium: 0 };
    const taken = pick(result.loot?.resources, "amount");
    if (winner === "won" && attacker) loot = taken;
    else if (winner === "lost" && defender.owner?.id === own) loot = { metal: -taken.metal, crystal: -taken.crystal, deuterium: -taken.deuterium };
    const lost = {};
    const last2 = Array.isArray(rounds) ? rounds[rounds.length - 1] : void 0;
    for (const f of last2?.fleets ?? [])
      if (ownIds.has(f.fleetId)) {
        for (const tech of f.technologies ?? []) if (tech.technologyId && tech.destroyedTotal) lost[tech.technologyId] = (lost[tech.technologyId] ?? 0) + tech.destroyedTotal;
      }
    if (!attacker && defender.owner?.id === own) {
      for (const r of result.repairedTechnologies ?? []) if (r.technologyId && lost[r.technologyId]) lost[r.technologyId] = Math.max(0, lost[r.technologyId] - num2(r.amount));
    }
    return { kind: "combat", id, at, coords: d.rawCoords || null, attacker, winner, loot, lost, debris: pick(result.debris?.resources, "remaining"), apiKey: d.rawHashcode ?? "" };
  }
  function ownPlayerId(doc) {
    return int2(doc.querySelector('meta[name="ogame-player-id"]')?.getAttribute("content") ?? "");
  }
  function isMessagesPage(doc) {
    const q = new URLSearchParams(doc.location?.search ?? "");
    return q.get("page") === "messages" || q.get("component") === "messages" || !!doc.querySelector("#messagecontainercomponent, #messagescomponent");
  }

  // src/data/ship-icons.ts
  var SHIP_ICONS = {
    202: "https://gf2.geo.gfsrv.net/cdnd9/60555c3c87b9eb3b5ddf76780b5712.jpg",
    203: "https://gf1.geo.gfsrv.net/cdn34/fdbcc505474e3e108d10a3ed4a19f4.jpg",
    204: "https://gf2.geo.gfsrv.net/cdnd2/9ed5c1b6aea28fa51f84cdb8cb1e7e.jpg",
    205: "https://gf1.geo.gfsrv.net/cdnf1/8266a2cbae5ad630c5fedbdf270f3e.jpg",
    206: "https://gf2.geo.gfsrv.net/cdn45/b7ee4f9d556a0f39dae8d2133e05b7.jpg",
    207: "https://gf1.geo.gfsrv.net/cdn32/3f4a081f4d15662bed33473db53d5b.jpg",
    208: "https://gf1.geo.gfsrv.net/cdn6f/41a21e4253d2231f8937ddef1ba43e.jpg",
    209: "https://gf1.geo.gfsrv.net/cdn07/6246eb3d7fa67414f6b818fa79dd9b.jpg",
    210: "https://gf3.geo.gfsrv.net/cdnb5/347821e80cafc52aec04f27c3a2a4d.jpg",
    211: "https://gf1.geo.gfsrv.net/cdnca/4d55a520aed09d0c43e7b962f33e27.jpg",
    213: "https://gf3.geo.gfsrv.net/cdn2a/c2b9fedc9c93ef22f2739c49fbac52.jpg",
    214: "https://gf3.geo.gfsrv.net/cdn84/155e9e24fc1d34ed4660de8d428f45.jpg",
    215: "https://gf3.geo.gfsrv.net/cdn5a/24f511ec14a71e2d83fd750aa0dee2.jpg",
    217: "https://gf3.geo.gfsrv.net/cdn26/28e8d79a5b489dc795cc47f3adf165.jpg",
    218: "https://gf1.geo.gfsrv.net/cdn39/12d016c8bb0d71e053b901560c17cc.jpg",
    219: "https://gf3.geo.gfsrv.net/cdne2/b8d8d18f2baf674acedb7504c7cc83.jpg"
  };

  // src/engines/expeditions.ts
  var JOURNAL_KEY = "exp.journal";
  var DAY = 864e5;
  var KEEP_MS = 550 * DAY;
  var MAX_ENTRIES = 25e3;
  var ZERO = () => ({ metal: 0, crystal: 0, deuterium: 0, darkMatter: 0 });
  function record2(journal, messages) {
    let added = 0;
    let next = journal;
    for (const { id, ...entry } of messages) {
      if (next[id]) continue;
      if (next === journal) next = { ...journal };
      next[id] = entry;
      added++;
    }
    return { journal: next, added };
  }
  function recordCombat(journal, id, at, lost, coords) {
    if (journal[id] || !Object.keys(lost).length) return { journal, added: 0 };
    const entry = {
      kind: "expedition",
      at,
      result: "unknown",
      size: -1,
      depletion: 0,
      res: { metal: 0, crystal: 0, deuterium: 0, darkMatter: 0, food: 0 },
      ships: {},
      lost,
      item: null,
      lfXp: 0,
      lifeform: 0,
      artefacts: 0,
      coords,
      combat: true
    };
    return { journal: { ...journal, [id]: entry }, added: 1 };
  }
  function trim(journal, now) {
    const entries = Object.entries(journal).filter(([, e]) => e.at > now - KEEP_MS);
    if (entries.length > MAX_ENTRIES) entries.sort((a, b) => b[1].at - a[1].at).splice(MAX_ENTRIES);
    return entries.length === Object.keys(journal).length ? journal : Object.fromEntries(entries);
  }
  function unitsValue(units) {
    const out = ZERO();
    for (const [id, n] of Object.entries(units)) {
      const c = rawCost(Number(id), 1);
      out.metal += c.metal * n;
      out.crystal += c.crystal * n;
      out.deuterium += c.deuterium * n;
    }
    return out;
  }
  var msu2 = (r) => r.metal + r.crystal * 1.5 + r.deuterium * 3;
  function periodStats(entries) {
    const s = {
      count: 0,
      discoveries: 0,
      outcomes: {},
      res: ZERO(),
      shipsFound: {},
      shipsValue: ZERO(),
      lost: {},
      lostValue: ZERO(),
      lfXp: 0,
      artefacts: 0,
      items: [],
      sizes: [0, 0, 0],
      netMsu: 0
    };
    for (const e of entries) {
      if (e.kind === "discovery") s.discoveries++;
      else if (!e.combat) s.count++;
      if (!e.combat) s.outcomes[e.result] = (s.outcomes[e.result] ?? 0) + 1;
      s.res.metal += e.res.metal;
      s.res.crystal += e.res.crystal;
      s.res.deuterium += e.res.deuterium;
      s.res.darkMatter += e.res.darkMatter;
      for (const [id, n] of Object.entries(e.ships)) s.shipsFound[Number(id)] = (s.shipsFound[Number(id)] ?? 0) + n;
      for (const [id, n] of Object.entries(e.lost)) s.lost[Number(id)] = (s.lost[Number(id)] ?? 0) + n;
      s.lfXp += e.lfXp;
      s.artefacts += e.artefacts;
      if (e.item) s.items.push(e.item);
      if (e.size >= 0 && e.size <= 2) s.sizes[e.size]++;
    }
    s.shipsValue = unitsValue(s.shipsFound);
    s.lostValue = unitsValue(s.lost);
    s.netMsu = msu2(s.res) + msu2(s.shipsValue) - msu2(s.lostValue);
    return s;
  }
  function dayStart(at) {
    const d = new Date(at);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  function periodRange(period, now) {
    const today = dayStart(now);
    switch (period) {
      case "today":
        return [today, Infinity];
      case "yesterday":
        return [dayStart(today - 1), today];
      case "week":
        return [dayStart(today - 6 * DAY), Infinity];
      case "month":
        return [dayStart(today - 29 * DAY), Infinity];
      default:
        return [0, Infinity];
    }
  }
  function entriesIn(journal, [from, to]) {
    return Object.values(journal).filter((e) => e.at >= from && e.at < to).sort((a, b) => b.at - a.at);
  }
  function byDay(entries, limit = 14) {
    const days = /* @__PURE__ */ new Map();
    for (const e of entries) {
      const key2 = dayStart(e.at);
      const list = days.get(key2) ?? [];
      list.push(e);
      days.set(key2, list);
    }
    return [...days.entries()].sort((a, b) => b[0] - a[0]).slice(0, limit).map(([day, list]) => ({ day, stats: periodStats(list) }));
  }

  // src/engines/raids.ts
  var SPY_BOARD_KEY = "spy.board";
  var SPY_MAX_AGE = 72 * 36e5;
  var spyKey = (coords, moon) => `${coords}${moon ? ":m" : ""}`;
  function rememberSpies(board, reports, now) {
    let changed = 0;
    for (const r of reports) {
      if (r.counter || !r.playerId) continue;
      const key2 = spyKey(r.coords, r.moon);
      const known = board[key2];
      if (known && (known.at > r.at || known.at === r.at && (known.apiKey || !r.apiKey))) continue;
      board[key2] = {
        key: key2,
        id: r.id,
        at: r.at,
        coords: r.coords,
        moon: r.moon,
        playerId: r.playerId,
        playerName: r.playerName,
        statuses: r.statuses,
        activity: r.activity,
        res: { metal: r.res.metal, crystal: r.res.crystal, deuterium: r.res.deuterium },
        loot: r.loot,
        fleetValue: r.fleetValue,
        defValue: r.defValue,
        apiKey: r.apiKey
      };
      changed++;
    }
    for (const [key2, e] of Object.entries(board)) if (now - e.at > SPY_MAX_AGE) {
      delete board[key2];
      changed++;
    }
    return changed;
  }
  var parse = (coords) => coords.split(":").map(Number);
  var ring = (d, size, donut) => donut ? Math.min(d, size - d) : d;
  function distance(from, to, u) {
    const [g1, s1, p1] = parse(from);
    const [g2, s2, p2] = parse(to);
    if (g1 !== g2) return 2e4 * ring(Math.abs(g1 - g2), u.galaxies, u.donutGalaxy);
    if (s1 !== s2) return 2700 + 95 * ring(Math.abs(s1 - s2), u.systems, u.donutSystem);
    if (p1 !== p2) return 1e3 + 5 * Math.abs(p1 - p2);
    return 5;
  }
  function flightSeconds(dist, speed, u, percent = 100) {
    return Math.round((10 + 3500 * (100 / percent) * Math.sqrt(10 * dist / speed)) / u.fleetSpeed);
  }
  function nearestBase(bases, coords, u) {
    let base = null;
    let dist = Infinity;
    for (const b of bases) {
      const d = distance(b.coords, coords, u);
      if (d < dist) {
        dist = d;
        base = b;
      }
    }
    return { base, dist };
  }
  function targetRows(board, bases, o) {
    return Object.values(board).map((entry) => {
      const lootRes = Math.floor((entry.res.metal + entry.res.crystal + entry.res.deuterium) * entry.loot);
      const lootMsu = (entry.res.metal + entry.res.crystal * 1.5 + entry.res.deuterium * 3) * entry.loot;
      const { base, dist } = nearestBase(bases, entry.coords, o.universe);
      const flight = base && o.speed > 0 ? flightSeconds(dist, o.speed, o.universe) : null;
      return {
        entry,
        lootRes,
        lootMsu,
        ships: o.capacity > 0 ? Math.ceil(lootRes / o.capacity) : 0,
        base,
        flight,
        msuPerHour: flight ? lootMsu / (2 * flight / 3600) : null,
        ageMinutes: Math.max(0, Math.round((o.now - entry.at) / 6e4))
      };
    });
  }

  // src/modules/messages/style.ts
  var OUTCOME_COLORS = {
    resource: "#4FD1E8",
    darkmatter: "#B58CDB",
    ship: "#4FE0B0",
    nothing: "#8A9BB0",
    trader: "#F59E4B",
    item: "#D08A5B",
    blackhole: "#9AA3AD",
    early: "#7FA7FF",
    late: "#E06A6A",
    pirate: "#F5D547",
    alien: "#7EE05A",
    artefact: "#D4A93A",
    lifeform: "#E07BC8",
    unknown: "#5B6B80"
  };
  var outcomeCss = Object.entries(OUTCOME_COLORS).map(([k, c]) => `.fut-msg .fut-out-${k} { color: ${c}; border-color: ${c}55; background: ${c}14; }`).join("\n");
  var MESSAGES_CSS = `
.fut-msg { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin: 6px 8px; padding: 5px 6px;
  border: 1px solid #1F2C40; border-radius: 8px; background: rgba(10,17,28,0.92); cursor: pointer;
  font: 11px/14px Arial, Helvetica, sans-serif; color: #E6EDF5; text-align: left; }
.fut-msg:hover { border-color: #2B6F7D; }
.fut-msg-chip { display: inline-flex; align-items: center; padding: 1px 7px; border: 1px solid #1F2C40; border-radius: 10px;
  background: #0E1724; white-space: nowrap; }
.fut-msg-out { font-weight: 700; }
/* Only the outcome is a pill; the values are plain, spaced text. */
.fut-msg .fut-msg-chip:not(.fut-msg-out) { border-color: transparent; background: none; padding: 1px 4px; }
.fut-msg-place { display: inline-flex; align-items: center; gap: 3px; }
.fut-msg-arrow { margin: 0 5px; color: #8A9BB0; }
.fut-msg-moon { color: #8A9BB0; }
.fut-msg-res, .fut-msg-msu, .fut-msg-loot { font-family: "JetBrains Mono", Consolas, monospace; }
.fut-msg-m { color: #B8C2CC; } .fut-msg-c { color: #7FB8FF; } .fut-msg-d { color: #4FE0B0; } .fut-msg-f { color: #D6A8C8; } .fut-msg-dm { color: #B58CDB; }
.fut-msg-msu { color: #C9D4E2; } .fut-msg-loot { color: #4FD1E8; }
.fut-msg-ship { color: #4FE0B0; gap: 4px; padding-left: 2px; font-family: "JetBrains Mono", Consolas, monospace; }
.fut-msg-icon { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; flex: none; }
.fut-msg-icon-none { font-size: 10px; color: #8A9BB0; } .fut-msg-item { color: #D08A5B; } .fut-msg-lf { color: #E07BC8; } .fut-msg-art { color: #D4A93A; }
.fut-msg-route { color: #C9D4E2; }
.fut-msg-warn { color: #F5B547; } .fut-msg-muted { color: #8A9BB0; }
.fut-msg .fut-msg-neg { color: #FF7A7A; border-color: #FF7A7A44; }
${outcomeCss}
.fut-msg.fut-msg-rows { flex-direction: column; flex-wrap: nowrap; align-items: stretch; gap: 5px; }
.fut-msg-row { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.fut-msg-found { justify-content: center; }
.fut-msg-foot { justify-content: center; }
.fut-msg-foot .fut-msg-chip { border-color: transparent; background: none; font-size: 10px; padding: 0 4px; }
.fut-msg-big { font-size: 12px; font-weight: 700; }
.fut-msg-top .fut-msg-size { margin-left: auto; }
/* Size: normal = grey, big = cyan, huge = gold (frame and label). */
.fut-msg.fut-size-2 { border-color: #2A3B55; }
.fut-msg.fut-size-1 { border-color: #4FD1E8aa; }
.fut-msg.fut-size-0 { border-color: #F5D547cc; background: #17150C; }
.fut-msg-chip.fut-size-2 { color: #8A9BB0; }
.fut-msg-chip.fut-size-1 { color: #4FD1E8; border-color: #4FD1E855; }
.fut-msg-chip.fut-size-0 { color: #F5D547; border-color: #F5D54777; font-weight: 700; }
a.fut-msg-link { color: #4FD1E8; text-decoration: none; cursor: pointer; }
a.fut-msg-link:hover, a.fut-msg-link:focus-visible { border-color: #4FD1E8; color: #E6EDF5; }
/* Spy table inside the Espionage tab: the game's own inbox look (Verdana 11px, #111A21 rows). */
#fut-spypanel { margin: 0 0 6px; padding: 5px; background: #000; font: 11px/1.3 Verdana, Arial, sans-serif; color: #848484; }
#fut-spypanel button { font: inherit; }
.fut-sp-head { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.fut-sp-title { display: flex; align-items: baseline; gap: 8px; margin-right: auto; height: 26px; padding: 0 8px; border: 0; border-radius: 3px;
  background: linear-gradient(#617C8D, #2E4356); color: #fff; cursor: pointer; }
.fut-sp-title b { font-size: 12px; }
.fut-sp-title span { color: #C9D4E2; }
.fut-sp-title[aria-expanded="false"] { background: #111A21; color: #F1F1F1; }
.fut-sp-chip { height: 22px; padding: 0 8px; border: 1px solid #2E4356; border-radius: 3px; background: #111A21; color: #848484; cursor: pointer; }
.fut-sp-chip:hover, .fut-sp-chip:focus-visible { color: #F1F1F1; border-color: #617C8D; }
.fut-sp-chip[aria-pressed="true"] { background: linear-gradient(#617C8D, #2E4356); border-color: #617C8D; color: #fff; }
.fut-sp-row { display: grid; grid-template-columns: minmax(0, 1.15fr) 42px minmax(0, 1.35fr) 46px 48px 70px 122px; gap: 6px; align-items: center;
  padding: 4px 6px 4px 9px; background: #111A21; }
.fut-sp-list { display: flex; flex-direction: column; gap: 2px; }
.fut-sp-row.defended { box-shadow: inset 2px 0 0 #9C6A2A; }
.fut-sp-cols { margin-top: 5px; padding-top: 0; padding-bottom: 0; background: none; height: 26px; }
.fut-sp-h { display: flex; align-items: center; justify-content: flex-end; height: 26px; padding: 0 2px; border: 0; border-radius: 3px; background: none; color: #848484; font-size: 12px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
button.fut-sp-h { cursor: pointer; }
button.fut-sp-h:hover, button.fut-sp-h:focus-visible { color: #F1F1F1; }
.fut-sp-h.sortBy { background: linear-gradient(#617C8D, #2E4356); color: #fff; }
.fut-sp-h:first-child { justify-content: flex-start; padding-left: 4px; }
.fut-sp-h:last-child { justify-content: flex-end; }
.fut-sp-who { min-width: 0; }
.fut-sp-name { color: #F1F1F1; margin-right: 4px; }
.fut-sp-st { margin-right: 3px; padding: 0 4px; border-radius: 3px; background: #1A2733; font-size: 10px; color: #C9D4E2; }
.fut-sp-st.st-inactive, .fut-sp-st.st-longinactive { color: #7BC47F; }
.fut-sp-st.st-vacation { color: #7FB8FF; }
.fut-sp-st.st-noob, .fut-sp-st.st-strong, .fut-sp-st.st-honorableTarget { color: #E3BB28; }
.fut-sp-coords { display: block; color: #6F9FC8; text-decoration: none; }
.fut-sp-coords:hover, .fut-sp-coords:focus-visible { color: #F1F1F1; }
.fut-sp-moon { margin-right: 3px; vertical-align: -1px; }
.fut-sp-num { text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fut-sp-num b { color: #F1F1F1; font-weight: 700; }
.fut-sp-num small { display: block; font-size: 9px; color: #6A7682; overflow: hidden; text-overflow: ellipsis; }
.fut-sp-num b.rate { color: #4FD1E8; }
#fut-spypanel .fresh { color: #7BC47F; } #fut-spypanel .warm { color: #E3BB28; } #fut-spypanel .old, #fut-spypanel .bad { color: #D86A6A; }
.fut-sp-acts { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 2px; }
.fut-sp-acts .custom_btn { display: inline-flex; align-items: center; justify-content: center; min-width: 22px; height: 22px; padding: 0 2px; cursor: pointer; }
.fut-sp-tool { font-size: 10px; font-weight: 700; color: #F1F1F1; }
.fut-sp-del .custom_btn { color: #848484; }
.fut-sp-note { margin: 6px 4px 2px; color: #6A7682; font-size: 10px; line-height: 1.4; }
.msg.fut-msg-folded .msgContent, .msg.fut-msg-folded .msg_content, .msg.fut-msg-folded > .content-box { display: none !important; }
`;
  var JOURNAL_CSS = `
:host { --panel-w: 860px; }
.kpi .value { font-size: 18px; font-family: var(--mono); }
.kpi .detail { display: flex; flex-wrap: wrap; gap: 8px; }
.bar { display: flex; height: 12px; border-radius: 6px; overflow: hidden; background: #0D1522; gap: 2px; }
.bar span { display: block; height: 100%; min-width: 2px; }
.legend { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 4px 12px; margin-top: 8px; font-size: 12px; }
.legend div { display: flex; align-items: center; gap: 6px; }
.dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
.legend .n { margin-left: auto; font-family: "JetBrains Mono", Consolas, monospace; color: #C9D4E2; }
.legend .pct { color: #8A9BB0; font-size: 11px; min-width: 38px; text-align: right; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { text-align: right; color: #8A9BB0; font-weight: 400; padding: 3px 6px; border-bottom: 1px solid #1F2C40; white-space: nowrap; }
th:first-child, td:first-child { text-align: left; }
td { text-align: right; padding: 3px 6px; border-bottom: 1px solid #172334; font-family: "JetBrains Mono", Consolas, monospace; white-space: nowrap; }
td:first-child { font-family: Arial, sans-serif; color: #C9D4E2; }
.scroll { overflow-x: auto; }
.ships { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 6px; }
.ship { display: flex; align-items: center; gap: 8px; padding: 2px 0; min-width: 0; }
.ship-img { width: 44px; height: 44px; flex: none; border-radius: 6px; object-fit: cover; background: #16202E; }
.ship-img-none { display: flex; align-items: center; justify-content: center; color: #8A9BB0; font-size: 11px; }
.ship-info { display: flex; flex-direction: column; min-width: 0; }
.ship-info b { font-family: "JetBrains Mono", Consolas, monospace; font-size: 14px; }
.ship-name { color: #B4C2D3; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
h4.lost { margin: 10px 0 6px; color: var(--bad); }
.foot { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
.opt { display: flex; gap: 6px; align-items: center; color: #B4C2D3; font-size: 12px; cursor: pointer; }
.acts { display: flex; gap: 6px; }
@media (max-width: 560px) { .kpi .value { font-size: 15px; } }
`;

  // src/engines/sim-links.ts
  var OSIMS = "https://www.ogameutilities.it/Osims/";
  var OGAME_TOOLS_SIM = "https://simulator.ogame-tools.com/";
  var OGOTCHA = "https://ogotcha.oplanet.eu/";
  var SIM_RESEARCH = [109, 110, 111, 114, 115, 117, 118];
  var GENERAL = 2;
  var toolLang = (lang) => lang === "us" ? "en" : lang === "ar" ? "es" : lang || "en";
  function simPrefill(server, attacker, defenderCoords) {
    const planet = (c) => {
      const [galaxy, system, position] = c.split(":");
      return { galaxy, system, position };
    };
    const research = {};
    const bonus = attacker?.classId === GENERAL ? 2 : 0;
    for (const id of SIM_RESEARCH) research[id] = { level: (attacker?.researches[String(id)] ?? 0) + (id <= 111 ? bonus : 0) };
    const data = {
      settings: { server },
      0: [{ planet: planet(attacker?.coords ?? "0:0:0"), research, class: attacker?.classId ?? 0, characterClassesEnabled: true, allianceClass: 0 }],
      1: [{ planet: planet(defenderCoords), research: {}, resources: {}, defence: {} }]
    };
    return btoa(JSON.stringify(data));
  }
  function osimsLink(apiKey, prefill) {
    return `${OSIMS}?SR_KEY=${encodeURIComponent(apiKey)}#prefill=${prefill}`;
  }
  function ogameToolsSimLink(apiKey, lang, prefill) {
    return `${OGAME_TOOLS_SIM}${toolLang(lang)}?SR_KEY=${encodeURIComponent(apiKey)}#prefill=${prefill}`;
  }
  var gameSimLink = (apiKey) => `/game/index.php?page=standalone&component=combatsim&reportHash=${encodeURIComponent(apiKey)}`;
  function converterLink(apiKey, lang) {
    return `${OGOTCHA}${toolLang(lang)}?CR_KEY=${encodeURIComponent(apiKey)}`;
  }

  // src/modules/messages/spy-table.ts
  var SPY_PANEL_ID = "fut-spypanel";
  var VIEW_KEY2 = "spy.view";
  var DEFAULT_VIEW = { sort: "rate", desc: true, ship: 203, hideDefended: false, inactiveOnly: false, open: true };
  function universeOf(doc, data) {
    const meta = (name) => doc.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ?? "";
    return {
      galaxies: data?.galaxies || 9,
      systems: data?.systems || 499,
      donutGalaxy: data ? data.donutGalaxy : meta("ogame-donut-galaxy") !== "0",
      donutSystem: data ? data.donutSystem : meta("ogame-donut-system") !== "0",
      fleetSpeed: data?.speedFleetWar || Number(meta("ogame-universe-speed-fleet-war")) || 1
    };
  }
  var INACTIVE = ["inactive", "longinactive"];
  var defended = (r) => r.entry.defValue !== 0 || r.entry.fleetValue !== 0;
  function sortRows(rows, view) {
    const val = (r) => {
      switch (view.sort) {
        case "target":
          return r.entry.playerName.toLowerCase();
        case "age":
          return r.ageMinutes;
        case "loot":
          return r.lootMsu;
        case "def":
          return Math.max(0, r.entry.defValue) + Math.max(0, r.entry.fleetValue);
        case "flight":
          return r.flight ?? Infinity;
        case "rate":
          return r.msuPerHour ?? r.lootMsu / 1e9;
      }
    };
    const dir = view.desc ? -1 : 1;
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }
  var duration = (s) => {
    const hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60;
    return hh ? `${hh}h ${String(mm).padStart(2, "0")}m` : `${mm}m ${String(ss).padStart(2, "0")}s`;
  };
  var isSpyTab = (doc) => !!doc.querySelector('[data-subtab-id="20"].active, [data-subtab-id="20"][aria-selected="true"]');
  function mountSpyPanel(o) {
    const { doc } = o;
    ensureMarksStyle(doc);
    const holder = doc.querySelector("#messages .messagesHolder");
    const sortRow = doc.querySelector("#messages #filteredHeadersRow");
    const anchor = sortRow && sortRow.parentElement === holder?.parentElement ? sortRow : holder;
    const old = doc.getElementById(SPY_PANEL_ID);
    if (!holder || !isSpyTab(doc)) {
      old?.remove();
      return;
    }
    const board = o.store.get(SPY_BOARD_KEY, {});
    const view = { ...DEFAULT_VIEW, ...o.store.get(VIEW_KEY2, {}) };
    const sig = JSON.stringify([Object.values(board).map((e) => e.id), view, Math.floor((o.now?.() ?? Date.now()) / 6e4)]);
    if (old && old.dataset.sig === sig && old.nextElementSibling === anchor) return;
    const panel = renderPanel(o, board, view);
    panel.dataset.sig = sig;
    if (old) old.replaceWith(panel);
    anchor.before(panel);
  }
  function renderPanel(o, board, view) {
    const { doc, store, t, locale, spy } = o;
    const now = o.now?.() ?? Date.now();
    const fmt = (n) => formatUnits(n, locale);
    const el5 = (tag, cls = "", text) => {
      const n = doc.createElement(tag);
      if (cls) n.className = cls;
      if (text !== void 0) n.textContent = text;
      return n;
    };
    const redraw = (next = {}) => {
      store.set(VIEW_KEY2, { ...view, ...next });
      mountSpyPanel(o);
    };
    const gameButton = (child, title, onClick, cls = "") => {
      const wrap = el5("gradient-button", cls);
      wrap.setAttribute("sq20", "");
      const b = el5("button", "custom_btn");
      b.type = "button";
      b.title = title;
      b.setAttribute("aria-label", title);
      b.append(child);
      b.addEventListener("click", (e) => {
        e.preventDefault();
        onClick();
      });
      wrap.append(b);
      return wrap;
    };
    const gameIcon = (name) => {
      const img = el5("img");
      img.src = `/cdn/img/icons/basic/${name}.png`;
      img.alt = "";
      img.width = img.height = 16;
      return img;
    };
    const ships = store.get(SHIPS_INFO_KEY, {});
    const info = ships[String(view.ship)];
    const capacity = info?.capacity || (view.ship === 202 ? 5e3 : 25e3);
    const universe = universeOf(doc, store.get(SERVER_DATA_KEY, null));
    const all2 = targetRows(board, spy.bases, { capacity, speed: info?.speed ?? 0, universe, now });
    const rows = sortRows(all2.filter((r) => (!view.hideDefended || !defended(r)) && (!view.inactiveOnly || r.entry.statuses.some((s) => INACTIVE.includes(s)))), view);
    const panel = el5("div", "fut-sp");
    panel.id = SPY_PANEL_ID;
    const head = el5("div", "fut-sp-head");
    const toggle = el5("button", "fut-sp-title");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", String(view.open));
    toggle.append(el5("b", "", t("spy.title")), el5("span", "", t("spy.sub", { n: rows.length, msu: fmt(rows.reduce((s, r) => s + r.lootMsu, 0)) })));
    toggle.addEventListener("click", () => redraw({ open: !view.open }));
    head.append(toggle);
    if (view.open) {
      const chip2 = (text, pressed, next) => {
        const b = el5("button", "fut-sp-chip", text);
        b.type = "button";
        b.setAttribute("aria-pressed", String(pressed));
        b.addEventListener("click", () => redraw(next));
        return b;
      };
      head.append(
        chip2(shipName(203, ships, t), view.ship === 203, { ship: 203 }),
        chip2(shipName(202, ships, t), view.ship === 202, { ship: 202 }),
        chip2(t("spy.hideDefended"), view.hideDefended, { hideDefended: !view.hideDefended }),
        chip2(t("spy.inactiveOnly"), view.inactiveOnly, { inactiveOnly: !view.inactiveOnly })
      );
    }
    panel.append(head);
    if (!view.open) return panel;
    if (!info?.speed) panel.append(el5("p", "fut-sp-note", t("spy.noSpeed")));
    if (!rows.length) {
      panel.append(el5("p", "fut-sp-note", t(all2.length ? "spy.noneFiltered" : "spy.none")));
      return panel;
    }
    const cols = el5("div", "fut-sp-row fut-sp-cols");
    const headers = [["target", "spy.col.target"], ["age", "spy.col.age"], ["loot", "spy.col.loot"], [null, "spy.col.ships"], ["def", "spy.col.def"], ["rate", "spy.col.rate"], [null, "spy.col.actions"]];
    for (const [key2, label] of headers) {
      const c = el5(key2 ? "button" : "span", `fut-sp-h${view.sort === key2 ? " sortBy" : ""}`, t(label));
      if (key2) {
        c.type = "button";
        c.setAttribute("aria-sort", view.sort === key2 ? view.desc ? "descending" : "ascending" : "none");
        c.addEventListener("click", () => redraw(view.sort === key2 ? { desc: !view.desc } : { sort: key2, desc: key2 === "loot" || key2 === "rate" }));
      }
      cols.append(c);
    }
    panel.append(cols);
    const list = el5("div", "fut-sp-list");
    for (const r of rows) {
      const e = r.entry;
      const [g, s, p] = e.coords.split(":");
      const row = el5("div", `fut-sp-row${defended(r) ? " defended" : ""}`);
      const who = el5("div", "fut-sp-who");
      const name = el5("span", "fut-sp-name", e.playerName || "?");
      who.append(name, flagButton({ doc, store, t }, e.playerId, e.playerName));
      for (const st of e.statuses.filter((x) => x !== "active")) who.append(el5("span", `fut-sp-st st-${st}`, t(`spy.status.${st}`)));
      const gal = el5("a", "fut-sp-coords", `[${e.coords}]`);
      gal.href = `/game/index.php?page=ingame&component=galaxy&galaxy=${g}&system=${s}`;
      if (e.moon) gal.prepend(icon(doc, "moon", 10, "fut-sp-moon"));
      who.append(gal);
      const age = el5("div", "fut-sp-num");
      age.append(
        el5("span", r.ageMinutes > 360 ? "old" : r.ageMinutes > 60 ? "warm" : "fresh", r.ageMinutes < 60 ? `${r.ageMinutes}m` : `${Math.floor(r.ageMinutes / 60)}h`),
        el5("small", e.activity === 0 ? "bad" : e.activity < 60 ? "warm" : "", e.activity === 0 ? t("msg.spy.active") : e.activity >= 60 ? ">60m" : `${e.activity}m`)
      );
      age.title = new Date(e.at).toLocaleString(locale);
      const loot = el5("div", "fut-sp-num");
      loot.append(el5("b", "", fmt(r.lootMsu)), el5("small", "", `${fmt(e.res.metal * e.loot)} \xB7 ${fmt(e.res.crystal * e.loot)} \xB7 ${fmt(e.res.deuterium * e.loot)}`));
      loot.title = `${Math.round(e.loot * 100)}% \xB7 ${r.lootRes.toLocaleString(locale)}`;
      const cargo = el5("div", "fut-sp-num", r.ships ? `${r.ships.toLocaleString(locale)}\xD7` : "0");
      cargo.title = shipName(view.ship, ships, t);
      const def = el5("div", `fut-sp-num${defended(r) ? " warm" : ""}`, e.defValue < 0 || e.fleetValue < 0 ? "?" : defended(r) ? fmt(Math.max(0, e.defValue) + Math.max(0, e.fleetValue)) : "0");
      def.title = `${t("msg.spy.fleet")} ${e.fleetValue < 0 ? "?" : fmt(e.fleetValue)} \xB7 ${t("msg.spy.def")} ${e.defValue < 0 ? "?" : fmt(e.defValue)}`;
      const rate = el5("div", "fut-sp-num");
      rate.append(el5("b", "rate", r.msuPerHour !== null ? `${fmt(r.msuPerHour)}/h` : "\u2014"), el5("small", "", r.flight !== null ? duration(r.flight) : "\u2014"));
      if (r.base) rate.title = t("spy.from", { name: r.base.name, coords: r.base.coords });
      const acts = el5("div", "fut-sp-acts");
      if (r.base) {
        const base = r.base;
        acts.append(gameButton(gameIcon("attack"), t("spy.attackHint", { name: base.name }), () => {
          doc.location.assign(`/game/index.php?page=ingame&component=fleetdispatch&cp=${base.id}&galaxy=${g}&system=${s}&position=${p}&type=${e.moon ? 3 : 1}&mission=1`);
        }));
      }
      if (e.apiKey) {
        const key2 = e.apiKey;
        const open = (url) => doc.defaultView?.open(url, "_blank", "noopener");
        const prefill = () => simPrefill(spy.server, r.base ? { coords: r.base.coords, researches: spy.researches, classId: spy.classId } : null, e.coords);
        acts.append(
          gameButton(gameIcon("speed"), t("spy.simGame"), () => open(gameSimLink(key2))),
          gameButton(el5("span", "fut-sp-tool", "OS"), t("spy.simOsims"), () => open(osimsLink(key2, prefill()))),
          gameButton(el5("span", "fut-sp-tool", "OT"), t("spy.simOgameTools"), () => open(ogameToolsSimLink(key2, spy.lang, prefill())))
        );
      }
      acts.append(gameButton(icon(doc, "close", 12), t("spy.remove"), () => {
        const b = store.get(SPY_BOARD_KEY, {});
        delete b[e.key];
        store.set(SPY_BOARD_KEY, b);
        mountSpyPanel(o);
      }, "fut-sp-del"));
      row.append(who, age, loot, cargo, def, rate, acts);
      list.append(row);
    }
    panel.append(list, el5("p", "fut-sp-note", t("spy.hint")));
    return panel;
  }

  // src/modules/messages/index.ts
  var FOLD_KEY = "msg.fold";
  function h2(doc, tag, cls = "", text) {
    const node = doc.createElement(tag);
    if (cls) node.className = cls;
    if (text !== void 0) node.textContent = text;
    return node;
  }
  function shipIcon(doc, id, name, cls) {
    const url = SHIP_ICONS[id];
    if (!url) return h2(doc, "span", `${cls} ${cls}-none`, name.slice(0, 3));
    const img = h2(doc, "img", cls);
    img.src = url;
    img.alt = name;
    img.title = name;
    img.loading = "lazy";
    return img;
  }
  function shipName(id, ships, t) {
    const name = ships[String(id)]?.name;
    if (name) return name;
    const key2 = `ship.${id}`;
    const fallback = t(key2);
    return fallback === key2 ? `#${id}` : fallback;
  }
  function summaryFor(doc, m, o) {
    const { t, locale } = o;
    const fmt = (n) => formatUnits(n, locale);
    const box = h2(doc, "div", `fut-msg fut-msg-${m.kind}`);
    let into = box;
    const chip2 = (text, cls = "", title) => {
      const c = h2(doc, "span", `fut-msg-chip ${cls}`.trim(), text);
      if (title) c.title = title;
      into.append(c);
      return c;
    };
    const linkChip = (text, href, title) => {
      const a = h2(doc, "a", "fut-msg-chip fut-msg-link", text);
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.title = title;
      into.append(a);
    };
    const resChips = (r, sign = 1) => {
      const keys = [
        ["metal", "m"],
        ["crystal", "c"],
        ["deuterium", "d"],
        ["food", "f"],
        ["darkMatter", "dm"]
      ];
      let any = false;
      for (const [key2, cls] of keys) {
        const v = (r[key2] ?? 0) * sign;
        if (!v) continue;
        any = true;
        chip2(`${v > 0 && sign > 0 ? "+" : ""}${fmt(v)}`, `fut-msg-res fut-msg-${cls}${v < 0 ? " fut-msg-neg" : ""}`, `${t(`msg.res.${key2}`)}: ${Math.round(v).toLocaleString(locale)}`);
      }
      return any;
    };
    const unitChips = (units, lost) => {
      for (const [id, n] of Object.entries(units).sort((a, b) => Number(a[0]) - Number(b[0]))) {
        const name = shipName(Number(id), o.ships, t);
        const c = chip2(`${lost ? "\u2212" : "+"}${n.toLocaleString(locale)}`, lost ? "fut-msg-ship fut-msg-neg" : "fut-msg-ship", name);
        c.prepend(shipIcon(doc, Number(id), name, "fut-msg-icon"));
      }
    };
    switch (m.kind) {
      case "expedition":
      case "discovery": {
        box.classList.add("fut-msg-rows");
        if (m.size >= 0) {
          box.classList.add(`fut-size-${m.size}`);
          box.dataset.size = t(`msg.size.${m.size}`);
        }
        const row = (cls) => {
          const r = h2(doc, "div", `fut-msg-row ${cls}`);
          box.append(r);
          into = r;
          return r;
        };
        row("fut-msg-top");
        chip2(m.kind === "discovery" ? `${t("msg.discovery")} \xB7 ${t(`msg.out.${m.result}`)}` : t(`msg.out.${m.result}`), `fut-msg-out fut-out-${m.result}`);
        const value = msu2(m.res) + msu2(unitsValue(m.ships)) - msu2(unitsValue(m.lost));
        if (value) chip2(`${fmt(value)} MSU`, `fut-msg-msu fut-msg-big${value < 0 ? " fut-msg-neg" : ""}`, t("msg.msuHint"));
        const found = row("fut-msg-found");
        resChips(m.res);
        unitChips(m.ships, false);
        unitChips(m.lost, true);
        if (m.item) chip2(m.item, "fut-msg-item");
        if (m.lfXp) chip2(t("msg.lfXp", { n: m.lfXp.toLocaleString(locale) }), "fut-msg-lf");
        if (m.artefacts) chip2(t("msg.artefacts", { n: m.artefacts.toLocaleString(locale) }), "fut-msg-art");
        if (!found.childElementCount) found.remove();
        if (m.depletion > 0) {
          row("fut-msg-foot");
          chip2(t("msg.depletion", { n: m.depletion }), "fut-msg-muted");
        }
        return box;
      }
      case "spy": {
        if (m.counter) {
          chip2(t("msg.spy.counter", { name: m.sourceName || "?", coords: m.sourceCoords || "?" }), "fut-msg-out fut-out-alien");
          return box;
        }
        const act = m.activity === 0 ? t("msg.spy.active") : m.activity >= 60 ? t("msg.spy.inactive") : t("msg.spy.activity", { n: m.activity });
        chip2(act, m.activity === 0 ? "fut-msg-out fut-out-pirate" : m.activity < 60 ? "fut-msg-out fut-out-late" : "fut-msg-out fut-out-nothing");
        const total = m.res.metal + m.res.crystal + m.res.deuterium;
        const loot = Math.floor(total * m.loot);
        chip2(`${t("msg.spy.loot")} ${fmt(loot)}`, "fut-msg-loot", `${Math.round(m.loot * 100)}% \xB7 ${Math.round(loot).toLocaleString(locale)}`);
        const lootMsu = msu2(m.res) * m.loot;
        chip2(`${fmt(lootMsu)} MSU`, "fut-msg-msu", t("msg.msuHint"));
        const capacity = o.ships["203"]?.capacity || 25e3;
        if (loot > 0) chip2(t("msg.spy.cargo", { n: Math.ceil(loot / capacity).toLocaleString(locale), ship: shipName(203, o.ships, t) }), "fut-msg-ship");
        chip2(`${t("msg.spy.fleet")} ${m.fleetValue < 0 ? "?" : fmt(m.fleetValue)}`, m.fleetValue > 0 ? "fut-msg-warn" : "fut-msg-muted");
        chip2(`${t("msg.spy.def")} ${m.defValue < 0 ? "?" : fmt(m.defValue)}`, m.defValue > 0 ? "fut-msg-warn" : "fut-msg-muted");
        if (m.attacked) chip2(t("msg.spy.attacked"), "fut-msg-muted");
        if (m.apiKey && o.spy && o.universe) {
          const base = nearestBase(o.spy.bases, m.coords, o.universe).base;
          const prefill = simPrefill(o.spy.server, base ? { coords: base.coords, researches: o.spy.researches, classId: o.spy.classId } : null, m.coords);
          linkChip("Osims", osimsLink(m.apiKey, prefill), t("spy.simOsims"));
          linkChip("OGame Simulator", ogameToolsSimLink(m.apiKey, o.spy.lang, prefill), t("spy.simOgameTools"));
        }
        return box;
      }
      case "transport":
      case "deploy":
      case "return":
      case "recycle": {
        chip2(t(`msg.${m.kind}`), `fut-msg-out ${m.kind === "recycle" ? "fut-out-resource" : m.kind === "transport" ? "fut-out-trader" : "fut-out-early"}`);
        if (m.from && m.to) {
          const route = chip2("", "fut-msg-route");
          const place2 = (p) => {
            const s = h2(doc, "span", "fut-msg-place", `${p.name ? `${p.name} ` : ""}[${p.coords}]`);
            if (p.moon) s.prepend(icon(doc, "moon", 10, "fut-msg-moon"));
            return s;
          };
          route.append(place2(m.from), h2(doc, "span", "fut-msg-arrow", "\u2192"), place2(m.to));
        }
        const any = resChips(m.res);
        if (any) chip2(`${fmt(msu2(m.res))} MSU`, "fut-msg-msu", t("msg.msuHint"));
        else chip2(t("msg.empty"), "fut-msg-muted");
        const left = m.left ? m.left.metal + m.left.crystal + m.left.deuterium : 0;
        if (left > 0) chip2(t("msg.debrisLeft", { n: fmt(left) }), "fut-msg-warn", `${Math.round(m.left.metal).toLocaleString(locale)} / ${Math.round(m.left.crystal).toLocaleString(locale)} / ${Math.round(m.left.deuterium).toLocaleString(locale)}`);
        return box;
      }
      case "combat": {
        if (m.coords) chip2(`[${m.coords}]`, "fut-msg-route");
        chip2(t(`msg.combat.${m.winner}`), `fut-msg-out ${m.winner === "won" ? "fut-out-resource" : m.winner === "lost" ? "fut-out-blackhole" : "fut-out-nothing"}`);
        const sum = m.loot.metal + m.loot.crystal + m.loot.deuterium;
        if (sum) {
          chip2(t(sum > 0 ? "msg.combat.loot" : "msg.combat.raided"), "fut-msg-muted");
          resChips(m.loot);
        }
        const lost = msu2(unitsValue(m.lost));
        if (lost) chip2(`${t("msg.combat.losses")} ${fmt(lost)} MSU`, "fut-msg-neg", Object.entries(m.lost).map(([id, n]) => `${n.toLocaleString(locale)} ${shipName(Number(id), o.ships, t)}`).join(", "));
        const debris = m.debris.metal + m.debris.crystal + m.debris.deuterium;
        if (debris) chip2(`${t("msg.combat.debris")} ${fmt(debris)}`, "fut-msg-loot");
        if (m.apiKey) linkChip(t("msg.combat.converter"), converterLink(m.apiKey, o.spy?.lang || locale), t("msg.combat.converterHint"));
        return box;
      }
    }
  }
  function place(msg, box) {
    const header = msg.querySelector(":scope > .msgFilteredHeaderRow");
    if (header) return void header.after(box);
    const actions = msg.querySelector(".msg_actions, message-footer");
    if (actions?.parentElement) actions.before(box);
    else (msg.querySelector(".msgContent") ?? msg).after(box);
  }
  function processMessages(o) {
    const { doc, store, t, locale } = o;
    const ships = store.get(SHIPS_INFO_KEY, {});
    const universe = universeOf(doc, store.get(SERVER_DATA_KEY, null));
    const fold = store.get(FOLD_KEY, true);
    const expeditions = [];
    const spies = [];
    let journal = null;
    let added = 0;
    for (const msg of Array.from(doc.querySelectorAll(".msg[data-msg-id]"))) {
      if (msg.hasAttribute("data-fut-done") || msg.closest("#fut-journal")) continue;
      msg.setAttribute("data-fut-done", "");
      const parsed = readMessage(msg, o.playerId);
      if (!parsed) continue;
      const box = summaryFor(doc, parsed, { locale, t, ships, spy: o.spy, universe });
      if (box) {
        box.title = [box.dataset.size, t("msg.toggle")].filter(Boolean).join(" \xB7 ");
        box.addEventListener("click", (e) => {
          if (e.target.closest("a, button")) return;
          const cell = msg.querySelector(":scope > .msgFilteredHeaderRow .msgFilteredHeaderCell");
          if (cell) return void cell.click();
          msg.classList.toggle("fut-msg-folded");
        });
        place(msg, box);
        if (fold && (parsed.kind === "expedition" || parsed.kind === "discovery" || parsed.kind === "recycle" || parsed.kind === "transport" || parsed.kind === "deploy" || parsed.kind === "return")) msg.classList.add("fut-msg-folded");
      }
      if (parsed.kind === "expedition" || parsed.kind === "discovery") expeditions.push(parsed);
      if (parsed.kind === "spy") spies.push(parsed);
      if (parsed.kind === "combat" && parsed.coords?.split(":")[2] === "16" && Object.keys(parsed.lost).length) {
        journal ?? (journal = store.get(JOURNAL_KEY, {}));
        const r = recordCombat(journal, parsed.id, parsed.at, parsed.lost, parsed.coords);
        journal = r.journal;
        added += r.added;
      }
    }
    if (expeditions.length) {
      journal ?? (journal = store.get(JOURNAL_KEY, {}));
      const r = record2(journal, expeditions);
      journal = r.journal;
      added += r.added;
    }
    if (spies.length) {
      const board = store.get(SPY_BOARD_KEY, {});
      if (rememberSpies(board, spies, o.now?.() ?? Date.now())) store.set(SPY_BOARD_KEY, board);
    }
    if (o.spy) mountSpyPanel({ doc, store, t, locale, spy: o.spy, now: o.now });
    if (journal && added) {
      store.set(JOURNAL_KEY, trim(journal, o.now?.() ?? Date.now()));
      o.onJournal?.(added);
    }
    return added;
  }
  function watchMessages(o) {
    const { doc } = o;
    if (!doc.getElementById("fut-msg-style")) {
      const style = h2(doc, "style");
      style.id = "fut-msg-style";
      style.textContent = MESSAGES_CSS;
      doc.head.append(style);
    }
    processMessages(o);
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      setTimeout(() => {
        queued = false;
        processMessages(o);
      }, 50);
    });
    observer.observe(doc.body, { childList: true, subtree: true });
  }

  // src/modules/dashboard/style.ts
  var DASHBOARD_CSS = `
:host { --panel-w: 1120px; }
.moon-ico { margin-right: 4px; vertical-align: -1px; color: var(--muted); }
.kpis { grid-template-columns: repeat(6, minmax(0, 1fr)); }

.cols { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.prod { margin-bottom: 10px; }
.prod-top { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 4px; font-size: 12px; }
.track { height: 6px; border-radius: 3px; background: #1A2638; overflow: hidden; }
.fill { height: 100%; border-radius: 3px; background: currentColor; }
.prod.m { color: #B8C2CC; } .prod.c { color: #7FB8FF; } .prod.d { color: #4FE0B0; }
.prod .prod-top span:first-child { color: #E6EDF5; }
.ok { margin: 0; color: var(--ok); }
.alert { display: flex; gap: 8px; padding: 6px 0; border-top: 1px solid #1A2638; }
.alert:first-of-type { border-top: 0; }
.alert .dot { flex-shrink: 0; width: 8px; height: 8px; margin-top: 5px; border-radius: 50%; background: #7FB8FF; }
.alert.warn .dot { background: #F5B547; }
.alert div { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.alert strong { font-size: 13px; }
.alert span { color: #8A9BB0; font-size: 12px; }

.table-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.table-head h3 { margin: 0; }
.chip {
  height: 26px; padding: 0 10px; border-radius: 7px; border: 1px solid #1F2C40; background: #0A111C;
  color: #B4C2D3; font: 12px Arial, sans-serif; cursor: pointer;
}
.chip:hover { border-color: #4FD1E8; color: #E6EDF5; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { text-align: left; padding: 6px 8px; color: #8A9BB0; font-weight: 600; border-bottom: 1px solid #1F2C40; white-space: nowrap; }
th.num, td.num { text-align: right; }
.sort { all: unset; cursor: pointer; }
.sort:hover { color: #E6EDF5; }
td { padding: 5px 8px; border-bottom: 1px solid #16202F; white-space: nowrap; }
tr.moon td { background: rgba(22,36,58,0.5); color: #C9D4E2; }
tbody tr:hover td { background: rgba(79,209,232,0.07); }
td.name a { color: #E6EDF5; text-decoration: none; font-weight: 700; }
td.name a:hover { color: #8BE4F2; }
tr.moon td.name a { font-weight: 400; color: #C9D4E2; }
.coords { margin-left: 6px; color: #8A9BB0; font-family: "JetBrains Mono", Consolas, monospace; font-size: 11px; }
.tag { margin-left: 6px; padding: 0 5px; border-radius: 4px; background: rgba(245,181,71,0.15); color: #F5B547; font-size: 10px; }
td.m { color: #B8C2CC; } td.c { color: #7FB8FF; } td.d { color: #4FE0B0; }
td.full { color: #F5B547 !important; font-weight: 700; }
.age.fresh { color: #38C56E; } .age.warm { color: #E3BB28; } .age.old { color: #EF7676; }
tfoot td { border-top: 1px solid #1F2C40; border-bottom: 0; font-weight: 700; }

.move { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-top: 1px solid #1A2638; }
.move:first-of-type { border-top: 0; }
.move .n { width: 20px; height: 20px; flex-shrink: 0; border-radius: 50%; background: #12283A; color: #4FD1E8; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.move-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.move-text strong { font-size: 13px; }
.move-text span { color: #8A9BB0; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.roi { color: #4FD1E8; font-weight: 700; white-space: nowrap; }
td.queue { white-space: nowrap; }
.q { display: inline-block; margin-right: 4px; padding: 1px 6px; border-radius: 4px; font-size: 11px; border: 1px solid color-mix(in srgb, currentColor 45%, transparent); background: none; }
.q-building { color: #FF8200; } .q-research { color: #32FB2F; } .q-ship { color: #FFEB00; }
.q-lfbuilding { color: #FF79BD; } .q-lfresearch { color: #42AFFF; }
.tab-body { display: flex; flex-direction: column; gap: 12px; min-width: 0; }

/* Level tables: first column stays put while the rest scrolls. */
.matrix th.col { vertical-align: bottom; white-space: normal; min-width: 44px; max-width: 74px; padding: 6px 4px; line-height: 1.2; }
.matrix .col-name { display: block; font-size: 10px; font-weight: 600; color: #8A9BB0; text-decoration: none; overflow-wrap: normal; hyphens: auto; }
.matrix a.col-name:hover { color: #E6EDF5; }
.matrix th.col.on .col-name { color: #4FD1E8; }
.matrix th.col.on { box-shadow: inset 0 -2px 0 #4FD1E8; }
.matrix td { padding: 4px 6px; }
.matrix th.name, .matrix td.name { position: sticky; left: 0; z-index: 1; background: var(--raised); }
.matrix tr.moon td.name { background: #0F1828; }
.matrix td.tech { color: #C9D4E2; font-weight: 400; max-width: 260px; overflow: hidden; text-overflow: ellipsis; }
td.zero { color: #3A4A60; }
td.top { color: #4FD1E8; }
td.off { opacity: 0.55; }
td.guess { font-style: italic; opacity: 0.7; }
.unit-ico { width: 28px; height: 28px; border-radius: 4px; object-fit: cover; display: block; margin: 0 auto; background: #16202E; }
.unit-ico-none { display: flex; align-items: center; justify-content: center; color: #8A9BB0; font-size: 10px; }

/* Research: name and level in a compact grid. */
.levels { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0 20px; }
.lv { display: flex; justify-content: space-between; gap: 8px; padding: 4px 0; border-bottom: 1px solid #16202F; font-size: 12px; }
.lv span { color: #C9D4E2; } .lv.zero b { color: #3A4A60; }

/* Scrap calculator */
.scrap-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0; }
.field { height: 28px; padding: 0 8px; border: 1px solid #1F2C40; border-radius: 6px; background: #0D1522; color: #E6EDF5; font: 12px Arial, sans-serif; }
.field:focus { border-color: #4FD1E8; outline: none; }
.field-label { display: inline-flex; align-items: center; gap: 6px; color: #8A9BB0; font-size: 12px; }
.field.rate { width: 64px; text-align: right; }
.field.qty { width: 110px; text-align: right; font-family: "JetBrains Mono", Consolas, monospace; }
table.scrap .unit-label { display: flex; align-items: center; gap: 8px; }
table.scrap td.unit .unit-ico { margin: 0; width: 24px; height: 24px; }
.msu { color: #4FD1E8; margin-left: 4px; }
@media (max-width: 1100px) { .kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 900px) {
  .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .cols { grid-template-columns: 1fr; }
}
.charts { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-top: 12px; }
.chart { margin: 0; padding: 10px 12px; border-radius: 10px; background: var(--surface); border: 1px solid var(--line); }
.chart figcaption { margin-bottom: 6px; color: var(--text); font-weight: 700; font-size: 13px; }
.plot { position: relative; }
.chart svg { display: block; width: 100%; height: auto; overflow: visible; }
.chart .grid { stroke: var(--line-soft); stroke-width: 1; }
.chart .axis { fill: var(--muted); font: 10px var(--mono); }
.chart .line { fill: none; stroke: var(--accent); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.chart .cross { stroke: var(--faint); stroke-width: 1; }
.chart .dot { fill: var(--accent); stroke: var(--surface); stroke-width: 2; }
.chart .tip { position: absolute; top: -4px; transform: translateX(-50%); padding: 3px 7px; border-radius: 6px; background: var(--raised); border: 1px solid var(--line); color: var(--text); font: 11px var(--mono); white-space: nowrap; pointer-events: none; }
.kpi .value.neg, td.neg { color: var(--bad); }
td.pos { color: var(--ok); }
table.queues td.kind { color: var(--muted); }
table.queues td.acts { width: 1%; text-align: right; }
.fut-bell { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 6px; border: 1px solid var(--line); background: var(--bg); color: var(--muted); cursor: pointer; }
.fut-bell:hover, .fut-bell:focus-visible { border-color: var(--accent); color: var(--text); }
.fut-bell.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
`;

  // src/modules/dashboard/index.ts
  var TABS = ["summary", "history", "mines", "facilities", "lifeforms", "ships", "defence", "scrap"];
  var HOST_ID = "fut-dashboard";
  var tab = "summary";
  var scrapBody = null;
  var scrapRate = 35;
  var keyHandler = null;
  function h3(tag, className = "", text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== void 0) node.textContent = text;
    return node;
  }
  function closeDashboard(doc) {
    doc.getElementById(HOST_ID)?.remove();
    if (keyHandler) doc.removeEventListener("keydown", keyHandler);
    keyHandler = null;
  }
  function orderedBodies(snapshot, entries) {
    if (!snapshot) return [];
    const byId = new Map(snapshot.bodies.map((b) => [b.id, b]));
    const list = [];
    for (const e of entries) {
      for (const id of [e.planetId, e.moonId]) {
        const b = id ? byId.get(id) : void 0;
        if (b) list.push(b.name ? b : { ...b, name: e.name });
      }
    }
    const listed = new Set(list.map((b) => b.id));
    for (const b of snapshot.bodies) if (!listed.has(b.id)) list.push(b);
    return list;
  }
  var level = (b, id) => b.levels[String(id)] ?? 0;
  var numLocale = "it";
  var count = (n) => n < 1e6 ? n.toLocaleString(numLocale) : formatUnits(n, numLocale);
  function unitsMsu(b, ids) {
    let total = 0;
    let count2 = 0;
    for (const id of ids) {
      const n = level(b, id);
      if (!n) continue;
      const c = rawCost(id, 1);
      total += n * msu(c);
      count2 += n;
    }
    return { msu: total, count: count2 };
  }
  var COMBAT = SHIPS.filter((id) => id !== 212 && id !== 217);
  function fleetMsu(bodies) {
    let out = { msu: 0, count: 0 };
    for (const b of bodies) {
      const f = unitsMsu(b, COMBAT);
      out = { msu: out.msu + f.msu, count: out.count + f.count };
    }
    return out;
  }
  function dayFigures(snapshot) {
    if (!snapshot) return { prodDay: 0, fleet: 0 };
    const prod = snapshot.bodies.reduce((s, b) => s + msu(b.production), 0) * 24;
    return { prodDay: Math.round(prod), fleet: Math.round(fleetMsu(snapshot.bodies).msu) };
  }
  function scrapReturn(amounts, rate) {
    const out = { metal: 0, crystal: 0, deuterium: 0 };
    const k = Math.min(75, Math.max(0, rate)) / 100;
    for (const [id, n] of Object.entries(amounts)) {
      if (!n) continue;
      const c = rawCost(Number(id), 1);
      out.metal += Math.floor(c.metal * n * k);
      out.crystal += Math.floor(c.crystal * n * k);
      out.deuterium += Math.floor(c.deuterium * n * k);
    }
    return out;
  }
  function openDashboard(o) {
    const { doc, t, locale } = o;
    numLocale = locale;
    const keepScroll = doc.getElementById(HOST_ID)?.shadowRoot?.querySelector(".backdrop")?.scrollTop ?? 0;
    closeDashboard(doc);
    const host = doc.createElement("div");
    host.id = HOST_ID;
    host.lang = locale;
    const root = host.attachShadow({ mode: "open" });
    const style = h3("style");
    style.textContent = WINDOW_SHEET + DASHBOARD_CSS;
    root.append(style);
    const backdrop = h3("div", "backdrop");
    const panel = h3("section", "panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", t("dash.title"));
    backdrop.append(panel);
    root.append(backdrop);
    const close = () => closeDashboard(doc);
    keyHandler = (e) => {
      if (e.key === "Escape") close();
    };
    doc.addEventListener("keydown", keyHandler);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) close();
    });
    const redraw = () => openDashboard(o);
    const header = h3("header", "head");
    const titles = h3("div", "titles");
    titles.append(h3("h2", "", t("dash.title")));
    const universe = doc.querySelector('meta[name="ogame-universe-name"]')?.getAttribute("content") ?? "";
    const player = doc.querySelector('meta[name="ogame-player-name"]')?.getAttribute("content") ?? "";
    const sub = [player, universe, o.snapshot ? t("toolbar.lastSync", { time: new Date(o.snapshot.fetchedAt).toLocaleString(locale) }) : t("dash.noData")].filter(Boolean).join(" \xB7 ");
    titles.append(h3("span", "sub", sub));
    const x = h3("button", "close");
    x.append(icon(doc, "close", 16));
    x.type = "button";
    x.setAttribute("aria-label", t("dash.close"));
    x.addEventListener("click", close);
    header.append(titles, x);
    panel.append(header);
    const tabs = h3("nav", "tabs");
    tabs.setAttribute("role", "tablist");
    for (const id of TABS) {
      const b = h3("button", "tab", t(`dash.tab.${id}`));
      b.type = "button";
      b.dataset.tab = id;
      b.setAttribute("aria-pressed", String(id === tab));
      b.addEventListener("click", () => {
        tab = id;
        redraw();
      });
      tabs.append(b);
    }
    panel.append(tabs);
    const ctx = {
      o,
      bodies: orderedBodies(o.snapshot, o.entries),
      fmt: (v) => formatUnits(v, locale),
      name: (id) => techName(id, locale, o.names ?? {}, t),
      redraw
    };
    const body = h3("div", "tab-body");
    if (!o.snapshot) body.append(h3("p", "empty", t("dash.noData")));
    else if (tab === "summary") summaryTab(body, ctx);
    else if (tab === "history") historyTab(body, ctx);
    else if (tab === "mines") minesTab(body, ctx);
    else if (tab === "facilities") facilitiesTab(body, ctx);
    else if (tab === "lifeforms") lifeformsTab(body, ctx);
    else if (tab === "ships") unitsTab(body, ctx, SHIPS, true);
    else if (tab === "defence") unitsTab(body, ctx, DEFENCES, false);
    else scrapTab(body, ctx);
    panel.append(body);
    doc.body.append(host);
    backdrop.scrollTop = keepScroll;
  }
  function section(parent, title, hint) {
    const s = h3("div", "card");
    s.append(h3("h3", "", title));
    parent.append(s);
    if (hint) s.dataset.hint = hint;
    return s;
  }
  function bodyLink(doc, b) {
    const cell = h3("td", "name");
    const link = h3("a", "", b.name);
    if (b.type === "moon") link.prepend(icon(doc, "moon", 11, "moon-ico"));
    link.href = `${doc.location?.origin ?? ""}/game/index.php?page=ingame&component=overview&cp=${b.id}`;
    cell.append(link, h3("span", "coords", `[${b.coords}]`));
    return cell;
  }
  function levelCell(v, max, fmt) {
    const cell = h3("td", `num mono${v === 0 ? " zero" : v === max && max > 0 ? " top" : ""}`, v === 0 ? "\xB7" : fmt ? fmt(v) : String(v));
    return cell;
  }
  function bodyMatrix(ctx, bodies, ids, opts = {}) {
    const { doc, t } = ctx.o;
    const wrap = h3("div", "table-wrap");
    const table = h3("table", "matrix");
    const hr = h3("tr");
    hr.append(h3("th", "name", t("dash.colBody")));
    for (const id of ids) {
      const th = h3("th", "num col");
      const head = opts.head ? opts.head(id) : ctx.name(id);
      if (typeof head === "string") th.append(h3("span", "col-name", head));
      else th.append(head);
      th.title = ctx.name(id);
      hr.append(th);
    }
    for (const e of opts.extra ?? []) hr.append(h3("th", "num", e.label));
    const thead = h3("thead");
    thead.append(hr);
    table.append(thead);
    const max = new Map(ids.map((id) => {
      const values = bodies.map((b) => level(b, id));
      const top = Math.max(0, ...values);
      return [id, values.every((v) => v === top) ? -1 : top];
    }));
    const tbody = h3("tbody");
    for (const b of bodies) {
      const tr = h3("tr", b.type);
      tr.append(bodyLink(doc, b));
      for (const id of ids) tr.append(levelCell(level(b, id), opts.units ? -1 : max.get(id), opts.units ? count : void 0));
      for (const e of opts.extra ?? []) tr.append(h3("td", `num mono ${e.cls ?? ""}`, e.value(b)));
      tbody.append(tr);
    }
    table.append(tbody);
    if (opts.foot && bodies.length) {
      const fr = h3("tr");
      fr.append(h3("td", "name", t(opts.foot === "sum" ? "dash.total" : "dash.average")));
      for (const id of ids) {
        const values = bodies.map((b) => level(b, id));
        const total = values.reduce((a, v) => a + v, 0);
        fr.append(h3("td", "num mono", opts.foot === "sum" ? total ? count(total) : "\xB7" : (total / values.length).toLocaleString(ctx.o.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })));
      }
      for (let i = 0; i < (opts.extra ?? []).length; i++) fr.append(h3("td"));
      const tfoot = h3("tfoot");
      tfoot.append(fr);
      table.append(tfoot);
    }
    wrap.append(table);
    return wrap;
  }
  function summaryTab(parent, ctx) {
    const { o, fmt } = ctx;
    const { t } = o;
    const rows = bodyRows(o.snapshot, o.entries, o.now, o.queues ?? null);
    const sum = summarize(rows);
    const alerts = accountAlerts(rows, o.snapshot, o.entries);
    const kpis = h3("div", "kpis");
    const kpi = (label, value, note, cls = "") => {
      const box = h3("div", `kpi ${cls}`);
      box.append(h3("span", "label", label), h3("span", "value", value), h3("span", "note", note));
      kpis.append(box);
    };
    if (o.score) {
      const rank = o.score.rank !== null ? t("dash.rank", { rank: o.score.rank, of: o.score.of ?? "?" }) : "";
      kpi(t("dash.points"), o.score.points.toLocaleString(o.locale), rank);
    } else kpi(t("dash.points"), "\u2014", t("dash.pointsHint"));
    kpi(t("dash.stock"), fmt(msu(sum.stock)), `${fmt(sum.stock.metal)} \xB7 ${fmt(sum.stock.crystal)} \xB7 ${fmt(sum.stock.deuterium)}`, "accent");
    kpi(t("dash.prodDayK"), `+${fmt(msu(sum.perHour) * 24)}`, t("dash.prodHourNote", { value: fmt(msu(sum.perHour)) }), "accent");
    const fleet = fleetMsu(ctx.bodies);
    let def = { msu: 0, count: 0 };
    for (const b of ctx.bodies) {
      const d = unitsMsu(b, DEFENCES.filter((id) => id < 500));
      def = { msu: def.msu + d.msu, count: def.count + d.count };
    }
    kpi(t("dash.fleetValue"), fmt(fleet.msu), t("dash.unitsNote", { n: fmt(fleet.count) }));
    kpi(t("dash.defValue"), fmt(def.msu), t("dash.unitsNote", { n: fmt(def.count) }));
    const running = /* @__PURE__ */ new Map();
    let busy = 0;
    for (const r of rows) {
      const items = activeItems(o.queues?.bodies[String(r.id)], o.now);
      if (items.length) busy++;
      for (const k of new Set(items.map((i) => i.kind))) running.set(k, (running.get(k) ?? 0) + 1);
    }
    const breakdown = QUEUE_KINDS.filter((k) => running.has(k)).map((k) => `${running.get(k)} ${t(`queue.${k}`).toLowerCase()}`).join(" \xB7 ");
    kpi(t("dash.queues"), o.queues ? String(busy) : "\u2014", o.queues ? breakdown || t("dash.queuesNone") : t("dash.queuesUnknown"), "accent");
    parent.append(kpis);
    const cols = h3("div", "cols");
    const prod = h3("div", "card");
    prod.append(h3("h3", "", t("dash.production")));
    const maxRate = Math.max(1, sum.perHour.metal, sum.perHour.crystal * 1.5, sum.perHour.deuterium * 3);
    const bar = (label, perHour, weight, cls) => {
      const line = h3("div", `prod ${cls}`);
      const top = h3("div", "prod-top");
      top.append(h3("span", "", label), h3("span", "mono", `+${fmt(perHour * 24)}/${t("dash.dayShort")}`));
      const track = h3("div", "track");
      const fill = h3("div", "fill");
      fill.style.width = `${Math.round(perHour * weight / maxRate * 100)}%`;
      track.append(fill);
      line.append(top, track);
      prod.append(line);
    };
    bar(t("res.metal"), sum.perHour.metal, 1, "m");
    bar(t("res.crystal"), sum.perHour.crystal, 1.5, "c");
    bar(t("res.deuterium"), sum.perHour.deuterium, 3, "d");
    const bySpecies = /* @__PURE__ */ new Map();
    for (const b of ctx.bodies) if (b.type === "planet" && b.species) bySpecies.set(b.species, (bySpecies.get(b.species) ?? 0) + 1);
    if (bySpecies.size) {
      const lf = h3("p", "hint");
      lf.textContent = SPECIES.filter((s) => bySpecies.has(s)).map((s) => `${t(`lf.${s}`)} ${bySpecies.get(s)}`).join(" \xB7 ");
      prod.append(h3("h4", "", t("dash.tab.lifeforms")), lf);
    }
    const movesCard = h3("div", "card");
    movesCard.append(h3("h3", "", t("dash.moves")));
    const moves = bestUpgrades(o.snapshot, o.entries, 5);
    if (!moves.length) movesCard.append(h3("p", "hint", t("dash.movesNone")));
    moves.forEach((m, i) => {
      const line = h3("div", "move");
      line.append(h3("span", "n", String(i + 1)));
      const text = h3("div", "move-text");
      text.append(h3("strong", "", `${t(`mine.${m.mine}`)} ${m.from} \u2192 ${m.from + 1}`));
      text.append(h3("span", "", `${m.name} [${m.coords}] \xB7 ${fmt(m.cost.metal)} M \xB7 ${fmt(m.cost.crystal)} C`));
      line.append(text, h3("span", "roi mono", m.days < 1 ? `<1 ${t("dash.daysShort")}` : `${m.days.toLocaleString(ctx.o.locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${t("dash.daysShort")}`));
      movesCard.append(line);
    });
    movesCard.append(h3("p", "hint", t("dash.movesHint")));
    const checks = h3("div", "card");
    checks.append(h3("h3", "", t("dash.checks")));
    if (!alerts.length) checks.append(h3("p", "ok", t("dash.allGood")));
    for (const a of alerts) {
      const item = h3("div", `alert ${a.level}`);
      item.append(h3("span", "dot"));
      const text = h3("div", "");
      text.append(h3("strong", "", t(a.key, { count: a.count })));
      text.append(h3("span", "", a.names.slice(0, 6).join(", ") + (a.names.length > 6 ? ` +${a.names.length - 6}` : "")));
      item.append(text);
      checks.append(item);
    }
    cols.append(prod, movesCard, checks);
    parent.append(cols);
    const inQueue = [];
    for (const b of ctx.bodies) for (const item of activeItems(o.queues?.bodies[String(b.id)], o.now)) inQueue.push({ body: b, item });
    if (inQueue.length) {
      inQueue.sort((a, b) => a.item.end - b.item.end);
      const qs = section(parent, t("dash.queuesTitle"), o.bell ? t("dash.queuesHint") : void 0);
      const wrap = h3("div", "table-wrap");
      const table = h3("table", "queues");
      const tbody = h3("tbody");
      for (const { body: b, item } of inQueue) {
        const tr = h3("tr", b.type === "moon" ? "moon" : "");
        const name = h3("td", "name");
        name.append(bodyLink(o.doc, b));
        const what = queueLabel(item, o.locale);
        const end = h3("td", "num", remaining(item.end, o.now));
        end.title = new Date(item.end).toLocaleString(o.locale);
        const bell = h3("td", "acts");
        if (o.bell) bell.append(o.bell({ id: `q:${b.id}:${item.kind}:${item.name}:${item.level}:${Math.round(item.end / 6e4)}`, label: `${b.name}: ${what}`, at: item.end }));
        tr.append(name, h3("td", "kind", t(`queue.${item.kind}`)), h3("td", "", what), end, bell);
        tbody.append(tr);
      }
      table.append(tbody);
      wrap.append(table);
      qs.append(wrap);
    }
    const research = section(parent, t("dash.research"));
    const grid2 = h3("div", "levels");
    for (const id of RESEARCH) {
      const v = o.snapshot?.researches[String(id)] ?? 0;
      const item = h3("div", `lv${v ? "" : " zero"}`);
      item.append(h3("span", "", ctx.name(id)), h3("b", "mono", String(v)));
      grid2.append(item);
    }
    research.append(grid2);
  }
  var SVG = "http://www.w3.org/2000/svg";
  function svg(doc, tag, attrs) {
    const node = doc.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    return node;
  }
  function lineChart(doc, days, value, fmt, label, locale) {
    const W = 520, H = 140, L2 = 56, R = 8, T = 10, B = 22;
    const pts = days.filter((d) => value(d) > 0);
    const box = h3("figure", "chart");
    box.append(h3("figcaption", "", label));
    if (pts.length < 2) {
      box.append(h3("p", "hint", "\u2014"));
      return box;
    }
    const t0 = pts[0].at, t1 = pts.at(-1).at;
    const vs = pts.map(value);
    let lo = Math.min(...vs), hi = Math.max(...vs);
    if (hi === lo) {
      lo *= 0.99;
      hi *= 1.01;
    }
    const x = (at) => L2 + (at - t0) / Math.max(1, t1 - t0) * (W - L2 - R);
    const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const chart = svg(doc, "svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${label}: ${fmt(vs[0])} \u2192 ${fmt(vs.at(-1))}` });
    for (const v of [lo, hi]) {
      chart.append(svg(doc, "line", { x1: L2, x2: W - R, y1: y(v), y2: y(v), class: "grid" }));
      const tx = svg(doc, "text", { x: L2 - 6, y: y(v) + 4, "text-anchor": "end", class: "axis" });
      tx.textContent = fmt(v);
      chart.append(tx);
    }
    const date = (at) => new Date(at).toLocaleDateString(locale, { day: "numeric", month: "short" });
    for (const [at, anchor] of [[t0, "start"], [t1, "end"]]) {
      const tx = svg(doc, "text", { x: x(at), y: H - 6, "text-anchor": anchor, class: "axis" });
      tx.textContent = date(at);
      chart.append(tx);
    }
    chart.append(svg(doc, "polyline", { points: pts.map((d) => `${x(d.at).toFixed(1)},${y(value(d)).toFixed(1)}`).join(" "), class: "line" }));
    const cross = svg(doc, "line", { y1: T, y2: H - B, class: "cross", visibility: "hidden" });
    const dot = svg(doc, "circle", { r: 4, class: "dot", visibility: "hidden" });
    const hit = svg(doc, "rect", { x: L2, y: 0, width: W - L2 - R, height: H, fill: "transparent" });
    chart.append(cross, dot, hit);
    const tip = h3("div", "tip");
    tip.hidden = true;
    hit.addEventListener("mousemove", (e) => {
      const r = chart.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width * W;
      const d = pts.reduce((a, b) => Math.abs(x(b.at) - px) < Math.abs(x(a.at) - px) ? b : a);
      for (const n of [cross, dot]) n.setAttribute("visibility", "visible");
      cross.setAttribute("x1", String(x(d.at)));
      cross.setAttribute("x2", String(x(d.at)));
      dot.setAttribute("cx", String(x(d.at)));
      dot.setAttribute("cy", String(y(value(d))));
      tip.hidden = false;
      tip.textContent = `${date(d.at)} \xB7 ${fmt(value(d))}`;
      tip.style.left = `${x(d.at) / W * 100}%`;
    });
    hit.addEventListener("mouseleave", () => {
      for (const n of [cross, dot]) n.setAttribute("visibility", "hidden");
      tip.hidden = true;
    });
    const plot = h3("div", "plot");
    plot.append(chart, tip);
    box.append(plot);
    return box;
  }
  function historyTab(parent, ctx) {
    const { o, fmt } = ctx;
    const { t, locale } = o;
    const days = o.history ?? [];
    if (days.length < 2) {
      parent.append(h3("p", "empty", t("dash.historyEmpty")));
      return;
    }
    const signed = (v, f) => v > 0 ? `+${f(v)}` : v < 0 ? `\u2212${f(-v)}` : "0";
    const kpis = h3("div", "kpis");
    for (const span of [1, 7, 30]) {
      const c = changeOver(days, span);
      const box = h3("div", "kpi");
      box.append(h3("span", "label", t("dash.historySpan", { n: span })));
      box.append(h3("span", `value ${c && c.points < 0 ? "neg" : ""}`, c ? signed(c.points, (n) => n.toLocaleString(locale)) : "\u2014"));
      const rank = c?.rank ? t(c.rank > 0 ? "dash.historyUp" : "dash.historyDown", { n: Math.abs(c.rank) }) : "";
      box.append(h3("span", "note", c ? [t("dash.historyPerDay", { v: fmt(c.perDay) }), rank, c.days !== span ? t("dash.historyReal", { n: c.days }) : ""].filter(Boolean).join(" \xB7 ") : t("dash.historyFew")));
      kpis.append(box);
    }
    parent.append(kpis);
    const charts = h3("div", "cols charts");
    charts.append(
      lineChart(o.doc, days, (d) => d.points, (v) => formatUnits(v, locale), t("dash.points"), locale),
      lineChart(o.doc, days, (d) => d.prodDay, (v) => formatUnits(v, locale), t("dash.historyProd"), locale)
    );
    parent.append(charts);
    const s = section(parent, t("dash.historyDays"));
    const wrap = h3("div", "table-wrap");
    const table = h3("table", "history");
    const head = h3("tr");
    for (const k of ["dash.historyDay", "dash.points", "dash.historyDelta", "dash.historyRank", "dash.historyProd", "dash.fleetValue"]) head.append(h3("th", "", t(k)));
    const thead = h3("thead");
    thead.append(head);
    table.append(thead);
    const tbody = h3("tbody");
    [...days].reverse().slice(0, 60).forEach((d, i, list) => {
      const prev = list[i + 1];
      const tr = h3("tr");
      const delta = prev ? d.points - prev.points : 0;
      const rankMove = prev && d.rank !== null && prev.rank !== null ? prev.rank - d.rank : 0;
      tr.append(
        h3("td", "", new Date(d.at).toLocaleDateString(locale)),
        h3("td", "mono", d.points.toLocaleString(locale)),
        h3("td", `mono ${delta < 0 ? "neg" : delta > 0 ? "pos" : ""}`, prev ? signed(delta, (n) => n.toLocaleString(locale)) : ""),
        h3("td", "mono", d.rank === null ? "\u2014" : `${d.rank.toLocaleString(locale)}${rankMove ? ` (${rankMove > 0 ? "\u2191" : "\u2193"}${Math.abs(rankMove)})` : ""}`),
        h3("td", "mono", d.prodDay ? `+${fmt(d.prodDay)}` : "\u2014"),
        h3("td", "mono", d.fleet ? fmt(d.fleet) : "\u2014")
      );
      tbody.append(tr);
    });
    table.append(tbody);
    wrap.append(table);
    s.append(wrap);
  }
  function minesTab(parent, ctx) {
    const { t } = ctx.o;
    const planets = ctx.bodies.filter((b) => b.type === "planet");
    const s = section(parent, t("dash.tab.mines"));
    s.append(
      bodyMatrix(ctx, planets, MINES2, {
        foot: "avg",
        extra: [
          { label: `${t("res.metal")}/${t("dash.dayShort")}`, cls: "m", value: (b) => ctx.fmt(b.production.metal * 24) },
          { label: `${t("res.crystal")}/${t("dash.dayShort")}`, cls: "c", value: (b) => ctx.fmt(b.production.crystal * 24) },
          { label: `${t("res.deuterium")}/${t("dash.dayShort")}`, cls: "d", value: (b) => ctx.fmt(b.production.deuterium * 24) }
        ]
      })
    );
    s.append(h3("p", "hint", t("dash.minesHint")));
  }
  function facilitiesTab(parent, ctx) {
    const { t } = ctx.o;
    const planets = ctx.bodies.filter((b) => b.type === "planet");
    const moons = ctx.bodies.filter((b) => b.type === "moon");
    section(parent, t("dash.planets")).append(bodyMatrix(ctx, planets, PLANET_FACILITIES, { foot: "avg" }));
    if (moons.length) section(parent, t("dash.moons")).append(bodyMatrix(ctx, moons, MOON_FACILITIES, { foot: "avg" }));
  }
  function lifeformsTab(parent, ctx) {
    const { o, name } = ctx;
    const { t, doc } = o;
    const planets = ctx.bodies.filter((b) => b.type === "planet");
    const active = new Map(planets.map((p) => [p.id, { b: activeLfBuildings(p), r: activeLfResearch(p, o.lfSlots?.[String(p.id)]) }]));
    parent.append(h3("p", "hint", t("dash.lfHint")));
    const table = (title, pick) => {
      const s = section(parent, title);
      const ids = [...new Set(planets.flatMap((p) => pick(p).filter((a) => a.level > 0).map((a) => a.id)))].sort(
        (a, b) => a % 100 - b % 100 || a - b
      );
      if (!ids.length) {
        s.append(h3("p", "hint", t("dash.lfNone")));
        return;
      }
      const wrap = h3("div", "table-wrap");
      const tab2 = h3("table", "matrix lf");
      const hr = h3("tr");
      hr.append(h3("th", "name", ""));
      for (const p of planets) {
        const th = h3("th", "num col");
        const a = h3("a", "col-name", p.name);
        a.href = `${doc.location?.origin ?? ""}/game/index.php?page=ingame&component=lfresearch&cp=${p.id}`;
        th.append(a);
        th.title = `${p.name} [${p.coords}]${p.species ? ` \xB7 ${t(`lf.${p.species}`)}` : ""}`;
        hr.append(th);
      }
      const thead = h3("thead");
      thead.append(hr);
      tab2.append(thead);
      const tbody = h3("tbody");
      for (const id of ids) {
        const tr = h3("tr");
        const sp = speciesOf(id);
        tr.append(h3("td", "name tech", `${name(id)}${sp ? ` \xB7 ${t(`lf.${sp}`)}` : ""}`));
        const on = planets.map((p) => pick(p).find((a) => a.id === id));
        const values = on.flatMap((a) => a ? [a.level] : []);
        const max = values.length > 1 && values.some((v) => v !== Math.max(...values)) ? Math.max(...values) : -1;
        on.forEach((a) => {
          const cell = levelCell(a?.level ?? 0, max);
          if (a?.guessed) {
            cell.classList.add("guess");
            cell.title = t("dash.lfGuess");
          }
          tr.append(cell);
        });
        tbody.append(tr);
      }
      tab2.append(tbody);
      wrap.append(tab2);
      s.append(wrap);
    };
    table(t("dash.lfBuildings"), (p) => active.get(p.id).b);
    table(t("dash.lfResearch"), (p) => active.get(p.id).r);
  }
  function unitsTab(parent, ctx, ids, ships) {
    const { t, doc } = ctx.o;
    const shown = ids.filter((id) => ctx.bodies.some((b) => level(b, id) > 0));
    const s = section(parent, t(ships ? "dash.tab.ships" : "dash.tab.defence"));
    if (!shown.length) {
      s.append(h3("p", "hint", t("dash.unitsNone")));
      return;
    }
    const bodies = ctx.bodies.filter((b) => shown.some((id) => level(b, id) > 0));
    s.append(
      bodyMatrix(ctx, bodies, shown, {
        units: true,
        foot: "sum",
        head: ships ? (id) => shipIcon(doc, id, ctx.name(id), "unit-ico") : void 0,
        extra: [{ label: t("dash.valueMsu"), value: (b) => ctx.fmt(unitsMsu(b, shown).msu) }]
      })
    );
  }
  function scrapTab(parent, ctx) {
    const { t } = ctx.o;
    const units = [...SHIPS, ...DEFENCES.filter((id) => id < 500)];
    const owners = ctx.bodies.filter((b) => units.some((id) => level(b, id) > 0));
    const s = section(parent, t("dash.tab.scrap"));
    s.append(h3("p", "hint", t("dash.scrapHint")));
    if (!owners.length) {
      s.append(h3("p", "hint", t("dash.unitsNone")));
      return;
    }
    if (!owners.some((b) => b.id === scrapBody)) scrapBody = owners[0].id;
    const body = owners.find((b) => b.id === scrapBody);
    const bar = h3("div", "scrap-bar");
    const pick = h3("select", "field");
    for (const b of owners) {
      const opt = h3("option", "", `${b.type === "moon" ? `${t("dash.moon")} ` : ""}${b.name} [${b.coords}]`);
      opt.value = String(b.id);
      opt.selected = b.id === body.id;
      pick.append(opt);
    }
    pick.addEventListener("change", () => {
      scrapBody = Number(pick.value);
      ctx.redraw();
    });
    const rateLabel = h3("label", "field-label", t("dash.scrapRate"));
    const rate = h3("input", "field rate");
    rate.type = "number";
    rate.min = "35";
    rate.max = "75";
    rate.step = "1";
    rate.value = String(scrapRate);
    rateLabel.append(rate, h3("span", "", "%"));
    const all2 = h3("button", "chip", t("dash.scrapAll"));
    all2.type = "button";
    const none = h3("button", "chip", t("dash.scrapNone"));
    none.type = "button";
    bar.append(pick, rateLabel, all2, none);
    s.append(bar);
    const wrap = h3("div", "table-wrap");
    const table = h3("table", "scrap");
    const hr = h3("tr");
    for (const [label, cls] of [[t("dash.unit"), ""], [t("dash.owned"), "num"], [t("dash.toScrap"), "num"], [t("res.metal"), "num"], [t("res.crystal"), "num"], [t("res.deuterium"), "num"]]) hr.append(h3("th", cls, label));
    const thead = h3("thead");
    thead.append(hr);
    table.append(thead);
    const tbody = h3("tbody");
    const inputs = /* @__PURE__ */ new Map();
    const outs = /* @__PURE__ */ new Map();
    for (const id of units) {
      const owned = level(body, id);
      if (!owned) continue;
      const tr = h3("tr");
      const nameCell = h3("td", "unit");
      const label = h3("span", "unit-label");
      if (id < 400) label.append(shipIcon(ctx.o.doc, id, ctx.name(id), "unit-ico"));
      label.append(h3("span", "", ctx.name(id)));
      nameCell.append(label);
      tr.append(nameCell, h3("td", "num mono", count(owned)));
      const qty = h3("input", "field qty");
      qty.type = "number";
      qty.min = "0";
      qty.max = String(owned);
      qty.value = "0";
      qty.setAttribute("aria-label", ctx.name(id));
      inputs.set(id, qty);
      const qCell = h3("td", "num");
      qCell.append(qty);
      tr.append(qCell);
      const cells = [h3("td", "num mono m"), h3("td", "num mono c"), h3("td", "num mono d")];
      outs.set(id, cells);
      tr.append(...cells);
      tbody.append(tr);
    }
    table.append(tbody);
    const fr = h3("tr");
    const totalCells = [h3("td", "num mono m"), h3("td", "num mono c"), h3("td", "num mono d")];
    const msuCell = h3("span", "mono msu");
    const totalName = h3("td", "name", `${t("dash.total")} `);
    totalName.append(msuCell);
    fr.append(totalName, h3("td"), h3("td"), ...totalCells);
    const tfoot = h3("tfoot");
    tfoot.append(fr);
    table.append(tfoot);
    wrap.append(table);
    s.append(wrap);
    const update = () => {
      scrapRate = Math.min(75, Math.max(35, Number(rate.value) || 35));
      const amounts = {};
      for (const [id, input] of inputs) {
        const n = Math.min(level(body, id), Math.max(0, Math.floor(Number(input.value) || 0)));
        amounts[id] = n;
        const r = scrapReturn({ [id]: n }, scrapRate);
        const [m, c, d] = outs.get(id);
        m.textContent = n ? ctx.fmt(r.metal) : "\xB7";
        c.textContent = n ? ctx.fmt(r.crystal) : "\xB7";
        d.textContent = n ? ctx.fmt(r.deuterium) : "\xB7";
      }
      const total = scrapReturn(amounts, scrapRate);
      totalCells[0].textContent = ctx.fmt(total.metal);
      totalCells[1].textContent = ctx.fmt(total.crystal);
      totalCells[2].textContent = ctx.fmt(total.deuterium);
      msuCell.textContent = `\xB7 ${ctx.fmt(msu(total))} MSU`;
    };
    for (const input of inputs.values()) input.addEventListener("input", update);
    rate.addEventListener("input", update);
    all2.addEventListener("click", () => {
      for (const [id, input] of inputs) input.value = String(level(body, id));
      update();
    });
    none.addEventListener("click", () => {
      for (const input of inputs.values()) input.value = "0";
      update();
    });
    update();
  }

  // src/data/tech-details.ts
  var num3 = (value) => {
    if (value == null) return null;
    const n = Number(String(value).replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) && String(value).trim() !== "" ? n : null;
  };
  function readTechList(doc) {
    return Array.from(doc.querySelectorAll("#technologies .technology[data-technology]")).flatMap((el5) => {
      const id = Number(el5.getAttribute("data-technology"));
      const built = num3(el5.querySelector(".level")?.getAttribute("data-value"));
      if (!id || built === null) return [];
      const target = num3(el5.querySelector(".targetlevel")?.getAttribute("data-value"));
      return [{ id, name: el5.getAttribute("aria-label") ?? el5.getAttribute("title") ?? String(id), built, level: Math.max(built, target ?? 0) }];
    });
  }
  function levelsOf(list) {
    return Object.fromEntries(list.map((e) => [e.id, e.level]));
  }
  function costValue(root, cls) {
    const el5 = root.querySelector(`.costs .${cls}`);
    if (!el5) return void 0;
    const v = num3(el5.getAttribute("data-value")) ?? num3(el5.getAttribute("data-tooltip-title") ?? el5.getAttribute("title")) ?? num3(el5.textContent);
    return v ?? void 0;
  }
  function readTechDetails(doc) {
    const root = doc.querySelector("#technologydetails");
    if (!root) return null;
    const id = Number(root.getAttribute("data-technology-id") ?? root.querySelector("[data-technology-id]")?.getAttribute("data-technology-id"));
    if (!id) return null;
    const shown = {};
    const metal = costValue(root, "metal");
    const crystal = costValue(root, "crystal");
    const deuterium = costValue(root, "deuterium");
    const energy = costValue(root, "energy");
    if (metal !== void 0) shown.metal = metal;
    if (crystal !== void 0) shown.crystal = crystal;
    if (deuterium !== void 0) shown.deuterium = deuterium;
    if (energy !== void 0) shown.energy = energy;
    const time = root.querySelector(".build_duration time, .build_duration [datetime]");
    const durationMs = time ? isoDurationMs(time.getAttribute("datetime") ?? "") : null;
    return {
      root,
      id,
      name: root.querySelector("h3")?.textContent?.trim() ?? String(id),
      panelLevel: num3(root.querySelector(".information .level")?.getAttribute("data-value")),
      shown,
      durationMs,
      amountInput: root.querySelector("#build_amount")
    };
  }

  // src/data/fleet-page.ts
  function isFleetDispatch(doc) {
    return doc.getElementById("fleetdispatchcomponent") !== null && doc.getElementById("fleet1") !== null;
  }
  function readShipSlots(doc) {
    return Array.from(doc.querySelectorAll("#fleet1 #technologies li[data-technology]")).flatMap((li) => {
      const input = li.querySelector("input");
      if (!input) return [];
      const amount = li.querySelector(".amount");
      const available = Number(amount?.dataset.value ?? 0) || 0;
      return [{ id: li.dataset.technology ?? "", name: li.getAttribute("aria-label") ?? "", available, input }];
    });
  }
  function originCoords(doc) {
    const raw = doc.querySelector('meta[name="ogame-planet-coordinates"]')?.getAttribute("content");
    const parts = raw?.split(":").map(Number);
    if (!parts || parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
    return { galaxy: parts[0], system: parts[1], position: parts[2] };
  }

  // src/engines/planner.ts
  var PLAN_KEY = "planner";
  var isResearch = (id) => id > 100 && id < 200 || Math.floor(id % 1e3 / 100) === 2;
  function addToPlan(plan, bodyId, items) {
    const key2 = String(bodyId);
    const list = [...plan[key2] ?? []];
    for (const item of items) {
      const same = item.level !== void 0 ? list.findIndex((x) => x.id === item.id && x.level === item.level) : -1;
      if (same >= 0) list[same] = item;
      else list.push(item);
    }
    list.sort((a, b) => a.added - b.added || a.id - b.id || (a.level ?? 0) - (b.level ?? 0));
    return { ...plan, [key2]: list };
  }
  function removeFromPlan(plan, bodyId, index) {
    const key2 = String(bodyId);
    const list = (plan[key2] ?? []).filter((_, i) => i !== index);
    const next = { ...plan };
    if (list.length) next[key2] = list;
    else delete next[key2];
    return next;
  }
  function prune(plan, bodyId, levels) {
    let changed = false;
    const next = {};
    for (const [key2, list] of Object.entries(plan)) {
      const kept = list.filter((item) => {
        if (item.level === void 0) return true;
        const here = key2 === String(bodyId) || isResearch(item.id);
        const reached = levels[item.id];
        if (here && reached !== void 0 && reached >= item.level) {
          changed = true;
          return false;
        }
        return true;
      });
      if (kept.length) next[key2] = kept;
    }
    return { plan: changed ? next : plan, changed };
  }
  function planTotal(items) {
    return items.reduce((sum, item) => addCost(sum, item.cost), { ...ZERO_COST });
  }
  function planCount(plan) {
    return Object.values(plan).reduce((n, list) => n + list.length, 0);
  }
  function planMissing(items, have) {
    return missing(planTotal(items), have);
  }
  function inPlan(plan, bodyId, id, level2) {
    return (plan[String(bodyId)] ?? []).some((x) => x.id === id && (level2 === void 0 || x.level === level2));
  }
  var SENT_KEY = "plan.sent";
  function pendingFor(list, target, seenAt) {
    const out = { metal: 0, crystal: 0, deuterium: 0, arriveAt: 0 };
    for (const s of list) {
      if (s.target !== target || s.arriveAt <= seenAt) continue;
      out.metal += s.cargo.metal;
      out.crystal += s.cargo.crystal;
      out.deuterium += s.cargo.deuterium;
      out.arriveAt = Math.max(out.arriveAt, s.arriveAt);
    }
    return out;
  }
  function prunePending(list, plan, seenAtOf) {
    return list.filter((s) => (plan[String(s.target)]?.length ?? 0) > 0 && s.arriveAt > seenAtOf(s.target));
  }
  var norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  function pruneByQueues(plan, queues) {
    let changed = false;
    const started = [];
    for (const [body, items] of Object.entries(queues)) for (const q of items) if (q.level > 0 && q.name) started.push({ body, name: norm(q.name), level: q.level });
    const next = {};
    for (const [key2, list] of Object.entries(plan)) {
      const kept = list.filter((item) => {
        if (item.level === void 0) return true;
        const hit = started.some((s) => (s.body === key2 || isResearch(item.id)) && s.name === norm(item.name) && s.level >= item.level);
        if (hit) changed = true;
        return !hit;
      });
      if (kept.length) next[key2] = kept;
    }
    return { plan: changed ? next : plan, changed };
  }
  function startBuild(plan, bodyId, id, o) {
    const key2 = String(bodyId);
    let changed = false;
    const next = {};
    for (const [k, list] of Object.entries(plan)) {
      let left = o.amount ?? 0;
      const kept = [];
      for (const item of list) {
        if (item.id !== id || k !== key2 && !isResearch(id)) {
          kept.push(item);
          continue;
        }
        if (item.level !== void 0 && o.level !== void 0 && item.level <= o.level) {
          changed = true;
          continue;
        }
        if (item.amount !== void 0 && left > 0 && k === key2) {
          changed = true;
          if (item.amount <= left) {
            left -= item.amount;
            continue;
          }
          const keep = item.amount - left;
          const share = keep / item.amount;
          kept.push({ ...item, amount: keep, cost: { metal: Math.round(item.cost.metal * share), crystal: Math.round(item.cost.crystal * share), deuterium: Math.round(item.cost.deuterium * share), energy: item.cost.energy } });
          left = 0;
          continue;
        }
        kept.push(item);
      }
      if (kept.length) next[k] = kept;
    }
    return { plan: changed ? next : plan, changed };
  }
  function groupByTech(plan, haveOf) {
    const groups = /* @__PURE__ */ new Map();
    for (const [key2, items] of Object.entries(plan)) {
      const bodyId = Number(key2);
      const have = haveOf(bodyId);
      let spent = { ...ZERO_COST };
      let before = have ? missing(spent, have) : null;
      items.forEach((item, index) => {
        spent = addCost(spent, item.cost);
        const after = have ? missing(spent, have) : null;
        const short = after && before ? { metal: after.metal - before.metal, crystal: after.crystal - before.crystal, deuterium: after.deuterium - before.deuterium, energy: 0 } : null;
        before = after;
        let g = groups.get(item.id);
        if (!g) groups.set(item.id, g = { id: item.id, name: item.name, cost: { ...ZERO_COST }, rows: [], added: item.added });
        g.cost = addCost(g.cost, item.cost);
        g.added = Math.min(g.added, item.added);
        const last2 = g.rows[g.rows.length - 1];
        if (last2 && last2.bodyId === bodyId && item.level !== void 0 && last2.to !== void 0 && item.level === last2.to + 1) {
          last2.to = item.level;
          last2.cost = addCost(last2.cost, item.cost);
          last2.indexes.push(index);
          last2.short = last2.short && short ? addCost(last2.short, short) : null;
        } else g.rows.push({ bodyId, from: item.level, to: item.level, amount: item.amount, cost: { ...item.cost }, indexes: [index], short });
      });
    }
    return [...groups.values()].sort((a, b) => a.added - b.added || a.id - b.id);
  }
  function accountGap(plan, account) {
    const total = Object.values(plan).reduce((sum, items) => addCost(sum, planTotal(items)), { ...ZERO_COST });
    return { total, missing: account ? missing(total, account) : null };
  }

  // src/engines/fleet.ts
  var EMPTY_RESERVE = { ships: {}, resources: { metal: 0, crystal: 0, deuterium: 0 } };
  var PROFILES_KEY = "fleet.profiles";
  function profileFor(profiles, bodyId) {
    return profiles[String(bodyId)] ?? { reserve: structuredClone(EMPTY_RESERVE), save: null };
  }
  function shipsAfterReserve(available, reserve) {
    const out = {};
    for (const [id, count2] of Object.entries(available)) {
      const n = Math.max(0, count2 - (reserve.ships[id] ?? 0));
      if (n > 0) out[id] = n;
    }
    return out;
  }
  function resourcesAfterReserve(available, reserve, fuel) {
    return {
      metal: Math.max(0, Math.floor(available.metal - reserve.resources.metal)),
      crystal: Math.max(0, Math.floor(available.crystal - reserve.resources.crystal)),
      deuterium: Math.max(0, Math.floor(available.deuterium - fuel - reserve.resources.deuterium))
    };
  }
  function resolveTarget(save, origin) {
    return {
      galaxy: save.galaxy ?? origin.galaxy,
      system: save.system ?? origin.system,
      position: save.position,
      type: save.type
    };
  }
  function parseAmount(text) {
    const raw = text.trim().toLowerCase().replace(/\s/g, "");
    const m = raw.match(/^([\d.,]+)([kmg])?$/);
    if (!m) return 0;
    const unit = m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : m[2] === "g" ? 1e9 : 1;
    let num4 = m[1];
    num4 = unit === 1 ? num4.replace(/[.,]/g, "") : num4.replace(",", ".");
    const value = Number(num4) * unit;
    return Number.isFinite(value) ? Math.floor(value) : 0;
  }
  function copyProfileToAll(profiles, fromId, ids) {
    const src = profileFor(profiles, fromId);
    const out = { ...profiles };
    for (const id of ids) out[String(id)] = structuredClone(src);
    return out;
  }
  var SETTINGS_KEY = "fleet.settings";
  var DEFAULT_SETTINGS = {
    mainShip: 203,
    secondShip: 202,
    transportSpeed: 100,
    favTransport: null,
    favDeploy: null,
    expeditionShip: 0,
    expeditionValue: "",
    expeditionExtras: true,
    repeat: false,
    reserveOn: true,
    ignoreFood: false
  };
  var DELIVERY_KEY = "plan.delivery";
  function deliveryLoad(onPlanet2, reserve, fuel, capacity, need) {
    const free = resourcesAfterReserve(onPlanet2, reserve, fuel);
    let room = Math.max(0, Math.floor(capacity));
    const take = (a, b) => Math.max(0, Math.floor(Math.min(a, b, room)));
    const deuterium = take(free.deuterium, Math.ceil(need.deuterium));
    room -= deuterium;
    const crystal = take(free.crystal, Math.ceil(need.crystal));
    room -= crystal;
    const metal = take(free.metal, Math.ceil(need.metal));
    return { metal, crystal, deuterium };
  }
  var CARGO_SHIPS = [203, 202, 219, 209, 210];
  function cargoShipsFor(amount, stock2, main2, second) {
    const out = {};
    let left = Math.max(0, amount);
    for (const id of [main2, second]) {
      if (!id || left <= 0) continue;
      const s = stock2.find((x) => x.id === id);
      if (!s || s.available <= 0 || s.capacity <= 0) continue;
      const n = Math.min(s.available, Math.ceil(left / s.capacity));
      if (n > 0) {
        out[id] = (out[id] ?? 0) + n;
        left -= n * s.capacity;
      }
    }
    return out;
  }
  function cargoLoad(onPlanet2, reserve, fuel, capacity) {
    const free = resourcesAfterReserve(onPlanet2, reserve, fuel);
    let room = Math.max(0, Math.floor(capacity));
    const deuterium = Math.max(0, Math.floor(Math.min(free.deuterium, room)));
    room -= deuterium;
    const crystal = Math.max(0, Math.floor(Math.min(free.crystal, room)));
    room -= crystal;
    const metal = Math.max(0, Math.floor(Math.min(free.metal, room)));
    return { metal, crystal, deuterium };
  }
  var EXPEDITION_TABLE = [
    { topScore: 1e4, base: 10, max: 4e4 },
    { topScore: 1e5, base: 125, max: 5e5 },
    { topScore: 1e6, base: 300, max: 12e5 },
    { topScore: 5e6, base: 450, max: 18e5 },
    { topScore: 25e6, base: 600, max: 24e5 },
    { topScore: 5e7, base: 750, max: 3e6 },
    { topScore: 75e6, base: 900, max: 36e5 },
    { topScore: 1e8, base: 1050, max: 42e5 },
    { topScore: Infinity, base: 1250, max: 5e6 }
  ];
  function expeditionMax(o) {
    const row = EXPEDITION_TABLE.find((r) => r.topScore >= (o.topScore ?? Infinity));
    const factor = o.characterClass === 3 ? 3 * o.economySpeed : 2;
    const bonus = (1 + o.classBooster) * (1 + (o.lfBooster ?? 0)) * (1 + (o.itemBoost ?? 0));
    return { base: row.base, max: Math.round(row.max * factor * bonus) };
  }
  function expeditionTarget(calculated, value) {
    const v = value.trim();
    if (!v) return calculated;
    if (v.endsWith("%")) return Math.round(calculated * (parseAmount(v.slice(0, -1)) || 0) / 100);
    return parseAmount(v) || calculated;
  }
  var EXPEDITION_FACTOR = { 202: 1, 203: 3, 219: 5.75 };
  var EXPEDITION_FILLERS = [218, 213, 211, 215, 207, 206, 205, 204];
  function expeditionFleet(stock2, o) {
    const has = (id) => (stock2.find((s) => s.id === id)?.available ?? 0) > 0;
    const need = (id) => {
      const s = stock2.find((x) => x.id === id);
      if (!s || s.capacity <= 0) return Infinity;
      return Math.max(Math.ceil(o.base / (EXPEDITION_FACTOR[id] ?? 1)), Math.ceil(o.target / s.capacity));
    };
    let ship = o.ship;
    if (!ship) {
      const options = [219, 203, 202].filter(has);
      ship = options.find((id) => (stock2.find((s) => s.id === id)?.available ?? 0) >= need(id)) ?? options.sort((a, b) => {
        const cap = (id) => {
          const s = stock2.find((x) => x.id === id);
          return s.available * s.capacity;
        };
        return cap(b) - cap(a);
      })[0] ?? 0;
    }
    const out = {};
    if (ship && has(ship)) out[ship] = Math.min(stock2.find((s) => s.id === ship).available, need(ship));
    if (o.extras) {
      const filler = EXPEDITION_FILLERS.find((id) => id !== ship && has(id));
      if (filler) out[filler] = 1;
      if (ship !== 210 && has(210)) out[210] = 1;
      if (ship !== 219 && has(219)) out[219] = 1;
    }
    return out;
  }
  function nextBody(list, current2, opts = {}) {
    const isMoon2 = list.some((b) => b.moonId === current2);
    const ids = list.filter((b) => isMoon2 || opts.onlyWithMoon ? b.moonId !== null : b.planetId !== null).map((b) => isMoon2 ? b.moonId : b.planetId);
    const i = ids.indexOf(current2);
    if (i < 0) return null;
    for (let k = 1; k < ids.length; k++) {
      const step = opts.backwards ? -k : k;
      const id = ids[((i + step) % ids.length + ids.length) % ids.length];
      if (id !== opts.skip) return id;
    }
    return null;
  }
  var LAST_FLEET_KEY = "fleet.last";

  // src/modules/fleet/actions.ts
  var TRANSPORT = 3;
  var DEPLOY = 4;
  var EXPEDITION = 15;
  function stock(fd, profile) {
    const left = shipsAfterReserve(shipsOnPlanet(fd), profile.reserve);
    return fd.shipsOnPlanet.map((s) => ({ id: s.id, available: left[String(s.id)] ?? 0, capacity: shipCapacity(fd, s.id) }));
  }
  function onPlanet(fd) {
    return { metal: fd.metalOnPlanet, crystal: fd.crystalOnPlanet, deuterium: fd.deuteriumOnPlanet };
  }
  function setSpeedBar(fd, percent) {
    const step = Math.max(1, Math.min(10, Math.round(percent / 10)));
    fd.speedPercent = step;
    const $ = pageWindow().jQuery;
    try {
      $?.("#speedPercentage").data("percentageBarInstance")?.setValue?.(step);
    } catch {
    }
    fd.speedPercent = step;
  }
  function setTarget(fd, doc, target) {
    fd.targetPlanet.galaxy = target.galaxy;
    fd.targetPlanet.system = target.system;
    fd.targetPlanet.position = target.position;
    fd.targetPlanet.type = target.type;
    if (target.name) fd.targetPlanet.name = target.name;
    const set = (id, v) => {
      const input = doc.querySelector(`#fleet2 #${id}`);
      if (input) input.value = String(v);
    };
    set("galaxy", target.galaxy);
    set("system", target.system);
    set("position", target.position);
  }
  function selectShips(fd, ships) {
    fd.resetShips();
    fd.resetCargo();
    let total = 0;
    for (const [id, n] of Object.entries(ships)) {
      if (n > 0) {
        fd.selectShip(Number(id), n);
        total += n;
      }
    }
    return total;
  }
  function loadCargo(fd, profile) {
    const load = cargoLoad(onPlanet(fd), profile.reserve, Math.ceil(Number(fd.getConsumption()) || 0), fd.getCargoCapacity());
    fd.cargoMetal = load.metal;
    fd.cargoCrystal = load.crystal;
    fd.cargoDeuterium = load.deuterium;
    return load.metal + load.crystal + load.deuterium;
  }
  function finish(fd, mission, ships, cargo) {
    fd.mission = mission;
    fd.refresh();
    fd.focusSubmitFleet1();
    return { ok: ships > 0, reason: ships > 0 ? void 0 : "fleet.err.noShips", ships, cargo };
  }
  function toMove(fd, profile) {
    const r = profile.reserve.resources;
    return Math.max(0, fd.metalOnPlanet - r.metal) + Math.max(0, fd.crystalOnPlanet - r.crystal) + Math.max(0, fd.deuteriumOnPlanet - r.deuterium);
  }
  function prepareTransport(fd, doc, profile, settings, target) {
    const amount = toMove(fd, profile);
    if (amount <= 0) return { ok: false, reason: "fleet.err.noResources", ships: 0, cargo: 0 };
    const ships = cargoShipsFor(amount, stock(fd, profile), settings.mainShip, settings.secondShip);
    const count2 = selectShips(fd, ships);
    setTarget(fd, doc, target);
    setSpeedBar(fd, settings.transportSpeed);
    fd.mission = TRANSPORT;
    const cargo = count2 > 0 ? loadCargo(fd, profile) : 0;
    return finish(fd, TRANSPORT, count2, cargo);
  }
  function prepareDeploy(fd, doc, profile, settings, target) {
    const ships = Object.fromEntries(stock(fd, profile).map((s) => [s.id, s.available]));
    const count2 = selectShips(fd, ships);
    setTarget(fd, doc, target);
    setSpeedBar(fd, settings.transportSpeed);
    fd.mission = DEPLOY;
    const cargo = count2 > 0 ? loadCargo(fd, profile) : 0;
    return finish(fd, DEPLOY, count2, cargo);
  }
  function prepareAllShips(fd, profile) {
    const ships = Object.fromEntries(stock(fd, profile).map((s) => [s.id, s.available]));
    const count2 = selectShips(fd, ships);
    fd.refresh();
    fd.focusSubmitFleet1();
    return { ok: count2 > 0, reason: count2 > 0 ? void 0 : "fleet.err.noShips", ships: count2, cargo: 0 };
  }
  function prepareFleetsave(fd, doc, base, save) {
    const profile = { ...base, reserve: base.saveReserve ?? EMPTY_RESERVE };
    const ships = Object.fromEntries(stock(fd, profile).map((s) => [s.id, s.available]));
    const count2 = selectShips(fd, ships);
    setTarget(fd, doc, resolveTarget(save, fd.currentPlanet));
    setSpeedBar(fd, save.speed);
    fd.mission = save.mission;
    const cargo = count2 > 0 ? loadCargo(fd, profile) : 0;
    return finish(fd, save.mission, count2, cargo);
  }
  function prepareDelivery(fd, doc, profile, settings, target, need) {
    const free = deliveryLoad(onPlanet(fd), profile.reserve, 0, Number.MAX_SAFE_INTEGER, need);
    const amount = free.metal + free.crystal + free.deuterium;
    if (amount <= 0) return { ok: false, reason: "fleet.err.noResources", ships: 0, cargo: 0 };
    const count2 = selectShips(fd, cargoShipsFor(amount, stock(fd, profile), settings.mainShip, settings.secondShip));
    setTarget(fd, doc, target);
    setSpeedBar(fd, settings.transportSpeed);
    fd.mission = TRANSPORT;
    let cargo = 0;
    if (count2 > 0) {
      const load = deliveryLoad(onPlanet(fd), profile.reserve, Math.ceil(Number(fd.getConsumption()) || 0), fd.getCargoCapacity(), need);
      fd.cargoMetal = load.metal;
      fd.cargoCrystal = load.crystal;
      fd.cargoDeuterium = load.deuterium;
      cargo = load.metal + load.crystal + load.deuterium;
    }
    return finish(fd, TRANSPORT, count2, cargo);
  }
  function prepareExpedition(fd, doc, profile, settings, universe) {
    profile = { ...profile, reserve: EMPTY_RESERVE };
    const cls = fd.apiDataJson?.characterClassId ?? 0;
    const booster = fd.apiDataJson?.bonuses?.characterClassBooster?.[String(cls)] ?? 0;
    const limits = expeditionMax({
      topScore: universe.topScore,
      characterClass: cls,
      economySpeed: universe.economySpeed,
      classBooster: booster,
      lfBooster: universe.lfBooster,
      itemBoost: universe.itemBoost
    });
    const target = expeditionTarget(limits.max, settings.expeditionValue);
    const base = settings.expeditionValue.trim() ? 0 : limits.base;
    const ships = expeditionFleet(stock(fd, profile), { ship: settings.expeditionShip, target, base, extras: settings.expeditionExtras });
    const count2 = selectShips(fd, ships);
    const here = fd.currentPlanet;
    setTarget(fd, doc, { galaxy: here.galaxy, system: here.system, position: 16, type: 1 });
    setSpeedBar(fd, 100);
    fd.expeditionTime = 1;
    const $ = pageWindow().jQuery;
    try {
      $?.("#expeditiontime").val("1");
    } catch {
    }
    return { ...finish(fd, EXPEDITION, count2, 0), target };
  }
  function prepareLast(fd, doc, profile, last2) {
    const left = Object.fromEntries(stock(fd, profile).map((s) => [s.id, s.available]));
    const ships = {};
    for (const [id, n] of Object.entries(last2.ships)) ships[Number(id)] = Math.min(n, left[Number(id)] ?? 0);
    const count2 = selectShips(fd, ships);
    setTarget(fd, doc, last2.target);
    setSpeedBar(fd, last2.speed);
    return finish(fd, last2.mission, count2, 0);
  }
  function snapshotFleet(fd) {
    return {
      ships: Object.fromEntries(fd.shipsToSend.map((s) => [String(s.id), s.number])),
      target: { galaxy: fd.targetPlanet.galaxy, system: fd.targetPlanet.system, position: fd.targetPlanet.position, type: fd.targetPlanet.type },
      mission: fd.mission,
      speed: Math.round(fd.speedPercent * 10)
    };
  }

  // src/modules/fleet/repeat.ts
  function readRepeatParams(url) {
    const p = new URL(url).searchParams;
    const mode = p.get("futmode");
    const first = Number(p.get("futfirst"));
    if (!mode || !Number.isFinite(first) || first <= 0) return null;
    const dest = Number(p.get("futdest"));
    return { mode, first, dest: Number.isFinite(dest) && dest > 0 ? dest : null };
  }
  function repeatUrl(base, cp, state) {
    const u = new URL(base);
    u.search = "";
    u.searchParams.set("page", "ingame");
    u.searchParams.set("component", "fleetdispatch");
    u.searchParams.set("cp", String(cp));
    u.searchParams.set("futmode", state.mode);
    u.searchParams.set("futfirst", String(state.first));
    if (state.dest) u.searchParams.set("futdest", String(state.dest));
    return u.toString();
  }
  function nextInRound(state, bodyId, list) {
    const next = nextBody(list, bodyId, {
      skip: state.mode === "transport" || state.mode === "deploy" || state.mode === "plan" ? state.dest : null,
      onlyWithMoon: state.mode === "moon"
    });
    return next === null || next === state.first ? null : next;
  }
  function hookSend(fd, onSent) {
    const original = fd.submitFleet2;
    if (!original || original.futHooked) return;
    const win = pageWindow();
    const wrapped = function(force) {
      const $ = win.$;
      if (!$) return original.call(fd, force);
      const post = $.post;
      $.post = function(url, params, cb) {
        if (url !== fd.sendFleetUrl || typeof cb !== "function") return post.call(this, url, params, cb);
        return post.call(this, url, params, function(response) {
          let ok = false;
          try {
            ok = JSON.parse(response).success === true;
          } catch {
            ok = false;
          }
          if (ok && onSent()) return void 0;
          return cb.call(this, response);
        });
      };
      try {
        return original.call(fd, force);
      } finally {
        $.post = post;
      }
    };
    wrapped.futHooked = true;
    fd.submitFleet2 = wrapped;
  }

  // src/modules/fleet/style.ts
  var FLEET_CSS = `
.fut-fmenu .fut-moon-ico { margin-right: 4px; vertical-align: -1px; color: #8A9BB0; }
.fut-fbar {
  display: flex; flex-direction: column; gap: 6px; margin: 6px 10px; padding: 8px;
  border: 1px solid #1F2C40; border-radius: 10px; background: #0D1522;
  font: 12px Arial, sans-serif; color: #C9D4E2;
}
.fut-frow { display: flex; align-items: flex-start; gap: 8px; }
.fut-ftiles { display: flex; flex-wrap: wrap; gap: 4px; flex: 1; }
.fut-ftilewrap { position: relative; display: inline-flex; }
.fut-ftile {
  position: relative; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
  min-width: 56px; height: 58px; padding: 6px 4px; border-radius: 8px; border: 1px solid #24344B; background: #0A111C;
  color: #4FD1E8; font: 11px Arial, sans-serif; cursor: pointer;
}
.fut-ftile:hover { border-color: #4FD1E8; background: #0F1C2C; }
.fut-ftile.dim { color: #5B6B80; }
.fut-ftile.dim .fut-flabel { color: #8A9BB0; }
.fut-fkey {
  position: absolute; left: 4px; top: 3px; padding: 0 3px; border-radius: 3px; background: #16243A;
  color: #8A9BB0; font: 10px/13px Consolas, monospace;
}
.fut-flabel { color: #E6EDF5; font-weight: 700; white-space: nowrap; }
.fut-fcaption { color: #8A9BB0; font-size: 10px; max-width: 76px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fut-ftilewrap .fut-ftile { padding-right: 16px; }
.fut-fcaret {
  position: absolute; right: 2px; top: 2px; width: 16px; height: 20px; padding: 0; border: 0; background: none;
  color: #8A9BB0; cursor: pointer;
}
.fut-fcaret:hover { color: #E6EDF5; }
.fut-fcaret svg { width: 14px; height: 14px; }
.fut-fside { display: grid; grid-template-columns: repeat(2, auto); gap: 4px; align-content: start; }
.fut-ficon {
  width: 30px; height: 26px; display: inline-flex; align-items: center; justify-content: center; padding: 0;
  border-radius: 7px; border: 1px solid #24344B; background: #0A111C; color: #8A9BB0; cursor: pointer;
}
.fut-ficon:hover { border-color: #4FD1E8; color: #E6EDF5; }
.fut-ficon.on { border-color: #38C56E; color: #38C56E; }
.fut-finfo { color: #8A9BB0; font-size: 11px; min-height: 14px; }
.fut-finfo.err { color: #FF7A7A; }
.fut-fmenu {
  position: fixed; z-index: 1000002; min-width: 220px; max-height: 320px; overflow-y: auto;
  display: flex; flex-direction: column; padding: 4px; border: 1px solid #2C3E57; border-radius: 8px; background: #0A111C;
  box-shadow: 0 10px 30px rgba(0,0,0,0.6);
}
.fut-fmenu .fut-fbtn {
  height: 24px; padding: 0 8px; border: 0; border-radius: 5px; background: none; text-align: left;
  color: #C9D4E2; font: 12px Arial, sans-serif; cursor: pointer; white-space: nowrap;
}
.fut-fmenu .fut-fbtn:hover { background: #12283A; }
.fut-fmenu .fut-fbtn.on { color: #FFC94D; }
`;
  var MODAL_CSS = `
:host { --panel-w: 720px; }
.fut-moon-ico { margin-right: 4px; vertical-align: -1px; color: var(--muted); }
.status { color: var(--ok); min-height: 17px; }
.body { padding-top: 2px; color: var(--text-2); font-size: 12px; }
.fut-fbtn {
  height: 28px; padding: 0 12px; border-radius: 7px; border: 1px solid #2C3E57; background: var(--surface);
  color: var(--text); font: 12px Arial, sans-serif; cursor: pointer;
}
.fut-fbtn:hover { border-color: var(--accent); }
.fut-fbtn.primary { border-color: var(--accent); background: var(--accent-soft); font-weight: 700; }
.fut-feditor h4 { margin: 0 0 4px; font-size: 14px; color: #E6EDF5; }
.fut-feditor h5 { margin: 16px 0 6px; font-size: 12px; font-weight: 700; color: #C9D4E2; }
.fut-feditor > h5:first-child { margin-top: 0; }
.fut-fgrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px 12px; }
.fut-ffield { display: flex; flex-direction: column; gap: 3px; color: #8A9BB0; font-size: 11px; }
.fut-ffield input, .fut-ffield select {
  height: 26px; padding: 0 6px; border-radius: 6px; border: 1px solid #2C3E57; background: #0D1522; color: #E6EDF5; font: 12px Arial, sans-serif;
}
.fut-ffield input:focus, .fut-ffield select:focus { outline: none; border-color: #4FD1E8; }
.fut-fcheck { display: flex; align-items: center; gap: 6px; color: #C9D4E2; font-size: 12px; align-self: end; min-height: 26px; }
.fut-freserve { margin-top: 12px; padding: 10px; border: 1px solid #1F2C40; border-radius: 8px; background: #0D1522; }
.fut-freserve h5 { margin-top: 0; }
.fut-feditor h6 { margin: 10px 0 4px; font-size: 11px; font-weight: 400; color: #8A9BB0; }
.fut-fkeys { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 6px 12px; }
.fut-fkeyrow { display: flex; align-items: center; gap: 8px; color: #C9D4E2; }
.fut-fkeyrow kbd { min-width: 20px; padding: 1px 5px; border: 1px solid #2C3E57; border-radius: 4px; background: #0D1522; color: #4FD1E8; font: 11px Consolas, monospace; text-align: center; }
.fut-fnote { margin: 6px 0 0; color: #8A9BB0; font-size: 11px; }
.fut-factions { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
`;

  // src/modules/shortcuts/index.ts
  var registry = /* @__PURE__ */ new Map();
  var installed = null;
  function typing(doc) {
    const a = doc.activeElement;
    if (!a) return false;
    const tag = a.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || a.isContentEditable;
  }
  function registerShortcuts(doc, list) {
    for (const s of list) registry.set(s.key.toLowerCase(), s);
    if (installed === doc) return;
    installed = doc;
    doc.addEventListener(
      "keydown",
      (e) => {
        if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) return;
        if (typing(doc) || doc.getElementById("fut-fleet-modal") || doc.getElementById("fut-dashboard") || doc.getElementById("fut-planner") || doc.getElementById("fut-journal")) return;
        const s = registry.get(e.key.toLowerCase());
        if (!s) return;
        e.preventDefault();
        e.stopPropagation();
        s.run();
      },
      true
    );
  }
  function listShortcuts() {
    return [...registry.values()];
  }
  function switchBodyUrl(href, cp) {
    const u = new URL(href);
    for (const k of [...u.searchParams.keys()]) if (k.startsWith("fut")) u.searchParams.delete(k);
    u.searchParams.set("cp", String(cp));
    return u.toString();
  }

  // src/modules/fleet/icons.ts
  var ICONS2 = {
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    transport: '<path d="M2 7h12v9H2z"/><path d="M14 10h4l4 4v2h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    deploy: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
    expedition: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    fleetsave: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    all: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    cargo: '<path d="M12 3v11"/><path d="M8 10l4 4 4-4"/><path d="M4 15v5h16v-5"/>',
    repeat: '<path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>',
    last: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>',
    caret: '<path d="M7 10l5 5 5-5"/>',
    reserve: '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8 12h8"/>',
    food: '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10"/><path d="M16 3c-1.7 1-2.5 3-2.5 6s1 4 2.5 4v8"/><path d="M4 20L20 4" stroke-width="1.4"/>'
  };
  function iconSvg(name, size = 20) {
    return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS2[name]}</svg>`;
  }

  // src/modules/fleet/index.ts
  var STYLE_ID2 = "fut-fleet-style";
  var MODAL_ID = "fut-fleet-modal";
  var FLEETSAVE_MISSIONS = [3, 4, 6, 8, 15, 5, 1];
  var pageState = /* @__PURE__ */ new WeakMap();
  var REPEATABLE = ["moon", "transport", "deploy", "expedition", "fleetsave", "plan"];
  function el3(doc, tag, className = "", text) {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== void 0) node.textContent = text;
    return node;
  }
  function enableOriginAutofill(doc) {
    const p = doc.querySelector("#fleet2 #position");
    if (!p || p.dataset.futAutofill) return;
    p.dataset.futAutofill = "1";
    p.addEventListener("keyup", () => {
      if (!p.value.trim()) return;
      const origin = originCoords(doc);
      const g = doc.querySelector("#fleet2 #galaxy");
      const s = doc.querySelector("#fleet2 #system");
      if (!origin || !g || !s) return;
      if (!g.value.trim()) g.value = String(origin.galaxy);
      if (!s.value.trim()) s.value = String(origin.system);
    });
  }
  function loadProfiles(store) {
    return store.get(PROFILES_KEY, {});
  }
  function loadSettings(store) {
    return { ...DEFAULT_SETTINGS, ...store.get(SETTINGS_KEY, {}) };
  }
  function button(doc, text, onClick, cls = "", title = "") {
    const b = el3(doc, "button", `fut-fbtn ${cls}`.trim(), text);
    b.type = "button";
    if (title) b.title = title;
    b.addEventListener("click", (e) => {
      e.preventDefault();
      onClick();
    });
    return b;
  }
  function isolate(input) {
    input.setAttribute("autocomplete", "off");
    input.addEventListener("keydown", (e) => e.stopPropagation());
    input.addEventListener("keyup", (e) => e.stopPropagation());
    input.addEventListener("keypress", (e) => e.stopPropagation());
  }
  function numberField(doc, label, value, placeholder = "") {
    const wrap = el3(doc, "label", "fut-ffield");
    wrap.append(el3(doc, "span", "", label));
    const input = el3(doc, "input");
    input.type = "text";
    input.inputMode = "numeric";
    input.placeholder = placeholder;
    input.value = value ? String(value) : "";
    isolate(input);
    wrap.append(input);
    return [wrap, input];
  }
  function selectField(doc, label, options, value) {
    const wrap = el3(doc, "label", "fut-ffield");
    wrap.append(el3(doc, "span", "", label));
    const sel = el3(doc, "select");
    for (const [v, text] of options) {
      const opt = el3(doc, "option", "", text);
      opt.value = v;
      opt.selected = v === value;
      sel.append(opt);
    }
    isolate(sel);
    wrap.append(sel);
    return [wrap, sel];
  }
  function checkField(doc, label, checked) {
    const wrap = el3(doc, "label", "fut-fcheck");
    const input = el3(doc, "input");
    input.type = "checkbox";
    input.checked = checked;
    wrap.append(input, el3(doc, "span", "", label));
    return [wrap, input];
  }
  function parseCoords(coords) {
    const parts = coords.replace(/[^\d:]/g, "").split(":").map(Number);
    return parts.length === 3 && parts.every((n) => n > 0) ? parts : null;
  }
  function bodyTarget(bodies, id) {
    for (const b of bodies) {
      const c = parseCoords(b.coords);
      if (!c) continue;
      if (b.planetId === id) return { galaxy: c[0], system: c[1], position: c[2], type: 1, name: b.name };
      if (b.moonId === id) return { galaxy: c[0], system: c[1], position: c[2], type: 3, name: b.name };
    }
    return null;
  }
  function isMoon(bodies, id) {
    return bodies.some((b) => b.moonId === id);
  }
  function sameTypeIds(bodies, id) {
    const moon = isMoon(bodies, id);
    return bodies.map((b) => moon ? b.moonId : b.planetId).filter((x) => x !== null);
  }
  function bodyLabel(o, id) {
    const b = o.bodies.find((x) => x.planetId === id || x.moonId === id);
    if (!b) return String(id);
    return `${b.name} [${b.coords}]${b.moonId === id ? ` \xB7 ${o.t("fleet.typeMoon")}` : ""}`;
  }
  function reserveFields(o, reserve, title, hint) {
    const { doc, t } = o;
    const box = el3(doc, "div", "fut-freserve");
    box.append(el3(doc, "h5", "", title), el3(doc, "p", "fut-fnote", hint));
    const shipGrid = el3(doc, "div", "fut-fgrid");
    const shipInputs = [];
    for (const slot of readShipSlots(doc)) {
      const [wrap, input] = numberField(doc, slot.name, reserve.ships[slot.id] ?? null, "0");
      shipGrid.append(wrap);
      shipInputs.push([slot.id, input]);
    }
    if (!shipInputs.length) shipGrid.append(el3(doc, "span", "fut-fnote", t("fleet.noShips")));
    const resGrid = el3(doc, "div", "fut-fgrid");
    const resInputs = ["metal", "crystal", "deuterium"].map((k) => {
      const [wrap, input] = numberField(doc, t(`res.${k}`), reserve.resources[k] || null, "0");
      resGrid.append(wrap);
      return [k, input];
    });
    box.append(el3(doc, "h6", "", t("fleet.reserveShips")), shipGrid, el3(doc, "h6", "", t("fleet.reserveRes")), resGrid);
    return {
      el: box,
      read: () => {
        const ships = {};
        for (const [id, input] of shipInputs) {
          const n = parseAmount(input.value);
          if (n > 0) ships[id] = n;
        }
        const resources = { metal: 0, crystal: 0, deuterium: 0 };
        for (const [k, input] of resInputs) resources[k] = parseAmount(input.value);
        return { ships, resources };
      }
    };
  }
  function reserveEditor(o, onSaved) {
    const { doc, t } = o;
    const profile = profileFor(loadProfiles(o.store), o.bodyId);
    const moon = isMoon(o.bodies, o.bodyId);
    const panel = el3(doc, "div", "fut-feditor");
    panel.append(el3(doc, "h4", "", t(moon ? "fleet.editTitleMoon" : "fleet.editTitlePlanet", { body: bodyLabel(o, o.bodyId) })));
    const r1 = reserveFields(o, profile.reserve, t("fleet.reserve1Title"), t("fleet.reserve1Hint"));
    panel.append(r1.el);
    panel.append(el3(doc, "h5", "", t("fleet.fleetsave")));
    const saveGrid = el3(doc, "div", "fut-fgrid");
    const origin = originCoords(doc);
    const [gWrap, gIn] = numberField(doc, t("fleet.galaxy"), profile.save?.galaxy ?? null, origin ? String(origin.galaxy) : "");
    const [sWrap, sIn] = numberField(doc, t("fleet.system"), profile.save?.system ?? null, origin ? String(origin.system) : "");
    const [pWrap, pIn] = numberField(doc, t("fleet.position"), profile.save?.position ?? null, "16");
    const [typeWrap, typeSel] = selectField(
      doc,
      t("fleet.type"),
      [["1", t("fleet.typePlanet")], ["3", t("fleet.typeMoon")], ["2", t("fleet.typeDebris")]],
      String(profile.save?.type ?? 1)
    );
    const [misWrap, misSel] = selectField(doc, t("fleet.mission"), FLEETSAVE_MISSIONS.map((m) => [String(m), t(`mission.${m}`)]), String(profile.save?.mission ?? 6));
    const [spdWrap, spdSel] = selectField(
      doc,
      t("fleet.speed"),
      Array.from({ length: 10 }, (_, i) => [String((i + 1) * 10), `${(i + 1) * 10}%`]),
      String(profile.save?.speed ?? 10)
    );
    saveGrid.append(gWrap, sWrap, pWrap, typeWrap, misWrap, spdWrap);
    panel.append(saveGrid);
    panel.append(el3(doc, "p", "fut-fnote", t("fleet.fleetsaveHint")));
    const r2 = reserveFields(o, profile.saveReserve ?? EMPTY_RESERVE, t("fleet.reserve2Title"), t("fleet.reserve2Hint"));
    panel.append(r2.el);
    const read = () => {
      const position = parseAmount(pIn.value);
      const save = position >= 1 && position <= 17 ? {
        galaxy: parseAmount(gIn.value) || null,
        system: parseAmount(sIn.value) || null,
        position,
        type: Number(typeSel.value),
        mission: Number(misSel.value),
        speed: Number(spdSel.value)
      } : null;
      return { reserve: r1.read(), saveReserve: r2.read(), save };
    };
    const same = sameTypeIds(o.bodies, o.bodyId);
    const actions = el3(doc, "div", "fut-factions");
    actions.append(
      button(doc, t("fleet.save"), () => {
        const all2 = loadProfiles(o.store);
        all2[String(o.bodyId)] = read();
        o.store.set(PROFILES_KEY, all2);
        onSaved(t("fleet.saved"));
      }, "primary"),
      button(doc, t(moon ? "fleet.copyMoons" : "fleet.copyPlanets", { count: same.length }), () => {
        const all2 = loadProfiles(o.store);
        all2[String(o.bodyId)] = read();
        o.store.set(PROFILES_KEY, copyProfileToAll(all2, o.bodyId, same));
        onSaved(t("fleet.copied", { count: same.length }));
      })
    );
    panel.append(actions);
    return panel;
  }
  function settingsEditor(o, onSaved) {
    const { doc, t } = o;
    const s = loadSettings(o.store);
    const names = new Map(readShipSlots(doc).map((x) => [Number(x.id), x.name || `#${x.id}`]));
    const shipName2 = (id) => names.get(id) ?? `#${id}`;
    const panel = el3(doc, "div", "fut-feditor");
    panel.append(el3(doc, "h5", "", t("fleet.transportTitle")));
    const g1 = el3(doc, "div", "fut-fgrid");
    const cargoOptions = CARGO_SHIPS.map((id) => [String(id), shipName2(id)]);
    const [mainW, mainSel] = selectField(doc, t("fleet.mainShip"), cargoOptions, String(s.mainShip));
    const [secW, secSel] = selectField(doc, t("fleet.secondShip"), [["0", t("fleet.none")], ...cargoOptions], String(s.secondShip));
    const [spdW, spdSel] = selectField(
      doc,
      t("fleet.speed"),
      Array.from({ length: 10 }, (_, i) => [String((i + 1) * 10), `${(i + 1) * 10}%`]),
      String(s.transportSpeed)
    );
    g1.append(mainW, secW, spdW);
    panel.append(g1);
    panel.append(el3(doc, "h5", "", t("fleet.favTitle")));
    const gf = el3(doc, "div", "fut-fgrid");
    const destOptions = [
      ["0", t("fleet.none")],
      ...o.bodies.flatMap((b) => [b.planetId, b.moonId]).filter((x) => x !== null).map((id) => [String(id), bodyLabel(o, id)])
    ];
    const [favTW, favTSel] = selectField(doc, t("fleet.favTransport"), destOptions, String(s.favTransport ?? 0));
    const [favDW, favDSel] = selectField(doc, t("fleet.favDeploy"), destOptions, String(s.favDeploy ?? 0));
    gf.append(favTW, favDW);
    panel.append(gf);
    panel.append(el3(doc, "h5", "", t("fleet.expeditionTitle")));
    const g2 = el3(doc, "div", "fut-fgrid");
    const [expW, expSel] = selectField(
      doc,
      t("fleet.expeditionShip"),
      [["0", t("fleet.bestShip")], ...[219, 203, 202].map((id) => [String(id), shipName2(id)])],
      String(s.expeditionShip)
    );
    const [valW, valIn] = numberField(doc, t("fleet.expeditionValue"), s.expeditionValue, t("fleet.auto"));
    valIn.inputMode = "text";
    const [extW, extIn] = checkField(doc, t("fleet.expeditionExtras"), s.expeditionExtras);
    g2.append(expW, valW, extW);
    panel.append(g2);
    panel.append(el3(doc, "p", "fut-fnote", t("fleet.expeditionHint")));
    panel.append(el3(doc, "h5", "", t("fleet.shortcutsTitle")));
    const keys = el3(doc, "div", "fut-fkeys");
    for (const sc of listShortcuts()) {
      const row = el3(doc, "span", "fut-fkeyrow");
      row.append(el3(doc, "kbd", "", sc.key.toUpperCase()), el3(doc, "span", "", t(sc.label)));
      keys.append(row);
    }
    panel.append(keys);
    panel.append(el3(doc, "h5", "", t("fleet.repeatTitle")));
    const [repW, repIn] = checkField(doc, t("fleet.repeat"), s.repeat);
    panel.append(repW, el3(doc, "p", "fut-fnote", t("fleet.repeatHint")));
    const actions = el3(doc, "div", "fut-factions");
    actions.append(
      button(doc, t("fleet.save"), () => {
        const next = {
          ...loadSettings(o.store),
          mainShip: Number(mainSel.value),
          secondShip: Number(secSel.value),
          transportSpeed: Number(spdSel.value),
          favTransport: Number(favTSel.value) || null,
          favDeploy: Number(favDSel.value) || null,
          expeditionShip: Number(expSel.value),
          expeditionValue: valIn.value.trim(),
          expeditionExtras: extIn.checked,
          repeat: repIn.checked
        };
        o.store.set(SETTINGS_KEY, next);
        onSaved(t("fleet.saved"));
      }, "primary")
    );
    panel.append(actions);
    return panel;
  }
  function summary(o, profile) {
    const ships = Object.values(profile.reserve.ships).reduce((a, b) => a + b, 0);
    const r = profile.reserve.resources;
    const fmt = (n) => n.toLocaleString(o.locale);
    const parts = [];
    if (ships) parts.push(o.t("fleet.summaryShips", { count: fmt(ships) }));
    if (r.metal || r.crystal || r.deuterium) parts.push(`${fmt(r.metal)} / ${fmt(r.crystal)} / ${fmt(r.deuterium)}`);
    return parts.length ? `${o.t("fleet.reserve")}: ${parts.join(" \xB7 ")}` : o.t("fleet.noReserve");
  }
  function universeSpeed(doc) {
    const n = Number(doc.querySelector('meta[name="ogame-universe-speed"]')?.getAttribute("content"));
    return Number.isFinite(n) && n > 0 ? n : 1;
  }
  var modalKeyHandler = null;
  function closeModal(doc) {
    doc.getElementById(MODAL_ID)?.remove();
    if (modalKeyHandler) doc.removeEventListener("keydown", modalKeyHandler, true);
    modalKeyHandler = null;
  }
  function openSettings(o, tab2, onChange) {
    const { doc, t } = o;
    closeModal(doc);
    const host = el3(doc, "div");
    host.id = MODAL_ID;
    const root = host.attachShadow({ mode: "open" });
    const style = el3(doc, "style");
    style.textContent = WINDOW_SHEET + MODAL_CSS;
    const backdrop = el3(doc, "div", "backdrop");
    const panel = el3(doc, "div", "panel");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", t("fleet.settingsTitle"));
    const head = el3(doc, "div", "head");
    const tabs = el3(doc, "div", "tabs");
    const moon = isMoon(o.bodies, o.bodyId);
    const status = el3(doc, "span", "sub status");
    const body = el3(doc, "div", "body");
    const show2 = (which) => {
      tabs.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tab === which)));
      const saved = (msg) => {
        status.textContent = msg;
        onChange();
      };
      body.replaceChildren(which === "body" ? reserveEditor(o, saved) : settingsEditor(o, saved));
    };
    for (const [id, label] of [
      ["body", t(moon ? "fleet.tabMoon" : "fleet.tabPlanet")],
      ["general", t("fleet.tabGeneral")]
    ]) {
      const b = el3(doc, "button", "tab", label);
      b.type = "button";
      b.dataset.tab = id;
      b.addEventListener("click", () => show2(id));
      tabs.append(b);
    }
    const close = el3(doc, "button", "close");
    close.type = "button";
    close.setAttribute("aria-label", t("fleet.close"));
    close.addEventListener("click", () => closeModal(doc));
    close.append(icon(doc, "close", 16));
    const titles = el3(doc, "div", "titles");
    titles.append(el3(doc, "h2", "", t("fleet.settingsTitle")), status);
    head.append(titles, close);
    panel.append(head, tabs, body);
    backdrop.append(panel);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal(doc);
    });
    root.append(style, backdrop);
    doc.body.append(host);
    modalKeyHandler = (e) => {
      if (e.key === "Escape") closeModal(doc);
    };
    doc.addEventListener("keydown", modalKeyHandler, true);
    show2(tab2);
  }
  function shortLabel(o, id) {
    if (!id) return o.t("fleet.pickDest");
    const b = o.bodies.find((x) => x.planetId === id || x.moonId === id);
    if (!b) return o.t("fleet.pickDest");
    return `${b.name}${b.moonId === id ? " \u263E" : ""}`;
  }
  var FLEET_KEYS = { moon: "l", transport: "t", deploy: "d", expedition: "x", fleetsave: "e", all: "a", last: "p" };
  function tile(doc, icon2, label, caption, title, onClick, cls = "", key2 = "") {
    const b = el3(doc, "button", `fut-ftile ${cls}`.trim());
    b.type = "button";
    b.title = key2 ? `${title} [${key2.toUpperCase()}]` : title;
    b.innerHTML = iconSvg(icon2);
    if (key2) b.append(el3(doc, "kbd", "fut-fkey", key2.toUpperCase()));
    b.append(el3(doc, "span", "fut-flabel", label));
    if (caption) b.append(el3(doc, "span", "fut-fcaption", caption));
    b.addEventListener("click", (e) => {
      e.preventDefault();
      onClick();
    });
    return b;
  }
  function iconToggle(doc, icon2, title, onClick, cls = "") {
    const b = el3(doc, "button", `fut-ficon ${cls}`.trim());
    b.type = "button";
    b.title = title;
    b.innerHTML = iconSvg(icon2, 18);
    b.addEventListener("click", (e) => {
      e.preventDefault();
      onClick();
    });
    return b;
  }
  function destinationMenu(o, anchor, current2, onPick) {
    const { doc } = o;
    doc.querySelectorAll(".fut-fmenu").forEach((n) => n.remove());
    const menu = el3(doc, "div", "fut-fmenu");
    for (const b of o.bodies) {
      for (const id of [b.planetId, b.moonId]) {
        if (id === null || id === o.bodyId) continue;
        const item = button(doc, `${b.name}  [${b.coords}]`, () => {
          menu.remove();
          onPick(id);
        }, id === current2 ? "on" : "");
        if (id === b.moonId) item.prepend(icon(doc, "moon", 11, "fut-moon-ico"));
        menu.append(item);
      }
    }
    const r = anchor.getBoundingClientRect();
    menu.style.top = `${Math.round(r.bottom + 4)}px`;
    menu.style.left = `${Math.round(r.left)}px`;
    doc.body.append(menu);
    const away = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        doc.removeEventListener("mousedown", away, true);
      }
    };
    doc.addEventListener("mousedown", away, true);
    doc.defaultView?.addEventListener("scroll", () => menu.remove(), { once: true, capture: true });
  }
  function renderFleetTools(o) {
    const { doc, t } = o;
    if (!doc.getElementById(STYLE_ID2)) {
      const style = el3(doc, "style");
      style.id = STYLE_ID2;
      style.textContent = FLEET_CSS;
      doc.head.append(style);
    }
    doc.querySelectorAll(".fut-fbar").forEach((n) => n.remove());
    const href = o.href ?? doc.location?.href ?? "";
    const navigate = o.navigate ?? ((url) => doc.location.assign(url));
    const settings = loadSettings(o.store);
    const stored = profileFor(loadProfiles(o.store), o.bodyId);
    const profile = settings.reserveOn ? stored : { ...stored, reserve: EMPTY_RESERVE, saveReserve: EMPTY_RESERVE };
    const redraw = () => renderFleetTools(o);
    const fleet1 = doc.getElementById("fleet1");
    const anchor1 = fleet1?.querySelector("#technologies") ?? null;
    const fleet2 = doc.getElementById("fleet2");
    const anchor2 = fleet2?.querySelector("#buttonz") ?? null;
    if (fleet2) enableOriginAutofill(doc);
    const incoming = readRepeatParams(href);
    const state = pageState.get(doc) ?? { active: incoming, o };
    state.o = o;
    pageState.set(doc, state);
    const info = el3(doc, "span", "fut-finfo", settings.reserveOn ? summary(o, profile) : t("fleet.reserveOff"));
    const say = (text, err = false) => {
      info.textContent = text;
      info.classList.toggle("err", err);
    };
    const report = (r, okKey, vars = {}) => r.ok ? say(t(okKey, { ships: r.ships.toLocaleString(o.locale), cargo: r.cargo.toLocaleString(o.locale), ...vars })) : say(t(r.reason ?? "fleet.err.noShips"), true);
    const withDispatcher = (fn) => {
      const fd = getDispatcher();
      if (!fd) return say(t("fleet.err.notReady"), true);
      if (fd.currentPage !== "fleet1") return say(t("fleet.err.page1"), true);
      void whenTargetIdle(fd).then(() => fn(fd));
    };
    const begin = (mode, dest = null) => {
      const prev = state.active;
      state.active = REPEATABLE.includes(mode) ? { mode, first: prev && prev.mode === mode ? prev.first : o.bodyId, dest } : null;
    };
    const run = {
      moon: () => withDispatcher((fd) => {
        const here = o.bodies.find((b) => b.planetId === o.bodyId);
        const target = here?.moonId ? bodyTarget(o.bodies, here.moonId) : null;
        if (!target) return say(t("fleet.err.noMoon"), true);
        begin("moon");
        report(prepareTransport(fd, doc, profile, settings, target), "fleet.ok.cargo");
      }),
      transport: (dest) => withDispatcher((fd) => {
        const target = dest ? bodyTarget(o.bodies, dest) : null;
        if (!dest || !target) return say(t("fleet.err.noDest"), true);
        begin("transport", dest);
        report(prepareTransport(fd, doc, profile, settings, target), "fleet.ok.cargo");
      }),
      deploy: (dest) => withDispatcher((fd) => {
        const target = dest ? bodyTarget(o.bodies, dest) : null;
        if (!dest || !target) return say(t("fleet.err.noDest"), true);
        begin("deploy", dest);
        report(prepareDeploy(fd, doc, profile, settings, target), "fleet.ok.cargo");
      }),
      expedition: () => withDispatcher((fd) => {
        begin("expedition");
        const r = prepareExpedition(fd, doc, profile, settings, {
          economySpeed: universeSpeed(doc),
          lfBooster: o.store.get(LF_BONUS_KEY, null)?.expedition ?? 0,
          itemBoost: expeditionItemBoost(o.store.get(ITEMS_KEY, null))
        });
        report(r, "fleet.ok.expedition", { target: r.target.toLocaleString(o.locale) });
      }),
      fleetsave: () => withDispatcher((fd) => {
        if (!profile.save) return say(t("fleet.err.noFleetsave"), true);
        begin("fleetsave");
        report(prepareFleetsave(fd, doc, profile, profile.save), "fleet.ok.cargo");
      }),
      all: () => withDispatcher((fd) => {
        begin("all");
        report(prepareAllShips(fd, profile), "fleet.ok.ships");
      }),
      plan: (dest) => withDispatcher((fd) => {
        const delivery = o.store.get(DELIVERY_KEY, null);
        const target = dest ? bodyTarget(o.bodies, dest) : null;
        if (!delivery || !dest || delivery.target !== dest || !target) return say(t("fleet.err.noDelivery"), true);
        begin("plan", dest);
        const r = prepareDelivery(fd, doc, profile, settings, target, delivery.need);
        const left = delivery.need.metal + delivery.need.crystal + delivery.need.deuterium;
        report(r, "fleet.ok.delivery", { left: left.toLocaleString(o.locale) });
      }),
      last: () => withDispatcher((fd) => {
        const last2 = o.store.get(LAST_FLEET_KEY, null);
        if (!last2) return say(t("fleet.err.noLast"), true);
        begin("last");
        report(prepareLast(fd, doc, profile, last2), "fleet.ok.ships");
      })
    };
    const favRun = {
      transport: () => settings.favTransport ? run.transport(settings.favTransport) : say(t("fleet.err.noDest"), true),
      deploy: () => settings.favDeploy ? run.deploy(settings.favDeploy) : say(t("fleet.err.noDest"), true)
    };
    const setFav = (key2, id) => {
      o.store.set(SETTINGS_KEY, { ...loadSettings(o.store), [key2]: id });
      redraw();
    };
    const withCaret = (tileEl, key2) => {
      const wrap = el3(doc, "span", "fut-ftilewrap");
      const caret = iconToggle(doc, "caret", t("fleet.pickDest"), () => destinationMenu(o, wrap, settings[key2], (id) => setFav(key2, id)), "fut-fcaret");
      wrap.append(tileEl, caret);
      return wrap;
    };
    if (fleet1 && anchor1) {
      const bar = el3(doc, "div", "fut-fbar");
      const tiles = el3(doc, "div", "fut-ftiles");
      const here = o.bodies.find((b) => b.planetId === o.bodyId);
      if (here?.moonId) tiles.append(tile(doc, "moon", t("fleet.btn.moon"), "", t("fleet.tip.moon"), () => run.moon(), "", FLEET_KEYS.moon));
      tiles.append(
        withCaret(
          tile(doc, "transport", t("fleet.btn.transport"), `\u2192 ${shortLabel(o, settings.favTransport)}`, t("fleet.tip.transport"), favRun.transport, "", FLEET_KEYS.transport),
          "favTransport"
        ),
        withCaret(
          tile(doc, "deploy", t("fleet.btn.deploy"), `\u2192 ${shortLabel(o, settings.favDeploy)}`, t("fleet.tip.deploy"), favRun.deploy, "", FLEET_KEYS.deploy),
          "favDeploy"
        ),
        tile(doc, "expedition", t("fleet.btn.expedition"), "", t("fleet.tip.expedition"), () => run.expedition(), "", FLEET_KEYS.expedition),
        tile(
          doc,
          "fleetsave",
          t("fleet.btn.fleetsave"),
          profile.save ? `\u2192 ${profile.save.position}` : "",
          profile.save ? t("fleet.tip.fleetsave") : t("fleet.err.noFleetsave"),
          () => profile.save ? run.fleetsave() : openSettings(o, "body", redraw),
          profile.save ? "" : "dim",
          FLEET_KEYS.fleetsave
        ),
        tile(doc, "all", t("fleet.btn.all"), "", t("fleet.tip.all"), () => run.all(), "", FLEET_KEYS.all),
        tile(doc, "last", t("fleet.btn.last"), "", t("fleet.tip.last"), () => run.last(), o.store.get(LAST_FLEET_KEY, null) ? "" : "dim", FLEET_KEYS.last)
      );
      registerShortcuts(doc, [
        ...here?.moonId ? [{ key: FLEET_KEYS.moon, label: "fleet.btn.moon", run: () => run.moon() }] : [],
        { key: FLEET_KEYS.transport, label: "fleet.btn.transport", run: favRun.transport },
        { key: FLEET_KEYS.deploy, label: "fleet.btn.deploy", run: favRun.deploy },
        { key: FLEET_KEYS.expedition, label: "fleet.btn.expedition", run: () => run.expedition() },
        { key: FLEET_KEYS.fleetsave, label: "fleet.btn.fleetsave", run: () => run.fleetsave() },
        { key: FLEET_KEYS.all, label: "fleet.btn.all", run: () => run.all() },
        { key: FLEET_KEYS.last, label: "fleet.btn.last", run: () => run.last() }
      ]);
      const side = el3(doc, "div", "fut-fside");
      side.append(
        iconToggle(doc, "reserve", `${t("fleet.reserveShort")}: ${settings.reserveOn ? t("fleet.on") : t("fleet.off")}. ${t("fleet.reserveToggleHint")}`, () => {
          o.store.set(SETTINGS_KEY, { ...loadSettings(o.store), reserveOn: !loadSettings(o.store).reserveOn });
          redraw();
        }, settings.reserveOn ? "on" : ""),
        iconToggle(doc, "food", `${t("fleet.foodShort")}: ${settings.ignoreFood ? t("fleet.on") : t("fleet.off")}. ${t("fleet.foodHint")}`, () => {
          o.store.set(SETTINGS_KEY, { ...loadSettings(o.store), ignoreFood: !loadSettings(o.store).ignoreFood });
          applyFood(o.store);
          redraw();
        }, settings.ignoreFood ? "on" : ""),
        iconToggle(doc, "repeat", `${t("fleet.repeatShort")}: ${settings.repeat ? t("fleet.on") : t("fleet.off")}. ${t("fleet.repeatHint")}`, () => {
          o.store.set(SETTINGS_KEY, { ...loadSettings(o.store), repeat: !loadSettings(o.store).repeat });
          redraw();
        }, settings.repeat ? "on" : ""),
        iconToggle(doc, "settings", t("fleet.settingsTitle"), () => openSettings(o, "body", redraw))
      );
      const top = el3(doc, "div", "fut-frow");
      top.append(tiles, side);
      bar.append(top, info);
      anchor1.before(bar);
    }
    if (fleet2 && anchor2) {
      const bar = el3(doc, "div", "fut-fbar");
      const row = el3(doc, "div", "fut-frow");
      const info2 = el3(doc, "span", "fut-finfo", settings.reserveOn ? summary(o, profile) : t("fleet.reserveOff"));
      const tiles = el3(doc, "div", "fut-ftiles");
      tiles.append(
        tile(doc, "cargo", t("fleet.resMinusReserve"), "", t("fleet.tip.cargo"), () => {
          const fd = getDispatcher();
          if (!fd) return;
          const load = loadCargoNow(fd, profile);
          info2.textContent = t("fleet.resLoaded", { cargo: load.toLocaleString(o.locale) });
        })
      );
      row.append(tiles);
      bar.append(row, info2);
      anchor2.before(bar);
    }
    void whenDispatcherReady().then((fd) => {
      if (!fd) return;
      applyFood(o.store, fd);
      const ships = readShipsInfo(fd);
      if (ships) o.store.set(SHIPS_INFO_KEY, ships);
      hookSend(fd, () => {
        try {
          o.store.set(LAST_FLEET_KEY, snapshotFleet(fd));
          recordShipment(o, fd);
        } catch {
        }
        const current2 = pageState.get(doc);
        if (current2?.active?.mode === "plan") {
          const d = current2.o.store.get(DELIVERY_KEY, null);
          if (!d) return false;
          const need = {
            metal: Math.max(0, d.need.metal - fd.cargoMetal),
            crystal: Math.max(0, d.need.crystal - fd.cargoCrystal),
            deuterium: Math.max(0, d.need.deuterium - fd.cargoDeuterium)
          };
          const done = need.metal + need.crystal + need.deuterium <= 0;
          current2.o.store.set(DELIVERY_KEY, done ? null : { ...d, need });
          if (done) return false;
          const nextBody2 = nextInRound(current2.active, current2.o.bodyId, current2.o.bodies);
          if (nextBody2 === null) return false;
          navigate(repeatUrl(href, nextBody2, current2.active));
          return true;
        }
        if (!current2?.active || !loadSettings(current2.o.store).repeat) return false;
        const next = nextInRound(current2.active, current2.o.bodyId, current2.o.bodies);
        if (next === null) return false;
        navigate(repeatUrl(href, next, current2.active));
        return true;
      });
      if (incoming && fd.currentPage === "fleet1" && !doc.documentElement.dataset.futAutoRun) {
        doc.documentElement.dataset.futAutoRun = "1";
        const go = () => {
          if (incoming.mode === "transport" || incoming.mode === "deploy" || incoming.mode === "plan") run[incoming.mode](incoming.dest);
          else run[incoming.mode]();
        };
        if (doc.readyState === "complete") setTimeout(go, 0);
        else doc.defaultView?.addEventListener("load", () => setTimeout(go, 0), { once: true });
      }
    });
  }
  function recordShipment(o, fd) {
    if (fd.mission !== 3 && fd.mission !== 4) return;
    const cargo = { metal: Math.floor(fd.cargoMetal || 0), crystal: Math.floor(fd.cargoCrystal || 0), deuterium: Math.floor(fd.cargoDeuterium || 0) };
    if (cargo.metal + cargo.crystal + cargo.deuterium <= 0) return;
    const tp = fd.targetPlanet;
    const coords = `${tp.galaxy}:${tp.system}:${tp.position}`;
    const body = o.bodies.find((b) => b.coords === coords);
    const target = body ? tp.type === 3 ? body.moonId : body.planetId : null;
    if (!target) return;
    const plan = o.store.get(PLAN_KEY, {});
    if (!plan[String(target)]?.length) return;
    const seconds = Number(fd.getDuration?.()) || 0;
    const now = Date.now();
    const list = o.store.get(SENT_KEY, []);
    o.store.set(SENT_KEY, [...list, { target, cargo, sentAt: now, arriveAt: now + Math.max(0, seconds) * 1e3 }]);
  }
  var initialFood = /* @__PURE__ */ new WeakMap();
  function applyFood(store, fd = getDispatcher()) {
    if (!fd) return;
    const f = fd;
    if (f.foodOnPlanet === void 0) return;
    if (!initialFood.has(fd)) initialFood.set(fd, f.foodOnPlanet);
    const ignore = loadSettings(store).ignoreFood;
    f.foodOnPlanet = ignore ? 0 : initialFood.get(fd) ?? f.foodOnPlanet;
    if (ignore) f.cargoFood = 0;
    try {
      fd.refresh();
    } catch {
    }
  }
  function whenTargetIdle(fd, timeoutMs = 5e3) {
    const busy = () => Boolean(fd.fetchTargetPlayerDataTimeout);
    if (!busy()) return Promise.resolve();
    const started = Date.now();
    return new Promise((resolve) => {
      const check = () => !busy() || Date.now() - started > timeoutMs ? resolve() : setTimeout(check, 50);
      check();
    });
  }
  function loadCargoNow(fd, profile) {
    const onPlanet2 = { metal: fd.metalOnPlanet, crystal: fd.crystalOnPlanet, deuterium: fd.deuteriumOnPlanet };
    const load = cargoLoad(onPlanet2, profile.reserve, Math.ceil(Number(fd.getConsumption()) || 0), fd.getCargoCapacity());
    fd.cargoMetal = load.metal;
    fd.cargoCrystal = load.crystal;
    fd.cargoDeuterium = load.deuterium;
    fd.refresh();
    return load.metal + load.crystal + load.deuterium;
  }

  // src/modules/fleet/jumpgate.ts
  function applyJumpgateReserve(doc, store, bodyId, t) {
    const gate = doc.getElementById("jumpgate");
    if (!gate || doc.getElementById("jumpgateNotReady")) return 0;
    if (!doc.getElementById("fut-jg-style")) {
      const style = doc.createElement("style");
      style.id = "fut-jg-style";
      style.textContent = ".fut-jgkeep { color: #FF9A6B; font: 11px Arial, sans-serif; text-align: right; }";
      doc.head.append(style);
    }
    const reserve = profileFor(loadProfiles(store), bodyId).reserve;
    const all2 = {};
    let kept = 0;
    gate.querySelectorAll(".ship_input_row").forEach((row) => {
      const head = row.previousElementSibling;
      if (head?.classList.contains("tdInactive")) return;
      const input = row.querySelector('input[id^="ship_"]');
      if (!input) return;
      const id = input.id.replace("ship_", "");
      if (!input.dataset.futMax) input.dataset.futMax = input.getAttribute("rel") ?? "0";
      const max = Number(input.dataset.futMax) || 0;
      const keep = Math.min(max, reserve.ships[id] ?? 0);
      const amount = max - keep;
      kept += keep;
      input.setAttribute("rel", String(amount));
      if (Number(input.value) > amount) input.value = String(amount);
      head?.querySelector(".quantity")?.setAttribute("onclick", `toggleMaxShips('#jumpgateForm', ${id}, ${amount})`);
      head?.querySelector("a")?.setAttribute("onclick", `toggleMaxShips('#jumpgateForm', ${id}, ${amount})`);
      let note = row.querySelector(".fut-jgkeep");
      if (!note) {
        note = doc.createElement("div");
        note.className = "fut-jgkeep";
        row.append(note);
      }
      note.textContent = keep ? `\u2212${keep.toLocaleString()}` : "";
      note.title = t("fleet.jumpgateKeep");
      all2[id] = amount;
    });
    gate.querySelector("#sendall")?.setAttribute("onclick", `setMaxIntInput("#jumpgateForm", ${JSON.stringify(all2)})`);
    return kept;
  }
  function watchJumpgate(doc, store, bodyId, t) {
    const win = pageWindow();
    const original = win.initJumpgate;
    if (typeof original !== "function" || original.futHooked) return;
    const wrapped = function(...args) {
      const result = original.apply(this, args);
      try {
        applyJumpgateReserve(doc, store, bodyId, t);
      } catch {
      }
      return result;
    };
    wrapped.futHooked = true;
    win.initJumpgate = wrapped;
  }

  // src/data/tech-icons.ts
  var TECH_ICONS_KEY = "tech.icons";
  function readTechIcons(doc) {
    const view = doc.defaultView;
    const out = {};
    if (!view) return out;
    for (const tech of doc.querySelectorAll("#technologies .technology[data-technology]")) {
      const tile2 = tech.querySelector(".icon");
      if (!tile2) continue;
      const cs = view.getComputedStyle(tile2);
      const url = /url\("?([^")]+)"?\)/.exec(cs.backgroundImage)?.[1];
      const w = parseFloat(cs.width);
      if (url && w > 0) out[tech.dataset.technology] = { url, pos: cs.backgroundPosition, size: cs.backgroundSize, w };
    }
    return out;
  }
  function rememberTechIcons(doc, store) {
    const seen = readTechIcons(doc);
    if (!Object.keys(seen).length) return;
    const known = store.get(TECH_ICONS_KEY, {});
    if (Object.entries(seen).every(([id, i]) => JSON.stringify(known[id]) === JSON.stringify(i))) return;
    store.set(TECH_ICONS_KEY, { ...known, ...seen });
  }
  function techIconEl(doc, icon2, px, cls = "tico") {
    const box = doc.createElement("span");
    box.className = cls;
    box.style.cssText = `display:inline-block;flex:none;width:${px}px;height:${px}px;overflow:hidden;border-radius:4px;background:#16243A;vertical-align:middle;`;
    if (!icon2) return box;
    const tile2 = doc.createElement("span");
    tile2.style.cssText = `display:block;width:${icon2.w}px;height:${icon2.w}px;background-image:url("${icon2.url}");background-position:${icon2.pos};background-size:${icon2.size};background-repeat:no-repeat;transform:scale(${px / icon2.w});transform-origin:0 0;`;
    box.append(tile2);
    return box;
  }

  // src/modules/tech/style.ts
  var TECH_CSS = `
/* The game's own cost list and detail lines give way to the panel (their data is in it). */
#technologydetails.fut-tp-on .content .costs,
#technologydetails.fut-tp-on .content .information > ul { display: none !important; }
/* The game's dark matter button ("Inizia con MO") is much bigger than the normal one. */
#technologydetails.fut-tp-on .build-it_wrap .build-it_premium { transform: scale(0.72); transform-origin: right bottom; }
#technologydetails.fut-tp-on .content .information .level { color: #4FD1E8; font-weight: 700; }
/* Units: shipyard choice on one line under the title, amount field over the build button. */
#technologydetails.fut-tp-unit .content .shipyardSelection { position: absolute; top: 28px; left: 6px; right: 158px; height: 16px;
  display: flex; align-items: center; gap: 4px; margin: 0; padding: 0; font-size: 10px; line-height: 16px; white-space: nowrap; overflow: hidden; }
#technologydetails.fut-tp-unit .content .shipyardSelection input { margin: 0 2px 0 6px; width: 11px; height: 11px; }
#technologydetails.fut-tp-unit .content .shipyardSelection label { float: none; margin: 0; padding: 0; width: auto; }
#technologydetails.fut-tp-unit .content .build_amount { position: absolute; top: 104px; right: 6px; width: 146px; height: 28px; margin: 0; padding: 0;
  display: flex; align-items: center; gap: 4px; }
#technologydetails.fut-tp-unit .content .build_amount label { display: none; }
#technologydetails.fut-tp-unit .content .build_amount input, #technologydetails.fut-tp-unit #build_amount { position: static; float: none; flex: 1; min-width: 0; width: auto; height: 26px; margin: 0; padding: 0 4px; box-sizing: border-box; font-size: 13px; }
#technologydetails.fut-tp-unit .content .build_amount .maximum { position: static; float: none; flex: none; width: auto; height: 26px; margin: 0; padding: 0 6px;
  background: #16202E none !important; border: 1px solid #2A3B55; border-radius: 5px; color: #C9D4E2; font-size: 11px; cursor: pointer; }
#technologydetails.fut-tp-unit .content .build_amount .maximum::before, #technologydetails.fut-tp-unit .content .build_amount .maximum::after { display: none !important; }
#technologydetails.fut-tp-unit .content .build_amount .maximum:hover { border-color: #4FD1E8; color: #fff; }
#technologydetails.fut-tp-unit .fut-tp { right: 158px; }
#technologydetails.fut-tp-unit:has(.shipyardSelection) .fut-tp { top: 48px; }
.fut-tp { position: absolute; top: 24px; left: 6px; right: 138px; bottom: 6px; display: flex; flex-direction: column; gap: 5px;
  font: 11px/14px Arial, Helvetica, sans-serif; color: #E6EDF5; text-align: left; }
.fut-tp-grid { display: grid; gap: 2px; align-content: start; }
.fut-tp-h:first-child { background: none; }
.fut-tp-h { padding: 2px 6px; border-radius: 4px; background: #16202E; color: #8A9BB0; font-size: 10px; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fut-tp-k { padding: 2px 6px 2px 0; color: #8A9BB0; white-space: nowrap; }
.fut-tp-k.fut-m { color: #B8C2CC; } .fut-tp-k.fut-c { color: #7FB8FF; } .fut-tp-k.fut-d { color: #4FE0B0; } .fut-tp-k.fut-e { color: #F5D547; }
.fut-tp-v { padding: 2px 6px; border-radius: 4px; background: rgba(17,27,42,0.85); text-align: right;
  font-family: "JetBrains Mono", Consolas, monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fut-tp-sum { color: #4FD1E8; }
.fut-tp-short { color: #FF7A7A; }
.fut-tp-ok { color: #4FE0B0; text-align: center; display: flex; align-items: center; justify-content: center; }
.fut-tp-msu { color: #C9D4E2; font-size: 10px; }
.fut-tp-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: auto; }
.fut-tp-chip { display: inline-flex; align-items: center; gap: 4px; padding: 2px 7px; border: 1px solid #1F2C40; border-radius: 10px;
  background: #0E1724; color: #C9D4E2; white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.fut-tp-chip svg { flex: none; color: #8A9BB0; }
.fut-tp-energy svg { color: #F5D547; } .fut-tp-start svg { color: #4FD1E8; }
.fut-tp-disc { color: #8A9BB0; }
/* Tools over the picture, like OGLight. */
.fut-tp-tools { position: absolute; top: 4px; left: 4px; right: 4px; display: flex; gap: 4px; z-index: 2; }
#technologydetails .fut-tp-btn { flex: 1; height: 24px; display: flex; align-items: center; justify-content: center; padding: 0;
  border: 1px solid #2A3B55; border-radius: 5px; background: rgba(10,17,28,0.88); color: #C9D4E2; cursor: pointer; }
#technologydetails .fut-tp-btn:hover:not(:disabled) { border-color: #4FD1E8; color: #fff; }
#technologydetails .fut-tp-btn:disabled { opacity: 0.4; cursor: default; }
#technologydetails .fut-tp-plan.on { border-color: #2E7D5B; background: rgba(16,41,31,0.92); color: #4FE0B0; }
.fut-tp-amount { flex: 3; min-width: 0; height: 24px; box-sizing: border-box; padding: 0 6px; border: 1px solid #2A3B55; border-radius: 5px;
  background: rgba(10,17,28,0.92); color: #E6EDF5; font: 12px "JetBrains Mono", Consolas, monospace; text-align: right; }
.fut-tp-amount:focus { outline: none; border-color: #4FD1E8; }
`;
  var PLANNER_CSS = `
:host { --panel-w: 820px; }
.head .act { flex: none; }
.kpis { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.kpi-line { display: flex; gap: 12px; font: 700 14px/18px var(--mono); }
.kpi.warn .label { color: var(--warn); }
.kpi.ok .label { color: var(--ok); }
.okv { color: var(--ok); }
.groups { display: flex; flex-direction: column; gap: 3px; }
/* One tile per technology, the planet menu's rows. */
.group { border: 1px solid var(--line); border-radius: 7px; background: var(--raised); overflow: hidden; }
.ghead, .grow { display: grid; grid-template-columns: 28px minmax(0, 1fr) 70px 70px 70px 68px; gap: 8px; align-items: center; padding: 4px 6px; }
.grow { grid-template-columns: minmax(0, 1fr) 70px 70px 70px 68px; min-height: 26px; padding: 2px 6px 2px 42px; border-top: 1px solid var(--line-soft); background: var(--surface); }
.ghead.clickable .gname { cursor: pointer; }
.ghead.clickable .gname:hover .gtitle { color: var(--accent); }
.gname { display: flex; flex-direction: column; min-width: 0; }
.gtitle { font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gmeta { color: var(--muted); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.gbody { display: flex; gap: 8px; align-items: baseline; min-width: 0; color: var(--text-2); }
.gbody > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lv { color: var(--accent); font-size: 11px; white-space: nowrap; }
.num { text-align: right; font-family: var(--mono); white-space: nowrap; }
.num.short { color: var(--bad) !important; }
.acts { display: flex; justify-content: flex-end; align-items: center; gap: 2px; }
.ib, .x { width: 22px; height: 22px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 5px; background: none; color: var(--muted); cursor: pointer; font: 11px Arial, sans-serif; }
.ib:hover { border-color: var(--accent); color: var(--text); }
.ib.bring { color: var(--warn); }
.x:hover { border-color: var(--bad); color: var(--bad); }
.sent { display: inline-flex; color: var(--accent); }
.okmark { display: inline-flex; width: 22px; justify-content: center; color: var(--ok); }
@media (max-width: 640px) { .kpis { grid-template-columns: 1fr; } }
`;

  // src/modules/tech/index.ts
  var RES = [
    ["metal", "m"],
    ["crystal", "c"],
    ["deuterium", "d"],
    ["energy", "e"]
  ];
  function el4(doc, tag, cls = "", text) {
    const node = doc.createElement(tag);
    if (cls) node.className = cls;
    if (text !== void 0) node.textContent = text;
    return node;
  }
  function okCell(doc, have, cls) {
    const c = el4(doc, "span", cls, have ? "" : "\u2014");
    if (have) c.append(icon(doc, "check", 12));
    return c;
  }
  function formatDuration(ms) {
    let s = Math.max(1, Math.round(ms / 1e3));
    const parts = [];
    for (const [size, unit] of [
      [604800, "w"],
      [86400, "d"],
      [3600, "h"],
      [60, "m"],
      [1, "s"]
    ]) {
      if (s >= size || unit === "s" && !parts.length) {
        parts.push(`${Math.floor(s / size)}${unit}`);
        s %= size;
      }
      if (parts.length === 3) break;
    }
    return parts.join(" ");
  }
  var loadPlan = (store) => store.get(PLAN_KEY, {});
  function startLevel(details, listLevel, built) {
    const candidates = [details.panelLevel ?? 0, (details.panelLevel ?? 0) + 1, (listLevel ?? 0) + 1, (built ?? 0) + 1];
    const match = matchShownLevel(details.id, candidates, details.shown);
    if (match) return match;
    return { level: (listLevel ?? details.panelLevel ?? 0) + 1, discount: 0 };
  }
  var msu3 = (c) => c.metal + c.crystal * 1.5 + c.deuterium * 3;
  function button2(doc, cls, html, title, onClick) {
    const b = el4(doc, "button", cls);
    b.type = "button";
    b.innerHTML = html;
    b.title = title;
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return b;
  }
  var ICON = {
    prev: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    reset: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    plan: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h1M4 12h1M4 18h1"/></svg>',
    time: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    energy: '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
    start: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 12a8 8 0 1 0 2.3-5.7"/><path d="M4 4v5h5"/></svg>'
  };
  function grid(o, view, have) {
    const { doc, t, locale } = o;
    const g = el4(doc, "div", "fut-tp-grid");
    g.style.gridTemplateColumns = `auto repeat(${view.cols.length}, minmax(0, 1fr))`;
    g.append(el4(doc, "span", "fut-tp-h"));
    for (const h6 of view.heads) g.append(el4(doc, "span", "fut-tp-h", h6));
    const rows = RES.filter(([key2]) => view.cols.some((c) => !c.short && c.cost[key2] > 0));
    const cell = (value, cls) => {
      const c = el4(doc, "span", `fut-tp-v ${cls}`, value ? formatUnits(value, locale) : "\u2014");
      c.title = Math.round(value).toLocaleString(locale);
      return c;
    };
    for (const [key2, cls] of rows) {
      g.append(el4(doc, "span", `fut-tp-k fut-${cls}`, t(`tech.res.${key2}`)));
      for (const col of view.cols) {
        if (!col.short) g.append(cell(col.cost[key2], col.cls ?? ""));
        else if (key2 === "energy") g.append(el4(doc, "span", "fut-tp-v"));
        else if (col.cost[key2] > 0) g.append(cell(-col.cost[key2], "fut-tp-short"));
        else g.append(okCell(doc, have, "fut-tp-v fut-tp-ok"));
      }
    }
    g.append(el4(doc, "span", "fut-tp-k fut-tp-msu", "MSU"));
    for (const col of view.cols) {
      const v = msu3(col.cost);
      if (col.short) g.append(v > 0 ? cell(-v, "fut-tp-short fut-tp-msu") : okCell(doc, have, "fut-tp-v fut-tp-ok fut-tp-msu"));
      else g.append(cell(v, `${col.cls ?? ""} fut-tp-msu`));
    }
    return g;
  }
  function chip(doc, icon2, text, title, cls = "") {
    const c = el4(doc, "span", `fut-tp-chip ${cls}`.trim());
    c.innerHTML = icon2;
    c.append(el4(doc, "span", "", text));
    c.title = title;
    return c;
  }
  function gameChips(doc, details) {
    const out = [];
    const icons = {
      additional_energy_consumption: ICON.energy,
      energy_consumption: ICON.energy,
      possible_build_start: ICON.start
    };
    for (const li of Array.from(details.root.querySelectorAll(".content .information > ul > li"))) {
      if (li.classList.contains("build_duration")) continue;
      const value = li.querySelector(".value");
      const text = (value?.textContent ?? li.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!text) continue;
      const label = li.querySelector("strong")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      const why = value?.getAttribute("data-tooltip-title") ?? value?.getAttribute("title") ?? "";
      const cls = Array.from(li.classList).find((c) => icons[c]) ?? "";
      const shown = cls.includes("energy") ? `-${text}` : value ? text : text.replace(label, "").trim();
      out.push(chip(doc, icons[cls] ?? "", shown, [label, why].filter(Boolean).join(" "), cls.includes("energy") ? "fut-tp-energy" : cls ? "fut-tp-start" : ""));
    }
    return out;
  }
  function renderTechPanel(o, details) {
    const { doc, t, locale } = o;
    const kind = techKind(details.id);
    if (!kind) return null;
    details.root.querySelectorAll(".fut-tp, .fut-tp-tools").forEach((n) => n.remove());
    const list = readTechList(doc);
    const entry = list.find((e) => e.id === details.id);
    const box = el4(doc, "div", "fut-tp");
    const tools = el4(doc, "div", "fut-tp-tools");
    const levelLabel = details.root.querySelector(".information .level");
    const levelText = levelLabel?.textContent ?? "";
    const chips = gameChips(doc, details);
    if (isLevelled(details.id)) {
      const start = startLevel(details, entry?.level, entry?.built);
      let to = start.level;
      const draw = () => {
        const one = levelCost(details.id, to, start.discount);
        const total = rangeCost(details.id, start.level, to, start.discount);
        const have = o.have();
        const gap = missing(total, have ?? { metal: 0, crystal: 0, deuterium: 0 });
        const plan = loadPlan(o.store);
        let planned = true;
        for (let l = start.level; l <= to; l++) planned && (planned = inPlan(plan, o.bodyId, details.id, l));
        const ms = (l) => details.durationMs ? scaleDuration(details.id, start.level, details.durationMs, l) : 0;
        let sumMs = 0;
        for (let l = start.level; l <= to; l++) sumMs += ms(l);
        const prev = button2(doc, "fut-tp-btn", ICON.prev, t("tech.prev"), () => {
          to = Math.max(start.level, to - 1);
          draw();
        });
        prev.disabled = to <= start.level;
        const reset = button2(doc, "fut-tp-btn", ICON.reset, t("tech.reset"), () => {
          to = start.level;
          draw();
        });
        reset.disabled = to <= start.level;
        const next = button2(doc, "fut-tp-btn", ICON.next, t("tech.next"), () => {
          to += 1;
          draw();
        });
        const add = button2(doc, planned ? "fut-tp-btn fut-tp-plan on" : "fut-tp-btn fut-tp-plan", ICON.plan, "", () => {
          let current2 = loadPlan(o.store);
          if (planned) {
            for (let l = to; l >= start.level; l--) {
              const idx = (current2[String(o.bodyId)] ?? []).findIndex((x) => x.id === details.id && x.level === l);
              if (idx >= 0) current2 = removeFromPlan(current2, o.bodyId, idx);
            }
          } else {
            const now = Date.now();
            const items = [];
            for (let l = start.level; l <= to; l++) {
              items.push({ id: details.id, level: l, name: details.name, cost: levelCost(details.id, l, start.discount), added: now });
            }
            current2 = addToPlan(current2, o.bodyId, items);
          }
          o.store.set(PLAN_KEY, current2);
          o.onPlanChange?.();
          draw();
        });
        add.title = planned ? `${t("tech.inPlan")} \xB7 ${t("tech.removeHint")}` : to > start.level ? t("tech.addRange", { from: start.level, to }) : t("tech.addOne", { level: to });
        tools.replaceChildren(prev, reset, next, add);
        if (levelLabel) levelLabel.textContent = `${start.level - 1} \u2192 ${to}`;
        const view = {
          heads: [t("tech.colLevel", { level: to }), t("tech.rangeShort", { from: start.level - 1, to }), t("tech.colMissing")],
          cols: [{ cost: one }, { cost: total, cls: "fut-tp-sum" }, { cost: gap, short: true }]
        };
        const row = el4(doc, "div", "fut-tp-chips");
        if (details.durationMs) {
          row.append(
            chip(
              doc,
              ICON.time,
              to > start.level ? `${formatDuration(ms(to))} \xB7 \u03A3 ${formatDuration(sumMs)}` : formatDuration(ms(to)),
              to > start.level ? t("tech.timeHint", { level: to, from: start.level, to }) : t("tech.time")
            )
          );
        }
        row.append(...chips);
        if (start.discount > 5e-4) row.append(chip(doc, "", t("tech.discountShort", { pct: (start.discount * 100).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }), t("tech.discount", { pct: (start.discount * 100).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }), "fut-tp-disc"));
        box.replaceChildren(grid(o, view, have !== null), row);
      };
      draw();
    } else {
      const unit = matchShownLevel(details.id, [1], details.shown);
      const discount = unit?.discount ?? 0;
      const amount = el4(doc, "input", "fut-tp-amount");
      amount.type = "text";
      amount.inputMode = "numeric";
      amount.value = String(Math.max(1, Math.floor(Number(details.amountInput?.value) || 1)));
      amount.title = t("tech.amountHint");
      for (const type of ["keydown", "keyup", "keypress"]) amount.addEventListener(type, (e) => e.stopPropagation());
      const amountOf = () => Math.max(1, Math.floor(Number(amount.value.replace(/\D/g, "")) || 1));
      let added = false;
      const draw = () => {
        const n = amountOf();
        const one = levelCost(details.id, 1, discount);
        const total = scaleCost(one, n);
        const have = o.have();
        const gap = missing(total, have ?? { metal: 0, crystal: 0, deuterium: 0 });
        const add = button2(doc, added ? "fut-tp-btn fut-tp-plan on" : "fut-tp-btn fut-tp-plan", ICON.plan, t("tech.addUnits", { n: n.toLocaleString(locale) }), () => {
          const item = { id: details.id, amount: n, name: details.name, cost: total, added: Date.now() };
          o.store.set(PLAN_KEY, addToPlan(loadPlan(o.store), o.bodyId, [item]));
          o.onPlanChange?.();
          added = true;
          draw();
        });
        if (added) add.title = t("tech.added");
        tools.replaceChildren(amount, add);
        const view = {
          heads: [t("tech.colOne"), `\xD7${n.toLocaleString(locale)}`, t("tech.colMissing")],
          cols: [{ cost: one }, { cost: total, cls: "fut-tp-sum" }, { cost: gap, short: true }]
        };
        const row = el4(doc, "div", "fut-tp-chips");
        if (details.durationMs) row.append(chip(doc, ICON.time, `${formatDuration(details.durationMs)} \xB7 \u03A3 ${formatDuration(details.durationMs * n)}`, t("tech.time")));
        row.append(...chips);
        box.replaceChildren(grid(o, view, have !== null), row);
      };
      amount.addEventListener("input", () => {
        added = false;
        const keep = amount.selectionStart;
        draw();
        amount.focus();
        if (keep !== null) amount.setSelectionRange(keep, keep);
      });
      draw();
      const input = details.amountInput;
      const follow = () => setTimeout(() => {
        amount.value = String(Math.max(1, Math.floor(Number(input?.value) || 1)));
        draw();
      }, 0);
      if (input) {
        for (const type of ["input", "change", "keyup"]) input.addEventListener(type, follow);
        input.parentElement?.querySelector(".maximum")?.addEventListener("click", follow);
      }
    }
    details.root.classList.add("fut-tp-on");
    details.root.classList.toggle("fut-tp-unit", !!details.root.querySelector(".build_amount, .shipyardSelection"));
    const sprite = details.root.querySelector(".sprite, .sprite_large");
    (sprite ?? details.root).append(tools);
    const content = details.root.querySelector(".content") ?? details.root;
    content.append(box);
    if (levelLabel && !levelLabel.dataset.futText) levelLabel.dataset.futText = levelText.trim();
    return box;
  }
  function injectStyle(doc) {
    if (doc.getElementById("fut-tp-style")) return;
    const style = el4(doc, "style");
    style.id = "fut-tp-style";
    style.textContent = TECH_CSS;
    doc.head.append(style);
  }
  function watchTechPages(o) {
    const { doc } = o;
    if (!doc.querySelector("#technologies")) return;
    const levels = levelsOf(readTechList(doc));
    const pruned = prune(loadPlan(o.store), o.bodyId, levels);
    if (pruned.changed) {
      o.store.set(PLAN_KEY, pruned.plan);
      o.onPlanChange?.();
    }
    injectStyle(doc);
    rememberTechIcons(doc, o.store);
    doc.addEventListener(
      "click",
      (e) => {
        const b = e.target?.closest?.("#technologydetails .build-it_wrap button, #technologies button.upgrade[data-technology]");
        if (!b || b.disabled) return;
        const id = Number(b.getAttribute("data-technology") ?? readTechDetails(doc)?.id);
        if (!id) return;
        const entry = readTechList(doc).find((x) => x.id === id);
        const amountInput = doc.querySelector("#technologydetails #build_amount");
        const change = isLevelled(id) ? startBuild(loadPlan(o.store), o.bodyId, id, { level: (entry?.level ?? 0) + 1 }) : startBuild(loadPlan(o.store), o.bodyId, id, { amount: Math.max(1, Math.floor(Number(amountInput?.value) || 1)) });
        if (change.changed) {
          o.store.set(PLAN_KEY, change.plan);
          o.onPlanChange?.();
        }
      },
      true
    );
    let lastRoot = null;
    const check = () => {
      const details = readTechDetails(doc);
      if (!details) return;
      if (details.root === lastRoot && details.root.querySelector(".fut-tp")) return;
      lastRoot = details.root;
      renderTechPanel(o, details);
    };
    const target = doc.getElementById("technologydetails_wrapper") ?? doc.body;
    new MutationObserver(() => check()).observe(target, { childList: true, subtree: true });
    check();
  }

  // src/modules/tech/planner-view.ts
  var RES2 = [["metal", "m"], ["crystal", "c"], ["deuterium", "d"]];
  var toggled = /* @__PURE__ */ new Set();
  var PLANNER_ID = "fut-planner";
  var keyHandler2 = null;
  function h4(tag, cls = "", text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== void 0) node.textContent = text;
    return node;
  }
  function closePlanner(doc) {
    doc.getElementById(PLANNER_ID)?.remove();
    if (keyHandler2) doc.removeEventListener("keydown", keyHandler2, true);
    keyHandler2 = null;
  }
  function accountResources(bodies, haveOf, inFlight) {
    if (!bodies.length) return null;
    const sum = { ...inFlight };
    for (const b of bodies) {
      const r = haveOf(b.id);
      if (!r) continue;
      sum.metal += r.metal;
      sum.crystal += r.crystal;
      sum.deuterium += r.deuterium;
    }
    return sum;
  }
  function openPlanner(o) {
    const { doc, t, locale } = o;
    closePlanner(doc);
    const host = doc.createElement("div");
    host.id = PLANNER_ID;
    const root = host.attachShadow({ mode: "open" });
    const style = h4("style");
    style.textContent = WINDOW_SHEET + PLANNER_CSS;
    const backdrop = h4("div", "backdrop");
    const panel = h4("div", "panel");
    backdrop.append(panel);
    root.append(style, backdrop);
    doc.body.append(host);
    const fmt = (n) => formatUnits(n, locale);
    const byId = new Map((o.snapshot?.bodies ?? []).map((b) => [b.id, b]));
    const stock2 = (id) => {
      if (o.current && o.current.id === id) return o.current.resources;
      const body = byId.get(id);
      return body ? estimateResources(body, o.now) : null;
    };
    const seenAt = (id) => o.current && o.current.id === id ? o.now : byId.get(id)?.resourcesAt ?? 0;
    const timeOf = (ms) => new Date(ms).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    const icons = o.store.get(TECH_ICONS_KEY, {});
    let confirmClear = false;
    const labels = /* @__PURE__ */ new Map();
    for (const e of o.entries) {
      if (e.planetId) labels.set(e.planetId, `${e.name} [${e.coords}]`);
      if (e.moonId) labels.set(e.moonId, `${t("plan.moonOf", { name: e.name })} [${e.coords}]`);
    }
    const labelOf = (id) => labels.get(id) ?? `#${id}`;
    const order = new Map([...labels.keys()].map((id, i) => [id, i]));
    const byList = (a, b) => (order.get(a.bodyId) ?? 1e9) - (order.get(b.bodyId) ?? 1e9);
    const refs = o.entries.map((e) => ({ planetId: e.planetId, moonId: e.moonId }));
    const triple = (cost, short) => {
      const out = [];
      for (const [key2, c] of RES2) {
        const lack = short ? short[key2] : 0;
        const v = h4("span", `num ${c}${lack > 0 ? " short" : ""}`, cost[key2] ? fmt(cost[key2]) : "\u2014");
        v.title = `${t(`tech.res.${key2}`)}: ${Math.round(cost[key2]).toLocaleString(locale)}${lack > 0 ? ` \xB7 ${t("plan.lacksHere", { n: fmt(lack) })}` : ""}`;
        out.push(v);
      }
      return out;
    };
    const what = (r) => r.amount !== void 0 ? `\xD7${r.amount.toLocaleString(locale)}` : r.from === r.to ? t("plan.level", { level: r.from ?? 0 }) : t("plan.levels", { from: r.from ?? 0, to: r.to ?? 0 });
    const draw = () => {
      const plan = o.store.get(PLAN_KEY, {});
      const allSent = o.store.get(SENT_KEY, []);
      const sent = prunePending(allSent, plan, seenAt);
      if (sent.length !== allSent.length) o.store.set(SENT_KEY, sent);
      const save = (next) => {
        o.store.set(PLAN_KEY, next);
        o.onChange?.();
        draw();
      };
      const pendingOf = (id) => pendingFor(sent, id, seenAt(id));
      const haveOf = (id) => {
        const r = stock2(id);
        if (!r) return null;
        const p = pendingOf(id);
        return { metal: r.metal + p.metal, crystal: r.crystal + p.crystal, deuterium: r.deuterium + p.deuterium };
      };
      const inFlight = Object.keys(plan).reduce((s, k) => {
        const p = pendingOf(Number(k));
        return { metal: s.metal + p.metal, crystal: s.crystal + p.crystal, deuterium: s.deuterium + p.deuterium };
      }, { metal: 0, crystal: 0, deuterium: 0 });
      const account = accountResources(o.snapshot?.bodies ?? [], stock2, inFlight);
      const { total, missing: missing2 } = accountGap(plan, account);
      const groups = groupByTech(plan, haveOf);
      const head = h4("div", "head");
      const titles = h4("div", "titles");
      titles.append(h4("h2", "", t("plan.title")), h4("span", "sub", t("plan.sub")));
      head.append(titles);
      if (groups.length) {
        const clear = h4("button", `act ghost${confirmClear ? " danger" : ""}`, confirmClear ? t("plan.clearConfirm") : t("plan.clearAll"));
        clear.type = "button";
        clear.addEventListener("click", () => {
          if (!confirmClear) {
            confirmClear = true;
            return draw();
          }
          confirmClear = false;
          save({});
        });
        head.append(clear);
      }
      const close = h4("button", "close");
      close.type = "button";
      close.append(icon(doc, "close", 16));
      close.title = t("fleet.close");
      close.addEventListener("click", () => closePlanner(doc));
      head.append(close);
      if (!groups.length) {
        panel.replaceChildren(head, h4("p", "empty", t("plan.empty")));
        return;
      }
      const kpis = h4("div", "kpis");
      const kpi = (label, cost, cls, note) => {
        const box = h4("div", `kpi ${cls}`);
        box.append(h4("span", "label", label));
        const line = h4("div", "kpi-line");
        if (cost) for (const [key2, c] of RES2) {
          const v = h4("span", `num ${c}`, fmt(cost[key2]));
          v.title = Math.round(cost[key2]).toLocaleString(locale);
          line.append(v);
        }
        else line.append(h4("span", "num", "?"));
        box.append(line);
        if (note) box.append(h4("span", "note", note));
        return box;
      };
      const covered = missing2 && missing2.metal + missing2.crystal + missing2.deuterium === 0;
      kpis.append(
        kpi(t("plan.grandTotal"), total, ""),
        kpi(t("plan.account"), account, "", account ? t("plan.accountNote") : t("plan.accountUnknown")),
        covered ? kpi(t("plan.accountCovered"), null, "ok") : kpi(t("plan.accountMissing"), missing2, "warn")
      );
      if (covered) kpis.lastElementChild.querySelector(".kpi-line").replaceChildren(h4("span", "num okv", "\u2713"));
      const list = h4("div", "groups");
      for (const g of groups) list.append(groupTile(g, plan, haveOf, pendingOf, save));
      panel.replaceChildren(head, kpis, list);
    };
    const groupTile = (g, plan, haveOf, pendingOf, save) => {
      const tile2 = h4("div", "group");
      const one = g.rows.length === 1 ? g.rows[0] : null;
      const open = one ? false : toggled.has(g.id) ? g.rows.length > 3 : g.rows.length <= 3;
      const top = h4("div", "ghead");
      const name = h4("div", "gname");
      const titleLine = h4("span", "gtitle", g.name);
      const meta = h4("span", "gmeta", one ? `${labelOf(one.bodyId)} \xB7 ${what(one)}` : t("plan.onBodies", { n: g.rows.length }) + " \xB7 " + levelsSummary(g.rows));
      name.append(titleLine, meta);
      top.append(techIconEl(doc, icons[String(g.id)], 28), name, ...triple(g.cost, one?.short));
      const acts = h4("div", "acts");
      if (one) acts.append(...rowActions(one, plan, haveOf, pendingOf, save));
      else {
        const caret = h4("button", "ib");
        caret.type = "button";
        caret.setAttribute("aria-expanded", String(open));
        caret.title = t(open ? "plan.collapse" : "plan.expand");
        caret.textContent = open ? "\u25B4" : "\u25BE";
        const flip = () => {
          if (toggled.has(g.id)) toggled.delete(g.id);
          else toggled.add(g.id);
          draw();
        };
        caret.addEventListener("click", flip);
        top.classList.add("clickable");
        name.addEventListener("click", flip);
        const remove = h4("button", "x");
        remove.type = "button";
        remove.append(icon(doc, "close", 13));
        remove.title = t("plan.removeAll", { n: g.rows.length });
        remove.addEventListener("click", () => {
          let next = plan;
          for (const r of g.rows) for (const i of [...r.indexes].reverse()) next = removeFromPlan(next, r.bodyId, i);
          save(next);
        });
        acts.append(caret, remove);
      }
      top.append(acts);
      tile2.append(top);
      if (open) {
        const rows = h4("div", "grows");
        for (const r of [...g.rows].sort(byList)) {
          const row = h4("div", "grow");
          const label = h4("span", "gbody");
          label.append(h4("span", "", labelOf(r.bodyId)), h4("span", "lv", what(r)));
          row.append(label, ...triple(r.cost, r.short));
          const a = h4("div", "acts");
          a.append(...rowActions(r, plan, haveOf, pendingOf, save));
          row.append(a);
          rows.append(row);
        }
        tile2.append(rows);
      }
      return tile2;
    };
    const levelsSummary = (rows) => {
      const levels = rows.flatMap((r) => r.from !== void 0 ? [r.from, r.to ?? r.from] : []);
      if (!levels.length) return `\xD7${rows.reduce((n, r) => n + (r.amount ?? 0), 0).toLocaleString(locale)}`;
      const lo = Math.min(...levels);
      const hi = Math.max(...levels);
      return lo === hi ? t("plan.level", { level: lo }) : t("plan.levels", { from: lo, to: hi });
    };
    const rowActions = (r, plan, haveOf, pendingOf, save) => {
      const out = [];
      const items = plan[String(r.bodyId)] ?? [];
      const have = haveOf(r.bodyId);
      const gap = have ? planMissing(items, have) : null;
      const short = gap ? gap.metal + gap.crystal + gap.deuterium : 0;
      const p = pendingOf(r.bodyId);
      if (p.metal + p.crystal + p.deuterium > 0) {
        const s = h4("span", "sent");
        s.append(icon(doc, "fleet", 12));
        s.title = `${p.arriveAt > o.now ? t("plan.sentArriving", { time: timeOf(p.arriveAt) }) : t("plan.sentArrived")}: ${fmt(p.metal)} \xB7 ${fmt(p.crystal)} \xB7 ${fmt(p.deuterium)}`;
        out.push(s);
      }
      if (gap && short > 0 && o.navigate && o.href) {
        const bring = h4("button", "ib bring");
        bring.type = "button";
        bring.append(icon(doc, "swap", 13));
        bring.title = `${p.metal + p.crystal + p.deuterium > 0 ? t("plan.complete") : t("plan.bring")} \xB7 ${labelOf(r.bodyId)} \xB7 ${t("plan.bringHint")}`;
        bring.setAttribute("aria-label", bring.title);
        bring.addEventListener("click", () => {
          const here = o.current?.id ?? null;
          const source = here !== null && here !== r.bodyId ? here : nextBody(refs, here ?? r.bodyId, { skip: r.bodyId });
          if (!source) return;
          const delivery = { target: r.bodyId, need: { metal: Math.ceil(gap.metal), crystal: Math.ceil(gap.crystal), deuterium: Math.ceil(gap.deuterium) } };
          o.store.set(DELIVERY_KEY, delivery);
          o.navigate(repeatUrl(o.href, source, { mode: "plan", first: source, dest: r.bodyId }));
        });
        out.push(bring);
      } else if (gap && short === 0) {
        const ok = h4("span", "okmark");
        ok.append(icon(doc, "check", 12));
        ok.title = t("plan.readyHere");
        out.push(ok);
      }
      const remove = h4("button", "x");
      remove.type = "button";
      remove.append(icon(doc, "close", 13));
      remove.title = t("plan.remove");
      remove.addEventListener("click", () => {
        let next = plan;
        for (const i of [...r.indexes].reverse()) next = removeFromPlan(next, r.bodyId, i);
        save(next);
      });
      out.push(remove);
      return out;
    };
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closePlanner(doc);
    });
    keyHandler2 = (e) => {
      if (e.key === "Escape") closePlanner(doc);
    };
    doc.addEventListener("keydown", keyHandler2, true);
    draw();
  }

  // src/modules/messages/journal-view.ts
  var JOURNAL_ID = "fut-journal";
  var PERIOD_KEY = "exp.period";
  var PERIODS = ["today", "yesterday", "week", "month", "all"];
  var ORDER = ["resource", "darkmatter", "ship", "item", "trader", "early", "late", "pirate", "alien", "blackhole", "nothing", "artefact", "lifeform", "unknown"];
  var keyHandler3 = null;
  function h5(tag, cls = "", text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== void 0) node.textContent = text;
    return node;
  }
  function closeJournal(doc) {
    doc.getElementById(JOURNAL_ID)?.remove();
    if (keyHandler3) doc.removeEventListener("keydown", keyHandler3, true);
    keyHandler3 = null;
  }
  function openJournal(o) {
    const { doc, t, locale, store } = o;
    closeJournal(doc);
    const host = doc.createElement("div");
    host.id = JOURNAL_ID;
    const root = host.attachShadow({ mode: "open" });
    const style = h5("style");
    style.textContent = WINDOW_SHEET + JOURNAL_CSS;
    const backdrop = h5("div", "backdrop");
    const panel = h5("div", "panel");
    backdrop.append(panel);
    root.append(style, backdrop);
    doc.body.append(host);
    const fmt = (n) => formatUnits(n, locale);
    const ships = store.get(SHIPS_INFO_KEY, {});
    let period = store.get(PERIOD_KEY, "week");
    if (!PERIODS.includes(period)) period = "week";
    let confirmClear = false;
    const draw = () => {
      const journal = store.get(JOURNAL_KEY, {});
      const entries = entriesIn(journal, periodRange(period, o.now));
      const s = periodStats(entries);
      const head = h5("div", "head");
      const titles = h5("div", "titles");
      titles.append(h5("h2", "", t("exp.title")), h5("span", "sub", t("exp.sub")));
      const close = h5("button", "close");
      close.append(icon(doc, "close", 16));
      close.title = t("fleet.close");
      close.addEventListener("click", () => closeJournal(doc));
      head.append(titles, close);
      const tabs = h5("div", "tabs");
      for (const p of PERIODS) {
        const b = h5("button", "tab", t(`exp.period.${p}`));
        b.setAttribute("aria-pressed", String(p === period));
        b.addEventListener("click", () => {
          period = p;
          store.set(PERIOD_KEY, p);
          draw();
        });
        tabs.append(b);
      }
      const parts = [head, tabs];
      if (!entries.length) {
        parts.push(h5("p", "empty", Object.keys(journal).length ? t("exp.emptyPeriod") : t("exp.empty")));
      } else {
        const kpis = h5("div", "kpis");
        const kpi = (label, value, cls = "", detail) => {
          const box2 = h5("div", "kpi");
          box2.append(h5("span", "label", label), h5("span", `value ${cls}`, value));
          if (detail) box2.append(detail);
          kpis.append(box2);
        };
        const triple = (r) => {
          const d = h5("div", "detail");
          d.append(h5("span", "m", fmt(r.metal)), h5("span", "c", fmt(r.crystal)), h5("span", "d", fmt(r.deuterium)));
          return d;
        };
        const countDetail = h5("div", "detail");
        if (s.discoveries) countDetail.append(h5("span", "", t("exp.discoveries", { n: s.discoveries })));
        kpi(t("exp.count"), s.count.toLocaleString(locale), "", countDetail);
        kpi(t("exp.resources"), `${fmt(msu2(s.res))} MSU`, "", triple(s.res));
        kpi(t("exp.dm"), fmt(s.res.darkMatter), "dm");
        kpi(t("exp.shipsFound"), `${fmt(msu2(s.shipsValue))} MSU`, "pos", triple(s.shipsValue));
        kpi(t("exp.lost"), msu2(s.lostValue) ? `\u2212${fmt(msu2(s.lostValue))} MSU` : "\u2014", msu2(s.lostValue) ? "neg" : "", msu2(s.lostValue) ? triple(s.lostValue) : void 0);
        kpi(t("exp.net"), `${fmt(s.netMsu)} MSU`, s.netMsu < 0 ? "neg" : "pos");
        kpi(t("exp.average"), s.count ? `${fmt(s.netMsu / s.count)} MSU` : "\u2014");
        if (s.lfXp || s.artefacts) {
          const d = h5("div", "detail");
          if (s.artefacts) d.append(h5("span", "", t("msg.artefacts", { n: s.artefacts.toLocaleString(locale) })));
          kpi(t("exp.lfXp"), s.lfXp.toLocaleString(locale), "", d);
        }
        parts.push(kpis);
        const outs = h5("div", "card");
        outs.append(h5("h3", "", t("exp.outcomes")));
        const total = Object.values(s.outcomes).reduce((a, b) => a + (b ?? 0), 0) || 1;
        const bar = h5("div", "bar");
        const legend = h5("div", "legend");
        for (const key2 of ORDER) {
          const n = s.outcomes[key2];
          if (!n) continue;
          const seg = h5("span");
          seg.style.width = `${n / total * 100}%`;
          seg.style.background = OUTCOME_COLORS[key2] ?? "#5B6B80";
          seg.title = `${t(`msg.out.${key2}`)}: ${n}`;
          bar.append(seg);
          const row = h5("div");
          const dot = h5("span", "dot");
          dot.style.background = OUTCOME_COLORS[key2] ?? "#5B6B80";
          row.append(dot, h5("span", "", t(`msg.out.${key2}`)), h5("span", "n", n.toLocaleString(locale)), h5("span", "pct", (n / total).toLocaleString(locale, { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 })));
          legend.append(row);
        }
        outs.append(bar, legend);
        const sized = s.sizes[0] + s.sizes[1] + s.sizes[2];
        if (sized) {
          const sizes = h5("div", "detail");
          sizes.style.cssText = "display:flex;gap:12px;margin-top:8px;color:#8A9BB0;font-size:12px";
          for (const i of [2, 1, 0]) sizes.append(h5("span", "", `${t(`msg.size.${i}`)} ${s.sizes[i].toLocaleString(locale)} (${(s.sizes[i] / sized).toLocaleString(locale, { style: "percent", maximumFractionDigits: 0 })})`));
          outs.append(sizes);
        }
        parts.push(outs);
        const found = Object.entries(s.shipsFound);
        const lost = Object.entries(s.lost);
        if (found.length || lost.length) {
          const card = h5("div", "card");
          card.append(h5("h3", "", t("exp.ships")));
          const grid2 = (units, lost2) => {
            const list = h5("div", `ships${lost2 ? " lost" : ""}`);
            for (const [id, n] of units.sort((x, y) => Number(x[0]) - Number(y[0]))) {
              const name = shipName(Number(id), ships, t);
              const tile2 = h5("div", "ship");
              const info = h5("div", "ship-info");
              info.append(h5("b", lost2 ? "neg" : "pos", `${lost2 ? "\u2212" : "+"}${n.toLocaleString(locale)}`), h5("span", "ship-name", name));
              tile2.append(shipIcon(doc, Number(id), name, "ship-img"), info);
              list.append(tile2);
            }
            return list;
          };
          if (found.length) card.append(grid2(found, false));
          if (lost.length) {
            card.append(h5("h4", "lost", t("exp.lost")));
            card.append(grid2(lost, true));
          }
          parts.push(card);
        }
        const days = byDay(entries, 31);
        if (days.length > 1 || period !== "today") {
          const card = h5("div", "card");
          card.append(h5("h3", "", t("exp.byDay")));
          const scroll = h5("div", "scroll");
          const table = h5("table");
          const hr = h5("tr");
          for (const label of [t("exp.day"), t("exp.countShort"), t("msg.res.metal"), t("msg.res.crystal"), t("msg.res.deuterium"), t("exp.dmShort"), t("exp.shipsShort"), "MSU"])
            hr.append(h5("th", "", label));
          table.append(hr);
          for (const { day, stats } of days) {
            const tr = h5("tr");
            tr.append(
              h5("td", "", new Date(day).toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "2-digit" })),
              h5("td", "", String(stats.count)),
              h5("td", "m", fmt(stats.res.metal)),
              h5("td", "c", fmt(stats.res.crystal)),
              h5("td", "d", fmt(stats.res.deuterium)),
              h5("td", "dm", fmt(stats.res.darkMatter)),
              h5("td", "pos", fmt(msu2(stats.shipsValue) - msu2(stats.lostValue))),
              h5("td", stats.netMsu < 0 ? "neg" : "", fmt(stats.netMsu))
            );
            table.append(tr);
          }
          scroll.append(table);
          card.append(scroll);
          parts.push(card);
        }
      }
      const foot = h5("div", "foot");
      const opt = h5("label", "opt");
      const box = h5("input");
      box.type = "checkbox";
      box.checked = store.get(FOLD_KEY, true);
      box.addEventListener("change", () => store.set(FOLD_KEY, box.checked));
      opt.append(box, document.createTextNode(t("exp.fold")));
      const acts = h5("div", "acts");
      const exp = h5("button", "act", t("exp.export"));
      exp.title = t("exp.exportHint");
      exp.addEventListener("click", () => {
        const blob = new Blob([JSON.stringify({ app: "future", kind: "expedition-journal", exportedAt: o.now, entries: journal }, null, 1)], { type: "application/json" });
        const a = doc.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `future-spedizioni-${new Date(o.now).toISOString().slice(0, 10)}.json`;
        doc.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
      });
      const clear = h5("button", confirmClear ? "act danger" : "act ghost", confirmClear ? t("exp.clearConfirm") : t("exp.clear"));
      clear.addEventListener("click", () => {
        if (!confirmClear) {
          confirmClear = true;
          draw();
          return;
        }
        confirmClear = false;
        store.set(JOURNAL_KEY, {});
        draw();
      });
      if (Object.keys(journal).length) acts.append(exp, clear);
      foot.append(opt, acts);
      parts.push(foot);
      panel.replaceChildren(...parts);
    };
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeJournal(doc);
    });
    keyHandler3 = (e) => {
      if (e.key === "Escape") closeJournal(doc);
    };
    doc.addEventListener("keydown", keyHandler3, true);
    draw();
  }

  // src/data/highscore.ts
  var int3 = (text) => Number((text ?? "").replace(/[^\d]/g, "")) || 0;
  function readHighscore(doc) {
    const table = doc.getElementById("ranks");
    if (!table || !doc.querySelector("#player.active")) return null;
    const category = doc.querySelector("a.stat_filter.active")?.id ?? "";
    const rows = [];
    for (const row of table.querySelectorAll('tbody tr[id^="position"]')) {
      const playerId = int3(row.id);
      if (!playerId) continue;
      rows.push({
        row,
        playerId,
        rank: int3(row.querySelector("td.position")?.textContent),
        name: row.querySelector(".playername")?.textContent?.trim() ?? "",
        // The cell's own text only: Future adds its figures inside the same cell.
        score: int3([...row.querySelector("td.score")?.childNodes ?? []].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("")),
        mine: row.classList.contains("myrank")
      });
    }
    return { category, rows };
  }
  function daysToCatch(gap, mine, theirs = 0) {
    const closing = mine - theirs;
    if (gap <= 0) return 0;
    return closing > 0 ? gap / closing : null;
  }

  // src/data/highscore-api.ts
  var API_TYPES = { points: 0, economy: 1, research: 2, fleet: 3, lifeform: 8 };
  var key = (type) => `hs.daily.${type}`;
  var TTL4 = 36e5;
  function parseHighscoreXml(xml, readAt) {
    const doc = new DOMParser().parseFromString(xml, "text/html");
    const root = doc.querySelector("highscore");
    const ts = Number(root?.getAttribute("timestamp"));
    if (!root || !ts) return null;
    const scores = {};
    for (const p of root.querySelectorAll("player")) {
      const id = p.getAttribute("id");
      const score = Number(p.getAttribute("score"));
      if (id && Number.isFinite(score)) scores[id] = Math.floor(score);
    }
    return { at: ts * 1e3, readAt, scores };
  }
  function updateBase(prev, reading) {
    const day = dayKey(reading.at);
    if (prev && prev.day === day) return { ...prev, last: reading };
    const lastHour = prev ? new Date(prev.last.at).getHours() : -1;
    const base = prev && lastHour >= 23 && reading.at - prev.last.at < 2 * TTL4 ? prev.last : reading;
    return { day, base, last: reading };
  }
  async function dailyBase(deps) {
    const now = deps.now ?? Date.now();
    const stored = deps.store.get(key(deps.type), null);
    if (stored && now - stored.last.readAt < TTL4 && stored.day === dayKey(now)) return stored;
    const res = await deps.guard.request(`${deps.origin}/api/highscore.xml?category=1&type=${deps.type}`, "user-view");
    const reading = res.ok ? parseHighscoreXml(await res.text(), now) : null;
    if (!reading) return stored;
    const next = updateBase(stored, reading);
    deps.store.set(key(deps.type), next);
    return next;
  }

  // src/modules/highscore/index.ts
  var daily = null;
  var isHighscorePage = (doc) => new URL(doc.location?.href ?? "http://x/").searchParams.get("component") === "highscore";
  var CSS2 = `
#ranks .fut-hs-gap { display: block; font-size: 10px; line-height: 1.3; }
#ranks .fut-hs-gap.up { color: #7BC47F; } #ranks .fut-hs-gap.down { color: #D86A6A; } #ranks .fut-hs-gap.flat { color: #6A7682; }
.fut-hs-note { margin: 4px 0 6px; color: #848484; font: 11px Verdana, Arial, sans-serif; }
#ranks .fut-hs-eta { display: block; font-size: 10px; color: #6F9FC8; }
#ranks .highscoreNameHolder .fut-mk-flag { margin-left: 4px; }`;
  function decorateHighscore(o) {
    const { doc, store, t, locale } = o;
    const hs = readHighscore(doc);
    if (!hs) return;
    const fmt = (n) => formatUnits(n, locale);
    const total = hs.category === "points";
    const mine = hs.rows.find((r) => r.mine)?.score ?? (total ? store.get(SCORE_KEY, null)?.points : void 0);
    const myPace = total ? changeOver(store.get(HISTORY_KEY, []), 7)?.perDay ?? 0 : 0;
    const now = o.now?.() ?? Date.now();
    const type = API_TYPES[hs.category];
    const loaded = daily && daily.type === type ? daily.base : null;
    const today = loaded && loaded.day === dayKey(now) ? loaded : null;
    const since = today ? new Date(today.base.at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) : "";
    const table = doc.getElementById("ranks");
    let note = doc.querySelector(".fut-hs-note");
    if (type !== void 0 && table) {
      if (!note) {
        note = doc.createElement("p");
        note.className = "fut-hs-note";
      }
      note.textContent = today ? t("hs.note", { time: since }) : t("hs.noteWaiting");
      if (note.nextElementSibling !== table) table.before(note);
    } else note?.remove();
    if (type !== void 0 && o.guard && (!daily || daily.type !== type)) {
      daily = { type, base: null };
      void dailyBase({ guard: o.guard, store, origin: doc.location.origin, type, now }).then((b) => {
        if (daily?.type === type) daily = { type, base: b };
      }).catch(() => {
      }).finally(() => decorateHighscore(o));
    }
    for (const r of hs.rows) {
      r.row.querySelectorAll(".fut-hs-gap, .fut-hs-eta").forEach((n) => n.remove());
      const scoreCell = r.row.querySelector("td.score");
      const base = today?.base.scores[String(r.playerId)];
      if (scoreCell && base !== void 0) {
        const made = r.score - base;
        const g = doc.createElement("span");
        g.className = `fut-hs-gap ${made > 0 ? "up" : made < 0 ? "down" : "flat"}`;
        g.textContent = made > 0 ? `+${fmt(made)}` : made < 0 ? `\u2212${fmt(-made)}` : "0";
        g.title = t("hs.today", { n: made.toLocaleString(locale), time: since });
        scoreCell.append(g);
      }
      if (scoreCell && mine !== void 0 && !r.mine && total && myPace > 0 && r.score > mine) {
        const days = daysToCatch(r.score - mine, myPace);
        const e = doc.createElement("span");
        e.className = "fut-hs-eta";
        e.textContent = days === null ? t("hs.never") : days < 1 ? t("hs.passToday") : t("hs.days", { n: Math.ceil(days).toLocaleString(locale) });
        e.title = t("hs.etaMine", { mine: fmt(myPace) });
        scoreCell.append(e);
      }
      const nameHolder = r.row.querySelector(".highscoreNameHolder");
      if (nameHolder && !r.mine && !nameHolder.querySelector(".fut-mk-flag")) nameHolder.append(flagButton({ doc, store, t }, r.playerId, r.name));
    }
  }
  function watchHighscore(o) {
    ensureMarksStyle(o.doc);
    if (!o.doc.getElementById("fut-hs-style")) {
      const style = o.doc.createElement("style");
      style.id = "fut-hs-style";
      style.textContent = CSS2;
      o.doc.head.append(style);
    }
    decorateHighscore(o);
    const box = o.doc.getElementById("stat_list_content") ?? o.doc.body;
    let queued = false;
    new MutationObserver((list) => {
      if (queued || list.every((m) => [...m.addedNodes].every((n) => n instanceof Element && (/^fut-(hs|mk)/.test(n.getAttribute("class") ?? "") || !!n.closest(".fut-mk"))))) return;
      queued = true;
      setTimeout(() => {
        queued = false;
        decorateHighscore(o);
      }, 50);
    }).observe(box, { childList: true, subtree: true });
  }

  // src/engines/reminders.ts
  var REMINDERS_KEY = "reminders";
  var KEEP_AFTER = 24 * 36e5;
  var REMINDERS_MAX = 50;
  var hasReminder = (list, id) => list.some((r) => r.id === id);
  function toggleReminder(list, r) {
    if (hasReminder(list, r.id)) return list.filter((x) => x.id !== r.id);
    return [...list, r].sort((a, b) => a.at - b.at).slice(0, REMINDERS_MAX);
  }
  var dueReminders = (list, now) => list.filter((r) => !r.fired && r.at <= now);
  function nextReminder(list, now) {
    return list.filter((r) => !r.fired && r.at > now).sort((a, b) => a.at - b.at)[0] ?? null;
  }
  function markFired(list, ids, now) {
    return list.map((r) => ids.includes(r.id) ? { ...r, fired: true } : r).filter((r) => !r.fired || now - r.at < KEEP_AFTER);
  }

  // src/modules/reminders/index.ts
  var HOST_ID2 = "fut-reminders";
  var timer = null;
  var current = null;
  function clockOffset(doc, localNow) {
    const ts = Number(doc.querySelector('meta[name="ogame-timestamp"]')?.getAttribute("content"));
    return ts ? ts * 1e3 - localNow : 0;
  }
  var serverNow = (o) => Date.now() + o.offset;
  function toastHost(doc) {
    const existing = doc.getElementById(HOST_ID2)?.shadowRoot;
    if (existing) return existing;
    const host = doc.createElement("div");
    host.id = HOST_ID2;
    const root = host.attachShadow({ mode: "open" });
    const style = doc.createElement("style");
    style.textContent = `
.stack { position: fixed; right: 16px; bottom: 16px; z-index: 1000002; display: flex; flex-direction: column; gap: 8px; max-width: 340px; }
.toast { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 10px; background: #111B2A; border: 1px solid #4FD1E8;
  color: #E6EDF5; font: 13px Arial, sans-serif; box-shadow: 0 8px 24px rgba(0,0,0,0.5); }
.toast svg { flex-shrink: 0; margin-top: 1px; color: #4FD1E8; }
.toast b { display: block; margin-bottom: 2px; }
.toast span { color: #8A9BB0; font-size: 12px; }
.toast button { margin-left: auto; height: 24px; padding: 0 10px; border-radius: 6px; border: 1px solid #1F2C40; background: #0A111C; color: #E6EDF5; cursor: pointer; font: 12px Arial, sans-serif; }
.toast button:hover, .toast button:focus-visible { border-color: #4FD1E8; }`;
    const stack = doc.createElement("div");
    stack.className = "stack";
    root.append(style, stack);
    doc.body.append(host);
    return root;
  }
  function show(o, r, late) {
    const { doc, t, locale } = o;
    const stack = toastHost(doc).querySelector(".stack");
    const box = doc.createElement("div");
    box.className = "toast";
    box.setAttribute("role", "alert");
    const text = doc.createElement("div");
    const title = doc.createElement("b");
    title.textContent = r.label;
    const when = doc.createElement("span");
    const time = new Date(r.at - o.offset).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
    when.textContent = t(late ? "remind.late" : "remind.now", { time });
    text.append(title, when);
    const ok = doc.createElement("button");
    ok.type = "button";
    ok.textContent = t("remind.ok");
    ok.addEventListener("click", () => box.remove());
    box.append(icon(doc, "bell", 16), text, ok);
    stack.append(box);
  }
  function startReminders(o, late = true) {
    current = o;
    if (timer) clearTimeout(timer);
    timer = null;
    const list = o.store.get(REMINDERS_KEY, []);
    const now = serverNow(o);
    const due = dueReminders(list, now);
    for (const r of due) show(o, r, late && now - r.at > 6e4);
    if (due.length) o.store.set(REMINDERS_KEY, markFired(list, due.map((r) => r.id), now));
    const next = nextReminder(o.store.get(REMINDERS_KEY, []), now);
    if (next) timer = setTimeout(() => startReminders(o, false), Math.min(next.at - now + 500, 2 ** 31 - 1));
  }
  function toggleFromClick(store, r) {
    const list = toggleReminder(store.get(REMINDERS_KEY, []), r);
    store.set(REMINDERS_KEY, list);
    if (current) startReminders(current, false);
    return hasReminder(list, r.id);
  }
  function bellButton(doc, store, t, r, cls = "fut-bell") {
    const b = doc.createElement("button");
    b.type = "button";
    b.className = cls;
    b.append(icon(doc, "bell", 12));
    const paint = (on) => {
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
      b.title = t(on ? "remind.remove" : "remind.add");
      b.setAttribute("aria-label", `${b.title}: ${r.label}`);
    };
    paint(hasReminder(store.get(REMINDERS_KEY, []), r.id));
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      paint(toggleFromClick(store, r));
    });
    return b;
  }
  function decorateEventList(o) {
    const { doc, store, t } = o;
    for (const row of doc.querySelectorAll("#eventContent tr.eventFleet, #eventContent tr.allianceAttack")) {
      if (row.querySelector(".fut-bell")) continue;
      const arrival = Number(row.dataset.arrivalTime);
      const cell = row.querySelector("td.arrivalTime");
      if (!arrival || !cell) continue;
      const mission = row.querySelector("td.missionFleet img")?.getAttribute("title")?.replace(/^.*\|/, "").trim() || "";
      const dest = row.querySelector("td.destCoords")?.textContent?.trim() || "";
      const back = row.dataset.returnFlight === "true" ? ` ${t("remind.return")}` : "";
      cell.append(bellButton(doc, store, t, { id: `f:${row.id || `${arrival}:${dest}`}`, label: `${mission}${back} ${dest}`.trim(), at: arrival * 1e3 }));
    }
  }
  var EVENT_CSS = `
#eventContent .fut-bell { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; margin-left: 4px; padding: 0;
  border: 1px solid #1F2C40; border-radius: 4px; background: #0A111C; color: #8A9BB0; cursor: pointer; vertical-align: middle; }
#eventContent .fut-bell:hover, #eventContent .fut-bell:focus-visible { border-color: #4FD1E8; color: #E6EDF5; }
#eventContent .fut-bell.on { border-color: #4FD1E8; background: #12283A; color: #4FD1E8; }`;
  function watchEventList(o) {
    if (!o.doc.getElementById("fut-bell-style")) {
      const style = o.doc.createElement("style");
      style.id = "fut-bell-style";
      style.textContent = EVENT_CSS;
      o.doc.head.append(style);
    }
    decorateEventList(o);
    let queued = false;
    new MutationObserver(() => {
      if (queued) return;
      queued = true;
      setTimeout(() => {
        queued = false;
        decorateEventList(o);
      }, 50);
    }).observe(o.doc.body, { childList: true, subtree: true });
  }

  // src/main.ts
  async function bootstrap() {
    const namespace = serverNamespace(document);
    if (!namespace) return;
    const guard = new NetworkGuard((input, init) => fetch(input, init), window.location.origin);
    const gm = new GMStore();
    const store = new Store(gm, namespace);
    const moved = migrateOld(loadMarks(store.get(MARKS_KEY, null)), {
      targets: store.get(TARGETS_KEY, []),
      rivals: store.get("rivals.list", [])
    });
    if (moved) {
      store.set(MARKS_KEY, moved);
      store.set(TARGETS_KEY, []);
      store.set("rivals.list", []);
    }
    if (store.get("rivals.points", null) !== null) store.set("rivals.points", null);
    const locale = detectLocale(document);
    const t = translator(locale);
    let snapshot = store.get(SNAPSHOT_KEY, null);
    const saver = new IdleSaver(() => store.set(SNAPSHOT_KEY, snapshot));
    window.addEventListener("beforeunload", () => saver.saveNow());
    const bodyIds = readPlanetList(document).flatMap((e) => [e.planetId, e.moonId]).filter((id) => id !== null);
    let queues = store.get(QUEUES_KEY, null);
    try {
      const [account, queue, lf] = await Promise.allSettled([
        hydrateAccountOncePerSession({ guard, store, session: window.sessionStorage }),
        loadQueuesOnPageLoad({ guard, store, ids: bodyIds }),
        // Lifeform bonuses for the expedition size: once per session, like accountInfo.
        hydrateLfOncePerSession({ guard, store, session: window.sessionStorage }),
        // Universe size and fleet speeds: public API, at most once a week.
        loadServerDataOnPageLoad({ guard, store, origin: location.origin })
      ]);
      if (lf.status === "rejected") console.warn(`[${t("app.name")}]`, lf.reason);
      if (account.status === "fulfilled") snapshot = account.value;
      else console.warn(`[${t("app.name")}]`, account.reason);
      if (queue.status === "fulfilled") queues = queue.value;
      else console.warn(`[${t("app.name")}]`, queue.reason);
    } finally {
      guard.closePageLoadWindow();
    }
    const bodyId = currentBodyId(document);
    const onPage = readCurrentResources(document);
    if (snapshot && bodyId && onPage && applyPageResources(snapshot, bodyId, onPage, Date.now())) saver.markDirty();
    if (queues) {
      const pruned = pruneByQueues(store.get(PLAN_KEY, {}), queues.bodies);
      if (pruned.changed) store.set(PLAN_KEY, pruned.plan);
    }
    const items = readActiveItems(document);
    if (items) store.set(ITEMS_KEY, items);
    const techNames = store.get(TECH_NAMES_KEY, {});
    const techList = readTechList(document);
    if (learnTechNames(techNames, techList)) store.set(TECH_NAMES_KEY, techNames);
    const lfSlots = store.get(LF_SLOTS_KEY, {});
    const seenSlots = readLfSlots(document, techList);
    if (seenSlots && bodyId && rememberLfSlots(lfSlots, bodyId, seenSlots)) store.set(LF_SLOTS_KEY, lfSlots);
    watchScore(document, () => Date.now(), (score) => {
      store.set(SCORE_KEY, score);
      store.set(HISTORY_KEY, recordDay(store.get(HISTORY_KEY, []), { at: score.at, points: score.points, rank: score.rank, ...dayFigures(snapshot) }));
    });
    const deps = { guard, store, session: window.sessionStorage };
    const storedMode = store.get("planetMenu.mode", "side");
    let settings = {
      // 'stacked' was the previous layout: it maps to the side-by-side one.
      mode: storedMode === "compact" ? "compact" : "side",
      showTotals: store.get("planetMenu.totals", true),
      markIdle: store.get("planetMenu.markIdle", false)
    };
    const planGap = () => {
      const plan = store.get(PLAN_KEY, {});
      const sent = store.get(SENT_KEY, []);
      const now = Date.now();
      const here = currentBodyId(document);
      const onScreen = readCurrentResources(document);
      const stock2 = (id) => {
        const body = snapshot?.bodies.find((b) => b.id === id);
        return here === id && onScreen ? onScreen : body ? estimateResources(body, now) : null;
      };
      const inFlight = { metal: 0, crystal: 0, deuterium: 0 };
      for (const key2 of Object.keys(plan)) {
        const id = Number(key2);
        const p = pendingFor(sent, id, here === id ? now : snapshot?.bodies.find((b) => b.id === id)?.resourcesAt ?? 0);
        inFlight.metal += p.metal;
        inFlight.crystal += p.crystal;
        inFlight.deuterium += p.deuterium;
      }
      const gap = accountGap(plan, accountResources(snapshot?.bodies ?? [], stock2, inFlight)).missing;
      return gap ? gap.metal + gap.crystal * 1.5 + gap.deuterium * 3 : null;
    };
    const draw = () => renderPlanetMenu({
      doc: document,
      entries: readPlanetList(document),
      snapshot,
      queues,
      settings,
      now: Date.now(),
      locale,
      t,
      onSettingsChange: (next) => {
        settings = next;
        store.set("planetMenu.mode", next.mode);
        store.set("planetMenu.totals", next.showTotals);
        store.set("planetMenu.markIdle", next.markIdle);
        draw();
      },
      onBackupExport: () => downloadBackup(document, gm, Date.now()),
      onBackupImport: (text) => importBackup(gm, text),
      onOpenDashboard: () => openDashboard({
        doc: document,
        snapshot,
        entries: readPlanetList(document),
        score: store.get(SCORE_KEY, null),
        history: store.get(HISTORY_KEY, []),
        bell: (r) => bellButton(document, store, t, r),
        queues,
        names: techNames,
        lfSlots,
        now: Date.now(),
        locale,
        t
      }),
      planCount: planCount(store.get(PLAN_KEY, {})),
      targetsCount: (() => {
        const m = loadMarks(store.get(MARKS_KEY, null));
        return Object.keys(m.players).length + Object.keys(m.planets).length;
      })(),
      onOpenTargets: () => openTargetsHere(),
      planGap: planGap(),
      journalToday: (() => {
        const s = periodStats(entriesIn(store.get(JOURNAL_KEY, {}), periodRange("today", Date.now())));
        return { count: s.count, net: s.netMsu };
      })(),
      onOpenPlanner: () => {
        const id = currentBodyId(document);
        const resources = readCurrentResources(document);
        openPlanner({
          doc: document,
          store,
          entries: readPlanetList(document),
          snapshot,
          current: id && resources ? { id, resources } : null,
          now: Date.now(),
          locale,
          t,
          onChange: () => draw(),
          href: location.href,
          navigate: (url) => location.assign(url)
        });
      },
      onOpenJournal: () => openJournal({ doc: document, store, now: Date.now(), locale, t }),
      // COMPLIANCE: runs only from the Sync button's click (reason 'user-sync', no cp).
      onSync: async () => {
        try {
          const [account, queue] = await Promise.allSettled([
            syncAccountOnUserClick(deps),
            syncQueuesOnUserClick({ guard, store, ids: bodyIds }),
            fetchLfBonuses({ guard, store }, "user-sync")
          ]);
          if (account.status === "fulfilled") snapshot = account.value;
          if (queue.status === "fulfilled") queues = queue.value;
          draw();
        } catch (error) {
          console.warn(`[${t("app.name")}]`, error);
        }
      }
    });
    draw();
    const currentId = currentBodyId(document);
    const list = readPlanetList(document);
    if (currentId) {
      const go = (backwards) => {
        const id = nextBody(list, currentId, { backwards });
        if (id) location.assign(switchBodyUrl(location.href, id));
      };
      registerShortcuts(document, [
        { key: "i", label: "shortcut.prev", run: () => go(true) },
        { key: "o", label: "shortcut.next", run: () => go(false) }
      ]);
      watchJumpgate(document, store, currentId, t);
    }
    if (currentId) {
      watchTechPages({ doc: document, store, bodyId: currentId, t, locale, have: () => readCurrentResources(document), onPlanChange: () => draw() });
    }
    const side = { doc: document, store, guard, t, locale };
    const openTargetsHere = () => toggleSide(side);
    onSideNavigate(highlightPosition);
    restoreSide(side);
    registerShortcuts(document, [{ key: "m", label: "shortcut.nextTarget", run: () => void nextInSide(document) }]);
    const pageMeta = (name) => document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ?? "";
    const reminders = { doc: document, store, t, locale, offset: clockOffset(document, Date.now()) };
    startReminders(reminders);
    watchEventList(reminders);
    if (isHighscorePage(document)) watchHighscore({ doc: document, store, locale, t, guard });
    if (isMessagesPage(document))
      watchMessages({
        doc: document,
        store,
        playerId: ownPlayerId(document),
        locale,
        t,
        spy: {
          bases: (snapshot?.bodies ?? []).map((b) => ({ id: b.id, name: b.name, coords: b.coords, moon: b.type === "moon" })),
          researches: snapshot?.researches ?? {},
          classId: Number(pageMeta("ogame-player-characterclass-id")) || 0,
          server: pageMeta("ogame-universe").split(".")[0] ?? "",
          lang: pageMeta("ogame-ui-language") || pageMeta("ogame-language")
        }
      });
    if (isFleetDispatch(document) && currentId) {
      const bodies = readPlanetList(document).map(({ planetId, moonId, name, coords }) => ({ planetId, moonId, name, coords }));
      renderFleetTools({ doc: document, store, bodyId: currentId, bodies, t, locale });
    }
    if (isGalaxyPage(document)) {
      const ownPlanetIds = new Set(readPlanetList(document).flatMap((e) => e.planetId ? [e.planetId] : []));
      watchGalaxy({ doc: document, store, guard, ownPlanetIds, locale, t, onSystem: refreshSide });
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void bootstrap(), { once: true });
  } else {
    void bootstrap();
  }
})();
