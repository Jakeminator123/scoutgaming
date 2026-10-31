# Nuläge: inventeringsbas 31 oktober 2026

Fryst observation **03:58–04:05 svensk tid** (02:58–03:05 UTC), före organisationsplanens leverans. Uppdatera basen före genomförande; denna fil är bevisunderlag, inte ett parallellt löpande produktstatusregister. [NEXT-AGENT](../../NEXT-AGENT.md) beskriver aktuell överlämning.

## Repo och produktväg

- Kanonisk checkout: `C:/Users/jakob/dev/scoutgaming`. Ren `main` vid start; lokal HEAD, origin/main och GitHub-main: **`e20fe6f143e447f805c63b75b328f39f48521ca3`**, merge #721. Planen skrivs på `jakob/codex-organisation-1031`.
- GitHub har 30 annonserade brancher, **ingen `master`**. `main` är default och produktgren, `preview` egen miljögren. Slutrapportens berättelse om nyare master är avfärdad för denna bas.
- Main-trädet: **2 138 spårade filer, 84,99 MiB**. Repoagentens fördelning: Studio 870 filer/42,26 MiB; web 88/19,48; Astrid-worker 39/8,21; test 336/5,05; game 212/4,96. Resterande filer ligger i paket, verktyg, drift, media och guider. Storlek/namn är inget raderingsbevis.
- Full Git-historik och PR-refar är ett separat lagringsproblem. Den tidigare incidentmätningen på 4,11 GiB gäller en fryst fullspegel; denna körning har inte laddat om hela historiken. Alternativet på cirka 65 MiB är ett förslag, inte en genomförd flytt.
- Migreringen är **20/20 VERIFIED** i `migrering/status.json`. Nya aktiviteter återöppnar inte den genom att planeras här.

## Systemkarta och ansvar

```text
Spelare/Partner/Admin
      |
 Vercel: web + studio + speech (socket-/ström-ingress)
      |                 |
      |                 +--> Render: spelmotor (HTTP, sessioner, presentation, taladaptrar)
      |                                      |
      +--> Neon produktregister              +--> Neon spel/transaktioner
      +--> Blob mediebytes                   +--> Director --> Gateway --> modell
                                             +--> TTS/GPU-provider --> ström via ingress

Regelkärna: regler + slump + sko + kort + utfall
Runt kärnan: sessioner, kommandon, walletadaptrar, klient, presentation och tal
```

Detta är en ansvarskarta, inte varje nätverksanrop. `apps/speech` orkestrerar inte själv Director/TTS/GPU. Paketgränser: `studio-access` policy; `storage` Postgres/transaktioner; `studio-registry` dokument/register; `presentation` mediekontrakt; `navigation` vägar; `director` AI-kontrakt. Ändringar runt kärnan får förenklas med bibehållen serverauktoritet, bolagsisolering och atomiska pengar.

## Moln: faktisk körning

Driftagenten läste Render/Vercel/Neon via respektive plugin, med CLI-fallback för Vercel-preview. MERGEAGENTEN bekräftade dessutom produktionsprojektet i Neon, senaste Vercel-prod och Render-motorns identitet. Alla resurs-ID:n utgår från [START-HERE](../../../START-HERE.md).

| Miljö / tjänst | Faktisk SHA eller resurs | Kvitto / observation |
| --- | --- | --- |
| Vercel produktion | `e20fe6f143e447f805c63b75b328f39f48521ca3` | `dpl_EdBkkrs5xfuw6KhcuAbdBZFqJ65j`, READY, domän HTTP 200 |
| Render spelmotor prod | `c5cc98d68b219a77d728813f233e27e32a3b54a2` | `dep-dbiki7ks728c73firi90`, live, health/version 200 |
| Vercel preview | `6a3f976e4428627b135664ba7d13ae24593567c4` | `dpl_7ZpLf9ati7i9Er1HGzSmLBb1XrvK`, READY, domän 200; CLI-fallback |
| Render preview | `6a3f976e4428627b135664ba7d13ae24593567c4` | `dep-dbieuj15efls739uaidg`, live, health/version 200 |
| Director | `c5cc98d68b219a77d728813f233e27e32a3b54a2` | `dep-dbikhpk9v7es73fs51sg`, live, health 200 |
| Gateway | `eb41edc03378789a371be8f22965e7ca06f3ddcd` | `dep-dbik51s9v7es73fr13bg`, live, privat; image fortsatt pinnad |
| Neon produktion | `wandering-hill-60561912`, `br-flat-fog-b161a6r8`, `croupier_game` | 23,58 MiB appdatabas; historikfönster 21 600 s / 6 h |
| Neon preview | `red-violet-36066351`, `br-plain-voice-b9yu49xi`, `croupier_staging` | 20,70 MiB appdatabas; historikfönster 86 400 s / 24 h |

Alla fyra Render-tjänster var `not_suspended`. Main till motorns SHA skiljer **enbart `docs/NEXT-AGENT.md`**, verifierat av MERGEAGENTEN med Git-diff; detta är inte belagd inkompatibel runtime. Gatewayens äldre SHA betyder inte ensam att dess kod är fel. Preview är internt samstämmig men äldre än main; synk är en egen kontrollerad aktivitet, inte automatisk följd av main-merge.

Neons obligatoriska ledgerversioner/checksummor stämde i driftagentens läsning. Studio 023 finns i båda; valfria 021–022 saknas i prod och preview saknar även 016/018/019. Game 013 saknas i båda och behandlas som efterregistrering, inte bevis på förlorade pengar. **Full strukturfingerprint och hela readinessverktyget verifierades inte i denna läsning.** PITR och extern återställning av Director/Gateway behöver eget acceptansprov.

## Vad rapporterna inte ska få oss att göra om

| Påstående | Bedömning nu | Kvar |
| --- | --- | --- |
| Nyare master måste tas in | Avfärdat av färska refs | Utgå från main och exakt SHA. |
| Preview saknar branchskydd | Avfärdat: ruleset `26090808` aktivt, deletion/non-fast-forward nekas, ingen bypass | Rätta texten i START-HERE; ändra inte skydden som inventeringsbieffekt. |
| Två öppna GitGuardian kräver omedelbar rotation | Repoagentens nya läsning: 0 öppna, 25 ignorerade. Handoffen beskriver 39166318/39166319 som `test_credential` | Historisk scan är fortfarande `too_large`; noll öppna är inte full täckning. |
| RunPod callback fortfarande v2 | Rättningen är redan dokumenterad i aktuell main | Egen previewmall/konto/bank kan fortfarande kräva verifiering före aktivering. Ingen RunPod-API-läsning ingick här. |
| F11-kod saknas | Kod finns, #529; arkitektgranskaren bekräftade observeRoom/1012 och drain | Driftacceptans och tomt-bord-regeln kvarstår. |
| Valuta/walletfel från morgonrapporten är orättade | #708/#711/#714 och L3-leveransen har rättat angivna delar | Extern partnerwallet och real-money-acceptans är fortsatt separata frågor. |
| Preview delar fortfarande de tidigare talhemligheterna | Aktuell handoff beskriver redan genomförd separation | Denna inventering läste inga hemliga värden; återkontrollera identitet/åtkomst i GEM-02, rotera inte blint. |

## Verifierade kvarstående kod-/kontraktsgap

- **Preview-cookie:** `services/game/server.mjs:506` saknar `Secure` på `preview_session`.
- **Generated speech:** `services/game/public/shared-room-presentation.mjs:51` beskriver textfallback tills aktuellhetskontrollen finns; `services/game/shared-room-chat.mjs:229` distribuerar bara moving. TAL-01 tar hela kedjan.
- **Talstart:** moving på utan bank kan stoppa motorstart; talnekning och spelhälsa måste hållas tydliga, utan godtycklig bankfallback.
- **Adaptrar:** native/partner/Provspel och sparade format har levande konsumenter. En gemensam regelkärna gör inte deras transport-/lagringskontrakt förbrukade.
- **Materiallivscykel:** ersätt/avpublicera/gallra kräver kompatibilitet, CAS och referenskontroll över låsta paket; historik är inte ett andra aktivt register.
- **Toolchain/dokument:** olika Next/React/TS/npm/pnpm, äldre web-typer och Node-/preview-/terminologitext behöver avgränsad hantering.

## Bevisens räckvidd och åtkomstluckor

Alla **16 underlagsfiler** har registrerats; Markdownunderlag granskades av root eller avgränsad agent, PDF-text extraherades från 12 + 8 sidor. Originalen är orörda och kopieras inte till Git. Detta är en syntes med filinventering och riktade kod-/molnkontroller, **inte radgranskning av alla 2 138 filer eller full UI-/AV-acceptans**.

Repoagenten rapporterar godkänd repo-limit-kontroll (23 befintliga undantag) och GitHub-main-CI [41157400750](https://github.com/Jakeminator123/scoutgaming/actions/runs/41157400750). Arkitekten rapporterar 31/31 riktade tester på Node 24.21.0, efter processisoleringens `EPERM`; dessa är andra agenters prov, inte en ny full regression av MERGEAGENTEN.

Första `security-status.mjs`-körningen i root saknade skyddad GitGuardiananslutning och GitHub-täckning. Repoagentens senare läsning gav incidentantal men full historisk täckning förblev ofullständig. Vercel-pluginen gav 404 för preview medan CLI fungerade. Render-workspace-hjälparen gav `INVALID_ARGUMENT` i root; explicit dokumenterat workspace och get-service fungerade. Driftagentens lokala env-kontroll gav Git-spawn `EPERM`. Inga av dessa åtkomstfel är i sig ett verifierat produktfel.
