# Brief: "Indexing drills" (PyTorch course, new part)

Drills app: `/Users/martindrieux/Drills`. Read `CLAUDE.md` first: these are normal **drill pages** (lesson + cards), NOT
problem-style pages. Imitate `content/courses/pytorch/chunks/init.yaml` and `content/courses/python-syntax/chunks/heaps.yaml`
(format) and `content/courses/numpy/chunks/np-ml.yaml` (strong `against` checks for function cards).
Helpers: `tools/cardtest.py` (`against`, `rand_cases`), `tools/try_card.py`, `tools/validate.py`. Cards run under
config.json's Python (torch + numpy). SPEED MATTERS: work efficiently, no long deliberation.

## Who it is for

The learner finds advanced indexing, `gather` and top-k sampling **hard** and asked for "a bunch of small exercises to practise".
So: many small, progressive skills (easy → harder within the page), each with a crystal-clear contract and tiny cards.

## Your job

You own ONE page file `content/courses/pytorch/chunks/<page>.yaml` (already listed in `course.yaml`). Do not edit any other file.
Your task message gives the page id, title and the skill list. Before writing, grep the existing pages
(`tensor-ops.yaml` index skill, `sampling.yaml`, `tricks-indexing.yaml`, `tricks-sequences.yaml`, `embeddings.yaml`) so that your
cards are NOT copies of existing cards (same trick on new data/contexts is fine; same card is not). Adjust the skill list if
something is truly already drilled, but keep ≥ 5 skills.

## Skill format

- `teach`: state the **general contract** first (what it does, input shapes/dtypes, output shape, what each output element is,
  e.g. `out[i][j] = t[i][index[i][j]]`), then one tiny example with concrete values and its output, shapes annotated
  (`# (2, 3) -> (2, 1)`). For hard ideas add ONE shape rule line (e.g. "result shape = broadcast shape of the index tensors + the
  remaining dims of x"). One pitfall line max. 4–12 lines.
- Exactly 2 cards. Card `a` exercises every item taught (combine them: several `Set:` outputs from small given tensors in `setup`).
  Card `b` = a review card in a different, ML-flavoured context (embedding lookup, per-token log-prob of labels, last-token pooling,
  beam search, …), typically "write the function", not a copy of `a`.
- Prompts: precise bullet list (**Given** with shapes / **Set** or **Write** the exact names / **Returns** shape, dtype, meaning /
  **Don't use** / **Checked on**), one bullet per output. Because the learner finds this hard, add ONE collapsed hint at the end:
  `<details><summary>Hint</summary>…the shape rule or op to use…</details>`.
- Value cards (`Set:`): check every name with value-showing messages, AND check shape/dtype.
  Function cards: `from cardtest import against, rand_cases`, hidden loop-based `_ref` (plain Python loops over indices),
  hand-picked edge cases (B = 1, K = 1, K = full size, repeated indices, negative indices where valid, ties) + ≥ 200 seeded random
  cases with varying shapes; compare shape, dtype and values (`torch.equal` for ints, `torch.allclose` for floats); `show=` printing
  shapes. Sampling: pass a `torch.Generator`, compare against the reference on the same generator seed, plus an empirical
  frequency check (never sample outside the top-k, etc.).
- Whole check < 1.5 s, deterministic.
- Run ≥ 3 plausible WRONG solutions per card through `python3 tools/try_card.py pytorch <page> <skill-id> <card-id> <<'EOF' … EOF`
  and make sure each FAILS (wrong `dim`, index without `expand`, `v[:, -1]` instead of `v[:, -1:]`, `scatter_` instead of
  `scatter_add_`, forgetting to map sampled positions back through the top-k indices…). zsh treats parentheses in
  `${var/pat/rep}` as globs: build variants with Python `.replace` and assert the code changed.
- `python3 tools/validate.py <page>` must pass for your page.

Never touch `progress.json`, `answers.json`, `backups/`, `feedback/`, `app/`, `serve.py`, other pages.

Reply briefly: skill ids (one line each), any skill you changed vs the list and why, wrong solutions tried (all FAIL).
