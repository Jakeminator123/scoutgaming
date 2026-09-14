# Precomputed grayscale alpha experiment

No browser/default/public integration. `build.py` streams original106PNG RGB/RG through the existing89-row nearest-native map. No raw PNG duplication. Crop352,64,1072,752. Output topRGB, middlereargray, bottomfrontgray,1072×2256 High/yuv420p CRF14.89frames,1,196,519bytes,6.44Mbps. Decodearea41.68% below full1920×2160;50% above two-tilecroppedcontrol.

Original-mask formula f=min(R,G), b=(R-f)/(1-f), b=0 atf=1. Compute beforeencoding; roundalpha8bit and repeat intoRGB channels of grayscale tiles. Shader can sample only redchannel for each alpha and avoid postdecode division entirely. Cards remain original1920coordinates; actorplane remains croptranslated. Tile boundaries are even, preserving420chroma alignment; outerpad means tileboundary samples are transparent.

All89decodedframes compared against ORIGINAL PNG truth, not prior encodedRG. Mean rearalpha absoluteerror0.000358 vs0.005041 existingcroppedHighRG; frontal0.0000566 vs0.000563; combinedactoralpha0.000386 vs0.002368. Worstalpha remains~0.271 in grayscale (vsrear1.0 packedRG), so not lossless/no visualacceptance. Black-composited RGBmeanerror0.000828 vs0.001510 normalized0..1; maximum0.234 vs0.631. Exact perframe metrics in receipt.json.

Caveat: newgrayscale encodes directly fromoriginalPNG, whereas previouspackedRGHigh derives frompreviouscompressedfullpacked thenlosslesscrop thenCRF14. Comparison measures candidate quality against originaltruth; it does not isolate chromamixing from generational loss. The formula removes a known amplification mechanism, but all improvement must not be attributed solely to grayscale layout.

Next bounded test: separate renderer shader using sourceUV y for three tiles, exactsamecropactorplane, sample alpha directly. Inspect renderedhandedge/colour atnative14–20 and release; compare repeat performance atsamevisibleviewport/card. No hardwaredecode or smoothnessclaim from codecprofile or localpixelmetrics.
