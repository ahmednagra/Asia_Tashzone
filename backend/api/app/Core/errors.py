"""Stable error envelope {"error": {"code", "message"}} (the app maps codes to translated messages)."""
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.Utils.Logger import logger


class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


def not_found(code: str, message: str) -> ApiError:
    return ApiError(404, code, message)


def forbidden(code: str, message: str) -> ApiError:
    return ApiError(403, code, message)


def conflict(code: str, message: str) -> ApiError:
    return ApiError(409, code, message)


def unprocessable(code: str, message: str) -> ApiError:
    return ApiError(422, code, message)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def api_error(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"error": {"code": exc.code, "message": exc.message}})

    @app.exception_handler(HTTPException)
    async def http_error(_: Request, exc: HTTPException) -> JSONResponse:
        code = exc.detail if isinstance(exc.detail, str) else "ERROR"
        return JSONResponse(status_code=exc.status_code, content={"error": {"code": code.upper(), "message": code}})

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields = [".".join(str(p) for p in e["loc"] if p != "body") for e in exc.errors()][:10]
        return JSONResponse(status_code=422, content={"error": {"code": "INVALID_REQUEST", "message": "Request is not valid", "fields": fields}})

    @app.exception_handler(Exception)
    async def unexpected(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled_error", extra={"path": request.url.path, "request_id": getattr(request.state, "request_id", None)})
        return JSONResponse(status_code=500, content={"error": {"code": "INTERNAL", "message": "Something went wrong"}})
