# V5 · källor, prov och bevisgränser

Sakgranskning: **21 september 2026**, Croupier `jakeminator123/work`.
Implementationens fasta ankare är `d382b46` och `0b30694`.
V5:s dokumentations-/kontraktskomplettering följer i separat commit.
Webbens `docs/sync-manifest.json` anger den kanoniska dokumentrevisionen och
SHA-256 för speglade filer. Inget av detta anger automatiskt live-SHA.

## Kontrollera mot kod

- [Originalmaterial och exakta kopplingar](https://gitlab.com/scout-gg/croupier/-/blob/0b30694/lab/lib/original-media-server.mjs)
  samt dess klientresolver. 84 tillgängliga poster, 22 Astrid i kontrollen.
- [Gemensamt presentationsbeslut](https://gitlab.com/scout-gg/croupier/-/blob/0b30694/lab/lib/presentation-director.mjs)
  och [kandidatkontroll](https://gitlab.com/scout-gg/croupier/-/blob/0b30694/lab/lib/studio-server.mjs).
  Återanvändning gäller beslut i en process, inte global playback.
- [Native-publicering](https://gitlab.com/scout-gg/croupier/-/blob/d382b46/web/native-table.mjs)
  och [Partner-presentation](https://gitlab.com/scout-gg/croupier/-/blob/d382b46/web/partner-presentation.mjs).
  Godkänt kommando publiceras efter commit till verifierad kanal.
- [Videointake](../../../lab/VIDEO-LIBRARY.md), [schema](../../../lab/schemas/video.schema.json)
  och [centralt kontrakt](../../../lab/policies/studio-contract.json).
  Klassificering/filkontroll är inte en full codec- eller läppsynkgranskning.
- [Aktuell handoff](../../JOHN-HANDOFF.md) anger testresultat och kvarstående
  luckor; [artefaktkartan](../../../lab/docs/ARTIFACTS.md) visar placeringen.

## Redan utförda implementationstester

Leveransen i `d382b46`: 286 labbtester, TypeScript och produktionsbygge;
isolerad native-sekvens med 12 importerade steg till avslut. Native- och
BO-previewregressioner samt repots kontroller passerade.

Fortsättningen i `0b30694`: 296 labbtester, TypeScript, slutligt Next-bygge,
alla pre-commit-kontroller och `audit-dealer-sync --probe` passerade.
Gemensamt besluts-ID provades över båda HTTP-adresserna och återanvändes.

Två verkliga anrop via den konfigurerade OpenClaw-anslutningen gav accepterade
val: greeting via HTTP och blackjack genom webbläsarens eventprov. Blackjack
spelade originalmaterial till avslut. Astrid greeting spelades två gånger i
labbet. Alla fyra faktiska produktspelare körde greeting med två plays på en
isolerad rehearsal-host, med matchande start/slut och utan konsolfel.

Detta är daterade lokala funktions-/livscykelprov, inte full ljud-/läppsynk-
eller identitetsacceptans. Automatiska modelltester använder stubbar. V5:s
egna körningar dokumenteras i handoff; ovanstående resultat är inte påstådda
nya körningar av alla tidigare prov.

## API och dagens privata underlag

Autentiserad generationskarta gav HTTP 200 omkring 01:39 UTC 21 september:
89 motorvideofiler, 78 ljudfiler och sex Astrid-staged-filer. Samtliga 173
refererade sökvägar fanns lokalt. Revision var null. Ingen ny nedladdning
behövdes; bytes jämfördes inte generellt med fjärrkopiorna.

`BETTALOTTO_API` är åtkomst till generations-API:t. Partnernyckeln har en annan
roll: spel/launch/events enligt sin behörighet. Att känna materialets sökväg
bevisar varken en inspelad runda eller generella återpubliceringsrättigheter.
V5 använder befintligt projektmaterial lokalt och publicerar inga filmbytes
eller tokens på dokumentationswebben.

Jakobs lokala BO-utdrag från 21 september beskriver overview, clips,
generations och verdicts. Flera är trunkerade. De innehåller bland annat
Astrid-bindningsmetadata och avvisningsposter; inget komplett playbackspår.
Observationen som lämnades innehåller två statusposter och noll rundposter.
Råunderlag och personuppgifter stannar utanför publiceringen.

## Öppna kontrollpunkter

- Verklig deploy-revision och behörig testsession med riktiga `round.events`.
- Originalspelarens faktiska klippstart/slut/landning och full kortscen.
- Operatörens fullständiga manuella browserflikval för originalbilden.
- Astrids identitet, per-replik-läppsynk och full plats-/splitkalibrering.
- Gemensam produktkö och övergång från gamla talägare till OpenClaw.
- Det ursprungliga tvåströmsfelets exakta reproduktion, separat från BO-fixen.

Inga riktiga spelkonton eller saldon har manipulerats för dessa prov. Ingen
ny mediegenerering eller produktdeploy ingår i V5-publiceringen. Jira-status
har inte uppdaterats utan tillgängligt ärende/anslutning.
