# Astrids sociala labbchatt — 20 september 2026

Runtimekällrevision: `6797b6a`. Lokal studio levereras i följande commit.

## Verifierat

- Director och privat Gateway är live på `6797b6a`. Render-deployer:
  `dep-danlaejtqb8s73c9v5l0` respektive `dep-danlb4mgekts739bj320`.
- Gatewayloggen bekräftar runtimepaket `2026-09-20.2`, ny isolerad
  `croupier-social`, inga rollvarningar. Upstream är fortsatt `2026.9.5`.
- Riktig chatt i Chrome **och Codex-webview**: personlig förolämpning mot
  Astrid gav `social.ledsen`, bedömning 0,99 och exakt
  **”Oj, nu var du oförskämd.”**.
- Sparad Sarah/ElevenLabs-MP3: 27 629 byte, 1,671837 sekunder.
  Cache-ID `e3b692253b91b52f16a3864515d5781a2b467ed82ecadfecb7e0f4c47ff53614`.
  Ljuduppspelning startade i båda webbläsarna. Codex-skärmbilden visade
  händer framför ansiktet; rörelsen återgår till neutral och loopar inte.
- Fritt modellsvar: ”Trevligt att se dig — välkommen in.”, ingen ledsen-trigger,
  ny riktig MP3, cirka 2,5 sekunder för modell + tal i det enskilda provet.
  Ett citerat filmförolämpningsprov gav ingen trigger (cirka 1,2 sekunder).
  Det fria provet använde isolerad testpolicy; den sparade fasta policyn ändrades inte.
- 169/169 lokala labbtester, 98/98 Director/Gateway-tester, TypeScript och slutbygge godkända.
  Återspelning av neutralt ljud har ett särskilt regressionstest: andra uppspelningen
  får inte hitta på en ledsen reaktion.

## Vad detta betyder

[Kort användarguide](../../../../lab/SOCIAL-CHAT.md).
Chatten finns i Eventstudion under **Astrid → Bordet väntar**.
Den är skild från operatörschatten och IDE-inboxen. Social inställning och
rörelse har egna JSON-filer; eventprojektet och befintliga videoval bevaras.
OpenClaw föreslår text + tillåtet uttrycks-ID; kod kontrollerar revision,
scen, tröskel och paus före tal/rörelse. Inga nya nycklar eller rotationer.

Tidigare fyra identiska ”dela höger”-prov kunde vara standardurval trots
att ett alternativ markerats i editorn. Nu skiljs direkt variantpreview från
regeltest, och fyra högerrörelser har tydligare skilda poser utan ändrad riktning.

## Kvar / inte levererat

Detta är en verklig **labbkedja**, inte produktens spelarchatt. Bestående
spelarminne, redigerbar Astrid-personlighet, produktkö/variantadapter,
nya godkända videopaket och verifierad läppsynk återstår. Ingen produktvideo,
spelregel, RNG, användardatabas eller kalibreringsbaseline har ändrats.
Modellens bedömning är inte en kalibrerad sannolikhet.

Nästa tydliga uppdelning är **redigera nod**, **simulera testkontext** och
**se utfallet**. Simulerad framtoning är inte en sparad personlighet eller
ett verkligt spelarminne. Representativa videor måste granskas mot exakt
situation, riktning/box och taltext, inte godtyckligt fördelas över 16 noder.

Slutlig UI-förtydligande ändrar inga kontrakt: ”Redigera vald nod”,
”Simulera kontext för eventtest” och uttrycklig märkning av eventtestets
beslutskedja. Minne/personlighet och social chatt är inte dessa simulerade värden.

Metadataöversyn: exakt `goodluck` finns som native MP4 med tal; insurance/double
har H264-indexposter. Fyra performance-deal-takes har granskningsstatus, inte
bevisad full box-/handtäckning. Idle har indexpost. `speak.other` kräver exakt
underreplik, och ingen exakt fristående film bevisades för reveal/turn/fem settle-
grupper. Nuvarande labbregister läser UUID-original, inte dessa bearbetade paket.
Nästa steg kräver därför en smal explicit adapter, inte 16 automatiska gissningar.
