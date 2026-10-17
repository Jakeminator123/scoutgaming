from fractions import Fraction
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from contracts import validate_pcm
from frame_contract import pcm_frames, resolve_plan, measurement_plan


class FrameContract(unittest.TestCase):
    def test_every_frame_boundary_uses_exact_pcm_samples(self):
        for boundary in range(19, 601):
            for delta in (-1, 0, 1):
                samples = boundary * 1000 - 18000 + delta
                expected = int((Fraction(samples, 24000) + Fraction(3, 4)) * 24)
                self.assertEqual(pcm_frames(samples * 2), expected, (boundary, delta))
        for size, expected in [(25998, 30), (26000, 31), (26002, 31),
                               (63998, 49), (64000, 50), (64002, 50)]:
            self.assertEqual(validate_pcm(bytes(size), expected, 0), expected)

    def test_rest_has_one_source_identity_across_chunk_boundaries(self):
        mapping = {"vila": 7, "takes": {"deal": [9, 10, 11]}}
        self.assertEqual(resolve_plan(mapping, [["vila", 0, 42]], 42), [("vila", 0, 7)] * 42)
        self.assertEqual(resolve_plan(mapping, [["vila", 0, 2], ["deal", 1, 2], ["vila", 0, 2]], 6),
                         [("vila", 0, 7)] * 2 + [("deal", 1, 10), ("deal", 2, 11)] + [("vila", 0, 7)] * 2)

    def test_no_implicit_freeze_or_truncation(self):
        mapping = {"vila": 7, "takes": {"deal": [9, 10, 11]}}
        for rows, total in [([], 1), ([["deal", 0, 3]], 4), ([["deal", 0, 3]], 2),
                            ([["deal", 0, 4]], 4), ([["vila", 1, 1]], 1)]:
            with self.assertRaises(ValueError):
                resolve_plan(mapping, rows, total)
        self.assertEqual(measurement_plan(mapping, 90), [["deal", 0, 3], ["vila", 0, 87]])
        long = {"vila": 7, "takes": {"deal": list(range(130))}}
        self.assertEqual(measurement_plan(long, 90), [["deal", 0, 90]])
