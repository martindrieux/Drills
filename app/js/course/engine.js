// Course engine: skill states, session building, grading and scheduling.
// See docs/course-design.md for the rules in plain words.
import { store, saveProgress } from '../store.js';

const DAY = 864e5;
// box -> days until next review; reaching MASTERED means retired (phased out).
export const BOX_DAYS = [0, 1, 3, 7, 16, 35];
export const MASTERED = 6;
const DEFAULT_SETTINGS = { newChunks: 1, maxReviews: 15 };

const startOfToday = () => new Date(new Date().toDateString()).getTime();
const dueIn = (days) => (days === 0 ? Date.now() : startOfToday() + days * DAY);

// ---------- structure ----------

export const course = (cid) => store.content.courses?.[cid];

/** Chunks in course order (only the ones whose file exists). */
export function chunks(cid) {
  const c = course(cid);
  return (c?.chunks || []).map((id) => c.chunkData[id]).filter(Boolean);
}

export function chunk(cid, chunkId) {
  return course(cid)?.chunkData?.[chunkId];
}

/** skillId -> { skill, chunk } */
export function skillIndex(cid) {
  const out = {};
  for (const ch of chunks(cid)) for (const s of ch.skills || []) out[s.id] = { skill: s, chunk: ch };
  return out;
}

// ---------- state ----------

export function state(cid) {
  const all = (store.progress.courses ??= {});
  const st = (all[cid] ??= { settings: { ...DEFAULT_SETTINGS }, chunks: {}, skills: {} });
  st.settings = { ...DEFAULT_SETTINGS, ...st.settings };
  return st;
}

export const rec = (cid, sid) => state(cid).skills[sid];

/** new · learning (box 0–1) · reviewing (box 2–5) · mastered (retired) · removed (not relevant) */
export function skillStatus(cid, sid) {
  const r = rec(cid, sid);
  if (!r) return 'new';
  if (r.removed) return 'removed';
  if (r.retired) return 'mastered';
  return r.box <= 1 ? 'learning' : 'reviewing';
}

export const isDue = (r, now = Date.now()) => r && !r.retired && !r.removed && (r.pinned || r.due <= now);

export function chunkProgress(cid, ch) {
  const c = { new: 0, learning: 0, reviewing: 0, mastered: 0, removed: 0 };
  for (const s of ch.skills || []) c[skillStatus(cid, s.id)]++;
  return c;
}

export function chunkStatus(cid, ch) {
  const st = state(cid).chunks[ch.id]?.status;
  if (st === 'skipped') return 'skipped';
  const c = chunkProgress(cid, ch);
  const n = (ch.skills || []).length - c.removed;
  if (c.mastered === n) return 'mastered';
  if (c.new === n) return 'not started';
  return st === 'done' ? 'learned' : 'in progress';
}

export function courseProgress(cid) {
  const c = { new: 0, learning: 0, reviewing: 0, mastered: 0, removed: 0 };
  for (const ch of chunks(cid)) {
    const p = chunkProgress(cid, ch);
    for (const k in c) c[k] += p[k];
  }
  return c;
}

export function dueSkills(cid, now = Date.now()) {
  const idx = skillIndex(cid);
  return Object.entries(state(cid).skills)
    .filter(([sid, r]) => idx[sid] && isDue(r, now))
    .sort(([, a], [, b]) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || a.due - b.due)
    .map(([sid]) => sid);
}

/** The next chunks to learn: not done/skipped, with at least one untaught skill. */
export function nextChunks(cid, n) {
  const st = state(cid);
  return chunks(cid)
    .filter((ch) => !['done', 'skipped'].includes(st.chunks[ch.id]?.status))
    .filter((ch) => (ch.skills || []).some((s) => !st.skills[s.id]))
    .slice(0, n);
}

// ---------- cards ----------

/** card[0] the first time; afterwards the least recently seen variant, never the last one. */
export function pickCard(cid, sid, kind) {
  const { skill } = skillIndex(cid)[sid];
  const cards = skill.cards || [];
  if (kind === 'learn' || cards.length === 1) return cards[0];
  const seen = rec(cid, sid)?.seen || {};
  const last = rec(cid, sid)?.lastCard;
  const pool = cards.filter((c) => c.id !== last);
  pool.sort((a, b) => (seen[a.id] || 0) - (seen[b.id] || 0));
  return pool[0] || cards[0];
}

// ---------- sessions ----------

let nextItemId = 1;
function item(kind, cid, sid, extra = {}) {
  const idx = skillIndex(cid);
  return { id: nextItemId++, kind, sid, chunkId: sid ? idx[sid].chunk.id : extra.chunkId, ...extra };
}

function reviewItem(cid, sid) {
  const r = rec(cid, sid);
  return item(r.lastGrade === 'failed' ? 'relearn' : 'review', cid, sid);
}

function interleave(a, b) {
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

const shuffle = (xs) => xs.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

/** What "Start session" would do right now (used for the preview and to build the session). */
export function planSession(cid) {
  const st = state(cid);
  const due = dueSkills(cid);
  const reviews = due.slice(0, st.settings.maxReviews);
  const blocked = st.settings.newChunks > 0 && due.length > st.settings.maxReviews;
  const learn = blocked ? [] : nextChunks(cid, st.settings.newChunks);
  return { reviews, backlog: due.length, learn, blocked };
}

function learnItems(cid, ch, { all = false } = {}) {
  const st = state(cid);
  const skills = (ch.skills || []).filter((s) => all || !st.skills[s.id]);
  return {
    learn: [item('intro', cid, null, { chunkId: ch.id }), ...skills.map((s) => item('learn', cid, s.id))],
    recheck: skills.map((s) => item('recheck', cid, s.id)),
  };
}

/**
 * mode 'auto':  warm-up reviews → new chunk(s) (teach + card) → remaining reviews mixed with re-checks
 * mode 'chunk': learn one chunk now (all its skills if already taught)
 * mode 'test':  one card per skill of a chunk, lessons hidden; good results skip ahead
 */
export function buildSession(cid, mode = 'auto', chunkId = null) {
  if (mode === 'chunk') {
    const ch = chunk(cid, chunkId);
    const untaught = (ch.skills || []).some((s) => !rec(cid, s.id));
    const { learn, recheck } = learnItems(cid, ch, { all: !untaught });
    return { cid, mode, items: [...learn, ...shuffle(recheck)], learnChunks: [ch.id] };
  }
  if (mode === 'test') {
    const ch = chunk(cid, chunkId);
    return { cid, mode, items: (ch.skills || []).map((s) => item('test', cid, s.id)), learnChunks: [], testChunk: ch.id };
  }
  const plan = planSession(cid);
  const reviews = plan.reviews.map((sid) => reviewItem(cid, sid));
  const half = Math.ceil(reviews.length / 2);
  const learn = [];
  const recheck = [];
  for (const ch of plan.learn) {
    const li = learnItems(cid, ch);
    learn.push(...li.learn);
    recheck.push(...li.recheck);
  }
  return {
    cid,
    mode,
    items: [...reviews.slice(0, half), ...learn, ...interleave(reviews.slice(half), shuffle(recheck))],
    learnChunks: plan.learn.map((c) => c.id),
  };
}

// ---------- grading ----------

const SCHEDULING = new Set(['learn', 'recheck', 'review', 'relearn', 'test']);

function touch(r, card, grade, kind) {
  r.seen = { ...(r.seen || {}), [card.id]: Date.now() };
  r.lastCard = card.id;
  r.reps = (r.reps || 0) + 1;
  r.history = [...(r.history || []), [Date.now(), kind, grade]].slice(-20);
}

/**
 * Apply a grade ('clean' | 'struggled' | 'failed') for one session item.
 * Returns follow-up items to insert later in the session (relearn + extra practice on a miss).
 * The caller can undo with the returned `undo` (used for grade overrides).
 */
export function grade(session, it, card, g) {
  const { cid } = session;
  const st = state(cid);
  const before = st.skills[it.sid] ? structuredClone(st.skills[it.sid]) : undefined;
  const r = (st.skills[it.sid] ??= { box: 0, due: Date.now(), lapses: 0 });
  const isFirst = !(session.graded ??= new Set()).has(it.sid) || it.kind === 'recheck';
  touch(r, card, g, it.kind);

  const followUps = [];
  const requeue = () => {
    session.requeues ??= {};
    const n = (session.requeues[it.sid] = (session.requeues[it.sid] || 0) + 1);
    if (n > 2) return; // enough for one session; it comes back next session anyway
    followUps.push({ offset: 2, item: item('relearn', cid, it.sid, { practice: true }) });
    followUps.push({ offset: 5, item: item('extra', cid, it.sid) });
  };

  if (SCHEDULING.has(it.kind) && !it.practice && isFirst) {
    r.lastGrade = g;
    r.pinned = false;
    if (it.kind === 'learn') {
      // First exposure: the re-check later in the session sets the real box.
      r.box = 0;
      r.due = Date.now();
      if (g === 'failed') requeue();
    } else if (it.kind === 'test') {
      r.box = g === 'clean' ? 3 : g === 'struggled' ? 1 : 0;
      r.due = dueIn(BOX_DAYS[r.box]);
    } else if (g === 'clean') {
      r.box = it.kind === 'recheck' ? Math.max(r.box, 1) : r.box + 1;
      if (r.box >= MASTERED) {
        r.retired = true;
        r.due = null;
      } else r.due = dueIn(BOX_DAYS[r.box]);
    } else if (g === 'struggled') {
      r.due = dueIn(1);
    } else {
      r.lapses = (r.lapses || 0) + 1;
      r.box = 0;
      r.due = Date.now();
      requeue();
    }
    if (it.kind !== 'recheck') session.graded.add(it.sid);
  } else if (g === 'failed') {
    requeue();
  }
  saveProgress();
  return {
    followUps,
    undo: () => {
      if (before) st.skills[it.sid] = before;
      else delete st.skills[it.sid];
      if (it.kind !== 'recheck') session.graded.delete(it.sid);
      if (g === 'failed' && session.requeues?.[it.sid]) session.requeues[it.sid]--;
      saveProgress();
    },
  };
}

export function markChunk(cid, chunkId, status) {
  state(cid).chunks[chunkId] = { status, at: Date.now() };
  saveProgress();
}

// ---------- manual controls ----------

export function setSettings(cid, patch) {
  Object.assign(state(cid).settings, patch);
  saveProgress();
}

export function pin(cid, sid) {
  const st = state(cid);
  const r = (st.skills[sid] ??= { box: 0, due: Date.now(), lapses: 0 });
  r.pinned = true;
  r.retired = false;
  saveProgress();
}

export function retire(cid, sid) {
  const st = state(cid);
  const r = (st.skills[sid] ??= { box: 0, due: null, lapses: 0 });
  r.retired = true;
  r.box = MASTERED;
  r.pinned = false;
  r.due = null;
  saveProgress();
}

export function bringBack(cid, sid) {
  const r = rec(cid, sid);
  if (!r) return;
  r.retired = false;
  r.box = 3;
  r.due = Date.now();
  saveProgress();
}

/** Too basic / not relevant: never shown again, not counted. Undo with restore(). */
export function removeSkill(cid, sid) {
  const st = state(cid);
  const r = (st.skills[sid] ??= { box: 0, due: null, lapses: 0 });
  r.removed = true;
  r.pinned = false;
  saveProgress();
}

export function restore(cid, sid) {
  const r = rec(cid, sid);
  if (!r) return;
  delete r.removed;
  if (!r.reps) delete state(cid).skills[sid]; // never practised: back to "not seen"
  saveProgress();
}

/** Already known, but keep it in rotation: jump to a long interval (box 4, ~16 days). */
export function knowLater(cid, sid) {
  const st = state(cid);
  const r = (st.skills[sid] ??= { box: 0, lapses: 0 });
  Object.assign(r, { box: Math.max(r.box || 0, 4), retired: false, removed: false, pinned: false, lastGrade: 'clean' });
  r.due = dueIn(BOX_DAYS[r.box]);
  saveProgress();
}

export function resetSkill(cid, sid) {
  delete state(cid).skills[sid];
  saveProgress();
}

/** "I know this chunk": every skill goes to box 3 without testing. */
export function skipChunk(cid, chunkId) {
  for (const s of chunk(cid, chunkId).skills || []) {
    const st = state(cid);
    const r = (st.skills[s.id] ??= { box: 3, lapses: 0 });
    if (!r.retired) {
      r.box = Math.max(r.box, 3);
      r.due = dueIn(BOX_DAYS[r.box]);
    }
  }
  markChunk(cid, chunkId, 'done');
}

/**
 * "I already did this page": every untouched skill counts as learned (box 2), with first reviews
 * spread over the next 7 days so a batch of pages does not land on one day. Skills that already have
 * progress (or were removed) are left as they are.
 */
export function markDone(cid, chunkIds) {
  const st = state(cid);
  let k = 0;
  for (const chunkId of chunkIds) {
    for (const s of chunk(cid, chunkId)?.skills || []) {
      if (st.skills[s.id]) continue;
      st.skills[s.id] = { box: 2, due: dueIn(1 + (k++ % 7)), lapses: 0, lastGrade: 'clean' };
    }
    st.chunks[chunkId] = { status: 'done', at: Date.now() };
  }
  saveProgress();
}

/**
 * Read mode: the first completed card of a never-practised skill counts it as learned
 * (clean → box 1, next review tomorrow; otherwise box 0, back next session). Skills that already
 * have progress are untouched (read mode is free practice for them). When every skill of the page
 * has progress, the page counts as done. Returns true if this call recorded the skill.
 */
export function markRead(cid, chunkId, sid, g) {
  const st = state(cid);
  if (st.skills[sid]) return false;
  st.skills[sid] = g === 'clean'
    ? { box: 1, due: dueIn(BOX_DAYS[1]), lapses: 0, lastGrade: g, reps: 1 }
    : { box: 0, due: Date.now(), lapses: 0, lastGrade: g, reps: 1 };
  if ((chunk(cid, chunkId)?.skills || []).every((s) => st.skills[s.id])) {
    st.chunks[chunkId] = { status: 'done', at: Date.now() };
  }
  saveProgress();
  return true;
}

/** Every page from the start of the course up to and including this one. */
export function pagesUpTo(cid, chunkId) {
  const ids = chunks(cid).map((c) => c.id);
  return ids.slice(0, ids.indexOf(chunkId) + 1);
}

export function nextDueLabel(r) {
  if (!r) return '';
  if (r.retired) return 'mastered';
  if (r.pinned || r.due <= Date.now()) return 'due now';
  const days = Math.round((r.due - startOfToday()) / DAY);
  return days <= 1 ? 'tomorrow' : `in ${days}d`;
}
