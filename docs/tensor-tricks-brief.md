# Brief: "Tensor tricks" interview problems (PyTorch course, part "Tensor tricks")

Drills app: `/Users/martindrieux/Drills`. Read `CLAUDE.md` first (rules). Imitate the strong checks of
`content/courses/numpy/chunks/np-ml.yaml` and the problem format of `content/courses/numpy/chunks/np-attention.yaml`.
Helpers: `tools/cardtest.py` (`against`, `rand_cases`), `tools/try_card.py`, `tools/validate.py`. Cards run under
config.json's Python (torch 2.10 + numpy). SPEED MATTERS: work efficiently, no long deliberation.

## Your job

You own ONE category of exercises (given in your task) and ONE new page file `content/courses/pytorch/chunks/<page>.yaml`
(already listed in `course.yaml`; do not edit course.yaml or any other existing file).

1. **Audit first (5 min max)**: grep the existing content for each exercise of your category:
   `content/courses/pytorch/chunks/*.yaml` (esp. tensor-ops, interview-tricks, scratch-core, scratch-attention,
   ml-problems, sampling, losses-optim, autograd, tensors) and `content/courses/numpy/chunks/*.yaml`.
   An exercise is **covered** if an existing card already makes the learner write the same core trick
   (e.g. `x[torch.arange(B), idx]` is covered by tensor-ops). Do NOT duplicate covered ones.
   Partially covered → add only the missing angle (e.g. the matmul-identity version of distances, `scatter_add` vs `scatter`).
2. **Write one skill per missing exercise** (or merge two tiny related ones into one skill). Skill ids `<page>.<short-name>`.
   If everything in your category is covered, write no file and say so.

## Skill format (problem style: don't give the trick away up front)

- `name`: "<title> (Easy|Medium|Hard)".
- `teach`: the **problem spec only**: what to compute, shapes, a small concrete input → output example, constraints
  (no Python loops over X, banned helpers). Do NOT name the key operation. ≤ 12 lines.
- Exactly 2 cards. Card `a` = the main exercise (write the function). Card `b` = the follow-up / variant from the exercise
  description (e.g. Part B scatter_add, the memory-efficient version, the masked version, the NumPy equivalent), not a copy of a.
- Card `prompt`: precise bullet list (**Given** / **Write** / **Returns** shape+dtype / **Don't use** / **Checked on**), then
  three progressive hints, each collapsed:
  `<details><summary>Hint 1</summary>conceptual direction</details>` then Hint 2 (relevant math / tensor op), Hint 3 (concrete strategy).
- `starter`: the function signature with `raise NotImplementedError`.
- `solution`: idiomatic PyTorch, followed by a comment block (revealed only after the attempt) with: the core trick and why it
  works, shapes, time/memory complexity vs the naive way, the NumPy equivalent and API differences, common mistakes,
  1–2 interview follow-ups. Keep it tight (≤ 15 comment lines).
- `check`: `from cardtest import against, rand_cases`; a hidden loop-based reference `_ref` (plain Python loops, or the built-in
  like `F.cross_entropy` / `torch.cdist` where the exercise says "compare with"); hand-picked edge cases (empty groups,
  K > N, repeated indices, zero lengths, large logits, B = 1…) + ≥ 150 seeded random cases with varying batch sizes;
  noncontiguous inputs where relevant (e.g. `x.transpose(0, 1)` of a contiguous tensor); `same=` comparing shape, dtype
  and `torch.allclose` (never exact float equality); `show=` printing shapes to keep messages short. Sampling exercises:
  pass a `torch.Generator` and check against the reference on the same generator, plus empirical frequencies.
  "No loops" can't be proven: at most a cheap source check (`inspect.getsource` contains no `for `/`while `) when the card bans loops.
- Whole check < 2 s. Seed everything.
- Run ≥ 3 plausible WRONG solutions per card through `try_card.py` and make sure each FAILS (zsh treats parentheses in
  `${var/pat/rep}` as globs: build variants with Python `.replace` and assert the code changed).
- `python3 tools/validate.py <page>` must pass for your page.

Never touch `progress.json`, `answers.json`, `backups/`, `app/`, `serve.py`, other pages.

Reply briefly: which exercises were already covered (and where), which skills you added (id + one line), wrong solutions tried.
