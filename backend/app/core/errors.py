from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def error_response(status: int, detail: str, code: str) -> JSONResponse:
    """The shared error contract: {detail, code}."""
    return JSONResponse(status_code=status, content={"detail": detail, "code": code})


async def validation_exception_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    return error_response(422, "Invalid request payload", "VALIDATION_ERROR")


def install_exception_handlers(app) -> None:  # type: ignore[no-untyped-def]
    from starlette.exceptions import HTTPException as StarletteHTTPException

    app.add_exception_handler(RequestValidationError, validation_exception_handler)

    async def http_exception_handler(
        _request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        code = {
            400: "BAD_REQUEST",
            401: "UNAUTHENTICATED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            409: "INVALID_STATE",
            422: "UNPROCESSABLE",
            429: "RATE_LIMITED",
            502: "BAD_GATEWAY",
            503: "DEPENDENCY_UNAVAILABLE",
        }.get(exc.status_code, "HTTP_ERROR")
        response = error_response(exc.status_code, str(exc.detail), code)
        if exc.headers:
            response.headers.update(exc.headers)
        return response

    async def unexpected_exception_handler(_request: Request, _exc: Exception) -> JSONResponse:
        # Do not echo exceptions: dependency errors can contain request details.
        return error_response(500, "Internal server error", "INTERNAL_SERVER_ERROR")

    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(Exception, unexpected_exception_handler)
