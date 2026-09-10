# Blackjack: spelbar version och redigerbara källor

## Öppna lokalt

- [Spela med den riggade Astrid](http://rigqa.localhost:4197/?dealer=astrid&scene=rigged-review&face=anatomical)
- [Styr rörelser och ansikte](http://127.0.0.1:4196/dealer-studio.html?face=anatomical)
- [Granska exporterad kortinsamling](http://127.0.0.1:4196/collection-export-review.html)

Länkarna kräver de lokala utvecklingsservrarna. Detta är en spelbar granskningsversion. Fotorealistisk slutkvalitet är inte godkänd.

## Redigera i Blender

- `assets/blackjack-3d/editable-project/anatomical/astrid-blackjack-editable.blend`: korrigerad dealer, bord, gemensam kamera och fotografisk rumsreferens. Tolv ursprungliga rörelsestudier; den nya sammanhängande insamlingen finns i det separata projektet nedan.

- `assets/astrid-3d/anatomical/astrid-animated.blend`: dealer, material, ansiktsformer och tolv kroppsrörelser. Välj rörelse i Action Editor. Hand- och fotkontrollernas IK-egenskap aktiverar manuell styrning; fingrarna har separata ben.
- `assets/astrid-3d/collection-sweep/astrid-collection-sweep.blend`: tretton kroppsrörelser och sexton separat redigerbara provkort. Insamlingen ligger på den aktiva tidslinjen.
- `assets/astrid-3d/anatomical/astrid-goodluck.blend`: kalibrerat tal med originalets ljud inbäddat och de tolv kroppsrörelserna bevarade.
- `assets/astrid-3d/anatomical/astrid-face-source.blend` och `assets/astrid-3d/astrid-source.blend`: bevarade ansikts- och kroppskällor.

GLB-filerna med samma namn exporterar respektive animation med inbäddade material och texturer. Blender-kontrollerna finns i de redigerbara projekten; GLB innehåller rigg och bakad animation.

## Vad som är kontrollerat

Den korrigerade geometrin bevarar topologi, hudvikter och befintliga kroppsrörelser. De packade projekten har öppnats igen. Talets 121 ursprungsbilder överensstämmer med det kalibrerade projektet; talexporten börjar vid noll sekunder. Insamlingens 268 bildrutor överensstämmer mellan rörelsedata och GLB. Studions käkreglage, återställning och visning har kontrollerats i webbläsaren.

## Kvar till slutmålet

Ansikte och hår ser fortfarande datorgenererade ut. Bakre hår- och kläddetaljer har kvar synliga brister. Den senaste modellens sjusitsrunda passerade: 1 000 → 965 → 1 035 demokrediter, 18 kort samlades till en hög och lades i korthållaren. Alla 17 Astrid-repliker spelades två gånger; de fyra vanliga dealerlägena klarade två hälsningar var. Inspelningen är ljudlös. Full visuell fonemgranskning, ljudbedömning och fysiska telefoner återstår; på 390 px är dealer och kort för små. Numeriska tester innebär inte att realismmålet är uppnått.
