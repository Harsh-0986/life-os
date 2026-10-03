# LifeOS

Multimodal personal planning assistant. Upload screenshots of your assignments,
schedules, and messages — **Gemma** reads all of them together, extracts tasks,
deadlines, and events, and a deterministic Python planner turns those facts into
a prioritized action plan with conflict detection.

## Why Gemma matters here

The core capability is **cross-image reasoning**. Five screenshots of five
different sources (an LMS assignment page, a calendar, a group chat, a bill, a
syllabus) are sent to Gemma in a *single* request. Gemma finds the implicit
relationships a human would notice — "the lab report deadline lands the same
night as the exam review session" — and returns them as structured Pydantic
objects. Nothing is pre-computed or hardcoded; the cross-referencing is the
model's work.

Planning is deliberately **not** delegated to the model. Priority ordering and
conflict detection are deterministic Python so the numbers can't hallucinate.

## Architecture

```text
   Next.js 16 / React 19 / TS / Tailwind 4
                  │  HTTP
                  ▼
     FastAPI + Pydantic 2 (Python)
                  │
                  ▼
        LangChain ── ChatPromptTemplate
                  │   with_structured_output(LifeOSAnalysis)
                  │   LCEL composition
                  ▼
          Gemma (Gemini API, multimodal)
                  │
                  ▼
          LifeOSAnalysis (Pydantic)
                  │
                  ▼
   Python planner → priority · deadlines · conflicts → action plan
```

Chat is a second LangChain → Gemma call that receives the *structured analysis*,
never the raw images (SPEC §14).

## Project layout

```text
backend/
  app/
    main.py       FastAPI app, CORS, router mounting
    config.py     Settings (GEMINI_API_KEY, GEMMA_MODEL, CORS_ORIGIN)
    schemas.py    Pydantic models: Task, Event, Deadline, Conflict, PlanItem
    prompts.py    ANALYSIS_PROMPT + CHAT_PROMPT
    llm.py        THE ONLY place ChatGoogleGenerativeAI is instantiated
    planner.py    Deterministic priority + conflict detection
    routers/
      analyze.py  POST /api/analyze
      chat.py     POST /api/chat
frontend/
  app/            App Router pages
  components/     UploadZone, ImagePreview, AnalysisProgress, TaskCard, ...
  lib/            types.ts, api.ts
```

## Setup

Requires Node 22+, pnpm 10+, Python 3.11+.

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # then add your GEMINI_API_KEY

# Frontend
cd ../frontend
pnpm install
cp .env.example .env.local
```

## Run

Two terminals:

```bash
cd backend && uvicorn app.main:app --reload --port 8000
cd frontend && pnpm dev
```

Open http://localhost:3000

## Demo walkthrough

1. Drag in 3–5 screenshots (assignments, a calendar, a group chat).
2. Hit **Analyze**. Watch the staged progress indicator.
3. Read the summary, then tasks, deadlines, events, and detected conflicts.
4. Click any item's source chip to open the originating image.
5. Open the **Action Plan** — this is the deterministic planner's output.
6. Ask the assistant: *"What should I do first?"* and
   *"Is there anything I'm double-booked for?"*

## Security

Gemma credentials stay server-side. The browser talks only to FastAPI; FastAPI
is the sole caller of the Gemini API. `.env` and `.env.local` are gitignored and
only `.env.example` files are committed.

## Scope

Deliberately out of scope: database, RAG/embeddings, multi-agent orchestration,
background queues, and LangSmith. Planning and conflict detection are plain
Python. See `SPEC.md` for the full contract.