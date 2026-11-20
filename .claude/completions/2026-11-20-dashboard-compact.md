# 2026-11-20 — Dashboard più compatta (1920×910)

- Misurato con un account di prova simile a quello di Nicola (15 pianeti + lune, Mecha, flotta e difese), finestra 1920×910
  (spazio utile ~854px). Prima → dopo:
  Strutture 1048 → 586 (Pianeti) / 576 (Lune); Forme di vita 1318 → 549 (Edifici) / 711 (Ricerche); Rottamatore 1065 → 658;
  Riepilogo 593, Navi 592, Difese 586 invariati.
- `scopedCard` in `modules/dashboard/index.ts`: selettore a due pagine nella riga del titolo (Strutture, Forme di vita),
  scelta tenuta finché la finestra vive. Righe delle forme di vita più fitte (immagini 22px).
- Rottamatore: navi e difese in due tabelle affiancate (una colonna sotto ~940px), un solo totale sotto entrambe.
- Commit separato: margine sopra la finestra della sola Dashboard 40 → 16px.
- Le altezze vengono dai dati di prova, non dall'account vero. Versione 0.3.137.
