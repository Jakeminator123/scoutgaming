# S03 · urvalet

## Behåll ett litet träd

```text
Publicerad situation
  → rätt dealer och presentationsbehov
    → standard eller alternativ vars villkor stämmer
      → en take som matchar exakt handling, mål eller talrad
        → uppspelning, annars verifierad reserv
```

Det här är en förklaringsmodell. Den inför inga nya event-id:n eller
runtimefält. `rng`/`show`, linje, variant, trigger och take är användbara
gemensamma ord; de är inte automatiskt exakta servernamn.

## Det labbet faktiskt kan

**Spela vald variant** är manuell preview. **Testa event** använder det sparade
exemplet och vald testkontext. Standard, regler, presentationsslump, shadow
och aktivt modellråd är olika sätt att prova ett urval. Presentationsslump
är skild från spelmotorns RNG.

En kopplad video har ett exakt `videoGenerationId`. En kompatibilitetskontroll
kan neka video för fel exempel och visa variantens 2D-reserv. Den kontrollen
ersätter inte visuell granskning av innehållet.

## Föreslagen första produktkoppling

Välj **en klientväg och ett litet presentationsbehov** med Kevin. Börja med
en läsande vy som visar källhändelse, vald regel, kandidat, faktiskt val och
uppspelningsresultat. Koppla sedan en avgränsad take till befintlig spelare
i en isolerad testmiljö.

Godkända kandidater måste matcha dealer, handling/mål eller exakt talrad.
Om rätt material saknas används befintlig verifierad presentation eller en
tydlig reserv utan dealer-video. Byt aldrig till en inspelad mening bara för
att den har ungefär rätt längd.

Ett manifest beskriver tillgängligt material. Det visar inte ensamt aktiv
backoffice-bindning, spelarens slutliga val eller visuell acceptans.

Nästa: [Acceptans](s04-saker-presentation.md). Källor: [kontrakt och labbprov](RUNTIME-EVIDENCE.md).
