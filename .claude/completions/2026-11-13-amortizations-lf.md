# Investimenti: forme di vita come InfoCompte (0.3.72)

- `src/data/lf-production.ts`: tabelle bonus/sconti FV di InfoCompte (MIT) e `readLfLevels` (pagina Impostazioni FV: «Bonus Tecnologia Forme di vita: X%» per specie, chiave `lf.levels`).
- `src/data/lf-slots.ts`: `readLfLocked` (pagine Edifici FV / Ricerche FV: `data-status="off"` = requisiti mancanti, chiave `lf.locked` per pianeta).
- `src/engines/roi.ts`: nella sequenza anche edifici FV di produzione (11106, 11108, 12106, 12109, 12110, 13110), potenziatori delle ricerche (11111, 13107, 13111), ricerche FV di produzione attive (slot da `lf.slots`, altrimenti dedotti e segnati «slot da confermare»), con fattore Kaelesh 14107 e livello specie. Sconti: 12111 produttori, 12108 edifici Rock'tal, x103 ricerche FV, 12209 plasma. Un livello 0 si propone solo se la pagina del pianeta è stata vista e non è bloccato.
- Dashboard: nella scheda espansa i link (cp=) alle pagine che mancano: Impostazioni FV, Edifici FV, Ricerche FV per pianeta.
- Provato su s808-en: Yolen 12105–12112 bloccati letti dalla pagina; in cima Cristalleria 5→6 (55 g) e ricerche FV (78 g), miniere da 288 g.
- Non fatti: 12213 (cingolati) e 12218 (classe).
