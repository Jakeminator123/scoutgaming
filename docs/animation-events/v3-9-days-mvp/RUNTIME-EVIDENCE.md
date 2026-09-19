# Teknisk runtime-verifiering

”Runtime-evidence” är inte en separat motor. Det är ett tekniskt kvitto som
visar vilken Croupier-kod ett dokumentationspåstående bygger på. Syftet är att
förhindra att en plan eller gammal canvas råkar beskrivas som redan införd kod.

## Revisionsbild · 19 september 2026

| Yta | Verifierad revision | Vad revisionen betyder |
| --- | --- | --- |
| Jakobs branch | `origin/jakeminator123/work` vid `b0435c3680e363ee19c500f2842fab64fb822a61` | Din lokala checkout och GitLab-branchen pekade på samma commit före denna dokumentationsrättning. |
| Kevins aktuella arbetsbranch | `origin/codex/restore-casino-environment` vid `626554db9e859ba7a374819b96099b7437dea818` | Senaste verifierade Kevin-head och head för MR !1 vid granskningen. |
| Gemensam bas | `b14765971ca9f697a7fa14ffc0ea13570453b789` | Punkten där Jakobs och Kevins senare arbete delar historik. |

Brancherna har därefter olika dokumentations-, media-, klient- och API-commits.
Det betyder inte att Jakobs branch saknar motor.

## Var motorn finns

Följande kärnfiler finns i `jakeminator123/work` och var byte-identiska med
Kevins verifierade branch:

| Del | Fil | Git-blob på båda brancherna |
| --- | --- | --- |
| Serverägd shoe, publicerad round view och speloperationer | `web/shoe-game.mjs` | `ea47b3721de7fe92effba1a308b83accb87180a9` |
| Blackjackregler och interna events | `web/public/blackjack.mjs` | `b60a60d3fd91a2561b882a60c17651f024ecaf42` |
| Partner-API | `web/partner-api.mjs` | `72bd4d83ccc9696eb8018ace332b7cb2bba162ea` |
| Presentation från publicerad spelvy | `web/partner-presentation.mjs` | `5669f154a6277d36f391cf38d1c36b7446e295c6` |
| Dealeruppspelning | `web/public/dealer-engine.mjs` | `5f7c19f0fd8601eec0ad790f2eed8093433fce89` |

`web/generations-api.mjs` finns däremot på Kevins `626554d` och inte i den
granskade `b0435c3`-versionen av Jakobs branch. Det är ett read-only media-API,
inte RNG- eller blackjackmotorn.

## Verifierade spel- och presentationskontrakt

På den gemensamma kärnan finns bland annat:

- operationerna `start`, `act`, `insurance` och `collect`;
- faserna `dealing`, `insurance`, `decisions`, `dealer` och `settled`;
- serverägda kort, shoe, hole card, wallet och settlement;
- interna events som `round.dealt`, `card.dealt`, `hand.split`,
  `dealer.reveal`, `dealer.draw` och `round.settled`;
- presentationstyperna `speak`, `deal`, `reveal`, `settle`, `turn` och `idle`.

Interna events är inte automatiskt publika payloads. Jakobs adapter får endast
läsa det som den valda integrationsytan faktiskt publicerar. Det verifierade
publika flödet är:

`Round/RNG` → `shoe-game command` → `publicerad gameView` →
`Partner API presentation[]` → `föreslagen variantmappning` →
`statusfiltrerad spelare/media`.

## Det tidigare ankarets fel

Den äldre V3-texten använde `eaffbb850d24cc6c6881cab83acbdac19e2609bb`
som enda revisionsankare men beskrev samtidigt filer som inte fanns där:

- `web/partner-presentation.mjs` introducerades i `d188236a772230a4bb8d8debbb7afd710d44641f`;
- `web/generations-api.mjs` introducerades i `e71854679656548ace4d488058d2faba2f8234f7`.

Det är därför ersatt av den tvåbranchsbild som står ovan.

## Vad detta inte godkänner

Den här sidan godkänner inte automatiskt video, visuell kvalitet, läppsynk,
kalibrering eller en merge. RNG:n är en server-side kryptografisk shuffle för
den nuvarande demon; sidan påstår inte regulatorisk RNG-/RGS-certifiering.

## Uppdateringsregel

När någon av brancherna flyttar sig ska nästa granskning registrera nya
commits, jämföra de berörda filernas blobbar och uppdatera endast de påståenden
som faktiskt ändrats.
