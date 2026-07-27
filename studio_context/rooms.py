"""The grounded room engine — one pipeline, four rooms.

When the context mode is `grounded_v1` **and** the request names one of the
four exact canonical room ids, generation is assembled here instead of by the
legacy prompt builder. Everything else — an unknown room, an empty room, a
mis-cased room, every other Nexus endpoint, and the whole of `legacy` mode —
never reaches this module: `route_inspire_layer2()` returns `None` for them
before touching anything, so those paths remain the pre-existing code rather
than a re-implementation of it.

There is deliberately one pipeline rather than four. A room is a `RoomSpec`:
its canonical id, its action contract, and the label its clarifications and
traces use. Everything that could differ per room and does not need to —
ownership filtering, relevance mechanics, retrieval, fencing, tracing, failure
policy — is shared, so a fix to any of it is a fix in all four rooms. What is
genuinely room-specific lives in exactly two places: the action contract in
`prompts.py` and the narrow signal/clarification additions in `relevance.py`.

The pipeline is five steps, each of which can only narrow what reaches a model:

  1. Ownership     `store.groundable_records` returns the caller's own accepted,
                   non-sealed records for this room, and nothing else.
  2. Relevance     `relevance.decide` reads the current request and the keys the
                   member owns, and chooses the minimal retrieval.
  3. Retrieval     only the chosen key(s) and, if warranted, the one Line
                   passage for this room, read from the versioned corpus.
  4. Assembly      `prompts.compose_room_prompt` fences trusted context,
                   verified excerpts and browser-supplied material apart.
  5. Trace         a privacy-safe record of what was selected and why.

What the browser sends is never orientation. `gk_shadow` / `gk_gift` /
`gk_siddhi` carry transcript text in the legacy payload; in grounded mode they
are dropped on the floor and noted, because canonical text comes from the
corpus or it does not exist. `gk_num` is honoured only as a *pointer*, and only
when one of the member's own accepted records already names that key.

Yoga Sutra retrieval is not part of this phase. The seam is
`assembler.register_corpus` plus `relevance.EXTENSION_CORPORA`: a second corpus
implements the same validated-id/checksum/version contract as `canonical.py`,
adds its outcome to the relevance vocabulary, and `_retrieve` grows one branch.
No room contract changes when it lands.
"""

from __future__ import annotations

import collections
from dataclasses import dataclass
from typing import Any

from . import assembler, canonical, modes, prompts, relevance, runtime, store, trace as trace_mod
from .canonical import CanonicalSourceError

ROUTE = "/inspire-layer2"

# Bands read for a retrieved key. The whole spectrum is the unit of meaning —
# a Shadow without its Gift reads as a diagnosis, which is exactly the register
# every room's action contract forbids.
BANDS = ("shadow", "gift", "siddhi")

MAX_RECORDS = 12
MAX_ESSENCE_CHARS = 1200
MAX_REFLECTION_CHARS = 1200
MAX_REQUEST_CHARS = 4000
MAX_CLIENT_CHARS = 6000

STATUS_GROUNDED = "grounded"
STATUS_CLARIFICATION = "clarification_required"
STATUS_UNAVAILABLE = "grounding_unavailable"
STATUS_FALLBACK_LEGACY = "fallback_legacy"

# How a response used its sources, for the admin surface. A category, never
# content: an operator can see that a room reached for the corpus without
# seeing a word of what the member wrote or what the corpus said.
SOURCE_USE_NONE = "none"
SOURCE_USE_PERSONAL_ONLY = "personal_only"
SOURCE_USE_CANONICAL = "personal_and_canonical"
SOURCE_USE_CANONICAL_ONLY = "canonical_only"

SOURCE_USE_CATEGORIES = (
    SOURCE_USE_NONE,
    SOURCE_USE_PERSONAL_ONLY,
    SOURCE_USE_CANONICAL,
    SOURCE_USE_CANONICAL_ONLY,
)


@dataclass(frozen=True)
class RoomSpec:
    """One grounded room. Everything else about the pipeline is shared."""

    room: str
    label: str
    contract_version: str

    @property
    def action_contract(self) -> str:
        return prompts.ROOM_ACTION_CONTRACTS[self.room]

    @property
    def unavailable_message(self) -> str:
        return (
            f"Nexus could not reach its grounded sources for {self.label}, so it "
            "has not written anything. Nothing was generated from general "
            "knowledge. Try again, or ask an administrator to check the "
            "canonical corpus."
        )


ROOM_SPECS = {
    spec.room: spec
    for spec in (
        RoomSpec("work", "The Work", prompts.WORK_CONTRACT_VERSION),
        RoomSpec("lens", "The Lens", prompts.LENS_CONTRACT_VERSION),
        RoomSpec("field", "The Field", prompts.FIELD_CONTRACT_VERSION),
        RoomSpec("call", "The Call", prompts.CALL_CONTRACT_VERSION),
    )
}

# Canonical order, used by the admin surface and the docs. Matches the order
# the rooms appear in cOMpass.
GROUNDED_ROOMS = ("work", "lens", "field", "call")

# Recent grounded activity, for the admin surface. Redacted traces only: ids,
# counts and outcomes, never content. In-memory and per-process, so it is a
# debugging aid rather than an audit log — the durable audit is `record_event`.
_ACTIVITY: collections.deque = collections.deque(maxlen=50)


def spec_for(point: Any) -> RoomSpec | None:
    """The room spec for an exact canonical room id, or None.

    Exact match, deliberately. The rest of the app looks `point` up in dicts
    keyed by the lowercase token, so anything else — a mis-cased id, a padded
    id, an unknown id, an empty id — is already an unknown room and must keep
    whatever legacy did with it rather than being normalised into a room.
    """
    if not isinstance(point, str):
        return None
    return ROOM_SPECS.get(point)


def is_active() -> bool:
    """Whether the grounded pipeline would handle a room request now."""
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
    spec = spec_for(getattr(payload, "point", ""))
    if spec is None:
        return None

    ctx = trace_mod.ContextTrace(mode=modes.GROUNDED_V1, room=spec.room)
    try:
        return _build(request, payload, ctx, spec, task=task, voice=voice,
                      client_material=client_material)
    except CanonicalSourceError as exc:
        return _unavailable(str(exc), ctx, spec)
    except Exception as exc:  # pragma: no cover - defensive
        # An unexpected failure inside the trust layer is exactly the situation
        # where guessing is worst. It takes the same audited path as a missing
        # corpus rather than quietly producing an ungrounded answer.
        return _unavailable(f"{spec.room} pipeline error: {type(exc).__name__}", ctx, spec)


def _build(request, payload, ctx, spec, *, task, voice, client_material) -> dict:
    records = store.groundable_records(
        request, cipher_id=(getattr(payload, "cipher_id", "") or ""),
        room=spec.room, limit=MAX_RECORDS * 4,
    )
    records = assembler.select_relevant(records, room=spec.room, budget=MAX_RECORDS)
    for record in records:
        ctx.add_record(record)

    owned_keys = tuple(sorted({int(r["gene_key"]) for r in records if r.get("gene_key")}))
    owned_line = _owned_line(records)
    declared = _declared_pointer(payload, owned_keys, ctx)
    if declared:
        owned_keys = (declared,)
        owned_line = _owned_line([r for r in records if r.get("gene_key") == declared]) or owned_line
    _note_dropped_client_transcript(payload, ctx)

    request_text = _request_text(payload, spec)
    has_essence = any((r.get("essence") or "").strip() for r in records)
    decision = relevance.decide(
        _member_words(payload),
        room=spec.room,
        owned_gene_keys=owned_keys,
        owned_line=owned_line,
        has_accepted_essence=has_essence,
    )
    ctx.note(f"relevance={decision.outcome}:{decision.reason}")

    if decision.outcome == relevance.CLARIFICATION_REQUIRED:
        ctx.status = STATUS_CLARIFICATION
        meta = _meta(spec, decision, used_personal=False, source_ids=(), source_versions=())
        _audit("studio_context_room_clarification", ctx, spec, decision, meta)
        return {"reply": decision.clarification, "meta": meta}

    excerpts, source_ids, source_versions = _retrieve(decision, ctx, spec)

    trusted = _trusted_block(records, spec) if decision.uses_personal_context else ""
    if decision.uses_personal_context and not trusted:
        ctx.note("no accepted orientation to include")
    system, user = prompts.compose_room_prompt(
        action_contract=spec.action_contract,
        trusted=trusted,
        canonical="\n\n---\n\n".join(excerpts),
        request=request_text,
        client_material=_client_block(client_material),
        task=task,
        voice=voice,
    )

    ctx.status = STATUS_GROUNDED
    meta = _meta(
        spec,
        decision,
        used_personal=bool(trusted),
        source_ids=source_ids,
        source_versions=source_versions,
    )
    _audit("studio_context_room_grounded", ctx, spec, decision, meta)
    return {"system": system, "user": user, "meta": meta}


# ── retrieval ────────────────────────────────────────────────────────────────

def _retrieve(decision, ctx, spec) -> tuple[list[str], list[str], list[str]]:
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
        # The Line corpus is per room: the same line number means something
        # different in The Lens than it does in The Work, so the room id
        # selects the file and the decision selects the passage.
        line_entry = canonical.load_room_line(spec.room, decision.line)
        excerpts.append(prompts.line_excerpt(line_entry))
        source_ids.append(line_entry["source_id"])
        versions.append(line_entry["source_version"])
        ctx.add_canonical(
            {"source_id": line_entry["source_id"], "gene_key": None,
             "checksum": line_entry["checksum"]},
            bands=(f"line{decision.line}",),
        )
    return excerpts, source_ids, versions


def _unavailable(reason: str, ctx, spec) -> dict:
    """Apply the Phase 1 failure policy. Neither branch claims grounding."""
    ctx.note(reason)
    policy = modes.failure_policy()
    decision = relevance.RelevanceDecision(relevance.NONE, "grounding_unavailable")
    if policy == modes.FALLBACK_LEGACY:
        ctx.status = STATUS_FALLBACK_LEGACY
        meta = _meta(spec, decision, used_personal=False, source_ids=(), source_versions=(),
                     status=STATUS_FALLBACK_LEGACY, fallback_reason=reason)
        _audit("studio_context_room_fallback_legacy", ctx, spec, decision, meta, detail=reason)
        return {"legacy": True, "meta": meta}

    ctx.status = STATUS_UNAVAILABLE
    meta = _meta(spec, decision, used_personal=False, source_ids=(), source_versions=(),
                 status=STATUS_UNAVAILABLE, fallback_reason=reason)
    _audit("studio_context_room_grounding_unavailable", ctx, spec, decision, meta, detail=reason)
    return {"error": spec.unavailable_message, "meta": meta}


# ── trusted context ──────────────────────────────────────────────────────────

def _trusted_block(records: list[dict], spec) -> str:
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
            body.append(f"Active in {spec.label}: {label}")
        if essence:
            body.append(f"Essence: {essence}")
        if reflection:
            body.append(f"Reflection: {reflection}")
        parts.append("\n".join(body))
    if not parts:
        return ""
    return (
        f"Accepted by this member for {spec.label}. These are their own words or "
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


def _request_text(payload: Any, spec) -> str:
    """The member's current request. Trusted as a request, not as orientation."""
    parts = [
        f"Room: {spec.label}. Field being drafted: "
        f"{(getattr(payload, 'field', '') or 'unspecified')}."
    ]
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

def source_use(used_personal: bool, used_canonical: bool) -> str:
    """Category describing what a response drew on. Never content."""
    if used_canonical:
        return SOURCE_USE_CANONICAL if used_personal else SOURCE_USE_CANONICAL_ONLY
    return SOURCE_USE_PERSONAL_ONLY if used_personal else SOURCE_USE_NONE


def _meta(
    spec,
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
    used_canonical = bool(source_ids)
    grounding = {
        "mode": modes.GROUNDED_V1,
        "room": spec.room,
        "pipeline": spec.contract_version,
        "prompt_versions": [prompts.FOUNDATION_VERSION, spec.contract_version],
        "status": status,
        "relevance": decision.outcome,
        "relevance_reason": decision.reason,
        "used_personal_context": bool(used_personal),
        "used_canonical_sources": used_canonical,
        "source_use": source_use(bool(used_personal), used_canonical),
        "canonical_source_ids": list(source_ids),
        "source_versions": list(source_versions),
    }
    if fallback_reason:
        grounding["fallback_reason"] = fallback_reason[:200]
    return {"grounding": grounding}


def _audit(event: str, ctx, spec, decision, meta: dict, detail: str = "") -> None:
    grounding = meta["grounding"]
    summary = dict(ctx.redacted())
    summary["relevance"] = decision.as_dict()
    summary["used_personal_context"] = grounding["used_personal_context"]
    summary["used_canonical_sources"] = grounding["used_canonical_sources"]
    summary["source_use"] = grounding["source_use"]
    summary["at"] = runtime.now_iso()
    if detail:
        summary["fallback_reason"] = detail[:200]
    _ACTIVITY.append(summary)
    runtime.record_event(
        event,
        route=ROUTE,
        source="grounded_v1",
        detail=f"room={spec.room} {decision.outcome} "
               f"use={grounding['source_use']} "
               f"sources={len(grounding['canonical_source_ids'])}"
               + (f" {detail[:120]}" if detail else ""),
    )


def recent_activity(limit: int = 10, room: str = "") -> list[dict]:
    """Most recent grounded assemblies, redacted. Newest first."""
    entries = [e for e in _ACTIVITY if not room or e.get("room") == room]
    return entries[-max(1, limit):][::-1]


def debug_state() -> dict:
    """Privacy-safe operator view: which rooms are live, and are they healthy.

    Reports which room handled each recent response and what category of source
    it used, without exposing any member content or any prompt text.
    """
    active = is_active()
    return {
        "route": ROUTE,
        "active": active,
        "mode": modes.current_mode(),
        "failure_policy": modes.failure_policy(),
        "prompt_versions": [prompts.FOUNDATION_VERSION]
                           + [ROOM_SPECS[r].contract_version for r in GROUNDED_ROOMS],
        "relevance_outcomes": list(relevance.OUTCOMES),
        "source_use_categories": list(SOURCE_USE_CATEGORIES),
        "rooms_grounded": list(GROUNDED_ROOMS) if active else [],
        "rooms_legacy": [] if active else list(GROUNDED_ROOMS),
        "rooms": {
            room: {
                "room": room,
                "label": ROOM_SPECS[room].label,
                "pipeline": ROOM_SPECS[room].contract_version,
                "active": active,
                "line_corpus": canonical.verify_line_corpus(room),
                "room_signals": {
                    "explicit": len(relevance.ROOM_SIGNALS[room]["explicit"]),
                    "recurring": len(relevance.ROOM_SIGNALS[room]["recurring"]),
                },
                "recent": recent_activity(5, room=room),
            }
            for room in GROUNDED_ROOMS
        },
        "gene_key_corpus": canonical.verify_corpus(),
        "pending_corpora": list(relevance.EXTENSION_CORPORA),
        "registered_corpora": assembler.registered_corpora(),
        "recent": recent_activity(20),
    }


__all__ = [
    "ROOM_SPECS",
    "GROUNDED_ROOMS",
    "RoomSpec",
    "BANDS",
    "STATUS_GROUNDED",
    "STATUS_CLARIFICATION",
    "STATUS_UNAVAILABLE",
    "STATUS_FALLBACK_LEGACY",
    "SOURCE_USE_CATEGORIES",
    "source_use",
    "spec_for",
    "is_active",
    "route_inspire_layer2",
    "recent_activity",
    "debug_state",
]
