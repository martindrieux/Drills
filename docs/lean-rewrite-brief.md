# Brief: make a page LEAN (rewrite `teach` and card `prompt` text only)

Drills app: `/Users/martindrieux/Drills`. Read the "Lean, not verbose" and "Card prompts" rules in `CLAUDE.md`.
The learner said lessons and prompts became too verbose ("I often end up not reading"). The older terse format
(see `content/courses/pytorch/chunks/sampling.yaml`) was 95% right; it only lacked shapes and a one-line contract.
SPEED MATTERS: this is a text edit, not a redesign.

## What to change in your page

- `teach`: roughly halve it. One `# call -> shape: meaning` line per item, one example annotated with shapes and output.
  Remove "goal:" lines, restatements, second examples, multi-line explanations. At most one pitfall line. ~6–10 code lines.
- `prompt`: 2–4 short bullets, one per output: `` `name` (shape): meaning ``. Drop `Given:` (inputs are in setup),
  `Returns:` wording, `Checked on:`, and the `<details>` hint. Keep a ban/convention only if the check enforces it
  (e.g. "no loops", "use `gather`", "don't modify `logits`"), in a few words.
- Keep everything else unchanged: ids, setup, starter, solution, check. Only change a check if the lean prompt no
  longer states something the check requires (then either keep that phrase or relax the check).

## Example (idx-gather.expand)

Before: teach 1036 chars with 4 comment lines of contract; prompt with Given / Set / Set / Use / Hint (~600 chars).
After:

```yaml
    teach: |
      ```python
      # gather's index needs the full ndim: (B, K) -> unsqueeze(-1) -> expand(-1, -1, D) -> (B, K, D)
      # t.expand(-1, -1, D): repeats size-1 dims without copying (-1 keeps that size)
      x = torch.arange(12.).view(1, 4, 3)                  # (1, 4, 3)
      idx = torch.tensor([[3, 0]])                         # (1, 2)
      x.gather(1, idx.unsqueeze(-1).expand(-1, -1, 3))     # (1, 2, 3): [[[9, 10, 11], [0, 1, 2]]]
      ```
      Pitfall: without `expand` you get `(B, K, 1)`, only feature 0, and no error.
    cards:
      - id: a
        prompt: |
          With `gather` (see setup):
          - `picked` (2, 3, 3): `picked[b][k] = x[b][idx[b][k]]`
          - `last` (2, 3): `x[b][lengths[b] - 1]` for each `b`
```

## Problem-style pages (tricks-*, np-attention)

There the `teach` is the problem spec (don't give the trick away). Make it lean too: what to compute, shapes, one tiny
input → output example, constraints in a few words. Prompts: same 2–4 bullet rule, but KEEP the three collapsed
`<details>` hints (the learner asked for them on these pages), each shortened to one short line. Trim the comment block
after the solution to ≤ 6 lines (trick, cost, NumPy equivalent, one follow-up). If you shorten a solution's comments
only, the check needs no re-test.

## Finish

`python3 tools/validate.py <page>` must pass (all card solutions pass). Spot-check with `try_card.py` that one wrong
answer per function card still fails if you touched a check. Never touch `progress.json`, `answers.json`, `backups/`,
`feedback/`, `app/`, other pages. Reply in 2 lines: chars before → after (teach avg, prompt avg), validation result.
