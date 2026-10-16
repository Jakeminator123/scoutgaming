# Systemöversikt och kartans begränsningar

Produktens riktning är **Admin → Neon-register → Blob-medier**, med
spelmotorn på Render och webb/Admin på Vercel. Leverans sker via PR till
`main`, därefter production. En PR-preview är ett granskningssteg.
Aktuellt leveransläge finns överst i [JOHN-HANDOFF](../JOHN-HANDOFF.md) och
[CLOUD-MIGRATION](../CLOUD-MIGRATION.md); en målbild är inte driftbevis.

- `/admin` är intern administration, `/partner` operatörens portal och
  `/lobby` spelarens ingång. Spelmotor, behörigheter och rumspublicering
  har egna kontrakt även när gränssnitten förenklas.
- Neon äger produktens register, inklusive mediekatalog och sparad
  replikmetadata. Blob lagrar mediefiler. Lokala authoringfiler, importer
  och isolerade testfixtures är inte parallella produktregister.
- Astrid behålls som märkt legacyreferens utan trelagersversion. Dragan
  är ordinarie dealer. Astrids fungerande tal-/OpenClaw-flöden kan vara
  referenser utan att lokala register eller gamla editorer måste bevaras.
- `lab/lib` innehåller aktiva delade tjänster. Katalogens namn avgör inte
  vilka implementationer som ska behållas eller tas bort.

## Den äldre maskinella kartan

[HTML-kartan](index.html) och JSON-filerna i denna mapp är daterade
inventeringsunderlag. De kan innehålla äldre implementationer, sökvägar och
testkopplingar. De är **inte produktkrav, agentinstruktioner eller en lista
över saker som måste bevaras**. Använd dem endast för en avgränsad fråga och
kontrollera relevanta uppgifter mot aktuell kod. Gamla baslinjehashar ska
inte styra vilka sidor eller tester produkten behöver.

Kartans generering, evidens och uppladdning ska vara informativa. Ett
kartfel får inte hindra att verkliga SQL-/HTTPS-prov körs. Dessa prov och
deras eget skydd mot ändrade källor måste fortfarande rapportera riktiga
fel. Kartans grön/gul/röd-status bevisar inte produktionsdrift, visuell
medieacceptans eller läppsynk. Försvunnen evidens är okänd täckning, inte
ett godkänt prov.

Den återstående katalogen och dess verktyg kan slimmas eller avvecklas
efter kontroll av anropare. Inga tester ska behållas enbart för att en
historisk kartpost nämner dem. Behåll relevant verifiering av pengar,
spelregler, behörigheter, rumsisolering, register och medieidentitet.

Vid uttrycklig kartgranskning finns läskommandot
`node docs/system-map/verify.mjs --check --ref HEAD`. Vanligt produktarbete
behöver inte läsa hela katalogen eller den genererade HTML-filen.
