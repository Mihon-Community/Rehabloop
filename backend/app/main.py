from __future__ import annotations

from collections.abc import AsyncIterator
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

    storage = repository or (
        SupabaseRepository(config) if config.storage_mode == "supabase" else InMemoryRepository()
    )
    auth_verifier = (
        DevAuthVerifier(config.app_env)
        if config.auth_mode == "dev"
        else SupabaseJWTAuthVerifier(config, storage.get_profile)
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
