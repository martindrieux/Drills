// Atom page: connections, lesson, drills, classics, and prev/next within each blob.
import { h, md, relDay, statusDot, STATUS_LABEL, KIND } from '../util.js';
import { store, atom, blob, blobAtoms, atomStatus, atomRecord, markLessonRead, resetAtom } from '../store.js';
import { exerciseCard } from '../exercise.js';

export function linkCards(id) {
  const links = store.links[id] || [];
  if (!links.length) return null;
  const order = ['prereq', 'uses', 'contrast', 'variant'];
  links.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || (a.dir > b.dir ? 1 : -1));
  return h('div.links-grid', links.map((l) => {
    const other = atom(l.other);
    const comparable = l.kind === 'contrast' || l.kind === 'variant';
    return h('a.link-card', { href: `#/atom/${l.other}`, style: { '--kind-color': KIND[l.kind].color } },
      h('div.k', KIND[l.kind][l.dir]),
      h('div.t', statusDot(atomStatus(l.other)), other.title),
      l.note && h('div.n', l.note),
      comparable && h('span.cmp', {
        onclick: (e) => { e.preventDefault(); location.hash = `#/compare/${id}/${l.other}`; },
      }, 'Compare side by side →'),
    );
  }));
}

function statusLine(id) {
  const st = atomStatus(id);
  const p = atomRecord(id);
  const extra = st === 'known' ? ` · next refresh ${relDay(p.due)}` : st === 'due' ? ` · was due ${relDay(p.due)}` : '';
  return h('span.status-badge', statusDot(st), STATUS_LABEL[st] + extra);
}

function blobNav(id) {
  return (store.atomBlobs[id] || []).map((bid) => {
    const list = blobAtoms(bid);
    const i = list.indexOf(id);
    const prev = list[i - 1];
    const next = list[i + 1];
    return h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderTop: '1px solid var(--border)' } },
      prev ? h('a', { href: `#/atom/${prev}` }, `← ${atom(prev).title}`) : h('span'),
      h('span.faint', { style: { fontSize: '13px' } }, `${blob(bid).title} · ${i + 1}/${list.length}`),
      next ? h('a', { href: `#/atom/${next}` }, `${atom(next).title} →`) : h('span'),
    );
  });
}

export function renderAtom(root, id) {
  const a = atom(id);
  if (!a) {
    root.append(h('div.page', h('div.empty', `No atom "${id}". `, h('a', { href: '#/outline' }, 'Back to outline'))));
    return {};
  }
  const st = atomStatus(id);
  const statusHolder = h('span', statusLine(id));
  const readBtn = h('button.btn', {
    onclick: () => { markLessonRead(id); readBtn.disabled = true; readBtn.textContent = 'Lesson read ✓'; },
    disabled: !!atomRecord(id).lessonRead,
  }, atomRecord(id).lessonRead ? 'Lesson read ✓' : 'Mark lesson read');

  // Drill-first: once you know an atom, the lesson starts collapsed.
  const lessonOpen = st === 'new' || st === 'learning';

  const page = h('div.page',
    h('div.atom-head',
      h('div.chips',
        (store.atomBlobs[id] || []).map((bid) => h('a.chip.blob', { href: `#/outline/${bid}` }, blob(bid).title)),
        (store.atomBlobs[id] || []).length > 1 && h('span.chip', { title: 'This atom is shared: progress counts in every blob' }, 'shared'),
      ),
      h('h1', a.title),
      h('p.summary', a.summary),
      h('div.actions',
        statusHolder,
        h('span', { style: { flex: 1 } }),
        readBtn,
        a.drills?.length && h('a.btn.primary', { href: `#/review/atom/${id}` }, 'Test me (drills only)'),
        h('button.btn.ghost', {
          onclick: () => { if (confirm('Forget all progress on this atom?')) { resetAtom(id); location.reload(); } },
        }, 'Reset'),
      ),
    ),
    linkCards(id) && [h('h2', 'Connections'), linkCards(id)],
    h('h2', 'Lesson'),
    h(`details.lesson${lessonOpen ? '' : ''}`, { open: lessonOpen },
      h('summary', 'Course', !lessonOpen && h('span.muted', ' — collapsed because you already know this; try the drills first')),
      md(a.lesson),
    ),
    a.drills?.length && [
      h('h2', 'Drills'),
      h('p.muted', { style: { marginTop: '-6px' } }, 'Minimal recall exercises. Pass them all and the atom becomes Known; it comes back for a refresh later.'),
      h('div.ex-list', a.drills.map((d, i) => exerciseCard(id, 'drills', d, i).el)),
    ],
    a.classics?.length && [
      h('h2', 'Classic problems'),
      h('div.ex-list', a.classics.map((c, i) => exerciseCard(id, 'classics', c, i).el)),
    ],
    h('div', { style: { marginTop: '40px' } }, blobNav(id)),
  );
  root.append(page);
  return {
    onStoreChange: () => statusHolder.replaceChildren(statusLine(id)),
  };
}
