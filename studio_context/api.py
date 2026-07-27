"""HTTP surface for the stUdio context foundation.

Mounted by `server.py` as a router so the app's largest module does not grow
another few hundred lines. Nothing here changes an existing endpoint: the
admin routes control the mode, and the member routes are new primitives for
orientation records and a grounded-assembly preview.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from . import assembler, canonical, modes, provenance, rooms, runtime, store

router = APIRouter()


# ── Payloads ─────────────────────────────────────────────────────────────────

class ContextModeActivateRequest(BaseModel):
    mode: str
    confirm: bool = False
    reason: str = ""


class ContextFailurePolicyRequest(BaseModel):
    failure_policy: str


class ContextRecordCreateRequest(BaseModel):
    provenance_class: str
    room: str = ""
    gene_key: Optional[int] = None
    gene_key_line: Optional[int] = None
    essence: str = ""
    reflection: str = ""
    label: str = ""
    visibility: str = provenance.PRIVATE
    cipher_id: str = ""
    idempotency_key: str = ""


class ContextRecordAcceptRequest(BaseModel):
    cipher_id: str = ""
    essence: Optional[str] = None
    reflection: Optional[str] = None
    idempotency_key: str = ""


class ContextRecordRejectRequest(BaseModel):
    cipher_id: str = ""


# ── Admin: context mode ──────────────────────────────────────────────────────

@router.get("/api/admin/studio-context-mode")
async def admin_get_studio_context_mode(request: Request):
    """Current stUdio context mode, its source, and rollback availability."""
    runtime.require_admin(request)
    return modes.state()


@router.post("/api/admin/studio-context-mode/activate")
async def admin_activate_studio_context_mode(request: Request, payload: ContextModeActivateRequest):
    """Activate a context mode. Requires an explicit confirmation step.

    Switching the context mode does not touch the AI provider/model selection —
    those live under their own settings keys and are resolved independently.
    """
    runtime.require_admin(request)
    try:
        target = modes.validate_mode(payload.mode)
    except modes.ContextModeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None
    if not payload.confirm:
        raise HTTPException(
            status_code=422,
            detail=f"confirmation required to activate '{target}'",
        )
    if target == modes.GROUNDED_V1:
        report = canonical.verify_corpus()
        if not report["ok"]:
            runtime.record_event(
                "studio_context_mode_activation_rejected",
                route="/admin",
                source="admin",
                detail=f"corpus unavailable ({report['present']}/{report['expected']})",
            )
            raise HTTPException(
                status_code=422,
                detail=(
                    "canonical corpus is not healthy "
                    f"({report['present']}/{report['expected']} entries); mode not activated"
                ),
            )
    return modes.activate(target, actor="admin", reason=payload.reason)


@router.post("/api/admin/studio-context-mode/rollback")
async def admin_rollback_studio_context_mode(request: Request):
    """One action, always back to `legacy`. No confirmation — this is the
    safe direction and an operator reaching for it is usually in a hurry."""
    runtime.require_admin(request)
    return modes.rollback_to_legacy(actor="admin")


@router.put("/api/admin/studio-context-failure-policy")
async def admin_set_studio_context_failure_policy(
    request: Request, payload: ContextFailurePolicyRequest
):
    """Set what grounded mode does when canonical material is unavailable."""
    runtime.require_admin(request)
    try:
        return modes.set_failure_policy(payload.failure_policy, actor="admin")
    except modes.ContextModeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None


@router.get("/api/admin/studio-context-sources")
async def admin_studio_context_sources(request: Request):
    """Canonical corpus readiness — the operational check before activating."""
    runtime.require_admin(request)
    return canonical.verify_corpus()


@router.get("/api/admin/studio-context-rooms")
async def admin_studio_context_rooms(request: Request):
    """Which grounded rooms are live, and what they have been doing.

    Deliberately content-free: per room it reports the relevance outcome, the
    source-use category, source ids and counts, so an operator can tell which
    room answered and whether it used personal context or canonical sources,
    without ever showing what that context said.
    """
    runtime.require_admin(request)
    return rooms.debug_state()


# ── Member: orientation records ──────────────────────────────────────────────

@router.get("/api/studio/context-records")
async def list_studio_context_records(
    req: Request, cipher_id: str = "", room: str = "", limit: int = 50
):
    """List the caller's own orientation records. Never cross-member."""
    runtime.require_member(req)
    return {"records": store.list_records(req, cipher_id=cipher_id, room=room, limit=limit)}


@router.post("/api/studio/context-records")
async def create_studio_context_record(request: ContextRecordCreateRequest, req: Request):
    """Create one orientation record owned by the caller.

    A client may only declare member-creatable provenance classes; an
    `ai_proposal` is always stored unaccepted.
    """
    runtime.require_member(req)
    try:
        return store.create_record(
            req,
            cipher_id=request.cipher_id,
            provenance_class=request.provenance_class,
            room=request.room,
            gene_key=request.gene_key,
            gene_key_line=request.gene_key_line,
            essence=request.essence,
            reflection=request.reflection,
            label=request.label,
            visibility=request.visibility,
            idempotency_key=request.idempotency_key,
        )
    except store.OwnershipError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from None
    except (provenance.ProvenanceError, canonical.CanonicalSourceError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None


@router.post("/api/studio/context-records/{record_id}/accept")
async def accept_studio_context_record(
    record_id: str, request: ContextRecordAcceptRequest, req: Request
):
    """Explicitly accept a proposal, deriving a trusted record from it."""
    runtime.require_member(req)
    try:
        return store.accept_record(
            req,
            record_id,
            cipher_id=request.cipher_id,
            essence=request.essence,
            reflection=request.reflection,
            idempotency_key=request.idempotency_key,
        )
    except store.OwnershipError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from None
    except store.RecordNotFound:
        raise HTTPException(status_code=404, detail="record not found") from None
    except provenance.ProvenanceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None


@router.post("/api/studio/context-records/{record_id}/reject")
async def reject_studio_context_record(
    record_id: str, request: ContextRecordRejectRequest, req: Request
):
    """Explicitly reject a proposal. Idempotent."""
    runtime.require_member(req)
    try:
        return store.reject_record(req, record_id, cipher_id=request.cipher_id)
    except store.OwnershipError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from None
    except store.RecordNotFound:
        raise HTTPException(status_code=404, detail="record not found") from None
    except provenance.ProvenanceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from None


@router.get("/api/studio/context-preview")
async def studio_context_preview(
    req: Request, cipher_id: str = "", room: str = "", limit: int = 50
):
    """Preview the grounded assembly for the caller's own material.

    Returns the full trace to the owning member. Nothing here is wired into
    generation yet — in `legacy` mode it reports `legacy` and assembles
    nothing.
    """
    runtime.require_member(req)
    result = assembler.assemble(req, cipher_id=cipher_id, room=room, limit=limit)
    return result
