# S02 · signaler in och ut

> Fråga alltid: **in till vilken del?** Ett svar från motorn är ut från servern
> men in till presentationen. Det gör det inte till ett nytt spelbeslut.

## Fem slags underlag för presentationen

1. **Spelfakta:** publicerade kort, destination, hand, tur, fas och resultat.
   RNG är en del av motorn; allt detta är inte RNG. Dolda kort och framtida
   sko får inte lämnas till ett presentationsval.
2. **Spelartext:** kan ge underlag för ett socialt svar. Produktens chatt och
   Astrids sociala labbprov är separata vägar. De är inte en gemensam talkö.
3. **Kontext:** exempelvis språk, återbesök, avgjord historik och dealerns
   framtoning. Eventlabbet använder manuella testvärden; dessa bevisar inte
   insamlat spelarminne eller levande signaler från spelet.
4. **Ljud och video:** beredskap, uppspelningstid, slut, fel och kalibrerade
   kontaktögonblick. Ljudet kan styra synk och avslut utan att styra kort eller
   resultat. Ingen mikrofon-/taligenkänningsingång är belagd i de granskade vägarna.
5. **Konfiguration:** vald dealer, regler, tillåtna alternativ och mediekopplingar.
   Det styr vad som får väljas; det är inte i sig en spelhändelse.

## Från underlag till utdata

**Situation → tillåten standard/variant → kompatibel take → uppspelningsresultat.**

I Partner-vägen heter presentationstyperna `speak`, `deal`, `reveal`, `settle`,
`turn` och `idle`. Labbets **16 grupper** är redigeringsgenvägar över dessa sex
typer. De beskriver inte alla inkommande signaler och skapar inga nya motor-events.

Håll också isär **settle** och **speak**: ett resultat ersätter inte motorns
exakta talrad. En gruppering av flera repliker får inte använda samma inspelade
talvideo för alla orden.

Nästa: [Urvalet](s03-eventtradet.md). Källor: [källförteckningen](RUNTIME-EVIDENCE.md).
