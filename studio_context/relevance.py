"""Contextual relevance decision for The Work.

Retrieval is a cost, not a bonus. Pulling a Gene Key transcript into a request
to tighten some product copy makes the answer longer, vaguer and more mystical
than the member asked for, and it spends a person's contemplative material on
a task that did not need it. So the default for The Work is *no source
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

Two rules keep this honest:

  * Only the member's *current request* is read for signals. Uploaded
    documents, audience context and prior AI output are never consulted here,
    so text inside them cannot steer retrieval — an instruction hidden in an
    uploaded CV cannot talk the selector into opening a transcript.
  * The selector may only ever point at material the member already owns. It
    never invents a Gene Key, and a key named in the request that the member
    has no accepted record for produces a clarification rather than a lookup.

Yoga Sutra retrieval is not implemented. `EXTENSION_CORPORA` marks where a
second corpus joins the outcome vocabulary when it exists.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field as _dc_field

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
    r"life'?s?\s+work\s+line",
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

_EXPLICIT_RE = re.compile("|".join(_EXPLICIT_SOURCE_PATTERNS), re.IGNORECASE)
_RECURRING_RE = re.compile("|".join(_RECURRING_PATTERNS), re.IGNORECASE)
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


def signals_for(request_text: str) -> dict:
    """The raw signal readings, exposed so a trace can explain a decision."""
    text = (request_text or "").strip()
    return {
        "explicit_source_request": bool(_EXPLICIT_RE.search(text)),
        "recurring_pattern": bool(_RECURRING_RE.search(text)),
        "line_reference": bool(_LINE_RE.search(text)),
        "substantive_request": len(text) >= MIN_REQUEST_CHARS,
    }


def decide(
    request_text: str,
    *,
    owned_gene_keys: tuple[int, ...] | list[int] = (),
    owned_line: int | None = None,
    has_accepted_essence: bool = False,
) -> RelevanceDecision:
    """Choose the minimal retrieval that serves this request.

    `owned_gene_keys` and `owned_line` come from the member's own accepted
    records — never from the request payload. That is what makes "explicit
    Gene Key request" safe to honour: the request selects *whether* to open
    the corpus, and the member's records select *what* is opened.
    """
    signals = signals_for(request_text)
    keys = tuple(sorted({int(k) for k in owned_gene_keys if k}))

    if signals["explicit_source_request"]:
        if not keys:
            return RelevanceDecision(
                CLARIFICATION_REQUIRED,
                "explicit_source_request_without_owned_key",
                clarification=_CLARIFY_NO_OWNED_KEY,
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
            clarification=_CLARIFY_PATTERN_NO_CONTEXT, signals=signals,
        )

    if not signals["substantive_request"] and not has_accepted_essence:
        return RelevanceDecision(
            CLARIFICATION_REQUIRED, "insufficient_request_and_no_accepted_context",
            clarification=_CLARIFY_THIN_REQUEST, signals=signals,
        )

    if has_accepted_essence:
        return RelevanceDecision(PERSONAL_ONLY, "ordinary_work_request", signals=signals)

    return RelevanceDecision(NONE, "no_accepted_orientation", signals=signals)


# Clarifications are written as Nexus speaking to the member: short, concrete,
# and naming what would unblock the request. They never guess at an answer and
# never imply Nexus knows something about the person that it does not.
_CLARIFY_NO_OWNED_KEY = (
    "Before I bring Gene Keys material into this, I need to know which key you "
    "mean — I only work from the keys you have accepted into your stUdio, and I "
    "do not have one recorded for The Work yet. Add the key (and line, if you "
    "know it) and I will draft from the actual source rather than from a "
    "general impression."
)

_CLARIFY_PATTERN_NO_CONTEXT = (
    "It sounds like you are pointing at something that keeps recurring, and I "
    "would rather ask than assume. I do not yet have anything you have accepted "
    "about your work to read it against. Tell me in a sentence or two what the "
    "pattern shows up as in practice — or accept an essence for The Work — and "
    "I will work from that."
)

_CLARIFY_THIN_REQUEST = (
    "I do not have enough to work from yet. There is nothing accepted for The "
    "Work in your stUdio, and this request does not say what you are making, "
    "offering, or trying to move. Give me a line or two about it and I will "
    "draft something concrete."
)


__all__ = [
    "NONE",
    "PERSONAL_ONLY",
    "GENE_KEY",
    "GENE_KEY_AND_LINE",
    "CLARIFICATION_REQUIRED",
    "OUTCOMES",
    "RETRIEVING_OUTCOMES",
    "EXTENSION_CORPORA",
    "RelevanceDecision",
    "decide",
    "signals_for",
]
