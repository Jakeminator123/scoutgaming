# Uppdrag: Astrids valbara kamera, mikrofon och bildgranskning

Implementera i `C:\Users\jakem\Projects\croupier` på `jakeminator123/work`.
Läs `AGENTS.md`, aktuell `docs/JOHN-HANDOFF.md`, `lab/docs/README.md`,
`open-claw/lab/docs/README.md` och framför allt
`open-claw/lab/docs/ASTRID-CAMERA-VOICE-PLAN.md` innan du ändrar något.
Bevara andra agenters ändringar. Arbeta endast med Astrid.

## Produkt och ägarskap

Utgå från Lissabon på 4201 och Astrids riktiga Web-spelare på 4200 med
`?dealer=astrid&presentation=local`. Emils porträttklipp används även på dator.
Web äger presentationen; labbet konfigurerar och observerar. Skapa ingen andra
spelare eller parallell tal-/minnesmotor. GPT-6 Luna är valt för Astrid;
modellvalet ska fortsätta vara redigerbart. Probe och dess testmiljö ägs av
pågående Probe-arbete: koordinera berörda filer innan du ändrar dem.

## Bygg hela flödet

- En tydlig, mobilanpassad kamera-/mikrofonkontroll i spelfliken, Av vid start.
  Starta begär tillstånd; visa förhandsbild, talaktivitet och Stoppa.
- Mät faktiskt tal med VAD. Ta en liten bild efter cirka tre sekunders
  ackumulerat tal och en vid upptäckt talslut eller Stoppa. Kort tal ger bara
  slutbild; inget tal ger inga bilder. Högst två bilder per meddelande.
- Visa transkription och bilder för granskning före **Skicka till Astrid**.
  Välj och verifiera en transkriptionskälla; anta inte att OpenClaws HTTP-API
  tar råljud. Visa tydligt om enhet eller transkription saknas.
- Utöka befintlig produktväg Web → backend → Director → privat Gateway →
  `croupier-speech`. Följ kameraplanens föreslagna kontrakt, samtycke och
  storleksgränser. Inga externa bild-URL:er eller nya verktygsbehörigheter.
- Kontrollera bildstöd i den faktiskt driftsatta OpenClaw-versionen
  (senast verifierad 2026.9.5) och vald modell. Verifiera sessions-/bildlagring
  innan användarens kamera används. Text-only modellmetadata är inget bildstöd.
- Stoppa samtliga tracks vid Av/Stoppa, bakgrundsflik, navigation, profilbyte,
  utloggning, timeout och fel. Sena callbacks får inte återuppta inspelning
  eller skicka material under fel profil. Probe får aldrig starta kameran.
- Kameraobservationer får inte övertrumfa serverns kort, saldo eller resultat.
  Lägg inte råbilder/råljud i spelarminnet, Git eller vanliga requestloggar.

## Klart först när

Testa först i en isolerad databas och på annan hostname än Jakobs spel.
Använd syntetisk videokälla och injicerad VAD/klocka för fallen i kameraplanen,
samt kontraktstester för bytes, dimensioner, MIME, samtycke, profil och URL:er.
Verifiera därefter ett syntetiskt bildmeddelande genom hela driftsatta kedjan.
Visa att Av inte begär tillstånd eller påverkar vanlig chatt/Probe.
Lämna featureflaggan Av som standard. Ingen visuell läppsynk godkänns av ett
enbart tekniskt test. Följ repots obligatoriska regressionskrav vid playerändring.

Dokumentera vad som fungerar, faktisk modell/version, lagringsgränser och
återstående hinder. Uppdatera handoff och tillgängligt Jira CAC-ärende enligt
repots regler. Commit endast egna filer, kontrollera chefstatus och använd
`node tools/push-work-mirrors.mjs`. Redovisa separat vad som är lokalt färdigt,
driftsatt och faktiskt verifierat. Be Jakob om slutligt godkännande för en ny
driftsättning om den inte redan uttryckligen är godkänd i den chatten.
