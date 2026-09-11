# Astrid replacement candidate — 11 September 2026

Higgsfield can supply new visual references, generated 3D geometry/materials and an initial rig. These outputs still require anatomical inspection, facial/finger rig work and authored blackjack motion. A new original character mesh and a separate provider body rig have now been generated. Neither is accepted as a finished realistic dealer.

## Current run after refill

The user refilled the same account. MCP balance verified **626.4 credits** before generation; the three saved views submitted successfully. The original failed submission is kept below as history, not a current blocker.

The first two profiles placed the arms lower and rotated the forearms relative to the front A-pose. A bounded GPT Image 2 high-quality retry corrected edge-on hands and brought fingertip height close to the original reference. These are plausible generation inputs, not a photogrammetrically exact set. The original rear view is retained; an initial low-resolution claim that it showed palms was corrected after inspecting its original PNG. A rear correction was already submitted before that correction arrived, and is preserved but not selected.

Tripo quad job `e8b86c2c-ba3d-4751-8c19-64ecc2e34a37` failed without a stated reason. A single triangle-output retry, `81c28894-4323-44b3-9bda-3a0a32100c5a`, completed and delivered a real GLB: 190,224 triangles, three embedded 4096px PBR maps, no rig. The original and packed editable Blender source are saved under `inspection/`. Actual front and hand review accepted it only for a rigging trial. Eye detail, fixed gaze, sculpted hair and cuff edges remain visible limitations.

Body-rig job `7e425dab-4e40-4a45-972e-a9cfb78ea961` completed with 22 body bones, no finger/eye/jaw bones, no facial shapes and an unsolicited base action. It also replaced the original material maps. This provider rig is not suitable to install unchanged. Preserve its original bytes; inspect a separate transfer of body weights onto the original geometry/materials, then add controls fitted to the actual new hands. Read `rig-candidate/submission.json` and the inspection receipts. No full card action or realism acceptance is claimed.

Chrome was used to inspect the actual source front and hand renders. Higgsfield's website 3D viewer reported “The scene could not be loaded”; the delivered GLB itself imports and reopens in Blender successfully. This is a website preview failure, not evidence that the source file failed.

References were generated through MCP. The MCP image endpoint rejects 3D models and no generate_3d tool is exposed; the authenticated existing Higgsfield CLI successfully submitted this mesh on the same funded account. A read-only CLI estimate of the 180k detailed configuration was 19.5 credits before the face limit was reduced to 120k.

Both source and gameplay tasks reviewed the profile retries and agreed to inspect one mesh rather than generate more reference sets. `../dealer-source-assessment/REFERENCE-REVIEW.md` records remaining proportion uncertainty. Live Jira CAC-2 and CAC-4 were re-read including mapped custom fields and remain **In Dev**.

## Earlier failed attempt

Three Nano Banana 2 4K reference views were submitted through MCP using the existing full-body and neutral-face Astrid generation IDs. The service rejected all three before creating a job: `Out of credits on Team (monthly) plan in Shared workspace.`

The read-only balance reports **1.4 credits**. The only accessible workspace returned is **Scout Gaming Group**, shared, owner access, team plan. Its `is_selected` flag is false; the balance and rejection identify a shared team context, so a top-up in another context is not proven available here. Free allowances are for Genjutsu/Viral only; unlimited generation is not available.

Each exact reference request costs **3 credits**, so these three views need **9 credits**. This is a reference-only estimate: 3D generation, rigging and retries are additional and not yet priced. Plans/credits information: https://higgsfield.ai/mcp-pricing

## Saved work and next execution

- `reference-requests.json`: exact three-view prompts and original identity inputs; no need to recreate the brief.
- `submission-receipt.json`: zero jobs submitted, three pre-submission failures.
- `preflight.json`: balance, accessible workspace, reference estimate and unavailable 3D cost route.
- `mesh-settings-candidate.json`: catalog-confirmed Tripo H3.1 detailed multiview/PBR candidate settings. These are not a submitted job.

The references, mesh and provider body rig have now been generated. Preserve their original outputs; inspect geometry, rig, fingers, facial controls and material maps with `pipeline/inspect-dealer-asset.mjs` if it is GLB, or native inspection if another format. Retain source and produce a separate optimized rigged export only after visual inspection.

The current MCP catalog exposes 3D model metadata, but `estimate_image_cost` explicitly rejects 3D and requests `generate_3d`; no callable generate_3d/estimate_3d was present in the tool inventory. The actual 3D route was the installed authenticated Higgsfield CLI; do not label an image a 3D model or claim a 3D estimate was obtained.

## Acceptance and collaboration

Use the whole-dealer assessment in `../dealer-source-assessment/ASSESSMENT.md`. One natural pickup, hand contact, release and return in the actual seated game comes before the full asset set. Generated stock animation and dense meshes do not establish realistic blackjack performance. Preserve backend authority, the existing table/contact targets and source-clock speech bindings.

The task “Skapa riggad blackjackrobot” owns independent candidate inspection; this task owns generation. No duplicate paid jobs. Collar studies are frozen, ff62751 remains preserved, and no public model, production loader or other dealer was changed for this attempt.
