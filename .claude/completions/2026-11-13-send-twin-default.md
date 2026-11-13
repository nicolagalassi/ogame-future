# Trasporto/Schiera: destinazione predefinita e campo risorse

Attivando Trasporto o Schiera senza destinazione scritta, il pannello parte dal corpo gemello: la luna se si è sul pianeta, il pianeta se si è sulla luna (`twinTarget` in `src/modules/fleet/index.ts`). Il campo risorse è largo 13 caratteri, così 1.000.000.000 si legge tutto. Versione 0.3.69.
