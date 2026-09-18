# Alexanders lanseringschecklista (tråd "Initiera AI diskussion", 1 sep 2026) mot Croupier-status 18 sep 2026

Källa: Alexander Schmidts mail 1 sep 11:13 + 17:32 (bilaga: FORCE Certification-rapport 122-26701 för SverigeLotto/Polarlotto enligt SIFS 2022:3, sparad här som 122-26701-S4-Polarlotto-2026.pdf). Princip: "AI presenterar spelet. Game Engine styr spelet."

| # | Alexanders punkt | Status i Croupier | Bevis / vad som saknas |
|---|---|---|---|
| 1 | Game Engine helt separerad från AI Dealer-lagret | KLAR | web/shoe-game.mjs + public/blackjack.mjs, server-ägd SQLite. Dealern får kort-identitet efter att servern dragit. |
| 2 | AI-dealern får inte styra RNG, utfall, payout, odds eller saldo | KLAR i kod, EJ dokumenterad | Dealer-lagret har inga skrivvägar till shoe/round/balance. Behöver ett arkitekturdokument som visar det (SIFS kap 13.2.1 kräver hela RNG-källkoden + dokumentation). |
| 3 | Komplett dokumentation för spelregler, matematik, RTP, RNG och settlement | EJ PÅBÖRJAD | Reglerna finns bara i kod (8 lekar, cut 312, burn 1, BJ 3:2, insurance 2:1, side bets Perfect Pairs/21+3). RNG = crypto.getRandomValues + Fisher-Yates utan modulo-bias. Saknas: regeldokument, RTP-beräkning per regelvariant, simulering, RNG-referens (kap 13.1–13.8), payout-övervakning (kap 10.2). |
| 4 | Full audit log och versionshantering från start | DELVIS | transactions-tabellen loggar deal/settle/deposit per spelare med meta; git finns. Saknas: rundlogg med kortsekvens + shoe-id + tableVersion som audit-tabell, felregistrering (kap 7.6.1), ändringsprocess-dokument (kap 6). |
| 5 | AI-disclosure + compliance-regler för vad dealern får säga | DELVIS | "AI DEALER"-label i UI. Voice lines är fasta repliker (bank.json) + fri chatt via agent-response.mjs. Saknas: skriven policy, blocklista (inga odds-löften, inga uppmaningar att spela mer, ansvarsfullt spel), loggning av allt dealern säger. |
| 6 | Security, pentest, incidenthantering, change management | EJ PÅBÖRJAD | Motsvarar SIFS kap 4 (infosäk), 5 (risk/sårbarhet), 6 (systemändringar). Kräver dokument + extern pentest. |
| 7 | Ackrediterat testlab | PÅGÅR (Alexander) | Offerter inne från flera labb per 14 sep. FORCE Certification (Brøndby) certifierade Polarlotto 22 juni 2026. |

## Vad FORCE-rapporten säger som slår direkt på oss (Polarlotto fick N/A, vi får det inte)
- Kap 13 RNG: 13.1.1 statistisk test, 13.2.1 dokumenterad algoritm + all källkod, 13.3.1 lasttest, 13.6.1 RNG-resultat = registrerade händelser, 13.8.1 oberoende mellan rundor.
- Kap 13.11 Live casino: "drawing equipment" ska övervakas och SPELAS IN med datum/tid, inspelningen ska visa regelefterlevnad. För oss: servern är utrustningen, så rundlogg + signerad händelsekedja ersätter kamerainspelning. Detta måste argumenteras med labbet.
- Kap 15.13: antal lekar och vilka kort ska visas för spelaren (vi visar "8 DECK SHOE"), kortets framsida ska visa valör/färg tydligt, reglerna ska säga när blandning sker (cut card 312).
- Kap 15.2–15.9: minst 3 s per runda, spelaren ska hinna välja, inloggningstid och saldo synligt hela tiden, insats + min/max tydligt, utfall synligt rimlig tid. Saldo och insats finns; inloggningstid saknas i UI.
- Kap 10.2: funktion som övervakar utbetalningsprocent per spel och sparar för revision. Saknas.
- Kap 12: avvikande spelmönster/fusk. Saknas.
- Kap 15.15.2: upptäcka två spelare på samma utrustning. Saknas.

## Prioriterad ordning (min bedömning)
1. Regel- och RTP-dokument + simulering (punkt 3). Låser upp labbet.
2. Rundlogg som audit-tabell + felregistrering (punkt 4).
3. RNG-dokument med källkodsreferens och testrapport (kap 13).
4. Dealer-talpolicy + loggning (punkt 5).
5. UI-luckor kap 15: inloggningstid, min/max-insats, regeltext om blandning.
6. Infosäk/risk/change-dokument + pentest (punkt 6).
