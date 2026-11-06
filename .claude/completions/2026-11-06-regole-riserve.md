# Riserve flotta: regole separate, portale, copia selettiva

- `src/engines/fleet.ts`: `FleetProfile.gate`, `profileFor` completo (fallback portale = navi della
  riserva), `activeProfile`, `sameSection`, `sectionEmpty`, `copySections` (sostituisce
  `copyProfileToAll`), `settingsFrom` (migra `reserveOn` → `shipsOn`/`resourcesOn`; nuovo `gateOn`).
- `src/modules/fleet/index.ts`: editor a box per regola con badge e interruttore; pannello "Copia su…";
  barra con interruttori Navi / Risorse / Portale / Cibo / Ripeti / Impostazioni.
- `src/modules/fleet/jumpgate.ts`: usa la regola portale e ha un interruttore nel dialogo.
- Test in `tests/fleet.test.ts` (engine, portale, finestra). Non provato nel gioco: browser dev spento.
