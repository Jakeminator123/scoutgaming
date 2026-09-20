"""Pure reference gate for untrusted croupier advice (Python 3.10+).

No networking, database, authentication, model or rendering is implemented here.
Opportunity and LiveState MUST come from validated, authenticated server state.
An accepted result is still only a proposal: production code must atomically
freeze the decision and reserve budget, as described in KONTRAKT-OCH-TESTER.md.
"""
from dataclasses import dataclass
import re

_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,99}\Z")
_DIGEST = re.compile(r"sha256:[0-9a-f]{64}\Z")
_KEYS = frozenset({
    "schemaVersion", "opportunityId", "contextDigest", "policyRevision",
    "catalogRevision", "candidateId",
})


@dataclass(frozen=True, slots=True)
class Opportunity:
    opportunity_id: str
    table_id: str
    round_id: str
    event_id: str
    show_event: str
    public_seq: int
    expected_show_seq: int
    epoch: int
    policy_revision: str
    catalog_revision: str
    context_digest: str
    expires_at_ms: int
    offered_candidate_ids: frozenset[str]


@dataclass(frozen=True, slots=True)
class LiveState:
    table_id: str
    round_id: str
    event_id: str
    show_event: str
    public_seq: int
    next_show_seq: int
    epoch: int
    policy_revision: str
    catalog_revision: str
    context_digest: str
    ai_enabled: bool
    frozen: bool
    # Recomputed by trusted rules including priority, budget, cooldown and assets.
    eligible_candidate_ids: frozenset[str]


@dataclass(frozen=True, slots=True)
class GateResult:
    accepted: bool
    reason: str
    candidate_id: str | None = None


def evaluate_advice(
    advice: object,
    opportunity: Opportunity,
    live: LiveState,
    *,
    now_ms: int,
) -> GateResult:
    """Validate one model reply without mutating any state.

    now_ms uses the server time basis, never a browser/model supplied value.
    The final production transaction must recheck time/state before committing.
    """
    if type(now_ms) is not int or now_ms < 0:
        raise ValueError("now_ms must be a nonnegative server timestamp")

    if not isinstance(advice, dict) or frozenset(advice) != _KEYS:
        return GateResult(False, "invalid_shape")
    if advice.get("schemaVersion") != "director-advice.v1":
        return GateResult(False, "unsupported_schema")
    for key in ("opportunityId", "policyRevision", "catalogRevision"):
        value = advice.get(key)
        if not isinstance(value, str) or _ID.fullmatch(value) is None:
            return GateResult(False, "invalid_shape")
    digest = advice.get("contextDigest")
    if not isinstance(digest, str) or _DIGEST.fullmatch(digest) is None:
        return GateResult(False, "invalid_shape")
    candidate = advice.get("candidateId")
    if candidate is not None and (
        not isinstance(candidate, str) or _ID.fullmatch(candidate) is None
    ):
        return GateResult(False, "invalid_shape")

    if not live.ai_enabled:
        return GateResult(False, "ai_disabled")
    if live.frozen:
        return GateResult(False, "already_frozen")
    if now_ms >= opportunity.expires_at_ms:
        return GateResult(False, "expired")
    if advice["opportunityId"] != opportunity.opportunity_id:
        return GateResult(False, "wrong_opportunity")

    for old, current in (
        (opportunity.table_id, live.table_id),
        (opportunity.round_id, live.round_id),
        (opportunity.event_id, live.event_id),
        (opportunity.show_event, live.show_event),
    ):
        if old != current:
            return GateResult(False, "wrong_target")
    if opportunity.epoch != live.epoch:
        return GateResult(False, "stale_epoch")
    if opportunity.public_seq != live.public_seq:
        return GateResult(False, "stale_public_sequence")
    if opportunity.expected_show_seq != live.next_show_seq:
        return GateResult(False, "stale_show_sequence")

    for reply_key, old, current, reason in (
        ("policyRevision", opportunity.policy_revision, live.policy_revision,
         "policy_changed"),
        ("catalogRevision", opportunity.catalog_revision, live.catalog_revision,
         "catalog_changed"),
        ("contextDigest", opportunity.context_digest, live.context_digest,
         "context_changed"),
    ):
        if advice[reply_key] != old or old != current:
            return GateResult(False, reason)

    if candidate is None:
        return GateResult(False, "abstained")
    if candidate not in opportunity.offered_candidate_ids:
        return GateResult(False, "candidate_not_offered")
    if candidate not in live.eligible_candidate_ids:
        return GateResult(False, "candidate_no_longer_eligible")
    return GateResult(True, "accepted_pending_atomic_commit", candidate)
