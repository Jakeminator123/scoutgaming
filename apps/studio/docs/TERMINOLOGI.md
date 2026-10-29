# Scoutgaming: orden

Orden som produkten använder i dag. Svenska ord är UI-ord; kodens namn står inom parentes och visas aldrig i UI.

## Tre nivåer

| Nivå | Heter | Adress | Vem |
| --- | --- | --- | --- |
| 1 | **Admin** | `/admin` | Scoutgamings personal: skapar och tilldelar |
| 2 | **Partnerportalen** | `/partner/<bolag>` | bolagets team: väljer inom tilldelningen |
| 3 | **Spelaren** | `/lobby`, `/game` | spelar vid bolagets öppna spelbord |

Det ett bolag kan ändra är en delmängd av det Admin kan ändra; spelaren ser bara det som är publicerat.

## Kärnord

- **Bolag** (`operator`): spelbolaget som får en tilldelning.
- **Spelbord** (`room`): bolagets ingång till ett spel; **öppet** (`state: live`) eller **pausat**.
- **Dealer** (`dealer`): en person med egna klipp, egen röst och egna repliker.
- **Klipp** (`clip`): en filmad situation, till exempel utdelning eller kortvändning.
- **Klippkarta** (`slots`): dealerns klipp ordnade per situation.
- **Vila** (`idle`): dealerns grundloop mellan händelserna; **vilosekvens** (`rotation`) är flera viloklipp i följd.
- **Replik** och **tagning** (`take`): en mening med exakt text, och en godkänd inspelning av den.
- **Röst och tal** (`speech`): dealerns inspelade och genererade tal. **Röstprofil** (`speechProfile.voice`): dealerns sparade röst (ElevenLabs röst-ID och modell) i projektet i Neon; talet läser den, röstkatalogen föreslår bara.
- **Landningar** (`landing`): var dealerns hand lägger korten i bild.
- **Scenmall** (`lane`, `composition`): hur bakgrund, dealer och bordsgrafik placeras, och vad mallen tillåter.
- **Placering** (`placement`): scenmallens skala och läge per lager, för dator och mobil.
- **Bakgrund** och **bordsgrafik** (`layerAssets`, `tableAsset`): uppladdat **material**; bordsgrafik är bilden av bordet, aldrig ett spelbord.
- **Tilldelning** (`assignment`): det bolaget får använda och välja.
- **Paket** (`operator package`): den publicerade tilldelningen med en **version** som bara räknas uppåt; spelet läser bara paketet.
- **Utkast** och **live** (`draft`, `live`): sparat respektive publicerat; **Publicera** gör utkastet live.
- **Utseende** (`branding`): spelbordets valda bakgrund, dealer och bordsgrafik.
- **Spelinställningar** (`roomGameConfigs`): spelbordets språk, insatsprofil och tider.
- **Insatsprofil** (`limitPreset`): gränser och marker, i dag Casual, Privé och High.
- **Papperskorg** (`trash`): arkivering som går att ångra.
- **Team** och **roll** (`operator_memberships`, `partner-admin|editor|viewer`): administratör, redaktör, läsare.
- **Spelare** (`players`): konto med saldo, knutet till ett bolag.
- **Integration** och **API-nyckel** (`api_keys`): bolagets nyckel för att starta spelare från sin sajt; Partner-API är `/api/v1/*`.
- **Journal** (`operator_audit_events`): bolagets händelselogg.
- **Spelmotorn** (`services/game`): äger kort, sko, regler och saldo; **delat bord** (`shared-table`) är enda spelvägen.

## Gamla namn → nya namn

Bara namn som fortfarande finns i kod, databas eller drift. Byt inte namn på dem i förbigående; UI ska använda det nya ordet.

| Gammalt namn | Finns kvar i | Nytt ord |
| --- | --- | --- |
| Croupier, Croupier Studio | scheman `croupier_*`, `CROUPIER_*`-variabler, Render `croupier-v3`, Blob `croupier-media-private`; i UI flikrubriken (`app/layout.tsx`) och inloggningstexten (`partner-login.tsx`) | Scoutgaming, Admin |
| Studio | `apps/studio`, basePath `/studio` | Admin (ingen egen produkt) |
| Control, Kontrollpanelen | redirect `/control`; i UI inloggningstexten (`partner-login.tsx`) | Admin |
| Lab, labb | redirect `/lab`, `croupier-lab-*` på Render, `services/openclaw/lab`, `lab_sessions`, `lab-url.mjs` | Admin; talkedjans tjänst heter Director |
| BO, Backoffice | tabeller `bo_*`, `backoffice-navigation.mjs` | Admin |
| Lissabon | tabeller `lissabon_*`, `lissabon-stream-lane`, redirect `/labb-lissabon` | inget produktord |
| Operatör, operatörspersonal | kodnamnet `operator`; i UI `partner-login.tsx` och `partner-team-loader.mjs` | bolag, bolagets team |
| Rum, spelrum | kodnamnet `room`; i UI lobbyn (`client/lobby`) | spelbord |
| Mall, sammansättning | `lane`, `composition` | scenmall |
| Nivå 1/2/3, intern administration | i UI `studio-administration.tsx` | Admin, Partnerportalen, spelaren |
| Sammanhängande vilosekvens | i UI vilopanelen | vilosekvens |
| K0x, J0x, O0x | kodkommentarer, testnamn; i UI importvarningen "K05-urvalet" | beskriv saken, inte koden |
| k06-k07-staging | Neon, Blob och Render-adressen för preview | preview |
| GitLab | en källkommentar; push-policyn nekar GitLab | GitHub |

## Regler

1. Menynamnet är sidans rubrik.
2. Inga kodnamn i UI.
3. Ett ord per sak.
