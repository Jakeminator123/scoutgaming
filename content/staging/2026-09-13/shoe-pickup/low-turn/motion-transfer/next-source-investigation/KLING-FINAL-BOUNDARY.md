# Two terminal failures; no further Kling retries

Original job b2c6c8c7-0cc5-4281-ae61-9764f650f380 and corrected-reference job4399b225-0dc6-41c8-822c-bda8e32f08c4 both reached terminal failed immediately, without reason or output URL. Both were submitted as video and returned as type image in terminal lookup. This is an observed provider inconsistency, not a diagnosed root cause.

The sole change in the second request was replacing the completed-generation source reference with a directly uploaded and confirmed VIDEO media reference. Downloaded source bytes matched originalSHA ac46fe3283544d40a7d80c6d9f7f1592fe4d9c566887a8abc73f250734419e0b,1920x1080,97frames24fps. Upload used remote curl from its verified CloudFront source, not base64. The video and two actual crop uploads returned HTTP200 and were confirmed. Both complete-media preflights accepted8credits. This rules out simply repeating that reference-resolution workaround as useful; it does not reveal the backend failure.

No visual output exists to assess, and no masks/runtime changes followed. No more Kling submissions are authorized by this investigation. No detailed read-only job-error tool was exposed. No safety rejection or credit refund is evidenced. Receipts omit presigned URLs and transport base64.
