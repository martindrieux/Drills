// Review: drill-first sessions. You get the drills cold; the lesson is only a peek away.
import { h, fill, md, relDay, statusDot, STATUS_LABEL } from '../util.js';
import { store, atom, blob, blobAtoms, atomStatus, atomRecord, completeAtomReview, domainsWithBlobs } from '../store.js';
import { exerciseCard } from '../exercise.js';

const MODES = {
  due: { label: 'Due & learning', help: 'Atoms whose refresh is due, plus ones you started but have not nailed yet.', keep: (s) => s === 'due' || s === 'learning' },
  sweep: { label: 'Full sweep', help: 'Every atom in order, whatever its status. The fastest way to find gaps.', keep: () => true },
  new: { label: 'Unseen', help: 'Atoms you have never touched, in learning order.', keep: (s) => s === 'new' },
};

function scopeAtoms(scope) {
  if (scope.startsWith('blob:')) return blobAtoms(scope.slice(5));
  return [...new Set(domainsWithBlobs().flatMap((d) => d.blobList.flatMap((b) => blobAtoms(b.id))))];
}

function buildQueue(scope, mode) {
  return scopeAtoms(scope).filter((id) => atom(id)?.drills?.length && MODES[mode].keep(atomStatus(id)));
}

export function renderReview(root, kind, id) {
  if (kind === 'atom' && atom(id)) return runSession(root, [id], `${atom(id).title}`);
  return renderSetup(root, kind === 'blob' && blob(id) ? `blob:${id}` : 'all');
}

function renderSetup(root, initialScope) {
  let scope = initialScope;
  let mode = 'due';
  const preview = h('div');
  const startBtn = h('button.btn.primary', { onclick: () => {
    const q = buildQueue(scope, mode);
    if (!q.length) return;
    root.replaceChildren();
    runSession(root, q, `${scope === 'all' ? 'Everything' : blob(scope.slice(5)).title} · ${MODES[mode].label}`);
  } }, 'Start');

  const scopeSel = h('select', { onchange: () => { scope = scopeSel.value; update(); } },
    h('option', { value: 'all', selected: scope === 'all' }, 'Everything'),
    Object.values(store.content.blobs).map((b) => h('option', { value: `blob:${b.id}`, selected: scope === `blob:${b.id}` }, b.title)));
  const seg = h('div.seg', Object.entries(MODES).map(([k, m]) => h('button', { 'data-k': k, onclick: () => { mode = k; update(); } }, m.label)));
  const help = h('p.muted', { style: { margin: '0 0 6px' } });

  function update() {
    seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.k === mode));
    help.textContent = MODES[mode].help;
    const q = buildQueue(scope, mode);
    startBtn.disabled = !q.length;
    startBtn.textContent = q.length ? `Start · ${q.length} atom${q.length > 1 ? 's' : ''}` : 'Nothing to review';
    fill(preview, q.length
      ? h('ul.atom-list', q.map((aid) => h('li', h('div.atom-row', statusDot(atomStatus(aid)), h('span', h('span.t', atom(aid).title)), h('span.meta', `${atom(aid).drills.length} drills`)))))
      : h('div.empty', mode === 'due' ? 'Nothing is due here. Try a full sweep, or learn something unseen.' : 'No atoms match.'));
  }

  root.append(h('div.page',
    h('h1', 'Review'),
    h('p.muted', 'Drill-first: you get the drills cold. Only open the lesson if you are stuck. Pass every drill of an atom without revealing a solution and it moves up the refresh ladder (1 → 3 → 7 → 14 → 30 → 60 → 120 days). Miss one and it drops back to Learning.'),
    h('div.review-setup',
      h('div.row', h('span', 'Scope'), scopeSel, h('span', { style: { width: '12px' } }), h('span', 'Mode'), seg),
      help,
      h('div.row', { style: { marginTop: '14px' } }, startBtn),
      preview,
    ),
  ));
  update();
  return {};
}

function runSession(root, queue, title) {
  const results = []; // { id, ok, before }
  let ai = 0;
  let di = 0;
  let atomOk = true;
  const wrap = h('div.page');
  root.append(wrap);

  function step() {
    if (ai >= queue.length) return finish();
    const id = queue[ai];
    const a = atom(id);
    const drills = a.drills;
    const total = queue.length;
    const nextBtn = h('button.btn.primary', { disabled: true, onclick: advance }, di + 1 < drills.length ? 'Next drill →' : ai + 1 < total ? 'Next atom →' : 'Finish');
    const card = exerciseCard(id, 'drills', drills[di], di, {
      mode: 'review',
      onResult: (r) => {
        if (r === 'fail') atomOk = false;
        nextBtn.disabled = false;
        nextBtn.focus();
      },
    });
    fill(wrap, 
      h('div.review-progress',
        h('span', title),
        h('div.bar', h('span', { style: { width: `${(100 * ai) / total}%`, background: 'var(--accent)' } })),
        h('span', `Atom ${ai + 1}/${total} · drill ${di + 1}/${drills.length}`),
      ),
      h('div.review-atom-title',
        h('h1', a.title),
        (store.atomBlobs[id] || []).map((b) => h('span.chip.blob', blob(b).title)),
      ),
      h('p.muted', { style: { marginTop: 0 } }, a.summary),
      h('details.lesson', { style: { margin: '14px 0 18px' } },
        h('summary', 'Peek at the lesson', h('span.muted', ' — try without it first')),
        md(a.lesson)),
      card.el,
      h('div', { style: { display: 'flex', gap: '8px', marginTop: '14px', justifyContent: 'flex-end' } },
        h('button.btn.ghost', { onclick: skipAtom }, 'Skip atom'),
        nextBtn),
    );
    card.focus();
  }

  function advance() {
    const id = queue[ai];
    if (di + 1 < atom(id).drills.length) {
      di++;
    } else {
      const before = atomStatus(id);
      completeAtomReview(id, atomOk);
      results.push({ id, ok: atomOk, before });
      ai++;
      di = 0;
      atomOk = true;
    }
    step();
  }

  function skipAtom() {
    results.push({ id: queue[ai], skipped: true });
    ai++;
    di = 0;
    atomOk = true;
    step();
  }

  function finish() {
    const ok = results.filter((r) => r.ok).length;
    const missed = results.filter((r) => !r.ok && !r.skipped);
    fill(wrap, 
      h('h1', 'Session done'),
      h('p.muted', `${ok} recalled · ${missed.length} to relearn · ${results.filter((r) => r.skipped).length} skipped`),
      h('table.summary-table', results.map((r) => {
        const p = atomRecord(r.id);
        return h('tr',
          h('td', statusDot(atomStatus(r.id))),
          h('td', h('a', { href: `#/atom/${r.id}` }, atom(r.id).title)),
          h('td.muted', r.skipped ? 'skipped' : r.ok ? `recalled · next refresh ${relDay(p.due)}` : 'missed → open the lesson, then drill again'),
        );
      })),
      h('div', { style: { display: 'flex', gap: '8px', marginTop: '20px' } },
        h('a.btn.primary', { href: '#/outline' }, 'Back to outline'),
        h('a.btn', { href: '#/review', onclick: () => setTimeout(() => window.dispatchEvent(new HashChangeEvent('hashchange'))) }, 'New session')),
    );
  }

  step();
  return {};
}

export { STATUS_LABEL };
