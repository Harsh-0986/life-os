# LifeOS

Lay your screenshots on one sheet. Gemma reads every frame at once, marks what
is due, and circles the clashes. The order comes out of Python, not out of the
model.

## Documentation

| Document | Read it for |
| --- | --- |
| [`../README.md`](../README.md) | What this is, how to run it, the API surface |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Why the boundaries sit where they do |
| [GETTING_STARTED.md](GETTING_STARTED.md) | File-by-file tour and the rules worth not breaking |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Workflow, checks, and the traps that will bite you |
| [`../SPEC.md`](../SPEC.md) | The engineering contract this implements |

## If you read one thing

The extraction is a model call. The plan is arithmetic.

Gemma reads all the images together and returns facts. `planner.py` then
replaces the plan and the conflicts with its own deterministic output. That
boundary is what stops the action plan from inventing a deadline you never had,
and it should not be moved.