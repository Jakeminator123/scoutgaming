# S00 · helheten

> **Mötesbeslut:** Kevins Croupier-motor, RNG och faktiska events är basen. Jakob bygger backendlogik och ett eventträd runt basen utan att ersätta den. Kevin och Emil producerar videovarianter i Kevins arbetsflöde.

## En riktning

`Kevins RNG och state` → `verifierade Croupier-events` → `Jakobs adapter/eventträd` → `event–videomappning` → `Kevin + Emil producerar varianter` → `rehearsal och evidens` → `Kevin beslutar om införlivande`

Servern och motorn avgör vad som faktiskt hände. Presentationslagret får välja hur ett redan avgjort skeende visas, men aldrig ändra kort, shoe, wallet, payout eller landning.

## Källhierarki

1. Körande Croupier-kod på den revision som uttryckligen verifierats.
2. Manifest, Bettalotto/partner-API och reproducerbara tester.
3. Dokumenterade beslut från Kevin och berörda ägare.
4. V3-kartan och ordlistan.
5. Jakobs förslag och äldre referensrepon.

## Roller

| Part | Äger | V3-leverans | Gräns |
| --- | --- | --- | --- |
| Kevin | GitLab, Croupier-motorn, RNG/events, integration | Verifiering och beslut vid etapper | V3 ändrar inte hans branch eller agenter automatiskt |
| Emil | Video tillsammans med Kevin | Takes, variationer och metadata i Kevins flöde | Arbetar inte i Jakobs backendträd |
| Jakob | Backendanalys, eventträd, mappning, tester och docs på `jakeminator123/work` | Reproducerbart förslag, gapplista och handoff | Ändrar inte Kevins motor/main utan beslut |
| Bettalotto | Backoffice | Behörig data/mediaåtkomst | Tokens och lösenord hålls utanför Git/wiki |

## Statusetiketter

| Etikett | Krav |
| --- | --- |
| **Verifierat i Croupier** | Fil/symbol, revision och gärna test eller manifest är angivet. |
| **Mötesbeslut** | Överenskommet av människor och infört i beslutsloggen. |
| **Jakobs förslag** | Kan byggas separat men är inte Kevins runtime. |
| **Kevin + Emil** | Videoarbete i deras gemensamma flöde. |
| **Beslut krävs** | Får inte beskrivas som infört. |

## Fyra milstolpar

| Milstolpe | Bevis | Kontrollpunkt |
| --- | --- | --- |
| M1 · verklighetskarta | Revision, eventkällor, payloads och manifest | Kevin bekräftar kartan |
| M2 · eventträd | Varje rot är verifierad; varje derivering är märkt; fallback finns | Kevin granskar gränsen mot motorn |
| M3 · video + rehearsal | Mappning, metadata, edge cases och testlogg | Kevin + Emil bekräftar media; Jakob visar logiken |
| M4 · handoff | Avgränsad diff, tester och gapplista | Kevin väljer införliva, justera eller håll separat |

Den visuella versionen av kedjan finns i [Canvas · V3-eventträdet](CANVAS.md). Den använder GitLabs inbyggda Mermaid-rendering och ska visas som diagram i wikin, inte som en TSX-kodfil.

## Inte i MVP:n

- En ny, bästa eller ultimativ RNG.
- Full OpenClaw-/AI-regi; ett eventuellt skuggexperiment kommer senare.
- Krav på att Kevin använder Jakobs workflow- eller agentregler.
- Bred rouletteutvidgning eller komplett fyradealerbibliotek om det inte redan ingår i Kevins aktuella scope.
- Automatisk merge, produktion eller ändring av Kevins branch.

## Versionsgräns

- **V2:** `v2-long-term-goal-best-rng`, fryst under `docs/animation-events/archive/`.
- **V3:** `v3-9-days-mvp`, aktiv här på `jakeminator123/work`.
- **Wiki:** speglar V3 efter granskning.
- **GitHub/Vercel:** endast senare presentationsspegel.

---

**Kort sagt:** Kevins motor är basen. Jakob bygger bevisbart runt den. Emil bygger video med Kevin. Kevin avgör vad som införlivas.
