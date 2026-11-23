"""Hidden reference conv helpers imported by numpy/conv-* card setups (kept out of the visible setup)."""
import numpy as np
from numpy.lib.stride_tricks import sliding_window_view

def conv2d_forward(x, w, b, stride, pad):              # -> (B, Cout, H_out, W_out)
    xp = np.pad(x, ((0, 0), (0, 0), (pad, pad), (pad, pad)))
    win = sliding_window_view(xp, w.shape[2:], axis=(2, 3))[:, :, ::stride, ::stride]  # (B, Cin, Ho, Wo, Kh, Kw)
    return np.einsum('bchwij,ocij->bohw', win, w) + b[None, :, None, None]

def conv2d_backward(dout, x, w, stride, pad):          # -> (dx, dw, db), analytic and correct
    H, W = x.shape[2:]
    Kh, Kw = w.shape[2:]
    Ho, Wo = dout.shape[2:]
    xp = np.pad(x, ((0, 0), (0, 0), (pad, pad), (pad, pad)))
    win = sliding_window_view(xp, (Kh, Kw), axis=(2, 3))[:, :, ::stride, ::stride]
    dxp = np.zeros_like(xp)
    for i in range(Kh):
        for j in range(Kw):
            dxp[:, :, i:i + stride * Ho:stride, j:j + stride * Wo:stride] += np.einsum('bohw,oc->bchw', dout, w[:, :, i, j])
    return dxp[:, :, pad:pad + H, pad:pad + W], np.einsum('bohw,bchwij->ocij', dout, win), dout.sum(axis=(0, 2, 3))
