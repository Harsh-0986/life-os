# LifeOS

Live URL: https://life-os-one-amber.vercel.app/

Lay your screenshots on one sheet. Gemma reads every frame at once, marks what
is due, and circles the clashes. The order comes out of Python, not out of the
model.

![stack](https://img.shields.io/badge/Next.js-16-000) ![stack](https://img.shields.io/badge/React-19-000) ![stack](https://img.shields.io/badge/FastAPI-000) ![stack](https://img.shields.io/badge/LangChain-v1-000) ![stack](https://img.shields.io/badge/Gemma-Gemini%20API-000)

---

## The idea

Drop in an LMS assignment page, a calendar, a group chat, and an invoice. All
four images travel to Gemma in **one request**, so the model can reason across
them at the same time. It finds the relationships you would notice only by
squinting at all four: the lab report lands the same night as the exam review
session, the problem set is due the morning after.

Those findings come back as structured Pydantic objects. From there, everything
is arithmetic.

**Why the split matters.** Gemma does what only a model can do — read four
unstructured images and connect them. Python does everything that must not be
guessed: priority ordering, deadline math, conflict detection. If the model
invented the action plan, it would occasionally invent a deadline you never
had. Keeping the plan deterministic means it cannot.

## Architecture

```text
   Next.js 16 / React 19 / TypeScript / Tailwind 4
                        │
                        │  HTTP (multipart, JSON)
                        ▼
              FastAPI + Pydantic 2
                        │
                        ▼
     LangChain ── ChatPromptTemplate
                 ── with_structured_output / PydanticOutputParser
                 ── LCEL composition
                        │
                        ▼
          Gemma via Gemini API (multimodal, one request)
                        │
                        ▼
            LifeOSAnalysis (Pydantic)
                        │
                        ▼
    Python planner ── priority ── deadline order ── conflicts
                        │
                        ▼
                  Action plan
```

Chat is a second LangChain call that receives the **structured analysis, never
the raw images**, so it can only reason over facts already extracted.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the reasoning behind
each boundary.

## Quick start

```bash
# 1. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # add your GEMINI_API_KEY

# 2. Frontend
cd ../frontend
pnpm install
cp .env.example .env.local
```

Then two terminals:

```bash
cd backend  && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000
cd frontend && pnpm dev
```

Open <http://localhost:3000>. API docs at <http://localhost:8000/docs>.

## Try it without the UI

`http://localhost:8000/docs` → **Try it out** on `/api/analyze` → attach one or
more images. Useful for isolating whether a failure is the upload or the model.

## What it does

- **Multi-image extraction** — one Gemma request, up to 5 images, cross-referenced
- **Conflict detection** — double-booked events, deadlines colliding with events,
  several deadlines inside 24 hours, tasks due after the deadline they feed
- **Prioritized plan** — sorted by priority then deadline, each step with a reason
- **Source traceability** — every item cites its frame number; click it to see the
  screenshot it was read from
- **Grounded chat** — answers only from extracted facts, and says so when the
  sheet does not say

## Limits

| Limit | Value |
| --- | --- |
| Images per request | 5 |
| Max size per image | 10 MB |
| Max request size | 30 MB |
| Formats | PNG, JPEG, WEBP |
| Target analysis time | under 30 seconds |

Uploads are validated and rejected with a 400 **before** a model call is spent.
Model failures return 502, so the client can tell a bad upload from an
unavailable model.

## Configuration

Backend (`.env`) — never commit this file:

```env
GEMINI_API_KEY=          # required, server-side only
GEMMA_MODEL=             # required, single source of truth
CORS_ORIGIN=http://localhost:3000
STRUCTURED_OUTPUT_METHOD=prompt_json
```

Frontend (`.env.local`):

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Security

The browser never talks to Gemini. It calls FastAPI; FastAPI is the only caller
of the Gemini API. There is no AI SDK in `frontend/package.json` and no key in
any client bundle. `.env` and `.env.local` are gitignored; only `.env.example`
files are committed.

## Project layout

```text
backend/app/
  main.py       FastAPI app, CORS, Swagger, /api/health
  config.py     Settings; sole reader of GEMMA_MODEL
  schemas.py    Pydantic contracts shared by model, planner, and HTTP
  prompts.py    Analysis and chat prompt text
  llm.py        The only place ChatGoogleGenerativeAI is constructed
  planner.py    Deterministic priority and conflict detection, no LLM calls
  uploads.py    Count, MIME, and size validation
  routers/      analyze.py, chat.py

frontend/src/
  app/          App Router entry, layout, design tokens
  components/   UploadZone, ImagePreview, AnalysisProgress, Rows,
                SourcePreview, ChatPanel
  lib/          types.ts, api.ts, utils.ts

docs/
  README.md         index of the documentation set
  ARCHITECTURE.md   why the boundaries sit where they do
  GETTING_STARTED.md file-by-file tour and the rules worth keeping
  DEVELOPMENT.md    workflow, checks, and known traps
```

## Scope

Deliberately out: database, RAG or embeddings, multi-agent orchestration,
background queues, LangSmith, LangGraph. Planning and conflict detection are
plain Python. [`SPEC.md`](SPEC.md) is the contract this implementation follows.
