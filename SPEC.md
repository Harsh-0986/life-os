# LifeOS — Engineering Contract

**Contract Version:** 1.1.0  
**Spec Version:** 1.0.0  
**Project Type:** 3-hour hackathon MVP  
**Implementation Window:** 2 hours  
**Refinement Window:** 1 hour

---

# 1. Purpose

This document defines the non-negotiable engineering contract for implementing LifeOS.

The implementation agent MUST follow this contract together with `spec.md`.

If there is a conflict:

```text
Engineering Contract
        ↓
MVP Spec
        ↓
Implementation preference
```

The contract takes precedence.

---

# 2. Product Contract

LifeOS MUST implement this workflow:

```text
Multiple images
      ↓
LangChain
      ↓
Gemma 4
      ↓
Structured extraction
      ↓
Deterministic planning
      ↓
Conflict detection
      ↓
Action plan
      ↓
User questions
      ↓
LangChain + Gemma 4
```

The project MUST demonstrate that Gemma 4 is an important part of the actual product.

---

# 3. Technology Contract

## Frontend

MUST use:

```text
Node.js 22 LTS
Next.js 16.x
React 19.x
TypeScript 5.x
Tailwind CSS 4.x
pnpm 10.x
```

Next.js App Router MUST be used.

---

## Backend

MUST use:

```text
Python 3.12.x
FastAPI
Pydantic 2.x
Uvicorn
LangChain
LangChain Google GenAI integration
```

---

## AI

MUST use:

```text
Gemma 4
Gemini API
LangChain
```

The exact model identifier MUST be configured through:

```env
GEMMA_MODEL=
```

The model identifier MUST NOT be duplicated throughout the codebase.

---

# 4. LangChain Contract

LangChain is a REQUIRED dependency.

The AI integration MUST be implemented through LangChain rather than directly calling the Gemini HTTP API.

Expected flow:

```text
FastAPI
   ↓
LangChain
   ↓
ChatGoogleGenerativeAI
   ↓
Gemma 4
   ↓
Structured output
```

Use the current LangChain Google GenAI integration compatible with the installed LangChain version.

Do not mix direct Gemini SDK calls with LangChain for the same analysis flow.

---

# 5. Required LangChain Components

The implementation SHOULD use:

```text
ChatGoogleGenerativeAI
ChatPromptTemplate
Pydantic structured output
Runnable / LCEL composition where useful
```

A minimal implementation is preferred.

---

# 6. LangChain Model Configuration

Conceptually:

```python
from langchain_google_genai import ChatGoogleGenerativeAI

llm = ChatGoogleGenerativeAI(
    model=settings.gemma_model,
    temperature=0,
)
```

The exact constructor/options MUST follow the installed package version.

Do not copy deprecated LangChain APIs blindly.

---

# 7. Structured Output Contract

The model MUST return structured data.

Use Pydantic models:

```python
class Task(BaseModel):
    title: str
    description: str | None = None
    deadline: str | None = None
    priority: Literal["high", "medium", "low"]
    source: str
```

```python
class Event(BaseModel):
    title: str
    date: str | None = None
    time: str | None = None
    location: str | None = None
    source: str
```

```python
class Deadline(BaseModel):
    title: str
    date: str
    source: str
```

```python
class Conflict(BaseModel):
    title: str
    explanation: str
    related_items: list[str]
    severity: Literal["high", "medium", "low"]
```

```python
class PlanItem(BaseModel):
    order: int
    action: str
    reason: str
    priority: Literal["high", "medium", "low"]
    deadline: str | None = None
```

```python
class LifeOSAnalysis(BaseModel):
    summary: str
    tasks: list[Task]
    events: list[Event]
    deadlines: list[Deadline]
    conflicts: list[Conflict]
    plan: list[PlanItem]
```

---

# 8. Recommended LangChain Model Flow

The primary analysis should be implemented approximately as:

```text
Images
   ↓
HumanMessage
   ↓
ChatPromptTemplate
   ↓
ChatGoogleGenerativeAI
   ↓
with_structured_output(LifeOSAnalysis)
   ↓
LifeOSAnalysis
```

The model MUST receive all images in the same analysis request.

This is critical.

The project is demonstrating multimodal cross-image reasoning.

---

# 9. Multimodal Message Contract

The LangChain message MUST contain:

```text
Text instructions
+
Image 1
+
Image 2
+
Image 3
...
```

Conceptually:

```python
HumanMessage(
    content=[
        {
            "type": "text",
            "text": ANALYSIS_PROMPT,
        },
        {
            "type": "image_url",
            "image_url": {
                "url": image_data_url
            },
        },
    ]
)
```

The exact content format MUST follow the currently installed LangChain Google GenAI integration.

Do not assume an outdated multimodal format if the installed version documents another format.

---

# 10. Prompt Contract

Use a dedicated:

```text
backend/app/prompts.py
```

The primary prompt MUST communicate:

```text
You are LifeOS, a multimodal personal planning assistant.

Analyze ALL provided images together.

Extract:
- tasks
- deadlines
- events
- important dates
- potential conflicts

Every extracted item must include its source filename.

Do not invent information.

Do not invent dates.

Do not invent deadlines.

Do not invent tasks.

Do not use outside knowledge.

If information is ambiguous, preserve the ambiguity.

After extraction, create a practical prioritized plan.

Return structured output matching the LifeOSAnalysis schema.
```

---

# 11. Temperature

For the primary analysis:

```text
temperature = 0
```

The purpose is reliable extraction rather than creative generation.

For chat:

```text
temperature = 0.2
```

if supported by the selected model/integration.

---

# 12. Retry Contract

Maximum AI analysis attempts:

```text
2
```

Flow:

```text
LangChain
   ↓
Gemma
   ↓
Structured output validation
   │
   ├── SUCCESS → continue
   │
   └── FAILURE
          ↓
       retry once
          ↓
       failure
          ↓
       API error
```

There MUST NOT be an infinite retry loop.

---

# 13. LangChain Retry Constraint

Do not create complex retry middleware.

A simple explicit retry is sufficient:

```python
for attempt in range(2):
    try:
        result = chain.invoke(...)
        return result
    except Exception:
        if attempt == 1:
            raise
```

Do not introduce:

```text
Redis
Celery
RabbitMQ
Temporal
background queues
```

---

# 14. Chat Contract

Chat MUST also use LangChain.

Flow:

```text
User question
      +
LifeOSAnalysis
      ↓
ChatPromptTemplate
      ↓
ChatGoogleGenerativeAI
      ↓
Answer
```

The chat model MUST NOT receive raw images.

It receives the structured analysis generated during the initial analysis.

---

# 15. Chat Prompt

Use:

```text
You are the LifeOS assistant.

Answer the user's question using ONLY the
structured information provided.

Do not invent information.

If the information is insufficient,
say that you don't have enough information.

Clearly distinguish facts from recommendations.

Structured LifeOS information:

{analysis}

User question:

{question}
```

---

# 16. LangChain Abstraction

Create:

```text
backend/app/llm.py
```

Responsibilities:

```text
Create Gemma model
Create analysis chain
Create chat chain
```

Example architecture:

```text
llm.py
   │
   ├── create_model()
   │
   ├── create_analysis_chain()
   │
   └── create_chat_chain()
```

The rest of the application MUST NOT instantiate the model directly.

---

# 17. AI Provider Architecture

Do not build a large provider abstraction for the hackathon.

Use:

```text
llm.py
```

as the single AI integration point.

Future providers can be added later.

The MVP only supports:

```text
Gemma 4
```

---

# 18. Planner Contract

Planning remains deterministic Python.

LangChain MUST NOT be used for basic priority calculations.

Example:

```text
Gemma
 ↓
Facts
 ↓
Python planner
 ↓
Priority
 ↓
Conflict detection
 ↓
Plan
```

This reduces hallucinations.

---

# 19. Conflict Detection

Implement deterministic checks for:

```text
Event/event overlap
Event/deadline overlap
Multiple high-priority deadlines within 24 hours
Potential scheduling conflicts
```

Do not use another LLM call for these calculations.

---

# 20. API Contract

Required endpoints:

```text
POST /api/analyze
POST /api/chat
```

No database is required.

---

# 21. Analyze Endpoint

```http
POST /api/analyze
Content-Type: multipart/form-data
```

Field:

```text
files[]
```

Limits:

```text
Maximum files: 5
Maximum file size: 10 MB
Maximum request size: 30 MB
```

Supported:

```text
PNG
JPEG
WEBP
```

---

# 22. Analyze Response

```json
{
  "success": true,
  "analysis": {
    "summary": "...",
    "tasks": [],
    "events": [],
    "deadlines": [],
    "conflicts": [],
    "plan": []
  }
}
```

The backend MUST validate the response before returning it.

---

# 23. Chat Endpoint

```http
POST /api/chat
```

Request:

```json
{
  "question": "What should I do first?",
  "context": {
    "tasks": [],
    "events": [],
    "deadlines": [],
    "conflicts": [],
    "plan": []
  }
}
```

Response:

```json
{
  "answer": "...",
  "sources": []
}
```

---

# 24. Security Contract

Gemma credentials MUST remain server-side.

Correct:

```text
Next.js
   ↓
FastAPI
   ↓
LangChain
   ↓
Gemma
```

Never:

```text
Next.js
   ↓
Gemma
```

The following MUST NOT be committed:

```text
.env
.env.local
API keys
tokens
credentials
```

---

# 25. Environment Variables

Backend:

```env
GEMINI_API_KEY=
GEMMA_MODEL=
CORS_ORIGIN=http://localhost:3000
```

Frontend:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

The model name MUST come exclusively from:

```env
GEMMA_MODEL
```

---

# 26. Dependencies

Backend minimum:

```text
fastapi
uvicorn
pydantic
python-multipart
langchain
langchain-google-genai
```

Do not add:

```text
langgraph
langsmith
chromadb
faiss
sqlalchemy
redis
celery
```

unless there is remaining time after the complete MVP works.

---

# 27. LangGraph Decision

**LangGraph is NOT required for the MVP.**

Although LifeOS is an agentic-style workflow, the 3-hour constraint makes LangGraph optional.

If the core MVP is complete before the 2-hour deadline, a minimal LangGraph wrapper MAY be added:

```text
START
  ↓
ANALYZE
  ↓
PLAN
  ↓
END
```

Nothing more.

LangGraph MUST NOT delay:

```text
Gemma integration
image upload
structured extraction
planning
results UI
```

---

# 28. Frontend Contract

Frontend:

```text
Next.js 16
React 19
TypeScript
Tailwind CSS
```

Required components:

```text
UploadZone
ImagePreview
AnalysisProgress
TaskCard
DeadlineCard
ConflictCard
PlanCard
SourcePreview
ChatPanel
```

---

# 29. UI States

```text
EMPTY
READY
ANALYZING
RESULT
ERROR
```

During analysis:

```text
✓ Images received
✓ Understanding context
→ Extracting information
○ Detecting conflicts
○ Building action plan
```

These are UI states, not separate LangChain calls.

---

# 30. Source Contract

Every extracted object MUST retain:

```text
source filename
```

Example:

```json
{
  "title": "Submit ML project",
  "deadline": "2026-10-08",
  "priority": "high",
  "source": "assignment.png"
}
```

The frontend MUST allow the user to view the source image.

---

# 31. Performance Contract

Target:

```text
<30 seconds
```

for a normal 3–5 image analysis request.

Primary analysis:

```text
1 LangChain → Gemma call
```

Maximum retry:

```text
1 additional call
```

Chat:

```text
1 LangChain → Gemma call
```

---

# 32. No Database

The MVP MUST NOT use a database.

State exists in:

```text
React state
+
current API request
```

A page refresh may clear the current session.

This is acceptable for the hackathon.

---

# 33. No RAG

RAG is explicitly OUT OF SCOPE.

Do not add:

```text
Embeddings
Vector database
Document chunks
Retrieval chains
Semantic search
```

The uploaded images are directly analyzed by Gemma.

---

# 34. No Multi-Agent Architecture

The application MUST NOT create separate agents for:

```text
Researcher
Planner
Critic
Writer
```

For this MVP:

```text
Gemma
+
Deterministic Python planner
```

is sufficient.

---

# 35. 2-Hour Implementation Schedule

## 00:00–00:15

Install:

```text
LangChain
langchain-google-genai
FastAPI
Pydantic
Next.js
```

Verify:

```text
FastAPI
 ↓
LangChain
 ↓
Gemma
```

with one image.

---

## 00:15–00:40

Implement:

```text
schemas.py
prompts.py
llm.py
```

Get:

```text
image
 ↓
Gemma
 ↓
LifeOSAnalysis
```

working.

---

## 00:40–01:00

Implement:

```text
planner.py
```

Add:

```text
priority
deadline ordering
conflict detection
```

---

## 01:00–01:30

Build:

```text
Upload UI
Image previews
Analyze button
Results
```

---

## 01:30–01:45

Add:

```text
Tasks
Deadlines
Events
Conflicts
Action Plan
```

---

## 01:45–02:00

Implement:

```text
Chat
```

Verify complete flow.

---

# 36. Final Hour

Only:

```text
UI polish
Prompt refinement
Error handling
Demo reliability
README
Screenshots
```

No architecture changes.

---

# 37. Acceptance Test

The following MUST work:

```text
4 screenshots
      ↓
Next.js
      ↓
FastAPI
      ↓
LangChain
      ↓
Gemma 4
      ↓
LifeOSAnalysis
      ↓
Python planner
      ↓
Action plan
      ↓
Chat
```

The complete demo must work from a clean startup.

---

# 38. Final Architecture

```text
                    ┌───────────────────┐
                    │     Next.js       │
                    │    React 19       │
                    │   TypeScript      │
                    └─────────┬─────────┘
                              │
                              │ HTTP
                              ▼
                    ┌───────────────────┐
                    │     FastAPI       │
                    │     Python        │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │     LangChain     │
                    │                   │
                    │ ChatPromptTemplate│
                    │ Structured Output│
                    │ LCEL / Runnable  │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │      Gemma 4      │
                    │    Gemini API     │
                    │    Multimodal     │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  LifeOSAnalysis   │
                    │     Pydantic      │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │ Python Planner    │
                    │                   │
                    │ Priority          │
                    │ Deadlines         │
                    │ Conflicts         │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │    Action Plan    │
                    └───────────────────┘
```

---

# 39. Engineering Principle

The implementation must demonstrate:

```text
Gemma 4
   +
LangChain
   +
Multimodal reasoning
   +
Deterministic planning
   +
Useful UX
```

Do not add infrastructure merely to make the architecture look sophisticated.

**The goal is a working multimodal AI product in 2 hours, not a production platform.**
