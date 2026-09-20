> Arkiverad arbetsrapport/prompt från 20 september 2026. Uppgifter och instruktioner är daterat underlag; arkivering innebär inte att öppna frågor är lösta. Se [arkivindexet](../README.md), [systemkartan](../../systemkarta/README.md) och [findings](../../../../docs/findings/README.md) för fortsatt läsning.

# Nodträd, rörelser och riktig OpenClaw-anslutning

Nodträdet finns under **Nodträdet** i det lokala labbet. Fyra dealers delar
16 labbnoder över motorns sex befintliga typer. Startprojektet har fyra
varianter per linje, inklusive standard. Äldre sparade projekt lämnas orörda.

64 tysta 2D-rörelser ligger som JSON i [lab/animations](../../../../lab/animations/README.md).
De är labbexempel, inte riktiga filmer eller godkända takes. Triggers visas
som **spelstyrda** och **sociala/uttryck**. Motorn bestämmer fortfarande kort,
resultat och exakta talrader. [Gränsen mot Kevins logik](../../../../lab/COMPATIBILITY.md).

Director på Render uppdaterades med klartecken till **7f056f7**. Riktiga prov
från lokal Next-server gav giltigt variantval i aktivt läge, standard i
skuggläge och ett riktigt chattsvar. Första rådanropet nådde timeout på
2,5 sekunder; standard-fallback fungerade. Nästa försök lyckades. Ingen
nyckel ändrades. Detta är inte ett bevis på färdig spelarchatt eller spelminne.

**Lokalt:** rotens `.env` innehåller `LAB_REMOTE_URL` (Director-adressen)
och `LAB_REMOTE_TOKEN` (samma befintliga värde som Directors `LAB_API_TOKEN`).
**Render Gateway:** behåller `OPENCLAWAPI_KEY` och `OPENCLAW_MODEL_API_KEY`.
Inga nya nycklar behövs för denna anslutning. [Hela variabelkartan](../../../../_ENVIROMENT-INFO.md).

[Prompt till separat Windows/Cursor-agent](PROMPT-windows-cursor-bash.md).
IDE-agenternas inbox är skild från både denna labbchatt och framtida spelarchatt.
