// Compare two atoms side by side (lessons + how they relate).
import { h, md, KIND, statusDot } from '../util.js';
import { store, atom, blob, atomStatus } from '../store.js';

function picker(current, other, side) {
  const sel = h('select', {
    onchange: () => {
      const [a, b] = side === 0 ? [sel.value, other] : [other, sel.value];
      location.hash = `#/compare/${a}/${b}`;
    },
    style: { padding: '5px 8px', borderRadius: '8px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: '13px', maxWidth: '100%' },
  }, Object.values(store.content.atoms)
    .sort((x, y) => x.title.localeCompare(y.title))
    .map((a) => h('option', { value: a.id, selected: a.id === current }, a.title)));
  return sel;
}

function column(id, other, side) {
  const a = atom(id);
  return h('div.compare-col',
    picker(id, other, side),
    h('h2', { style: { marginTop: '14px' } }, h('a', { href: `#/atom/${id}`, style: { color: 'inherit' } }, a.title)),
    h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '8px' } },
      statusDot(atomStatus(id)),
      (store.atomBlobs[id] || []).map((b) => h('span.chip.blob', blob(b).title))),
    h('p.muted', a.summary),
    md(a.lesson),
  );
}

export function renderCompare(root, a, b) {
  if (!atom(a) || !atom(b)) {
    root.append(h('div.page', h('div.empty', 'Unknown atom.')));
    return {};
  }
  const rel = (store.links[a] || []).filter((l) => l.other === b);
  root.append(h('div.page.compare-wide',
    h('div.faint', { style: { fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 } }, 'Compare'),
    h('h1', `${atom(a).title.split(' — ')[0]}  vs  ${atom(b).title.split(' — ')[0]}`),
    rel.length
      ? rel.map((l) => h('p', { style: { borderLeft: `3px solid ${KIND[l.kind].color}`, padding: '4px 12px', margin: '8px 0 20px' } },
        h('b', { style: { color: KIND[l.kind].color } }, `${l.kind}: `), l.note || ''))
      : h('p.muted', 'No declared link between these two atoms yet. If they are worth comparing, add a `contrast` link in one of their YAML files.'),
    h('div.compare-grid', column(a, b, 0), column(b, a, 1)),
  ));
  return {};
}
