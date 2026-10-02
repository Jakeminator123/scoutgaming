# Croupier: aktuell källa, drift och leverans

Arbeta i `C:\Users\jakem\Projects\croupier`, på `main` i det privata
[Jakeminator123/github-work](https://github.com/Jakeminator123/github-work).
`main` är enda lokala/GitHub-branch och standardbranch sedan 2 oktober 2026.
Vercels produktionsbranch och fyra befintliga Render-kopplingar är `main`.
Produktens Render-autodeploy är `checksPass`; övriga tre är fortsatt `off`.
GitLab-inbox, wiki och spegelpush är pausade; återskapa inte gammal inbox.
`Jakobs-v1` bevarar commit `600093e4522efc57bd82979cff65492a528ffeb7`.
Ignorerade privata data ingår inte i Git-taggen.

## Fem dokument i docs

- [JOHN-HANDOFF.md](JOHN-HANDOFF.md): senaste verifierade arbete och öppna fel.
- [ENVIRONMENT-RESTORATION.md](ENVIRONMENT-RESTORATION.md): data, backup och mediaregler.
- [ENVIRONMENT-VARIABLES.md](ENVIRONMENT-VARIABLES.md): namn, placering och villkor.
- [LOCAL-PRESENTATION-RUNTIME.md](LOCAL-PRESENTATION-RUNTIME.md): ansvar och uppspelning.
- Detta dokument: källa, driftskarta och leverans.

Uppdatera befintliga dokument kort; skapa inte fler daterade rapporter eller
sprintarkiv innan Jakob ber om ny dokumentation. Labbets användarguide och
OpenClaws versionsbundna källindex ligger nära respektive implementation.
JSON-register, media, acceptansbaseline och befintliga QA-kvitton bevaras.

## Ytor och datalagring

| Yta/data | Ansvar och plats |
| --- | --- |
| Publik frontend | `apps/croupier-frontend`, Vercel `croupier-frontend`; [scoutgaming.tech](https://www.scoutgaming.tech/) |
| Spel | [croupier-v2.onrender.com](https://croupier-v2.onrender.com/blackjack?dealer=astrid); konto, kort, shoe, wallet och uppspelning |
| Studio / Lab | Render `/studio`, samma Lab-app; `/tree` är allmänna editorn |
| BO | Render `/bo`, administration, ingen separat dealerström |
| Spelarkonton/rundor | `/var/data/players/croupier.db`, SQLite |
| CRAIG/BO-konton | `/var/data/players/craig.db`, SQLite |
| Studio-projekt/index | `/var/data/studio`, beständig Render-disk |
| Privata nya filmer | Vercel Blob, skyddad serverrutt med hash/familj/Range |
| Zonmetadata | Dedikerad Neon, schema `croupier_zones`; browserkopia är separat |
| Director/Gateway | Egna beständiga diskar, se återställningsguiden |

`croupier-player-preview-qa` bär lagringskopplingar och är ingen dubblett.
Testbackenden `croupier-vercel-preview-qa` startas bara på begäran.
Frontend-Preview kan peka mot produktion; syntetiska konton/rundor kräver
isolerad backend och annat hostname. Game-Neon-migration och byte av
spelklient till Vercel är inte genomförda. Byt inte bara `DATABASE_URL`;
konto-, saldo-, sessions- och återgångsprov krävs.

`presentation=local` betecknar gemensam presentation även i molnet.
Speluppspelning, Studios observation och genererat tal/video är olika flöden.
Vercel är landningen; gameplay/WebSocket finns på Render.
Privat Blob läses genom servern; frontend får inga modell-/lagringsnycklar.
Zoner använder `CROUPIER_ZONES_DATABASE_URL`, inga generella DB-fallbacks.
Vercels projektkoppling kopierar inte hemligheter till Render.

## Lokal start och sökning

```powershell
node lab/start.mjs --offline --no-open
```

Detta är en tillfällig isolerad preview när start faktiskt är begärd.
`Start-Lab.cmd` använder sparad ansluten profil. Följ
[labbguiden](../lab/docs/README.md), sessionvakten och utskrivna adresser.
Kör ett enda produkt-/labbpar; bevara data och browserutkast.

`.ignore` begränsar vanliga ripgrep-sökningar. Cursor-ignorefilerna utesluter
beroenden, byggcache, binärer och privat lokal data från kontext/index.
De ändrar inte Git-spårning, byggen eller filernas existens. Sök riktat i
källtext och JSON-metadata. Kringgå inte personarkivets läsgräns med
`--no-ignore`, Git-historik eller backup.

## Leverans och kontroll

Registrera filanspråk enligt `agent-talk/README.md`; ta `.git` vid commit.
Före integration/push:

```powershell
node tools/croupier-chef.mjs status
node tools/push-github-work.mjs --check
node tools/push-github-work.mjs
```

Pushhelpern verifierar repo, `main`, fast-forward och matchande remote-SHA.
Ingen force-push, branchradering eller annan destination är tillåten.
Hooks i ny checkout: `git config core.hooksPath .githooks`.
Verifiera GitHub checks och avsedd driftcommit; GPU-image är separat release.
Tester/hashar godkänner inte synk, fysisk mobil/Safari eller backup i drift.