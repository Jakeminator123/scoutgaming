# TAL-03: Verifiera röst-, bank- och miljöidentiteter

- Status: **PLANERAD**
- Ägare: ej tilldelad; MERGEAGENTEN samordnar.
- Fas: 2. Nivå: A. Prioritet: P2.
- Beroenden: [GEM-02](../../../gemensamt/aktiviteter/GEM-02.md)
- Bas: inventeringen av `main` `e20fe6f143e447f805c63b75b328f39f48521ca3`; uppdateras före start.
- Tillåtna filer / branch / PR: fastställs i startbriefen; områdesplanen är ansvarsgräns, inte bred skrivfullmakt.

## Underlag och mål

Jakob-2 saknar verifierad egen GPU-bank och ny AV-acceptans. RunPod-konton och ElevenLabs-nycklars röståtkomst är inte utbytbara; callbackrättning aktiverar inte tal.

## Utförande

Samla exakt voiceId/dealer/endpoint/bank/hash/profil per miljö från avsedda källor. Verifiera vad som redan är klart i TALKEDJA/PAOW-planerna. Förbered separat körbrief för bank/previewmall/AV; generera, byt nyckel eller starta GPU först inom senare uttryckligt uppdrag.

## Klart när

Varje dealer har rätt ägt konto och materialbindning, preview går inte till prod-callback, och saknad readiness är synlig. Inspelad godkänd replik eller hash markeras aldrig som godkänd nygenererad läppsynk.

Bevis: ännu inga genomförandebevis i detta uppdrag. Fyll kodtest, exakt PR/head/CI, oberoende granskare och vid behov data-/drift-/mänsklig acceptans separat. Planering räknas inte som rättat beteende.

Källspår: M03/M07/M20; E-04; S12/S14; TALKEDJA T1-T7. Se [underlagsregistret](../../../UNDERLAG.md). [Områdesplan](../OMRADESPLAN.md) · [Arbetssätt](../../../ARBETSSATT.md).
