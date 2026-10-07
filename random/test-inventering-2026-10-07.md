# Testinventering 7 oktober 2026

Inventeringen listar testfilerna som finns i HEAD, vilken körare som startar dem, och vilka som bär pensionerade namn eller dold test-DOM. Inga tester är ändrade, och halvfärdiga ändringar i arbetsträdet är inte använda som facit.

Källa är `git show HEAD:<fil>`. Nio filer kördes med `node --test` för att de varken startar server, webbläsare eller nät mot en tjänst, och inte ligger i dealer-, rigged- eller speech-sviterna. Övriga är ej körda.

## Sammanfattning

| Katalog | Antal |
|---|---:|
| test/ | 141 |
| lab/test/ | 91 |
| lab/components/ | 19 |
| apps/croupier-frontend/test/ | 7 |
| open-claw/ | 17 |
| **Summa** | **275** |

- Utan körare: **12**.
- Ytterligare 3 filer körs bara av `apps/croupier-frontend` npm test. Workflowen anropar inte det scriptet.
- Skippade filer: **6**. Opt-in: **5**. Kräver ffmpeg: **1**. Kräver media och kördes inte: **1**.
- Bedömning: behåll 263, uppdatera 8, ta bort 1, fråga Jakob 3.
- `apps/` har inga egna tester utöver `apps/croupier-frontend/test/`. `node_modules` är inte med.
- Utanför tabellen, men körda i CI: `ops/cloud/test/`, `ops/vercel-entry/test/` (dealer-regression) och `services/astrid-gpu-worker` (jobbet lipsync-worker).

Körare: jobbet `presentation-studio` kör `npm --prefix lab test` (glob `test/*.test.mjs` och `components/*.test.mjs` från `lab/`) och `npm --prefix open-claw/lab test`. Jobbet `dealer-regression` kör `sh .githooks/pre-commit --full`, som är `precommit-full`, plus sju testfiler utanför kroken: `table-http`, `split-rules`, `croupier-inbox`, `croupier-chef`, `github-workflow`, `cloud-readiness` och `inbox`. Den lokala kroken `.githooks/pre-commit` gör samma fulla svit, utom vid en ren dokumentationscommit.

Arbetsträd, läst från HEAD och inte bedömt som nytt arbete: `lab/components/dealer-workspace.test.mjs`, `lab/components/studio-administration.test.mjs`, `lab/components/studio-repair.test.mjs`, `lab/test/dealer-workspace.test.mjs`, `lab/test/launcher.test.mjs` (borttagen i arbetsträdet), `lab/test/scout-navigation.test.mjs`, `lab/test/studio-navigation.test.mjs`, `lab/test/workspace-surface-pages.test.mjs`, `lab/test/workspace-surfaces.test.mjs`. Ospårade och därför inte i tabellen: `lab/components/control-pages.test.mjs`, `lab/test/activity-store.test.mjs`.

## Tabell

| # | Fil | Körs av | Status | Bedömning | Skäl |
|---|---|---|---|---|---|
| T1 | apps/croupier-frontend/test/game-entry.mjs | dealer-regression (precommit-full); apps npm test | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T2 | apps/croupier-frontend/test/intro-device.mjs | apps npm test (ej i workflow) | grön | behåll | Grön här. apps npm test kör den, men workflow och kroken gör det inte. |
| T3 | apps/croupier-frontend/test/landing-motion.mjs | apps npm test (ej i workflow) | grön | behåll | Grön här. apps npm test kör den, men workflow och kroken gör det inte. |
| T4 | apps/croupier-frontend/test/platform-native-websocket.mjs | dealer-regression (precommit-full); apps npm test | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T5 | apps/croupier-frontend/test/platform-ui.mjs | dealer-regression (precommit-full); apps npm test | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T6 | apps/croupier-frontend/test/platform-websocket.mjs | dealer-regression (precommit-full); apps npm test | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T7 | apps/croupier-frontend/test/player-area.mjs | apps npm test (ej i workflow) | grön | behåll | Grön här. apps npm test kör den, men workflow och kroken gör det inte. Skyddar lobby, profil och historik. |
| T8 | lab/components/dashboard-brand.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T9 | lab/components/dealer-workspace.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | uppdatera | HEAD kräver en dold select med aria-label Dealer, bredvid de synliga dealer-chippen. |
| T10 | lab/components/event-test-panel.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T11 | lab/components/event-tree.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T12 | lab/components/idle-policy-editor.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T13 | lab/components/idle-reactions.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T14 | lab/components/kevin-bo/preview.test.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T15 | lab/components/lab-idle-surface.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T16 | lab/components/openclaw-workspace.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T17 | lab/components/original-media-player.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T18 | lab/components/partner-reference.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T19 | lab/components/presentation-sequence.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T20 | lab/components/social-chat-panel.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T21 | lab/components/studio-administration.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T22 | lab/components/studio-login.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T23 | lab/components/studio-repair.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T24 | lab/components/trigger-value.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T25 | lab/components/video-workflow.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T26 | lab/components/voice-preview-panel.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T27 | lab/test/activity-log.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T28 | lab/test/activity-presentation-owner.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T29 | lab/test/backoffice-navigation.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T30 | lab/test/blob-source-routing.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T31 | lab/test/check-build-traces.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T32 | lab/test/cloud-media-store.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T33 | lab/test/cloud-proxy-request.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T34 | lab/test/cloud-video-upload.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T35 | lab/test/companion.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T36 | lab/test/dealer-workspace.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T37 | lab/test/elevenlabs-preview.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T38 | lab/test/engine-compatibility.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T39 | lab/test/family-video-upload.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T40 | lab/test/file-video-lifecycle.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T41 | lab/test/game-stream-lifecycle.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T42 | lab/test/http-guard-cloud.test.mjs | presentation-studio (lab npm test) | ej körd | uppdatera | Använder /lissabon som exempel på en tillåten sidhämtning. Byt till en levande adress. |
| T43 | lab/test/http-guard.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T44 | lab/test/idle-advice-server.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T45 | lab/test/idle-policy-layout.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T46 | lab/test/idle-policy.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T47 | lab/test/idle-reaction-input.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T48 | lab/test/lab-url.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T49 | lab/test/lab-video-manifest.test.mjs | presentation-studio (lab npm test) | skippad (symlink) | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T50 | lab/test/launcher.test.mjs | presentation-studio (lab npm test) | skippad (3 av 4 på Linux) | ta bort | Tre tester körs bara på Windows och läser Start-Labb.ps1. Cmd-testet läser Start-Labb.cmd. Jakob tog bort de startfilerna 7 okt. |
| T51 | lab/test/legacy-clip-policy.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T52 | lab/test/lissabon-observation.test.mjs | presentation-studio (lab npm test) | ej körd | uppdatera | Testet gäller rullande partner-spår. Bara rubriken säger Lissabon. |
| T53 | lab/test/live-idle.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T54 | lab/test/local-start.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T55 | lab/test/media-family-playback.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T56 | lab/test/media-family-resolver.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T57 | lab/test/motion-library.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T58 | lab/test/native-lab-chat.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T59 | lab/test/native-observation.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T60 | lab/test/native-session-channel.test.mjs | presentation-studio (lab npm test) | ej körd | uppdatera | Testet gäller sessionskanal efter omladdning. Bara rubriken säger Lissabon. |
| T61 | lab/test/neon-project-store.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T62 | lab/test/neon-video-registry.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T63 | lab/test/next-page-navigation.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Ett test bevisar att den pensionerade sidan /lissabon omdirigerar till /control. |
| T64 | lab/test/openclaw-admin.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T65 | lab/test/openclaw-dashboard.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T66 | lab/test/operator-catalog.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T67 | lab/test/original-media.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T68 | lab/test/page-template.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T69 | lab/test/partner-observer.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T70 | lab/test/partner-preview.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T71 | lab/test/partner-reference.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T72 | lab/test/partner-session.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Skyddar konto, roll, inloggning, inbjudan eller spelhistorik. |
| T73 | lab/test/partner-team.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Skyddar konto, roll, inloggning, inbjudan eller spelhistorik. |
| T74 | lab/test/playback-trace.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T75 | lab/test/presentation-director.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T76 | lab/test/presentation-profile.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T77 | lab/test/presentation-sequence.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T78 | lab/test/project-store.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T79 | lab/test/reference-connection.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T80 | lab/test/remote-ui.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T81 | lab/test/retire-demo-examples.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T82 | lab/test/scout-navigation.test.mjs | presentation-studio (lab npm test) | ej körd | uppdatera | Importerar STUDIO_PRIMARY_NAVIGATION och STUDIO_TOOL_NAVIGATION. Den synliga menyn kommer från scout-navigation.mjs. |
| T83 | lab/test/social-playback.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T84 | lab/test/social.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T85 | lab/test/studio-access-policy.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T86 | lab/test/studio-admin-api.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T87 | lab/test/studio-admin-contract.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T88 | lab/test/studio-admin-data.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T89 | lab/test/studio-admin-readouts.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T90 | lab/test/studio-clip-controls-api.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T91 | lab/test/studio-companion-cookie.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T92 | lab/test/studio-contract.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T93 | lab/test/studio-document-api.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T94 | lab/test/studio-login-client.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T95 | lab/test/studio-login-form.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | opt-in (2 tester) | behåll | Två webbläsartester är opt-in. Resten skyddar inloggningen och ska vara kvar. |
| T96 | lab/test/studio-media-api.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T97 | lab/test/studio-model.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T98 | lab/test/studio-native-auth.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Skyddar konto, roll, inloggning, inbjudan eller spelhistorik. |
| T99 | lab/test/studio-native-credentials.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T100 | lab/test/studio-native-mail.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T101 | lab/test/studio-native-request.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T102 | lab/test/studio-native-runtime.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T103 | lab/test/studio-navigation.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | uppdatera | Rad 108 kräver sr-only-texten Nivå 1 · ScoutGamingGroup, och rad 20 låser menyetiketten Kontrollpanel i en konstant ingen vy använder. |
| T104 | lab/test/studio-project-bindings.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T105 | lab/test/studio-render-persistence.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T106 | lab/test/studio-server.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T107 | lab/test/studio-social-status.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T108 | lab/test/studio-upload-service.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T109 | lab/test/studio-voice-lines.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Skyddar repliklistan i studio-voice-lines och får inte tas bort. |
| T110 | lab/test/upload-native-video.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T111 | lab/test/video-intake.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T112 | lab/test/video-registry.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | skippad (symlink) | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T113 | lab/test/voice-preview.test.mjs | presentation-studio (lab npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T114 | lab/test/workspace-surface-pages.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T115 | lab/test/workspace-surfaces.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T116 | lab/test/zone-cloud-store.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | kräver ffmpeg | behåll | Två tester anropar ffmpeg. De är gröna i CI och faller lokalt utan ffmpeg. |
| T117 | lab/test/zone-reference.test.mjs | presentation-studio (lab npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T118 | open-claw/lab/deploy/companion-search-server.test.mjs | presentation-studio (open-claw npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T119 | open-claw/lab/deploy/gateway-config.test.mjs | presentation-studio (open-claw npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T120 | open-claw/lab/deploy/local-connection.test.mjs | presentation-studio (open-claw npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T121 | open-claw/lab/deploy/local-session.test.mjs | presentation-studio (open-claw npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T122 | open-claw/lab/deploy/runtime-bundle.test.mjs | presentation-studio (open-claw npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T123 | open-claw/lab/deploy/start-gateway.test.mjs | presentation-studio (open-claw npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T124 | open-claw/lab/test/companion.test.mjs | presentation-studio (open-claw npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T125 | open-claw/lab/test/dashboard-proxy.test.mjs | presentation-studio (open-claw npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T126 | open-claw/lab/test/engine.test.mjs | presentation-studio (open-claw npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T127 | open-claw/lab/test/gateway-rpc.test.mjs | presentation-studio (open-claw npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T128 | open-claw/lab/test/product-speech.test.mjs | presentation-studio (open-claw npm test) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T129 | open-claw/lab/test/server.test.mjs | presentation-studio (open-claw npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T130 | open-claw/lab/test/settings.test.mjs | presentation-studio (open-claw npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T131 | open-claw/lab/test/social.test.mjs | presentation-studio (open-claw npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T132 | open-claw/lab/test/speech-routing.test.mjs | presentation-studio (open-claw npm test) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T133 | open-claw/lab/test/studio-admin.test.mjs | presentation-studio (open-claw npm test); dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T134 | open-claw/lab/test/studio-endpoints.test.mjs | presentation-studio (open-claw npm test) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T135 | test/account-credentials.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar konto, roll, inloggning, inbjudan eller spelhistorik. |
| T136 | test/action-placement.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T137 | test/activate-native-ai-qa.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T138 | test/agent-talk.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T139 | test/animation-clock.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T140 | test/astrid-camera-audio.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T141 | test/astrid-camera-control.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T142 | test/astrid-camera.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T143 | test/astrid-chat-visibility.mjs | **ingen** | grön | behåll | Ingen körare, men filen är grön och skyddar att Astrid-chatten syns. Bör in i precommit-full. |
| T144 | test/astrid-transcription.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T145 | test/astrid-wake-word.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T146 | test/backoffice-lab-browser.mjs | **ingen** | opt-in | uppdatera | Opt-in Playwright utan körare. Väntar på menyn Backoffice/Lab. Rätt namn är ScoutGamingGroup administration. Astrid-repetitionen ska vara kvar. |
| T147 | test/backup-lissabon-state.mjs | dealer-regression (precommit-full) | skippad (symlink) | fråga Jakob | Verktyget tar en offline-kopia av labbets spelardata och ska inte raderas. Namnet är det gamla produktnamnet. |
| T148 | test/backup-render-state.mjs | dealer-regression (precommit-full) | skippad (symlink) | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T149 | test/blackjack-asset-state.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T150 | test/blackjack-entry-http.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T151 | test/bo-game-auth.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar konto, roll, inloggning, inbjudan eller spelhistorik. |
| T152 | test/bo-lab-auth.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar konto, roll, inloggning, inbjudan eller spelhistorik. |
| T153 | test/bo-media-preview.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T154 | test/bugshot-report.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T155 | test/build-index.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T156 | test/casino-navigation.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T157 | test/chat-response.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T158 | test/check-environment-variables.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T159 | test/check-migration-readiness.mjs | **ingen** | grön | behåll | Ingen körare. CI kör verktyget, inte det här testet. Filen är grön och bör in i kroken. |
| T160 | test/clip-mapping.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T161 | test/cloud-admin-bootstrap.mjs | **ingen** | ej körd | behåll | Ingen körare. Startar en lokal server och skyddar moln-bootstrap av operatörskontot. Ej körd här. |
| T162 | test/cloud-readiness.mjs | dealer-regression (explicit) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T163 | test/craig-login.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T164 | test/croupier-chef.mjs | dealer-regression (explicit) | ej körd | fråga Jakob | Testet håller liv i låset från den nedlagda GitLab-inboxen, som chefen fortfarande importerar. |
| T165 | test/croupier-inbox.mjs | dealer-regression (explicit) | ej körd | fråga Jakob | GitLab-inboxen är nedlagd, men croupier-chef importerar fortfarande identity och acquireLock därifrån. |
| T166 | test/dealer-collection.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T167 | test/dealer-face-calibration.mjs | **ingen** | ej körd | behåll | Ingen körare. Dealer-ansikte, och den ytan får inte tas bort. |
| T168 | test/dealer-face-skin.mjs | **ingen** | kräver media | behåll | Ingen körare. Läser Astrids ansiktsrigg under media och får inte tas bort. |
| T169 | test/dealer-face.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T170 | test/dealer-motion.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T171 | test/dealer-reach.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T172 | test/dealer-rhythm.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T173 | test/dealer-skin-contact.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T174 | test/dealer-smooth60.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T175 | test/dealer-sync-audit.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T176 | test/dealer-version-switcher.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T177 | test/dealing-cues.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T178 | test/fuzz-blackjack.mjs | **ingen** | ej körd | behåll | Ingen körare. Manuell fuzz av spelmotorn med seed. Får inte tas bort. |
| T179 | test/game-entry-auth.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T180 | test/game-entry-contract.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T181 | test/game-entry-partner.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T182 | test/game-lanes.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T183 | test/generated-speech-chat.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T184 | test/generated-speech-player.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T185 | test/generated-speech-provider.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T186 | test/generated-speech-session.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T187 | test/generated-speech-stream-http.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T188 | test/generated-speech-stream-player.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T189 | test/generated-speech-stream.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T190 | test/generated-speech.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T191 | test/generation-media.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T192 | test/generations-api.mjs | **ingen** | ej körd | behåll | Ingen körare. Lokal server för generations-API. Bör in i kroken. Ej körd här. |
| T193 | test/gitguardian-read.mjs | dealer-regression (precommit-full) | ej körd | behåll | Avvisar en felaktig GitLab-typ i säkerhetsstatusen. |
| T194 | test/github-workflow.mjs | dealer-regression (explicit); precommit docs-läge | ej körd | behåll | Avvisar GitLab-remote och kräver att GitLab är pausat. |
| T195 | test/idle-video-loop.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T196 | test/inbox.mjs | dealer-regression (explicit); precommit docs-läge | ej körd | behåll | Skyddar teaminboxen på GitHub. Körs i dealer-regression, inte i precommit-full. |
| T197 | test/lab-speech-bridge.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T198 | test/lane-media-audit.mjs | **ingen** | grön | behåll | Ingen körare, men filen är grön. Den hindrar att live-media raderas av misstag och bör in i kroken. |
| T199 | test/lissabon-profiles.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar profil-API:t som hör till den levande lane-flaggan. |
| T200 | test/local-card-overlay.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T201 | test/local-comparison-fixture.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T202 | test/local-presentation.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T203 | test/media-blob-export.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T204 | test/media-deduplication.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T205 | test/media-layout.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T206 | test/media-migration.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T207 | test/migrate-lab-state.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar flytten från den gamla katalogen lissabon/data till lab/data. |
| T208 | test/movement-cues.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T209 | test/native-observation.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T210 | test/native-p6-game-playback.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T211 | test/native-partner-events.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T212 | test/openclaw-chat-contract.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T213 | test/operator-speech-qa.mjs | dealer-regression (precommit-full) | skippad (symlink) | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T214 | test/operator-store.mjs | **ingen** | grön | behåll | Ingen körare, men filen är grön. Den skyddar operatörsmedlemskap och paket och bör in i kroken. |
| T215 | test/pack-contact-media.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T216 | test/partner-access-policy.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T217 | test/partner-launch-route.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T218 | test/performance-contact.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T219 | test/performance-player-source.mjs | **ingen** | grön | behåll | Ingen körare, men filen är grön. Samma hash ska bara hämtas en gång. Bör in i kroken. |
| T220 | test/player-auth-limiter.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar konto, roll, inloggning, inbjudan eller spelhistorik. |
| T221 | test/player-auth.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar konto, roll, inloggning, inbjudan eller spelhistorik. |
| T222 | test/player-chat-memory.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T223 | test/player-history.mjs | **ingen** | grön | behåll | Ingen körare, men filen är grön. Den skyddar spelhistorik och bör in i kroken. |
| T224 | test/player-password.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar lösenordsåterställning, även sessionstabellen med det gamla namnet. |
| T225 | test/player-probe.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar konto, roll, inloggning, inbjudan eller spelhistorik. |
| T226 | test/player-results.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T227 | test/player-signup.mjs | dealer-regression (precommit-full) | ej körd | uppdatera | Ett test heter Lissabon login route men kollar bara blackjack-adressen. Övriga tester skyddar spelarinloggning. |
| T228 | test/postgres-native-table.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T229 | test/postgres-operator-speech-qa.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T230 | test/postgres-persistence.mjs | dealer-regression (precommit-full) | opt-in | behåll | Det riktiga databasfallet är opt-in. Det skyddar konton, epoker och probe. |
| T231 | test/postgres-speech-journal.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T232 | test/precommit-checks.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T233 | test/product-chat-client-contract.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T234 | test/product-chat-http.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T235 | test/ready-motion.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T236 | test/rigged-card-layout.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T237 | test/rigged-discard-state.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T238 | test/rigged-face-bindings.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T239 | test/rigged-face-playback.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T240 | test/rigged-layout-contact.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T241 | test/scene-join.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T242 | test/security-status.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T243 | test/server-shutdown.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T244 | test/shoe-contact-occlusion.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T245 | test/shoe-game.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T246 | test/speech-blob-artifacts.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T247 | test/speech-journal-runtime.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T248 | test/speech-ledger-import.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T249 | test/speech-ledger-snapshot.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T250 | test/speech-package-contract.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T251 | test/speech-playback.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T252 | test/speech-pose-gate.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar dealer, tal eller media och får inte tas bort. |
| T253 | test/split-rules.mjs | dealer-regression (explicit) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T254 | test/sqlite-postgres-migration.mjs | dealer-regression (precommit-full) | opt-in | behåll | Opt-in mot isolerad Postgres. Skyddar import av historik och ska vara kvar. |
| T255 | test/studio-admin-accounts.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar konto, roll, inloggning, inbjudan eller spelhistorik. |
| T256 | test/studio-cutover-integration.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T257 | test/studio-game-authority.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T258 | test/studio-game-commands.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T259 | test/studio-game-policy.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T260 | test/studio-lab-session.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T261 | test/studio-legacy-snapshot.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T262 | test/studio-media-runtime.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T263 | test/studio-migrations.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T264 | test/studio-native-auth-actions.mjs | dealer-regression (precommit-full) | ej körd | behåll | Skyddar konto, roll, inloggning, inbjudan eller spelhistorik. |
| T265 | test/studio-partner-epoch.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T266 | test/studio-postgres-integration.mjs | dealer-regression (precommit-full) | opt-in | behåll | Opt-in mot isolerad Postgres. Skyddar Studio-migrering och taljournaler. |
| T267 | test/studio-repository.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T268 | test/studio-retained-bank.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T269 | test/system-map-verify.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T270 | test/system-map.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T271 | test/table-audio.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T272 | test/table-http.mjs | dealer-regression (explicit) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T273 | test/vercel-frontend-origin.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T274 | test/vercel-presentation-video-origin.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |
| T275 | test/verified-video-buffer.mjs | dealer-regression (precommit-full) | ej körd | behåll | Körs av en riktig körare och täcker nuvarande kod. |

## Pensionerade namn

Sökningen gjordes i testfilerna i HEAD. `/labb` gav inga träffar. `Start-Lab.cmd` och `Start-Lissabon.cmd` nämns inte. Träffarna på `Start-Lab` är `Start-Labb`.

### Levande

- Filvägar som innehåller teckenföljden `/lab/` (`../lab/`, `open-claw/lab`, `/app/lab/`): levande. Det är labb-paketet, inte produktsidan `/lab`. 69 rader, bland annat `apps/croupier-frontend/test/platform-ui.mjs:33`, `lab/test/engine-compatibility.test.mjs:4`, `lab/test/local-start.test.mjs:7`, `test/local-presentation.mjs:10`, `test/studio-admin-accounts.mjs:3`.
- `/api/auth/lab/`: levande. Det är labbets inloggnings-API, inte sidan `/lab`. `test/bo-lab-auth.mjs:46, 102–105, 138, 143, 147–149, 162, 171, 173, 179, 181, 183, 186, 197`. `test/postgres-persistence.mjs:90, 97, 99, 101`. `test/studio-lab-session.mjs:5, 13`. `apps/croupier-frontend/test/platform-ui.mjs:180`.
- `/bo/` och `/api/bo/`: levande. `/bo` omdirigerar till `/control`, och testerna spärrar gamla BO-anrop. 71 rader, bland annat `test/bo-game-auth.mjs:30, 68–70, 73–77, 79–80, 101, 116`, `apps/croupier-frontend/test/platform-ui.mjs:167, 171, 180, 209, 219–221, 225–226, 228, 242`, `test/generation-media.mjs:17, 51, 53, 87, 96, 108` (filer under `web/public/bo/`).
- `studio/login`: levande. `/control/login` återexporterar `/login`, och `/studio/login` är samma sida med basePath. 16 rader, bland annat `lab/test/studio-login-form.test.mjs:162, 221, 248, 253`, `lab/test/next-page-navigation.test.mjs:45, 85, 201, 254`, `test/bo-game-auth.mjs:83, 89`.
- `lissabon-stream-lane` och `CROUPIER_LISSABON_PROFILES`: levande lane-flagga. Bland annat `lab/test/local-start.test.mjs:54, 60, 63–65, 67`, `open-claw/lab/deploy/local-connection.test.mjs:167, 170, 177, 204, 208, 565, 597, 634, 670`, `test/blackjack-entry-http.mjs:27`, `test/product-chat-http.mjs:97`, `test/backoffice-lab-browser.mjs:21`.
- `lab/test/next-page-navigation.test.mjs:227, 229`: levande. Bevisar att `lab/app/lissabon/page.tsx` omdirigerar till `/control`.
- `test/bo-lab-auth.mjs:130, 132`: levande. `/lissabon` är en tillåten intern returväg i inloggningen. Sidan omdirigerar sedan vidare.
- `test/lissabon-profiles.mjs:10, 14, 22, 25, 30, 32, 84, 87` och `test/product-chat-http.mjs:65, 98, 181–182, 433, 435, 439, 444, 455, 461, 484–485, 490–491, 497, 544–548`: levande. Profil-API och lane-läge.
- `test/migrate-lab-state.mjs:11, 18, 31, 34`, `lab/test/local-start.test.mjs:17, 18, 20, 25, 28`, `open-claw/lab/deploy/local-session.test.mjs:19, 30, 32`: levande. Känner igen och flyttar den gamla katalogen `lissabon/data`.
- `test/player-password.mjs:16, 32, 39, 49, 50, 56`: levande. Lösenordsbyte ska tömma tabellen `lissabon_profile_sessions`.
- `test/astrid-camera.mjs:64, 67, 74` och `open-claw/lab/deploy/local-connection.test.mjs:162, 206`: levande. Kameran kräver lane-flaggan. Ordvalet Lissabon sitter i rubrik och feltext.
- `test/github-workflow.mjs:27, 37` och `test/gitguardian-read.mjs:42`: levande. Spärr mot GitLab-remote och fel repotyp.

### Pensionerat

- `lab/test/launcher.test.mjs:9, 37, 38`: pensionerat. Start-Labb.ps1 och Start-Labb.cmd är borta enligt beslut 7 okt.
- `lab/test/studio-navigation.test.mjs:18, 20`: pensionerat som menyetikett. Den synliga menyn säger Översikt, inte Kontrollpanel. Ordet finns kvar i partnertexter utanför testet.
- `test/backoffice-lab-browser.mjs:57, 184, 188`: pensionerat. Menyn heter ScoutGamingGroup administration.
- `lab/test/http-guard-cloud.test.mjs:56, 61`: pensionerat exempel. Sidan finns bara som omdirigering.
- `lab/test/lissabon-observation.test.mjs:8` och `lab/test/native-session-channel.test.mjs:8`: pensionerat namn i rubriken. Byt rubrik, behåll testet.
- `test/player-signup.mjs:52`: pensionerat namn. Själva kontrollen är en blackjack-adress.

### Fråga Jakob

- `test/backup-lissabon-state.mjs:7, 11, 35, 37, 48, 61, 63, 69, 77, 89, 97, 105, 112, 113, 121`: levande backup av spelardata, pensionerat namn. Döp om eller låt ligga. Radera inte.
- `test/croupier-inbox.mjs:7, 24, 148, 159, 268` och `test/croupier-chef.mjs:23` och `test/github-workflow.mjs:7`: GitLab-inboxen är nedlagd. Chefen importerar fortfarande lås och identitet därifrån. Rad 268 är en testfixtur, inget riktigt token.

## Dold DOM och testkonstanter

- `lab/components/workspace-navigation.tsx:49` har `<span class="sr-only" aria-hidden="true">Nivå 1 · ScoutGamingGroup</span>`. `aria-hidden` gör att varken syn eller skärmläsare får texten. `lab/test/studio-navigation.test.mjs:108` kräver exakt den strängen. Smulans synliga text är bara Nivå 1, och menyns namn är ScoutGamingGroup administration.
- `lab/lib/studio-navigation.mjs` exporterar `STUDIO_PRIMARY_NAVIGATION` och `STUDIO_TOOL_NAVIGATION`. Ingen UI-komponent importerar modulen. Bara `lab/test/studio-navigation.test.mjs` och `lab/test/scout-navigation.test.mjs`. Den synliga menyn är `SCOUT_NAVIGATION` i `lab/lib/scout-navigation.mjs`, där `/control` heter Översikt.
- `lab/components/lab-studio.tsx:131` (HEAD) har en `sr-only`-select med `aria-label="Dealer"` bredvid chip-knapparna. `lab/components/dealer-workspace.test.mjs:69, 86, 117` (HEAD) kräver den selecten. Den synliga växlingen är chippen.

## Döda hjälpare

- `test/fixtures/astrid-camera-browser.html`: ingen fil i repot nämner namnet. Det är en manuell QA-sida för syntetisk kamera. Fråga Jakob innan den tas bort.
- Övriga fixtures importeras: `test/fixtures/copy-openclaw-runtime.mjs`, `generated-speech-stream-fetch.mjs`, `shutdown-process.mjs`, `speech-memory-pool.mjs`, `studio-memory-pool.mjs`, `synthetic-jpeg.mjs`, `lab/test/fixtures/legacy-project.mjs` (och dess json), `open-claw/lab/fixtures/scenarios.json`.
- `test/local-comparison-fixture.mjs` är en vanlig testfil i precommit-full, inte en död hjälpare.

## Förslag på ordning

1. Ta bort `lab/test/launcher.test.mjs` i samma leverans som startfilerna. Det är det enda testet som bör bort, och beslutet är redan taget.
2. Uppdatera `lab/test/studio-navigation.test.mjs` och `lab/test/scout-navigation.test.mjs` så de följer `scout-navigation.mjs`. Ta sedan bort sr-only-spanen och, om ingen annan använder den, `lab/lib/studio-navigation.mjs`.
3. Uppdatera `lab/components/dealer-workspace.test.mjs` så den använder chippen. Ta sedan bort den dolda selecten i `lab-studio.tsx`. Arbetsträdet har redan börjat på den filen; utgå från HEAD när den leveransen är inne.
4. Byt rubrik eller exempel i `lissabon-observation`, `native-session-channel`, `player-signup` och `http-guard-cloud`. Låg risk, inget beteende ska ändras.
5. Uppdatera menynamnet i `test/backoffice-lab-browser.mjs`. Låt den vara opt-in. Den kör Astrid-repetition och ska inte in i CI utan ett ja.
6. Lägg de gröna filerna utan körare i precommit-full: `player-history`, `operator-store`, `check-migration-readiness`, `lane-media-audit`, `astrid-chat-visibility`, `performance-player-source`. Samma för `cloud-admin-bootstrap` och `generations-api` när någon har kört dem. Fuzz och dealer-face rörs inte.
7. Bestäm om de tre frontendtesterna (`player-area`, `landing-motion`, `intro-device`) ska in i dealer-regression. De är gröna och skyddar nivå 3, men CI kör dem inte.

Rör inte `test/dealer-*`, `test/rigged-*`, `test/speech-*`, `test/generated-speech*`, repliklistan, konton, operatörsmedlemskap, inbjudningar, lösenord, inloggning, lane-paket, probe, spelmotor eller plånbok.
