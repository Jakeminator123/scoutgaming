# Scoped edit terminal failure

Job b2c6c8c7-0cc5-4281-ae61-9764f650f380 was submitted once as kling_video_edit pro after complete-media preflight accepted eight credits. Both actual crop uploads returned HTTP200 with byte-identical SHA256 and were confirmed. The provider returned terminal failed without an error reason or result URL. Submission identifies type video; terminal lookup identifies type image. This inconsistency is recorded, not diagnosed as a cause.

No output video exists to inspect. No runtime files changed and no duplicate retry submitted. The current exposed jobs_wait provides no further failure detail; no detailed job-status tool was exposed. A second read-only immediate terminal lookup confirms failure. No charge/refund conclusion follows from the estimate or failure status.

Exact inputs and successful preflight remain in kling-submission.json. Do not describe this as a visual rejection or a safety rejection: neither is evidenced. It is an unexplained provider failure.
