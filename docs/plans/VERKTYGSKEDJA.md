# Verktygskedjan för Admin och lobbyn (steg H)

Plan för steg **H** i [ADMIN-FORENKLING §9](ADMIN-FORENKLING.md#9-leveransordning). Skriven 29 oktober 2026 mot `main` `312d8d5c91`. Siffror och radnummer gäller den SHA:n; läs om koden innan något byggs. Raderas när det valda alternativet är byggt och verifierat i drift.

## 1. Läget

`/admin` och `/lobby` är inga Next-sidor. De är en egen esbuild-SPA i `apps/studio/client` med egen `package.json`. Next-routen `app/admin/[[...path]]/route.ts` serverar det färdiga bygget från disk (`design-preview-build/`, spårat i `outputFileTracingIncludes`). Admin-bundlen har 236 egna källfiler: 70 i `client/admin`, 55 delade komponenter i `apps/studio/components`, 36 moduler i `apps/studio/lib` och 73 i `packages/*`.

**Redan gjort (PR:en `jakob/claude-client-toolchain`):** `client` har samma React, react-dom och `@types` (19.3.0), esbuild (0.28.2) och TypeScript (7.0.2) som `apps/studio`, och det oanvända `next-themes` är borttaget. Det som återstår är stylingen:

| | Admin (`client/admin`) | Lobby (`client/lobby`) | Next-sidorna (`/partner`, inloggning) |
| --- | --- | --- | --- |
| Tailwind | **v4.1.9** sedan A3 (`@theme` i `admin/app/globals.css`, `tw-animate-css`; ingen `tailwind.config.ts`, inget `tailwindcss3` eller `tailwindcss-animate`) | **v4.1.9** (`@tailwindcss/postcss`, `tw-animate-css`) | ingen |
| Tokens | `admin/app/globals.css` (shadcn-HSL, nästan oanvända: 54 klassträffar) + `admin/app/studio.css` (`--sg-*`, 44 namn) | `lobby/app/globals.css` (oklch, egen palett) | `app/scout-theme.css` (`--sg-*`, 38 namn) + `components/partner/partner-portal.css` och `partner-workspace.module.css` (egna `--bg/--surface`) |
| Mörkt läge | `studio.css` följer **OS** (`prefers-color-scheme`); `index.html` sätter ändå `class="dark"`, vilket bara styr de nästan oanvända shadcn-tokens | `.dark`-klass | `html[data-theme]` från `localStorage['sg-theme']`; partnerportalen har ett eget val `sg-partner-theme` |
| CSS-moduler | 28 komponenter, 22 `*.module.css` i `apps/studio/components`, byggda av esbuild till `admin/app.css` | – | samma moduler, byggda av Next |

Samma `--sg-*`-namn har alltså olika värden (34 gemensamma namn, 4 bara i `scout-theme.css`, 10 bara i `studio.css`), och mörkt läge styrs på fyra sätt. Det är därför samma komponent ser olika ut i Admin och i Partnerportalen.

## 2. Alternativ A: behåll SPA:n, en Tailwind v4, en tokenfil, ett mörkt läge

### Vad som görs

1. **Tokenfil.** `packages/ui/tokens.css`, ett nytt rent CSS-paket, utan JavaScript. Varför där och inte i `apps/studio/app`: filen ska läsas av både Next (`app/layout.tsx`) och esbuild-bygget (`client/build.mjs`), och `packages/*` är redan repots plats för sådant som två byggen delar (`packages/navigation`, `packages/presentation`). Ett eget paket gör också ägarskapet tydligt: designtokens ändras på ett ställe, med ett eget prov. Filen innehåller `--sg-*` i ljust läge på `:root` och mörkt läge under `:root.dark` (se punkt 3), med `studio.css` som utgångspunkt eftersom Admin är den största konsumenten. De fyra namnen som bara finns i `scout-theme.css` flyttas med. `scout-theme.css` och `studio.css` behåller bara layout och komponentregler och importerar tokenfilen.
2. **Tailwind v4 för Admin.** `tailwind.config.ts` (155 rader, 608 `sg-*`-klassträffar) blir ett `@theme`-block i `admin/app/globals.css`. shadcn-HSL-paletterna `sidebar`, `workflow` och `chart` används inte i klasser och tas bort; de få `muted-foreground`/`border`-klasserna mappas på `--sg-*`. `tailwindcss-animate` byts mot `tw-animate-css`, som redan används av lobbyn och har samma klassnamn (`animate-in`, `fade-in-0`, `zoom-in-95`, `slide-in-from-*`: 15 träffar). Därefter tas `tailwindcss3` och `tailwindcss-animate` bort, och `build.mjs` får en enda PostCSS-väg för båda ytorna.
3. **Mörkt läge.** Ett beslut, en mekanism: **klass på `<html>`, inte OS.** `class="dark"` (Tailwind v4: `@custom-variant dark (&:where(.dark, .dark *))`) sätts av ett startskript som läser ett enda val i `localStorage` (`sg-theme`) och faller tillbaka på ett **fast** standardläge, inte på `prefers-color-scheme`. Next-layouten byter från `data-theme` till samma klass. Partnerportalens `sg-partner-theme` och `data-theme`-väljarna i `partner-portal.css`/`partner-workspace.module.css` byter till samma tokenfil i ett senare steg (`apps/studio/components/partner/partner-portal.css` och `components/partner-workspace.module.css`). Vilket läge som är standard är ett **Jakob-beslut** (se §5); den raderade skissen `ADMIN-MALBILD-PROTOTYP.html` var ljus ([HISTORIK](../HISTORIK.md)).

### Filer som rör sig

`packages/ui/tokens.css` (ny), `apps/studio/app/scout-theme.css`, `apps/studio/app/layout.tsx`, `apps/studio/client/admin/app/{globals,studio}.css`, `client/admin/tailwind.config.ts` (raderas), `client/build.mjs`, `client/package.json` + lås, `apps/studio/tools/watch-design-preview.mjs` (bevaka `packages/ui`), `client/admin/components/ui/*.tsx` (bara om en klass byter namn, se risker), senare `components/partner/partner-portal.css` och `components/partner-workspace.module.css`.

### Risker

- **Tailwind v4 byter skala på några verktyg:** `shadow-sm`→`shadow-xs`, `shadow`→`shadow-sm`, `rounded-sm`→`rounded-xs`, `rounded`→`rounded-sm`, `blur-sm`→`blur-xs`, `outline-none`→`outline-hidden`, och `ring` är 1 px i stället för 3 px. Det finns cirka 200 sådana träffar i `client/admin`. Uppgraderingsverktyget (`npx @tailwindcss/upgrade`) skriver om dem, men det rör alla komponentfiler och får inte köras medan andra PR:er arbetar i `client/admin/components/**`. Lös det genom att köra verktyget i en egen PR i ett lugnt fönster, eller genom att behålla den gamla skalan med `@theme`-överskrivningar så att inga klasser ändras.
- **Standardfärg på kanter:** v4 använder `currentColor` i stället för `gray-200`. Lägg en bas-regel `*, ::before, ::after { border-color: var(--sg-border) }` så att inget ändras visuellt.
- **Byte från OS-styrt till fast läge:** den som i dag har mörkt OS-läge ser Admin bli ljust (eller tvärtom). Det är avsiktligt, men det ska stå i PR:en och Jakob ska ha sett skärmbilder.
- **Sammanslagna tokens ändrar Partnerportalen:** `scout-theme.css` är mörk som standard. Om standardläget blir ljust byter alla Next-sidor utseende. Det är en visuell ändring som kräver Jakobs godkännande.
- **CSS-moduler:** de 22 `*.module.css` läser `--sg-*` (23 komponenter). De påverkas av nya värden men byggs oförändrat.

### PR-sekvens

| PR | Innehåll | Klart när |
| --- | --- | --- |
| **A1 tokenfil** | `packages/ui/tokens.css` med dagens `studio.css`-värden; `build.mjs` läser in den före `studio.css` (Tailwind 3-vägen löser inte `@import`, filerna slås ihop som text i dag); `watch-design-preview.mjs` bevakar `packages/ui`; `scout-theme.css` oförändrad | `admin/theme.css` har samma deklarationer före och efter, och diffen visar bara flyttade rader (se §7); `admin`-sviten grön |
| **A2 ett mörkt läge** | klass i stället för OS; startskript i `index.html` och `layout.tsx`; `scout-theme.css` importerar tokenfilen och tappar sina egna `--sg-*` | Admin och `/partner` visar samma färg för samma token i båda lägena; valet sparas; skärmbilder ljust/mörkt till Jakob |
| **A3 Admin på Tailwind v4** (gjort, PR #582) | `@theme` i stället för `tailwind.config.ts`, `tw-animate-css`, skalan låst med `@theme`-överskrivningar så att inga klasser i komponenterna ändras; `tailwindcss3` och `tailwindcss-animate` bort | `prepare-design-preview` grönt, en version av `tailwindcss` i `client/package-lock.json`, `admin-kit-browser`-provet grönt, skärmbildsjämförelse av fem sidor utan avvikelser |
| **A4 Tailwind-uppgradering** | `tailwindcss`/`@tailwindcss/postcss` 4.1.9 → senaste 4.x (4.3.3 i dag, samma som `apps/web`) | bygget grönt, `theme.css` ändras bara i ordning/kommentarer |
| **A5 partnerportalen** (efter steg G) | `partner-portal.css` och `partner-workspace.module.css` byter `--bg/--surface/...` mot `--sg-*`; `sg-partner-theme` blir `sg-theme` | en tokenfil i hela `apps/studio`; `git grep -- '--surface:'` hittar bara `tokens.css` |

**Uppskattning: 4 PR:er (A1–A4) + 1 efter steg G.** Ungefär 2–3 dagars arbete med skärmbilder, låg risk för data och behörighet (bara CSS och bygg).

## 3. Alternativ B: Admin blir Next-sidor och esbuild-SPA:n pensioneras

### Vad som krävs

1. **Routning.** `app/admin/[[...path]]/route.ts` (en route handler) kan inte ligga bredvid en `page.tsx` på samma sökväg. Den byts mot `app/admin/[[...path]]/page.tsx` som renderar dagens `App` som klientkomponent (`'use client'`), eller mot riktiga undersidor (`app/admin/dealers/page.tsx`, ...). Assets (`/admin/_assets/**`) och `chat-import.js`, som `public/assistant-widget.js` laddar från `/admin/_assets/admin/chat-import.js`, behöver en egen väg.
2. **`/admin/_data/catalog`.** Next ignorerar mappar som börjar med `_` (privata mappar). Katalogen kan alltså inte bli `app/admin/_data/catalog/route.ts`; den måste bli `app/admin/%5Fdata/catalog/route.ts` eller flytta till `/api/admin/catalog` (med `client/admin/lib/connected-studio.mjs`, `lobby/lib/catalog.mjs` och deras prov).
3. **Navigation-shimmarna.** `client/runtime/navigation.tsx` ersätter `next/link` och `next/navigation` med `studioHistory` (`lib/studio-history.mjs`): smutsspärrar (`canNavigate`), dokumentnavigering in i och ut ur `/admin/system` så att formulärens `beforeunload` körs, och återställning vid bakåt. Next 16 integrerar `window.history.pushState` i routern, men spärrarna och undantaget för System måste byggas om ovanpå Nexts router. Det är den största enskilda risken: det är just där utkast går förlorade.
4. **keepMounted i `entry.tsx`.** Dealers, Scenmallar, Bolag och System, och klippkartan, hålls monterade efter första besöket så att utkast och formulär överlever menybyten. Next bevarar sidor med `<Activity>` bara med `cacheComponents: true`, och då **högst 3 rutter**; den fjärde återställs. Det räcker inte för dagens 5 bevarade ytor. Mönstret behöver då ligga kvar i en gemensam `app/admin/layout.tsx` (en layout byts inte vid navigering), vilket i praktiken betyder att SPA:n flyttas in i en layout, inte delas upp i sidor.
5. **Hot reload.** Vinsten: `next dev` bygger om `/admin` direkt, och `npm run dev:client` och `watch-design-preview.mjs` försvinner. Men `next dev` kör i dag med `--webpack`; webpack-läget måste klara de 236 källfilerna inklusive `packages/*` (`experimental.externalDir` finns redan).
6. **Bygget.** `design-preview-build` lämnar `outputFileTracingIncludes` för `/admin/[[...path]]`; `prepare-design-preview.mjs` bygger bara lobbyn. `check-build-traces.mjs` och `design-preview.test.mjs` skrivs om. CSP:n i `lib/design-preview.mjs` (`script-src 'self'`, ingen inline) gäller inte längre automatiskt för Admin; samma rubriker måste sättas i `proxy.ts` eller i `next.config.mjs`, annars försvagas skyddet.
7. **Tailwind.** Next har ingen Tailwind i dag. Admin-klasserna kräver Tailwind i Next, alltså `postcss.config.mjs` och `@tailwindcss/postcss` i `apps/studio`, vilket i sin tur kräver alternativ A:s Tailwind v4-steg först. **B förutsätter alltså A1–A3.**
8. **Prov.** 36 provfiler buntar klientkod med `client`s esbuild (`createRequire('../apps/studio/client/package.json')`). De fortsätter fungera om `client/package.json` finns kvar för lobbyn, men de som provar Admin-routern (`navigation.test.mjs`, `admin-routing.test.mjs`, `studio-history.test.mjs`, `next-page-navigation.test.mjs`, webbläsarproven `admin-*-browser.test.mjs`) skrivs om.
9. **Lobbyn.** `/lobby` (publik, egen CSP, egen katalogadapter) kan ligga kvar som esbuild-bygge. Då finns `apps/studio/client` kvar ändå, med Tailwind v4 och React, och B tar bara bort halva paketet.

### Filer som rör sig

`app/admin/**` (route → page/layout), `client/admin/entry.tsx` (flyttas in i layouten), `client/runtime/navigation.tsx` + `admin-routing.mjs` + `lib/studio-history.mjs`, `client/admin/**/*.tsx` (alla `@/`-alias och `next/link`-shimmar), `lib/design-preview.mjs`, `lib/design-preview-catalog.mjs`, `next.config.mjs`, `proxy.ts`, `package.json` (Tailwind, `dev:client` bort), `tools/prepare-design-preview.mjs`, `tools/watch-design-preview.mjs`, `public/assistant-widget.js`, cirka 15 provfiler och CI-steget som installerar `client`.

### Risker

- Utkast och osparade formulär går förlorade vid menybyte om keepMounted eller spärrarna blir fel. Det är det sparande- och samtidighetsbeteende som AGENTS.md säger att proven ska skydda.
- CSP och `Cache-Control: private, no-store`, som `design-preview.mjs` sätter i dag, måste återskapas exakt.
- `/admin` och `/partner` delar då `app/layout.tsx` och `scout-theme.css`; tokenkonflikten blir synlig direkt i stället för att lösas.
- Stort ingrepp i `client/admin/**`, som flera agenter arbetar i samtidigt. Kräver frysning av Admin-UI under migreringen.

### PR-sekvens

| PR | Innehåll | Klart när |
| --- | --- | --- |
| B0 | A1–A3 (tokenfil, ett mörkt läge, Tailwind v4) | som i §2 |
| B1 | Tailwind v4 och `postcss.config.mjs` i `apps/studio`; `tokens.css` i `layout.tsx` | `next build` grönt; `/partner` oförändrad |
| B2 | katalogen flyttas till `/api/admin/catalog` (gamla adressen svarar 308) | `design-preview-catalog`-proven gröna mot ny väg |
| B3 | `app/admin/layout.tsx` + `[[...path]]/page.tsx` med `App`; navigationen på Nexts router med `studioHistory`-spärrarna kvar | alla `admin-*-browser`-prov gröna; utkast överlever byte mellan alla fem bevarade ytor och bakåt/framåt |
| B4 | CSP och cache-rubriker för `/admin` i Next; `chat-import.js` som statisk fil | rubrikerna lika före och efter (prov); assistentwidgeten importerar |
| B5 | esbuild-vägen för Admin bort: `build.mjs` bygger bara lobbyn, `dev:client` bort, spårningsraden bort | ren klon: `npm ci && npm run build` grönt; `/admin` hot reloadar i `next dev` |

**Uppskattning: 3 PR:er för B0 + 5 PR:er, alltså 8.** Ungefär 1,5–2 veckor, med medelhög risk för sparande och behörighetsrubriker, och Admin-UI fryst under B3–B5.

## 4. Rekommendation

**Gör A nu. Ta inte B förrän det finns ett konkret behov som bara Next ger.**

- A löser det som faktiskt syns (samma komponent med olika färger, fyra mörka lägen, två Tailwind) med ändringar som nästan bara rör CSS och bygget, och utan att stoppa arbetet i `client/admin/components/**`.
- B ger hot reload och ett paket mindre, men lobbyn behåller esbuild ändå, Nexts `<Activity>` bevarar bara 3 rutter mot Admins 5, och omskrivningen av navigationen rör exakt det sparande- och utkastbeteende som är svårast att prova. Den största vinsten, hot reload, finns redan till största delen genom `npm run dev:client`.
- A är dessutom första tredjedelen av B. Inget i A är bortkastat om B blir aktuellt senare.

Ompröva B om något av följande inträffar: Admin behöver serverkomponenter eller strömmad data från Neon, `dev:client` blir ett faktiskt hinder för flera utvecklare, eller React/Next kräver ett gemensamt bygge (till exempel React Compiler i båda).

## 5. Beslut som behövs från Jakob

1. **Standardläge** när inget val är sparat: ljust (målbildsskissen) eller mörkt (dagens `scout-theme.css` och lobbyn). Ett val i menyn för att byta finns i båda fallen.
2. **Ska Partnerportalen och Admin dela läge** (`sg-theme`), eller ska bolaget ha ett eget val? Planen förutsätter ett gemensamt val.
3. **Tailwind-skalan i A3:** lås den gamla skalan (ingen komponentändring, rekommenderas) eller kör uppgraderingsverktyget över `client/admin/**` (renare, men kräver kodfrysning en dag).

## 6. shadcn och shadcnblocks: när blir det meningsfullt?

**I dag: nej.** Kitet i `client/admin/components/ui/{kit,hub,dialog,menu,command,toast,chart,data-table}.tsx` är handkopierat och shadcn-likt, men det finns ingen `components.json` någonstans i repot, Admin kör Tailwind 3, och komponenterna läser `--sg-*` och inte shadcns `--background/--primary/...`. Block från shadcn eller ett blockbibliotek skulle komma med shadcn-tokens och Tailwind 4-klasser och hamna i en tredje stil bredvid de två som redan finns.

**Efter A3 blir shadcn meningsfullt.** Med Tailwind 4 och en tokenfil kan `client/admin` få en riktig `components.json` (stil `new-york`, `tailwind.css` = `admin/app/globals.css`, alias `@/components/ui`), och shadcns semantiska namn (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--ring`, ...) **definieras som alias** till `--sg-*` i `tokens.css`. Då ser en komponent från `npx shadcn add` ut som resten av Admin utan handpåläggning. Gör det som en egen PR (A6) efter A3: `components.json`, aliasen och en befintlig kitkomponent (till exempel `dialog.tsx`) ersatt med shadcns version som bevis.

**shadcnblocks-API:t, ärligt:** det hjälper, men först efter A3 och A6, och mindre än man kan tro.

- Blocken är mest **marknadsförings- och landningssidor** (hjältesektioner, prislistor, funktionsrutnät, sidfötter) och en mindre del **applikationsblock** (inloggning, inställningar, instrumentpaneler, tabeller). För Admin är det bara applikationsblocken som är relevanta, och de motsvarar sidor som redan finns.
- Blocken är skrivna för Next med `next/link`/`next/image` och shadcn-tokens. I SPA:n fungerar de genom de befintliga shimmarna (`client/runtime/navigation.tsx`, `image.ts`), men varje block måste ändå granskas: inga externa bilder (Admins CSP tillåter bara `'self'`), svensk text, och data från våra API:er i stället för exempeldata.
- Där det verkligen kan spara tid: **`apps/web`** (den publika startsidan, Next 15 och redan Tailwind 4, P3 i ADMIN-FORENKLING) och **lobbyn** (Tailwind 4, presentationsyta). Där passar landningsblock direkt, och `apps/web` kan få en `components.json` redan i dag.
- Det som gör Admin enklare är steg D (en publicering) och färre steg i flödena, inte nya block. Block löser utseende, inte antalet klick.

## 7. Verifiering för varje PR

- `node apps/studio/tools/prepare-design-preview.mjs` (typkontroll av admin och lobby + bygge).
- `sh .githooks/pre-commit-full admin` och `node --test apps/studio/test/watch-design-preview.test.mjs apps/studio/test/design-preview.test.mjs`.
- För CSS-PR:er: spara `design-preview-build/{admin,lobby,public-lobby}/theme.css` och `admin/app.css` före ändringen och jämför efter. A1 ska ge identiska filer; A2–A3 ska bara ändra det PR:en säger.
- Skärmbilder av Översikt, Dealers, ett dealernav, Bolag och System, ljust och mörkt, till Jakob före merge av A2 och A3. Kodtest ersätter inte den visuella acceptansen.
