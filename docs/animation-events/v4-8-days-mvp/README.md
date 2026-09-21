> **Historik:** ersatt av [V5](../v5-8-days-mvp/README.md) den 21 september 2026.
> Uppgifterna nedan beskriver V4:s då granskade revision; använd V5 för dagens arbete.

# Croupier · V4 · åtta arbetsdagar

> **Målet:** kunna följa vad spelet publicerar, hur en kompatibel presentation
> väljs och vad spelaren faktiskt visar. Åtta dagar är Jakobs aktuella
> planeringsram, inte ett tidigare mötesbeslut eller ett löfte om produktlansering.

**Vad hände → vad ska presenteras → vilket material passar → vad spelades?**

V4 ersätter V3 som aktiv förklaring och plan. Den befintliga spelmotorn är
grunden. Labbfunktioner, produktfunktioner och kommande arbete får egna etiketter:
**Finns i kod · Finns i labbet · Föreslås · Inte liveverifierat**.

## Läs på fem minuter

1. [Helheten](s00-helheten.md) — fyra steg, tre ansvariga.
2. [Systemkartan](s01-kartan.md) — två klientvägar och rätt källa.
3. [Signaler in och ut](s02-spraket.md) — spel, text, kontext, media och konfiguration.
4. [Urvalet](s03-eventtradet.md) — från en verklig situation till rätt take.
5. [Uppspelning och acceptans](s04-saker-presentation.md) — vad som måste bevisas.
6. [Ordlistan](s05-ordlista.md) — de få ord vi behöver.
7. [Åttadagarsplanen](s06-plan.md) — en leverans och en kontrollpunkt per dag.

## Gemensamma ytor

- [Wikin](https://gitlab.com/scout-gg/croupier/-/wikis/home) är teamets läsbara dokumentation.
- [Webbpresentationen](https://animation-events-v1.vercel.app/) visar samma V4 visuellt.
- [GitHub-repot](https://github.com/Jakeminator123/animation-events-v1) bygger webbplatsen.
- Croupier `docs/animation-events/v4-8-days-mvp/` är den redigerbara V4-källan.

**Croupier · Presentationsplan** är presentationens namn. `animation-events-v1` i
adresserna är ett historiskt projektnamn; det anger varken innehållsversion eller
spelversion. Se [publiceringsflödet](CANVAS.md).

## Fördjupning vid behov

[Beslut och avgränsning](DECISIONS.md) · [Källor och verifieringsgräns](RUNTIME-EVIDENCE.md)

V4 är kontrollerad mot lokal kod den 20 september 2026. Aktuell serverrevision,
behörig testsession och aktiva backoffice-kopplingar återstår att kontrollera.
V4-dokumentationen installerar ingen ny adapter och godkänner ingen media.
