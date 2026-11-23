// A course card: prompt + given + editor, auto-graded clean / struggled / failed.
import { h, md, codeBlock, dedent } from '../util.js';
import { runPython } from '../python.js';
import { formatResult } from '../exercise.js';
import { pythonEditor } from '../editor.js';

const isMac = navigator.platform.toUpperCase().includes('MAC');
export const RUN_KEY = isMac ? '⌘↵' : 'Ctrl↵';

/**
 * opts.onGrade(grade)  called once: 'clean' (first run passed, no peek), 'struggled', or 'failed'
 * opts.peeked()        whether the lesson was peeked (caps the grade at 'struggled')
 * opts.onCmdEnterAfterDone()  lets the session continue with the same shortcut
 * opts.meta            { cid, chunkId, sid } — enables the "Question this" button (opens the chat on this card)
 * opts.saved           { code, result, cls, passed } — what was typed here before, shown again (Read mode)
 * opts.onSave(state)   called when the code or result changes, with null once back to the starter (Read mode);
 *                      also adds a Clear button
 */
export function courseCard(card, opts = {}) {
  let failedRuns = 0;
  let done = false;
  let lastResult = '';
  let lastCls = '';
  const starter = dedent(card.starter || '');

  const editorEl = h('div.editor');
  const resultEl = h('div.result', { hidden: true });
  const revealEl = h('div');
  const runBtn = h('button.btn.primary', { onclick: () => run() }, 'Run ', h('kbd', RUN_KEY));
  const idkBtn = h('button.btn.ghost', { onclick: dontKnow }, "I don't know");
  const clearBtn = opts.onSave && h('button.btn.ghost', { title: 'Back to the starter code (your learning progress is kept)', onclick: () => clear() }, 'Clear');
  const el = h('div.ex',
    md(card.prompt, 'md.prompt'),
    card.setup && h('div.given', h('div.given-label', 'Given'), codeBlock(dedent(card.setup))),
    editorEl,
    h('div.ex-actions', runBtn, idkBtn, clearBtn,
      opts.meta && h('button.btn.ghost.question', {
        title: 'Something looks wrong or unclear? Discuss it; Claude explains, fixes the card if needed, and logs a report.',
        onclick: () => window.dispatchEvent(new CustomEvent('drill:question', {
          detail: { ...opts.meta, cardId: card.id, code: cm.getValue(), result: lastResult, revealed: done },
        })),
      }, '⚑ Question this')),
    resultEl,
    revealEl,
  );

  const saved = opts.saved;
  const cm = pythonEditor(editorEl, saved?.code ?? starter, {
    'Cmd-Enter': () => (done ? opts.onCmdEnterAfterDone?.() : run()),
    'Ctrl-Enter': () => (done ? opts.onCmdEnterAfterDone?.() : run()),
  });
  requestAnimationFrame(() => cm.refresh());
  if (saved?.result) showResult(saved.result, saved.cls);
  if (saved?.passed) el.classList.add('pass');
  if (opts.onSave) cm.on('change', persist);

  function showResult(text, cls) {
    resultEl.hidden = false;
    resultEl.className = `result ${cls}`;
    resultEl.textContent = text;
    lastResult = text;
    lastCls = cls;
  }

  function persist() {
    if (!opts.onSave) return;
    const code = cm.getValue();
    opts.onSave(code === starter && !lastResult ? null
      : { code, result: lastResult, cls: lastCls, passed: el.classList.contains('pass') });
  }

  function clear() {
    done = false;
    failedRuns = 0;
    lastResult = lastCls = '';
    resultEl.hidden = true;
    el.classList.remove('pass', 'fail');
    revealEl.replaceChildren();
    idkBtn.hidden = false;
    cm.setValue(starter);
    persist();
  }

  async function run() {
    runBtn.disabled = true;
    resultEl.hidden = false;
    resultEl.className = 'result info';
    resultEl.textContent = 'Running…';
    const r = await runPython([
      ['<setup>', dedent(card.setup || '')],
      ['<your code>', cm.getValue()],
      ['<check>', dedent(card.check || '')],
    ]);
    runBtn.disabled = false;
    const f = formatResult(r);
    showResult(f.text, f.cls);
    if (!done && r.ok) {
      el.classList.add('pass');
      finish(failedRuns === 0 && !opts.peeked?.() ? 'clean' : 'struggled');
    } else if (!done) {
      failedRuns++;
    }
    persist();
  }

  function dontKnow() {
    if (done) return;
    el.classList.add('fail');
    finish('failed');
  }

  function finish(g) {
    done = true;
    idkBtn.hidden = true;
    revealEl.append(h(g === 'failed' ? 'div.reveal' : 'details.reveal',
      g === 'failed' ? h('div.label', 'Solution') : h('summary.label', { style: { cursor: 'pointer' } }, 'Compare with the reference solution'),
      codeBlock(dedent(card.solution || ''))));
    opts.onGrade?.(g);
  }

  return { el, focus: () => cm.focus(), isDone: () => done, clear };
}
