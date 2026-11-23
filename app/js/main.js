// Boot + hash router. The app is just the drill courses (+ the chat panel to edit them).
import { h } from './util.js';
import { store, load, reloadContent } from './store.js';
import { warmUp } from './python.js';
import { renderCourses, renderCourse, renderRead } from './views/course.js';
import { renderSession } from './views/session.js';
import { initChat } from './chat.js';
import { loadAnswers } from './course/answers.js';

const view = document.getElementById('view');
let current = {};

function parse() {
  return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
}

function route() {
  current.destroy?.();
  view.replaceChildren();
  view.scrollTop = 0;
  // #/learn · #/learn/<course> · #/learn/<course>/read/<page> · #/learn/<course>/session[/chunk|test/<page>]
  const [, cid, sub, a, b] = parse();
  if (!cid || !store.content.courses?.[cid]) current = renderCourses(view);
  else if (sub === 'session') current = renderSession(view, cid, a || 'auto', b);
  else if (sub === 'read') current = renderRead(view, cid, a);
  else current = renderCourse(view, cid);
  current ||= {};
}

function showErrors() {
  const el = document.getElementById('content-errors');
  el.hidden = !store.content.errors.length;
  el.textContent = store.content.errors.length ? `Some content files could not be read:\n${store.content.errors.join('\n')}` : '';
}

/** After Claude edits content: reload it, and re-render unless a session is running. */
async function onContentChanged() {
  await reloadContent();
  showErrors();
  if (parse()[2] === 'session') {
    return h('div.msg-note', 'Saved. If a card on screen changed, click ↻ on it to retry the new version.');
  }
  route();
  return h('div.msg-note', 'Saved and reloaded.');
}

/**
 * New lessons (added by Claude in another window, or by hand) show up when you come back to the app:
 * on focus, re-read the content and redraw only if it changed, and never in the middle of a session.
 */
let contentSig = '';
async function refreshIfChanged() {
  if (parse()[2] === 'session') return;
  try {
    const sig = JSON.stringify(await fetch('/api/content').then((r) => r.json()));
    if (sig === contentSig) return;
    await reloadContent();
    contentSig = JSON.stringify(store.content);
    showErrors();
    route();
  } catch { /* server briefly unreachable: try again on next focus */ }
}

async function boot() {
  try {
    await Promise.all([load(), loadAnswers()]);
  } catch (e) {
    view.append(h('div.page', h('div.empty', 'Could not reach the local server. Start it with ', h('code', 'python3 serve.py'), '.')));
    return;
  }
  showErrors();
  contentSig = JSON.stringify(store.content);
  initChat({ onContentChanged });
  warmUp();
  window.addEventListener('hashchange', route);
  window.addEventListener('focus', refreshIfChanged);
  if (!location.hash) location.hash = '#/learn';
  route();
}

boot();
