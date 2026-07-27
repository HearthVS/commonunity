"""stUdio context mode: `legacy` vs `grounded_v1`.

`legacy` is the behaviour that shipped before this foundation existed and is
the production default. `grounded_v1` is the versioned server-side grounded
path. The mode is resolved fresh on every read, so activation and rollback
apply to subsequent requests without a deploy.

Every ambiguity resolves to `legacy`: unset, unreadable, unknown value, or an
activation record that disagrees with the persisted mode. Failing back to the
known-good path is always safer than guessing at the new one.

The mode is independent of the AI provider/model selection (`nexus_model`,
`nexus_effort`). It uses its own setting keys and never reads or writes theirs.
"""

from __future__ import annotations

import json
import os

from . import runtime

LEGACY = "legacy"
GROUNDED_V1 = "grounded_v1"

CONTEXT_MODES = (LEGACY, GROUNDED_V1)
DEFAULT_MODE = LEGACY

MODE_SETTING_KEY = "studio_context_mode"
MODE_PREV_SETTING_KEY = "studio_context_mode_previous"
MODE_ACTIVATION_KEY = "studio_context_mode_activation"
FAILURE_POLICY_SETTING_KEY = "studio_context_failure_policy"

MODE_ENV = "STUDIO_CONTEXT_MODE"
FAILURE_POLICY_ENV = "STUDIO_CONTEXT_FAILURE_POLICY"

# What grounded mode does when required canonical material is unavailable.
#   fail_closed     — return a structured grounding-unavailable result. Never
#                     silently answers from generic model knowledge.
#   fallback_legacy — explicitly route this request through the legacy path and
#                     audit the fallback.
FAIL_CLOSED = "fail_closed"
FALLBACK_LEGACY = "fallback_legacy"

FAILURE_POLICIES = (FAIL_CLOSED, FALLBACK_LEGACY)
DEFAULT_FAILURE_POLICY = FAIL_CLOSED


class ContextModeError(ValueError):
    """Raised when a caller supplies an unknown mode or failure policy."""


def normalize_mode(value: object) -> str | None:
    """Return the canonical mode name, or None if the value is not a mode."""
    if not isinstance(value, str):
        return None
    normalized = value.strip().lower()
    return normalized if normalized in CONTEXT_MODES else None


def validate_mode(value: object) -> str:
    normalized = normalize_mode(value)
    if normalized is None:
        raise ContextModeError(f"mode must be one of {', '.join(CONTEXT_MODES)}")
    return normalized


def normalize_failure_policy(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip().lower()
    return normalized if normalized in FAILURE_POLICIES else None


def validate_failure_policy(value: object) -> str:
    normalized = normalize_failure_policy(value)
    if normalized is None:
        raise ContextModeError(
            f"failure_policy must be one of {', '.join(FAILURE_POLICIES)}"
        )
    return normalized


def env_mode_default() -> str:
    """Boot-time default: STUDIO_CONTEXT_MODE if it names a real mode, else legacy."""
    return normalize_mode(os.getenv(MODE_ENV)) or DEFAULT_MODE


def _read_activation() -> dict:
    """Parse the persisted activation record, or {} if absent/corrupt."""
    try:
        raw = runtime.get_setting(MODE_ACTIVATION_KEY, "") or ""
    except Exception:
        return {}
    if not raw.strip():
        return {}
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _stored_mode() -> tuple[str | None, str]:
    """The admin-selected mode and why it was or was not honoured.

    An activation record whose `mode` disagrees with the persisted mode value
    means the two settings were written apart — a half-applied or externally
    edited state. That is treated as stale and discarded rather than trusted.
    """
    try:
        raw = runtime.get_setting(MODE_SETTING_KEY, "") or ""
    except Exception:
        return None, "unreadable"
    if not raw.strip():
        return None, "unset"
    normalized = normalize_mode(raw)
    if normalized is None:
        return None, "invalid"
    activation = _read_activation()
    if activation and normalize_mode(activation.get("mode")) != normalized:
        return None, "stale"
    return normalized, "admin"


def current_mode() -> str:
    """The active stUdio context mode. Resolved fresh, never cached."""
    stored, _reason = _stored_mode()
    if stored is not None:
        return stored
    return env_mode_default()


def is_grounded() -> bool:
    return current_mode() == GROUNDED_V1


def failure_policy() -> str:
    """Active grounding-failure policy, defaulting to the conservative one."""
    try:
        raw = runtime.get_setting(FAILURE_POLICY_SETTING_KEY, "") or ""
    except Exception:
        raw = ""
    return (
        normalize_failure_policy(raw)
        or normalize_failure_policy(os.getenv(FAILURE_POLICY_ENV))
        or DEFAULT_FAILURE_POLICY
    )


def mode_source() -> str:
    """Where the active mode came from: admin, env, or default."""
    stored, reason = _stored_mode()
    if stored is not None:
        return "admin"
    if normalize_mode(os.getenv(MODE_ENV)):
        return "env"
    return "default" if reason in ("unset", "") else f"default ({reason})"


def state() -> dict:
    """Operator-facing view of the mode subsystem.

    Deliberately carries no prompt text and no member data — it is safe to
    render in the admin panel and to log.
    """
    stored, reason = _stored_mode()
    previous = normalize_mode(runtime.get_setting(MODE_PREV_SETTING_KEY, "") or "")
    activation = _read_activation()
    active = current_mode()
    return {
        "mode": active,
        "modes": list(CONTEXT_MODES),
        "source": mode_source(),
        "default": DEFAULT_MODE,
        "env_default": normalize_mode(os.getenv(MODE_ENV)) or "",
        "stored_raw_status": reason,
        "previous_mode": previous or "",
        "rollback_available": active != LEGACY,
        "failure_policy": failure_policy(),
        "failure_policies": list(FAILURE_POLICIES),
        "last_activation": activation,
        "grounded": active == GROUNDED_V1,
    }


def activate(mode: object, *, actor: str = "admin", reason: str = "") -> dict:
    """Activate a context mode, retaining the outgoing mode for rollback.

    All three settings are written in one transaction so a crash cannot leave
    the mode and its activation record disagreeing — and if it somehow does,
    `_stored_mode()` reads that as stale and falls back to legacy.
    """
    target = validate_mode(mode)
    current = current_mode()
    now = runtime.now_iso()
    activation = {
        "mode": target,
        "previous_mode": current,
        "actor": actor,
        "reason": (reason or "").strip()[:280],
        "activated_at": now,
    }
    with runtime.db() as conn:
        _upsert(conn, MODE_PREV_SETTING_KEY, current, now)
        _upsert(conn, MODE_SETTING_KEY, target, now)
        _upsert(conn, MODE_ACTIVATION_KEY, json.dumps(activation, sort_keys=True), now)
        conn.commit()
    runtime.record_event(
        "studio_context_mode_activated",
        route="/admin",
        source=actor,
        detail=f"{current}->{target}",
    )
    return state()


def rollback_to_legacy(*, actor: str = "admin") -> dict:
    """One-action return to the pre-existing behaviour.

    Always targets `legacy` rather than "whatever was previous", so the rollback
    control cannot itself activate an experimental mode.
    """
    current = current_mode()
    result = activate(LEGACY, actor=actor, reason=f"rollback from {current}")
    runtime.record_event(
        "studio_context_mode_rolled_back",
        route="/admin",
        source=actor,
        detail=f"{current}->{LEGACY}",
    )
    return result


def set_failure_policy(policy: object, *, actor: str = "admin") -> dict:
    validated = validate_failure_policy(policy)
    runtime.set_setting(FAILURE_POLICY_SETTING_KEY, validated)
    runtime.record_event(
        "studio_context_failure_policy_changed",
        route="/admin",
        source=actor,
        detail=validated,
    )
    return state()


def _upsert(conn, key: str, value: str, now: str) -> None:
    conn.execute(
        """
        INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
        """,
        (key, value, now),
    )
