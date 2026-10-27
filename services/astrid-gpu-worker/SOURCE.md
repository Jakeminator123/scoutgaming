# Source provenance

Status: live, retires at the clean slate together with Astrid (see [README.md](README.md)).

Imported from Emil's standalone repository:
https://gitlab.com/EmaCodeHero/astrid-gpu-worker

- Upstream source: `d3a2d0a6672079033a0de3666a8d14122c06e90c`.
- Local streaming implementation: `cbde18a`.
- Read-only endpoint inspection follow-up: `cf0a9f7`.

The source of truth is `main` in `Jakeminator123/scoutgaming`; nothing is published to GitLab, and the imported GitLab CI was removed. The upstream URL and SHA above are the import receipt. Build the GPU image with this directory as Docker's build context; the manual build and private GHCR publish workflows are linked from [README.md](README.md). Publishing an image does not change the deployed endpoint.

The reference gateway player is kept for standalone worker verification. Croupier's production integration uses the shared player in `services/game/public`.
