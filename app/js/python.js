// Runs exercise code on the local server (tools/runner.py under config.json's Python, so torch works).

function setStatus(text, cls) {
  const el = document.getElementById('py-status');
  if (!el) return;
  el.textContent = text;
  el.className = `py-status ${cls || ''}`;
}

let warm = null;

/** Start the runner in the background and show which Python / torch it uses. */
export function warmUp() {
  warm ??= fetch('/api/runtime')
    .then((r) => r.json())
    .then((info) => {
      if (info.ready) setStatus(`Python ${info.python}${info.torch ? ` · torch ${info.torch.split('+')[0]}` : ''}`, 'ready');
      else setStatus('Python: failed to start', '');
    })
    .catch(() => setStatus('Python: server unreachable', ''));
  return warm;
}

/**
 * Run parts = [[label, source], ...] in one fresh namespace.
 * Resolves { ok, where, etype, msg, line, stdout } and never rejects.
 */
export async function runPython(parts) {
  try {
    const r = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts }),
    });
    return await r.json();
  } catch (e) {
    return { ok: false, where: 'runner', etype: 'NetworkError', msg: `Could not reach the local server: ${e.message}` };
  }
}
