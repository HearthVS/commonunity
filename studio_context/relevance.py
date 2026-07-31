"""Contextual relevance decision, shared by every grounded room.

Retrieval is a cost, not a bonus. Pulling a Gene Key transcript into a request
to tighten some product copy makes the answer longer, vaguer and more mystical
than the member asked for, and it spends a person's contemplative material on
a task that did not need it. So the default in every room is *no source
retrieval*: the member's own accepted orientation, and nothing else.

This module is the single place that decides otherwise. It is deliberately
deterministic and free of I/O — it takes the current request text and a
description of what the member has already accepted, and returns one of five
outcomes with a machine-readable reason. That makes the policy table-testable
without a model, a database or a corpus.

    none                  nothing to ground with; answer from the request alone
    personal_only         accepted personal orientation, no canonical retrieval
    gene_key              + the Shadow/Gift/Siddhi spectrum of one owned key
    gene_key_and_line     + the Line passage for that key in this room
    clarification_required  ask, rather than guess

The decision table itself is identical in all four rooms — the same signals,
the same thresholds, the same precedence. What varies is narrow and additive:
each room contributes a handful of extra phrases that mean "go to the source"
or "this is recurring" *in that room's vocabulary* (see `ROOM_SIGNALS`), and
each room has its own clarification wording. Nothing about a room can make
retrieval easier to trigger than the shared rules allow; a room can only
recognise its own way of saying the same thing.

Two rules keep this honest:

  * Only the member's *current request* is read for signals. Uploaded
    documents, audience context and prior AI output are never consulted here,
    so text inside them cannot steer retrieval — an instruction hidden in an
    uploaded CV cannot talk the selector into opening a transcript.
  * The selector may only ever point at material the member already owns. It
    never invents a Gene Key, and a key named in the request that the member
    has no accepted record for produces a clarification rather than a lookup.

What counts as material the member owns depends on which surface asked, and the
caller resolves that before calling `decide` — see `SURFACES`. This module only
needs to know the surface so that when it does have to ask a question, it names
the place that actually holds the member's orientation.

Yoga Sutra retrieval is not implemented. `EXTENSION_CORPORA` marks where a
second corpus joins the outcome vocabulary when it exists.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field as _dc_field
from typing import Any

NONE = "none"
PERSONAL_ONLY = "personal_only"
GENE_KEY = "gene_key"
GENE_KEY_AND_LINE = "gene_key_and_line"
CLARIFICATION_REQUIRED = "clarification_required"

OUTCOMES = (NONE, PERSONAL_ONLY, GENE_KEY, GENE_KEY_AND_LINE, CLARIFICATION_REQUIRED)

# Outcomes that cause canonical source material to be read.
RETRIEVING_OUTCOMES = (GENE_KEY, GENE_KEY_AND_LINE)

# Reserved for the phase that adds a second canonical corpus. Listing it here
# rather than leaving the extension implicit means a reader can see that the
# outcome vocabulary is the extension point, not the plumbing below it.
EXTENSION_CORPORA = ("yoga_sutras",)

# A request shorter than this carries no drafting intent to work from — it is
# a button press, not an instruction. Below the threshold and with nothing
# accepted to fall back on, the honest move is to ask.
MIN_REQUEST_CHARS = 16

# Explicit "go to the source" language. Kept narrow on purpose: bare words like
# "shadow" or "gift" appear constantly in ordinary commercial writing ("drop
# shadow", "gift card"), so each trigger is either unambiguous vocabulary
# (siddhi, hexagram, codon ring) or a multi-word phrase.
_EXPLICIT_SOURCE_PATTERNS = (
    r"gene\s*keys?",
    r"genekeys?",
    r"hexagram",
    r"siddhi",
    r"codon\s+ring",
    r"activation\s+sequence",
    r"shadow\s+(?:frequency|and\s+the\s+gift|and\s+gift|to\s+gift)",
    r"gift\s+frequency",
    r"(?:my|the)\s+shadow\s+(?:pattern|state|here|in\s+this)",
    r"programming\s+partner",
)

# Recurrence and self-observed tension. These are the signals that a member is
# describing something structural rather than asking for a draft. Bare "stuck"
# and bare "tension" are excluded — they are far more often about a sentence
# than about a pattern.
_RECURRING_PATTERNS = (
    r"keeps?\s+(?:coming\s+back|happening|showing\s+up|returning)",
    r"again\s+and\s+again",
    r"over\s+and\s+over",
    r"(?:same|this|that|the\s+old|a\s+familiar|recurring)\s+pattern",
    r"pattern\s+(?:i|that\s+i)\s+",
    r"recurring\s+(?:tension|resistance|block)",
    r"i\s+keep\s+",
    r"i\s+always\s+",
    r"every\s+time\s+i\s+",
    r"each\s+time\s+i\s+",
    r"keep\s+repeating",
    r"self[-\s]?sabotage",
)

_LINE_PATTERNS = (
    r"\bline\s*[1-6]\b",
    r"\b[1-6](?:st|nd|rd|th)\s+line\b",
    r"\bmy\s+line\b",
)

# Per-room additions to the two signal sets above. Narrow by design: each entry
# is a phrase that means the same thing the shared patterns mean, said in the
# vocabulary of that room. A room may recognise its own idiom; it may not lower
# the bar. Ordinary drafting language stays out of every list — "explain",
# "community" and "next step" are the substance of Lens, Field and Call
# requests respectively, so they can never be retrieval triggers.
ROOM_SIGNALS = {
    "work": {
        "explicit": (r"life'?s?\s+work\s+line",),
        "recurring": (),
    },
    "lens": {
        "explicit": (r"evolution\s+line", r"how\s+the\s+gene\s+keys?\s+(?:describe|frame|put)"),
        "recurring": (
            r"i\s+keep\s+(?:trying\s+to\s+)?(?:explain|articulate|say|write)",
            r"never\s+comes\s+out\s+right",
            r"can'?t\s+(?:ever\s+)?find\s+the\s+words",
        ),
    },
    "field": {
        "explicit": (r"radiance\s+line",),
        "recurring": (
            r"(?:the\s+)?same\s+dynamic",
            r"keeps?\s+happening\s+(?:with|in|around)",
            r"i\s+keep\s+ending\s+up\s+(?:in|with)",
            r"burn(?:ing|t|ed)?\s+out\s+(?:again|every\s+time)",
        ),
    },
    "call": {
        "explicit": (r"purpose\s+line", r"incarnation\s+cross"),
        "recurring": (
            r"keeps?\s+(?:calling|pulling|drawing)\s+me",
            r"keep\s+being\s+asked",
            r"i\s+keep\s+circling",
        ),
    },
}

DEFAULT_ROOM = "work"

ROOM_LABELS = {
    "work": "The Work",
    "lens": "The Lens",
    "field": "The Field",
    "call": "The Call",
}

# The product surface a request came from. Two surfaces open the same four
# rooms, and a member's orientation lives in a different place in each: stUdio
# works from records the member accepted into it, while cOMpass resolves a Gene
# Key from the member's own baseline and shows it in the room header. A
# clarification that names the wrong one is not an off-brand detail — it sends
# the member to a product that does not hold their material and tells them to
# add something they can already see on screen.
STUDIO = "studio"
COMPASS = "compass"
SURFACES = (STUDIO, COMPASS)
DEFAULT_SURFACE = STUDIO

# The two phrases that differ per surface. Everything else a clarification says
# is about the room and the request, which are the same wherever it was asked.
_SURFACE_PHRASES = {
    STUDIO: {
        "owned_keys": "the keys you have accepted into your stUdio",
        "nothing_recorded": "There is nothing accepted for {room} in your stUdio",
        "anything_recorded": "anything you have accepted for {room}",
    },
    COMPASS: {
        "owned_keys": "the keys your cOMpass has resolved for you",
        "nothing_recorded": "There is nothing recorded for {room} in your cOMpass",
        "anything_recorded": "anything recorded for {room} in your cOMpass",
    },
}


def normalize_surface(surface: Any) -> str:
    """Coerce a caller-supplied surface to a known one. Unknown reads as stUdio,
    which is the stricter contract — a surface cannot be invented to loosen it."""
    value = surface.strip().lower() if isinstance(surface, str) else ""
    return value if value in SURFACES else DEFAULT_SURFACE


def clarification_text(room: str, kind: str, surface: str = DEFAULT_SURFACE) -> str:
    """One clarification, phrased for the surface that asked it."""
    room_key = room if room in CLARIFICATIONS else DEFAULT_ROOM
    phrases = _SURFACE_PHRASES[normalize_surface(surface)]
    label = ROOM_LABELS[room_key]
    return CLARIFICATIONS[room_key][kind].format(
        owned_keys=phrases["owned_keys"],
        nothing_recorded=phrases["nothing_recorded"].format(room=label),
        anything_recorded=phrases["anything_recorded"].format(room=label),
    )


def _compile(base: tuple[str, ...], extra: tuple[str, ...]):
    return re.compile("|".join(base + tuple(extra)), re.IGNORECASE)


_EXPLICIT_RE = {
    room: _compile(_EXPLICIT_SOURCE_PATTERNS, signals["explicit"])
    for room, signals in ROOM_SIGNALS.items()
}
_RECURRING_RE = {
    room: _compile(_RECURRING_PATTERNS, signals["recurring"])
    for room, signals in ROOM_SIGNALS.items()
}
_LINE_RE = re.compile("|".join(_LINE_PATTERNS), re.IGNORECASE)


@dataclass(frozen=True)
class RelevanceDecision:
    """What to retrieve, and the auditable reason for it."""

    outcome: str
    reason: str
    gene_keys: tuple[int, ...] = ()
    line: int | None = None
    clarification: str = ""
    signals: dict = _dc_field(default_factory=dict)

    @property
    def uses_personal_context(self) -> bool:
        return self.outcome in (PERSONAL_ONLY, GENE_KEY, GENE_KEY_AND_LINE)

    @property
    def retrieves_canonical(self) -> bool:
        return self.outcome in RETRIEVING_OUTCOMES

    @property
    def needs_line(self) -> bool:
        return self.outcome == GENE_KEY_AND_LINE and self.line is not None

    def as_dict(self) -> dict:
        return {
            "outcome": self.outcome,
            "reason": self.reason,
            "gene_keys": list(self.gene_keys),
            "line": self.line,
            "signals": dict(self.signals),
        }


def signals_for(request_text: str, room: str = DEFAULT_ROOM) -> dict:
    """The raw signal readings, exposed so a trace can explain a decision."""
    text = (request_text or "").strip()
    key = room if room in ROOM_SIGNALS else DEFAULT_ROOM
    return {
        "room": key,
        "explicit_source_request": bool(_EXPLICIT_RE[key].search(text)),
        "recurring_pattern": bool(_RECURRING_RE[key].search(text)),
        "line_reference": bool(_LINE_RE.search(text)),
        "substantive_request": len(text) >= MIN_REQUEST_CHARS,
    }


def decide(
    request_text: str,
    *,
    room: str = DEFAULT_ROOM,
    owned_gene_keys: tuple[int, ...] | list[int] = (),
    owned_line: int | None = None,
    has_accepted_essence: bool = False,
    surface: str = DEFAULT_SURFACE,
) -> RelevanceDecision:
    """Choose the minimal retrieval that serves this request.

    `owned_gene_keys` and `owned_line` describe the orientation the caller has
    already established the member holds — accepted records in stUdio, the
    resolved room baseline in cOMpass — never raw request text. That is what
    makes "explicit Gene Key request" safe to honour: the request selects
    *whether* to open the corpus, and the member's own orientation selects
    *what* is opened.
    """
    signals = signals_for(request_text, room)
    surface = normalize_surface(surface)

    def clarify(kind):
        return clarification_text(signals["room"], kind, surface)

    keys = tuple(sorted({int(k) for k in owned_gene_keys if k}))

    if signals["explicit_source_request"]:
        if not keys:
            return RelevanceDecision(
                CLARIFICATION_REQUIRED,
                "explicit_source_request_without_owned_key",
                clarification=clarify("no_owned_key"),
                signals=signals,
            )
        if owned_line is not None and (signals["line_reference"] or signals["recurring_pattern"]):
            return RelevanceDecision(
                GENE_KEY_AND_LINE, "explicit_source_request_with_line",
                gene_keys=keys, line=owned_line, signals=signals,
            )
        return RelevanceDecision(
            GENE_KEY, "explicit_source_request", gene_keys=keys, signals=signals
        )

    if signals["recurring_pattern"]:
        if keys:
            if owned_line is not None:
                return RelevanceDecision(
                    GENE_KEY_AND_LINE, "recurring_pattern_with_owned_line",
                    gene_keys=keys, line=owned_line, signals=signals,
                )
            return RelevanceDecision(
                GENE_KEY, "recurring_pattern", gene_keys=keys, signals=signals
            )
        if has_accepted_essence:
            # A real pattern signal, but nothing canonical the member owns to
            # read it against. Their own accepted orientation still applies.
            return RelevanceDecision(
                PERSONAL_ONLY, "recurring_pattern_without_owned_key",
                signals=signals,
            )
        return RelevanceDecision(
            CLARIFICATION_REQUIRED, "recurring_pattern_without_any_context",
            clarification=clarify("pattern_no_context"), signals=signals,
        )

    if not signals["substantive_request"] and not has_accepted_essence:
        return RelevanceDecision(
            CLARIFICATION_REQUIRED, "insufficient_request_and_no_accepted_context",
            clarification=clarify("thin_request"), signals=signals,
        )

    if has_accepted_essence:
        return RelevanceDecision(PERSONAL_ONLY, "ordinary_room_request", signals=signals)

    return RelevanceDecision(NONE, "no_accepted_orientation", signals=signals)


# Clarifications are written as Nexus speaking to the member: short, concrete,
# and naming what would unblock the request. They never guess at an answer and
# never imply Nexus knows something about the person that it does not. Each
# room names its own room and its own missing ingredient, because "give me a
# line or two" is unhelpfully vague when the member cannot tell what kind of
# line the room wants.
CLARIFICATIONS = {
    "work": {
        "no_owned_key": (
            "Before I bring Gene Keys material into this, I need to know which key "
            "you mean — I only work from {owned_keys}, and I do not have one "
            "recorded for The Work yet. Add the key (and line, if you know it) "
            "and I will draft from the actual source rather than from a general "
            "impression."
        ),
        "pattern_no_context": (
            "It sounds like you are pointing at something that keeps recurring, "
            "and I would rather ask than assume. I do not yet have "
            "{anything_recorded} to read it against. Tell me in a sentence or two "
            "what the pattern shows up as in practice, and I will work from that."
        ),
        "thin_request": (
            "I do not have enough to work from yet. {nothing_recorded}, and this "
            "request does not say what you are making, offering, or trying to "
            "move. Give me a line or two about it and I will draft something "
            "concrete."
        ),
    },
    "lens": {
        "no_owned_key": (
            "I can only open Gene Keys material for {owned_keys}, and I do not have "
            "one recorded for The Lens yet. Add the key (and line, if you know "
            "it) and I will read from the source. Otherwise, tell me what you "
            "are trying to put into words and I will work from that instead."
        ),
        "pattern_no_context": (
            "You are pointing at something that keeps coming back in how you see or "
            "explain this, and I would rather ask than invent. I do not have "
            "{anything_recorded} to read it against. Say in a sentence or two what "
            "you keep trying to articulate, and I will start from your words."
        ),
        "thin_request": (
            "I do not have enough to work from yet. {nothing_recorded}, and this "
            "request does not say what you are trying to express or teach. Give "
            "me the rough version — even badly phrased — and I will help you "
            "sharpen it."
        ),
    },
    "field": {
        "no_owned_key": (
            "I only open Gene Keys material for {owned_keys}, and I do not have one "
            "recorded for The Field yet. Add the key (and line, if you know it), "
            "or tell me about the conditions and support you are actually "
            "working with, and I will start there."
        ),
        "pattern_no_context": (
            "It sounds like something keeps recurring in your conditions or "
            "relationships. I do not have {anything_recorded} to read it against, "
            "and I will not guess at what anyone else involved wants or intends. "
            "Describe what you have observed happening, and I will work from that."
        ),
        "thin_request": (
            "I do not have enough to work from yet. {nothing_recorded}, and this "
            "request does not say what conditions, rhythms or support you are "
            "trying to change. A line or two about your actual week would be "
            "enough."
        ),
    },
    "call": {
        "no_owned_key": (
            "I only open Gene Keys material for {owned_keys}, and I do not have one "
            "recorded for The Call yet. Add the key (and line, if you know it), "
            "or tell me what is drawing you at the moment, and I will work from "
            "that rather than from a general impression."
        ),
        "pattern_no_context": (
            "Something seems to keep pulling at you here, and I would rather ask "
            "than tell you what it means. I do not have {anything_recorded} to "
            "read it against. Say what keeps showing up as an invitation or a "
            "pull, and I will treat it as a direction to test rather than a "
            "conclusion."
        ),
        "thin_request": (
            "I do not have enough to work from yet. {nothing_recorded}, and this "
            "request does not say what direction, invitation or commitment you "
            "are weighing. Tell me what is in front of you and I will propose "
            "something you could actually try."
        ),
    },
}


__all__ = [
    "NONE",
    "PERSONAL_ONLY",
    "GENE_KEY",
    "GENE_KEY_AND_LINE",
    "CLARIFICATION_REQUIRED",
    "OUTCOMES",
    "RETRIEVING_OUTCOMES",
    "EXTENSION_CORPORA",
    "ROOM_SIGNALS",
    "CLARIFICATIONS",
    "DEFAULT_ROOM",
    "ROOM_LABELS",
    "STUDIO",
    "COMPASS",
    "SURFACES",
    "DEFAULT_SURFACE",
    "RelevanceDecision",
    "decide",
    "signals_for",
    "normalize_surface",
    "clarification_text",
]
