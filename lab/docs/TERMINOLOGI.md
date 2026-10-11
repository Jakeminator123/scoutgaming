# Terminologi

Aktiv ordlista, samordnad med lokal Studio-kod 10 oktober 2026. Namnen gäller
dokumentation och nya gränssnitt; produktionsstatus finns i
[handoffen](../../docs/JOHN-HANDOFF.md) och handhavande i [guiden](README.md).

## Ytor och åtkomst

| Namn | Vem | Adress |
|---|---|---|
| Kontrollrum, nivå 1 | Intern personal | `/control` |
| Partnerportal, nivå 2 | Operatörens personal | `/partner/{operatorSlug}` |
| Spelaryta, nivå 3 | Spelare: lobby, profil och historik | `/play` |
| Spelklient | Spelaren vid bordet | `/play/blackjack` |

Servern kontrollerar identitet, rättighet, medlemskap och resursägarskap.
Produktåtkomst och repobehörighet är separata. `/studio` är ett tekniskt basePath.

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
| Presentation lane | Presentation / presentationsprofil | Återanvändbar profil med standardval, tillåtna dealers/bord/bakgrunder, klipp och placering per format. Tekniskt presentationslane; ID ändras inte när visningsnamnet översätts. |
| Game lane | Spellane | Spelväg med renderer och dealer. Skapa spelrum återanvänder eller skapar kompatibel spellane automatiskt; manuell redigering finns under Avancerat. |
| Operator package | Partnerpaket (tekniskt operatörspaket / lane-paket) | Bolagets publicerade presentationer med dealer, bord och bakgrund, tillåtna operatörsval, spel/bord och revision. |
| Branding | Designprofil / varumärke | Utseende och tillåtna designval. Varumärket är ingen behörighetsgräns. |
| Layers / mask | Tre lager / mask | Bakgrund, dealer och bord respektive avgränsning av synliga bilddelar. |
| Full-frame / chroma key | Fullbild / grönskärm | Inbakad bild respektive klipp som kan friläggas med sparade inställningar. |
| Media asset / registry | Mediafil / mediaregister | Filens bytes respektive ID, metadata och filreferens. |
| Display name / clipLabels | Visningsnamn | Klippets läsbara namn, skilt från filnamn och ID. |
| Event clip | Händelseklipp | Klipp för en situation, exempelvis utdelning eller replik. |
| Idle / base clip / idle variant | Grundloop / basklipp / variation | Grundloop och idle är samma vänteläge. Basklippet är dess återkommande huvudfilm; en variation är ett kort avbrott. Både Astrid och egna dealers kan ha ett separat sparat schema med flera basklipp och variationer. Utan eget schema används den egna dealerns enda valda grundloop. |
| Clip set | Klippuppsättning | En dealers standardklipp och alternativ för ett presentationsbehov. |
| Default / variant | Standardvariant / variant | Grundval respektive alternativ i klippuppsättningen. |
| Event group / situation | Händelsekategori / situation | Redigeringsgrupp respektive sammanhang: plats, utfall eller exakt replik. |
| Trigger / policy | Villkor / urvalsregler | Krav för att få väljas respektive hur valet görs bland tillåtna alternativ. |
| Speech line ID / speech set | Replik-ID / replikset | Exakt tal-ID respektive text, ljud, video, bildindex, kalibrering och godkännandenotering. |
| Playback plan | Uppspelningsplan | Klipp, lager, ordning och synkpunkter för spelklienten. |
| Playback receipt | Uppspelningskvitto | Spelarens rapport om urval, start, bild, slut eller avbrott. Urval är inte uppspelning. |
| Rehearsal | Repetition | Visuell granskning i riktiga spelklienten med två uppspelningar i följd. |
| 2D fallback | 2D-reserv | Bord och kort visas utan dealervideo när media eller lagerpaket saknas. |
| Probe | Tal vid inaktivitet | Astrids talinitiativ när spelaren är inaktiv och bordet är lugnt. Teknisk benämning: Probe. |
| box0–box6 | Spelarplats 1–7 | Separata kortdestinationer i modellen; visningen räknar från 1. Tom position hoppas över utan reservfilm. |
| deal.player.left / centre / right | Utdelningsgrupp vänster / mitten / höger | Tekniska eventgrupper för platser 1–2, 3–5 respektive 6–7; exakt box avgör destination. Inte grundloopar. |
| dealer-up / dealer-hole | Dealerns öppna / dolda kort | Skilda kortdestinationer; ett generellt utdelningsklipp ersätter inte dessa. |
| reveal | Visa dealerns dolda kort | Eget moment efter utdelningen. |
| handIndex / card | Hand / kortnummer | Exakta värden följer spelhändelsen; ändras inte vid namnbyte. |
| Studio preview | Provspela | Uttryckligt startat blackjackprov från en sparad sammansättning. Tidsbegränsad adminsession med sparade biblioteksval; publicerar inget bolagspaket och använder inga riktiga spelarkonton. |
| Preview clip | Förhandsvisa klipp | Lokalt provval; publicerar eller binder inget runtimeklipp. |
| Composition | Sammansättning | Nivå 1:s gemensamma redigering av dealer, bord, bakgrund samt storlek och placering per format. Namnet väljs av användaren; ett stabilt tekniskt ID skapas automatiskt. Geometrin fryses vid publicering; nivå 2 väljer tillåtna, kompatibla alternativ. |
| Publish | Publicering | Fryser sparade presentationer i ett bolagspaket. |
| Room / table | Spelrum / spelbord | Bolagsägd spelresurs som kopplar fryst presentation till en verklig spellane. De två lane-ID:na behöver inte vara lika. |
| Frozen dealer idle | Publicerad grundloop | Egen dealers exakt registrerade film, filhash och inställningar vid publicering; påverkas inte av senare utkast. |
| Frozen dealer events | Publicerade händelseklipp | Paket v3 fryser egna dealers sparade händelsekopplingar, grundloopschema och exakta filmer. Biblioteksklipp utan koppling eller schemaval ingår inte. V2-paket behöver återpubliceras, och runtime måste stödja v3. |
| Dealer idle policy | Dealerns grundloopschema | Separat sparade basklipp och variationer med Automatik, OpenClaw eller Bara manuellt. Samma uppspelningsstyrning används för varje dealer. Regelstyrda idlevariationer är ännu inte anslutna. |

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

OpenClaw ändrar inte kort, regler, saldo eller utfall.

## Bolag och konton

| Term | Betydelse / plats |
|---|---|
| Operatör / bolag | Spelbolaget som tar emot tilldelade lane-paket från nivå 1; organisation med stabilt ID och läsbar slug. Administration → Bolag & team. |
| Bord / spelrum | Bolagsägd spelresurs. Skapas från Publicering tillsammans med paketet. Drift → Bord & spelrum visar den tekniska administrationen. |
| Medlemskap / rollprofil | Personens bolagskoppling och namngivna rättigheter. Administration → Bolag & team. |
| Inbjudan / aktiveringslänk | Ny partner aktiveras via `/partner/set-password`; befintlig partner kopplas direkt. |
| Partnersession | Inloggning på `/partner/login`; öppnar inte Kontrollrum. |
| Produktkonto | Produktinloggning. Spelare och intern personal hanteras under Konton & roller. |

Partnerns designval kräver `presentations.configure` och begränsas till paketets
enskilda lane. Bord och bakgrund kan vara bild eller video. Fullbildsklipp
behåller inbakade lager tills ett separat ersättningspaket har godkänts.
Marker/kort har ännu inget publicerat designkontrakt; deras värden och utfall
ägs av spelmotorn.
Bolagets partnerpersonal och intern adminpersonal hanteras separat.

## Flöde


```text
Nivå 1: Dealers & klipp ↔ Sammansättning → Publicering → bolagspaket (version)
        positioner,   dealer, bord,                   │
        repliker      bakgrund                        ▼
Nivå 2:                              Partnerns tillåtna designval
                                                       │
Nivå 3:                            Rumslobby → dealer och miljö → spel

Presentation → kompatibel spellane → spelrum/bord
Spelmotor → spelsignal → presentationsregissör → uppspelningsplan
                                                       │
                                              uppspelningskvitto
```

Nivå 1 äger dealerklippens sekvenser, grundloopens regler, bord- och bakgrundsbiblioteket samt publicering och bolagstilldelning. Nivå 2 får API-åtkomst, granskning och tillåtna mindre designjusteringar; sekvensredigering ligger kvar på nivå 1.
Dealerbibliotekets antal är inte antalet spelbara rum. Spelarens bolagslobby visar endast öppna rum i ett publicerat paket och de dealer- och miljöval som fungerar där. Rummet är en spelbar ingång till paketet, inget nytt mediainnehållslager. **Bordets utseende** är scenens bordslager.

Skapa spelrum i Publicering återanvänder eller skapar en kompatibel spellane.
Manuell administration av spellanes finns kvar under Avancerat.
Spelklienten sköter uppspelning och scenkomposition. Fullbildsklipp behåller
inbakade bord och bakgrunder; separat lagerval tar inte bort dessa pixlar.

## Meny och adresser

| Studio / undervy | Adress | Vad sidan innehåller |
|---|---|---|
| Dealers & klipp | `/control/clips` | Grundloop, Utdelning och Repliker per dealer. |
| Klippbibliotek | `/control/videos` | Mediafiler, registrering, metadata och händelsekoppling. |
| Sammansättning | `/control/preview` | Välj, skapa och namnge presentationen. Välj Dealer, Bord och Bakgrund; ändra Storlek och placering per format, förhandsvisa klipp och spara. |
| Publicering | `/control/lanes` | Välj bolag och presentation, skapa spelrum och publicera paket. All redigering av sammansättningen finns på Sammansättning; avancerad rumsadministration öppnas kontextuellt. |
| Händelser | `/control/events` | Händelsekategorier, klippuppsättningar, villkor och urval. |
| Tal vid inaktivitet | `/control/probe` | Automatik för Astrids inaktivitetstal och textprov. |

| Övrig meny | Innehåll |
|---|---|
| Översikt | `/control`: snabbval och bolagsarbetsytor. |
| AI & chatt | Agentmodeller; Operatörschatt är intern OpenClaw-chatt på `?tab=chat`. |
| Drift | Bord & spelrum, Spelintegritet, Uppspelning, Betalningar & journal. |
| Administration / hjälp | Bolag & team (`/control/lanes?tab=companies`), Konton & roller, Partners; Guide & hjälp i sidfoten. |

Studio har tre huvudval: Dealers & klipp, Sammansättning och Publicering.
Klippbibliotek, Händelser och Tal vid inaktivitet nås som undervyer från Dealers & klipp.
Sammansättning ersätter namnet Förhandsvisning;
`/control/zones` och `/control/backgrounds` leder dit. Bakgrundszoner är ingen
aktiv menypunkt. Avancerade inställningar ligger under utfällbara fördjupningar.

`operatorSlug` väljer bolag. Studios `lane` väljer presentation, medan spelarens
äldre `lane`-query väljer spellane. Ny rumslänk använder `operator` + `table`.
`dealer` väljer dealer inom tillåtna val.
En slug ger ingen behörighet. Händelser visar översikt utan `?event=` och
redigerare med `?event=`. `?variant=` används på Händelser och Klippbibliotek.
`#idle`, `#deal`, `#clips` väljer Grundloop, Utdelning respektive Repliker. Administrationens sidomenylänkar
väljer `?tab=tables|operations|finance|accounts`; inne på sidan finns även
Partnernycklar och Talgranskning.

Spelrum: `/play/blackjack?operator=<slug>&table=<rum-id>`. Render läser samma
bolagspaket på `/blackjack?operator=<slug>&table=<rum-id>`. Äldre ingång utan
table finns kvar. Okänt, inaktivt eller främmande rum ger inte någon reserv-lane.

## Acceptans och prov

| Område | Gäller nu |
|---|---|
| Bild och tal | Granska med `?dealer=<namn>&rehearsal=1`. Ändrad ljud-/videohash upphäver godkännandet. Kvitto, hash och grönt test ersätter inte visuell acceptans. |
| Egna dealers, exempelvis Nora och Johanna | Eget registrerat basklipp krävs. Paket v3 fryser grundloop, sparat eget schema och sparade händelsekopplingar. Spelrum kopplar rätt spellane automatiskt. Kräver rätt Renderkapacitet och visuell acceptans av faktiskt publicerade filmer. Live AI-chatt återstår. |
| Tal vid inaktivitet | Textprovet skapar ingen röst eller video; produktionsacceptans återstår. Äldre zondata är separat från Sammansättningens bakgrundsfilmer. |
| Partnerportal | Bolagsåtkomst och paketens designval finns. Spelare, transaktioner och rapporter från spelmotorn återstår. |
