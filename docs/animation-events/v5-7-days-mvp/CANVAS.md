# V5 · publicera wikin utan webbbygget

**Visningsnamn: Croupier · Presentationsplan V5. Planeringsram: sju dagar efter D0.**

Källan är `docs/animation-events/v5-7-days-mvp/` i Croupier. GitLab-wikin är
den primära publicerade läsytan. Den separata GitHub/Vercel-webben är en äldre
publik presentation och ska inte byggas, skrivas om eller stängas av wikisynken.

## Publicera den aktuella källan

Använd ett separat, rent worktree för `croupier.wiki.git`:

```powershell
node tools/sync-animation-events-wiki.mjs --wiki WIKI_PATH --write
node tools/sync-animation-events-wiki.mjs --wiki WIKI_PATH
git -C WIKI_PATH diff --check
```

Verktyget:

- läser endast den kanoniska Markdown-källan i Croupier;
- skriver Markdown, korta hänvisningssidor för äldre V5-adresser och
  `animation-events/SYNC-MANIFEST.md` i wiki-worktreet;
- skriver källcommit och SHA-256 för varje synkad källfil;
- anpassar interna länkar till wikin och länkar övrig repodokumentation till
  det exakta Croupier-committet;
- gör inga nätanrop, commits eller pushar och rör inte webb-repot.

Efter push: öppna den faktiska wikin som inloggad användare och kontrollera
startsida, sidomeny, minst en korslänk, en äldre hänvisningsadress och
synkkvittot. Hashparitet bevisar textversionen, inte rendering, godkänd video
eller driftsatt produktintegration.

## Den separata webbplatsen

[animation-events-v1.vercel.app](https://animation-events-v1.vercel.app/) är
fortfarande publik och visar åttadagarsversionen från 21 september. Dess unika
funktioner är fliknavigation, sök, hash-djuplänkar, mobil- och utskrifts-CSS samt
HTML-snapshots av V2–V4. GitLab-wikin har i stället Markdown-navigation,
versionshistorik och kommentarer men kräver inloggning.

Webb-repots Vercel-bygge kör `tools/sync-docs.mjs`, som fortfarande har
`docs/animation-events/v5-8-days-mvp` hårdkodat och skriver både GitHub-trädet
och wiki-worktreet. Ett vanligt webbygge är därför inte en säker wikipublicering.
Ingen Croupier-runtime är beroende av webbplatsen; förekomsterna är
dokumentationslänkar.

Rekommendationen är att först ersätta webbplatsen med en liten hänvisningssida
till wikin, eftersom en total avstängning samtidigt tar bort den enda publika,
inloggningsfria läsytan och de unika webbfunktionerna. Gör inget av detta utan
ett uttryckligt beslut. Behåll repo, domänkoppling och Vercel-projekt tills
beslutet har verifierats; då kan den senast kända webbrevisionen återdeployas
som rollback.

## Gränser

V4 och äldre texter bevaras som daterad historik. Aktiva startsidor pekar på V5.
Wiki-publicering ändrar inte Bettalottos driftsättning, produktmanifest,
OpenClaw-konfiguration, sparade labbprojekt eller Jira CAC-status. Media,
råloggar, personuppgifter och API-hemligheter publiceras inte.
