// Outline: the exhaustive, ordered inventory — every blob, every atom, its status.
import { h, relDay, statusDot, STATUS_LABEL } from '../util.js';
import { store, atom, blob, blobAtoms, atomStatus, atomRecord, counts, domainsWithBlobs } from '../store.js';

export function coverage(ids) {
  const c = counts(ids);
  const n = ids.length || 1;
  const seg = (k) => h('span', { style: { width: `${(100 * c[k]) / n}%`, background: `var(--st-${k})` } });
  return {
    bar: h('div.bar', seg('known'), seg('due'), seg('learning')),
    counts: h('div.counts', ['known', 'due', 'learning', 'new'].map((k) =>
      h('span', statusDot(k), `${c[k]} ${STATUS_LABEL[k].toLowerCase()}`))),
  };
}

export function atomRow(id, { currentBlob } = {}) {
  const a = atom(id);
  const st = atomStatus(id);
  const p = atomRecord(id);
  const drills = a.drills || [];
  const passed = drills.filter((d) => p.exercises?.[`d:${d.id}`]?.result === 'pass').length;
  const others = (store.atomBlobs[id] || []).filter((b) => b !== currentBlob);
  return h('li', h('a.atom-row', { href: `#/atom/${id}` },
    statusDot(st),
    h('span',
      h('span.t', a.title),
      others.length ? h('span.shared', `  ↔ also in ${others.map((b) => blob(b).title).join(', ')}`) : null,
      h('span.s', a.summary),
    ),
    h('span.meta',
      st === 'known' && `refresh ${relDay(p.due)}`,
      st === 'due' && h('span', { style: { color: 'var(--st-due)' } }, 'due'),
      drills.length ? `${passed}/${drills.length} drills` : null,
    ),
  ));
}

export function renderOutline(root, focusBlob) {
  const page = h('div.page');
  for (const d of domainsWithBlobs()) {
    const all = [...new Set(d.blobList.flatMap((b) => blobAtoms(b.id)))];
    const cov = coverage(all);
    page.append(
      h('div', { style: { marginBottom: '28px' } },
        h('div.faint', { style: { fontSize: '12px', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 } }, 'Domain'),
        h('h1', d.title),
        h('p.muted', { style: { margin: '0 0 12px' } }, d.summary, ` · ${all.length} atoms in ${d.blobList.length} blobs`),
        cov.bar, h('div', { style: { marginTop: '6px' } }, cov.counts),
      ),
    );
    for (const b of d.blobList) {
      const ids = blobAtoms(b.id);
      const bc = coverage(ids);
      const card = h(`section.blob-card#blob-${b.id}`,
        h('header',
          h('div',
            h('h2', { style: { margin: '0 0 4px' } }, b.title),
            h('div.muted', b.summary),
            b.requires?.length && h('div.faint', { style: { fontSize: '13px', marginTop: '4px' } },
              'Do first: ', b.requires.map((r, i) => [i ? ', ' : '', h('a', { href: `#/outline/${r}` }, blob(r)?.title || r)])),
          ),
          h('a.btn', { href: `#/review/blob/${b.id}` }, 'Review blob'),
        ),
        bc.bar, bc.counts,
        (b.sections || []).map((s) => [
          h('div.section-title', s.title),
          h('ul.atom-list', (s.atoms || []).filter((id) => atom(id)).map((id) => atomRow(id, { currentBlob: b.id }))),
        ]),
      );
      page.append(card);
    }
  }
  const orphans = Object.keys(store.content.atoms).filter((id) => !(store.atomBlobs[id] || []).length);
  if (orphans.length) {
    page.append(h('section.blob-card', h('h2', { style: { margin: 0 } }, 'Not in any blob yet'), h('ul.atom-list', orphans.map((id) => atomRow(id)))));
  }
  root.append(page);
  if (focusBlob) requestAnimationFrame(() => document.getElementById(`blob-${focusBlob}`)?.scrollIntoView({ block: 'start' }));
  return {};
}
