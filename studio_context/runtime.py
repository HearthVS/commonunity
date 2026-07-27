"""Host bindings for the stUdio context foundation.

The package is deliberately decoupled from `server.py`: it never imports the
host application, so it can be unit tested in isolation and so `server.py`
does not grow further. The host binds its database connection factory,
durable-settings helpers and auth guards exactly once, at import time, via
`configure()`.

Anything the package needs from the host goes through here. If a binding is
missing the package fails loudly rather than inventing a fallback, because a
silent fallback in the trust layer is exactly the class of bug this
architecture exists to prevent.
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Any, Callable

_BINDINGS: dict[str, Any] = {}

_REQUIRED = ("db", "get_setting", "set_setting")


def configure(
    *,
    db: Callable[[], Any],
    get_setting: Callable[..., Any],
    set_setting: Callable[[str, str], None],
    now_iso: Callable[[], str] | None = None,
    record_event: Callable[..., None] | None = None,
    require_admin: Callable[[Any], None] | None = None,
    require_member: Callable[[Any], None] | None = None,
    invite_token_from_cookie: Callable[[Any], str] | None = None,
) -> None:
    """Bind host capabilities. Idempotent — calling twice replaces bindings."""
    _BINDINGS.update(
        db=db,
        get_setting=get_setting,
        set_setting=set_setting,
        now_iso=now_iso or _default_now_iso,
        record_event=record_event or (lambda *a, **k: None),
        require_admin=require_admin,
        require_member=require_member,
        invite_token_from_cookie=invite_token_from_cookie or (lambda _req: ""),
    )


def is_configured() -> bool:
    return all(_BINDINGS.get(name) for name in _REQUIRED)


def _default_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _binding(name: str) -> Any:
    value = _BINDINGS.get(name)
    if value is None:
        raise RuntimeError(
            f"studio_context is not configured: missing '{name}' binding. "
            "Call studio_context.configure(...) from the host application."
        )
    return value


def db() -> Any:
    """Context-manager database connection, supplied by the host."""
    return _binding("db")()


def get_setting(key: str, default: str | None = None) -> str | None:
    return _binding("get_setting")(key, default)


def set_setting(key: str, value: str) -> None:
    _binding("set_setting")(key, value)


def now_iso() -> str:
    return _binding("now_iso")()


def record_event(event_type: str, **kwargs: Any) -> None:
    """Best-effort audit hook. Never raises into a caller's request path."""
    try:
        _binding("record_event")(event_type, **kwargs)
    except Exception:
        pass


def require_admin(request: Any) -> None:
    _binding("require_admin")(request)


def require_member(request: Any) -> None:
    _binding("require_member")(request)


def invite_token_from_cookie(request: Any) -> str:
    return _binding("invite_token_from_cookie")(request) or ""


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(16)}"
