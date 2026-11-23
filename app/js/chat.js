// "Edit with Claude": a chat panel that sends requests to Claude Code (via /api/author), which edits the
// course YAML in place and validates it. The app then reloads the content.
import { h, fill, md } from './util.js';
import { store } from './store.js';

const SUGGESTIONS = [
  'Add a page on Python string formatting to the Python course',
  'Make the lesson of the skill I am looking at shorter',
  'Add a harder third card to this skill',
  'Create a new course: SQL window functions for interviews',
];

let panel;
let list;
let input;
let sendBtn;
let ctxChip;
let sessionId = null;
let pinned = null; // explicit context from an "Edit" button
let busy = false;
let onChanged = () => {};

function contextNow() {
  return pinned || window.drillContext || {};
}

function describe(ctx) {
  const c = store.content.courses?.[ctx.cid];
  if (!c) return null;
  const ch = ctx.chunkId && c.chunkData?.[ctx.chunkId];
  if (ctx.question) {
    const skill = ch?.skills?.find((s) => s.id === ctx.sid);
    return {
      label: `⚑ ${skill?.name || ctx.sid} · card ${ctx.cardId}`,
      prompt: '[The learner is questioning an exercise card in the app. Follow the CLAUDE.md section '
        + '"When the learner questions a card".\n'
        + `Card: content/courses/${c.id}/chunks/${ch?.id}.yaml, skill "${ctx.sid}", card "${ctx.cardId}".\n`
        + `Learner's code:\n\`\`\`python\n${ctx.code || '(empty)'}\n\`\`\`\n`
        + `Result shown to the learner: ${ctx.result || '(not run yet)'}\n`
        + `Solution already revealed to the learner: ${ctx.revealed ? 'yes' : 'no'}]`,
      report: { cid: c.id, chunkId: ch?.id, sid: ctx.sid, cardId: ctx.cardId, code: ctx.code, result: ctx.result },
    };
  }
  const skills = (ctx.sids || []).map((sid) => ch?.skills?.find((s) => s.id === sid)?.name).filter(Boolean);
  return {
    label: [c.title, ch?.title, skills.join(', ')].filter(Boolean).join(' › '),
    prompt: `[App context: course "${c.title}" (content/courses/${c.id}/course.yaml)`
      + (ch ? `, page "${ch.title}" (content/courses/${c.id}/chunks/${ch.id}.yaml)` : '')
      + (ctx.sids?.length ? `, skill ids: ${ctx.sids.join(', ')}` : '')
      + ']',
  };
}

function renderChip() {
  const d = describe(contextNow());
  fill(ctxChip, d ? [h('span.faint', 'About: '), d.label, h('button.chip-x', { title: 'Do not send this context', onclick: () => { pinned = { none: true }; renderChip(); } }, '×')] : h('span.faint', 'No page context'));
}

function addMsg(cls, ...children) {
  const el = h(`div.msg.${cls}`, ...children);
  list.append(el);
  list.scrollTop = list.scrollHeight;
  return el;
}

function renderEmpty() {
  if (list.childElementCount) return;
  list.append(h('div.chat-empty',
    h('p', 'Ask for a new lesson, a whole new course, or a change to what you are looking at. Claude Code edits the lesson files, checks every exercise, and the app reloads.'),
    SUGGESTIONS.map((s) => h('button.suggestion', { onclick: () => { input.value = s; input.focus(); } }, s)),
  ));
}

async function send() {
  const text = input.value.trim();
  if (!text || busy) return;
  list.querySelector('.chat-empty')?.remove();
  busy = true;
  sendBtn.disabled = true;
  input.value = '';
  const ctx = contextNow();
  const d = ctx.none ? null : describe(ctx);
  // The card details and the report go with the first message only; follow-ups stay on the skill.
  if (ctx.question) pinned = { cid: ctx.cid, chunkId: ctx.chunkId, sids: [ctx.sid] };
  addMsg('user', text, d && h('div.msg-ctx', d.label));
  const reply = addMsg('assistant');
  const status = h('div.msg-status', h('span.spinner'), 'Working…');
  reply.append(status);
  let lastText = '';
  let changed = false;
  try {
    const res = await fetch('/api/author', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: d ? `${text}\n\n${d.prompt}` : text,
        sessionId,
        report: d?.report ? { ...d.report, concern: text } : undefined,
      }),
    });
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        const ev = JSON.parse(line);
        if (ev.kind === 'session') sessionId = ev.id;
        else if (ev.kind === 'tool') {
          if (['Edit', 'Write'].includes(ev.name)) changed = true;
          const verb = { Edit: 'Editing', Write: 'Writing', Read: 'Reading', Bash: 'Running', Glob: 'Searching', Grep: 'Searching' }[ev.name] || ev.name;
          reply.insertBefore(h('div.msg-tool', `${verb} ${ev.detail}`), status);
        } else if (ev.kind === 'text') {
          lastText = ev.text;
          reply.insertBefore(md(ev.text, 'md.msg-text'), status);
        } else if (ev.kind === 'done') {
          if (ev.sessionId) sessionId = ev.sessionId;
          if (ev.text && ev.text.trim() !== lastText.trim()) reply.insertBefore(md(ev.text, 'md.msg-text'), status);
        } else if (ev.kind === 'error') {
          reply.insertBefore(h('div.msg-error', ev.text), status);
        }
        list.scrollTop = list.scrollHeight;
      }
    }
  } catch (e) {
    reply.insertBefore(h('div.msg-error', `Could not reach the local server: ${e.message}`), status);
  }
  status.remove();
  busy = false;
  sendBtn.disabled = false;
  if (changed) {
    const note = await onChanged();
    if (note) reply.append(note);
    window.dispatchEvent(new CustomEvent('drill:content-reloaded'));
  }
  renderChip();
}

export function openChat(context) {
  if (context) pinned = context;
  document.body.classList.add('chat-open');
  renderChip();
  renderEmpty();
  input.focus();
}

function closeChat() {
  document.body.classList.remove('chat-open');
}

/** onContentChanged() reloads content; it may return a node to show under the reply. */
export function initChat({ onContentChanged }) {
  onChanged = onContentChanged;
  ctxChip = h('div.chat-ctx');
  list = h('div.chat-list');
  input = h('textarea', {
    rows: 3,
    placeholder: 'e.g. "Add a page on PyTorch hooks with 4 skills"   (Enter to send, Shift+Enter for a new line)',
    onkeydown: (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
  });
  sendBtn = h('button.btn.primary', { onclick: send }, 'Send');
  panel = h('aside.chat',
    h('div.chat-head',
      h('b', 'Edit with Claude'),
      h('span', { style: { flex: 1 } }),
      h('button.btn.ghost.small', { title: 'Start a fresh conversation', onclick: () => { sessionId = null; list.replaceChildren(); renderEmpty(); } }, 'New chat'),
      h('button.btn.ghost.small', { onclick: closeChat, title: 'Close' }, '×'),
    ),
    list,
    h('div.chat-input', ctxChip, input, h('div.chat-send', h('span.faint', 'Runs Claude Code on this folder'), sendBtn)),
  );
  document.body.append(panel);
  document.getElementById('chat-toggle')?.addEventListener('click', () => {
    if (document.body.classList.contains('chat-open')) closeChat();
    else {
      pinned = null;
      openChat();
    }
  });
  window.addEventListener('hashchange', () => {
    if (!busy) pinned = null;
    if (document.body.classList.contains('chat-open')) setTimeout(renderChip, 50);
  });
  window.addEventListener('drill:edit', (e) => openChat(e.detail));
  window.addEventListener('drill:question', (e) => {
    sessionId = null; // each questioned card gets its own conversation
    list.replaceChildren();
    openChat({ ...e.detail, question: true });
    input.placeholder = 'What looks wrong? e.g. "my answer should be accepted", "the prompt is ambiguous", "why is it done this way?"';
  });
}
