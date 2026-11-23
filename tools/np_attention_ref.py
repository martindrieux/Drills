"""Reference pieces for the NumPy problem "multi-head attention & Transformer block, no autograd".

Cards import from here in two ways:
- `setup` imports the *given* building blocks of a part (e.g. the forward pass when you write the backward),
  so a card never shows the solution of another card;
- `check` imports the brute-force versions (explicit loops, finite differences) to verify answers.

Conventions (stated in the lesson): X is (B, T, d_model), weights are (d_model, d_model), no biases,
heads are split as d_model -> (h, head_dim) and moved before T: (B, h, T, head_dim).
"""
import math

import numpy as np


# ---------- vectorized reference (the "given" functions) ----------

def split_heads(x, h):
    B, T, d = x.shape
    return x.reshape(B, T, h, d // h).transpose(0, 2, 1, 3)          # (B, h, T, hd)


def merge_heads(x):
    B, h, T, hd = x.shape
    return x.transpose(0, 2, 1, 3).reshape(B, T, h * hd)              # (B, T, d)


def softmax(z):
    e = np.exp(z - z.max(axis=-1, keepdims=True))
    return e / e.sum(axis=-1, keepdims=True)


def softmax_backward(d_p, p):
    """Gradient w.r.t. the softmax input z, given p = softmax(z) (last axis) and d_p = dL/dp."""
    return p * (d_p - (d_p * p).sum(axis=-1, keepdims=True))


def attention_forward(X, W_q, W_k, W_v, W_o, h):
    B, T, d = X.shape
    hd = d // h
    Q, K, V = split_heads(X @ W_q, h), split_heads(X @ W_k, h), split_heads(X @ W_v, h)
    scores = Q @ K.transpose(0, 1, 3, 2) / math.sqrt(hd)              # (B, h, T, T)
    future = np.triu(np.ones((T, T), dtype=bool), k=1)
    attn = softmax(np.where(future, -np.inf, scores))                 # (B, h, T, T)
    concat = merge_heads(attn @ V)                                    # (B, T, d)
    out = concat @ W_o
    cache = {"X": X, "W_q": W_q, "W_k": W_k, "W_v": W_v, "W_o": W_o, "h": h,
             "Q": Q, "K": K, "V": V, "attn": attn, "concat": concat}
    return out, cache


def attention_backward(d_out, cache):
    X, W_q, W_k, W_v, W_o, h = (cache[k] for k in ("X", "W_q", "W_k", "W_v", "W_o", "h"))
    Q, K, V, attn, concat = (cache[k] for k in ("Q", "K", "V", "attn", "concat"))
    d = X.shape[-1]
    hd = d // h
    dW_o = concat.reshape(-1, d).T @ d_out.reshape(-1, d)
    d_ctx = split_heads(d_out @ W_o.T, h)                             # (B, h, T, hd)
    dV = attn.transpose(0, 1, 3, 2) @ d_ctx
    d_attn = d_ctx @ V.transpose(0, 1, 3, 2)                          # (B, h, T, T)
    d_scores = softmax_backward(d_attn, attn) / math.sqrt(hd)
    dQ = d_scores @ K
    dK = d_scores.transpose(0, 1, 3, 2) @ Q
    dQm, dKm, dVm = merge_heads(dQ), merge_heads(dK), merge_heads(dV)
    X2 = X.reshape(-1, d)
    dW_q = X2.T @ dQm.reshape(-1, d)
    dW_k = X2.T @ dKm.reshape(-1, d)
    dW_v = X2.T @ dVm.reshape(-1, d)
    dX = dQm @ W_q.T + dKm @ W_k.T + dVm @ W_v.T
    return dX, dW_q, dW_k, dW_v, dW_o


def lm_loss(logits, tokens):
    B, T, V = logits.shape
    z = logits[:, :-1]                                                # (B, T-1, V)
    m = z.max(axis=-1, keepdims=True)
    logp = z - m - np.log(np.exp(z - m).sum(axis=-1, keepdims=True))
    tgt = tokens[:, 1:]
    n = B * (T - 1)
    loss = -np.take_along_axis(logp, tgt[..., None], axis=-1).sum() / n
    d = np.exp(logp)
    np.put_along_axis(d, tgt[..., None], np.take_along_axis(d, tgt[..., None], axis=-1) - 1, axis=-1)
    d_logits = np.zeros_like(logits)
    d_logits[:, :-1] = d / n
    return loss, d_logits


def grad_check(f, x, analytic, eps=1e-5):
    worst = 0.0
    for i in np.ndindex(x.shape):
        old = x[i]
        x[i] = old + eps
        fp = f()
        x[i] = old - eps
        fm = f()
        x[i] = old
        num = (fp - fm) / (2 * eps)
        worst = max(worst, abs(analytic[i] - num) / max(abs(analytic[i]) + abs(num), 1e-12))
    return worst


def layer_norm(x, gamma, beta, eps=1e-5):
    mu = x.mean(axis=-1, keepdims=True)
    var = x.var(axis=-1, keepdims=True)
    return (x - mu) / np.sqrt(var + eps) * gamma + beta


# ---------- brute force (for checks only) ----------

def brute_attention(X, W_q, W_k, W_v, W_o, h):
    """Explicit loops over batch, head and position; returns out (B, T, d)."""
    B, T, d = X.shape
    hd = d // h
    Q, K, V = X @ W_q, X @ W_k, X @ W_v
    concat = np.zeros((B, T, d))
    for b in range(B):
        for k in range(h):
            sl = slice(k * hd, (k + 1) * hd)
            for t in range(T):
                s = [float(Q[b, t, sl] @ K[b, u, sl]) / math.sqrt(hd) for u in range(t + 1)]
                m = max(s)
                e = [math.exp(v - m) for v in s]
                w = [v / sum(e) for v in e]
                concat[b, t, sl] = sum(w[u] * V[b, u, sl] for u in range(t + 1))
    return concat @ W_o


def numeric_grad(f, x, eps=1e-6):
    """Central differences of the scalar f() w.r.t. every entry of x (x is restored)."""
    g = np.zeros_like(x, dtype=float)
    for i in np.ndindex(x.shape):
        old = x[i]
        x[i] = old + eps
        fp = f()
        x[i] = old - eps
        fm = f()
        x[i] = old
        g[i] = (fp - fm) / (2 * eps)
    return g


def rand_attention_case(r, max_b=2, max_t=5, max_h=3, max_hd=3):
    """(X, W_q, W_k, W_v, W_o, h) with float64 values, from a random.Random."""
    B, T, h, hd = r.randint(1, max_b), r.randint(1, max_t), r.randint(1, max_h), r.randint(1, max_hd)
    d = h * hd
    rs = np.random.default_rng(r.randrange(10 ** 9))
    X = rs.normal(size=(B, T, d))
    Ws = [rs.normal(size=(d, d)) / math.sqrt(d) * r.choice([0.5, 1.0, 3.0]) for _ in range(4)]
    return (X, *Ws, h)


def show_shapes(*args):
    """Readable input description for failure messages: shapes of arrays, values of the rest."""
    parts = []
    for a in args:
        if isinstance(a, np.ndarray):
            parts.append(f"array{a.shape}")
        elif isinstance(a, dict):
            parts.append("cache{" + ", ".join(f"{k}: {v.shape if isinstance(v, np.ndarray) else v!r}" for k, v in a.items()) + "}")
        else:
            parts.append(repr(a))
    return "(" + ", ".join(parts) + ")"


def arrays_close(got, exp, rtol=1e-6, atol=1e-8):
    """same= for tuples / lists of arrays: same length, same shapes, allclose."""
    if not isinstance(got, (tuple, list)) or len(got) != len(exp):
        return False
    return all(np.shape(g) == np.shape(e) and np.allclose(np.asarray(g, dtype=float), e, rtol=rtol, atol=atol)
               for g, e in zip(got, exp))
