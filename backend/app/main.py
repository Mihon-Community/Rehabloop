from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.v1.router import router as v1_router
from .core.auth import DevAuthVerifier, SessionTokenStore, SupabaseJWTAuthVerifier
from .core.config import Settings, get_settings
from .core.errors import install_exception_handlers
from .core.logging import configure_logging
from .services.in_memory_repository import InMemoryRepository
from .services.session_service import SessionService
from .services.supabase_repository import SupabaseRepository
from .services.vision_client import VisionClient, VisionInferenceClient

_logger = logging.getLogger(__name__)

ProfileLookup = Callable[[str], Awaitable[dict[str, object] | None]]


def _warn_on_dev_auth_with_supabase_credentials(config: Settings) -> None:
    """Log (never raise) when AUTH_MODE=dev is active despite real Supabase
    credentials being configured.

    docker-compose.yml defaults AUTH_MODE to "dev" whenever the .env file
    doesn't set it explicitly, which silently overrides this module's own
    production-safe default (auth_mode defaults to "supabase" in
    core/config.py) with no startup warning. That's the gap this closes:
    anyone who fills in real SUPABASE_URL/SUPABASE_JWKS_URL while forgetting
    to also set AUTH_MODE=supabase gets dev/demo auth with no indication
    something is off. This only logs; it must not change startup behaviour,
    since AUTH_MODE=dev is a legitimate, common local-dev configuration on
    its own.
    """
    if config.auth_mode == "dev" and (config.supabase_url or config.supabase_jwks_url):
        _logger.warning(
            "AUTH_MODE=dev is active even though Supabase credentials "
            "(SUPABASE_URL/SUPABASE_JWKS_URL) are configured. Requests are being verified "
            "against local demo tokens, not real Supabase auth. Set AUTH_MODE=supabase "
            "(e.g. in .env) if real auth is intended in this environment."
        )


def _supabase_profile_lookup(
    config: Settings, storage: InMemoryRepository | SupabaseRepository
) -> ProfileLookup:
    """Resolve Supabase-authenticated users' profiles from Supabase itself,
    independent of whichever repository session storage happens to use.

    `storage` is selected by `config.storage_mode`, which only reflects
    whether SUPABASE_SERVICE_ROLE_KEY is populated -- it says nothing about
    `auth_mode`. Previously, AUTH_MODE=supabase with an incomplete Supabase
    storage configuration (or an explicit non-Supabase `repository` override)
    silently wired SupabaseJWTAuthVerifier's profile lookup to
    InMemoryRepository, which only recognises its two hardcoded dev UUIDs.
    Every other (real, correctly-signed) Supabase user id then resolved to
    `None`, surfacing as a misleading "401 Invalid access token" instead of
    a clear configuration error. Reusing an already-configured
    SupabaseRepository when one exists avoids constructing a second,
    redundant instance in the common case.
    """
    if isinstance(storage, SupabaseRepository):
        return storage.get_profile
    return SupabaseRepository(config).get_profile


def create_app(
    settings: Settings | None = None,
    *,
    repository: InMemoryRepository | SupabaseRepository | None = None,
    vision_client: VisionInferenceClient | None = None,
) -> FastAPI:
    config = settings or get_settings()
    if config.auth_mode == "dev" and config.app_env != "local":
        raise RuntimeError("AUTH_MODE=dev is allowed only when APP_ENV=local")
    configure_logging(config)
    _warn_on_dev_auth_with_supabase_credentials(config)

    storage = repository or (
        SupabaseRepository(config) if config.storage_mode == "supabase" else InMemoryRepository()
    )
    auth_verifier = (
        DevAuthVerifier(config.app_env)
        if config.auth_mode == "dev"
        else SupabaseJWTAuthVerifier(config, _supabase_profile_lookup(config, storage))
    )
    vision = vision_client or VisionClient(config.vision_service_url)

    @asynccontextmanager
    async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
        try:
            yield
        finally:
            for resource in (auth_verifier, vision):
                close = getattr(resource, "aclose", None)
                if close is not None:
                    await close()

    app = FastAPI(
        title="RehabLoop API",
        version="0.1.0",
        description="Prototype API. Not a medical device. See docs/api_contract.md.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH"],
        allow_headers=["Authorization", "Content-Type"],
    )
    install_exception_handlers(app)
    app.state.settings = config
    app.state.repository = storage
    app.state.auth_verifier = auth_verifier
    app.state.token_store = SessionTokenStore()
    app.state.session_service = SessionService(config, storage, app.state.token_store)
    app.state.vision_client = vision
    app.include_router(v1_router)

    @app.get("/", include_in_schema=False)
    def root() -> dict[str, str]:
        return {"service": "rehabloop-api", "docs": "/docs", "health": "/api/v1/health"}

    return app


app = create_app()
