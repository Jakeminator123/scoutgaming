# 08 — Mobile Phone Lane på /blackjack

## Syfte, beslut och avgränsning

Jakob beställde först en plan och därefter uttryckligen implementation den
4 oktober 2026. **Mobile Phone Lane** är namnet på den befintliga
Astrid/Lissabon-strömmen med video, chatt, tal och läppsynk. Den offentliga
adressen ska vara **https://www.scoutgaming.tech/blackjack**. Det tidigare
agentförslaget `/blackjack/mobile-phone` är ersatt av detta beslut.

Min bedömning: ett gemensamt Studio-val och en sessionskontrollerad ingång är
rätt avgränsning. Vi återanvänder spelaren, kontoidentiteten och policyflödet.
Ingen ny videomotor, kontomigration, provideraktivering eller prisutredning
behövs. Namnet innebär inte godkänd fysisk mobil-/Safari-acceptans.

## Implementerat beteende

| Ingång eller val | Beteende |
| --- | --- |
| Hemsidans Blackjack-knapp och ren `/blackjack` | Öppnar lanen som är sparad i Studio |
| Mobile Phone Lane | Astrid med befintlig `presentation=local`, chatt, tal och läppsynk |
| Original Lane | Befintlig originalspelare med Vera som standard |
| Utloggad/utgången session | 303 till `/player-login`, tillbaka till `/blackjack` efter lyckad login |
| Redan inloggad | Samma befintliga konto används direkt |
| Gammal `?dealer=astrid&presentation=local` | Fortsätter öppna Mobile Phone Lane |
| Explicita dealer-, rehearsal- och presentationslänkar | Behåller sina val; inga öppna returadresser eller privilegieparametrar |
| Byte i Studio | Gäller nästa sidöppning; en laddad hand/talström byter inte lane |

Studio-valet finns under **Backoffice → Spel, lanes & bord → Spel och lanes**.
Administratören väljer och trycker **Spara aktiv lane**. En vanlig spelare
kan inte ändra den globala inställningen. Den befintliga revisionen krävs;
en samtidig inaktuell skrivning avvisas. Ingen inställning sparas vid vanlig
visning. Saknat `gameLane` behåller Original Lane tills ett uttryckligt save.

Ren login följer det senast sparade valet när spelet öppnas. Explicita
lane-/dealerlänkar behåller sitt val genom login. Det är ett medvetet enkelt
beteende; den tidigare planens förslag om att frysa globalt default under
hela lösenordsflödet införs inte.

## Källor

- [Publik lane-katalog](../../web/public/game-lanes.mjs) och
  [routekontrakt](../../web/public/game-entry-contract.mjs).
- [Frontend-ingång](../../apps/croupier-frontend/lib/server-ui.mjs),
  [Render-ingång](../../web/server.mjs) och
  [befintlig login](../../web/public/blackjack-entry.mjs).
- [Studio-val](../../lab/components/studio-administration.tsx),
  [adminåtgärd](../../lab/lib/studio-admin-data.mjs),
  [policykontrakt](../../web/storage/studio-contract.mjs) och
  [gemensam policy](../../web/storage/studio-game-policy.mjs).
- [Spelarens val](../../web/public/app.mjs) och
  [dealerbyte](../../web/public/dealer-version-switcher.mjs).

`administration.gameLane` är ett validerat additivt JSON-fält i den befintliga
Neon-policyn. Frontend och Render läser samma publika policyprojektion.
Autentiseringen kontrolleras innan spel-HTML lämnas ut. Vid backendfel visas
ett hanterat 503-svar i stället för en oautentiserad spelvy.

Det interna `lissabon-stream-lane` behålls för profiler, providers och gamla
kvitton. Ingen global namnändring eller omgenerering av godkända medier görs.

## Verifiering och leverans

Riktade tester täcker Studio-behörighet/save/revision, gemensam läsning,
login och utgångna sessioner, säkra URL-val, gamla länkar och alla fyra dealers.
Lane-proven ingår i befintlig pre-commit. Frontend och Studio bygger lokalt;
frontendens byggspår innehåller båda HTML-dokumenten och den nya lane-modulen.
`audit-dealer-sync.mjs --probe` passerar för alla fyra dealers. Befintliga
mänskliga mediegap består; en oförändrad baseline är inte ny läppsynkapproval.
Godkänd tidigare uppspelningsacceptans återanvänds för oförändrad spelarmotor,
ljud/video och providerkod; denna ändring provas som routing/login/policy.

Releaseordning: publicera sammanhängande kod, invänta rätt SHA på Render och
båda Vercel-projekten, spara Mobile Phone Lane i Studio och verifiera faktisk
ren speladress samt utloggad login. Spara inte det nya fältet medan gamla
Render-versionen fortfarande läser policyn. QA:s AI-flaggor förblir OFF.

Inget nytt betalt AI/GPU-jobb behövs för denna leverans. Driftsättning sker
med providerjobb dränerade. Det kända shutdown-felet, zonbilden och OpenClaw
ligger kvar i [plan 01](../01-slutratningar/PLAN.md); den här lane-ändringen
är inte ett godkännande av dessa öppna fel. Latens finns i
[plan 06](../06-driftlagen-och-lanes/PLAN.md).

Aktuell leverans- och driftstatus förs i
[den enda handoffen](../../docs/JOHN-HANDOFF.md).
