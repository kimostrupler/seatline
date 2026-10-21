# Plan engine (stub)

Python worker that will turn architect plans into draft layouts (Phase 5).

```bash
cd apps/plan-engine
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000   # GET /health
```
