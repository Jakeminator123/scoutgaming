# Visuell riktning för Admin och Partnerportalen

> Jakobs beslut 2026-10-29: Johns färgtema och visuella riktning blir produktens. Källa: Johns skiss `random/n2-skiss-john/index.html` (gren `john`, 47af5385f) och issue #9 (kommentar 2026-10-10). Skissen är inspiration och dess namn är legacy; koden och [TERMINOLOGI](../../apps/studio/docs/TERMINOLOGI.md) vinner. Ord här: bolag, spelbord, miljö, tilldelning.

## Skal och sidmall

- **Ett skal för båda nivåerna** (Admin och bolagets portal): sidomeny 248px, mörk i båda lägena. Gruppetiketter i mono-versaler; aktivt val = ljusare yta + 4px limekant till vänster.
- **En sidmall**: eyebrow (mono 11px, versaler) → titel (Space Grotesk 30px) → ingress → åtgärder till höger → flikar. Högst två flikrader.
- **En plats per uppgift.** Detaljer öppnas i sidopanel 460px; modal bara för bekräftelse.
- **Väntande** syns som räknare i menyn och som lista på Översikt.
- **Låsta val** (utanför bolagets tilldelning) visas avstängda med "Låst av Scoutgaming".
- **Förhandsvisning per enhet** (dator, platta, mobil) där spelbord och miljö visas.
- **Mobil**: menyn blir en låda, 16px gutter.

## Typsnitt

- Brödtext Inter 14px/1.5 (`--sg-font-sans`), rubriker Space Grotesk (`--sg-font-display`), siffror och ID i JetBrains Mono (`--sg-font-mono`) med tabellsiffror.
- Tokenfilen laddar inga webbfonter, bara systemreserver. Next har egna filer via `--sg-next-*`; Admin läser alla tre ur sina egna filer (`client/runtime/preview.css`, rubrikerna sedan kitet i [DESIGNSYSTEM](DESIGNSYSTEM.md)).

## Färg

- Färg bara via `--sg-*` i [packages/ui/tokens.css](../../packages/ui/tokens.css). Mörkt läge är standard, ljust ett val (Johns paper-bas #F2F1ED).
- Lime #D6FF3A bara som knappfyllning (text #0A0B0D). Accenttext: lime i mörkt läge, olivgrön #4A6200 i ljust. Fokusring och vald markering: `--sg-mark` (≥3:1, prov vaktar).
- Statusar i pastell, dämpade i mörkt läge: brickor med prick och text.
  - Live: `--sg-live-*` · Pausad: `--sg-warn-*` · Granskas: `--sg-info-*`
  - Utkast: `--sg-chip-text` på `--sg-surface-2` · Inte anslutet: samma neutrala par, ihålig prick
  - Fel: `--sg-danger-*`
- Kontrast: text ≥4,5:1 och markering ≥3:1 i båda lägena (`apps/studio/test/ui-tokens.test.mjs`).

## Komponenter

- Kort: radie 10px, 1px ram (`--sg-border`), ingen tung skugga.
- Täta tabeller: 13px, siffror högerställda i mono.
- Filter som chips; tomläge med streckad ram, en mening och en knapp.
- Komponenterna finns i kitet, se [DESIGNSYSTEM](DESIGNSYSTEM.md).

## Ordning

1. Tokens och denna riktning (denna PR). 2. Skalet och sidmallen appliceras på Admin och portalen. 3. Webbfonter laddas i båda byggena.
