# Videoregister inför nästa etapp

Lägg egna videofiler här medan registret byggs; innehållet är Git-ignorerat.
Labbet läser inga befintliga produktmedia från denna mapp i första versionen.
Använd ett stabilt take-id och håll talets text, ljud, video och kalibrering
samman som ett paket. Matcha aldrig talvideo efter ungefärlig längd.

Förslag på en JSON-post (YAML kan användas som redaktionellt källformat):

```json
{
  "id": "astrid-win-calm-take-001",
  "sourceRef": "presentation[].type=speak,line=win",
  "nodeId": "speak.other",
  "variantId": "speak.other.standard",
  "dealer": "astrid",
  "kind": "speech",
  "line": "win",
  "text": "EXAKT INSPELAD TEXT",
  "video": "astrid-win-calm-take-001.mp4",
  "audio": "astrid-win-calm-take-001.wav",
  "videoSha256": "FYLL_I_HASH",
  "audioSha256": "FYLL_I_HASH",
  "fps": 24,
  "frameIndex": "astrid-win-calm-take-001.frames.json",
  "cues": {},
  "calibration": "astrid-win-calm-take-001.calibration.json",
  "status": "draft",
  "acceptanceNotes": "Inte visuellt godkänd ännu"
}
```

Detta är en insamlingsmall, inte ett påstått nytt Generations API-kontrakt.
Fysiska handlingar behöver target och exakta `pickup`, `release`, `land`,
`rest` i rätt frame/tidsenhet. En ny ljud-/videohash ogiltigförklarar den
tidigare visuella acceptansen. `draft`, `want` eller liknande intake-ord
innebär inte godkänd take. När formatet låses införlivar video-adaptern dessa
krav och den delade spelarens befintliga validering.
