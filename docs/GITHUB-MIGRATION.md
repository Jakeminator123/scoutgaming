# GitHub-only från 28 september 2026

Aktiv branch: `jakemanator123-github-work` i det privata repot
[Jakeminator123/github-work](https://github.com/Jakeminator123/github-work).
`origin` pekar på GitHub och den nya branchen är repots standardbranch.
Migrationen `b3e830a` och Astrid-förberedelsen `e3eec8f` har verifierats på
GitHub med matchande commit-ID. Arbetet fortsätter från samma historik och alla
pågående filer i den delade arbetskopian har bevarats.

## Återgångspunkt

`Jakobs-v1` är en annoterad tagg som har verifierats på både GitLab och GitHub.
Den pekar på `600093e4522efc57bd82979cff65492a528ffeb7`, samma commit som
GitLabs `jakeminator123/work` vid övergången. Inga nya V2-ändringar ska skickas
till GitLab. Befintliga GitLab-brancher, taggar och historik är kvar där.

Taggen sparar kod och spårad media. Ignorerade databaser, labbval,
hemligheter och privata QA-filer finns fortsatt lokalt och ingår inte i taggen.
Stängda lokala servrar har inte startats av migrationen.

## Leverans

```powershell
node tools/croupier-chef.mjs status
node tools/push-github-work.mjs --check
node tools/push-github-work.mjs
```

Helpern kontrollerar branch, exakt GitHub-mål, att remote är en föregångare
till lokal commit och matchande SHA efter push. Ingen force-push används.
Det gamla namnet `push-work-mirrors.mjs` leder till samma GitHub-helper.
Den versionerade pre-push-hooken tillåter endast nya uppdateringar till
arbetsbranchen i detta GitHub-repo. Aktivera hooks i en ny checkout med
`git config core.hooksPath .githooks`.

GitLab-inboxens `check` och `send` avslutas före tokenläsning och nätåtkomst
med status `disabled`. Lokala cursors, drafts och checkpoints är kvar.
Den timvisa GitLab/CI-uppföljningen i chatten NY1 är pausad.
GitLab-wikin uppdateras inte under pausen. Äldre instruktioner om GitLab i
historiska dokument ersätts av `AGENTS.md` och `tools/repository-policy.json`.

GitHub Actions i `.github/workflows/croupier.yml` ersätter `.gitlab-ci.yml`:
studio-test/bygge, befintliga dealerregressioner, djupa mediaaudits samt
inbox-, samordnings-, GitHub-policy- och molnförberedelsetester.
Workflowet använder Node 24, ffmpeg och labbets låsta npm-beroenden.
Ett konfigurerat workflow är inte ett kvitto på godkänd fjärrkörning.

Första [GitHub-körningen](https://github.com/Jakeminator123/github-work/actions/runs/36461925827)
avslöjade fyra inaktuella studiotester och att dealerjobbet saknade ett
studiobygge före sitt riktiga starttest. Testerna använder nu den befintliga
43-filmscheckpointen och sju uttryckligen aktiverade idlevarianter, aktuell
2D-reservflagga och den nya frekvenseditor-importen. Alla 482 studiotester
passerade lokalt efter rättningen. Inga mediefiler eller baseline ändrades.
Workflowet bygger studion även inför dealerregressionen och använder
aktuella v7-versioner enligt [checkout](https://github.com/actions/checkout)
och [setup-node](https://github.com/actions/setup-node).

## Parallellt arbete och städning

Chatten NY1 arbetar vidare med Astrids röstläge i samma arbetskopia. Dess
förberedelse är sparad i `e3eec8f` på nya branchen. Den har fått branchbytet
och GitHub-målet; varje agent committar endast egna filer.
Separata commits på den gemensamma branchen följer med nästa GitHub-push.

Fyra gamla engångsprompter har tagits bort och kan läsas via v1-taggen.
Inbox, sparade profiler och mediaunderlag bevaras. Se
[städrapporten](REPOSITORY-CLEANUP.md) för exakta filer och beroenden.

## Drift nästa steg

[Molnunderlaget](CLOUD-MIGRATION.md) beskriver Lissabons riktiga spel-/event-
och animationskedja, beständig lagring och nödvändiga åtkomständringar.
`node tools/cloud-readiness.mjs --json` ger en rapport utan hemliga värden.

Ingen Vercel-deployment har genomförts. Automatisk godkännandegranskning
avvisade deploy av nuvarande checkout eftersom payloadexport och
driftåtkomst inte var konkret godkända och cloud/auth fortfarande har hinder.
Nästa driftsbeslut ska ange projekt, branch, åtkomst och beständig backend.
Vercel-projektet `animation-events-v1` är en separat dokumentationssajt och
har inte ändrats. Ett nytt V2-projekt är ännu inte skapat.
