# S05 · liten ordlista

- **Motor:** serverns auktoritet över spelet. RNG är dess slumpdel, inte ett
  samlingsnamn för all logik eller alla signaler.
- **Publik spelstatus:** den del av tillståndet som mottagaren får se.
- **Presentationsevent:** instruktion om vad klienten ska presentera.
  Partner-vägen har sex typer; vanlig webbklient använder sin egen väg från status.
- **SSE:** serverns löpande eventström till anslutna Partner-prenumeranter.
  Den granskade strömmen har ingen återspelningsbuffert efter avbrott.
- **Situation:** de relevanta publicerade omständigheterna, exempelvis dealer,
  målbox, handling och exakt replik. Ett förklaringsord, inte ett nytt API.
- **Linje / standard:** grundpresentationen för ett behov. Partnerfältet
  `speak.line` betyder däremot en exakt talrads identifierare.
- **Variant:** ett tillåtet alternativ för samma behov.
- **Trigger:** ett kontrollerbart villkor som måste stämma för alternativet.
- **Generation:** inkommande råmaterial. Ett intake-val som `want` betyder att
  det får arbetas vidare med.
- **Take:** identifierad medieprestation med text/ljud där det behövs,
  metadata, kalibrering och granskningsstatus.
- **Manifest / index:** register över material och egenskaper. Det är inte
  i sig bevis på rätt innehåll eller AI-indexering av filmernas innehåll.
- **Reserv / fallback:** ett säkert presentationsval när det önskade inte fungerar.
- **Rehearsal:** granskning i produktens riktiga spelare. **Baseline:** skydd
  mot oavsiktliga assetändringar. Det ena ersätter inte det andra.

**Statusetiketterna är enkla:** *Finns i kod* är källkodsbelagt; *Finns i labbet*
är ett avgränsat prov; *Föreslås* återstår att genomföra; *Inte liveverifierat*
saknar aktuellt driftbevis. Inget av orden betyder automatiskt visuellt godkänd.

Nästa: [Åttadagarsplanen](s06-plan.md). Källor: [tekniskt kvitto](RUNTIME-EVIDENCE.md).
