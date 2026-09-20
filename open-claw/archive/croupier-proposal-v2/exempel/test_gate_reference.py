"""Run with: python -m unittest -v test_gate_reference.py"""
from dataclasses import replace
from pathlib import Path
import json
import unittest
from gate_reference import Opportunity, LiveState, evaluate_advice

HERE = Path(__file__).resolve().parent


class GateTests(unittest.TestCase):
    def setUp(self):
        data = json.loads((HERE / "opportunity.example.json").read_text(encoding="utf-8"))
        self.advice = json.loads((HERE / "advice.example.json").read_text(encoding="utf-8"))
        ids = frozenset(item["id"] for item in data["allowedCandidates"])
        self.opportunity = Opportunity(
            opportunity_id=data["opportunityId"], table_id=data["tableId"],
            round_id=data["roundId"], event_id=data["eventId"],
            show_event=data["showEvent"], public_seq=data["publicSeq"],
            expected_show_seq=data["expectedShowSeq"], epoch=data["epoch"],
            policy_revision=data["policyRevision"],
            catalog_revision=data["catalogRevision"],
            context_digest=data["contextDigest"], expires_at_ms=data["expiresAtMs"],
            offered_candidate_ids=ids,
        )
        self.live = LiveState(
            table_id=data["tableId"], round_id=data["roundId"],
            event_id=data["eventId"], show_event=data["showEvent"],
            public_seq=data["publicSeq"], next_show_seq=data["expectedShowSeq"],
            epoch=data["epoch"], policy_revision=data["policyRevision"],
            catalog_revision=data["catalogRevision"], context_digest=data["contextDigest"],
            ai_enabled=True, frozen=False, eligible_candidate_ids=ids,
        )
        self.now = data["expiresAtMs"] - 1

    def check(self, *, advice=None, live=None, now=None):
        return evaluate_advice(
            self.advice if advice is None else advice,
            self.opportunity, self.live if live is None else live,
            now_ms=self.now if now is None else now,
        )

    def test_valid_advice_is_still_pending_commit(self):
        result = self.check()
        self.assertTrue(result.accepted)
        self.assertEqual(result.candidate_id, "candidate-attention-a")
        self.assertEqual(result.reason, "accepted_pending_atomic_commit")

    def test_abstention(self):
        self.assertEqual(self.check(advice={**self.advice, "candidateId": None}).reason, "abstained")

    def test_unknown_field_rejected(self):
        self.assertEqual(self.check(advice={**self.advice, "payout": 99}).reason, "invalid_shape")

    def test_missing_field_rejected(self):
        data = dict(self.advice)
        del data["contextDigest"]
        self.assertEqual(self.check(advice=data).reason, "invalid_shape")

    def test_bad_payload_types(self):
        for value in [[], "json please", 1, True]:
            with self.subTest(value=value):
                self.assertFalse(self.check(advice=value).accepted)

    def test_bad_candidate_types_or_url(self):
        for value in [True, 123, {}, [], "https://evil.example/video.mp4", "a" * 101]:
            with self.subTest(value=value):
                self.assertEqual(self.check(advice={**self.advice, "candidateId": value}).reason, "invalid_shape")

    def test_unknown_schema(self):
        self.assertEqual(self.check(advice={**self.advice, "schemaVersion": "v99"}).reason, "unsupported_schema")

    def test_ai_disabled(self):
        self.assertEqual(self.check(live=replace(self.live, ai_enabled=False)).reason, "ai_disabled")

    def test_frozen_decision_cannot_change(self):
        self.assertEqual(self.check(live=replace(self.live, frozen=True)).reason, "already_frozen")

    def test_deadline_is_exclusive(self):
        for now in [self.opportunity.expires_at_ms, self.opportunity.expires_at_ms + 100]:
            with self.subTest(now=now):
                self.assertEqual(self.check(now=now).reason, "expired")

    def test_wrong_opportunity(self):
        self.assertEqual(self.check(advice={**self.advice, "opportunityId": "opp-other"}).reason, "wrong_opportunity")

    def test_wrong_table_round_event_or_show(self):
        for name in ["table_id", "round_id", "event_id", "show_event"]:
            with self.subTest(field=name):
                self.assertEqual(self.check(live=replace(self.live, **{name: "other"})).reason, "wrong_target")

    def test_old_leader_epoch(self):
        self.assertEqual(self.check(live=replace(self.live, epoch=3)).reason, "stale_epoch")

    def test_new_public_facts(self):
        self.assertEqual(self.check(live=replace(self.live, public_seq=105)).reason, "stale_public_sequence")

    def test_new_show_slot(self):
        self.assertEqual(self.check(live=replace(self.live, next_show_seq=27)).reason, "stale_show_sequence")

    def test_policy_changed_in_runtime(self):
        self.assertEqual(self.check(live=replace(self.live, policy_revision="policy-8")).reason, "policy_changed")

    def test_policy_echo_forged(self):
        self.assertEqual(self.check(advice={**self.advice, "policyRevision": "policy-8"}).reason, "policy_changed")

    def test_catalog_changed(self):
        self.assertEqual(self.check(live=replace(self.live, catalog_revision="catalog-4")).reason, "catalog_changed")

    def test_context_changed(self):
        self.assertEqual(self.check(live=replace(self.live, context_digest="sha256:" + "0" * 64)).reason, "context_changed")

    def test_digest_shape(self):
        self.assertEqual(self.check(advice={**self.advice, "contextDigest": "not-a-hash"}).reason, "invalid_shape")

    def test_candidate_from_other_catalog(self):
        self.assertEqual(self.check(advice={**self.advice, "candidateId": "candidate-other"}).reason, "candidate_not_offered")

    def test_candidate_revoked_after_request(self):
        changed = replace(self.live, eligible_candidate_ids=frozenset({"candidate-neutral-a"}))
        self.assertEqual(self.check(live=changed).reason, "candidate_no_longer_eligible")

    def test_cannot_use_browser_timestamp_types(self):
        for bad in [True, -1, 1.2, "today"]:
            with self.subTest(value=bad), self.assertRaises(ValueError):
                self.check(now=bad)

    def test_evaluation_does_not_commit_or_mutate(self):
        before = (self.opportunity, self.live, dict(self.advice))
        self.check()
        self.assertEqual(before, (self.opportunity, self.live, self.advice))
        self.assertFalse(self.live.frozen)


if __name__ == "__main__":
    unittest.main()
