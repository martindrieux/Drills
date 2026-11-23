# Brief: PyTorch course, part "RL in one go" (one page per algorithm)

Drills app: `/Users/martindrieux/Drills`. Read `CLAUDE.md` first (esp. the **Card prompts** rule and strong checks).
Imitate `content/courses/pytorch/chunks/one-go.yaml`: its style (no lesson, write the whole thing from memory),
prompts, `_G` generator trick, `against` checks, memory/loop bans. Helpers: `tools/cardtest.py` (`against`,
`rand_cases`), `tools/try_card.py`, `tools/validate.py`. Cards run under config.json's Python (numpy + torch).
SPEED MATTERS: work efficiently, no long deliberation.

## The learner

Preps 30–60 min ML research-engineering coding interviews ("implement X from scratch"). Wants precise signatures,
tensor shapes, behavioural requirements, strong tests, no solution shown before trying, and progressively harder
follow-ups that test the math and implementation correctness.

## Your job

ONE page file `content/courses/pytorch/chunks/<page>.yaml` (already listed in course.yaml). Edit no other file.
Your task message gives the page id, title and the spec.

- Page: `intro` = one line ("No lesson: … from memory. The checks are strict."), `problems:` list, `atoms: []`.
- 2 skills, each with exactly 2 cards (= 4 cards, progressively harder: skill 1 card a is the core algorithm, the
  last card is the hardest follow-up). Every card is a WHOLE function (5–30 lines), never a fragment.
  The two cards of a skill must not be copies (b = harder variant / follow-up / integration).
- `teach` (per skill, ≤ 6 lines): one sentence of what is computed, the key formula(s) with symbols defined,
  conventions (shapes, time-major or batch-major, what `done` means). NO solution code.
- `prompt`: per CLAUDE.md: imperative task sentence; a bullet per input `` `name` (shape, dtype): meaning ``;
  `` returns `f(...)` (shape, dtype): meaning `` with the defining formula; conventions / bans the check enforces
  (e.g. "no Python loops over the batch", "don't modify `x`", "detach the targets"). 3–7 short lines. No hints.
  Self-contained: someone must be able to solve it from the prompt alone.
- `setup`: imports and any given helper (e.g. a tiny policy `nn.Module` class), shown read-only.
- `starter`: the signature with `raise NotImplementedError`.
- `solution`: clean code with shape comments, then ≤ 5 comment lines: `# Follow-ups:` 2–3 interview questions on
  the math with a one-line answer each (e.g. "why does subtracting a baseline keep the gradient unbiased? E[∇log π·b]=0").
- `check`: `from cardtest import against, rand_cases`; hidden simple `_ref` (plain loops, written independently,
  not a copy of the solution); hand-picked edge cases + ≥ 200 seeded random cases with small shapes; compare shape,
  dtype, values (`torch.allclose` / `np.allclose`). For losses, also check GRADIENTS (autograd on the learner's loss
  vs the ref, w.r.t. the inputs/params that should get gradient, and that detached things get none). For update
  steps with an optimizer, deep-copy a seeded model, run learner and ref, compare parameters after the step.
  Use a `torch.Generator` argument for any randomness (minibatch permutation, sampling) and the `_G` deepcopy trick
  so `against` replays identical draws. Whole check < 2 s, deterministic.
- Run ≥ 3 plausible WRONG solutions per card through
  `python3 tools/try_card.py pytorch <page> <skill-id> <card-id> <<'EOF' … EOF` and make sure each FAILS. Build
  variants with Python `.replace` (zsh globs parentheses) and assert the code changed.
- `python3 tools/validate.py <page>` must pass for your page ("chunk … has no file" for the other rl-* pages that
  are being written in parallel can be ignored).

Never touch `progress.json`, `answers.json`, `backups/`, `feedback/`, `app/`, `serve.py`, course.yaml, other pages.

Reply in ≤ 6 lines: skill ids + card function names, wrong solutions tried (all FAIL), check runtimes.
