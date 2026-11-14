# Project Orion — dati e formule

Raccolta di quello che si sa su Project Orion (anomalie, litio, Scanner IA), con la fonte e lo stato di
verifica. Fonti: il Discord internazionale di OGame (canale Orion, novembre 2026, nomi dei giocatori
omessi), una guida della community, un foglio Google della community, un messaggio dello sviluppatore
e le anomalie vere viste su s808-en (Singularity, velocità economica 8, classe Generale).

Legenda: **verificato** = ricontrollato su dati del gioco; **community** = dichiarato da altri, non
ricontrollato; **ufficiale** = detto da Gameforge.

## Ricompensa e costo di un'anomalia — verificato su s808

```
MSU ricompense = base × m × livello × stelle × ondate × (1 + (ondate − 1) / 51) × modalità × j/ondate
costo in litio = c × livello × stelle × ondate
```

- `m`: moltiplicatore del tipo di missione (nome), fisso nel codice del gioco. Su s808: Risorsa, Consegna e
  Incontro alieno medio = 13; Incontro alieno piccolo = 12. Il resto della lista circola solo come
  grafico su Discord: Future la impara dalle schede (`orion.mult`, vedi sotto).
- `modalità`: Generale 1,5 in PvE e 4 in PvP (con la tecnologia T18 Mecha del Generale 1,75 e 5); le altre
  classi 1 in PvE e 2 in PvP (**community**).
- `j/ondate`: quota delle ondate pagate quando il litio non basta per tutte. Paghi e ricevi in proporzione.
- Su s808: `base` ≈ 95,09, `c` = 310,77 (dipendono dall'universo, ma `base / c = 0,306` è quello della guida).

Conseguenza: **MSU per litio = 0,306 × m × bonus ondate × modalità**, uguale a ogni livello e a ogni numero
di stelle. Il livello decide quanto è grande l'anomalia, non quanto rende per litio. Un minimo o un massimo
per livello non esiste.

Verifica (s808, Generale, 14/11/2026):

| Anomalia | Liv. | Ondate | Stelle | Modo | MSU ÷ (L·★·W·bonus·4) | Costo ÷ (L·★·W) |
|---|---|---|---|---|---|---|
| Risorsa: Cristallo | 287 | 6 | 4 | PvP | 1236,2 | 310,77 |
| Incontro alieno medio | 390 | 2 | 2 | PvP | 1236,2 | 310,77 |
| Incontro alieno medio | 342 | 1 | 1 | PvP | 1236,2 | 310,77 |
| Incontro alieno piccolo (+32 navi) | 277 | 3 | 1 | PvP | 760,8 (risorse) | 310,77 |

Altre 5 anomalie (PvE e PvP, livelli 296–379) danno lo stesso `m` con la formula senza stelle della guida.

- **Livelli bassi**: secondo Discord il livello 10 è molto potenziato (oltre 70 MSU per litio) e nei primi
  livelli dell'universo il rapporto parte altissimo e poi scende (**community**).
- **Bonus ondate**: (W + 50) / 51, da +0% con 1 ondata a +17,6% con 10 (verificato).

## Casualità

- **Combattimento**: al riscatto si prende il 100% oppure il 37,5% delle ricompense ("low roll"). Le
  consegne danno sempre il 100% (**community**). Future confronta ogni riscatto di combattimento con le
  ricompense possibili della missione e lo segna alto o basso (`roll` nell'archivio, «esiti bassi» nel Diario).
- Le cifre dello scanner hanno "≈": sono i valori pieni.

## Navi come ricompensa

- Una parte del budget va in navi («Navi casuali N»: la pagina dice quante, non quali). Nell'Incontro alieno
  piccolo con 32 navi le risorse sono il 67% del budget.
- Valore: «0,75× il valore MSU» secondo Discord; «75% del costo di costruzione» secondo la guida
  (**community**, in contrasto). Future stima le altre ricompense come (budget − risorse) × 0,75, con il
  budget dal moltiplicatore imparato; l'archivio conta le navi ricevute al loro costo di costruzione, così
  le due cose si possono confrontare.

## Consegne

- Il gioco: «Invia esclusivamente cargo … Se la tua flotta comprende navi da guerra, non riceverai alcuna ricompensa»
  e «Devi inviare una capacità di carico almeno pari a quella della flotta in arrivo» (**ufficiale**, testi del gioco).
- Le ondate di una consegna sono flotte NPC di cargo (cargo leggeri, pesanti, a volte sonde): la capacità da tenere
  all'anomalia è quella della flotta in arrivo, non la ricompensa dell'ondata (s808: ondata da 4.752 cargo leggeri =
  23,8M di capacità per ≈7,9M di ricompensa). Future la calcola alla capacità base delle navi NPC (da verificare).

## Litio

- **Produzione dello Scanner** durante la conversione: `floor(15,36 × L × 1,1^L × velocità economica)`
  (verificato sulla tabella "new" di Discord a economia 10: liv. 1 = 168, liv. 9 = 3.259, liv. 50 = 901.561;
  la tabella è sfasata di una riga). La vecchia formula aveva base 20.
- Cibo convertito: produzione × 100 (**community**).
- Deposito: la produzione si ferma a una settimana di produzione di tutti gli scanner; il litio delle
  ricompense può superarlo (**ufficiale**, testo del gioco). La pagina lo dà in `lithiumStorageCapacity`.
- Il litio non si scambia e non si ruba; serve per scansioni e riscatti (**ufficiale**).

## Edifici (foglio Google della community)

Costo livello n = base × 1,5^(n−1).

| Edificio | Metallo | Cristallo | Deuterio | Livello max nel foglio |
|---|---|---|---|---|
| Scanner di anomalie interstellari (45) | 90 | 45 | 15 | 77 |
| Anomaly Analysis Centre | 67.500 | 37.500 | 22.500 | 60 |
| Metal Recycling Unit | 112.500 | 37.500 | 18.000 | 60 |
| Lithium Electrolysis Lab | 52.500 | 37.500 | 37.500 | 60 |
| High-Pressure Deuterium Tanks | 30.000 | 37.500 | 45.000 | 60 |
| Intergalactic Recovery Centre | 75.000 | 52.500 | 22.500 | 60 |
| Catalytic Converter | 127.500 | 112.500 | 52.500 | 60 |
| Crystal Finishing Station | 37.500 | 67.500 | 27.000 | 60 |

Con la 13.1.0-beta13 lo Scanner è passato da base 84/42/14 e crescita 1,4 a 90/45/15 e 1,5.
Effetti degli impianti del Centro controllo secondo la guida (**community**): +0,2% ricompense per livello
(totale impero), Recovery Centre +0,2% navi per livello, Electrolysis Lab +0,2% di probabilità di rimborso
del litio per livello, Catalytic Converter −0,05% sul costo di conversione per livello.

## Tempi (sviluppatore, ottobre 2026)

- Il volo degli NPC è più veloce ai livelli alti, per seguire la progressione del giocatore.
- La distanza scelta (10, 50, 150) cambia molto i tempi: un livello 1000 a distanza 150 ha circa 1h30 per
  ondata, a distanza 10 circa 50 minuti (velocità 1×). Alcuni tipi sono rallentati apposta.
- In media le missioni di livello alto hanno 3,7 ondate, cioè 7–8 ore; ogni ondata ha 10 minuti in più per
  reagire.

## Come sceglie Future

Indice principale: MSU per ora di produzione di litio (o per 1M di litio). Accanto: MSU per ora di
missione (quando il litio abbonda), rischio del low roll sui combattimenti, valore stimato delle altre
ricompense. Codice: `src/engines/orion.ts` (sezione «reward model»), `src/modules/orion`.
