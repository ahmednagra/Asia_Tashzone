"""Best-effort per-instance sliding-window rate limits (v1)."""
import threading
import time
from collections import OrderedDict, deque

from fastapi import Request

from app.Core.errors import ApiError

# Best-effort, per-instance sliding window (single API instance today). Slows code guessing, sign-up floods and
# report spam; move to Redis/PostgreSQL before running more than one API replica.
_MAX_KEYS = 10_000
_windows: OrderedDict[str, deque[float]] = OrderedDict()
_lock = threading.Lock()
MINUTE = 60
HOUR = 3600


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"  # uvicorn --proxy-headers behind Caddy


def _hit(bucket: str, allowed: int, window: float) -> None:
    now = time.monotonic()
    with _lock:
        hits = _windows.get(bucket)
        if hits is None:
            while len(_windows) >= _MAX_KEYS:
                _windows.popitem(last=False)
            hits = _windows[bucket] = deque()
        else:
            _windows.move_to_end(bucket)
        while hits and now - hits[0] > window:
            hits.popleft()
        if len(hits) >= allowed:
            raise ApiError(429, "RATE_LIMITED", "Too many requests, wait a moment")
        hits.append(now)


def limit(request: Request, key: str, per_minute: int | None = None, *, per_hour: int | None = None, per_ip: bool = True) -> None:
    suffix = f":{client_ip(request)}" if per_ip else ""
    if per_minute is not None:
        _hit(f"{key}:{MINUTE}{suffix}", per_minute, MINUTE)
    if per_hour is not None:
        _hit(f"{key}:{HOUR}{suffix}", per_hour, HOUR)


def reset_limits() -> None:
    with _lock:
        _windows.clear()
