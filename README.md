# Croupier

Recreation of the Sentient Studios "Privé Blackjack" AI-dealer demo, built from scratch with our own Higgsfield-generated dealer persona.

Architecture (mirrors the audited demo, see `reference/`):
- Dealer video = a library of short clips, each starting and ending on the same canonical pose, shipped as raw Annex-B `.h264` elementary streams (one IDR at frame 0) plus a per-frame `[offset,size]` index. The browser splices clips with WebCodecs, owning the clock.
- Speech is never baked into video: audio + viseme timings drive a composited mouth layer (v2).
- Cards/chips/table are UI, never generated video. The client renders; in production the server decides (see the build scope's RGS rule).

## Layout
- `pipeline/` - content pipeline: Higgsfield clip -> 1440x1440@24 raw .h264 -> streams index.json
- `web/` - the game client recreation: table UI, blackjack demo logic, WebCodecs dealer engine
- `content/` - generated persona stills + raw clips (not committed)
- `reference/` - captured public manifests/schemas from the live demo (schema reference only)

## Run
```
node pipeline/build-index.mjs content/encoded web/public/dealer
node web/server.mjs   # http://localhost:4173
```

## Status
- [x] Reference schemas captured (streams index, viseme JSON, atlas blueprint)
- [ ] Persona canonical pose + first clip set (Higgsfield)
- [ ] Encode + index pipeline
- [ ] WebCodecs splice engine
- [ ] Blackjack table UI + demo round logic
