# Terminologi

Aktiv ordlista, samordnad med lokal Studio-kod 9 oktober 2026. Namnen gäller
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

| Term | Betydelse |
|---|---|
| Spelmotor | Äger kort, regler, saldo och utfall. Körs på Render. |
| Spelhändelse / spelsignal | Förändring i spelet respektive information till presentationen. |
| Presentationsadapter | Översätter spelsignaler till presentationshändelser. |
| Presentationshändelse | Instruktion: `idle`, `deal`, `reveal`, `turn`, `settle` eller `speak`. |
| Administrationshändelse | Ändrad roll, konto eller publicerat paket; skiljs från spel- och presentationshändelser. |
| Presentationsregissör | Ansvar för tillåtet klippurval och uppspelningsplan; ingen ny tjänst. |
| Presentationslane | Återanvändbar profil med dealers, klipp, lager och urvalsval. Lane i Studio. |
| Spellane | Spelväg med renderer och dealer som klienten stöder. Lane i Administration. |
| Operatörspaket | Bolagets publicerade lanes, spel, bord, branding och revision. |
| Designprofil / varumärke | Utseende och tillåtna designval. Varumärket är ingen behörighetsgräns. |
| Tre lager / mask | Bakgrund, dealer och bord respektive avgränsning av synliga bilddelar. |
| Fullbild / Greenscreen | Inbakad bild respektive klipp som kan friläggas med sparade inställningar. |
| Mediafil / mediaregister | Filens bytes respektive ID, metadata och filreferens. |
| Visningsnamn | Klippets läsbara namn, skilt från filnamn och ID. |
| Händelseklipp | Klipp för en situation, exempelvis utdelning eller replik. |
| Grundloop / basklipp / variation | Idle-vänteläget, dess lugna huvudklipp respektive kort avbrott som en huvudrörelse. En grundloop kan ha flera sparade basklipp. |
| Klippuppsättning | En dealers standardklipp och alternativ för ett presentationsbehov. |
| Standardvariant / variant | Grundval respektive alternativ i klippuppsättningen. |
| Händelsekategori / situation | Redigeringsgrupp respektive sammanhang: plats, utfall eller exakt replik. |
| Villkor / urvalsregler | Krav för att få väljas respektive hur valet görs bland tillåtna alternativ. |
| Replik-ID / replikset | Exakt tal-ID respektive text, ljud, video, bildindex, kalibrering och godkännandenotering. |
| Uppspelningsplan | Klipp, lager, ordning och synkpunkter för spelklienten. |
| Uppspelningskvitto | Spelarens rapport om urval, start, bild, slut eller avbrott. Urval är inte uppspelning. |
| Rehearsal / repetition | Visuell granskning i riktiga spelklienten med två uppspelningar i följd. |
| 2D-reserv | Bord och kort visas utan dealervideo när media eller lagerpaket saknas. |
| Tal vid inaktivitet | Astrids talinitiativ när spelaren är inaktiv och bordet är lugnt. Teknisk benämning: Probe. |

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
| Operatör / bolag | Kundorganisation med stabilt ID och läsbar slug. Bolag på Lanes. |
| Bord / Spelrum & bord | Spelresurs med ägare och inställningar respektive arbetsvyn för bord och matchande spellane. Administration → Bord & lanes. |
| Medlemskap / rollprofil | Personens bolagskoppling och namngivna rättigheter. Bolag på Lanes. |
| Inbjudan / aktiveringslänk | Ny partner aktiveras via `/partner/set-password`; befintlig partner kopplas direkt. |
| Partnersession | Inloggning på `/partner/login`; öppnar inte Kontrollrum. |
| Produktkonto | Produktinloggning. Spelare och intern personal hanteras under Konton & roller. |

Partnerns designval kräver `presentations.configure` och begränsas till paketet.
Bolagets partnerpersonal och intern adminpersonal hanteras separat.

## Flöde

```text
Klippbibliotek → Dealers & klipp → Sammansättning → Lanes → Spelrum & bord
mediafiler      grundloop,        dealer, bord,     spara/   koppla bord och
                utdelning,        bakgrund          publicera spellane
                repliker                          bolagspaket
                                                     │
                                Partnerns tillåtna designval
                                                     │
                                                     ▼
                                              Spelklienten

Spelmotor ──spelsignal──► Presentationsregissör ──plan──► Spelklient
                              ▲       │                    │
                publicerad lane       └─ OpenClaw-råd       ▼
                                                     Uppspelningskvitton
```

En ny spellane måste också finnas under Administration → Bord & lanes.
Spelklienten sköter uppspelning och scenkomposition. Fullbildsklipp behåller
inbakade bord och bakgrunder; separat lagerval tar inte bort dessa pixlar.

## Meny och adresser

| Studio-sida | Adress | Vad sidan innehåller |
|---|---|---|
| Dealers & klipp | `/control/clips` | Grundloop, Utdelning och Repliker per dealer. |
| Klippbibliotek | `/control/videos` | Mediafiler, registrering, metadata och händelsekoppling. |
| Sammansättning | `/control/preview` | Dealer, bord och bakgrund; spela upp, placera och spara som lane. |
| Lanes | `/control/lanes` | Presentationsprofiler, bolag, medlemskap och paketpublicering. |
| Händelser | `/control/events` | Händelsekategorier, klippuppsättningar, villkor och urval. |
| Tal vid inaktivitet | `/control/probe` | Automatik för Astrids inaktivitetstal och textprov. |

| Övrig meny | Innehåll |
|---|---|
| Översikt | `/control`: snabbval och bolagsarbetsytor. |
| OpenClaw | Agentmodeller; Operatörschatt är intern OpenClaw-chatt på `?tab=chat`. |
| Drift | Administration, Bord & lanes, Spelintegritet, Uppspelning, Betalningar & journal. |
| Åtkomst / hjälp | Konton & roller, Partners; Guide & hjälp i sidfoten. |

Studio är ett menyområde. Sammansättning ersätter namnet Förhandsvisning;
`/control/zones` och `/control/backgrounds` leder dit. Bakgrundszoner är ingen
aktiv menypunkt. Avancerade inställningar ligger under utfällbara fördjupningar.

`operatorSlug` väljer bolag, `lane` presentationsval och `dealer` dealer.
En slug ger ingen behörighet. Händelser visar översikt utan `?event=` och
redigerare med `?event=`. `?variant=` används på Händelser och Klippbibliotek.
`#idle`, `#deal`, `#clips` väljer Grundloop, Utdelning respektive Repliker. Administrationens sidomenylänkar
väljer `?tab=tables|operations|finance|accounts`; inne på sidan finns även
Partnernycklar och Talgranskning.

Spelstart: `/play/blackjack?operator=<slug>`. Render läser samma bolagspaket
på `/blackjack?operator=<slug>`.

## Acceptans och prov

| Område | Gäller nu |
|---|---|
| Bild och tal | Granska med `?dealer=<namn>&rehearsal=1`. Ändrad ljud-/videohash upphäver godkännandet. Kvitto, hash och grönt test ersätter inte visuell acceptans. |
| Nora | Egen dealer med egna filmer och matchande spellane; ingen lånad Astridfilm. Nya Nora-/lagerinställningar kräver rätt Renderkapacitet. Live AI-chatt för Nora återstår. |
| Tal vid inaktivitet | Textprovet skapar ingen röst eller video; produktionsacceptans återstår. Äldre zondata är separat från Sammansättningens bakgrundsfilmer. |
| Partnerportal | Bolagsåtkomst och paketens designval finns. Spelare, transaktioner och rapporter från spelmotorn återstår. |
