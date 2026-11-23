# Brief: NumPy course, part "Convolution" (from scratch, Tesla-style interview prep)

Drills app: `/Users/martindrieux/Drills`. Read `CLAUDE.md` first (rules, esp. **Lean, not verbose** and **short prompts**).
Imitate `content/courses/numpy/chunks/np-ml.yaml` (strong `against` checks) and the lean style of
`content/courses/pytorch/chunks/idx-gather.yaml`. Helpers: `tools/cardtest.py`, `tools/try_card.py`, `tools/validate.py`.
Cards run under config.json's Python (numpy + torch). SPEED MATTERS: work efficiently, no long deliberation.

## The learner

Prepping a 1-hour "convolutions from scratch" ML coding interview. Already knows: Conv1D maps (L, Cin) -> (L-K+1, Cout),
each output position applies the same linear map K*Cin -> Cout; unfold duplicates overlapping inputs and fold sums
gradients back. Wants coding exercises, numeric validation against PyTorch, focus on indexing, shapes and the math of
the backward pass. Deep enough, but reasonable time: each card is ONE function of 5–20 lines.

## Shared conventions (state the ones your page uses)

- NumPy, NCHW: `x` (B, Cin, H, W), `w` (Cout, Cin, Kh, Kw), `b` (Cout,), cross-correlation (no kernel flip, like PyTorch).
- Zero padding `pad` on each side of H and W; `stride`; dilation `dil` only where the page says.
- `H_out = (H + 2*pad - dil*(Kh - 1) - 1) // stride + 1` (same for W).
- im2col column order = `torch.nn.functional.unfold`: rows ordered (ci, i, j), columns ordered (y, x) row-major,
  `cols` shape (B, Cin*Kh*Kw, H_out*W_out).
- Learner-written code is NumPy only; checks validate against PyTorch in float64
  (`torch.nn.functional.conv2d`, `unfold`, `fold`, `max_pool2d`, `conv_transpose2d`, autograd for gradients).

## Your job

ONE page file `content/courses/numpy/chunks/<page>.yaml` (already listed in course.yaml). Do not edit any other file.
Your task message gives page id, title and the skill list.

- `teach`: problem-style but lean: one sentence of what is computed, the formula(s) / shape rules, one tiny numeric
  example (input -> output), at most one pitfall. **No solution code** (the learner codes first). ~6–12 lines.
- Exactly 2 cards per skill. Card `a` = the main function. Card `b` = a variant in a different setting (not a copy).
- Prompts: 2–4 short bullets: `` `f(x, w, ...)` -> shape: meaning ``, conventions/bans only when the check enforces them.
  No Given/Checked-on boilerplate, no hints.
- `solution`: clean NumPy with a shape comment on key lines, then ≤ 5 comment lines (key idea, cost, a follow-up question).
- `check`: `from cardtest import against, rand_cases`; reference = PyTorch float64 (or a brute-force loop); hand-picked
  edge cases (B = 1, Cin = 1, K = 1, K = H, stride > 1 not dividing, pad > 0, non-square kernels/inputs, Cout > Cin)
  + ≥ 200 seeded random cases with TINY shapes (H, W ≤ 7) so loop solutions stay fast; whole check < 2 s.
  Compare shape and values with `np.allclose`; return types are `np.ndarray`. `show=` prints shapes only.
  Where a card bans loops ("vectorized"), enforce it via bytecode (`dis`: no `FOR_ITER` / `JUMP_BACKWARD` in the
  function or nested code objects; comprehensions count as loops).
- Run ≥ 3 plausible WRONG solutions per card through
  `python3 tools/try_card.py numpy <page> <skill-id> <card-id> <<'EOF' … EOF` and make sure each FAILS
  (off-by-one in H_out, stride ignored in the input index, `=` instead of `+=` when accumulating, flipped kernel,
  wrong unfold order, missing pad crop in backward, ties in max-pool…). Build variants with Python `.replace`
  (zsh treats parentheses in `${var/pat/rep}` as globs) and assert the code changed.
- `python3 tools/validate.py <page>` must pass.

Never touch `progress.json`, `answers.json`, `backups/`, `feedback/`, `app/`, `serve.py`, other pages.

Reply in ≤ 6 lines: skill ids (one line each), wrong solutions tried (all FAIL), check runtimes.
