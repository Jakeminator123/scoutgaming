# Redigerbara labbregler

`project.seed.json` är startprojektet: blackjack, fyra croupierer, 16 semantiska
eventnoder och en standardlinje per croupier/event. Varje linje börjar med en
ovillkorlig standardvariant och tre labbalternativ. Högst fyra alternativ får finnas.
De två nya rörelseexemplen prövar beröm + varm framtoning respektive redan
avgjorda vinster + lekfull framtoning. Detta är redigerbara demoregler, inte
beslutade produktregler eller slutsatser om spelarens känslor.

Visningsnamn får ändras; tekniska ID:n och motorns sex presentationstyper är
inte samma sak som namnen. `match`, källtyp och eventordning hålls låsta.

Varianter hänvisar till namngivna triggers via `triggerIds`. Alla valda triggers
måste vara sanna (AND). Inga valda triggers innebär ovillkorlig tillgänglighet.
En trigger som används får inte tas bort. Koppla först uttryckligen bort den
från berörda varianter i editorn. Observera att färre villkor gör en variant mer
tillgänglig, inte avstängd. Standardvarianten får aldrig ha triggers.

- `deterministic`: redan publicerade events och redan avgjord historik.
- `social`: simulerad chattsignal, återkomst och godkänd språkpreferens.
- `temperament`: croupierns simulerade framtoning, inte en slutsats om spelarens
  känslor, hälsa eller sårbarhet.

OpenClaw får bara föreslå en av de tillåtna varianterna; standarden är fallback.
ID, revision och behörighet kontrolleras innan ett råd får användas. Här finns
ingen RNG, ingen plånbok, inga dolda/framtida kort och ingen spelstyrning.

`videoGenerationId` är en referens, inte en sökväg eller URL. Den knyter en
variant till videoregistret men intygar inte kalibrering, textmatchning eller
godkännande. Labbets animationsasset finns kvar som separat platshållare.

Struktur: `../schemas/studio.schema.json`. Full referens- och kontraktskontroll:
`validateProject` i `../lib/studio-model.mjs`. Redigering i webbgränssnittet ska
sparas uttryckligen; startprojektet är inte en realtidskoppling till produktion.
