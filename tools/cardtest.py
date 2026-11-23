"""Strong checks for cards where the learner writes a function.

Use in a card's `check`:

    from cardtest import against, rand_cases
    def _ref(nums, k): ...                       # hidden, simple (brute-force) reference
    def _gen(r):                                 # r is a seeded random.Random; return one args tuple
        n = r.randint(0, 8)
        return ([r.randint(-5, 5) for _ in range(n)], r.randint(1, 4))
    against(max_sum_k, _ref, [([1, 2], 1), ...] + rand_cases(_gen, 300))

`against` calls both functions on deep copies of each args tuple (so mutating inputs can't fool it),
in the given order (hand-picked edge cases first, then random cases from small to large), and on the
first mismatch raises an AssertionError showing the input, the learner's result and the expected one.
"""
import copy
import random
import reprlib

_short = reprlib.Repr()
_short.maxstring = 120
_short.maxother = 120
_short.maxlist = _short.maxtuple = _short.maxdict = _short.maxset = 25
_short.maxlevel = 4


def _fmt_args(args, show):
    if show:
        return show(*args)
    return "(" + ", ".join(_short.repr(a) for a in args) + ")"


def against(fn, ref, cases, *, same=None, show=None, name=None):
    """Assert fn(*args) == ref(*args) for every args tuple in `cases`.

    same(got, expected) -> bool  overrides equality (e.g. order-insensitive comparison).
    show(*args) -> str           formats the input in failure messages (e.g. trees, linked lists).
    """
    label = name or getattr(fn, "__name__", "your function")
    for args in cases:
        if not isinstance(args, tuple):
            args = (args,)
        expected = ref(*copy.deepcopy(args))
        try:
            got = fn(*copy.deepcopy(args))
        except RecursionError:
            raise AssertionError(f"{label}{_fmt_args(args, show)} hit RecursionError") from None
        except Exception as e:  # noqa: BLE001 - report the learner's exception with the input that caused it
            raise AssertionError(f"{label}{_fmt_args(args, show)} raised {type(e).__name__}: {e}") from None
        ok = same(got, expected) if same else got == expected
        if not ok:
            raise AssertionError(
                f"{label}{_fmt_args(args, show)}\n  returned {_short.repr(got)}\n  expected {_short.repr(expected)}")
    return True


def rand_cases(gen, n, seed=0):
    """n args tuples from gen(r) with a seeded RNG, sorted from smallest to largest input
    (so the first failure shown is a small one)."""
    r = random.Random(seed)
    cases = [gen(r) for _ in range(n)]
    cases = [c if isinstance(c, tuple) else (c,) for c in cases]
    return sorted(cases, key=lambda c: len(repr(c)))
