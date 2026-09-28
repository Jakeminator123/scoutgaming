# Astrid Probe — driftkvitto 28 september 2026

## Driftsatt

Gateway kör `70ef43f504496415b6be8419471d5f2f68fb02ae`.
Director uppdaterades till `e6ea969dcb06926e31a0efac8079fb74e86228ce`
för den vanliga Astrid-chattens minneskanal.
Probe-implementationen kom i `d5bcc8d`; `70ef43f` rättar bevarande av
Gateway-konfigurationens äldre migrationsbackup. Båda commits är verifierade
på canonical GitLab och den privata GitHub-spegeln. Tider nedan är Stockholm.

| Tjänst | Render-deploy | Live |
| --- | --- | --- |
| Gateway | `dep-dat0oqu0tbcc739e1nmg` | 08:48:56 |
| Director | `dep-dat1pqd9fdbs73fj0nn0` | 09:54:52 |

Director ersatte sin tidigare `70ef43f`-deploy `dep-dat0pvh42hec73f1p0og`.
Tre syntetiska Luna-anrop genom driftsatt Director gav korrekt återkallande
av ett sparat minne, accepterade en ny rättelse och avstod från påhittad
återkallelse utan fakta. Textlatens: 2206, 1497 respektive 1732 ms.
Vanlig chatt i QA-spelaren återkallade därefter skilsmässan och hunden Bosse
med två genererade tal-/videopaket. Hundpaketet var redo efter 15493 ms;
RunPod rapporterade 137 ms kö och 11016 ms rendering. Inga verkliga
kamerabilder eller mikrofoninspelningar användes. Visuell läppsynk är inte
godkänd och alla tänkbara övergångsblinkningar är inte verifierade.

Första Gateway-försöket, `dep-dat0mb17lnhs73b6fjkg`, stoppades innan
konfigurationsbyte eftersom en äldre backup redan fanns. Rättningen behåller
den och skapar en innehållsadresserad backup för en annan konfigurationsversion.
45/45 konfigurations-, start- och runtimepakettester passerade.

Manual Deploy användes på de befintliga tjänsterna. Ingen Blueprint Sync,
ny tjänst, nyckelrotation eller ändrad GPU-kapacitet. Den senare minnesdeployen
ändrade endast Director; kamerakoden i arbetskopian ingår inte i `e6ea969`.

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

Astrids sparade val är nu GPT-6 Luna. Modellerna kan väljas i båda labbens Probe-editor.
Latensen avser textbeslutet, inte skapandet av läppsynkvideo. Relay-svaret
innehåller inte tokenkostnad eller bevis för faktiskt laddad providermodell.
Råresultatet hålls privat i Windows temp, `croupier-probe-model-eval-complete.json`.

## Rätt lokal vy

Starta i [Lissabon](http://127.0.0.1:4201/lissabon), välj **Anslut**.
Direktlänken är <http://127.0.0.1:4200/?dealer=astrid&presentation=local>.
`presentation=local` väljer Emils porträttfilmer och de gemensamma policyerna.
`rehearsal=1` lägger bara till repetitionskontroller; utan `presentation=local`
väljs den äldre presentationsvägen. Porträttfilmen visas även på dator.

Aktiva Probe-prov använder localhost:4210/4211 med bevarad separat spelar-DB.
Sedan återstarten 10:10 Stockholm läser både QA och vanliga 4200/4201 samma
sparade `lissabon/data/project.json`. Revision, idlepolicy med 13 varianter
och klippfamiljer matchar i båda produktservrarnas konfigurations-API.
QA-labbet är <http://localhost:4211/lissabon>; Anslut öppnar dess spelare på
localhost:4210. Valfria launcherargument `playerDataDir` och
`browserHostname` separerar testprofilen och behåller rätt värdnamn utan
att skapa ännu en kopia av projektinställningarna. Åtta launchertester gröna.
Idle kräver Spara och omladdning av spelet efter avslutad hand. Övriga
sparade klipp-/Probe-val läses vid nästa beslut. Privata återstartsuppgifter
finns via ignorerade `lissabon/data/qa-recovery.json`.
Manifestkontrollen verifierade 42 filer i 26 familjer. Filnärvaro och hash
är inte visuellt godkännande av läppsynk eller kortkontakt.

Ett browserprov visade att normala idlevariationer kunde avbryta väntande
videogenerering via klientens lugnt-läge-veto. Klienten skiljer nu denna
bakgrundsrörelse från spelhandlingar/annan chatt och begär neutralt bildläge
när paketet är färdigt. 23/23 riktade Probe-/presentationsprov passerade.
Provresultatet ligger kvar separat från den periodiska närvarostatusen.
Samtliga 25 pre-commit-kommandon och `audit-dealer-sync --probe` passerade.

Vid den tidigare Probe-kontrollen visade spelaren ett fullständigt `played`-
kvitto för Luna: "Two consecutive wins with A♥ 10♠—quite a striking repeat."
Den syntetiska repliken sparades inte som spelarminne. Därefter tog Jakob
QA-sessionen i bruk och spelade/chattade där; den lämnades orörd. Efter den
senare Director-deployen kontrollerades två vanliga chattar med genererade
talpaket enligt början av detta kvitto. Inget nytt visuellt läppsynkgodkännande
har utfärdats. QA-servern lämnas körande för den öppna sessionen; den ska inte
städas medan Jakob använder den.

## Kamera och mikrofon

Förslaget är mottaget men inte aktivt. Versionskontroll och konkret kontraktsplan
finns i [ASTRID-CAMERA-VOICE-PLAN.md](ASTRID-CAMERA-VOICE-PLAN.md).
Ingen kamerabild eller mikrofoninspelning har skickats i denna verifiering.
