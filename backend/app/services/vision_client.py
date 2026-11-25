"""HTTP client for the private vision service with an explicit failure state."""

from __future__ import annotations

from typing import Literal, Protocol

import httpx

from ..schemas.stream import FrameEvent, VisionResponse


class VisionUnavailableError(RuntimeError):
    """The vision service could not return a usable response."""


class VisionInferenceClient(Protocol):
    async def infer(self, frame: FrameEvent) -> VisionResponse: ...


class VisionClient:
    def __init__(
        self,
        base_url: str,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.transport = transport
        self.state: Literal["unknown", "available", "unavailable"] = "unknown"
        self._client: httpx.AsyncClient | None = None

    async def infer(self, frame: FrameEvent) -> VisionResponse:
        if self._client is None:
            timeout = httpx.Timeout(connect=3.0, read=10.0, write=5.0, pool=3.0)
            self._client = httpx.AsyncClient(
                base_url=self.base_url,
                timeout=timeout,
                transport=self.transport,
            )
        try:
            response = await self._client.post(
                "/infer",
                json=frame.model_dump(exclude={"type", "session_id"}),
            )
            response.raise_for_status()
            result = VisionResponse.model_validate(response.json())
        except (httpx.HTTPError, ValueError, TypeError) as exc:
            self.state = "unavailable"
            raise VisionUnavailableError("vision service unavailable") from exc
        self.state = "available"
        return result

    async def aclose(self) -> None:
        if self._client is not None:
            await self._client.aclose()
            self._client = None
