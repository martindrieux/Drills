"""Validate all content: structure, references, and that every solution passes its check.

Usage: python3 tools/validate.py [atom-id ...]
"""
import json
import os
import signal
import sys
import textwrap
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
LINK_KINDS = {"prereq", "uses", "contrast", "variant"}

errors: list[str] = []
warnings: list[str] = []


def load_dir(name):
    out = {}
    for p in sorted((CONTENT / name).glob("*.yaml")):
        try:
            data = yaml.safe_load(p.read_text())
        except yaml.YAMLError as e:
            errors.append(f"{p.relative_to(ROOT)}: YAML error: {e}")
            continue
        if not isinstance(data, dict):
            errors.append(f"{p.relative_to(ROOT)}: not a mapping")
            continue
        if data.get("id") != p.stem:
            errors.append(f"{p.relative_to(ROOT)}: id {data.get('id')!r} != file name {p.stem!r}")
        out[p.stem] = data
    return out


class Timeout(Exception):
    pass


def _alarm(signum, frame):
    raise Timeout()


def _seed():
    import random
    random.seed(0)
    try:
        import torch
        torch.manual_seed(0)
    except ImportError:
        pass


def run(code, label):
    signal.signal(signal.SIGALRM, _alarm)
    signal.alarm(5)
    try:
        _seed()  # same seeds and module name as tools/runner.py, so the app and the validator agree
        exec(compile(code, label, "exec"), {"__name__": "__main__"})
        return None
    except Timeout:
        return "timeout (>5s)"
    except BaseException as e:  # noqa: BLE001 - report anything
        return f"{type(e).__name__}: {e}"
    finally:
        signal.alarm(0)


def block(s):
    return textwrap.dedent(s or "").strip("\n") + "\n"


def course_chunks(course):
    """A course lists its chunks flat (`chunks`) or grouped in `parts`."""
    return course.get("chunks") or [c for part in course.get("parts", []) for c in part.get("chunks", [])]


def main(only):
    domains = load_dir("domains")
    blobs = load_dir("blobs")
    atoms = load_dir("atoms")

    for d in domains.values():
        for b in d.get("blobs", []):
            if b not in blobs:
                errors.append(f"domain {d['id']}: unknown blob {b!r}")
    for b in blobs.values():
        if b.get("domain") not in domains:
            errors.append(f"blob {b['id']}: unknown domain {b.get('domain')!r}")
        for r in b.get("requires", []):
            if r not in blobs:
                errors.append(f"blob {b['id']}: unknown required blob {r!r}")
        for s in b.get("sections", []):
            for a in s.get("atoms", []):
                if a not in atoms:
                    errors.append(f"blob {b['id']}: unknown atom {a!r}")

    used = {a for b in blobs.values() for s in b.get("sections", []) for a in s.get("atoms", [])}
    for aid in atoms:
        if aid not in used:
            warnings.append(f"atom {aid}: not listed in any blob")

    n_ok = n_run = 0
    for aid, a in atoms.items():
        for f in ("title", "summary", "lesson"):
            if not a.get(f):
                errors.append(f"atom {aid}: missing {f}")
        for l in a.get("links", []) or []:
            if l.get("to") not in atoms:
                errors.append(f"atom {aid}: link to unknown atom {l.get('to')!r}")
            if l.get("kind") not in LINK_KINDS:
                errors.append(f"atom {aid}: bad link kind {l.get('kind')!r}")
        if only and aid not in only:
            continue
        seen = set()
        for kind in ("drills", "classics"):
            for ex in a.get(kind, []) or []:
                eid = ex.get("id")
                label = f"{aid}/{kind}/{eid}"
                if not eid or eid in seen:
                    errors.append(f"{label}: missing or duplicate id")
                seen.add(eid)
                for f in ("prompt", "solution", "check"):
                    if not ex.get(f):
                        errors.append(f"{label}: missing {f}")
                setup = block(ex.get("setup"))
                n_run += 1
                err = run(setup + block(ex.get("solution")) + block(ex.get("check")), label)
                if err:
                    errors.append(f"{label}: solution fails check: {err}")
                else:
                    n_ok += 1
                # The check must reject the untouched starter (otherwise it tests nothing).
                if run(setup + block(ex.get("starter")) + block(ex.get("check")), label) is None:
                    errors.append(f"{label}: check passes with the empty starter")

    n_cards = n_cards_ok = 0
    for cdir in sorted((CONTENT / "courses").glob("*/")):
        course = yaml.safe_load((cdir / "course.yaml").read_text())
        cid = course.get("id")
        if cid != cdir.name:
            errors.append(f"course {cdir.name}: id {cid!r} != folder name")
        if course.get("blob") not in blobs:
            errors.append(f"course {cid}: unknown blob {course.get('blob')!r}")
        chunk_files = {p.stem: p for p in (cdir / "chunks").glob("*.yaml")}
        for ch in course_chunks(course):
            if ch not in chunk_files:
                errors.append(f"course {cid}: chunk {ch!r} has no file")
        for stem in chunk_files:
            if stem not in course_chunks(course):
                warnings.append(f"course {cid}: chunk file {stem!r} not listed in course.yaml")
        skill_ids = set()
        for stem, p in sorted(chunk_files.items()):
            if only and stem not in only:
                continue
            try:
                ch = yaml.safe_load(p.read_text())
            except yaml.YAMLError as e:
                errors.append(f"{p.relative_to(ROOT)}: YAML error: {e}")
                continue
            where = f"{cid}/{stem}"
            if ch.get("id") != stem:
                errors.append(f"{where}: id {ch.get('id')!r} != file name")
            for f in ("title", "intro", "skills"):
                if not ch.get(f):
                    errors.append(f"{where}: missing {f}")
            for a in ch.get("atoms", []) or []:
                if a not in atoms:
                    errors.append(f"{where}: unknown atom {a!r}")
            for sk in ch.get("skills", []) or []:
                sid = sk.get("id", "")
                if not sid.startswith(stem + ".") or sid in skill_ids:
                    errors.append(f"{where}: skill id {sid!r} must be unique and start with '{stem}.'")
                skill_ids.add(sid)
                for f in ("name", "teach"):
                    if not sk.get(f):
                        errors.append(f"{where}/{sid}: missing {f}")
                cards = sk.get("cards", []) or []
                if len(cards) < 2:
                    errors.append(f"{where}/{sid}: needs at least 2 cards, has {len(cards)}")
                if len({c.get("id") for c in cards}) != len(cards):
                    errors.append(f"{where}/{sid}: duplicate card ids")
                for c in cards:
                    label = f"{where}/{sid}/{c.get('id')}"
                    for f in ("prompt", "solution", "check"):
                        if not c.get(f):
                            errors.append(f"{label}: missing {f}")
                    setup = block(c.get("setup"))
                    n_cards += 1
                    err = run(setup + block(c.get("solution")) + block(c.get("check")), label)
                    if err:
                        errors.append(f"{label}: solution fails check: {err}")
                    else:
                        n_cards_ok += 1
                    if run(setup + block(c.get("starter")) + block(c.get("check")), label) is None:
                        errors.append(f"{label}: check passes with the empty starter")

    print(f"{len(domains)} domains, {len(blobs)} blobs, {len(atoms)} atoms; {n_ok}/{n_run} solutions pass")
    print(f"courses: {n_cards_ok}/{n_cards} card solutions pass")
    for w in warnings:
        print("WARN ", w)
    for e in errors:
        print("ERROR", e)
    return 1 if errors else 0


if __name__ == "__main__":
    # Run under the interpreter from config.json (it has torch for the PyTorch course).
    cfg = ROOT / "config.json"
    py = json.loads(cfg.read_text()).get("python") if cfg.exists() else None
    if py and os.path.exists(py) and os.path.realpath(py) != os.path.realpath(sys.executable) and not os.environ.get("KM_REEXEC"):
        os.environ["KM_REEXEC"] = "1"
        os.execv(py, [py, __file__, *sys.argv[1:]])
    sys.exit(main(set(sys.argv[1:])))
