// Content (read-only, from content/*.yaml) + progress (read/write, progress.json)
// + derived indexes and the status model.
import { today, addDays } from './util.js';

// Spaced-repetition ladder: after the n-th successful recall, wait INTERVALS[n-1] days.
const INTERVALS = [1, 3, 7, 14, 30, 60, 120];

export const store = {
  content: { domains: {}, blobs: {}, atoms: {}, errors: [] },
  progress: { version: 1, atoms: {} },
  atomBlobs: {}, // atomId -> [blobId] (every blob that lists it)
  links: {}, // atomId -> [{ other, kind, dir: 'out' | 'in', note }]
};

const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
const emit = () => listeners.forEach((fn) => fn());

export async function load() {
  const [content, progress] = await Promise.all([
    fetch('/api/content').then((r) => r.json()),
    fetch('/api/progress').then((r) => r.json()),
  ]);
  store.content = content;
  store.progress = { version: 1, atoms: {}, ...progress };
  buildIndexes();
}

/** Re-read content only (progress in memory stays the source of truth). */
export async function reloadContent() {
  store.content = await fetch('/api/content').then((r) => r.json());
  buildIndexes();
}

function buildIndexes() {
  const { blobs, atoms } = store.content;
  store.atomBlobs = {};
  store.links = {};
  for (const id of Object.keys(atoms)) {
    store.atomBlobs[id] = [];
    store.links[id] = [];
  }
  for (const b of Object.values(blobs)) {
    for (const a of blobAtoms(b.id)) store.atomBlobs[a]?.push(b.id);
  }
  // Links are declared once but shown on both atoms.
  const seen = new Set();
  for (const a of Object.values(atoms)) {
    for (const l of a.links || []) {
      if (!atoms[l.to]) continue;
      const key = [a.id, l.to, l.kind].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      store.links[a.id].push({ other: l.to, kind: l.kind, dir: 'out', note: l.note });
      store.links[l.to].push({ other: a.id, kind: l.kind, dir: 'in', note: l.note });
    }
  }
}

// ---------- structure queries ----------

export const atom = (id) => store.content.atoms[id];
export const blob = (id) => store.content.blobs[id];

/** Ordered, de-duplicated atom ids of a blob (section order = learning order). */
export function blobAtoms(blobId) {
  const b = store.content.blobs[blobId];
  const out = [];
  for (const s of b?.sections || []) for (const a of s.atoms || []) if (!out.includes(a) && store.content.atoms[a]) out.push(a);
  return out;
}

/** Domains, each with its blobs in the domain's suggested order (unlisted blobs last). */
export function domainsWithBlobs() {
  const { domains, blobs } = store.content;
  return Object.values(domains).map((d) => {
    const order = d.blobs || [];
    const own = Object.values(blobs).filter((b) => b.domain === d.id);
    own.sort((x, y) => (order.indexOf(x.id) + 1 || 1e9) - (order.indexOf(y.id) + 1 || 1e9));
    return { ...d, blobList: own };
  });
}

// ---------- progress + status ----------

function rec(id) {
  return (store.progress.atoms[id] ??= { streak: 0, due: null, lessonRead: null, exercises: {} });
}

/** new: never touched · learning: touched, not yet recalled cleanly · known: recalled, not due · due: recall is due */
export function atomStatus(id) {
  const p = store.progress.atoms[id];
  if (!p) return 'new';
  if (p.streak > 0) return p.due && p.due <= today() ? 'due' : 'known';
  return p.lessonRead || Object.keys(p.exercises || {}).length ? 'learning' : 'new';
}

export function atomRecord(id) {
  return store.progress.atoms[id] || { streak: 0, due: null, lessonRead: null, exercises: {} };
}

export const exKey = (kind, exId) => `${kind === 'classics' ? 'c' : 'd'}:${exId}`;

export function exerciseState(atomId, kind, exId) {
  return atomRecord(atomId).exercises?.[exKey(kind, exId)] || null;
}

export function counts(atomIds) {
  const c = { new: 0, learning: 0, known: 0, due: 0 };
  for (const id of atomIds) c[atomStatus(id)]++;
  return c;
}

export function markLessonRead(id) {
  rec(id).lessonRead = today();
  save();
}

/**
 * Record one exercise attempt. result: 'pass' | 'fail' ('fail' = gave up / revealed the solution).
 * In free practice (auto=true), an atom is promoted once every drill has been passed
 * since it became due, and demoted when you have to reveal a drill's solution.
 */
export function recordExercise(atomId, kind, exId, result, { auto = true } = {}) {
  const p = rec(atomId);
  const key = exKey(kind, exId);
  const e = (p.exercises[key] ??= { passes: 0, fails: 0 });
  e.result = result;
  e.at = today();
  e[result === 'pass' ? 'passes' : 'fails']++;
  if (auto && kind === 'drills') {
    const status = atomStatus(atomId);
    if (result === 'fail' && p.streak > 0) {
      p.streak = 0;
      p.due = null;
    } else if (result === 'pass' && status !== 'known' && allDrillsPassedSince(atomId, status === 'due' ? p.due : null)) {
      promote(p);
    }
  }
  save();
}

function allDrillsPassedSince(atomId, since) {
  const drills = atom(atomId)?.drills || [];
  const ex = rec(atomId).exercises;
  return drills.length > 0 && drills.every((d) => {
    const e = ex[exKey('drills', d.id)];
    return e?.result === 'pass' && (!since || e.at >= since);
  });
}

function promote(p) {
  p.streak += 1;
  p.lastReview = today();
  p.due = addDays(today(), INTERVALS[Math.min(p.streak, INTERVALS.length) - 1]);
}

/** Review-session outcome for a whole atom. */
export function completeAtomReview(atomId, success) {
  const p = rec(atomId);
  if (success) promote(p);
  else {
    p.streak = 0;
    p.due = null;
    p.lastReview = today();
  }
  save();
}

export function resetAtom(atomId) {
  delete store.progress.atoms[atomId];
  save();
}

export const saveProgress = () => save();

let saveTimer = null;
function save() {
  emit();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fetch('/api/progress', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(store.progress),
    }).catch((e) => console.error('Could not save progress', e));
  }, 250);
}
