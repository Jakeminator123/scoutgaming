# OpenClaw-underlag och separat labb

Det körbara experimentet på Jakobs begäran finns i [lab/](lab/README.md):
lokal editor, fryst Croupier-eventkontrakt, enkla animationer, OpenClaw-adapter
och Render-blueprint. Starta med `npm --prefix open-claw/lab start`.
Det är ännu inte inkopplat i den vanliga spelklienten.

För agenter och konfiguration: börja med
[den korta README:n om dokumentation vid behov](lab/docs/README.md).

> **V2-referens, inte del av V3:s 9-dagars MVP.** Paketet är fryst som historiskt implementationsunderlag. Aktiv riktning finns i `docs/animation-events/v3-9-days-mvp/`; där är OpenClaw uttryckligen ett möjligt experiment efter MVP och kräver ett separat Kevin-beslut.

Den här mappen samlar dokumentationsunderlag för en möjlig OpenClaw-integration i Croupier. Inget här är inkopplat i spelets runtime.

## Innehåll

- `openclaw_croupier/` är det uppackade innehållet från `openclaw_croupier.zip`.
- Paketets 22 manifestlistade filer har verifierats mot `MANIFEST.sha256` utan avvikelser.
- `openclaw_croupier/KOMPLETTERING-FRAN-GENERISK.md` är ett separat, lokalt tillägg med relevanta slutsatser från `openclaw_generisk.zip`. Själva generiska paketet har inte kopierats in.

## Proveniens

- Croupier-arkiv: `openclaw_croupier.zip`
- SHA-256: `34D8F362D760586F72DA93C6EB9DD46E90C6B3D8E3BF1513551536EB425E0903`
- Generiskt referensarkiv: `openclaw_generisk.zip`
- SHA-256: `D82B26C3C6A0EBAA24A334EA6A219549C4C175E710A2FF933D51795976AC752B`

Dokumenten är besluts- och implementationsunderlag. Partner-API, körande Croupier-kod och den aktuella gemensamma animation-events-dokumentationen är fortfarande facit när en verklig integration påbörjas.
