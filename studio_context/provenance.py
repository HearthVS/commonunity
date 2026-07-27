"""Provenance and acceptance vocabulary for personal stUdio context.

The trust question this answers is "who authored this, and did the member
explicitly say it may speak for them?". A record's provenance class says where
the material came from; its acceptance state says whether the member has
adopted it. Grounded assembly reads *only* records that satisfy both.

The rule the rest of the package is built around: AI output is never trusted
personal context. An `ai_proposal` enters as `proposed`, and the only way it
becomes usable is a member action that derives a new record from it.
"""

from __future__ import annotations

MEMBER_AUTHORED = "member_authored"
MEMBER_UPLOADED = "member_uploaded"
VERIFIED_SOURCE = "verified_source"
AI_PROPOSAL = "ai_proposal"
MEMBER_EDITED_SYNTHESIS = "member_edited_synthesis"
ACCEPTED_PERSONAL_CONTEXT = "accepted_personal_context"
EPHEMERAL_OPERATIONAL = "ephemeral_operational"

PROVENANCE_CLASSES = (
    MEMBER_AUTHORED,
    MEMBER_UPLOADED,
    VERIFIED_SOURCE,
    AI_PROPOSAL,
    MEMBER_EDITED_SYNTHESIS,
    ACCEPTED_PERSONAL_CONTEXT,
    EPHEMERAL_OPERATIONAL,
)

# Classes a member may create directly through the API. `verified_source` is
# server-minted from the canonical corpus and `accepted_personal_context` is
# server-minted on acceptance, so neither is client-assertable.
MEMBER_CREATABLE = (
    MEMBER_AUTHORED,
    MEMBER_UPLOADED,
    AI_PROPOSAL,
    EPHEMERAL_OPERATIONAL,
)

# Classes whose material may enter a grounded assembly, once accepted.
GROUNDABLE_CLASSES = (
    MEMBER_AUTHORED,
    MEMBER_UPLOADED,
    VERIFIED_SOURCE,
    MEMBER_EDITED_SYNTHESIS,
    ACCEPTED_PERSONAL_CONTEXT,
)

PROPOSED = "proposed"
ACCEPTED = "accepted"
REJECTED = "rejected"
SUPERSEDED = "superseded"

ACCEPTANCE_STATES = (PROPOSED, ACCEPTED, REJECTED, SUPERSEDED)

PRIVATE = "private"
SEALED = "sealed"
SHARED = "shared"

VISIBILITIES = (PRIVATE, SEALED, SHARED)

# Sealed material is member-only by construction: it is excluded from every
# assembly and never leaves the row it lives in.
ASSEMBLABLE_VISIBILITIES = (PRIVATE, SHARED)


class ProvenanceError(ValueError):
    """Raised when a provenance/acceptance value or transition is not allowed."""


def initial_acceptance_state(provenance_class: str) -> str:
    """Acceptance state a newly created record must start in.

    AI proposals and ephemeral operational scratch start unaccepted; material
    the member authored or uploaded themselves is accepted on arrival because
    the act of writing it *is* the acceptance.
    """
    if provenance_class in (AI_PROPOSAL, EPHEMERAL_OPERATIONAL):
        return PROPOSED
    return ACCEPTED


def validate_provenance_class(value: str, *, creatable_only: bool = False) -> str:
    normalized = (value or "").strip().lower()
    allowed = MEMBER_CREATABLE if creatable_only else PROVENANCE_CLASSES
    if normalized not in allowed:
        raise ProvenanceError(
            f"provenance_class must be one of {', '.join(allowed)}"
        )
    return normalized


def validate_acceptance_state(value: str) -> str:
    normalized = (value or "").strip().lower()
    if normalized not in ACCEPTANCE_STATES:
        raise ProvenanceError(
            f"acceptance_state must be one of {', '.join(ACCEPTANCE_STATES)}"
        )
    return normalized


def validate_visibility(value: str) -> str:
    normalized = (value or "").strip().lower()
    if normalized not in VISIBILITIES:
        raise ProvenanceError(f"visibility must be one of {', '.join(VISIBILITIES)}")
    return normalized


def is_groundable(provenance_class: str, acceptance_state: str, visibility: str) -> bool:
    """The single predicate that decides whether a record may inform grounding."""
    return (
        provenance_class in GROUNDABLE_CLASSES
        and acceptance_state == ACCEPTED
        and visibility in ASSEMBLABLE_VISIBILITIES
    )


def accepted_class_for(source_class: str, *, edited: bool) -> str:
    """Provenance class of the record derived by accepting `source_class`.

    Accepting an AI proposal verbatim yields `accepted_personal_context`;
    accepting it with member edits yields `member_edited_synthesis`. Either
    way the derived record is a *new* row — the proposal itself is never
    rewritten into a trusted class, so the untrusted origin stays on record.
    """
    if source_class != AI_PROPOSAL:
        raise ProvenanceError(f"{source_class} does not require acceptance")
    return MEMBER_EDITED_SYNTHESIS if edited else ACCEPTED_PERSONAL_CONTEXT
