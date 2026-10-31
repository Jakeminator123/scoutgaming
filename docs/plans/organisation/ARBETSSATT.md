# Arbetssätt: aktiviteter, agenter och nya fynd

## En status per aktivitet

Den aktiva vågens status, ägare, filomfång, beroenden och bevis står i [KORPLAN-v2](KORPLAN-v2.md). Äldre aktivitetsfiler är frysta inventeringsunderlag, inte en parallell kö. Master-/områdesplaner länkar dit utan att duplicera status. Äldre sakplaner beskriver kontrakt/detaljsekvenser; inventera deras genomförda delar före tilldelning. Skapa inget parallellt migrationsregister eller nytt produktregister.

| Status | Innebörd |
| --- | --- |
| PLANERAD | Beskriven, ännu inte tilldelad. |
| REDO | Beroenden och avgränsning verifierade; kan tilldelas inom mandatet. |
| PAGAR | En namngiven agent, branch/worktree och fryst bas-SHA finns. |
| GRANSKNING | Implementation/underlag och riktade prov finns; orkestratorn granskar. |
| VANTAR_ACCEPTANS | Kod/CI kan vara klar; den angivna runtime-/mänskliga kontrollen återstår. |
| VANTAR_BESLUT | Det uttryckliga beslut som står i filen saknas. Ingen beroende mutation. |
| BLOCKERAD | Konkret extern blockerare med nästa åtgärd/ägare. Svår kod är inte i sig blockerad. |
| VERIFIERAD | Aktivitetens samtliga kriterier har bevis; PR/head, granskare och relevant drift-/acceptanskvitto anges. |
| AVFORD | Dubblett, inaktuellt eller medvetet avstått; motiv och ersättande aktivitet/bevis anges. |

Ingen automatisk procent av antal filer eller agenternas färdigmarkeringar. När en verifierad aktivitet avslutats införlivas bestående kontrakt i sakguiden; förbrukad aktivitetsfil raderas med uppdaterade länkar och rad i `docs/HISTORIK.md`. Git bär historiken.

## Tilldelning och integration

1. MERGEAGENTEN uppdaterar vågens brief i KORPLAN-v2 med färsk bas, ägare och **tillåtna filer**. Två skrivare delar inte fil eller paketrot. Gemensamma filer (`NEXT-AGENT`, dokumentindex, env-register, workflow, lockfiler) har en uttalad integrationsägare.
2. Agenten arbetar i egen worktree/branch enligt [AGENTS](../../../AGENTS.md). Läs bara aktiviteten, områdesplanens gräns och angivna källutdrag. Ingen ärvd chatthistorik, full rapportmapp eller återupptagen avslutad underagent.
3. Agenten verifierar beteende/risk, gör egen buggranskning, committar med hookar och öppnar färdig PR. Ingen väntan på CI i underagenten; MERGEAGENTEN väntar blockerande och granskar.
4. MERGEAGENTEN läser färsk PR-identitet och full head, verifierar Jakob-ägarskap, aktuell main och exakt CI, kör säkerhetsstatus och mergar bara med `tools/merge-pr.mjs` efter det uttryckliga godkännande som uppdraget kräver. Planens egen merge är godkänd av Jakob; andra merges och driftsteg följer spärrarna i KORPLAN-v2. Dokumentationens färdigmarkering ersätter aldrig dessa kontroller.
5. Kvitto skiljer kodtest, CI, deployment, data-/versionskontroll och mänsklig AV-/produktacceptans. Uppdatera aktivitet och befintlig sakguide i samma leverans.

### Kort startbrief

```text
Aktivitet: ID + filsökväg. Mål: ett verifierbart beteende.
Bas: full origin/main-SHA. Ägare: agentchatt. Worktree/branch: ...
Läs: områdesgräns + 2-5 specifika fil:rad-utdrag.
Ändra: exakt fillista/paket. Bevara: namngivna grannkontrakt.
Prov: konkreta kommandon och godkänt resultat, högst fyra arbetare.
Mandat: kod/PR; ingen merge, DDL, env-skrivning, aktivering eller betald drift.
Rapport: högst 200 ord, fynd + bevis + blockerare, avsluta med Tveksamt.
```

Om en läsande uppgift inte ändrar filer behövs ingen ny worktree. Underagent rapporterar i sin egen sluttext; orkestratorn hämtar den. Skicka inte slentrianmässigt meddelanden mellan chattar. Korta kompletteringar räcker; spara inte kopior av hela agentkontexter.

## Nya fynd och omplanering

1. **Fånga:** skriv ett kort `F-ÅÅÅÅMMDD-NN`-inlägg i [beslutsloggen](BESLUTSLOGG.md): observation, exakt kod-SHA/moln-ID och reproduktion. Ingen hemlighet, rå scannertext eller persondata.
2. **Klassificera:** verifierat fel, misstanke, förbrukat påstående eller produktbeslut. Bedöm faktisk konsekvens, brådska och vilka aktiviteter/filer som påverkas.
3. **Deduplicera:** lägg fyndet i befintlig aktivitet om den redan äger beteendet. Ny aktivitetsfil bara för ett separat verifierbart resultat; länka från områdesplanen och `docs/README.md`.
4. **Ändra ordningen:** MERGEAGENTEN skriver beslut, skäl, gamla/nya beroenden och vilken pågående agent som ska få ny brief. Stoppa bara arbete som berörs; inga tysta scopeutvidgningar eller nya raderingsmandat.
5. **Återöppna vid ändrat bevis:** om bytes, schema eller beteende ändras så att ett gammalt godkännande inte gäller, återställ rätt aktivitet till lämplig öppen status och ange varför. Återöppna inte den gamla migreringen utan konkret fel i dess kontrakt.

## Verifieringsnivåer

| Ändring | Minsta relevanta bevis |
| --- | --- |
| Dokument/plan | Existerande länkar, källspårning, interna ID/beroenden, repots dokumenthook/CI. |
| Auth/pengar/scope | Negativa behörighetsprov, bolags-/rumsisolering och relevanta samtidighets-/transaktionsprov. |
| UI/publicering | Spara → omläsning → rätt revisions-/rumsscope; browserprov när ändrad vy kräver det. |
| Tal | Aktuellhets-/mute-/avbrottsprov plus exakt ljud-/bildruta och Jakob-acceptans vid ändrade media. |
| Drift/schema | Exakt resurs/SHA, readiness, health/version, läsning efteråt och avgränsad återgång. |

Provdata hör till isolerad staging/CI eller Jakobs uttryckligen tillåtna previewkonton. Inventeringen är läsande mot produktion. Molnreadiness är inte full produktacceptans.
