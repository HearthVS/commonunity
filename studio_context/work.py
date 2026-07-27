"""The Work — the first room wired to grounded_v1.

This is the whole of Phase 2's behavioural change. When the context mode is
`grounded_v1` **and** the request names the exact room `work`, generation is
assembled here instead of by the legacy prompt builder. Every other room, every
other Nexus endpoint, and the whole of `legacy` mode never reach this module:
`route_inspire_layer2()` returns `None` for them before touching anything, so
those paths are the pre-existing code rather than a re-implementation of it.

The pipeline is five steps, each of which can only narrow what reaches a model:

  1. Ownership     `store.groundable_records` returns the caller's own accepted,
                   non-sealed records for room `work`, and nothing else.
  2. Relevance     `relevance.decide` reads the current request and the keys the
                   member owns, and chooses the minimal retrieval.
  3. Retrieval     only the chosen key(s) and, if warranted, the one Line
                   passage for this room, read from the versioned corpus.
  4. Assembly      `prompts.compose_work_prompt` fences trusted context,
                   verified excerpts and browser-supplied material apart.
  5. Trace         a privacy-safe record of what was selected and why.

What the browser sends is never orientation. `gk_shadow` / `gk_gift` /
`gk_siddhi` carry transcript text in the legacy payload; in grounded mode they
are dropped on the floor and noted, because canonical text comes from the
corpus or it does not exist. `gk_num` is honoured only as a *pointer*, and only
when one of the member's own accepted records already names that key.
"""

from __future__ import annotations

import collections
from typing import Any

from . import assembler, canonical, modes, prompts, relevance, runtime, store, trace as trace_mod
from .canonical import CanonicalSourceError

ROOM = "work"
PIPELINE_VERSION = prompts.WORK_CONTRACT_VERSION
ROUTE = "/inspire-layer2"

# Bands read for a retrieved key. The whole spectrum is the unit of meaning —
# a Shadow without its Gift reads as a diagnosis, which is exactly the register
# the action contract forbids.
BANDS = ("shadow", "gift", "siddhi")

MAX_RECORDS = 12
MAX_ESSENCE_CHARS = 1200
MAX_REFLECTION_CHARS = 1200
MAX_REQUEST_CHARS = 4000
MAX_CLIENT_CHARS = 6000

# Recent grounded activity, for the admin surface. Redacted traces only: ids,
# counts and outcomes, never content. In-memory and per-process, so it is a
# debugging aid rather than an audit log — the durable audit is `record_event`.
_ACTIVITY: collections.deque = collections.deque(maxlen=25)

STATUS_GROUNDED = "grounded"
STATUS_CLARIFICATION = "clarification_required"
STATUS_UNAVAILABLE = "grounding_unavailable"
STATUS_FALLBACK_LEGACY = "fallback_legacy"

GROUNDING_UNAVAILABLE_MESSAGE = (
    "Nexus could not reach its grounded sources for The Work, so it has not "
    "written anything. Nothing was generated from general knowledge. Try again, "
    "or ask an administrator to check the canonical corpus."
)


def is_active() -> bool:
    """Whether the grounded Work pipeline would handle a `work` request now."""
    return modes.current_mode() == modes.GROUNDED_V1


def route_inspire_layer2(
    request: Any,
    payload: Any,
    *,
    task: str = "",
    voice: str = "",
    client_material: Any = None,
) -> dict | None:
    """Grounded plan for a `/inspire-layer2` call, or None to leave it alone.

    Returning `None` is the common case and the safe one: it means the caller
    proceeds down the path it already had. The plan dict, when present, carries
    exactly one of `system`+`user` (generate), `reply` (say this instead),
    `error` (refuse, audited), or `legacy` (audited fallback to the old path).
    """
    if modes.current_mode() != modes.GROUNDED_V1:
        return None
    # Exact match, deliberately. The rest of the app looks `point` up in dicts
    # keyed by the lowercase token, so anything else is already an unknown room
    # and must keep whatever legacy did with it.
    if getattr(payload, "point", "") != ROOM:
        return None

    ctx = trace_mod.ContextTrace(mode=modes.GROUNDED_V1, room=ROOM)
    try:
        return _build(request, payload, ctx, task=task, voice=voice,
                      client_material=client_material)
    except CanonicalSourceError as exc:
        return _unavailable(str(exc), ctx)
    except Exception as exc:  # pragma: no cover - defensive
        # An unexpected failure inside the trust layer is exactly the situation
        # where guessing is worst. It takes the same audited path as a missing
        # corpus rather than quietly producing an ungrounded answer.
        return _unavailable(f"work pipeline error: {type(exc).__name__}", ctx)


def _build(request, payload, ctx, *, task, voice, client_material) -> dict:
    records = store.groundable_records(
        request, cipher_id=(getattr(payload, "cipher_id", "") or ""),
        room=ROOM, limit=MAX_RECORDS * 4,
    )
    records = assembler.select_relevant(records, room=ROOM, budget=MAX_RECORDS)
    for record in records:
        ctx.add_record(record)

    owned_keys = tuple(sorted({int(r["gene_key"]) for r in records if r.get("gene_key")}))
    owned_line = _owned_line(records)
    declared = _declared_pointer(payload, owned_keys, ctx)
    if declared:
        owned_keys = (declared,)
        owned_line = _owned_line([r for r in records if r.get("gene_key") == declared]) or owned_line
    _note_dropped_client_transcript(payload, ctx)

    request_text = _request_text(payload)
    has_essence = any((r.get("essence") or "").strip() for r in records)
    decision = relevance.decide(
        _member_words(payload),
        owned_gene_keys=owned_keys,
        owned_line=owned_line,
        has_accepted_essence=has_essence,
    )
    ctx.note(f"relevance={decision.outcome}:{decision.reason}")

    if decision.outcome == relevance.CLARIFICATION_REQUIRED:
        ctx.status = STATUS_CLARIFICATION
        meta = _meta(decision, used_personal=False, source_ids=(), source_versions=())
        _audit("studio_context_work_clarification", ctx, decision, meta)
        return {"reply": decision.clarification, "meta": meta}

    excerpts, source_ids, source_versions = _retrieve(decision, ctx)

    trusted = _trusted_block(records) if decision.uses_personal_context else ""
    if decision.uses_personal_context and not trusted:
        ctx.note("no accepted orientation to include")
    system, user = prompts.compose_work_prompt(
        trusted=trusted,
        canonical="\n\n---\n\n".join(excerpts),
        request=request_text,
        client_material=_client_block(client_material),
        task=task,
        voice=voice,
    )

    ctx.status = STATUS_GROUNDED
    meta = _meta(
        decision,
        used_personal=bool(trusted),
        source_ids=source_ids,
        source_versions=source_versions,
    )
    _audit("studio_context_work_grounded", ctx, decision, meta)
    return {"system": system, "user": user, "meta": meta}


# ── retrieval ────────────────────────────────────────────────────────────────

def _retrieve(decision, ctx) -> tuple[list[str], list[str], list[str]]:
    """Read only what the decision justified. Raises CanonicalSourceError."""
    if not decision.retrieves_canonical:
        return [], [], []

    excerpts: list[str] = []
    source_ids: list[str] = []
    versions: list[str] = []
    for key in decision.gene_keys:
        entry = canonical.load_gene_key(key)
        excerpts.append(prompts.source_excerpt(entry, BANDS))
        source_ids.append(entry["source_id"])
        ctx.add_canonical(entry, bands=BANDS)
    versions.append(canonical.corpus_version())
    ctx.source_version = versions[0]

    if decision.needs_line:
        line_entry = canonical.load_room_line(ROOM, decision.line)
        excerpts.append(prompts.line_excerpt(line_entry))
        source_ids.append(line_entry["source_id"])
        versions.append(line_entry["source_version"])
        ctx.add_canonical(
            {"source_id": line_entry["source_id"], "gene_key": None,
             "checksum": line_entry["checksum"]},
            bands=(f"line{decision.line}",),
        )
    return excerpts, source_ids, versions


def _unavailable(reason: str, ctx) -> dict:
    """Apply the Phase 1 failure policy. Neither branch claims grounding."""
    ctx.note(reason)
    policy = modes.failure_policy()
    decision = relevance.RelevanceDecision(relevance.NONE, "grounding_unavailable")
    if policy == modes.FALLBACK_LEGACY:
        ctx.status = STATUS_FALLBACK_LEGACY
        meta = _meta(decision, used_personal=False, source_ids=(), source_versions=(),
                     status=STATUS_FALLBACK_LEGACY, fallback_reason=reason)
        _audit("studio_context_work_fallback_legacy", ctx, decision, meta, detail=reason)
        return {"legacy": True, "meta": meta}

    ctx.status = STATUS_UNAVAILABLE
    meta = _meta(decision, used_personal=False, source_ids=(), source_versions=(),
                 status=STATUS_UNAVAILABLE, fallback_reason=reason)
    _audit("studio_context_work_grounding_unavailable", ctx, decision, meta, detail=reason)
    return {"error": GROUNDING_UNAVAILABLE_MESSAGE, "meta": meta}


# ── trusted context ──────────────────────────────────────────────────────────

def _trusted_block(records: list[dict]) -> str:
    """Render the member's accepted material, annotated with its provenance.

    Only accepted, owned, non-sealed rows reach this function — `store` has
    already applied that filter twice. What is added here is the provenance
    annotation, so the model can see that a line came from something the member
    wrote themselves rather than from a synthesis they edited.
    """
    parts: list[str] = []
    for record in records:
        essence = (record.get("essence") or "").strip()[:MAX_ESSENCE_CHARS]
        reflection = (record.get("reflection") or "").strip()[:MAX_REFLECTION_CHARS]
        label = (record.get("label") or "").strip()
        if not (essence or reflection or label):
            continue
        head = f"[{record.get('provenance_class', '')} · accepted {record.get('accepted_at', '') or 'unknown'}]"
        body = [head]
        if label:
            body.append(f"Active in The Work: {label}")
        if essence:
            body.append(f"Essence: {essence}")
        if reflection:
            body.append(f"Reflection: {reflection}")
        parts.append("\n".join(body))
    if not parts:
        return ""
    return (
        "Accepted by this member for The Work. These are their own words or "
        "syntheses they explicitly adopted.\n\n" + "\n\n".join(parts)
    )


def _client_block(client_material: Any) -> str:
    if not client_material:
        return ""
    if isinstance(client_material, (list, tuple)):
        joined = "\n\n".join(str(item).strip() for item in client_material if str(item).strip())
    else:
        joined = str(client_material).strip()
    return joined[:MAX_CLIENT_CHARS]


def _member_words(payload: Any) -> str:
    """Only what the member actually typed for this turn.

    Relevance reads this rather than the framed request below, so the framing
    never counts towards how substantive a request looks.
    """
    parts = [(getattr(payload, "session_notes", "") or "").strip()]
    parts.extend(_qa_answers(payload))
    return "\n\n".join(p for p in parts if p)[:MAX_REQUEST_CHARS]


def _qa_answers(payload: Any) -> list[str]:
    answers = []
    for item in (getattr(payload, "qa_answers", None) or []):
        if not isinstance(item, dict):
            continue
        answer = str(item.get("answer", "")).strip()
        if answer:
            answers.append(f"Q: {str(item.get('question', '')).strip()}\nA: {answer}")
    return answers


def _request_text(payload: Any) -> str:
    """The member's current request. Trusted as a request, not as orientation."""
    parts = [f"Room: The Work. Field being drafted: {(getattr(payload, 'field', '') or 'unspecified')}."]
    notes = (getattr(payload, "session_notes", "") or "").strip()
    if notes:
        parts.append(f"What they are working on now:\n{notes}")
    answers = _qa_answers(payload)
    if answers:
        parts.append("Reflections written for this room:\n" + "\n\n".join(answers))
    return "\n\n".join(parts)[:MAX_REQUEST_CHARS]


def _owned_line(records: list[dict]) -> int | None:
    for record in records:
        line = record.get("gene_key_line")
        if line:
            try:
                return canonical.validate_line(line)
            except CanonicalSourceError:
                continue
    return None


def _declared_pointer(payload: Any, owned_keys: tuple[int, ...], ctx) -> int | None:
    """Honour `gk_num` only where the member's own records corroborate it.

    The browser may narrow grounding to one of the member's keys; it may not
    widen it to a key they have not accepted. An uncorroborated pointer is
    noted and ignored rather than rejected outright, because the common cause
    is a cOMpass baseline that has not been accepted into stUdio yet.
    """
    raw = getattr(payload, "gk_num", "")
    if raw in (None, "", 0):
        return None
    try:
        declared = canonical.validate_gene_key(raw)
    except CanonicalSourceError as exc:
        ctx.note(f"ignored client gene key pointer: {exc}")
        return None
    if declared not in owned_keys:
        ctx.note("client gene key pointer is not in the member's accepted records")
        return None
    return declared


def _note_dropped_client_transcript(payload: Any, ctx) -> None:
    """Client-supplied band text is never canonical. Record that we dropped it."""
    supplied = [
        name for name in ("gk_shadow", "gk_gift", "gk_siddhi")
        if str(getattr(payload, name, "") or "").strip()
    ]
    if supplied:
        ctx.note(f"dropped client-supplied source text: {', '.join(sorted(supplied))}")


# ── metadata, trace and audit ────────────────────────────────────────────────

def _meta(
    decision,
    *,
    used_personal: bool,
    source_ids,
    source_versions,
    status: str = STATUS_GROUNDED,
    fallback_reason: str = "",
) -> dict:
    """Non-sensitive grounding metadata for the response envelope.

    Additive and optional: the client reads `chunk` / `error` and ignores
    everything else, so this cannot break the existing schema or UI. It carries
    identifiers and outcomes only — no member text and no prompt content.
    """
    grounding = {
        "mode": modes.GROUNDED_V1,
        "room": ROOM,
        "pipeline": PIPELINE_VERSION,
        "prompt_versions": [prompts.FOUNDATION_VERSION, prompts.WORK_CONTRACT_VERSION],
        "status": status,
        "relevance": decision.outcome,
        "relevance_reason": decision.reason,
        "used_personal_context": bool(used_personal),
        "used_canonical_sources": bool(source_ids),
        "canonical_source_ids": list(source_ids),
        "source_versions": list(source_versions),
    }
    if fallback_reason:
        grounding["fallback_reason"] = fallback_reason[:200]
    return {"grounding": grounding}


def _audit(event: str, ctx, decision, meta: dict, detail: str = "") -> None:
    grounding = meta["grounding"]
    summary = dict(ctx.redacted())
    summary["relevance"] = decision.as_dict()
    summary["used_personal_context"] = grounding["used_personal_context"]
    summary["used_canonical_sources"] = grounding["used_canonical_sources"]
    summary["at"] = runtime.now_iso()
    if detail:
        summary["fallback_reason"] = detail[:200]
    _ACTIVITY.append(summary)
    runtime.record_event(
        event,
        route=ROUTE,
        source="grounded_v1",
        detail=f"{decision.outcome} sources={len(grounding['canonical_source_ids'])}"
               + (f" {detail[:120]}" if detail else ""),
    )


def recent_activity(limit: int = 10) -> list[dict]:
    """Most recent grounded Work assemblies, redacted. Newest first."""
    return list(_ACTIVITY)[-max(1, limit):][::-1]


def debug_state() -> dict:
    """Privacy-safe operator view: is grounded Work live, and is it healthy.

    Reports whether the pipeline is active and what recent responses used,
    without exposing any member content or any prompt text.
    """
    active = is_active()
    return {
        "room": ROOM,
        "route": ROUTE,
        "active": active,
        "mode": modes.current_mode(),
        "failure_policy": modes.failure_policy(),
        "pipeline": PIPELINE_VERSION,
        "prompt_versions": [prompts.FOUNDATION_VERSION, prompts.WORK_CONTRACT_VERSION],
        "relevance_outcomes": list(relevance.OUTCOMES),
        "rooms_grounded": [ROOM],
        "rooms_legacy": [room for room in canonical.LINE_ROOMS if room != ROOM],
        "gene_key_corpus": canonical.verify_corpus(),
        "line_corpus": canonical.verify_line_corpus(ROOM),
        "pending_corpora": list(relevance.EXTENSION_CORPORA),
        "recent": recent_activity(10),
    }


__all__ = [
    "ROOM",
    "PIPELINE_VERSION",
    "BANDS",
    "GROUNDING_UNAVAILABLE_MESSAGE",
    "is_active",
    "route_inspire_layer2",
    "recent_activity",
    "debug_state",
]
