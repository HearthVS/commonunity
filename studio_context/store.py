"""Persistence for personal stUdio orientation records.

Ownership follows the Field Observations contract already used elsewhere in
the app: rows are scoped by the pseudonymous `cipher_id`, with the signed
invite-token cookie as the fallback key for callers who have no cipher yet.
There is no unfiltered read branch — a caller that resolves to neither key
sees nothing.

A record references canonical material (room, gene key, line, source version)
rather than copying it. Full source transcripts stay in the corpus and in the
member's own observation rows; duplicating them here would create a second
copy to keep in sync and a second place to leak from.
"""

from __future__ import annotations

import json
import sqlite3
from typing import Any

from . import provenance, runtime
from .canonical import CanonicalSourceError, validate_gene_key, validate_line

TABLE = "studio_context_records"

MAX_ESSENCE_CHARS = 8000
MAX_REFLECTION_CHARS = 8000
MAX_ROOM_CHARS = 120
MAX_LABEL_CHARS = 200


class OwnershipError(PermissionError):
    """Raised when a caller has no member key, or the row is not theirs."""


class RecordNotFound(LookupError):
    """Raised when a record id does not resolve within the caller's own scope."""


def init_schema(conn: sqlite3.Connection) -> None:
    """Create the orientation table. Idempotent, run on every connection like
    the rest of the app's schema (CREATE TABLE IF NOT EXISTS + column probe)."""
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS {TABLE} (
            id TEXT PRIMARY KEY,
            cipher_id TEXT NOT NULL DEFAULT '',
            invite_token TEXT NOT NULL DEFAULT '',
            room TEXT NOT NULL DEFAULT '',
            gene_key INTEGER,
            gene_key_line INTEGER,
            source_version TEXT NOT NULL DEFAULT '',
            source_ids TEXT NOT NULL DEFAULT '[]',
            label TEXT NOT NULL DEFAULT '',
            essence TEXT NOT NULL DEFAULT '',
            reflection TEXT NOT NULL DEFAULT '',
            provenance_class TEXT NOT NULL,
            acceptance_state TEXT NOT NULL,
            visibility TEXT NOT NULL DEFAULT 'private',
            derived_from TEXT NOT NULL DEFAULT '',
            idempotency_key TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            accepted_at TEXT NOT NULL DEFAULT ''
        )
        """
    )
    conn.execute(
        f"CREATE INDEX IF NOT EXISTS idx_{TABLE}_cipher ON {TABLE} (cipher_id, created_at DESC)"
    )
    conn.execute(
        f"CREATE INDEX IF NOT EXISTS idx_{TABLE}_invite ON {TABLE} (invite_token, created_at DESC)"
    )
    # Scoped to the owner so two members can reuse the same client-side key.
    conn.execute(
        f"""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_{TABLE}_idem
        ON {TABLE} (cipher_id, invite_token, idempotency_key)
        WHERE idempotency_key != ''
        """
    )
    columns = {row[1] for row in conn.execute(f"PRAGMA table_info({TABLE})").fetchall()}
    for name, ddl in (
        ("label", "TEXT NOT NULL DEFAULT ''"),
        ("accepted_at", "TEXT NOT NULL DEFAULT ''"),
    ):
        if name not in columns:
            conn.execute(f"ALTER TABLE {TABLE} ADD COLUMN {name} {ddl}")


def scope(request: Any, cipher_id: str = "") -> tuple[str, str]:
    """Resolve the caller's own member keys.

    `cipher_id` is the client-supplied pseudonymous key; the invite token comes
    from the signed cookie only, never from the request body, so it always
    binds to *this* caller.
    """
    return (cipher_id or "").strip(), runtime.invite_token_from_cookie(request).strip()


def require_scope(request: Any, cipher_id: str = "") -> tuple[str, str]:
    resolved_cipher, invite_token = scope(request, cipher_id)
    if not resolved_cipher and not invite_token:
        raise OwnershipError("no member scope: cipher_id or invite cookie required")
    return resolved_cipher, invite_token


def _owner_clause(cipher_id: str, invite_token: str) -> tuple[str, tuple]:
    if cipher_id:
        return "cipher_id = ? AND cipher_id != ''", (cipher_id,)
    return "invite_token = ? AND invite_token != ''", (invite_token,)


def row_to_dict(row: sqlite3.Row) -> dict:
    """Member-facing projection. The invite token is a per-caller secret
    binding, not member data, so it never leaves the database."""
    record = {key: row[key] for key in row.keys()}
    record.pop("invite_token", None)
    try:
        record["source_ids"] = json.loads(record.get("source_ids") or "[]")
    except (TypeError, ValueError):
        record["source_ids"] = []
    return record


def create_record(
    request: Any,
    *,
    cipher_id: str = "",
    provenance_class: str,
    room: str = "",
    gene_key: Any = None,
    gene_key_line: Any = None,
    essence: str = "",
    reflection: str = "",
    label: str = "",
    visibility: str = provenance.PRIVATE,
    source_version: str = "",
    source_ids: list | None = None,
    derived_from: str = "",
    idempotency_key: str = "",
    acceptance_state: str | None = None,
) -> dict:
    """Create one orientation record owned by the calling member.

    `provenance_class` is restricted to the member-creatable set: a client
    cannot declare its material `verified_source` or `accepted_personal_context`
    — those are server-minted only.
    """
    owner_cipher, invite_token = require_scope(request, cipher_id)
    klass = provenance.validate_provenance_class(provenance_class, creatable_only=True)
    vis = provenance.validate_visibility(visibility)
    state = (
        provenance.validate_acceptance_state(acceptance_state)
        if acceptance_state is not None
        else provenance.initial_acceptance_state(klass)
    )
    if klass == provenance.AI_PROPOSAL and state != provenance.PROPOSED:
        raise provenance.ProvenanceError("an ai_proposal must start as proposed")

    key = validate_gene_key(gene_key) if gene_key not in (None, "") else None
    line = validate_line(gene_key_line) if gene_key_line not in (None, "") else None
    idem = (idempotency_key or "").strip()[:120]

    return _insert(
        owner_cipher,
        invite_token,
        room=(room or "").strip()[:MAX_ROOM_CHARS],
        gene_key=key,
        gene_key_line=line,
        source_version=(source_version or "").strip()[:120],
        source_ids=source_ids or [],
        label=(label or "").strip()[:MAX_LABEL_CHARS],
        essence=(essence or "").strip()[:MAX_ESSENCE_CHARS],
        reflection=(reflection or "").strip()[:MAX_REFLECTION_CHARS],
        provenance_class=klass,
        acceptance_state=state,
        visibility=vis,
        derived_from=(derived_from or "").strip()[:64],
        idempotency_key=idem,
    )


def _insert(owner_cipher: str, invite_token: str, **fields: Any) -> dict:
    now = runtime.now_iso()
    record_id = runtime.new_id("sctx")
    accepted_at = now if fields["acceptance_state"] == provenance.ACCEPTED else ""
    payload = (
        record_id,
        owner_cipher,
        invite_token,
        fields["room"],
        fields["gene_key"],
        fields["gene_key_line"],
        fields["source_version"],
        json.dumps(list(fields["source_ids"])[:64]),
        fields["label"],
        fields["essence"],
        fields["reflection"],
        fields["provenance_class"],
        fields["acceptance_state"],
        fields["visibility"],
        fields["derived_from"],
        fields["idempotency_key"],
        now,
        now,
        accepted_at,
    )
    with runtime.db() as conn:
        init_schema(conn)
        try:
            conn.execute(
                f"""
                INSERT INTO {TABLE}
                    (id, cipher_id, invite_token, room, gene_key, gene_key_line,
                     source_version, source_ids, label, essence, reflection,
                     provenance_class, acceptance_state, visibility, derived_from,
                     idempotency_key, created_at, updated_at, accepted_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                payload,
            )
            conn.commit()
        except sqlite3.IntegrityError:
            # Replayed request: return the row the first call created rather
            # than a duplicate. Idempotency is scoped to this owner.
            conn.rollback()
            existing = conn.execute(
                f"SELECT * FROM {TABLE} WHERE cipher_id=? AND invite_token=? AND idempotency_key=?",
                (owner_cipher, invite_token, fields["idempotency_key"]),
            ).fetchone()
            if existing is None:
                raise
            return row_to_dict(existing)
        row = conn.execute(f"SELECT * FROM {TABLE} WHERE id=?", (record_id,)).fetchone()
    return row_to_dict(row)


def list_records(
    request: Any,
    *,
    cipher_id: str = "",
    room: str = "",
    limit: int = 50,
) -> list[dict]:
    """List the caller's own records, newest first. Never cross-member."""
    owner_cipher, invite_token = scope(request, cipher_id)
    if not owner_cipher and not invite_token:
        return []
    clause, params = _owner_clause(owner_cipher, invite_token)
    limit = max(1, min(int(limit or 50), 200))
    sql = f"SELECT * FROM {TABLE} WHERE {clause}"
    if (room or "").strip():
        sql += " AND room = ?"
        params = params + ((room or "").strip()[:MAX_ROOM_CHARS],)
    sql += " ORDER BY created_at DESC, id DESC LIMIT ?"
    with runtime.db() as conn:
        init_schema(conn)
        rows = conn.execute(sql, params + (limit,)).fetchall()
    return [row_to_dict(row) for row in rows]


def get_owned_row(conn: sqlite3.Connection, record_id: str, cipher_id: str, invite_token: str):
    clause, params = _owner_clause(cipher_id, invite_token)
    return conn.execute(
        f"SELECT * FROM {TABLE} WHERE id = ? AND {clause}", (record_id,) + params
    ).fetchone()


def accept_record(
    request: Any,
    record_id: str,
    *,
    cipher_id: str = "",
    essence: str | None = None,
    reflection: str | None = None,
    idempotency_key: str = "",
) -> dict:
    """Explicit member acceptance of a proposal.

    Acceptance derives a *new* trusted record and marks the proposal accepted.
    The proposal row keeps its `ai_proposal` class forever, so the untrusted
    origin of the material stays visible in the audit trail. Supplying edited
    text yields `member_edited_synthesis` instead of `accepted_personal_context`.

    Idempotent: re-accepting an already-accepted proposal returns the record
    that was derived the first time rather than minting a second one.
    """
    owner_cipher, invite_token = require_scope(request, cipher_id)
    with runtime.db() as conn:
        init_schema(conn)
        row = get_owned_row(conn, record_id, owner_cipher, invite_token)
        if row is None:
            raise RecordNotFound(record_id)
        if row["provenance_class"] != provenance.AI_PROPOSAL:
            raise provenance.ProvenanceError(
                f"only an ai_proposal can be accepted (record is {row['provenance_class']})"
            )
        if row["acceptance_state"] == provenance.REJECTED:
            raise provenance.ProvenanceError("a rejected proposal cannot be accepted")
        if row["acceptance_state"] == provenance.ACCEPTED:
            derived = conn.execute(
                f"SELECT * FROM {TABLE} WHERE derived_from = ? ORDER BY created_at ASC LIMIT 1",
                (record_id,),
            ).fetchone()
            if derived is not None:
                return row_to_dict(derived)
        snapshot = {key: row[key] for key in row.keys()}
        now = runtime.now_iso()
        conn.execute(
            f"UPDATE {TABLE} SET acceptance_state=?, accepted_at=?, updated_at=? WHERE id=?",
            (provenance.ACCEPTED, now, now, record_id),
        )
        conn.commit()

    edited = (
        essence is not None and essence.strip() != (snapshot["essence"] or "")
    ) or (
        reflection is not None and reflection.strip() != (snapshot["reflection"] or "")
    )
    derived_class = provenance.accepted_class_for(provenance.AI_PROPOSAL, edited=edited)
    try:
        source_ids = json.loads(snapshot.get("source_ids") or "[]")
    except (TypeError, ValueError):
        source_ids = []

    result = _insert(
        owner_cipher,
        invite_token,
        room=snapshot["room"],
        gene_key=snapshot["gene_key"],
        gene_key_line=snapshot["gene_key_line"],
        source_version=snapshot["source_version"],
        source_ids=source_ids,
        label=snapshot["label"],
        essence=(essence if essence is not None else snapshot["essence"] or "").strip()[:MAX_ESSENCE_CHARS],
        reflection=(reflection if reflection is not None else snapshot["reflection"] or "").strip()[:MAX_REFLECTION_CHARS],
        provenance_class=derived_class,
        acceptance_state=provenance.ACCEPTED,
        visibility=snapshot["visibility"],
        derived_from=record_id,
        idempotency_key=(idempotency_key or "").strip()[:120],
    )
    runtime.record_event(
        "studio_context_record_accepted",
        route="/api/studio/context-records",
        source="member",
        detail=derived_class,
    )
    return result


def reject_record(request: Any, record_id: str, *, cipher_id: str = "") -> dict:
    """Explicit member rejection. Idempotent — rejecting twice is a no-op."""
    owner_cipher, invite_token = require_scope(request, cipher_id)
    with runtime.db() as conn:
        init_schema(conn)
        row = get_owned_row(conn, record_id, owner_cipher, invite_token)
        if row is None:
            raise RecordNotFound(record_id)
        if row["acceptance_state"] == provenance.ACCEPTED:
            raise provenance.ProvenanceError("an accepted record cannot be rejected")
        if row["acceptance_state"] != provenance.REJECTED:
            now = runtime.now_iso()
            conn.execute(
                f"UPDATE {TABLE} SET acceptance_state=?, updated_at=? WHERE id=?",
                (provenance.REJECTED, now, record_id),
            )
            conn.commit()
        row = conn.execute(f"SELECT * FROM {TABLE} WHERE id=?", (record_id,)).fetchone()
    runtime.record_event(
        "studio_context_record_rejected",
        route="/api/studio/context-records",
        source="member",
    )
    return row_to_dict(row)


def groundable_records(
    request: Any, *, cipher_id: str = "", room: str = "", limit: int = 50
) -> list[dict]:
    """The caller's own records that may inform a grounded assembly.

    Filtering happens in SQL *and* is re-checked in Python against
    `provenance.is_groundable`, so a row written by an older code path or by a
    future migration cannot slip into an assembly on the strength of the query
    alone.
    """
    owner_cipher, invite_token = scope(request, cipher_id)
    if not owner_cipher and not invite_token:
        return []
    clause, params = _owner_clause(owner_cipher, invite_token)
    classes = provenance.GROUNDABLE_CLASSES
    visibilities = provenance.ASSEMBLABLE_VISIBILITIES
    sql = (
        f"SELECT * FROM {TABLE} WHERE {clause} AND acceptance_state = ? "
        f"AND provenance_class IN ({','.join('?' * len(classes))}) "
        f"AND visibility IN ({','.join('?' * len(visibilities))})"
    )
    params = params + (provenance.ACCEPTED,) + tuple(classes) + tuple(visibilities)
    if (room or "").strip():
        sql += " AND room = ?"
        params = params + ((room or "").strip()[:MAX_ROOM_CHARS],)
    sql += " ORDER BY created_at DESC, id DESC LIMIT ?"
    with runtime.db() as conn:
        init_schema(conn)
        rows = conn.execute(sql, params + (max(1, min(int(limit or 50), 200)),)).fetchall()
    return [
        row_to_dict(row)
        for row in rows
        if provenance.is_groundable(
            row["provenance_class"], row["acceptance_state"], row["visibility"]
        )
    ]


__all__ = [
    "TABLE",
    "OwnershipError",
    "RecordNotFound",
    "CanonicalSourceError",
    "init_schema",
    "scope",
    "require_scope",
    "create_record",
    "list_records",
    "accept_record",
    "reject_record",
    "groundable_records",
    "row_to_dict",
]
