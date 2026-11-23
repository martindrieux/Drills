"""Local server for the knowledge map.

    python3 serve.py            # http://localhost:8765, opens the browser
    python3 serve.py --no-open  # don't open the browser

Serves the app from ./app, reads all YAML under ./content on every request
(edit a file, refresh the page), and stores your progress in ./progress.json.
"""
import argparse
import json
import os
import select
import shutil
import subprocess
import tempfile
import threading
import webbrowser
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content"
PROGRESS = ROOT / "progress.json"
ANSWERS = ROOT / "answers.json"  # code typed in Read mode, restored when the page is reopened
CONFIG = json.loads((ROOT / "config.json").read_text()) if (ROOT / "config.json").exists() else {}
PYTHON = CONFIG.get("python") or "python3"


class Runner:
    """One long-lived tools/runner.py process (under config.json's Python, so torch works)."""

    def __init__(self):
        self.proc = None
        self.info = {}
        self.lock = threading.Lock()

    def _start(self):
        self.proc = subprocess.Popen([PYTHON, str(ROOT / "tools" / "runner.py")], cwd=ROOT, text=True, bufsize=1,
                                     stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        self.info = self._read(60) or {"ready": False}

    def _read(self, timeout):
        ready, _, _ = select.select([self.proc.stdout], [], [], timeout)
        line = self.proc.stdout.readline() if ready else ""
        return json.loads(line) if line else None

    def _kill(self):
        if self.proc:
            self.proc.kill()
            self.proc.wait()
        self.proc = None

    def warm(self):
        with self.lock:
            if not self.proc or self.proc.poll() is not None:
                self._start()
            return self.info

    def run(self, parts, timeout=10):
        with self.lock:
            if not self.proc or self.proc.poll() is not None:
                self._start()
            try:
                self.proc.stdin.write(json.dumps({"parts": parts}) + "\n")
                self.proc.stdin.flush()
                res = self._read(timeout)
            except (BrokenPipeError, ValueError):
                res = None
            if res is None:  # infinite loop or crash: start a fresh runner
                self._kill()
                return {"ok": False, "where": "runner", "etype": "Timeout",
                        "msg": f"Stopped after {timeout}s (infinite loop?)"}
            return res


RUNNER = Runner()

BACKUPS = ROOT / "backups"


def backup_progress(path=PROGRESS, keep=50, every_s=600):
    """Before overwriting progress.json (or answers.json), keep a copy at most every 10 minutes (the last 50 copies)."""
    if not path.exists():
        return
    BACKUPS.mkdir(exist_ok=True)
    copies = sorted(BACKUPS.glob(f"{path.stem}-*.json"))
    import time
    if copies and time.time() - copies[-1].stat().st_mtime < every_s:
        return
    shutil.copy2(path, BACKUPS / f"{path.stem}-{time.strftime('%Y%m%d-%H%M%S')}.json")
    for old in copies[: max(0, len(copies) + 1 - keep)]:
        old.unlink()

AUTHOR_TOOLS = "Read,Write,Edit,Glob,Grep,Bash(python3 tools/validate.py:*),Bash(python3 tools/try_card.py:*)"
FEEDBACK = ROOT / "feedback"


def claude_bin():
    return shutil.which("claude") or str(Path.home() / ".local" / "bin" / "claude")


def author_events(prompt, session_id=None):
    """Run Claude Code on the content (see CLAUDE.md) and yield simplified progress events."""
    cmd = [claude_bin(), "-p", prompt, "--output-format", "stream-json", "--verbose",
           "--permission-mode", "acceptEdits", "--allowedTools", AUTHOR_TOOLS]
    if session_id:
        cmd += ["--resume", session_id]
    try:
        proc = subprocess.Popen(cmd, cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                stdin=subprocess.DEVNULL)
    except FileNotFoundError:
        yield {"kind": "error", "text": "Claude Code (`claude`) was not found on this machine."}
        return
    for line in proc.stdout:
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        if ev.get("type") == "system" and ev.get("session_id"):
            yield {"kind": "session", "id": ev["session_id"]}
        elif ev.get("type") == "assistant":
            for block in ev.get("message", {}).get("content", []):
                if block.get("type") == "text" and block.get("text", "").strip():
                    yield {"kind": "text", "text": block["text"]}
                elif block.get("type") == "tool_use":
                    inp = block.get("input", {})
                    detail = inp.get("file_path") or inp.get("command") or inp.get("pattern") or ""
                    yield {"kind": "tool", "name": block.get("name"), "detail": str(detail).replace(str(ROOT) + "/", "")}
        elif ev.get("type") == "result":
            yield {"kind": "done", "text": ev.get("result", ""), "sessionId": ev.get("session_id"),
                   "isError": ev.get("is_error", False)}
    proc.wait()
    if proc.returncode:
        err = proc.stderr.read().strip()
        if err:
            yield {"kind": "error", "text": err[-2000:]}


def load_content():
    out = {"domains": {}, "blobs": {}, "atoms": {}, "errors": []}
    for kind in ("domains", "blobs", "atoms"):
        for p in sorted((CONTENT / kind).glob("*.yaml")):
            try:
                data = yaml.safe_load(p.read_text())
                if not isinstance(data, dict):
                    raise ValueError("not a mapping")
                data.setdefault("id", p.stem)
                out[kind][data["id"]] = data
            except Exception as e:  # noqa: BLE001 - surface any bad file in the UI
                out["errors"].append(f"{p.relative_to(ROOT)}: {e}")
    out["courses"] = {}
    for cfile in sorted(CONTENT.glob("courses/*/course.yaml")):
        try:
            course = yaml.safe_load(cfile.read_text())
            if course.get("parts") and not course.get("chunks"):
                course["chunks"] = [c for part in course["parts"] for c in part.get("chunks", [])]
            chunks = {}
            for cid in course.get("chunks", []):
                p = cfile.parent / "chunks" / f"{cid}.yaml"
                if not p.exists():  # chunks not written yet are simply skipped
                    continue
                try:
                    chunks[cid] = yaml.safe_load(p.read_text())
                except Exception as e:  # noqa: BLE001 - one bad page must not hide the course
                    out["errors"].append(f"{p.relative_to(ROOT)}: {e}")
            course["chunkData"] = chunks
            out["courses"][course["id"]] = course
        except Exception as e:  # noqa: BLE001
            out["errors"].append(f"{cfile.relative_to(ROOT)}: {e}")
    return out


STORES = {"/api/progress": PROGRESS, "/api/answers": ANSWERS}


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, obj, status=200):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/content":
            return self._json(load_content())
        if self.path in STORES:
            path = STORES[self.path]
            data = json.loads(path.read_text()) if path.exists() else {}
            return self._json(data)
        if self.path == "/api/runtime":
            return self._json(RUNNER.warm())
        return super().do_GET()

    def _body(self):
        return json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")

    def do_POST(self):
        if self.path == "/api/answers":  # sendBeacon (window closing) can only POST
            return self.do_PUT()
        if self.path == "/api/run":
            return self._json(RUNNER.run(self._body().get("parts", [])))
        if self.path == "/api/author":
            body = self._body()
            if body.get("report"):
                # Raw log of every questioned card (Claude adds its verdict to feedback/reports.md).
                FEEDBACK.mkdir(exist_ok=True)
                rec = {"at": __import__("datetime").datetime.now().isoformat(timespec="seconds"), **body["report"]}
                with open(FEEDBACK / "questions.jsonl", "a") as f:
                    f.write(json.dumps(rec) + "\n")
            # Stream newline-delimited JSON events until Claude Code finishes.
            self.send_response(200)
            self.send_header("Content-Type", "application/x-ndjson")
            self.end_headers()
            for ev in author_events(body.get("prompt", ""), body.get("sessionId")):
                self.wfile.write((json.dumps(ev) + "\n").encode())
                self.wfile.flush()
            return None
        return self._json({"error": "not found"}, 404)

    def do_PUT(self):
        if self.path not in STORES:
            return self._json({"error": "not found"}, 404)
        path = STORES[self.path]
        raw = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        data = json.loads(raw)
        backup_progress(path)
        # Write atomically so a crash never leaves a half-written file.
        fd, tmp = tempfile.mkstemp(dir=ROOT, suffix=".tmp")
        with os.fdopen(fd, "w") as f:
            json.dump(data, f, indent=1, sort_keys=True)
        os.replace(tmp, path)
        return self._json({"ok": True})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--no-open", action="store_true")
    args = ap.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), partial(Handler, directory=str(ROOT / "app")))
    url = f"http://localhost:{server.server_address[1]}"
    print(f"Knowledge map running at {url}  (Ctrl+C to stop)", flush=True)
    if not args.no_open:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
