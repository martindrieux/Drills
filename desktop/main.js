// Drills: a minimal Electron wrapper around the local knowledge-map web app.
// It runs serve.py from the project folder in place (nothing is bundled),
// waits for the "running at http://localhost:PORT" line, then loads that URL.

const { app, BrowserWindow, dialog, nativeTheme, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

app.setName('Drills');
// The app stores nothing secret: don't let Chromium ask the macOS keychain for its
// "Safe Storage" key (that is what triggers the repeated password popups).
app.commandLine.appendSwitch('use-mock-keychain');

const DARK_BG = '#151513';
const LIGHT_BG = '#f7f6f3';
const START_TIMEOUT_MS = 30000;
const URL_RE = /running at (http:\/\/localhost:\d+)/;

// Startup log (not in Documents, so it is always writable): ~/Library/Logs/Drills/main.log
const LOG = path.join(app.getPath('home'), 'Library', 'Logs', 'Drills', 'main.log');
function log(...parts) {
  try {
    fs.mkdirSync(path.dirname(LOG), { recursive: true });
    fs.appendFileSync(LOG, `${new Date().toISOString()} ${parts.join(' ')}\n`);
  } catch (_) { /* logging must never break startup */ }
}
process.on('uncaughtException', (e) => log('uncaught:', e.stack || e));

let win = null;
let server = null;      // Python child process
let serverUrl = null;   // e.g. http://localhost:54321
let quitting = false;

function bg() {
  return nativeTheme.shouldUseDarkColors ? DARK_BG : LIGHT_BG;
}

function projectRoot() {
  if (!app.isPackaged) return path.resolve(__dirname, '..');
  if (process.env.DRILLS_ROOT) return path.resolve(process.env.DRILLS_ROOT);
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'root.json'), 'utf8'));
    if (cfg.root) return cfg.root;
  } catch (_) { /* fall through */ }
  return '/Users/martindrieux/Drills';
}

function pythonPath(root) {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
    if (cfg.python) return cfg.python;
  } catch (_) { /* fall through */ }
  return 'python3';
}

function page(title, body) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Drills</title>
<style>
  :root { color-scheme: light dark; --bg: ${LIGHT_BG}; --fg: #2b2a26; --muted: #8a877f; }
  @media (prefers-color-scheme: dark) { :root { --bg: ${DARK_BG}; --fg: #e8e6e1; --muted: #8f8c84; } }
  html, body { height: 100%; margin: 0; background: var(--bg); color: var(--fg);
    font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; -webkit-app-region: drag; }
  body { display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 10px; }
  h1 { font-size: 16px; font-weight: 600; margin: 0; }
  p, pre { color: var(--muted); margin: 0; max-width: 80vw; white-space: pre-wrap; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--muted); animation: p 1s ease-in-out infinite alternate; }
  @keyframes p { from { opacity: .25; } to { opacity: 1; } }
</style></head><body>${body ? `<h1>${title}</h1>${body}` : `<div class="dot"></div><p>${title}</p>`}</body></html>`;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

function isLocal(url) {
  try {
    const u = new URL(url);
    return ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  } catch (_) {
    return false;
  }
}

function openExternalIfWeb(url) {
  if (/^https?:\/\//i.test(url) && !isLocal(url)) {
    shell.openExternal(url);
    return true;
  }
  return false;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    title: 'Drills',
    backgroundColor: bg(),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });

  nativeTheme.on('updated', () => { if (win && !win.isDestroyed()) win.setBackgroundColor(bg()); });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!openExternalIfWeb(url) && serverUrl && url.startsWith(serverUrl)) win.loadURL(url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    if (serverUrl && url.startsWith(serverUrl)) return;
    event.preventDefault();
    openExternalIfWeb(url);
  });

  win.webContents.on('did-finish-load', () => {
    if (serverUrl && win.webContents.getURL().startsWith(serverUrl)) {
      win.webContents.executeJavaScript("document.documentElement.classList.add('electron')").catch(() => {});
    }
  });

  win.on('closed', () => { win = null; });
  win.loadURL(page('Starting…'));
}

function fail(message, detail) {
  log('fail:', message, detail || '');
  if (quitting) return;
  dialog.showErrorBox('Drills could not start', `${message}\n\n${detail || ''}`.trim());
  app.quit();
}

function startServer() {
  const root = projectRoot();
  const python = pythonPath(root);
  log('start: packaged=', app.isPackaged, 'root=', root, 'python=', python);
  try { fs.accessSync(path.join(root, 'serve.py'), fs.constants.R_OK); log('serve.py readable'); } catch (e) { log('serve.py access error:', e.code, e.message); }
  if (!fs.existsSync(path.join(root, 'serve.py'))) {
    fail(`serve.py not found in:\n${root}`, 'Set DRILLS_ROOT or edit desktop/root.json to point at the project folder.');
    return;
  }

  let stdout = '';
  let stderr = '';
  const timer = setTimeout(() => {
    if (!serverUrl) fail(`Timed out waiting for the server (${python} serve.py).`, stderr || stdout);
  }, START_TIMEOUT_MS);

  server = spawn(python, ['serve.py', '--no-open', '--port', '0'], {
    cwd: root,
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  server.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
    process.stdout.write(chunk);
    if (serverUrl) return;
    const m = stdout.match(URL_RE);
    if (m) {
      serverUrl = m[1];
      clearTimeout(timer);
      if (win) win.loadURL(serverUrl);
    }
  });

  server.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
    if (stderr.length > 20000) stderr = stderr.slice(-20000);
    process.stderr.write(chunk);
  });

  server.on('error', (err) => {
    clearTimeout(timer);
    fail(`Could not run Python: ${python}`, `${err.message}\n\nSet "python" in ${path.join(root, 'config.json')}.`);
  });

  server.on('exit', (code, signal) => {
    clearTimeout(timer);
    server = null;
    if (quitting) return;
    const what = serverUrl ? 'The Python server stopped unexpectedly' : 'The Python server exited before it was ready';
    fail(`${what} (code ${code}${signal ? `, signal ${signal}` : ''}).`, stderr || stdout);
  });
}

function stopServer() {
  quitting = true;
  if (server && server.exitCode === null) {
    try { server.kill('SIGTERM'); } catch (_) { /* already gone */ }
  }
}

const gotLock = app.requestSingleInstanceLock();
log('launch: pid', process.pid, 'singleInstanceLock', gotLock);
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });

  app.whenReady().then(() => {
    createWindow();
    startServer();
  });

  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', stopServer);
  app.on('will-quit', stopServer);
  process.on('exit', stopServer);
  process.on('SIGINT', () => { stopServer(); app.quit(); });
  process.on('SIGTERM', () => { stopServer(); app.quit(); });
}
