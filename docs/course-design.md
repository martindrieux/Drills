# Courses: learn a blob in chunks, keep it with spaced drills

A **course** turns one blob into a guided path. The first one is *Python syntax for LeetCode*.
It covers the syntax needed for the ~75 most common LeetCode problems (Blind 75 / NeetCode 150 core).

## The pieces

```
Course   python-syntax                     one per blob (for now: Python toolkit)
 └─ Chunk  "Heaps with heapq"              ≈ one page of knowledge, 4–7 skills
     └─ Skill  heap.max-negate             the unit that is scheduled and mastered
         ├─ teach   (3–10 lines of lesson)  shown inline when learning, re-shown when you slip
         └─ cards   a, b, c                 1–3 line exercises, auto-checked. Variants of the same skill
```

- The **chunk** is the reading unit: its skills' `teach` blocks in order make one short page.
- The **skill** is the memory unit. Everything about scheduling and mastery happens per skill.
- **Cards** are variants of one skill. Card `a` is the simplest and is used the first time;
  `b`, `c`… are used for reviews, so a retry is never the exact same question twice in a row.

## A session

When you press **Start session**, the engine builds one queue:

1. **Warm-up**: half of the reviews that are due (skills you learned before).
2. **New chunk** (if your backlog is small): for each skill, the teach block is followed by card `a`.
   This is the interleaved "short class, then practice".
3. **Mix**: the other half of the due reviews, interleaved with **re-checks** of the skills you just
   learned, using a different card. This retrieves what you just saw after a short delay.

Lessons stay hidden during reviews and re-checks ("Peek at the lesson" is one click away, but peeking
caps the grade at *struggled*).

## Grading (automatic, overridable)

| What happened | Grade |
|---|---|
| Passed on the first Run, no peek | **clean** |
| Passed after a failed run, or after peeking | **struggled** |
| "I don't know" / revealed the solution | **failed** |

You can override a grade after the fact ("I knew it, that was a typo" / "I guessed").

## Scheduling: boxes

Each skill sits in a box 0–5. A box sets how long until the next review:

| box | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| next review | next session | 1 day | 3 days | 7 days | 16 days | 35 days | **mastered → retired** |

- **Clean**: box + 1. Reaching 6 means the skill is **mastered and phased out**. It no longer
  appears unless you bring it back.
- **Struggled**: box stays, review again tomorrow.
- **Failed**: box → 0. The lesson **comes back**: later in the same session you get a *relearn*
  (teach block + another card) and an extra practice card. It stays in box 0 (every session)
  until it is clean again.

## Your controls

- **Session settings**: new chunks per session (0 = review only, 1, 2) and the review cap.
- **Per chunk**: *Learn now* (that chunk only), *Test out* (one card per skill; clean skills
  jump to box 3), *Read* (the page with all its exercises, no scheduling).
- **Per skill** (on lesson screens, exercise cards and the course page):
  - *Too basic · remove*: never shown again and not counted. *Restore* it from the course page.
  - *I know it · review later*: skip ahead to box 4 (next review in ~16 days), then the normal ladder.
  - *Mastered*: stop reviewing entirely. *Bring back* undoes it.
  - *Practice next session*, *Reset*.

## Screens

A session goes screen by screen, never more than 3 things at a time:
- **New skills**: a lesson screen covering 2–3 skills, then one exercise screen with their cards.
- **Reviews, re-checks and extra practice**: exercise screens of 2–3 cards, each graded on its own.
  The lesson is a "peek" away.
- **After a miss**: the next screen is the refresher lesson, followed by the retry.

## Content files

```
content/courses/<course-id>/course.yaml       title, blob, chunk order
content/courses/<course-id>/chunks/<id>.yaml  one chunk
```

```yaml
# course.yaml
id: python-syntax
title: Python syntax for LeetCode
blob: python-toolkit
summary: …
chunks: [lists, loops, strings, …]           # learning order
```

```yaml
# chunks/heaps.yaml
id: heaps
title: Heaps with heapq
intro: |                       # 1–3 sentences: what this unlocks
  …
problems: [Kth Largest Element in an Array, Top K Frequent Elements]   # where you'll need it
atoms: [py-heapq]              # related map atoms (optional)
skills:
  - id: heaps.push-pop         # globally unique, prefixed with the chunk id
    name: heappush / heappop / peek
    teach: |                   # SHORT markdown: the syntax + one pitfall
      …
    cards:                     # ≥ 3 variants; card[0] is the simplest
      - id: a
        prompt: …              # one or two sentences; name the variable to produce
        setup: |               # optional, shown read-only, runs first
        starter: |             # optional, prefilled in the editor
        solution: |
        check: |               # hidden asserts; message shows the value
```

`python3 tools/validate.py` checks the courses too: every solution passes, no check passes on the
untouched starter, ids are unique, and every skill has ≥ 2 cards.
