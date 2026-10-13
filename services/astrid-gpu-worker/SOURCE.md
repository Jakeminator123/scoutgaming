# Source provenance

Imported from Emil's standalone repository:
https://gitlab.com/EmaCodeHero/astrid-gpu-worker

- Upstream source: `d3a2d0a6672079033a0de3666a8d14122c06e90c`.
- Local streaming implementation: `cbde18a`.
- Read-only endpoint inspection follow-up: `cf0a9f7`.

This directory keeps the worker with Croupier's approved GitHub source repository.
The imported GitLab CI and obsolete deployment instructions have been removed;
the upstream URL and source SHA above remain the import receipt. Current work
uses `main` in `Jakeminator123/scoutgaming`, with no GitLab publication.
The root GitHub workflow runs the service tests. Build the GPU image with this
directory as Docker's build context. The manual build and private GHCR publish
workflows are linked from [README.md](README.md). No GPU image is published
automatically, and publishing an image does not change the deployed endpoint.

The reference gateway player is retained for standalone worker verification.
Croupier's production integration uses the shared player in `web/public` and
keeps its turn ownership, pose gates and cancellation. Actual deployment and
GPU visual/timing acceptance are separate from these synthetic checks.
