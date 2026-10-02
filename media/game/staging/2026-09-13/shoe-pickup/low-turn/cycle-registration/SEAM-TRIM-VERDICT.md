# Pickup → slide trim investigation

No seamless trim exists in the requested pickup46–54 / slide0–15 search. Every pickup candidate retains a lower wrist and several fingers extended down; every slide candidate has a higher wrist and curled non-index fingers. `seam-all-candidates.jpg` annotates all25 frames at a common uniformly registered camera. No hand-specific alignment was used.

Best appearance-ranked candidate is pickup54 → slide3. Fixed hand ROI grayscale MAE 23.447/255 versus 24.312 for pickup54 → slide0, just 3.56% improvement. Source-to-slide edge Chamfer 2.667px does not capture all pose error and must not be presented as fingertip contact distance. Full144 pair scores are in `seam-candidates.json`.

If root needs a staging candidate, keep pickup through54 inclusive and begin slide at3, then continue chronologically. This removes only slide's first0.125s and preserves pickup extraction/turn/contact. However the wrist/finger pose pop remains plainly visible; trimming is not an accepted repair. Beginning slide later than3 increasingly displaces the whole hand/card and does not recover matching curl. Ending pickup earlier worsens the mismatch.

To actually repair this seam requires source motion connecting pickup's low multi-finger contact pose to slide's curled index-contact pose, or a slide source starting in the same hand pose. Neither camera registration nor a fade proves that motion. No generation, warp, viewer or public changes performed.
