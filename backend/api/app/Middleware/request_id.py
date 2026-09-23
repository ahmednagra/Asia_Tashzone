"""Correlation id on every request and one structured access line (no headers, bodies or IPs logged)."""
import re
import time
import uuid

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.Utils.Logger import logger

_SAFE_ID = re.compile(r"^[A-Za-z0-9-]{8,64}$")


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        incoming = request.headers.get("x-request-id", "")
        request_id = incoming if _SAFE_ID.match(incoming) else str(uuid.uuid4())
        request.state.request_id = request_id
        started = time.perf_counter()
        response = await call_next(request)
        response.headers["x-request-id"] = request_id
        logger.info("request", extra={
            "request_id": request_id, "method": request.method, "path": request.url.path,
            "status": response.status_code, "duration_ms": round((time.perf_counter() - started) * 1000, 1),
        })
        return response
