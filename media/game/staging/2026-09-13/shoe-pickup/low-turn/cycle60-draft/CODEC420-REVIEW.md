#420 codec candidate

- pickup: 75 frames compared; worst G threshold128 differences 93pixels; minimum G IoU 0.991739; maximum face RGB MAE 2.416/255.
- slide: 66 frames compared; worst G threshold128 differences 93pixels; minimum G IoU 0.993126; maximum face RGB MAE 2.497/255.
- return: 40 frames compared; worst G threshold128 differences 73pixels; minimum G IoU 0.993648; maximum face RGB MAE 2.514/255.

Representative encoded hand/RG crops inspected in pickup and slide. Mask and visible hand alignment remains similar;420 subsampling changes thin alpha edges and reduces colour precision. RGB mean shifts approximately−1 to−2 code levels in sampled face region. Browser hardware decoding and actual frame delivery require root A/B. Full181 encoded frames are compared numerically; no browser performance claim by this agent.
