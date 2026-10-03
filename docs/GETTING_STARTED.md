# Development

## Setup

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

# Frontend
cd ../frontend
pnpm install
cp .env.example .env.local
```

Both servers, two terminals:

```bash
cd backend  && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000
cd frontend && pnpm dev
```

## Checks

```bash
cd backend
.venv/bin/python -c "from app.main import app; print('imports ok')"

cd frontend
pnpm exec tsc --noEmit
pnpm lint
pnpm build
```

The backend has no test suite. The planner is pure functions over Pydantic
models, so it is the cheapest place to add one — construct a `LifeOSAnalysis`
with known-good input, assert on the plan order and detected conflicts, no model
call or API key required.

## Working on the backend

`config.py` is read once per process and cached. Editing `.env` needs a server
restart; `--reload` does not always catch it.

Every route is under `app/routers/`. Upload validation lives in `uploads.py` so
`analyze.py` stays a thin orchestration layer.

The blocking LangChain call runs via `anyio.to_thread.run_sync`. Do not call the
model directly from an `async def` route; it will stall the event loop for the
duration of the request.

## Working on the frontend

Tailwind 4, so design tokens are CSS custom properties in `@theme` inside
`src/app/globals.css`. Change the palette there, not in individual components.

The `sleeve-label` utility carries the tracked-out small-caps treatment used for
section labels and frame numbers. Use it rather than re-deriving the tracking.

`severityStyle()` in `lib/utils.ts` is the only place severity maps to visual
treatment. Adding colour elsewhere breaks the rule that grease pencil means
conflict.

Types in `lib/types.ts` mirror the Pydantic models by hand. They are
field-for-field copies, so a schema change needs the same edit in both places.

## Traps worth knowing

**Braces in prompts.** A `ChatPromptTemplate` treats `{` and `}` as
placeholders. Any JSON, code, or braces-laden text must be passed as a
template **variable**, never concatenated into the template string. The failure
mode is a confusing parse error at invoke time, not at build time.

**Gemma is not Gemini.** `with_structured_output(method="json_schema")` and
`json_mode` both send Gemini's strict `response_json_schema`, which Gemma does
not implement. `function_calling` drops `$defs`, losing nested models. See
[ARCHITECTURE.md](ARCHITECTURE.md#structured-output-is-harder-than-it-looks).

**Model identifiers never get hardcoded.** If you see a model string in
Python or TypeScript, it is a bug. It belongs in `GEMMA_MODEL`.

**Object URLs leak.** `URL.createObjectURL` is not garbage collected. Every
removal and reset path calls `URL.revokeObjectURL`. A new removal site needs the
same.

## Debugging

Backend logs to stdout at INFO. The two lines that matter:

```text
Analysis attempt failed (method=prompt_json): ...   ← attempt 1 failed
Analysis attempt failed (method=function_calling): ...  ← both failed, 502 next
```

A 400 means the upload was rejected before any model call. A 502 means
validation passed and Gemma failed. That distinction tells you which half to
look at.

`GET /api/health` reports the configured model name (never the key) plus the
upload limits, which is the quickest way to confirm the server picked up your
`.env`.

## Committing

One feature per commit. Write the *why* in the body, especially when a
non-obvious decision was forced by a library's behaviour.