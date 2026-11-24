from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def error_response(status: int, detail: str, code: str) -> JSONResponse:
    """The shared error contract: {detail, code}."""
    return JSONResponse(status_code=status, content={"detail": detail, "code": code})


def not_implemented(resource: str) -> JSONResponse:
    """Contract stub used until Lennox implements the endpoint."""
    return error_response(501, f"{resource} is not implemented yet", "NOT_IMPLEMENTED")


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
        }.get(exc.status_code, "HTTP_ERROR")
        return error_response(exc.status_code, str(exc.detail), code)

    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
