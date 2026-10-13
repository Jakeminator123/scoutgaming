# Terminologi

Aktiv ordlista, samordnad med N1-målkontraktet 13 oktober 2026. Namnen gäller
dokumentation och nya gränssnitt; produktionsstatus finns i
[handoffen](../../docs/JOHN-HANDOFF.md) och handhavande i [guiden](README.md).

## Ytor och åtkomst

| Namn | Vem | Adress |
|---|---|---|
| Intern administration / kontrollrum, nivå 1 | Intern personal | `/admin`; `/control` bevaras under övergången |
| Partnerportal, nivå 2 | Operatörens personal | `/partner/{operatorSlug}` |
| Spelaryta, nivå 3 | Spelare: lobby, profil och historik | `/lobby`; äldre `/play`-länkar bevaras |
| Spelklient | Spelaren vid bordet | `/play/blackjack`, `/play/roulette`; spelmotorn finns på Render |

Servern kontrollerar identitet, rättighet, medlemskap och resursägarskap.
Produktåtkomst och repobehörighet är separata. Studio är innehållsredigering
inom nivå 1. `/studio` är ett tekniskt basePath, inte en fjärde produktnivå.
Nya N1-ytor använder `/admin`; fungerande äldre routes, inloggningar och
sparade spellänkar får inte beskrivas som redan avvecklade.

## Ett sammanhängande flöde

**Spelbolag → rum (= bakgrundsmiljö) → spel → uttryckligt tillåtna bord och dealerklippsuppsättningar.**

Detta är målmodellen för nya admin. Ett bolagsägt rum kan ha flera spel med
separata spelbindningar. Rum, bakgrundstillgång, bord, dealer och sammansättning
har olika identiteter. Ett bord är ett visuellt förgrundslager, aldrig ett rum.
En sammansättning beskriver presentationen med valda lager och profiler.
Bakgrunder kan återanvändas mellan spel; bord/dealerklipp måste vara uttryckligt
tillåtna för respektive spel. Äldre enspelsrum och frysta paket behåller sina
ID:n. Detta är inte ett kvitto på färdig multi-game-migrering; följ
[runtimekontraktet](../../docs/LOCAL-PRESENTATION-RUNTIME.md).

**Bolag & team** hanterar organisation och åtkomst. **Spelrum & publicering** hanterar samma bolags spelutbud. Valt bolag följer länkarna. Partnerns **Spelrum** visar samma rum och tillåtna val, utan en separat kopia av innehållet. **Provspelning & logg** hör till den valda dealern eller det valda rummet och visar observerad uppspelning, inte global drift.

**Arkivera** döljer och avaktiverar en resurs med dess historik bevarad. Ett återställt spelrum blir väntande och öppnas separat. Bolagets papperskorg kopplar loss dess rum; återställning av bolaget öppnar inga rum automatiskt. Dealerarkivering samlar AI-avstängning, klipp, berörda sammansättningar och avpublicering av spelrum i en bekräftad åtgärd. Återställning ger utkast med tal avstängt och öppnar inga rum. Permanent mediaradering är en separat, beroendekontrollerad åtgärd.

## Begrepp

| Teknisk/engelsk term | Svenska | Betydelse |
|---|---|---|
| Game engine | Spelmotor | Äger kort, regler, saldo och utfall. Körs på Render. |
| Game event / signal | Spelhändelse / spelsignal | Förändring i spelet respektive information till presentationen. |
| Presentation adapter | Presentationsadapter | Översätter spelsignaler till presentationshändelser. |
| Presentation event | Presentationshändelse | Instruktion: `idle`, `deal`, `reveal`, `turn`, `settle` eller `speak`. |
| Admin event | Administrationshändelse | Ändrad roll, konto eller publicerat paket; skiljs från spel- och presentationshändelser. |
| Presentation director | Presentationsregissör | Ansvar för tillåtet klippurval och uppspelningsplan; ingen ny tjänst. |
| Dealer | Dealer | Person med egna klipp: grundloop som vänteläge och händelseklipp som spelas när matchande spelhändelser inträffar. |
| Table layer | Bordslager | Den visuella bordsytan. En bild ger ett statiskt bord; detta är inte ett spelrum. |
| Background layer | Bakgrundslager | Separat bakgrund som ligger kvar under dealerbyten och händelseklipp; video loopas. |
| Presentation lane / composition | Sammansättning | Samma återanvändbara innehållsbegrepp: dealer, bord, bakgrund, tillåtna alternativ och placering. Lagringsfältet `lanes` och stabila ID:n behålls för kompatibilitet. |
| Game lane | Intern uppspelningskonfiguration | Teknisk koppling till renderer och dealer. Hanteras automatiskt när ett spelrum skapas; ingen egen resurs i det vanliga arbetsflödet. |
| Operator package | Bolagets publicering | En versionssatt, fryst samling sammansättningar, tillåtna val och spelrum för ett bolag. |
| Branding | Designprofil / varumärke | Utseende och tillåtna designval. Varumärket är ingen behörighetsgräns. |
| Layers / mask | Tre lager / mask | Bakgrund, dealer och bord respektive avgränsning av synliga bilddelar. |
| Full-frame / chroma key | Fullbild / grönskärm | Inbakad bild respektive klipp som kan friläggas med sparade inställningar. |
| Media asset / registry | Mediafil / mediaregister | Filens bytes respektive ID, metadata och filreferens. |
| Display name / clipLabels | Visningsnamn | Klippets läsbara namn, skilt från filnamn och ID. |
| Event clip | Händelseklipp | Klipp för en situation, exempelvis utdelning eller replik. |
| Idle / base clip / idle variant | Grundloop / basklipp / variation | Grundloop och idle är samma vänteläge. Basklippet är dess återkommande huvudfilm; en variation är ett kort avbrott. Både Astrid och egna dealers kan ha ett separat sparat schema med flera basklipp och variationer. Utan eget schema används den egna dealerns enda valda grundloop. |
| Till skon | VILA → REDO | Övergång från båda händerna i vila till vänster hand vid kortskon. Fack `transition.shoe` / `to-shoe`. Spelas från idle före första givningen. |
| Från skon | REDO → VILA | Övergång tillbaka till båda händerna i vila. Fack `transition.shoe` / `from-shoe`. Spelas till idle efter sista givningen. |
| Clip set | Klippuppsättning | En dealers standardklipp och alternativ för ett presentationsbehov. |
| Default / variant | Standardvariant / variant | Grundval respektive alternativ i klippuppsättningen. |
| Event group / situation | Händelsekategori / situation | Äldre samlingsgrupp respektive exakt plats, utfall eller replik. ”Deal vänster” omfattar flera platser; valt klippfack behåller den exakta situationen. |
| Trigger / policy | Villkor / urvalsregler | Krav för att få väljas respektive hur valet görs bland tillåtna alternativ. |
| Speech line ID / speech set | Replik-ID / replikset | Exakt tal-ID respektive text, ljud, video, bildindex, kalibrering och godkännandenotering. |
| Playback plan | Uppspelningsplan | Klipp, lager, ordning och synkpunkter för spelklienten. |
| Playback receipt | Uppspelningskvitto | Spelarens rapport om urval, start, bild, slut eller avbrott. Urval är inte uppspelning. |
| Rehearsal | Provspelning | Test och observation i den verkliga spelklienten. Visuell mediaacceptans omfattar två uppspelningar i följd. |
| 2D fallback | 2D-reserv | Bord och kort visas utan dealervideo när media eller lagerpaket saknas. |
| Probe | AI-småprat vid inaktivitet | Astrids talinitiativ när spelaren är inaktiv och bordet är lugnt. Teknisk benämning: Probe. |
| box0–box6 | Spelarplats 1–7 | Separata kortdestinationer i modellen; visningen räknar från 1. Tom position hoppas över utan reservfilm. |
| deal.player.left / centre / right | Utdelningsgrupp vänster / mitten / höger | Tekniska eventgrupper för platser 1–2, 3–5 respektive 6–7; exakt box avgör destination. Inte grundloopar. |
| dealer-up / dealer-hole | Dealerns öppna / dolda kort | Skilda kortdestinationer; ett generellt utdelningsklipp ersätter inte dessa. |
| reveal | Visa dealerns dolda kort | Eget moment efter utdelningen. |
| handIndex / card | Hand / kortnummer | Exakta värden följer spelhändelsen; ändras inte vid namnbyte. |
| Studio preview | Provspela | Uttryckligt startat blackjackprov från en sparad sammansättning. Tidsbegränsad adminsession med sparade biblioteksval; publicerar inget bolagspaket och använder inga riktiga spelarkonton. |
| Preview clip | Förhandsvisa klipp | Lokalt provval; publicerar eller binder inget runtimeklipp. |
| Composition | Sammansättning | Nivå 1:s gemensamma redigering av dealer, bord, bakgrund samt storlek och placering per format. Namnet väljs av användaren; ett stabilt tekniskt ID skapas automatiskt. Geometrin fryses vid publicering; nivå 2 väljer tillåtna, kompatibla alternativ. |
| Publish | Publicering | Fryser sparade presentationer i ett bolagspaket. |
| Room | Spelrum / miljö | Bolagsägd spelresurs med eget stabilt ID och separata spelbindningar i målmodellen. Äldre enspelsrum bevaras. |
| Table asset | Bord | Spelspecifikt visuellt förgrundslager med egen identitet. Äldre URL-parametern `table` anger däremot ett verkligt rums-ID; den döps inte om här. |
| Frozen dealer idle | Publicerad grundloop | Egen dealers exakt registrerade film, filhash och inställningar vid publicering; påverkas inte av senare utkast. |
| Frozen dealer events | Publicerade händelseklipp | Paket v3 fryser egna dealers sparade händelsekopplingar, grundloopschema och exakta filmer. Biblioteksklipp utan koppling eller schemaval ingår inte. V2-paket behöver återpubliceras, och runtime måste stödja v3. |
| Dealer idle policy | Dealerns grundloopschema | Separat sparade basklipp och variationer med Automatik, OpenClaw eller Bara manuellt. Samma uppspelningsstyrning används för varje dealer. Egna dealers stöder även Regler med explicit sparat villkor för utdelning/vändning och Klippval=Regler. Grunddealerns äldre idleeditor har inte den regelkopplingen. |

Äldre UI-ord Eventgrupp, Linje, Trigger och Policy ska ersättas med
**Händelsekategori, Klippuppsättning, Villkor och Urvalsregler**.

## OpenClaw och urval

| Funktion | Ansvar |
|---|---|
| Urvalsagent | Ger validerbart AI-råd bland redan tillåtna varianter. |
| Studioassistent | Förklarar konfiguration; chatsvaret sparar ingen ändring. |
| Croupieragent | Hanterar spelardialog genom separat serveradapter. |
| Agentanslutning | Serveranslutning till OpenClaw; credentials stannar på servern. |

| Urvalsläge | Val |
|---|---|
| Standard | Standardklippet. |
| Regler | Tillåtna urvalsregler. |
| Slump | Slumpaktiverade kandidater. |
| OpenClaw | Validerat AI-råd; godkänt reservval vid saknat, sent eller ogiltigt råd. |
| Skuggläge | Standard spelas, AI-rådet registreras. |

**Automatisk** grundloopvariation är en tidsstyrd färdig rörelse, utan AI-anrop. **OpenClaw-reaktion** väljer en tillåten rörelse utifrån observerad chatt (högst 8 meddelanden, totalt 3 200 tecken). **AI-tal** skapar ny text som går vidare till röst och läppsynk; en klippväljare skapar inte tal.

Vanligt klippval får den publika spelhändelsen och tillåtna varianter. Testpanelens extra sammanhang är uttryckliga testvärden. De äldre sammansättningsfälten för OpenClaw, probe och idle är dolda och deras tidigare sparade värden bevaras; de styr inte dagens spelare. Aktiva dealerpolicyer och spelflikens läge används. Astrids sparade utdelningsfrekvenser väljer lokalt utan modell.

OpenClaw ändrar inte kort, regler, saldo eller utfall.

## Bolag och konton

| Term | Betydelse / plats |
|---|---|
| Operatör / bolag | Spelbolaget som får ett publicerat utbud; organisation med stabilt ID och läsbar slug. Spelbolag → Bolag & team. |
| Spelrum | Bolagsägd spelresurs. Skapas under Spelbolag → Spelrum & publicering och visas i partnerportalen och spellobbyn. |
| Medlemskap / rollprofil | Personens bolagskoppling och namngivna rättigheter. Spelbolag → Bolag & team. |
| Inbjudan / aktiveringslänk | Ny partner aktiveras via `/partner/set-password`; befintlig partner kopplas direkt. |
| Partnersession | Inloggning på `/partner/login`; öppnar inte Kontrollrum. |
| Produktkonto | Produktinloggning. Spelare och intern personal hanteras under Konton & roller. |

Partnerns designval kräver `presentations.configure` och begränsas till paketets
enskilda sammansättning. Bord och bakgrund kan vara bild eller video. Fullbildsklipp
behåller inbakade lager tills ett separat ersättningspaket har godkänts.
Marker/kort har ännu inget publicerat designkontrakt; deras värden och utfall
ägs av spelmotorn.
Bolagets partnerpersonal och intern adminpersonal hanteras separat.

## Flöde


```text
Nivå 1 / Studio:      Dealer + bord + bakgrund → Sammansättning
                                                        │
Nivå 1 / Spelbolag:   Bolag + team → Spelrum + publicerad version
                                                │               │
Nivå 2:                          Samma spelrum + tillåtna val    │
                                                └───────────────┤
Nivå 3:                              Bolagets lobby → spelrum → spel

Spelmotor → spelsignal → klippurval → uppspelning → uppspelningskvitto
```

Nivå 1 äger dealerklippens sekvenser, grundloopens regler, bord- och bakgrundsbiblioteket samt publicering och bolagstilldelning. Nivå 2 får API-åtkomst, granskning och tillåtna mindre designjusteringar; sekvensredigering ligger kvar på nivå 1.
Dealerbibliotekets antal är inte antalet spelbara rum. Spelarens bolagslobby visar endast öppna rum i ett publicerat paket och de dealer- och miljöval som fungerar där. Rummet är en spelbar ingång till paketet, inget nytt mediainnehållslager. **Bordets utseende** är scenens bordslager.

Skapa spelrum återanvänder eller skapar en kompatibel intern uppspelningskonfiguration. Den är inget separat val i arbetsflödet.
Spelklienten sköter uppspelning och scenkomposition. Fullbildsklipp behåller
inbakade bord och bakgrunder; separat lagerval tar inte bort dessa pixlar.

## Meny och adresser

| Meny | Sidor och ansvar |
|---|---|
| Studio | Dealers & klipp `/control/clips`, Dealer Forge `/control/dealer-forge`, Bord & bakgrunder `/control/library`, Sammansättningar `/control/compositions`. |
| Spelbolag | Bolag & team `/control/companies`, Spelrum & publicering `/control/rooms`. |
| Drift | Spelstatus & integritet `/control/administration?tab=operations`, Betalningar & journal `?tab=finance`. |
| System | Konton & åtkomst `?tab=accounts`, API & integrationer `?tab=partners`, Agentmodeller och Intern agentchatt på `/control/openclaw`. |
| Sidfot | Översikt `/control` och Guide & hjälp `/control/guide`. |

Dealerns flikar är Grundloop, Klipp, Sammansättning, Tal & automatik, Svarsbibliotek, **Provspelning & logg** och Inställningar. Provspelning finns på `/control/rehearsal`. Klippbibliotek, händelsevillkor, talgranskning och AI-småprat nås inom dealerarbetet.

Partnerportalen har **Översikt**, **Spelrum**, **Team & behörigheter** och **Integration**. `/partner/{slug}/rooms` samlar rummets publicerade sammansättning, tillåtna ändringar, förhandsvisning och granskad publicering. Utkast bevaras vid interna menybyten; konto-/bolagsbyte och utloggning skyddas mot osparade ändringar.

Äldre adresser leder vidare: `/control/preview` → `/control/compositions`, `/control/lanes` → `/control/rooms`, `/control/lanes?tab=companies` → `/control/companies`, `/control/activity` → `/control/rehearsal`. `/zones` och `/control/zones` leder till `/control/preview`, som kanoniseras till `/control/compositions`. `/control/backgrounds` leder till `/control/compositions`. Gamla partneradresser behålls som alias till den gemensamma rumsvyn.

I Studio väljer `composition` sammansättning; gamla `lane`-länkar accepteras. `operator` anger bolagskontext och `table` ett verkligt rums-ID. På spelarens adress används bolagets slug: `/play/blackjack?operator=<slug>&table=<rum-id>`. Varken slug eller ID ger behörighet. Spelarens äldre tekniska `lane`-parameter är separat från den nya menyn.

## Acceptans och prov

| Område | Gäller nu |
|---|---|
| Bild och tal | Granska med `?dealer=<namn>&rehearsal=1`. Ändrad ljud-/videohash upphäver godkännandet. Kvitto, hash och grönt test ersätter inte visuell acceptans. |
| Registrerade dealers | Eget registrerat basklipp krävs. Paket v3 fryser grundloop, sparat eget schema och sparade händelsekopplingar. Spelrum kopplar rätt spellane automatiskt. Kräver rätt Renderkapacitet och visuell acceptans av faktiskt publicerade filmer. Live AI-chatt återstår. |
| AI-småprat vid inaktivitet | Textprovet skapar ingen röst eller video; produktionsacceptans återstår. Äldre zondata är separat från Sammansättningens bakgrundsfilmer. |
| Partnerportal | Bolagsåtkomst och paketens designval finns. Spelare, transaktioner och rapporter från spelmotorn återstår. |
