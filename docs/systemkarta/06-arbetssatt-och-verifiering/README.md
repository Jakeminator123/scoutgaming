# Arbetssätt och verifiering

[Till systemkartan](../README.md) · [Källor och avgränsning](../KALLOR.md)

**Börja med frågan, välj sedan rätt källa.** Ett dokumentationsbeslut,
en kodfunktion och ett godkänt produktbeteende är olika saker.

För nuvarande läge och återstående prov: [Livejämförelse](LIVEJAMFORELSE.md).
För var dokument ska ligga och vad som har flyttats: [Dokumentordning](DOKUMENTORDNING.md).

- **Kod och kontrakt:** Croupier-repot visar vad implementationen gör.
- **Aktiv sprint:** [dokumentationsnavet](../../animation-events/README.md)
  leder till V5 med D0 + sju arbetsdagar. Wiki och hemsida är separata läsytor;
  kontrollera deras publicerade revision. Planens version är inte produktens version.
- **Beslut och samarbete:** [GitHub-migrationen](../../GITHUB-MIGRATION.md)
  anger aktuell leveransväg; [arbetsflödet](../../shared/WORKFLOW.md)
  är historiskt underlag.
- **Öppna observationer:** [findings](../../findings/REGISTER.md)
  behåller evidens och beslutsspår.
- **Leverans och testkvitto:** [JOHN-HANDOFF](../../JOHN-HANDOFF.md)
  anger datum, revision, genomförda prov och kvarstående glapp.
- **Implementation och QA-status:** Jira CAC. Läs aktuell issue och hela
  Expected Result före kodarbete; kopiera inte status till en parallell lista.

Det personliga arkivet är ingen aktiv källa eller navigationsväg.
Nödvändiga sakuppgifter hör hemma i aktiva projektdokument, med direkt
kodreferens och daterad verifiering. Att ett arkiv tas ur läsvägen stänger
inte fynd eller raderar Git-historik.

## Vad en kontroll faktiskt bevisar

**Kod/schema/register** belägger fält, regler och referenser.
**Automatiska tester** belägger de provade kontrakten och fallen.
**Riktigt modell-/chattanrop** belägger att just den vägen fungerade då.
**Hash och medieaudit** skyddar överenskomna bytes och metadata.
**Visuell rehearsal** behövs för exakt tal, kontakt, rörelse och följduppspelning.
**Aktuell bindningskontroll** behövs för att veta vad den riktiga sessionen väljer.

Ingen enskild kontroll bevisar alla de andra. Daterade tester från
20–21 september gäller sina dåvarande revisioner. Läs den senaste handoffen
för integrationsleveransens faktiska körningar; denna kartöversyn ger ingen
ny visuell acceptans och återanvänder inte gamla tester som nya resultat.

Vid media-/spelarändringar gäller [projektreglerna](../../../AGENTS.md),
[pre-commit-listan](../../../.githooks/pre-commit),
`node pipeline/audit-dealer-sync.mjs --probe` och riktig rehearsal för alla
fyra dealers, inklusive två påföljande uppspelningar. Dokumentation ensam
kan inte markera en take godkänd.

## Fortsätt från de öppna gränserna

Aktuell Bettalotto-revision, behörig testsession, aktiva BO-bindningar,
SSE-återhämtning, walletbeteende per klientväg och faktisk produktuppspelning
behöver verifieras innan labbet kallas integrerat. Varken manifest,
BO-inloggning eller en fungerande social chatt räcker ensamt.

F-001/F-002 behåller sitt särskilda beslutsberoende. Övriga fynd behåller
sin evidensnivå och triage tills det finns nytt underlag. Den här
dokumentationsöversynen ändrar ingen Jira-status.

För Windows-kontroller finns [testmiljön](../../WINDOWS-MEDIA-TESTS.md).
Den tidigare [inboxguiden](../../shared/AGENT-INBOX.md) är historisk;
GitLab-inboxen är pausad.
Kartan startar ingen bakgrundspollning eller automatisk dokumentcrawl.
