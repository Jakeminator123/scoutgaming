# Livejämförelse — nuläge och återstående acceptans

[Systemkartan](../README.md) · [Verifieringsprinciper](README.md)

Samlad 25 september 2026. Ersätter separata rapporter, handoffs och 2D-prompten
från 21 september. Kodbasen är Jakobs work efter Kevin-integrationen; lokalt
godkänd kod, aktuell drift och framtida produktintegration är olika saker.

## Vad de tre ytorna gör

**Originalspelet** använder serverägda kort, händer, regler och saldo och sin
egen spelarkoreografi. **Labbet** observerar publika instruktioner och väljer
sin presentation av samma fakta. **Backoffice** granskar och binder material;
dess katalog är inte en inspelad tidslinje eller en andra variantmotor.

På `/activity` samordnar **Anslut** Partner-verifiering, rätt launch-session,
SSE och automatisk labbföljning. Den nya native-observern kan dessutom lämna
publika kommandosvar, faktisk klipp-/tal-/korttelemetri och avgränsad chatt.
Originalbilden är en separat lokal skärmdelning som kräver användarens flikval.
Bilddelning bevisar inte att några rundinstruktioner har mottagits.

HTTP/native och SSE dedupliceras per kommando/version. Kö, beslut och faktisk
klippstart/slut hålls isär. Labbet skickar inga extra insatser eller spelhandlingar.
**Bara standard** gör inga modellanrop. OpenClaw får välja tillåtna varianter,
inte ändra exakt replik, kort, destination, spelutfall eller pengar.

## Vad som är testat — och inte

Den isolerade körningen den 22 september hade 13 mottagna sekvenssteg,
13 labbval, 13 avslut och 13 deduplicerade instruktioner. Alla fyra dealers
och två V2-lägen provades med två påföljande plays. BO provades med riktiga
videostickprov. Exakta revisioner, testantal och begränsningar finns i
[gemensam handoff](../../JOHN-HANDOFF.md) och
[sprintens körkvitton](../../animation-events/v5-7-days-mvp/RUNTIME-EVIDENCE.md).
Detta är inte full visuell läppsynk- eller produktacceptans.

Vid läsande kontroll den 25 september visade originalfliken Astrid medan
labbets spegling var grön. Labbet visade 0 instruktioner/0 kommandosvar.
Orsaken till bildfelet är inte fastställd, och det var inte bekräftat att en
ny hand spelats efter anslutningen. Dessa observationer ska inte beskrivas
som att hela livekedjan fungerar eller som bevis för en viss deployrevision.

Tre separata leveranser behöver stämma: lokala Next-labbet, Bettalottos
native-server/klient och Render Director. Render bygger bara `open-claw/lab/`.
Äldre Director saknade kvitto för `contextContractVersion: 2`; den nya
chattprojektionen använder då synlig standardreserv. Bettalottos native-version
återstår att verifiera. Inga deploys har genomförts av denna dokumentstädning.

## Acceptans för nästa behöriga integrationsprov

- Fastställ server-/klientrevision, launch-proveniens och rätt Partner-kanal.
  En ansluten transport, BO-login eller ett manifest räcker inte.
- Följ två påföljande rundor: accepterat kommando → offentligt svar/events →
  samma kort/mål i labbet → beslut → faktisk uppspelningsstart och avslut.
  Labbet ska förbli läsande. Använd isolerad server/databas och testidentitet.
- Prova split, double, reveal och försäkring med isolerade deterministiska
  fall; inga osynliga kort, saknade tidsstämplar eller historik får hittas på.
- Prova dubbla svar, avbrott, återanslutning och ny observation. SSE saknar
  historisk replay; en lucka ska framgå och bryta kontexten.
- Kontrollera exakt replik och faktisk take, poseövergång, kortkontakt och
  landning. En materiallista, `want` eller fungerande preview är inte acceptans.
- Genererat tal kräver egen godkänd presentationsväg. OpenClaw är inte ännu
  produktens enda talägare; använd [den befintliga implementationsbriefen](../../../lab/docs/OPENCLAW-SPEECH-OWNERSHIP.md),
  inte en ny parallell agentprompt eller ljudkö.

2D-bibliotekets 64 delade rörelser är schematiska prov, inte bevisad täckning
för sju platser, alla splitlägen, övergångar eller läppsynk. Ett variantnamn
ändrar inte rörelsen eller timing; kontrollera verklig asset-/videobindning.
Välj aldrig talvideo efter ungefärlig längd. Produktens mediaregler gäller.

Äldre handoff nämnde ett ofixat cachefel vid lika stor fil med ändrade bytes.
Det motsvarande aktuella testet i `lab/test/video-registry.test.mjs` passerade
den 25 september, tillsammans med filens övriga 12 tester. Det gamla felet
är därför inte kvar här som ett bekräftat aktuellt fel; detta är ett avgränsat
syntetiskt regressionstest, inte ny QA av användarens originalfilmer.
