# Drills

A desktop app for learning syntax by spaced drills: short lessons, tiny auto-checked exercises,
and reviews that come back right before you forget. You edit the content by chatting with Claude
from inside the app.

Courses so far:
- **Python syntax for LeetCode**: 19 pages, 115 skills.
- **PyTorch for interviews**: Core (tensors → a full training loop with clipping, schedulers and
  init) and Advanced (norms, attention, transformer blocks, AMP, fine-tuning, sampling).

## Run it

```bash
cd desktop && npm install && npm start      # the app window
cd desktop && npm run build                 # → desktop/dist/mac*/Drills.app (drag to Applications)
```

Or without Electron: `python3 serve.py`, then open the printed URL.

Exercises run on your machine, in the Python set in `config.json` (it needs `torch` and `pyyaml`):

```json
{ "python": "/opt/miniconda3/envs/basic_env/bin/python" }
```

## Using it

- **Courses → a course → Start.** Each session mixes due reviews, one new page, and re-checks
  of what you just learned.
  - A new page goes lesson screen (2–3 skills) → exercise screen (their 2–3 cards).
  - Reviews come 2–3 cards per screen. ⌘↵ runs a card; Enter continues.
- **Grades are automatic:** clean = first try, struggled = a retry or a lesson peek, missed =
  "I don't know". You can override any grade.
- **Spacing:** each skill climbs boxes (1, 3, 7, 16, 35 days) and is then mastered. A miss brings
  the lesson back right away, with extra practice.
- **Per skill:** *Too basic · remove*, *I know it · review later*, *Mastered*, *Practice next session*.
- **Per page:** *Read*, *Learn now*, *Test out*, *I already know this page*.

## Adding or editing content: just ask

Click **✎ Edit with Claude** (or **✎ Edit** on any skill during a session) and write what you want:

- "Add a page on PyTorch hooks with 4 skills"
- "This lesson is too long, cut it to 4 lines"
- "Card b of this skill is too easy, make it about `padding_idx`"
- "Create a new course: SQL window functions for interviews"

The app runs Claude Code (`claude -p`, with your account) in this folder. Claude follows
[CLAUDE.md](CLAUDE.md), edits the YAML, runs the validator, and the app reloads. The chat keeps
the conversation, so you can follow up ("shorter", "add one more card"). Click **New chat** to start over.

## Questioning a card

Every card has **⚑ Question this**. Write what looks wrong ("my answer should be accepted", "the
prompt is ambiguous", "why this way?"). Claude then:
- runs your code against the card and explains in a few sentences;
- fixes the card if it is at fault, after which the card shows **↻ Card updated: retry it**;
- logs a report in `feedback/reports.md`. Raw requests also go to `feedback/questions.jsonl`.

These reports are read later to improve the content and the app.

## Files

```
content/courses/<course>/course.yaml        page order (flat, or grouped in parts)
content/courses/<course>/chunks/<page>.yaml lessons + cards (format: docs/course-design.md)
progress.json                               your progress (delete to start over)
config.json                                 which Python runs the exercises
tools/validate.py                           checks every card: solution passes, empty starter fails
```

The old knowledge-map view (`content/atoms`, `blobs`, `domains`, and the map/outline JS views) is
no longer part of the app.
