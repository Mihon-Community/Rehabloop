"""Shared vision-service exceptions."""


class VisionUnavailableError(RuntimeError):
    """Raised when real inference cannot run. Maps to HTTP 503."""
