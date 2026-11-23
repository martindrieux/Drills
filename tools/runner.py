"""Long-lived code runner used by serve.py (one JSON job per line on stdin, one result per line on stdout).

It runs under the interpreter from config.json, so exercises can use torch. Heavy imports happen once at
startup; every job then runs in a fresh namespace with fixed seeds.
"""
import contextlib
import io
import json
import random
import sys
import traceback

OUT = sys.stdout  # the protocol channel; user prints are captured separately

try:
    import torch  # noqa: F401 - preloaded so the first exercise is fast
except Exception:  # noqa: BLE001
    torch = None
try:
    import numpy
except Exception:  # noqa: BLE001
    numpy = None


def run(parts):
    random.seed(0)
    if torch is not None:
        torch.manual_seed(0)
    if numpy is not None:
        numpy.random.seed(0)
    ns = {"__name__": "__main__"}
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf), contextlib.redirect_stderr(buf):
        for label, src in parts:
            try:
                exec(compile(src, label, "exec"), ns)
            except BaseException as e:  # noqa: BLE001 - report anything the exercise raises
                frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == label]
                line = frames[-1].lineno if frames else getattr(e, "lineno", None)
                return {"ok": False, "where": label, "etype": type(e).__name__, "msg": str(e), "line": line,
                        "stdout": buf.getvalue()[-4000:]}
    return {"ok": True, "stdout": buf.getvalue()[-4000:]}


def main():
    hello = {"ready": True, "python": sys.version.split()[0], "torch": getattr(torch, "__version__", None)}
    OUT.write(json.dumps(hello) + "\n")
    OUT.flush()
    for line in sys.stdin:
        try:
            res = run(json.loads(line)["parts"])
        except Exception as e:  # noqa: BLE001
            res = {"ok": False, "where": "runner", "etype": type(e).__name__, "msg": str(e)}
        OUT.write(json.dumps(res) + "\n")
        OUT.flush()


if __name__ == "__main__":
    main()
