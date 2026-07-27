"""Server-side authenticated context assembler.

Phase 1 scope: assemble a member's grounded context from (a) their own
accepted orientation records and (b) the canonical Gene Key corpus, producing
a structured result plus a trace. It does not yet alter what any existing
Nexus endpoint sends to the model — `legacy` remains the production path and
its prompt building is untouched.

Two invariants hold here and are what the tests defend:

  1. Nothing the client submits is authoritative. Canonical material is read
     from the corpus by validated integer key; the caller may only *point at*
     a Gene Key, never supply its text.
  2. Grounding never degrades quietly. If required canonical material is
     unavailable the assembler returns a structured `grounding_unavailable`
     result, or — only when the configured policy says so — an explicit,
     audited legacy fallback. It never returns a "grounded" result backed by
     generic model knowledge.
"""

from __future__ import annotations

from typing import Any

from . import canonical, modes, provenance, runtime, store
from .canonical import CanonicalSourceError
from .trace import ContextTrace

STATUS_GROUNDED = "grounded"
STATUS_UNAVAILABLE = "grounding_unavailable"
STATUS_LEGACY = "legacy"
STATUS_FALLBACK_LEGACY = "fallback_legacy"

# Bands pulled from a canonical entry. Phase 2's relevance pilot will narrow
# this per room; Phase 1 cites the whole spectrum so the trace is honest about
# what was available.
DEFAULT_BANDS = ("shadow", "gift", "siddhi")


class GroundingUnavailable(Exception):
    """Required canonical material could not be loaded under fail-closed policy."""

    def __init__(self, reason: str, trace: ContextTrace | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.trace = trace


def assemble(
    request: Any,
    *,
    cipher_id: str = "",
    room: str = "",
    gene_keys: list | tuple | None = None,
    limit: int = 50,
    mode: str | None = None,
) -> dict:
    """Assemble stUdio context for the authenticated caller.

    In `legacy` mode this returns a `legacy` marker and touches nothing — the
    existing endpoints keep building their prompts exactly as before. In
    `grounded_v1` it performs the server-side assembly described above.
    """
    active_mode = modes.normalize_mode(mode) or modes.current_mode()
    if active_mode != modes.GROUNDED_V1:
        trace = ContextTrace(mode=active_mode, room=room)
        trace.status = STATUS_LEGACY
        trace.note("legacy mode: server-side assembly not performed")
        return {
            "status": STATUS_LEGACY,
            "mode": active_mode,
            "grounded": False,
            "records": [],
            "canonical": [],
            "trace": trace.as_dict(),
        }

    return _assemble_grounded(
        request, cipher_id=cipher_id, room=room, gene_keys=gene_keys, limit=limit
    )


def _assemble_grounded(
    request: Any,
    *,
    cipher_id: str,
    room: str,
    gene_keys: list | tuple | None,
    limit: int,
) -> dict:
    trace = ContextTrace(mode=modes.GROUNDED_V1, room=room)
    policy = modes.failure_policy()

    records = store.groundable_records(request, cipher_id=cipher_id, room=room, limit=limit)
    for record in records:
        trace.add_record(record)

    # The canonical keys to load come from the member's own accepted records,
    # optionally narrowed by the caller. A caller-supplied key is a *pointer*
    # that must still be one the member's records reference — the browser
    # cannot widen its own grounding scope.
    record_keys = {r["gene_key"] for r in records if r.get("gene_key")}
    if gene_keys:
        requested = set()
        for value in gene_keys:
            try:
                requested.add(_validated_key(value))
            except CanonicalSourceError as exc:
                trace.note(f"ignored key: {exc}")
        wanted = sorted(record_keys & requested) if record_keys else []
        if requested and not wanted:
            trace.note("requested keys are outside the member's own records")
    else:
        wanted = sorted(record_keys)

    entries: list[dict] = []
    try:
        trace.source_version = canonical.corpus_version()
        for key in wanted:
            entry = canonical.load_gene_key(key)
            entries.append(entry)
            trace.add_canonical(entry, bands=DEFAULT_BANDS)
    except CanonicalSourceError as exc:
        return _handle_unavailable(str(exc), trace, policy, room)

    if wanted and not entries:
        return _handle_unavailable("no canonical material resolved", trace, policy, room)

    trace.status = STATUS_GROUNDED
    runtime.record_event(
        "studio_context_assembled",
        route="/api/studio/context",
        source="grounded_v1",
        detail=f"records={len(records)} sources={len(entries)}",
    )
    return {
        "status": STATUS_GROUNDED,
        "mode": modes.GROUNDED_V1,
        "grounded": True,
        "source_version": trace.source_version,
        "records": records,
        "canonical": [_canonical_projection(entry) for entry in entries],
        "trace": trace.as_dict(),
    }


def _validated_key(value: Any) -> int:
    return canonical.validate_gene_key(value)


def _canonical_projection(entry: dict) -> dict:
    """Canonical material as the assembler hands it on.

    Band content is included because it *is* the authoritative material the
    grounded path exists to use — but it is only ever read from the corpus,
    and it is excluded from every trace and log.
    """
    return {
        "gene_key": entry["gene_key"],
        "title": entry["title"],
        "source_id": entry["source_id"],
        "bands": {
            band: {
                "subtitle": entry["bands"][band]["subtitle"],
                "content": entry["bands"][band]["content"],
            }
            for band in DEFAULT_BANDS
        },
    }


def _handle_unavailable(reason: str, trace: ContextTrace, policy: str, room: str) -> dict:
    """Apply the configured failure policy and audit the outcome.

    Both branches are explicit and both are audited. The one thing neither
    branch does is return `status: grounded`.
    """
    trace.note(reason)
    if policy == modes.FALLBACK_LEGACY:
        trace.status = STATUS_FALLBACK_LEGACY
        runtime.record_event(
            "studio_context_grounding_fallback",
            route="/api/studio/context",
            source="grounded_v1",
            detail=reason[:200],
        )
        return {
            "status": STATUS_FALLBACK_LEGACY,
            "mode": modes.GROUNDED_V1,
            "grounded": False,
            "reason": reason,
            "records": [],
            "canonical": [],
            "trace": trace.as_dict(),
        }

    trace.status = STATUS_UNAVAILABLE
    runtime.record_event(
        "studio_context_grounding_unavailable",
        route="/api/studio/context",
        source="grounded_v1",
        detail=reason[:200],
    )
    return {
        "status": STATUS_UNAVAILABLE,
        "mode": modes.GROUNDED_V1,
        "grounded": False,
        "reason": reason,
        "records": [],
        "canonical": [],
        "trace": trace.as_dict(),
    }


# ── Phase 2 extension points ─────────────────────────────────────────────────
# The Work-room relevance pilot, the Yoga Sutra corpus, Digit and the
# CommonUnity router are explicitly out of scope here. They plug in as follows,
# with no change to the trust boundaries above:
#
#   select_relevant(records, room, budget) -> records
#       Ranking/selection over the already-ownership-filtered record set.
#       Phase 1 uses recency; Phase 2 replaces the body of this function.
#
#   register_corpus(name, loader)
#       A second canonical corpus (Yoga Sutras) implements the same contract as
#       `canonical.py`: validated ids, per-item checksum, corpus version,
#       structured error on missing/malformed material. `assemble()` then cites
#       both corpora in one trace.


def select_relevant(records: list[dict], room: str = "", budget: int = 50) -> list[dict]:
    """Phase 1 selection: most recent first, already ownership-filtered.

    Kept as a named seam so the Phase 2 relevance pilot changes one function
    rather than the assembly flow and its trust checks.
    """
    scoped = [r for r in records if not room or r.get("room") == room]
    return scoped[: max(1, budget)]


_CORPORA: dict[str, Any] = {}


def register_corpus(name: str, loader: Any) -> None:
    """Register an additional canonical corpus for a later phase."""
    _CORPORA[name] = loader


def registered_corpora() -> list[str]:
    return sorted(_CORPORA)


__all__ = [
    "GroundingUnavailable",
    "STATUS_GROUNDED",
    "STATUS_UNAVAILABLE",
    "STATUS_LEGACY",
    "STATUS_FALLBACK_LEGACY",
    "assemble",
    "select_relevant",
    "register_corpus",
    "registered_corpora",
    "provenance",
]
