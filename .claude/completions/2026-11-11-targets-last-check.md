# Lista bersagli: da quanto è stato controllato ogni giocatore (0.3.40)

- `playersList` riceve le posizioni viste in galassia; per ogni giocatore prende la lettura più recente tra i suoi pianeti
  e la mostra con `ageCell` (verde < 1h, giallo < 3 giorni, rosso oltre, "—" mai visto), tra classifica e bandierina.
- Tooltip `marks.lastCheck` / `marks.neverChecked` (it/en/fr/de). Nessuna chiamata di rete in più.
