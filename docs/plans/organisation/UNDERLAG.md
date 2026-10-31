# Underlag: källor, rättelser och spårbarhet

Extern rot: `C:/Users/jakob/Desktop/SYSTEMANALYS/systemgranskning`. Alla 16 filer är lästa/registrerade i denna inventering, utan ändringar av originalen. Källorna är påståenden och bevis från olika tidpunkter, inte mandat. Prioritetsordning: Jakobs aktuella beslut → färsk kod/ref/molnobservation → befintlig sakguide → daterad rapport. Full filidentitet står sist i dokumentet.

## Hur materialet används

| Källgrupp | Användning och begränsning |
| --- | --- |
| S01/S02 originalrapporten | System-/riskinventering. Förslag och mognad 72/100 är inte uppmätta fakta; gamla P0-larm kräver omprövning. PDF 12 sidor, Markdown används för fil-/radspårning. |
| S03–S06 Grok-delarna | Konkreta G1–G4-kontroller mot äldre main `221c40b`; deras gemensamma fynd täcks av M01–M26 nedan. De är inte dagens molnstatus. |
| S07 Grok-masterplan | Deduplikerade M-fynd och tidigare prioritering. Varje rad bedöms nedan, inte automatiskt beställs. |
| S08 Fable-masterplan | F-01–F-25 och E-01–E-09. Begränsat filunderlag gav uttryckliga kunskapsluckor och en felaktig tolkning av historisk Render-SHA. |
| S09 jämförelsen | Hjälper skilja verifiering från syntes och hitta kompletterande E-fynd. Modellpoäng/kostnad används inte som produktbevis. |
| S10 fable-meta | Metadata för den äldre körningen, inte systemstatus eller budget för detta uppdrag. |
| S11 Kevin-grenar | Historiskt jämförelseunderlag. Förslag om radering/taggar följs inte: andras brancher skyddas och ingen historikåtgärd ingår. |
| S12/S13 L3-avslut | Bevis för redan levererad L3/valuta/Admin och kvarstående livscykelfrågor. Säkerhetsavsnitt med två öppna incidenter har passerats av nyare observation. |
| S14/S15 sista granskningen | Bra A/B/C-idé och tvärgående teman. `master`-berättelsen avfärdas; talprocess/systemkarta/workspace/repo-byte är förslag, inte alla beslutade genomföranden. PDF 8 sidor. |
| S00 LASMIG | Beskriver den externa utredningskörningens mappstruktur. Begränsar inte Jakobs nya beställning i `docs/plans/organisation`. |

## Alla M-fynd till ny bedömning

Bedömning avser inventeringsbasen i [NULAGE](NULAGE.md). Status för själva genomförandet finns endast i den länkade aktivitetsfilen.

| Äldre ID | Bedömning nu | Aktivitet / disposition |
| --- | --- | --- |
| M01 GitGuardian | Incidentantalet är passerat; 0 öppna/25 ignorerade enligt repoagenten. Historisk scan är fortfarande ofullständig. | [SEC-03](omraden/03-auth-och-sakerhet/aktiviteter/SEC-03.md), ingen blind rotation/incidentändring. |
| M02 tal utan bank | Konkret startkoppling kvar; paus-/bankskydd bevaras. | [TAL-02](omraden/05-tal-och-ai/aktiviteter/TAL-02.md) och GEM-02. |
| M03 delad nyckel | Aktuell handoff beskriver redan genomförd separation; inga värden lästes här. | [GEM-02](gemensamt/aktiviteter/GEM-02.md), [TAL-03](omraden/05-tal-och-ai/aktiviteter/TAL-03.md); inte ny rotation från gammal text. |
| M04 release/SHA | Strukturellt behov kvar. Aktuellt prodglapp är enbart dokumentdiff; inte belagd runtimeinkompatibilitet. | [REL-01](omraden/02-release-och-drift/aktiviteter/REL-01.md), senare REL-03. |
| M05 valuta/wallet | Angivna valutafel redan levererade #708/#711; intern demo stödd. Extern wallet är blockerad. | [ADM-03](omraden/06-admin-och-produkt/aktiviteter/ADM-03.md) avgränsar återstoden. |
| M06 F11 | Kod mergad #529, driftacceptans kvar. | [GAM-01](omraden/04-spel-och-adaptrar/aktiviteter/GAM-01.md); ingen omimplementation från rapporten. |
| M07 callback | Prod-rättning redan dokumenterad. Inte livekontrollerad i RunPod här; preview-/bankidentitet kvar. | TAL-03 och DOC-01; ingen GPU-aktivering. |
| M08 generated stream | Bekräftat gap i aktuell kod och arkitektgranskning. | [TAL-01](omraden/05-tal-och-ai/aktiviteter/TAL-01.md). |
| M09 CI-läsroll | Kommentar och faktisk rollrättighet måste stämmas av; lästransaktion gör inte approllen skrivskyddad. | [DAT-01](omraden/07-data-och-media/aktiviteter/DAT-01.md); ingen DDL som sidosteg. |
| M10 Secure | Bekräftat på preview_session. | [SEC-01](omraden/03-auth-och-sakerhet/aktiviteter/SEC-01.md). |
| M11 preview-README | Dokumentdrift kvar, separata resurser är verifierade. | [DOC-01](omraden/01-repo-och-dokument/aktiviteter/DOC-01.md). |
| M12 historiska SHA | Gamla SHA/PR-påståenden används inte som aktuell release. main är e20fe6f… | NULAGE, DOC-01 och REL-01. |
| M13 talpilar | Speech är ingress; orkestrering finns i motorn/Studio. | NULAGE rättar kartan; [DOC-03](omraden/01-repo-och-dokument/aktiviteter/DOC-03.md) för härledd vy. |
| M14 routing | Två Vercel-projekt delar routing, med branchfilter; inget nytt projekt behövs. | DOC-01/DOC-03; bevara Ignored Build Step. |
| M15 decision-cache | Studio-cache och motorns journal har olika garantier. Ny ledger är inte beslutad. | [GAM-03](omraden/04-spel-och-adaptrar/aktiviteter/GAM-03.md). |
| M16 cookies | Gemensam policy kan förenklas; Strict/Lax och sessioner får inte slås ihop blint. | [SEC-02](omraden/03-auth-och-sakerhet/aktiviteter/SEC-02.md). |
| M17 native/bo | Levande konsumenter bekräftade. Namnet visar inte att vägen kan raderas. | [GAM-02](omraden/04-spel-och-adaptrar/aktiviteter/GAM-02.md), ADM-01. |
| M18 lane-begrepp | Begreppen behöver skiljas, inte massbytas. | [DOC-02](omraden/01-repo-och-dokument/aktiviteter/DOC-02.md). |
| M19 toolchain | Versions-/typmismatch bekräftad; större omläggning kräver nytta. | [CI-01](omraden/08-toolchain-och-ci/aktiviteter/CI-01.md), CI-02/03. |
| M20 Astrid-hårdkodning | Dealer-generisk väg behöver kontrolleras mot aktivt kontrakt; Astrid ska avvecklas enligt separat REN-START. | TAL-03, GAM-02, DAT-03; inget generellt bevarande på grund av källnamn. |
| M21 Node-README | Node 22-text är stale; pin är 24.21.0. | DOC-01 och CI-01. |
| M22 preview-synk | Main-merge uppdaterar inte preview automatiskt; preview ligger äldre. | [REL-04](omraden/02-release-och-drift/aktiviteter/REL-04.md), DOC-01. |
| M23 UI-ord | Äldre fil-/textreferenser behöver omprövas mot dagens UI. | DOC-02, utan sträng-/menylås. |
| M24 sökvägar | Fel rapportvägar blir inte nya kodobjekt eller uppgifter. | Rättade pekare i denna plan; DOC-01/DOC-03. |
| M25 bedömningssiffror | 72/100 och fördelade insatsprocent saknar mätbas. | Avförda ur planens prioritering; inga veckolöften härleds. |
| M26 bekräftad topologi | Grundbilden kvarstår, med precisering av ansvar/pilar. | Ingen ombyggnad beställs bara för att diagrammet finns. |

## Fables verifieringar och egna tillägg

| Äldre F-ID:n | Hantering |
| --- | --- |
| F-01/02/03/10/11/13/15/22/25 | Grundtopologi/kontrakt stäms av mot faktiska repo-/driftkällor; tidigare ej bifogad fil är kunskapslucka, inte konstaterat fel. DOC-03 och DAT-01 ger rätt källspår. |
| F-04/05/06/07/16/17/19/21/24 | Tidskänsliga fynd ersätts av M01/03/04/06/07/09/11/12/21/22-bedömningen ovan och NULAGE. Historisk fbc473c6 är inte nuvarande Render-SHA. |
| F-08/09/12/14/18/20/23 | M16–M20/M25 och motsvarande DOC/SEC/GAM/CI/GEM-aktiviteter. Ingen massrename eller ny ledger/workspace utan behov. |

| E-ID | Bedömning / aktivitet |
| --- | --- |
| E-01 generated speech | Bekräftat; TAL-01. |
| E-02 processkoppling | Bekräftad startkoppling; TAL-02 före eventuell TAL-04/T8. Behåll talets fail-closed-kontroll. |
| E-03 preview-ruleset | Avfärdat som aktuellt fel: aktivt ruleset 26090808. DOC-01 rättar dokumentation. |
| E-04 röstkonto | Specifika dealer-/kontoidentiteter behöver verifieras; TAL-03, inga nycklar byts här. |
| E-05 typpaket | Bekräftad versionsfriktion; CI-01. |
| E-06 backup/PITR | Inställning/verktyg finns men restore/offsite-acceptans saknas; REL-02. |
| E-07 processlokal chatt/kvot | GAM-03 skiljer accepterat flyktigt tillstånd från hållbara kvitton och global providerbudget. |
| E-08 deployverktyg | REL-01/03 och GEM-02; verktygsanrop/env-skrivning kan driftsätta direkt, så inventeringen är läsande. |
| E-09 legacykonsumenter | Bekräftat; GAM-02 ersätter konsumenter före radering. |

## Senaste rapportens nio teman och kompletterande fynd

Dokument/source of truth → DOC-01/03. Repo-/filstruktur → GEM-01 och separat GEM-03. Backend → GAM. Tal/AI → TAL. Release → REL. Konfiguration → GEM-02 och respektive tjänstägare. Auth → SEC. Toolchain → CI. Data/media → DAT. Därmed täcks alla nio teman utan nio konkurrerande systemregister.

Nya/skärpta restpunkter från aktuell handoff: L3 steg 7 och Dragan-konfig → ADM-01; kompatibel materialersättning/gallring → DAT-02/03; bevarade prototyper och UX → ADM-02; partnerwallet/bolagssteg → ADM-03; Slack → TAL-05. Repoagentens tillägg om mellanliggande Git-objekt före push → CI-04. Nya fynd följer [beslutsprotokollet](ARBETSSATT.md#nya-fynd-och-omplanering).

Full källidentitet följer nedan. SHA-256 identifierar filerna som faktiskt lästes, inte deras påståendens riktighet. Inga fulla agentkontexter eller externa rapportkopior läggs i Git.

## Källfiler och SHA-256

| ID | Sökväg relativt extern rot | Byte | SHA-256 |
| --- | --- | ---: | --- |
| S00 | LASMIG.md | 571 | e85490c6c15de16d92ce071505821c27526d6773a2f332a5f567ed36d5a3e358 |
| S01 | 1-input/deep-research-report.md | 29618 | 59f812a01c854eee34841c0e2e26f99e0267e3a1337417f17e28614f6312349e |
| S02 | 1-input/Systemkarta och arkitekturgranskning av \`Jakeminator123_scoutgaming\` — \`main\`.pdf | 286169 | cbb5cfb2f3c7262961e4397250942270a50fa38c50e04cd53627e2583df6b5be |
| S03 | 2-svarm/grok-del1.md | 11942 | fc7aad458eec03595958db208275fd9f86f1dc5bcae86112e43807c061e2ca7d |
| S04 | 2-svarm/grok-del2.md | 7372 | c0c770432b9f48a63570faae77253e6854c45fef47accb03d01853dc61bfcb33 |
| S05 | 2-svarm/grok-del3.md | 7603 | e4dd9d8d38e755be596b0948423775ff4907ea5507b8f44e9c029600bbb6b150 |
| S06 | 2-svarm/grok-del4.md | 11521 | 5127ecc1d0f272300e122d1d6ef29db02dc9d6e3955798e7187cfbea89460ceb |
| S07 | 3-resultat/grok-masterplan.md | 10239 | 12d6ea63ecc34c1ac81c95769b9f50b7c09e61e5e6fefb60e4446d8b265c17c5 |
| S08 | 3-resultat/fable-masterplan.md | 11985 | 2db6cce5c8e1ddfbbe4299bc9040ef47fa7230c7c61cca7b5a823d157bccf816 |
| S09 | 3-resultat/jamforelse.md | 5351 | 0fb3b52a354a0c85c79acc8a2962b67621d303a84805520fe099f3437dc37675 |
| S10 | 4-ovrigt/fable-meta.json | 464 | 4435f25a7d9bdbb71fa992550088bffb4221f45ee0e22f79abf058fffa55c415 |
| S11 | 4-ovrigt/grenar-kevin.md | 19551 | 87c032b7fcb3f8875594ebe0cba9fd362a6a3d41d3ad068bb33c767fa6787995 |
| S12 | 4-ovrigt/l3-closeout-20261030-REPORT.md | 17682 | e53ff29828391366c9c0e54233185d622c73efd8a35916b919d093763a73a3d3 |
| S13 | 4-ovrigt/l3-closeout-20261030-NEXT-AGENT.md | 7527 | 05ce2ccf0537c186b67f8c42cb038b4fc890ebc4e898b8f4d48d6f2563b1a93c |
| S14 | 5-sista-granskning/deep-research-report arbetskarta - 2.md | 19995 | b38723ab396c1687b7d0c903dc8b688a8c39ea9e321a57d405a9160edab95e2d |
| S15 | 5-sista-granskning/Scoutgaming_ arbetskarta för ett renare, begripligare och mer robust repo.pdf | 221624 | deee1808c1e39eea558bae691339780e32eb373dd0cd0794fcdd0d6c14caa910 |
