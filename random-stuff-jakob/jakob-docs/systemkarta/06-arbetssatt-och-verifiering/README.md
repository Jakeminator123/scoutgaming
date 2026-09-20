# Arbetssätt och verifiering

[Till systemkartan](../README.md) · [Källor och avgränsning](../KALLOR.md)

**Börja med frågan, välj sedan rätt källa.** Ett dokumentationsbeslut,
en kodfunktion och ett godkänt produktbeteende är olika saker.

- **Kod och kontrakt:** Croupier-repot visar vad implementationen gör.
- **Aktiv sprint:** [dokumentationsnavet](../../../../docs/animation-events/README.md)
  leder till V4 och de föreslagna etapperna. Wiki och hemsida presenterar
  samma plan; versionsnummer på planen är inte produktens version.
- **Beslut och samarbete:** [wikin](https://gitlab.com/scout-gg/croupier/-/wikis/home)
  och [arbetsflödet](../../../../docs/shared/WORKFLOW.md).
- **Öppna observationer:** [findings](../../../../docs/findings/REGISTER.md)
  behåller evidens och beslutsspår.
- **Leverans och testkvitto:** [JOHN-HANDOFF](../../../../docs/JOHN-HANDOFF.md)
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

Ingen enskild kontroll bevisar alla de andra. De senast dokumenterade rena
testerna i handoffen är 192 labbtester och 98 Director/OpenClaw-tester
(20 september 2026). Denna kartöversyn kör inte om produkt-/medietester
och ger ingen ny visuell acceptans.

Vid media-/spelarändringar gäller [projektreglerna](../../../../AGENTS.md),
[pre-commit-listan](../../../../.githooks/pre-commit),
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

För Windows-kontroller finns [testmiljön](../../../../docs/WINDOWS-MEDIA-TESTS.md).
För riktad agentkommunikation finns [inboxguiden](../../../../docs/shared/AGENT-INBOX.md).
Kartan startar ingen bakgrundspollning eller automatisk dokumentcrawl.
