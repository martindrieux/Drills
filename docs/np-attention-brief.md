# Brief: NumPy problem "multi-head attention & Transformer block, no autograd"

You are writing ONE skill (2 cards) of a Drills page. The Drills app is in `/Users/martindrieux/Drills`.
Read `CLAUDE.md` there first (authoring rules) and imitate `content/courses/numpy/chunks/np-ml.yaml`
(strong `against` checks) and `content/courses/python-syntax/chunks/heaps.yaml` (prompt format).

## The problem (what the learner practises)

Implement multi-head scaled dot-product attention and a Transformer block in NumPy only, with no autograd:
the forward pass, the backward pass by hand, autoregressive training (next-token loss with teacher forcing,
perplexity), and finite-difference gradient checks. The lesson should ask the learner to note the shape of every tensor.

## Fixed conventions (state the ones your part uses in your `teach`, briefly)

- Self-attention: `X` gives Q, K and V. `X`: `(B, T, d_model)`. `W_q, W_k, W_v, W_o`: `(d_model, d_model)`, **no biases**.
- `h` heads, `head_dim = d_model // h`. Split: `(B, T, d_model) -> (B, T, h, head_dim) -> (B, h, T, head_dim)`
  (head k = features `k*head_dim .. (k+1)*head_dim - 1`); merge is the inverse.
- `scores = Q @ Kᵀ / sqrt(head_dim)`: `(B, h, T, T)`. Causal mask: position t sees positions `<= t`;
  masked scores are set to `-inf` (or a large negative number, both accepted) BEFORE the softmax.
- Softmax subtracts the row max. Losses use log-sum-exp.
- Attention cache (a dict) = `{"X", "W_q", "W_k", "W_v", "W_o", "h", "Q", "K", "V", "attn", "concat"}` with
  Q, K, V `(B, h, T, head_dim)`, attn `(B, h, T, T)` (after softmax), concat `(B, T, d_model)` (heads merged, before W_o).
- The block is **pre-LayerNorm**: `a = X + Attn(LN1(X))`, `out = a + FFN(LN2(a))`, `FFN(z) = relu(z @ W1 + c1) @ W2 + c2`,
  LayerNorm over the last axis with biased variance, `eps = 1e-5`, `LN(x) = (x - mean) / sqrt(var + eps) * gamma + beta`.
- Language model for training: `E` `(V, d)` embedding, `X = E[tokens]`, `A = attention(X)`, `logits = A @ W_out` with `W_out` `(d, V)`.
  Next-token loss: logits at positions `0 .. T-2` predict `tokens[:, 1:]`; mean over the `B*(T-1)` predictions;
  the last position has no target (zero gradient). `perplexity = exp(loss)`.

## Hidden helpers: `tools/np_attention_ref.py` (importable in `setup` and `check`; `tools/` is on sys.path)

Read it. It has vectorized references (`attention_forward`, `attention_backward`, `softmax`, `softmax_backward`,
`lm_loss`, `grad_check`, `layer_norm`, `split_heads`, `merge_heads`) and check helpers (`brute_attention` with explicit
loops, `numeric_grad` central differences, `rand_attention_case(r)`, `show_shapes`, `arrays_close`). They are tested.
- In `setup`, import ONLY the building blocks a card says are *given* (e.g. `from np_attention_ref import attention_forward`),
  never the function the learner must write. Setup is shown to the learner, so keep it short.
- In `check`, prefer the brute-force / finite-difference helpers as the reference; vectorized refs are fine for many random cases
  when a few cases are also checked against loops / finite differences. You may add helpers to this module only if
  you really need to (append, don't change existing functions; other agents use it).

## Checks must be strong

`from cardtest import against, rand_cases`, hand-picked edge cases (T = 1, h = 1, head_dim = 1, B = 1, large logits ±1000,
repeated tokens…) plus ≥ 150 seeded random cases (keep the whole check under ~2 s; validate times out at 5 s).
Use `same=` with `arrays_close` and `show=show_shapes` so failure messages stay short. Check the return TYPE/structure
(tuple order, shapes). Then run ≥ 4 plausible WRONG solutions per card through
`python3 tools/try_card.py numpy <page> <skill-id> <card-id> <<'EOF' ... EOF` and make sure each one FAILS
(missing mask, mask including/excluding the diagonal wrongly, sqrt(d_model) instead of sqrt(head_dim), reshape without
transpose when splitting heads, transposed weight gradient, missing one of the three dX paths, no max-subtraction,
no target shift, mean over T instead of T-1, forward instead of central differences, x not restored…).
Beware: zsh treats `(` `)` in `${var/pattern/repl}` as glob syntax, so build wrong variants with Python string `.replace`
(asserting the code changed) or write them out in full.

## Format

- Your file: `content/courses/numpy/chunks/<page>.yaml` (page given in your task), with `id`, `title`, `intro`, `problems`, `atoms: []`,
  and ONE skill (id prefixed `<page>.`), `name`, `teach`, and exactly 2 cards `a` and `b`.
- `teach`: this is an independent problem, so the teach is the **spec**, not the solution: the interface, the convention
  bits it needs, the formulas (e.g. gradient formulas), and the shape of each tensor. Short (≤ ~15 lines), a code block of
  comments / signatures is fine. No full solution code.
- Card prompts: the precise bullet list format (**Given** / **Write** / **Returns** / **Checked on**), one bullet per output.
- Each card has a `solution` that passes and a `check` that fails on `setup` + `starter` alone (no starter is fine).
- Validate: `python3 tools/validate.py <page>` must show your card solutions passing and no error mentioning your page.
- Do NOT edit any other file in `content/`, `app/`, `serve.py`, `course.yaml`, and NEVER touch `progress.json`, `answers.json`, `backups/`.

Reply with: the skill id, the two card ids with one line each, the wrong solutions you tried (all FAIL), and the check runtime.
