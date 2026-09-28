# Astrid Probe — driftkvitto 28 september 2026

## Driftsatt

Gateway och Director kör `70ef43f504496415b6be8419471d5f2f68fb02ae`.
Probe-implementationen kom i `d5bcc8d`; `70ef43f` rättar bevarande av
Gateway-konfigurationens äldre migrationsbackup. Båda commits är verifierade
på canonical GitLab och den privata GitHub-spegeln. Tider nedan är Stockholm.

| Tjänst | Render-deploy | Live |
| --- | --- | --- |
| Gateway | `dep-dat0oqu0tbcc739e1nmg` | 08:48:56 |
| Director | `dep-dat0pvh42hec73f1p0og` | 08:47:56 |

Första Gateway-försöket, `dep-dat0mb17lnhs73b6fjkg`, stoppades innan
konfigurationsbyte eftersom en äldre backup redan fanns. Rättningen behåller
den och skapar en innehållsadresserad backup för en annan konfigurationsversion.
45/45 konfigurations-, start- och runtimepakettester passerade.

Manual Deploy användes på de befintliga tjänsterna. Ingen Blueprint Sync,
ny tjänst, nyckelrotation eller ändrad GPU-kapacitet. Andra agentens efterföljande
mediecommit `4988f96` ingår i lokal arbetskopia, inte i dessa Render-deploys.

## Kontroller i drift

Director rapporterar nu `product-probe-v1`. Åtta autentiserings-/schemaprov
passerade: labbstatus 200, speech-token mot status 401, anonym produkt-Probe
401, labbtoken mot produkt-Probe 401, ogiltig produkt-Probe med speech-token
400, speech-token mot studio-Probe 401, ogiltig studio-Probe med labbtoken
400 samt ogiltigt produkttalkontrakt med speech-token 400. Dessa prov gör inga
modellanrop. `PROBE_API` kräver ingen ny miljövariabel eller credential.

Läsning av Gatewayns beständiga konfiguration visade `gpt-5.4-mini`,
`gpt-6-luna`, `gpt-5.6-terra`. `croupier-speech` har fortfarande primärmodellen
`lab-provider/gpt-5.4-mini`, inga fallbacks, alla verktyg nekade och heartbeat
`0m`. Modelloverride gäller bara den begärda repliken/rollen.

## Syntetisk modelljämförelse

Samma 20 textfall per modell; ingen TTS, GPU eller riktig spelarhistorik.
Ett inledande försök stannade vid ett 502-svar. Verktyget registrerar nu
enskilda modellfel och fortsätter med resterande fall, utan automatisk retry.
Efterföljande full körning gav 60/60 svar och inga tekniska fel.

| Begärd modell | Första anrop ms | Varm p50 ms | Varm p95 ms | Oväntat tal i tystnadsfall |
| --- | ---: | ---: | ---: | ---: |
| gpt-5.4-mini | 934 | 977 | 1214 | 0 |
| gpt-6-luna | 1325 | 1342 | 3164 | 0 |
| gpt-5.6-terra | 1735 | 1847 | 3281 | 0 |

Två lokalt avvisade icke-lugna fall per modell har 0 ms och ingår inte i
varmpercentilerna. Första anropet bevisar inte kall providerstart.
5.4-mini valde tystnad i samtliga 20 fall. Luna och Terra kommenterade den
belagda dubbla vinsten och använde den korrigerade destinationen Porto.
Terra gav också en kort tysk namnfråga. Luna är därför en rimlig första
testkandidat för initiativ; detta lilla prov utser ingen generell vinnare.

Standardvalet är kvar. Modellerna kan väljas i båda labbens Probe-editor.
Latensen avser textbeslutet, inte skapandet av läppsynkvideo. Relay-svaret
innehåller inte tokenkostnad eller bevis för faktiskt laddad providermodell.
Råresultatet hålls privat i Windows temp, `croupier-probe-model-eval-complete.json`.

## Rätt lokal vy

Starta i [Lissabon](http://127.0.0.1:4201/lissabon), välj **Anslut**.
Direktlänken är <http://127.0.0.1:4200/?dealer=astrid&presentation=local>.
`presentation=local` väljer Emils porträttfilmer och de gemensamma policyerna.
`rehearsal=1` lägger bara till repetitionskontroller; utan `presentation=local`
väljs den äldre presentationsvägen. Porträttfilmen visas även på dator.

Separata Probe-prov använder localhost:4210/4211, temporärt projekt och
temporär spelar-DB. Användarens 4200/4201, profiler och sparade klippval bevaras.
Manifestkontrollen verifierade 42 filer i 26 familjer. Filnärvaro och hash
är inte visuellt godkännande av läppsynk eller kortkontakt.

Ett browserprov visade att normala idlevariationer kunde avbryta väntande
videogenerering via klientens lugnt-läge-veto. Klienten skiljer nu denna
bakgrundsrörelse från spelhandlingar/annan chatt och begär neutralt bildläge
när paketet är färdigt. 23/23 riktade Probe-/presentationsprov passerade.
Provresultatet ligger kvar separat från den periodiska närvarostatusen.
Samtliga 25 pre-commit-kommandon och `audit-dealer-sync --probe` passerade.

Efter rättningen visade den faktiska spelaren ett fullständigt `played`-
kvitto för Luna: "Two consecutive wins with A♥ 10♠—quite a striking repeat."
Den syntetiska repliken sparades inte som spelarminne. Därefter tog Jakob
QA-sessionen i bruk och spelade/chattade där; den lämnades orörd. Två nya
genererade talprov i följd är därför ännu inte verifierade, och inget nytt
visuellt läppsynkgodkännande har utfärdats. Den använda QA-servern lämnades
körande för den öppna sessionen; den ska inte städas medan Jakob använder den.

## Kamera och mikrofon

Förslaget är mottaget men inte aktivt. Versionskontroll och konkret kontraktsplan
finns i [ASTRID-CAMERA-VOICE-PLAN.md](ASTRID-CAMERA-VOICE-PLAN.md).
Ingen kamerabild eller mikrofoninspelning har skickats i denna verifiering.
