"""Service-role PostgREST access. Credentials never leave this module."""

from __future__ import annotations

from typing import Any, Literal

import httpx

from ..core.config import Settings

CAMERA_CONSENT_VERSION = "camera-processing-v1"
CAMERA_CONSENT_PURPOSE = "camera_processing"


class SupabaseRepository:
    def __init__(
        self,
        settings: Settings,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.settings = settings
        self._transport = transport
        self._configured = bool(
            settings.supabase_url and settings.supabase_service_role_key.get_secret_value()
        )

    @property
    def configured(self) -> bool:
        return self._configured

    @property
    def storage_mode(self) -> Literal["supabase"]:
        return "supabase"

    def _headers(self) -> dict[str, str]:
        if not self._configured:
            raise RuntimeError("Supabase storage requires SUPABASE_URL and service-role key")
        service_key = self.settings.supabase_service_role_key.get_secret_value()
        return {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        }

    async def _request(
        self,
        method: str,
        table: str,
        *,
        params: dict[str, str] | None = None,
        body: dict[str, Any] | list[dict[str, Any]] | None = None,
        prefer: str | None = None,
    ) -> Any:
        headers = self._headers()
        if prefer:
            headers["Prefer"] = prefer
        timeout = httpx.Timeout(connect=5, read=10, write=10, pool=5)
        async with httpx.AsyncClient(timeout=timeout, transport=self._transport) as client:
            response = await client.request(
                method,
                f"{self.settings.supabase_url.rstrip('/')}/rest/v1/{table}",
                params=params,
                json=body,
                headers=headers,
            )
        response.raise_for_status()
        if not response.content:
            return None
        return response.json()

    async def clinician_has_patient(self, clinician_id: str, patient_id: str) -> bool:
        rows = await self._request(
            "GET",
            "clinician_patient_links",
            params={
                "select": "clinician_id",
                "clinician_id": f"eq.{clinician_id}",
                "patient_id": f"eq.{patient_id}",
                "status": "eq.active",
                "limit": "1",
            },
        )
        return bool(rows)

    async def get_profile(self, user_id: str) -> dict[str, Any] | None:
        rows = await self._request(
            "GET",
            "profiles",
            params={
                "select": "id,role,display_name",
                "id": f"eq.{user_id}",
                "limit": "1",
            },
        )
        return rows[0] if rows else None

    async def consent_is_valid(self, consent_id: str, patient_id: str) -> bool:
        rows = await self._request(
            "GET",
            "consent_records",
            params={
                "select": "id",
                "id": f"eq.{consent_id}",
                "patient_id": f"eq.{patient_id}",
                "consent_version": f"eq.{CAMERA_CONSENT_VERSION}",
                "purpose": f"eq.{CAMERA_CONSENT_PURPOSE}",
                "revoked_at": "is.null",
                "limit": "1",
            },
        )
        return bool(rows)

    async def create_protocol(self, protocol: dict[str, Any]) -> dict[str, Any]:
        row = {
            "id": protocol["id"],
            "patient_id": protocol["patient_id"],
            "clinician_id": protocol["clinician_id"],
            "protocol_name": protocol["protocol_name"],
            "version": protocol["version"],
            "parameters": protocol["parameters"],
            "approved_at": protocol.get("approved_at"),
            "active": protocol["active"],
        }
        result = await self._request(
            "POST", "exercise_protocols", body=row, prefer="return=representation"
        )
        stored = result[0] if isinstance(result, list) and result else row
        return self._protocol_response(stored)

    async def get_protocol(self, protocol_id: str) -> dict[str, Any] | None:
        rows = await self._request(
            "GET",
            "exercise_protocols",
            params={"select": "*", "id": f"eq.{protocol_id}", "limit": "1"},
        )
        return self._protocol_response(rows[0]) if rows else None

    async def list_protocols(self, patient_id: str) -> list[dict[str, Any]]:
        rows = await self._request(
            "GET",
            "exercise_protocols",
            params={
                "select": "*",
                "patient_id": f"eq.{patient_id}",
                "active": "eq.true",
                "order": "created_at.desc",
            },
        )
        return [self._protocol_response(row) for row in rows]

    async def deactivate_protocol(self, protocol_id: str) -> None:
        await self._request(
            "PATCH",
            "exercise_protocols",
            params={"id": f"eq.{protocol_id}"},
            body={"active": False},
            prefer="return=minimal",
        )

    async def update_protocol_version(
        self, protocol_id: str, protocol: dict[str, Any]
    ) -> dict[str, Any] | None:
        result = await self._request(
            "POST",
            "rpc/backend_update_protocol_version",
            body={
                "p_protocol_id": protocol_id,
                "p_new_id": protocol["id"],
                "p_expected_version": protocol["version"] - 1,
                "p_parameters": protocol["parameters"],
                "p_active": protocol["active"],
                "p_approved_at": protocol.get("approved_at"),
            },
        )
        if not isinstance(result, list) or not result:
            return None
        return self._protocol_response(result[0])

    async def create_session(self, session: dict[str, Any]) -> dict[str, Any]:
        row = {
            "id": session["session_id"],
            "patient_id": session["patient_id"],
            "protocol_id": session["protocol_id"],
            "status": session["status"],
            "model_version": session["model_version"],
            "mapping_version": session["keypoint_mapping_version"],
            "analytics_version": session["analytics_version"],
            "raw_video_stored": False,
        }
        result = await self._request("POST", "sessions", body=row, prefer="return=representation")
        stored = result[0] if isinstance(result, list) and result else row
        session.update({"session_id": stored["id"], "persisted": True})
        return session

    async def get_session(self, session_id: str) -> dict[str, Any] | None:
        rows = await self._request(
            "GET", "sessions", params={"select": "*", "id": f"eq.{session_id}", "limit": "1"}
        )
        if not rows:
            return None
        row = rows[0]
        protocol = await self.get_protocol(row["protocol_id"])
        metric_rows = await self._request(
            "GET",
            "session_metrics",
            params={
                "select": "metric_key,numeric_value,text_value",
                "session_id": f"eq.{session_id}",
            },
        )
        metrics = {
            metric["metric_key"]: metric["numeric_value"]
            if metric["numeric_value"] is not None
            else metric["text_value"]
            for metric in metric_rows
        }
        flag_rows = await self._request(
            "GET",
            "session_flags",
            params={"select": "flag_code", "session_id": f"eq.{session_id}"},
        )
        return {
            "session_id": row["id"],
            "protocol_id": row["protocol_id"],
            "protocol_version": protocol["version"] if protocol else 1,
            "patient_id": row["patient_id"],
            "clinician_id": protocol["clinician_id"] if protocol else "",
            "model_version": row.get("model_version") or "unknown",
            "keypoint_mapping_version": row.get("mapping_version") or "unknown",
            "analytics_version": row.get("analytics_version") or "unknown",
            "status": row["status"],
            "metrics": metrics,
            "quality_flags": [flag["flag_code"] for flag in flag_rows],
            "raw_video_stored": False,
            "persisted": True,
            "started_at": row.get("started_at"),
            "ended_at": row.get("ended_at"),
        }

    async def update_session(
        self, session_id: str, updates: dict[str, Any]
    ) -> dict[str, Any] | None:
        db_updates = {
            key: updates[key] for key in ("status", "started_at", "ended_at") if key in updates
        }
        if "raw_video_stored" in updates and updates["raw_video_stored"] is not False:
            raise ValueError("raw video storage must remain disabled")
        if "metrics" in updates:
            await self._save_metrics(session_id, updates["metrics"])
        if "quality_flags" in updates:
            await self._save_flags(session_id, updates["quality_flags"])
        if db_updates:
            await self._request(
                "PATCH",
                "sessions",
                params={"id": f"eq.{session_id}"},
                body=db_updates,
                prefer="return=minimal",
            )
        return await self.get_session(session_id)

    async def pause_active_session(self, session_id: str) -> bool:
        # The status=eq.active filter makes this a compare-and-set in one round
        # trip, so a stream closing cannot overwrite a session that completed
        # in the meantime. return=representation is what reports whether any
        # row actually matched.
        rows = await self._request(
            "PATCH",
            "sessions",
            params={"id": f"eq.{session_id}", "status": "eq.active"},
            body={"status": "paused"},
            prefer="return=representation",
        )
        return bool(rows)

    async def complete_session(
        self,
        session_id: str,
        ended_at: str,
        metrics: dict[str, Any],
        quality_flags: list[str],
    ) -> dict[str, Any] | None:
        session = await self.get_session(session_id)
        if session is None:
            return None
        result = await self._request(
            "POST",
            "rpc/backend_complete_session",
            body={
                "p_session_id": session_id,
                "p_ended_at": ended_at,
                "p_metrics": metrics,
                "p_flags": quality_flags,
            },
        )
        if not isinstance(result, list) or not result:
            return None
        row = result[0] if isinstance(result[0], dict) else {}
        numeric_metrics = {
            key: value
            for key, value in metrics.items()
            if isinstance(value, (int, float)) and not isinstance(value, bool)
        }
        session.update(
            {
                "status": row.get("status", "completed"),
                "ended_at": row.get("ended_at", ended_at),
                "metrics": {**session["metrics"], **numeric_metrics},
                "quality_flags": sorted(set(session["quality_flags"]) | set(quality_flags)),
                "raw_video_stored": False,
                "persisted": True,
            }
        )
        return session

    async def list_sessions(self, patient_id: str) -> list[dict[str, Any]]:
        rows = await self._request(
            "GET",
            "sessions",
            params={"select": "id", "patient_id": f"eq.{patient_id}", "order": "created_at.desc"},
        )
        sessions = [await self.get_session(row["id"]) for row in rows]
        return [session for session in sessions if session is not None]

    async def save_summary(self, session_id: str, summary: dict[str, Any]) -> bool:
        row = {
            "session_id": session_id,
            "provider": summary["source"],
            "model_id": summary.get("model_id") or "deterministic",
            "schema_version": summary["schema_version"],
            "body": summary,
            "validated": True,
        }
        await self._request("POST", "ai_summaries", body=row, prefer="return=minimal")
        return True

    async def get_summary(self, session_id: str) -> dict[str, Any] | None:
        rows = await self._request(
            "GET",
            "ai_summaries",
            params={
                "select": "body",
                "session_id": f"eq.{session_id}",
                "order": "created_at.desc",
                "limit": "1",
            },
        )
        if not rows:
            return None
        body = rows[0].get("body")
        return body if isinstance(body, dict) else None

    async def _save_metrics(self, session_id: str, metrics: dict[str, Any]) -> None:
        rows = [
            {
                "session_id": session_id,
                "metric_key": key,
                "numeric_value": value,
                "text_value": None,
                "unit": None,
            }
            for key, value in metrics.items()
            if isinstance(value, (int, float)) and not isinstance(value, bool)
        ]
        if rows:
            await self._request(
                "POST",
                "session_metrics",
                params={"on_conflict": "session_id,metric_key"},
                body=rows,
                prefer="resolution=merge-duplicates,return=minimal",
            )

    async def _save_flags(self, session_id: str, flags: list[str]) -> None:
        rows = [{"session_id": session_id, "flag_code": flag, "severity": "info"} for flag in flags]
        if rows:
            await self._request(
                "POST",
                "session_flags",
                body=rows,
                prefer="return=minimal",
            )

    @staticmethod
    def _protocol_response(row: dict[str, Any]) -> dict[str, Any]:
        return {
            "id": row["id"],
            "patient_id": row["patient_id"],
            "clinician_id": row["clinician_id"],
            "protocol_name": row.get("protocol_name", ""),
            "version": row["version"],
            "parameters": row["parameters"],
            "approved_at": row.get("approved_at"),
            "active": row["active"],
            "persisted": True,
        }
