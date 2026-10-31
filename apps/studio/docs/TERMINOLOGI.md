# Scoutgaming: orden

En uppslagslista för att skilja produktens identiteter åt och hitta dem i kod. Orden och UI-strukturen får utvecklas med produkten; listan föreskriver ingen meny eller mappstruktur.

## Vem använder produkten?

| Yta | Adress | Användare |
| --- | --- | --- |
| Admin | `/admin` | Scoutgamings personal skapar och tilldelar |
| Partnerportalen | `/partner/<bolag>` | Bolagets team väljer inom sin tilldelning |
| Spelet | `/lobby`, `/play/{game}` | Spelaren väljer och startar ett publicerat spelbord |

## Identiteter och innehåll

| Ord | Betydelse | Kodnamn |
| --- | --- | --- |
| Bolag | Spelbolaget som får innehåll och har egna konton/behörigheter | `operator` |
| Spelbord | Bolagets ingång till ett spel, öppet eller pausat | `room` |
| Dealer | Person med egna klipp, röst och repliker | `dealer` |
| Klipp och klippkarta | Filmad situation och klippens bindningar till situationer | `clip`, `slots` |
| Vila och körregel | Grundloop, följd av viloklipp och villkor för uppspelning | `idle`, `rotation`, `idlePolicy`, `mediaPolicy` |
| Replik och tagning | Exakt text och en godkänd inspelning av den | `take` |
| Röstprofil | Dealerns sparade röst-ID och modell; katalogen föreslår röster | `speechProfile.voice` |
| Landningar | Var dealerns hand lägger kort i bild | `landing` |
| Miljö | Bakgrund, dealer och bordsgrafik med placering och tillåtna val | `lane`, `composition` |
| Placering | Lagrets läge och skala för dator/mobil | `placement` |
| Material | Uppladdad bakgrund eller bordsgrafik; bordsgrafik är en bild | `layerAssets`, `tableAsset` |
| Miljöbild | Miljöns bild för lobby/Admin; separat från spelets lager | `lane.illustration` |
| Tilldelning och paket | Bolagets urval och dess publicerade version | `assignment`, `operator package` |
| Utkast och live | Sparat respektive publicerat innehåll | `draft`, `live` |
| Utseende | Spelbordets valda bakgrund, dealer och bordsgrafik | `branding` |
| Spelinställningar och insatsprofil | Språk, tider, gränser och marker | `roomGameConfigs`, `limitPreset` |
| Papperskorg | Arkivering som kan återställas enligt livscykelkontraktet | `trash` |
| Team och roll | Bolagets administratör, redaktör eller läsare | `operator_memberships` |
| Spelare | Konto med saldo och bolagsbindning | `players` |
| Integration och API-nyckel | Bolagets start av spelare från egen sajt via Partner-API `/api/v1/*` | `api_keys` |
| Journal | Bolagets händelselogg | `operator_audit_events` |
| Spelmotor och delat bord | Servern äger regler, kort, sko och saldo; delat bord är spelvägen | `services/game`, `shared-table` |

En vald dealer, en miljö, ett spelbord och ett publicerat paket är olika identiteter. Ett valt rum gör inte en delad mall rumsspecifik. Behörighet och publicering avgör vad nästa användare kan se och ändra.

## Tekniska namn som finns kvar

| Namn i kod eller drift | Produktens ord |
| --- | --- |
| `apps/studio`, basePath `/studio` | Admin, lobby och partner i samma produkt |
| `croupier_*`, `CROUPIER_*`, Render `croupier-v3` | Scoutgaming; byt tekniska namn med deras konsumenter när uppdraget kräver det |
| `/control`, `/lab` | Redirect till Admin |
| `services/openclaw/lab`, `croupier-lab-*` | Talkedjans Director och Gateway |
| `bo_*`, `bo_jwt`, `operator`, `room`, `lane` | Tekniska namn; UI beskriver sakens betydelse |
| `k06-k07-staging`, `croupier_staging` | Preview; vissa lagrings- och värdnamn är kvar |
| K0x, J0x, O0x | Äldre aktivitets-ID:n; använd begriplig saktext i UI |

Visa tekniska detaljer när de hjälper användarens beslut. Använd samma ord för samma sak och skilj en bild av ett bord från ett spelbord.
