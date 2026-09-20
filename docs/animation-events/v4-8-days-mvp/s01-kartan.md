# S01 · systemkartan

## Två klientvägar finns redan

```text
Vanliga spelet  → /api/table    → serverns spelmotor → publik spelstatus
                                                    → klientens presentation

Partnerklient  → /api/v1/table → samma spelmotor    → publik spelstatus
                                                    + presentation[]
                                                    → /api/v1/events (SSE)
```

**Partner-API är ett gränssnitt i båda riktningarna.** Partnern skickar kommandon
in; Croupier lämnar spelstatus, presentationshändelser och mediereferenser ut.
Med seamless wallet skickar Croupier även wallet-anrop till operatören och
tar emot dess svar.

Partnerns ström avgränsas av API-nyckel och partnerns spelar-id. I den granskade
koden publicerar vanliga `/api/table` inte till den strömmen. En inloggning på
Bettalotto visar därför inte automatiskt alla spelhändelser i labbet.
Backoffice-inloggning är inte signerad Partner-åtkomst.

## Vilken yta svarar på vilken fråga?

- **Bettalotto spelet:** det spelaren ser. **Backoffice:** administration av
  bland annat dealers, media och API-nycklar. Det är olika ytor.
- **Croupiers kod och tester:** vad respektive kodväg gör på en angiven revision.
- **`lab/`:** lokal studio för exempel, regler, val och preview. Den prenumererar
  ännu inte på ett verkligt bord och sparande publicerar inget till produkten.
- **`open-claw/`:** Director, Gateway och deras drift. En fungerande labbmodell
  visar inte att produktspelaren är integrerad.
- **Wiki och webbplats:** samma förklaring och plan. GitHub-repot är dokumentation;
  Vercel visar den byggda webbplatsen.

**Nästa kontroll:** välj vanlig klient eller Partner-klient för det första provet,
och dokumentera den valda vägen. En läsande monitor är ett förslag, inte en redan
införd labbfunktion.

Nästa: [Signalerna](s02-spraket.md). Källor: [API, labb och spelare](RUNTIME-EVIDENCE.md).
