// Map: domain → blobs overview; open a blob to see its atoms and the typed links between them.
import { h, fill, cssVar, statusDot, STATUS_LABEL, KIND, relDay } from '../util.js';
import { store, atom, blob, blobAtoms, atomStatus, atomRecord, domainsWithBlobs } from '../store.js';
import { coverage, atomRow } from './outline.js';
import { linkCards } from './atom.js';

let savedPositions = null; // overview positions (domain + blobs), stable across visits
let fcoseReady = false;

const shortTitle = (t) => t.split(' — ')[0];
const BASE = '[type="domain"], [type="blob"], [type="domain-edge"], [type="requires"]';

function layoutOpts(extra) {
  if (!fcoseReady && window.cytoscapeFcose) { window.cytoscape.use(window.cytoscapeFcose); fcoseReady = true; }
  return fcoseReady ? {
    name: 'fcose',
    quality: 'default',
    padding: 60,
    nodeSeparation: 80,
    nodeRepulsion: () => 8000,
    idealEdgeLength: (e) => ({ 'domain-edge': 170, requires: 220, member: 80, link: 120 }[e.data('type')] || 100),
    edgeElasticity: (e) => (e.data('type') === 'link' ? 0.1 : 0.45),
    ...extra,
  } : { name: 'cose', padding: 60, ...extra };
}

function elements() {
  const els = [];
  for (const d of domainsWithBlobs()) {
    els.push({ data: { id: `d:${d.id}`, label: d.title, type: 'domain' } });
    for (const b of d.blobList) {
      els.push({ data: { id: `b:${b.id}`, label: b.title, type: 'blob' } });
      els.push({ data: { id: `e:d:${d.id}:${b.id}`, source: `d:${d.id}`, target: `b:${b.id}`, type: 'domain-edge' } });
      for (const r of b.requires || []) {
        els.push({ data: { id: `e:req:${b.id}:${r}`, source: `b:${r}`, target: `b:${b.id}`, type: 'requires' } });
      }
    }
  }
  for (const [id, a] of Object.entries(store.content.atoms)) {
    const blobs = store.atomBlobs[id] || [];
    els.push({ data: { id: `a:${id}`, label: shortTitle(a.title), type: 'atom', status: atomStatus(id), shared: blobs.length > 1 ? 1 : 0 } });
    for (const b of blobs) els.push({ data: { id: `e:m:${b}:${id}`, source: `b:${b}`, target: `a:${id}`, type: 'member' } });
  }
  for (const [id, links] of Object.entries(store.links)) {
    for (const l of links) {
      if (l.dir !== 'out') continue;
      // prereq/uses point from the foundation to the thing built on it
      const [s, t] = l.kind === 'prereq' || l.kind === 'uses' ? [l.other, id] : [id, l.other];
      els.push({ data: { id: `e:l:${id}:${l.other}:${l.kind}`, source: `a:${s}`, target: `a:${t}`, type: 'link', kind: l.kind } });
    }
  }
  return els;
}

function style() {
  const v = (n) => cssVar(n);
  return [
    { selector: 'node', style: { label: 'data(label)', 'font-family': 'Inter, system-ui, sans-serif', color: v('--text'), 'text-wrap': 'wrap', 'text-max-width': 120 } },
    { selector: 'node[type="domain"]', style: { shape: 'round-rectangle', 'background-color': v('--accent'), color: '#fff', 'font-size': 16, 'font-weight': 600, 'text-valign': 'center', width: 'label', height: 'label', padding: 14 } },
    { selector: 'node[type="blob"]', style: { shape: 'round-rectangle', 'background-color': v('--accent-soft'), 'border-width': 1.5, 'border-color': v('--accent'), color: v('--accent'), 'font-size': 14, 'font-weight': 600, 'text-valign': 'center', width: 'label', height: 'label', padding: 12 } },
    { selector: 'node[type="atom"]', style: { width: 18, height: 18, 'font-size': 11, 'text-valign': 'bottom', 'text-margin-y': 5, 'border-width': 0 } },
    { selector: 'node[status="new"]', style: { 'background-color': v('--st-new') } },
    { selector: 'node[status="learning"]', style: { 'background-color': v('--st-learning') } },
    { selector: 'node[status="known"]', style: { 'background-color': v('--st-known') } },
    { selector: 'node[status="due"]', style: { 'background-color': v('--st-due') } },
    { selector: 'node[shared=1]', style: { 'border-width': 3, 'border-color': v('--accent'), width: 22, height: 22 } },
    { selector: 'edge', style: { width: 1, 'line-color': v('--border-strong'), 'curve-style': 'bezier' } },
    { selector: 'edge[type="domain-edge"]', style: { width: 2, 'line-color': v('--accent'), opacity: 0.35 } },
    { selector: 'edge[type="requires"]', style: { width: 2, 'line-color': v('--accent'), 'line-style': 'dashed', 'target-arrow-shape': 'triangle', 'target-arrow-color': v('--accent'), opacity: 0.7 } },
    { selector: 'edge[type="member"]', style: { opacity: 0.45 } },
    { selector: 'edge[type="link"]', style: { width: 1.5, 'line-style': 'dashed', 'line-dash-pattern': [5, 4], opacity: 0.28 } },
    ...Object.keys(KIND).map((k) => ({ selector: `edge[kind="${k}"]`, style: { 'line-color': v(`--k-${k}`), 'target-arrow-color': v(`--k-${k}`) } })),
    { selector: 'edge[kind="prereq"], edge[kind="uses"]', style: { 'target-arrow-shape': 'triangle', 'arrow-scale': 0.8 } },
    { selector: '.muted', style: { opacity: 0.35 } },
    { selector: 'edge.muted', style: { opacity: 0.12 } },
    { selector: 'node.context', style: { opacity: 0.5 } },
    { selector: 'edge.lit', style: { opacity: 1, width: 2 } },
    { selector: '.faded', style: { opacity: 0.12 } },
    { selector: 'edge.faded', style: { opacity: 0.05 } },
    { selector: 'node.hl', style: { 'underlay-color': v('--accent'), 'underlay-opacity': 0.18, 'underlay-padding': 6 } },
    { selector: '.hidden', style: { display: 'none' } },
  ];
}

export function renderMap(root) {
  const panel = h('aside.side-panel');
  const cyEl = h('div#cy');
  const search = h('input', { type: 'search', placeholder: 'Find an atom…  (Enter)' });
  const legend = h('div.map-legend.legend',
    ['new', 'learning', 'known', 'due'].map((s) => h('span', statusDot(s), STATUS_LABEL[s])),
    h('span', h('span.dot', { style: { border: '2px solid var(--accent)', width: '11px', height: '11px' } }), 'Shared atom'),
    Object.keys(KIND).map((k) => h('span', h('span.line', { style: { borderColor: `var(--k-${k})` } }), k)),
  );
  root.append(h('div.map-layout',
    h('div.map-canvas-wrap', cyEl, h('div.map-toolbar', search), legend),
    panel,
  ));

  const cy = window.cytoscape({
    container: cyEl,
    elements: elements(),
    style: style(),
    minZoom: 0.2,
    maxZoom: 2.5,
    wheelSensitivity: 0.3,
  });

  const base = cy.elements(BASE);
  cy.elements().not(base).addClass('hidden');
  if (savedPositions && base.nodes().every((n) => savedPositions[n.id()])) {
    base.layout({ name: 'preset', positions: (n) => savedPositions[n.id()], fit: false }).run();
  } else {
    base.layout(layoutOpts({ quality: 'proof', randomize: true, animate: false, fit: false })).run();
    savedPositions = Object.fromEntries(base.nodes().map((n) => [n.id(), { ...n.position() }]));
  }
  requestAnimationFrame(() => { cy.resize(); cy.fit(base, 60); });

  let current = null; // focused blob id
  let context = cy.collection(); // atoms from other blobs revealed around the selected atom
  let running = null;
  let seq = 0;

  cy.on('dragfree', 'node', (e) => {
    const id = e.target.id();
    if (current === null && savedPositions[id]) savedPositions[id] = { ...e.target.position() };
  });

  const visible = () => cy.elements().not('.hidden');
  function setVisible(coll) {
    cy.elements().addClass('hidden');
    coll.removeClass('hidden');
  }
  function fitTo(eles) {
    cy.stop(true);
    cy.animate({ fit: { eles, padding: 60 } }, { duration: 300 });
  }
  function runLayout(eles, opts, done) {
    const my = ++seq;
    running?.stop();
    running = eles.layout({ ...opts, fit: false });
    running.one('layoutstop', () => {
      if (my !== seq) return;
      running = null;
      fitTo(eles);
      done?.();
    });
    running.run();
  }

  function clearFocus() {
    cy.elements().removeClass('faded hl lit');
  }
  function focus(coll) {
    clearFocus();
    cy.elements().addClass('faded');
    coll.removeClass('faded');
    coll.edges().addClass('lit');
  }

  function showOverview() {
    const wasFocused = current !== null;
    current = null;
    context = cy.collection();
    cy.elements().removeClass('faded hl lit muted context');
    setVisible(base);
    if (wasFocused) runLayout(base, { name: 'preset', positions: (n) => savedPositions[n.id()], animate: true, animationDuration: 400 });
    const doms = domainsWithBlobs();
    fill(panel,
      h('div.kicker', 'Overview'),
      h('h2', 'Your knowledge map'),
      h('p.muted', 'Purple boxes are blobs (groups of knowledge). Each blob holds atoms: one unit of knowledge with a lesson, drills and classic problems. Atoms live once and can belong to several blobs.'),
      h('p.muted', 'Click a blob to open its atoms. Click an atom to see its connections, double-click to open it. Click the background to come back here.'),
      doms.map((d) => {
        const ids = [...new Set(d.blobList.flatMap((b) => blobAtoms(b.id)))];
        const c = coverage(ids);
        return h('div.side-section', h('h4', d.title), c.bar, h('div', { style: { marginTop: '8px' } }, c.counts),
          h('ul.atom-list', { style: { marginTop: '10px' } }, d.blobList.map((b) => h('li', h('a.atom-row', {
            href: '#', onclick: (e) => { e.preventDefault(); selectBlob(b.id); },
          }, h('span.dot', { style: { background: 'var(--accent)' } }), h('span.t', b.title), h('span.meta', `${blobAtoms(b.id).length} atoms`))))));
      }),
    );
  }

  function selectBlob(bid, done) {
    const b = blob(bid);
    const node = cy.$id(`b:${bid}`);
    if (!b || node.empty()) return;
    const ids = blobAtoms(bid);
    const aset = new Set(ids.map((id) => `a:${id}`));
    const atoms = cy.nodes('[type="atom"]').filter((n) => aset.has(n.id()));
    const members = atoms.connectedEdges('[type="member"]');
    const links = atoms.connectedEdges('[type="link"]').filter((e) => aset.has(e.source().id()) && aset.has(e.target().id()));
    const fresh = atoms.filter('.hidden');

    cy.elements().removeClass('faded hl lit muted context');
    context = cy.collection();
    setVisible(base.union(atoms).union(members).union(links));
    base.not(node.union(members.sources())).addClass('muted');
    node.addClass('hl');

    const c = node.position();
    const r = 60 + fresh.length * 6;
    fresh.forEach((n, i) => {
      const t = (2 * Math.PI * i) / fresh.length;
      n.position({ x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) });
    });

    const was = current;
    current = bid;
    if (was === bid) done?.();
    // Lay out and zoom onto just this blob and its atoms; the rest of the overview stays put.
    else runLayout(node.union(atoms).union(links).union(members.filter((e) => e.source().same(node))),
      layoutOpts({ randomize: true, animate: true, animationDuration: 450 }), done);

    const cov = coverage(ids);
    fill(panel,
      h('div.kicker', 'Blob'),
      h('h2', b.title),
      h('p.muted', b.summary),
      cov.bar, h('div', { style: { margin: '8px 0 4px' } }, cov.counts),
      h('div.actions', h('a.btn.primary', { href: `#/review/blob/${bid}` }, 'Review this blob'), h('a.btn', { href: `#/outline/${bid}` }, 'Open in outline')),
      (b.sections || []).map((s) => h('div.side-section', h('h4', s.title), h('ul.atom-list', (s.atoms || []).filter(atom).map((id) => atomRow(id, { currentBlob: bid }))))),
    );
  }

  function selectAtom(id, center) {
    const a = atom(id);
    if (!a) return;
    const blobs = store.atomBlobs[id] || [];
    if (!blobs.includes(current)) {
      if (blobs.length) selectBlob(blobs[0], () => selectAtom(id, center));
      return;
    }
    const node = cy.$id(`a:${id}`);
    context.addClass('hidden').removeClass('context');
    const links = node.connectedEdges('[type="link"]');
    const fresh = links.connectedNodes().not(node).filter('.hidden');
    context = fresh.union(links.filter('.hidden'));

    const p = node.position();
    const c = cy.$id(`b:${current}`).position();
    const dir = Math.atan2(p.y - c.y, p.x - c.x);
    const step = Math.min(0.45, (2 * Math.PI) / Math.max(fresh.length, 1));
    fresh.forEach((n, i) => {
      const t = dir + (i - (fresh.length - 1) / 2) * step;
      n.position({ x: p.x + 140 * Math.cos(t), y: p.y + 140 * Math.sin(t) });
    });
    context.removeClass('hidden');
    fresh.addClass('context');

    focus(node.closedNeighborhood());
    node.addClass('hl');
    if (center) {
      cy.stop(true);
      cy.animate({ center: { eles: node }, zoom: Math.max(cy.zoom(), 1) }, { duration: 300 });
    } else if (fresh.nonempty()) fitTo(visible());

    const st = atomStatus(id);
    const rec = atomRecord(id);
    fill(panel,
      h('div.kicker', 'Atom'),
      h('h2', a.title),
      h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' } },
        blobs.map((b) => h('a.chip.blob', { href: '#', onclick: (e) => { e.preventDefault(); selectBlob(b); } }, blob(b).title))),
      h('p.muted', a.summary),
      h('div.status-badge', statusDot(st), STATUS_LABEL[st], st === 'known' ? ` · refresh ${relDay(rec.due)}` : ''),
      h('div.actions',
        h('a.btn.primary', { href: `#/atom/${id}` }, 'Open atom'),
        a.drills?.length && h('a.btn', { href: `#/review/atom/${id}` }, 'Test me'),
      ),
      h('div.faint', { style: { fontSize: '13px' } }, `${a.drills?.length || 0} drills · ${a.classics?.length || 0} classic problems`),
      linkCards(id) && h('div.side-section', h('h4', 'Connections'), linkCards(id)),
    );
    panel.querySelectorAll('.links-grid').forEach((g) => { g.style.gridTemplateColumns = '1fr'; });
  }

  cy.on('tap', 'node[type="atom"]', (e) => selectAtom(e.target.id().slice(2)));
  cy.on('tap', 'node[type="blob"]', (e) => selectBlob(e.target.id().slice(2)));
  cy.on('tap', 'node[type="domain"]', showOverview);
  cy.on('tap', (e) => { if (e.target === cy) showOverview(); });
  cy.on('dbltap', 'node[type="atom"]', (e) => { location.hash = `#/atom/${e.target.id().slice(2)}`; });
  cy.on('mouseover', 'node', () => { cyEl.style.cursor = 'pointer'; });
  cy.on('mouseout', 'node', () => { cyEl.style.cursor = ''; });

  search.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const q = search.value.trim().toLowerCase();
    if (!q) return showOverview();
    const hit = Object.values(store.content.atoms).find((a) => a.id.includes(q) || a.title.toLowerCase().includes(q))
      || Object.values(store.content.blobs).find((b) => b.title.toLowerCase().includes(q));
    if (!hit) return;
    if (store.content.atoms[hit.id]) selectAtom(hit.id, true);
    else selectBlob(hit.id);
  });

  showOverview();
  const onResize = () => cy.resize();
  window.addEventListener('resize', onResize);
  return {
    destroy: () => { window.removeEventListener('resize', onResize); running?.stop(); cy.destroy(); },
    onStoreChange: () => cy.nodes('[type="atom"]').forEach((n) => n.data('status', atomStatus(n.id().slice(2)))),
  };
}
