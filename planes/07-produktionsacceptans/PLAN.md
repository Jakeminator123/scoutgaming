# 07 — Kort produktionsacceptans efter rättning

## Syfte och mål

Verifiera de rättade användarflödena på verklig leverans och ge en ärlig
avslutning. Bevarade data och migrationens P7/P8 gäller fortsatt; autentiserad
Studio, zonexport, OpenClaw-navigering och shutdown behöver egna aktuella bevis.

## Förutsättningar

**Avgränsat prov levererat 5 oktober:** källkod5270c8ab, CI3/3 PASS,
produkt-Render LIVE och två Vercelbyggen READY; Director96020c04 LIVE.
Studio-bild1080×1920, faktisk PNG-zonexport290×104 med identiska pixlar,
native OpenClaw-klick/Owner-anslutning, anonym bild401 och loginredirect303
är verifierade. Zonrevision1 bevarad, inga konto-/spel-/saldomutationer.
Linuxprocesskedjan4/4 med verkliga barn/worker-WebSocket och isolerad långsam
provider passerar naturlig terminal, cancellation och timeout. Render90 är
driftsatt; GPU0 köade/pågående, QA AI/GPU OFF. Inget nytt betalt GPU-prov.
Aktuell spelfliks idle-varning, full P6, fysiska enheter, produktionsmail och
full incidentlista är separata öppna kontroller; se John-handoffens driftbevis.

- [Sluträttningarna](../01-slutratningar/PLAN.md) är genomförda, riktade
  integrationsprov passerar och obligatoriska repositorychecks är gröna.
- En oberoende, avgränsad granskning har hanterat bevisade fel i paketet.
- Frys rätt SHA och kontrollera verkliga Render-/Vercel-/Directorversioner.
  Planfilernas version eller en grön build är inte ensam bevis på rätt drift.
- Bevara extern backup, QA-isolering och alla tidigare kvitton. Ingen omimport.

## Provordning

1. **Inloggning/roller:** använd avsedd befintlig behörighet. Visa att
   admin når Studio och spel och att vanlig spelare inte får administration.
   Registrera inte syntetiska konton, saldoändringar eller spelutfall i riktiga konton.
2. **Studio:** visa sparad revision, referensbild och exporterad zonstartbild.
   Behåll osparade användarutkast. Ett nödvändigt save-prov ska ha uttrycklig
   återgång till föregående revision och får inte ändra aktiva klipp av misstag.
3. **OpenClaw:** klicka från Studio, nå native UI och verifiera rätt
   anslutning/roll med befintlig pairing. Starta inget modelljobb bara för loginprovet.
4. **Spel:** verifiera den ändrade åtkomst-/medievägen i riktig spelare.
   Skilj förinspelad uppspelning från faktisk AI/TTS/GPU.
5. **Kontrollerat GPU-avslut:** fastställ befintlig budget och öppna
   reservationer före ett eventuellt betalt prov. Håll provet till en ägd
   session/job-ID med långsamt avslut/cancel och uppmätt terminal/dränering/journal.
   Stör inte en annan spelares aktiva session genom en blind produktionsrestart.
6. **Efterkontroll:** rätt driftversion, hälsa, inga kvarvarande ägda workers/
   osäkra reservationer, bevarad data och QA åter OFF. Dokumentera återanvända
   oförändrade bevis separat från de nya observationerna.

Ett realistiskt processavslut ska först bevisas i den isolerade integrationen.
Om verifiering i produktion kräver omstart måste aktiva användare/jobb och
den faktiska deploytidsgränsen ingå i samma kontrollerade skriv-/driftfönster.
Att bara starta ett GPU-jobb och avbryta webbläsaren bevisar inte parent/child-shutdown.

## Budget och bevis

Jakob har tidigare höjt gränsen till sex genereringar totalt. Historiskt
closed39 redovisar 4 genereringar, 5 SDK-anrop, 2 TTS-anrop och 4 GPU-jobb.
Det är historisk förbrukning, inte bevis på dagens disponibla budget eller
ett nytt nollställt provfönster. Nästa agent läser den befintliga journalen
och använder återstående mandat och numeriska reservationer utan återbetalning/reset.

Redovisa naturligt `COMPLETED`, `CANCELLED`, timeout och okänd status korrekt.
En terminal HTTP-kvittens ersätter inte workerdränering; spel-END ersätter
inte providerstatus. Faktisk kostnad förblir okänd där underlag saknas.
Prisunderlag ska inte starta en ny utredningsrunda.

## Håll följande separat från migrationsleveransen

| Del | Hantering |
| --- | --- |
| P7/P8: import, gemensam policy, fysisk avveckling | Genomförda; referera befintliga bevis, gör inte om flytten |
| Tre efterfunna funktionsfel | Rättade, driftsatta och avgränsat verifierade enligt plan 01 på 5270c8ab |
| Utökad P6/naturlig provideravslutning/mänsklig medieacceptans | Redovisa exakt vad det nya provet täcker; bocka inte av hela P6 genom ett delprov |
| Produktionsmail/invite/reset | Separat flöde; tidigare QA-levererat mail bevisar inte hela produktionsflödet |
| GitGuardian | Senaste läsning: commitmetadata komplett, suite queued, inga synliga check-runs; incidentlista not-read, tidigare känd incident 37830671 |
| Exakta Cartesia-/countingpriser | Backlog enligt Jakob |

## Färdigt när

En kort handoff anger slut-SHA, faktiska driftversioner, relevanta testresultat,
autentiserade observationer, GPU-jobbets verkliga slutstatus, bevarad budget/
journal, QA OFF och backupplats. Varje kvarvarande lucka namnges utan en
ny generell procentsiffra som döljer vad som faktiskt återstår.
