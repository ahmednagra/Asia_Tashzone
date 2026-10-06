import re
from contextvars import ContextVar

MAX_DEVICE_NAME = 60
_UNSAFE = re.compile(r"[\x00-\x1f\x7f]")
_device_name: ContextVar[str | None] = ContextVar("device_name", default=None)


def clean_device_name(raw: str | None) -> str | None:
    if not raw:
        return None
    name = " ".join(_UNSAFE.sub(" ", raw).split())[:MAX_DEVICE_NAME]
    return name or None


def set_device_name(raw: str | None) -> None:
    _device_name.set(clean_device_name(raw))


def device_name() -> str | None:
    return _device_name.get()
