"""Structured, privacy-safe trace of a grounded assembly.

A trace answers "which records and which canonical revisions informed this
answer" without carrying the material itself. It names record ids, provenance
classes and canonical source ids/versions; it never carries essence text,
reflection text, member names, invite tokens, or assembled prompt content.

Two views exist deliberately:
  - `as_dict()`   — full internal trace, returned only to the owning member.
  - `redacted()`  — the observability projection: counts and identifiers only,
                    safe for logs and admin surfaces.
"""

from __future__ import annotations

from typing import Any

# Keys that must never appear in a redacted trace, regardless of how a future
# caller populates the trace. Enforced in `redacted()` rather than trusted.
SENSITIVE_KEYS = frozenset(
    {
        "essence",
        "reflection",
        "label",
        "content",
        "prompt",
        "system",
        "text",
        "body",
        "cipher_id",
        "invite_token",
        "member_id",
        "companion",
        "name",
    }
)


class ContextTrace:
    """Accumulates what an assembly used. Cheap enough to build unconditionally."""

    def __init__(self, *, mode: str, room: str = "") -> None:
        self.mode = mode
        self.room = (room or "").strip()[:120]
        self.records: list[dict] = []
        self.canonical: list[dict] = []
        self.excluded: list[dict] = []
        self.notes: list[str] = []
        self.source_version = ""
        self.status = "pending"

    def add_record(self, record: dict) -> None:
        self.records.append(
            {
                "id": record.get("id", ""),
                "provenance_class": record.get("provenance_class", ""),
                "acceptance_state": record.get("acceptance_state", ""),
                "visibility": record.get("visibility", ""),
                "room": record.get("room", ""),
                "gene_key": record.get("gene_key"),
                "gene_key_line": record.get("gene_key_line"),
                "derived_from": record.get("derived_from", ""),
            }
        )

    def add_canonical(self, entry: dict, *, bands: tuple[str, ...] = ()) -> None:
        self.canonical.append(
            {
                "source_id": entry.get("source_id", ""),
                "gene_key": entry.get("gene_key"),
                "checksum": entry.get("checksum", "")[:12],
                "bands": list(bands),
            }
        )

    def exclude(self, record_id: str, reason: str) -> None:
        self.excluded.append({"id": record_id, "reason": reason})

    def note(self, text: str) -> None:
        self.notes.append(str(text)[:200])

    def as_dict(self) -> dict:
        return {
            "mode": self.mode,
            "room": self.room,
            "status": self.status,
            "source_version": self.source_version,
            "records": list(self.records),
            "canonical_sources": list(self.canonical),
            "excluded": list(self.excluded),
            "notes": list(self.notes),
            "counts": self.counts(),
        }

    def counts(self) -> dict:
        by_class: dict[str, int] = {}
        for record in self.records:
            key = record.get("provenance_class", "") or "unknown"
            by_class[key] = by_class.get(key, 0) + 1
        return {
            "records": len(self.records),
            "canonical_sources": len(self.canonical),
            "excluded": len(self.excluded),
            "by_provenance_class": by_class,
        }

    def redacted(self) -> dict:
        """Observability projection. Identifiers and counts only."""
        return redact(
            {
                "mode": self.mode,
                "room": self.room,
                "status": self.status,
                "source_version": self.source_version,
                "record_ids": [r.get("id", "") for r in self.records][:64],
                "canonical_source_ids": [c.get("source_id", "") for c in self.canonical][:64],
                "excluded_reasons": sorted({e.get("reason", "") for e in self.excluded}),
                "counts": self.counts(),
            }
        )


def redact(payload: Any) -> Any:
    """Strip anything that could carry member text or identity.

    Applied recursively as a backstop so that adding a field to a trace can
    never accidentally start leaking free text into logs.
    """
    if isinstance(payload, dict):
        return {
            key: redact(value)
            for key, value in payload.items()
            if key.lower() not in SENSITIVE_KEYS
        }
    if isinstance(payload, (list, tuple)):
        return [redact(item) for item in payload]
    return payload
