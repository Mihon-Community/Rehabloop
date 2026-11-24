# RehabLoop backend (Lennox, `feature/lennox`)

FastAPI on Python 3.12. See `../docs/backend_guide.md` and `../docs/api_contract.md`.

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
pytest && ruff check . && mypy app
```

`GET /api/v1/health` is implemented. All other endpoints return the contract's
501 error until implemented — they are typed Pydantic stubs, not fake data.
