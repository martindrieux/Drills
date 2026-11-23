// One exercise card (drill or classic): prompt, read-only setup, editor, run against hidden checks.
import { h, md, codeBlock, dedent, relDay } from './util.js';
import { runPython } from './python.js';
import { pythonEditor } from './editor.js';
import { recordExercise, exerciseState } from './store.js';

const isMac = navigator.platform.toUpperCase().includes('MAC');
const RUN_KEY = isMac ? '⌘↵' : 'Ctrl↵';

function draftKey(atomId, kind, exId) {
  return `km:draft:${atomId}:${kind}:${exId}`;
}
function loadDraft(k) {
  try { return localStorage.getItem(k); } catch { return null; }
}
function saveDraft(k, v) {
  try { localStorage.setItem(k, v); } catch { /* storage unavailable: drafts are a convenience */ }
}

export function formatResult(r) {
  const out = r.stdout ? `\n\nOutput:\n${r.stdout}` : '';
  if (r.ok) return { cls: 'ok', text: `✓ All checks passed${out}` };
  if (r.where === '<check>') {
    if (r.etype === 'AssertionError') return { cls: 'err', text: `✗ Check failed${r.msg ? `: ${r.msg}` : ''}${out}` };
    return { cls: 'err', text: `✗ ${r.etype}: ${r.msg}${out}` };
  }
  if (r.where === '<your code>') return { cls: 'err', text: `✗ Line ${r.line ?? '?'}: ${r.etype}: ${r.msg}${out}` };
  if (r.where === '<setup>') return { cls: 'err', text: `Setup error (content bug): ${r.etype}: ${r.msg}` };
  return { cls: 'err', text: `${r.etype}: ${r.msg}` };
}

/**
 * mode 'practice': results feed the atom's status directly; classic drafts are kept.
 * mode 'review': always starts from the starter; reports once via onResult('pass' | 'fail').
 */
export function exerciseCard(atomId, kind, ex, index, { mode = 'practice', onResult } = {}) {
  const isClassic = kind === 'classics';
  const dKey = draftKey(atomId, kind, ex.id);
  const starter = dedent(ex.starter || '');
  const initial = mode === 'practice' && isClassic ? loadDraft(dKey) ?? starter : starter;
  let passed = false;
  let reported = false;
  let hintsShown = 0;

  const prev = exerciseState(atomId, kind, ex.id);
  const stateEl = h('span.faint');
  const renderState = () => {
    const s = exerciseState(atomId, kind, ex.id);
    stateEl.textContent = s ? `${s.result === 'pass' ? 'passed' : 'missed'} ${relDay(s.at)}` : '';
  };
  if (mode === 'practice') renderState();

  const head = h('div.ex-head',
    isClassic
      ? [h('h3', ex.title), ex.difficulty && h(`span.diff.${ex.difficulty}`, ex.difficulty)]
      : h('span.num', `Drill ${index + 1}`),
    h('div.right',
      stateEl,
      ex.url && h('a', { href: ex.url, target: '_blank', rel: 'noopener' }, 'LeetCode ↗'),
    ),
  );

  const editorEl = h('div.editor');
  const resultEl = h('div.result', { hidden: true });
  const revealEl = h('div');
  const hintEl = h('div');
  const runBtn = h('button.btn.primary', { onclick: () => run() }, 'Run ', h('kbd', RUN_KEY));
  const hintBtn = isClassic && ex.hints?.length ? h('button.btn', { onclick: showHint }, 'Hint') : null;
  const solBtn = h('button.btn.ghost', { onclick: reveal }, mode === 'review' ? "I don't know — show solution" : 'Show solution');
  const resetBtn = h('button.btn.ghost', { onclick: () => cm.setValue(starter) }, 'Reset');

  const card = h(`div.ex${prev && mode === 'practice' ? `.${prev.result}` : ''}`,
    head,
    md(ex.prompt, 'md.prompt'),
    ex.setup && h('div.given', h('div.given-label', 'Given (runs before your code)'), codeBlock(dedent(ex.setup))),
    editorEl,
    h('div.ex-actions', runBtn, hintBtn, solBtn, resetBtn),
    hintEl,
    resultEl,
    revealEl,
  );

  const cm = pythonEditor(editorEl, initial, {
    'Cmd-Enter': () => run(),
    'Ctrl-Enter': () => run(),
  });
  if (mode === 'practice' && isClassic) cm.on('change', () => saveDraft(dKey, cm.getValue()));
  requestAnimationFrame(() => cm.refresh());

  function report(result) {
    if (mode === 'review') {
      if (!reported) {
        reported = true;
        recordExercise(atomId, kind, ex.id, result, { auto: false });
        onResult?.(result);
      }
    } else {
      recordExercise(atomId, kind, ex.id, result);
      renderState();
    }
  }

  async function run() {
    runBtn.disabled = true;
    resultEl.hidden = false;
    resultEl.className = 'result info';
    resultEl.textContent = 'Running…';
    const r = await runPython([
      ['<setup>', dedent(ex.setup || '')],
      ['<your code>', cm.getValue()],
      ['<check>', dedent(ex.check || '')],
    ]);
    runBtn.disabled = false;
    const f = formatResult(r);
    resultEl.className = `result ${f.cls}`;
    resultEl.textContent = f.text;
    if (r.ok) {
      card.classList.remove('fail');
      card.classList.add('pass');
      if (!passed) {
        passed = true;
        report('pass');
        showTakeaway();
      }
    }
  }

  function showHint() {
    if (hintsShown >= ex.hints.length) return;
    hintEl.append(h('div.hint', md(ex.hints[hintsShown++], 'md')));
    if (hintsShown >= ex.hints.length) hintBtn.disabled = true;
  }

  function reveal() {
    if (revealEl.dataset.shown) return;
    revealEl.dataset.shown = '1';
    if (!passed) {
      card.classList.add('fail');
      report('fail');
    }
    revealEl.append(h('div.reveal', h('div.label', 'Reference solution'), codeBlock(dedent(ex.solution || ''))));
    showTakeaway();
    solBtn.disabled = true;
  }

  function showTakeaway() {
    if (ex.takeaway && !card.querySelector('.takeaway')) revealEl.append(h('div.takeaway', ex.takeaway));
  }

  return { el: card, focus: () => cm.focus(), refresh: () => cm.refresh() };
}
