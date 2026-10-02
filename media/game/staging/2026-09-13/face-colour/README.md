# Astrid action colour correction — 13 September 2026

The action source is paler than the idle source. `measure.py` measures two corresponding cheek patches from preserved source media; `measurements.json` records RGB medians and the resulting correction. This is a small-patch calibration, not full lighting or likeness approval.

The performance shader applies the measured gain to warm pixels in both actor layers. Neutral blouse and suit pixels retain their original colour. The initial whole-actor gain was discarded because it tinted the blouse. All ordinary takes and their registered returns share the correction. The gain participates in the calibration hash, and continuation validation rejects inconsistent grading. Source bytes and measured contact positions are unchanged.

Reviewed the refined shader in actual gameplay at `http://astridcolour.localhost:4173/?dealer=astrid&performance=staged`: greeting/goodluck transition, centre delivery, decision idle, Stand, dealer resolution and return to betting. The five-dollar hand (8 clubs + 7 hearts versus 5 diamonds) settled as a loss, leaving 990 balance and zero stake. Astrid returned to idle and browser warnings/errors were empty. This supports the bounded colour improvement and freeze regression check; it does not approve every pose or all seven physical reaches.

Validation: 16 contact tests, performance audit, deep four-dealer media audit and full pre-commit checks pass. The audit baseline and source speech assets are unchanged.
