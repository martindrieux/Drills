# Brief: rewrite card prompts as real tasks (prompt text only)

Drills app: `/Users/martindrieux/Drills`. Read the "Card prompts" rule in `CLAUDE.md`.
The learner said prompts are "super under specified (not even questions very often)": an earlier lean pass turned them
into bare signatures / labels (`` `f(x)` -> (B,): ... ``, "Part A, write:", "With `gather` (see setup):").
Fix: each prompt is a **real, self-contained task, stated briefly**. Test: could someone solve it from the prompt
(plus the visible setup) alone, without knowing which library function it is checked against?
SPEED MATTERS: this is a text edit, not a redesign.

## Format

1. One imperative sentence saying what to implement / compute ("Implement top-p sampling.", "Use `gather` to pick one
   value per column of `t`.", "Write a function that standardizes the columns of a matrix.").
2. A bullet per input: `` `name` (shape, dtype): meaning ``. For value cards whose inputs are defined in the visible
   setup, don't re-list them; name them in the sentence.
3. A bullet per output: `` returns `name` (shape, dtype): meaning `` for functions, `` `name` (shape): meaning `` for
   values to set, with the formula when it defines the task (`out[b, k] = x[b, idx[b, k]]`). Never define the task
   only as "same as `F.xxx`" (you may add it as a cross-check).
4. Conventions / allowed / banned only when the check enforces them ("no Python loops", "ties -> lowest index",
   "don't modify `x`", "mask True = keep").
No `Given:` / `Checked on:` boilerplate, never several tasks glued with "·". Usually 3–6 short lines. Keep the prompt
brief: don't add explanations, background or hints that aren't needed to pin down the task.

Problem-style pages (`tricks-*`, `np-attention`): KEEP the three collapsed `<details>` hints exactly as they are; only
rewrite the text above them. "Part A / Part B" labels may stay as a prefix, but the task sentence must follow.

## Before / after

```
Before:
`kmeans(X, init, iters)` -> `(C, assign)`
- `X` (N, D), `init` (K, D) float; run exactly `iters` steps (`iters >= 0`)
- `C` (K, D) final centers; `assign` (N,) int64 nearest center of each point for the final `C`
- ties -> lowest center index; no loops over points or clusters; don't modify `init`

After:
Implement k-means (Lloyd's algorithm): alternate assigning each point to its nearest center and moving each center
to the mean of its points.
- `X` (N, D) float: points; `init` (K, D): initial centers; `iters` (int ≥ 0): number of assign + update steps
- returns `(C, assign)`: `C` (K, D) final centers; `assign` (N,) int64: index of the nearest center in the final `C`
- a center with no points keeps its position; ties -> lowest center index
- no Python loops over points or clusters; don't modify `init`
```

(Only state a convention such as "a center with no points keeps its position" if the check/solution actually does it:
read the solution and check before writing any rule.)

```
Before:
With `gather` (see setup):
- `out` (2, 4): `out[i][j] = t[rows[i][j]][j]`
- `best` (4,): `best[j] = t[r][j]`, `r` = row of the largest `conf[:, j]`

After:
Use `gather` along dim 0 to pick, in each column of `t`, the rows listed in `rows`, then the most confident row.
- `out` (2, 4): `out[i][j] = t[rows[i][j]][j]`
- `best` (4,): `best[j] = t[r][j]` where `r` = argmax of `conf[:, j]`
```

## Rules

- Change ONLY the `prompt` text of cards. Ids, teach, setup, starter, solution, check stay byte-identical.
  Edit with the Edit tool (keep YAML `prompt: |` block style, 2-space indent consistent with the file, no tabs).
- Every fact you state must match the check/solution (shapes, dtypes, tie rules, bans). Read them; don't guess.
- Don't remove information a check depends on (dtype, tie rule, in-place vs copy, generator usage, order of returned rows).
- Your prompt must not give away the trick on problem-style pages (the hints do that).

## Finish

For your pages run:
- `python3 tools/validate.py <page ids>` (must pass)
- `python3 /private/tmp/claude-501/-Users-martindrieux-Drills/ff53ca8a-f0d9-4102-9290-39e15efb1d6c/scratchpad/only_prompts.py <course> <page ids>`
  (must print "only prompts changed" for each page)

Never touch `progress.json`, `answers.json`, `backups/`, `feedback/`, `app/`, `serve.py`, other pages.
Reply in ≤ 3 lines: pages done, prompts rewritten, validation result.
