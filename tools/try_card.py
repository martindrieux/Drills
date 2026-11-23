"""Run some code against one card's setup + check, exactly like the app does.

    python3 tools/try_card.py <course> <page> <skill-id> <card-id> <<'EOF'
    res = nums[::-1]
    EOF

Prints PASS, or FAIL with the error. Used to check whether a learner's answer is (or should be) accepted.
"""
import json
import os
import sys
import textwrap
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent


def main(course, page, sid, card_id):
    chunk = yaml.safe_load((ROOT / "content" / "courses" / course / "chunks" / f"{page}.yaml").read_text())
    skill = next(s for s in chunk["skills"] if s["id"] == sid)
    card = next(c for c in skill["cards"] if c["id"] == card_id)
    sys.path.insert(0, str(ROOT / "tools"))
    from runner import run  # same harness and seeds as the app

    d = lambda s: textwrap.dedent(s or "")  # noqa: E731
    res = run([["<setup>", d(card.get("setup"))], ["<your code>", sys.stdin.read()], ["<check>", d(card["check"])]])
    if res["ok"]:
        print("PASS")
    else:
        print(f"FAIL in {res['where']} line {res.get('line')}: {res['etype']}: {res['msg']}")
    if res.get("stdout"):
        print("stdout:", res["stdout"])


if __name__ == "__main__":
    cfg = ROOT / "config.json"
    py = json.loads(cfg.read_text()).get("python") if cfg.exists() else None
    if py and os.path.exists(py) and os.path.realpath(py) != os.path.realpath(sys.executable) and not os.environ.get("KM_REEXEC"):
        os.environ["KM_REEXEC"] = "1"
        os.execv(py, [py, __file__, *sys.argv[1:]])
    main(*sys.argv[1:5])
