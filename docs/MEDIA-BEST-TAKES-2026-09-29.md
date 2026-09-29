# Astrids aktuella klipp och privat molnlagring

Kontroll den 29 september 2026. Projektmappen `emil/dealklipp-v1` är källan
för de bästa versioner Jakob överlämnade. Alla **51 filhashar** matchar
manifestet med **28 familjer**. Samtliga **22 varianter** är 1080 × 1920,
24 fps och matchar exakt kandidaterna i morgonens
[importkvitto](qa/cloud-media-import-2026-09-29.json).

## Vad finns var?

| Material | Verifierat nu | Lagring |
| --- | --- | --- |
| Nio dealvarianter, nytt leende, ny gäspning och nya `idle_resa_sig.mp4` | Alla 12 lästes tillbaka i sin helhet; storlek och SHA-256 matchar projektets bytes, totalt 44 574 024 byte | Privat Vercel Blob |
| Övriga tio idlevarianter | Alla tio syns med Spela i rätt familj efter bibliotekets omläsning. Kaffeklippet gav `readyState=4`, 1080 × 1920 och inget videofel. Övriga nio har bara ny inventarieverifiering; morgonkvittot innehåller två Range-läsningar per fil | Projektets mediebank på Render-disk |
| Standardklipp | Samtliga finns och är hashverifierade i projektets manifest | Projektets mediebank, följer Git-leveransen |

Det befintliga lagret heter `croupier-astrid-zone-media-private`,
`store_AqwvebTbBHarOjvG`, region `arn1`, åtkomst **Private**. Leverantörens
inventering visar **13 objekt**: de tolv familjeklippen under `croupier/videos/`
och den tidigare zonfilmen under `astrid/background-zones/`. Det är samma
privata lager med skilda sökvägar. Lab-API:t läser familjeklipp med skyddade
logiska video-ID:n. Zonmetadata hör till egen Neon-databas, inte speldata.

Ingen ny uppladdning, ny token, ny resurs eller molnradering behövdes.
Befintlig token återanvändes endast i processminne för läsning och skrevs
inte i rapporten. Exakta hash-, format- och läskvitton finns i
[maskinläsbar kontroll](qa/media-best-takes-2026-09-29.json).

**22 tillgängliga kandidater betyder inte 22 Blob-objekt.** Tolv ligger i
privat Blob och tio har tidigare serverats från projektets diskbank.
Vid Git-leveransen tillkommer de tolv bästa filerna även i det uppdaterade
projektmanifestet. Uppladdnings-ID:n och manifestets hashbaserade ID:n är
skilda och behålls: sparade policyer kan redan referera uppladdnings-ID:n.
Att radera eller slå ihop dessa identiteter kräver en uttrycklig migration.

## Bevarade versioner och gränser

De överlämnade bytena omfattar plats 1–7, dealerns öppna kort, två varianter
för plats 5 och tre idlefilmer. Den nya plats 1 är 3,875 sekunder. De övriga
dealvarianterna är 3,125–3,792 sekunder; alla har rätt bildformat och fps.
Gamla `idle_resa_sig_fargmatchad.mp4` behålls som separat manuell kandidat.
Ändrade klipp-ID:n i idlepolicyn och lokalprofilen pekar på de nya filerna;
den nya gäspningens längd är 4 250 ms. Nytt leende, gäspning och resa-sig
förblir manuella. Befintlig blinknings-/reaktionspolicy ändrades inte.

De här kontrollerna godkänner inte bildkvalitet, läppsynk eller rörelse.
Jakobs överlämning nämner kvarvarande handryck vid plats 7 och en kort svag
fläck på bordstexten före dealer-vändningen. Dessa noter är bevarade och
har inte avfärdats genom hash- eller formattester. Ingen råmedia, kalibrering
eller regressionsbaseline ändrades under kontrollen.

Selektiv inventering av de uttryckligen angivna arbetsmapparna på
`Desktop/croupier_kaffe` hittade två ytterligare MP4 som inte är identiska med
manifestets klipp: `idle-varaints/kortflipp_kling_1080p/kortflipp_kling_1080p.mp4`
(1080 × 1920, 24 fps, 5,042 s) och
`idle-varaints/resa_sig/croupier_resa_sig_video_original_480p.mp4`
(496 × 864, 24 fps, 9,042 s). De har inte importerats eller godkänts som
bättre versioner. `repo_backup_2026-09-29` och övriga Desktop-filer lämnades
orörda. De tidigare namngivna arbetsmapparna `projekt_fixade` och `box/fixade`
fanns inte på den angivna platsen vid denna kontroll.

## Förtydliganden och regressioner

Biblioteket visar nu uppladdningens sparade namn och märker den som
uppladdad variant. Sökning hittar både klippnamn, video-ID och familj.
Uppladdningshjälpen beskriver videobanken utan att felaktigt lova lokal
disklagring. Ett regressionstest kontrollerar att idlepolicy och lokalprofil
fortfarande pekar på existerande klipp i exakt rätt familj efter ett takebyte.

Verifierat: manifestkontroll, TypeScript, **525 Lab-tester**, 34 riktade
media-/privatlagringstester och `audit-dealer-sync.mjs --probe` passerade.
Fyra-dealer-proben har de tidigare dokumenterade luckorna kvar: Vera åtta,
Amira två och Mei tre saknade tal-takes. Proben ger ingen mänsklig
läppsynkacceptans. Två verkliga uppspelningar i följd och audiovisuell
acceptans återstår; inga nya spelrundor eller GPU-jobb startades här.

Studio-inventeringen observerades av samordnaren i den befintliga
autentiserade browser-sessionen. Direktnavigering till Studio-API:t
blockerades av browserklientens filter och kringgicks inte. Den privata
Blob-verifieringen ovan är en separat fullständig leverantörsläsning av
filbytes, inte ett påstående om ett nytt komplett Lab→spel-uppspelningsprov.
