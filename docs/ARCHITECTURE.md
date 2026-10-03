# Architecture

Why the boundaries sit where they do. [`SPEC.md`](../SPEC.md) says what the
system does; this file explains the decisions behind it.

## The one idea worth defending

The product's real capability is **cross-image reasoning**. Four screenshots of
four different sources are sent to Gemma in a single request, and the model finds
relationships between them that no single image contains. That is the thing
that cannot be precomputed, and it is why Gemma is load-bearing rather than
decorative.

Everything after extraction is the opposite: arithmetic on facts. Keeping those
two concerns in different layers is the central architectural decision.

## Layer 1 — The browser holds no AI

```text
Next.js  →  FastAPI  →  LangChain  →  Gemma
```

The browser calls only FastAPI. There is no AI SDK in `frontend/package.json`,
no key in any client bundle, and no code path that reaches Gemini from the
client. The frontend's entire AI surface is two functions in `lib/api.ts`.

This is a security boundary, not an architectural preference. A
`NEXT_PUBLIC_` variable is inlined into the shipped bundle, so any credential
there is public.

## Layer 2 — `llm.py` is the only door to the model

```text
llm.py
  ├── create_model()           constructs ChatGoogleGenerativeAI
  ├── create_analysis_chain()  multimodal, structured output
  ├── create_chat_chain()      text over the analysis
  └── analyze_images()         two attempts, then give up
```

Nothing else imports `ChatGoogleGenerativeAI`. Swapping providers is a
single-file change, and searching for model construction returns one hit.

The model identifier is read from `GEMMA_MODEL` in `config.py` and appears
nowhere else. Duplicating it would mean two places to update when the model
changes.

### Structured output is harder than it looks

Gemma is not a Gemini model, and the obvious approach does not work. Three
findings from the installed packages, each of which broke the happy path:

1. **`with_structured_output` defaults to `method="json_schema"`, and
   `json_mode` is the same code path.** Both bind Gemini's strict
   `response_json_schema` parameter. Gemma does not implement it.

2. **`function_calling` silently drops `$defs`.** Google's schema validator warns
   `Key '$defs' is not supported in schema, ignoring` and continues. Because
   `LifeOSAnalysis` nests `Task`, `Event`, and `Deadline`, every nested model
   would vanish from the tool schema and the response would not validate.

3. **Braces in a prompt template are placeholders.** The first attempt embedded
   the JSON schema by string concatenation into a `ChatPromptTemplate`. The
   schema is full of `{` and `}`, so LangChain tried to parse them and every
   fallback died with *Nested replacement fields are not allowed*. The fallback
   path could never have run.

The resolution: `prompt_json` embeds the schema as a **template variable**
(which substitutes without reparsing) and asks for
`response_mime_type="application/json"`, then validates with Pydantic. It
depends only on the most widely supported mechanism. Function calling is the
second attempt, not the first.

### Multimodal format

LangChain v1 content blocks:

```python
{"type": "image", "base64": ..., "mime_type": "image/png"}
```

The older `image_url` format still works in `langchain-google-genai`, but it is
explicitly a compatibility branch in the source. Using the v1 format means
following the current path rather than the deprecated one.

All images go into **one** `HumanMessage`. The blocks are baked into the
template at chain-construction time because a list variable does not survive
template interpolation, it gets stringified into a text block. Scalar variables
do interpolate correctly inside a text block, which is how the schema is
attached.

### Two attempts, no retry middleware

```text
attempt 1  prompt_json
attempt 2  function_calling
failure    → 502
```

A plain loop. No backoff library, no queue, no middleware. If both fail the
caller gets a 502 and a log line.

## Layer 3 — The planner never asks the model

`planner.py` contains **zero** model calls. This is the constraint that keeps
the action plan honest.

If the model chose priorities, it could assert that a task due in three weeks
outranks one due tomorrow. Deterministic code cannot. It sorts by priority band,
then nearest deadline, then title for stability, and a stated priority can be
raised by the clock but never lowered.

Conflict detection is four rules: event/event time overlap, an event landing on
a deadline's day, two or more deadlines inside 24 hours, and a task falling due
after the deadline it feeds.

### One deduplication rule that matters

Gemma commonly reports the same obligation twice, once as a task (*"Write ML
report"*) and once as a deadline (*"ML report"*). Listing both reads as padding
and buries the real work. `_collapse_duplicates` keeps the task, since it
carries the description, and lends it the deadline's date so urgency survives.

### Conflicts come from both places, on purpose

Deterministic rules are authoritative for anything computable. Model-reported
conflicts are merged in too, because the model catches semantics the rules
cannot — that "prep exam" and "final exam" refer to the same night.

## Layer 4 — Chat reasons over facts

The chat chain receives the structured analysis as JSON. Never the images.

```text
user question + LifeOSAnalysis  →  answer + source filenames
```

This keeps chat cheap and prevents the model from re-reading images and
re-deriving facts that could contradict the plan the user is already looking
at. The prompt requires it to distinguish facts from recommendations and to say
so when the sheet does not contain enough.

## Frontend state

```text
EMPTY → READY → ANALYZING → RESULT
                   ↓
                 ERROR
```

Derived from component state, never stored. A stored status can disagree with
the state it describes; this one cannot.

**No database.** A refresh clears the session. For a tool whose input is a pile
of screenshots, persistence would add a schema, migrations, and an upload
lifecycle to save state the user will not miss.

### Design direction

The interface is a **photographic contact sheet**: cool paper ground, hairline
rules dividing sections, frames numbered as film frames are, a sprocket edge,
and grease pencil reserved exclusively for conflicts.

That last rule is the load-bearing one. Priority is otherwise carried by ink
density and weight, so the one genuinely alarming thing on the sheet is the only
thing wearing colour. Rows are separated by hairlines rather than boxed into
identical cards, because identical boxes flatten the hierarchy that makes a
sheet scannable.

Frames are cited by number the way a caption cites its frames, and every
citation opens the source image. Being able to check an extraction against the
screenshot it came from is what makes the output trustworthy rather than
merely plausible.

## Request lifecycle

```text
POST /api/analyze  multipart, files[]

  1. validate count, MIME type, per-file size, total size
       └─ fail → 400, no model call spent
  2. base64-encode into v1 image blocks
  3. build one HumanMessage: instruction + every image + JSON schema
  4. invoke chain  (temperature 0, ≤2 attempts)
       └─ fail → 502
  5. planner: detect conflicts, rebuild plan, collapse duplicates
  6. validate against LifeOSAnalysis
  7. return { success, analysis }
```

Steps 5 and 6 are cheap and guarantee two things: the plan is arithmetic, and
the response body provably matches its schema.