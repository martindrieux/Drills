# Drills: content authoring guide

This folder is a personal drill app. Content is plain YAML under `content/courses/`. When the user asks
(often from the in-app chat) to add, edit, shorten, or reorganize lessons, you edit those files.

## Where things live

```
content/courses/<course-id>/course.yaml        title, summary, page order (flat `chunks:` or grouped `parts:`)
content/courses/<course-id>/chunks/<page>.yaml one page = a few skills, each with a short lesson + 3 cards
docs/course-design.md                          the full schema and the learning rules
```

Existing courses: `python-syntax` (Python for LeetCode), `pytorch` (PyTorch for interviews, parts Core / Advanced / Interview — the
Interview part is tricks + "implement X from scratch" problems; its cards may be full functions/modules, checked
against the built-ins)
and `patterns` (LeetCode patterns: each skill's `teach` is a bare abstract skeleton + "Use when:" + "Cost:", 2 cards).
Good examples to imitate: `content/courses/python-syntax/chunks/heaps.yaml`, `content/courses/pytorch/chunks/init.yaml`.
(`content/atoms`, `blobs`, `domains` belong to an old map view. Ignore them unless asked.)

## Page format (summary — see docs/course-design.md)

```yaml
id: heaps                      # = file name
title: Heaps with heapq
intro: |                       # 1–3 sentences: what this unlocks
problems: [Kth Largest Element in an Array, ...]   # where it is used
atoms: []
skills:
  - id: heaps.push-pop         # unique, prefixed with the page id; never rename an existing id (progress is keyed on it)
    name: heappush / heappop / peek
    teach: |                   # SHORT: the syntax in a small code block + one pitfall (3–10 lines)
    cards:                     # exactly 2: a = covers every item taught, b = one review card in a different context (not a subset/copy of a)
      - id: a
        prompt: One or two sentences. Name the variable/function to produce.
        setup: |               # optional, shown read-only, runs first (imports, given data, helper classes)
        starter: |             # optional, prefilled in the editor
        solution: |
        check: |               # hidden asserts with value-showing messages: assert res == 3, f"res = {res!r}"
```

Rules:
- Every piece of syntax mentioned in a `teach` (function, method, argument, variant like `lstrip`/`rstrip`)
  must be explained: say what it takes and what it returns/does, with a one-line example and its output.
  Never mention something only in passing ("also lstrip / rstrip") without defining it.
  Put each definition directly above its examples (e.g. `# s.find(sub) -> int: index of first match, or -1`),
  not as a separate list followed by a code block.
- **Lean, not verbose** (the learner skips long text). Each `# definition` is ONE comment line: the call, what it
  takes and what it returns, with shapes, e.g. `# t.gather(dim, index) -> shape of index; out[i][j] = t[i][index[i][j]]`.
  Annotate the example with shapes (`# (2, 3) -> (2, 1)`) and its output. No "goal:" lines, no restating the
  same rule in words, no second comment line unless a shape rule truly needs it. Target a teach of ~6–10 code lines.
  For algorithms / "from scratch" skills: one sentence of what is computed, the formula, then code with the shape
  of each intermediate in a short comment. No unexplained jargon or abbreviations.
- Card prompts are **a real, self-contained task, stated briefly** (not a label, not a bare signature):
  1. one imperative sentence saying what to implement/compute ("Implement the Conv2D backward pass with loops.");
  2. a bullet per input: `` `name` (shape): meaning `` (skip variables already defined in the setup);
  3. a bullet per output: `` returns `name` (shape, dtype): meaning ``, with the formula when it defines the task
     (`out[b, co, y, x] = b[co] + Σ ...`); never define the task only as "same as `F.xxx`" (you may add it as a cross-check);
  4. conventions / allowed / banned only when they matter ("loops allowed", "no Python loops", "mask True = keep").
  No `Given:` / `Checked on:` boilerplate, no hints, never several tasks glued with "·". Usually 3–6 short lines.
- Every syntax/trick taught in a `teach` must be exercised by **card `a`** (the only card shown right after
  the lesson). Combine several items in it. Each item is tested **once**: add only one other card (for reviews),
  and it must not be a subset or a same-items-new-values copy of `a`. No two skills teach the same thing.
- Leave out niche content (rarely used arguments, perf knobs, obscure variants): only what interviews actually use.
- Lessons are **minimal**: each syntax/idea appears **once**, as a `# definition` comment + one example
  with its output. No prose that repeats what the code comments say, no second example of the same thing,
  no worked loop when a one-liner shows the syntax. At most one pitfall line.
- Cards then go **slightly further** than the lesson: card `a` is the direct recall, `b`/`c`… use the
  syntax on other values, other options, or combined with earlier syntax. Still tiny (1–4 lines), not puzzles.
- Exception, algorithm templates (binary search, BFS, reverse a list…): cards ask for the **full algorithm**
  (write the whole function, checked on several inputs incl. edge cases), never one step or a fragment of it.
- **Cards where the learner writes a function must have strong checks** (wrong solutions must not pass):
  `from cardtest import against, rand_cases` (tools/cardtest.py), a hidden `_ref` written in the check
  (prefer a simple brute force, not a copy of the solution), hand-picked edge cases (empty, single element,
  duplicates, negatives, ties, boundaries) **plus ≥ 200 seeded random cases** via `rand_cases(_gen, n)`.
  Use `same=` for order-insensitive results and `show=` to print trees / linked lists readably.
  Before finishing, run ≥ 3 plausible WRONG solutions per card (off-by-one, missed edge case, wrong tie rule,
  mutating input…) through `tools/try_card.py` and make sure each one FAILS.
- The check must FAIL when run on `setup` + `starter` alone, and PASS with `solution`.
- Cards run in CPython from `config.json` (it has torch). Keep them fast (< 1 s) and deterministic (`torch.manual_seed`).
- Quote YAML strings containing `: `, or use `|` blocks. No tabs.
- New page: create the file AND add its id to the course's `chunks` / `parts` list in `course.yaml`.
- New course: create `content/courses/<id>/course.yaml` (id, title, blob: python-toolkit, summary, chunks or parts) plus its pages.
- Removing a skill: prefer deleting it from the YAML; changing a skill's content keeps the learner's progress.

## Always validate

After any change, run `python3 tools/validate.py <page ids you touched>` and fix every error in your files
("chunk ... has no file" errors for pages you did not touch can be ignored only if they pre-existed).

## When the learner questions a card

The app sends a message ending with `[The learner is questioning an exercise card ...]`, with the card's file,
skill id, card id, the learner's code and the result they saw. Then:

1. Read the card (prompt, setup, starter, solution, check) and the skill's `teach`.
2. Run the learner's code against the card when it helps:
   `python3 tools/try_card.py <course> <page> <skill-id> <card-id> <<'EOF'` … `EOF` (prints PASS / FAIL).
3. Answer the learner in 2–5 sentences: explain the point they are unsure about, and say plainly whether their
   answer was right, partly right, or wrong.
4. If the card is at fault (check too strict or wrong, prompt ambiguous, solution wrong, lesson misleading),
   **fix it now** in the YAML, keeping all ids. A correct alternative answer should pass: confirm with
   `try_card.py` on the learner's code. Then run `python3 tools/validate.py <page>`.
5. **Always** append one entry to `feedback/reports.md` (create it if missing), in this format:

   ```
   ## <YYYY-MM-DD> · <course> / <skill-id> / card <card-id>
   - Concern: <the learner's point, one line>
   - Verdict: card-bug | too-strict | unclear | lesson-gap | learner-misunderstanding | app-bug
   - Change: <what you edited, or "none">
   - App idea: <optional: anything about the app itself that would have avoided this>
   ```

   These reports are read later to improve the content and the app. Raw requests are also logged
   automatically in `feedback/questions.jsonl`.

## Reply style (the user reads your reply in a small chat panel)

When done, reply in 1–3 short sentences: what you added or changed (page / skill names) and the validation
result. No long explanations, no code dumps.
