from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.v1.router import router as v1_router
from .core.config import get_settings
from .core.errors import install_exception_handlers
from .core.logging import configure_logging

settings = get_settings()
configure_logging(settings)

app = FastAPI(
    title="RehabLoop API",
    version="0.1.0",
    description="Prototype API. Not a medical device. See docs/api_contract.md.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
install_exception_handlers(app)
app.include_router(v1_router)


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {"service": "rehabloop-api", "docs": "/docs", "health": "/api/v1/health"}
