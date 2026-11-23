// Course home (next session + controls + contents) and the "read a page" view.
import { h, fill, md } from '../util.js';
import { store } from '../store.js';
import { courseCard } from '../course/card.js';
import { answerKey, getAnswer, setAnswer, clearPageAnswers } from '../course/answers.js';
import {
  course, chunks, chunk, state, planSession, setSettings, chunkProgress, chunkStatus, courseProgress,
  skillStatus, rec, nextDueLabel, pin, retire, bringBack, resetSkill, skipChunk, removeSkill, restore, knowLater, markDone, pagesUpTo, markRead,
} from '../course/engine.js';

const ST_COLOR = { new: 'var(--st-new)', learning: 'var(--st-learning)', reviewing: 'var(--st-known)', mastered: 'var(--accent)', removed: 'transparent' };
const ST_LABEL = { new: 'not seen', learning: 'learning', reviewing: 'reviewing', mastered: 'mastered', removed: 'removed' };

function bar(c) {
  const n = Object.entries(c).reduce((a, [k, v]) => a + (k === 'removed' ? 0 : v), 0) || 1;
  return h('div.bar', ['mastered', 'reviewing', 'learning'].map((k) => h('span', { style: { width: `${(100 * c[k]) / n}%`, background: ST_COLOR[k] } })));
}
function counts(c) {
  return h('div.counts', ['mastered', 'reviewing', 'learning', 'new', 'removed'].filter((k) => k !== 'removed' || c[k]).map((k) =>
    h('span', h('span.dot', { style: { background: ST_COLOR[k] } }), `${c[k]} ${ST_LABEL[k]}`)));
}
function seg(options, value, onPick) {
  return h('div.seg', options.map(([v, label]) => h(`button${v === value ? '.on' : ''}`, { onclick: () => onPick(v) }, label)));
}

export function renderCourse(root, cid) {
  const c = course(cid);
  if (!c) {
    root.append(h('div.page', h('div.empty', 'No course found.')));
    return {};
  }
  const page = h('div.page');
  root.append(page);
  const open = new Set(); // expanded chunk ids survive re-renders

  function render() {
    window.drillContext = { cid };
    const st = state(cid);
    const plan = planSession(cid);
    const nItems = plan.reviews.length + plan.learn.reduce((a, ch) => a + 2 * ch.skills.length, 0);
    const planText = [
      plan.reviews.length ? `${plan.reviews.length} review${plan.reviews.length > 1 ? 's' : ''}` : null,
      ...plan.learn.map((ch) => `new page: ${ch.title} (${ch.skills.length} skills)`),
    ].filter(Boolean).join(' · ');

    fill(page,
      h('div.kicker', 'Course'),
      h('h1', c.title),
      h('p.muted', { style: { margin: '0 0 12px' } }, c.summary),
      bar(courseProgress(cid)), h('div', { style: { marginTop: '6px' } }, counts(courseProgress(cid))),

      h('div.session-card',
        h('div', { style: { flex: 1, minWidth: '240px' } },
          h('h3', 'Next session'),
          h('p.muted', { style: { margin: '4px 0 0' } }, planText || 'Nothing due and no new page. Come back later, or learn a page below.'),
          plan.blocked && h('p', { style: { margin: '6px 0 0', color: 'var(--st-due)', fontSize: '13px' } },
            `You have ${plan.backlog} reviews due, so no new page this time. Clear the backlog first.`),
        ),
        h('a.btn.primary.big', { href: `#/learn/${cid}/session`, 'aria-disabled': !nItems }, nItems ? `Start · ~${Math.max(1, Math.round(nItems * 0.6))} min` : 'Nothing to do'),
        h('div.session-settings',
          h('label', 'New pages per session', seg([[0, '0'], [1, '1'], [2, '2']], st.settings.newChunks, (v) => { setSettings(cid, { newChunks: v }); render(); })),
          h('label', 'Max reviews', seg([[10, '10'], [15, '15'], [30, '30']], st.settings.maxReviews, (v) => { setSettings(cid, { maxReviews: v }); render(); })),
        ),
      ),

      c.parts?.length
        ? c.parts.map((part) => [
          h('h2', part.title),
          h('div.chunk-list', (part.chunks || []).map((id) => chunk(cid, id)).filter(Boolean)
            .map((ch) => chunkRow(ch, chunks(cid).indexOf(ch)))),
        ])
        : [h('h2', 'Contents'), h('div.chunk-list', chunks(cid).map((ch, i) => chunkRow(ch, i)))],
    );
  }

  function chunkRow(ch, i) {
    const status = chunkStatus(cid, ch);
    const isOpen = open.has(ch.id);
    return h(`div.chunk-row${isOpen ? '.open' : ''}`,
      h('div.chunk-head', { onclick: () => { isOpen ? open.delete(ch.id) : open.add(ch.id); render(); } },
        h('span.chunk-num', String(i + 1).padStart(2, '0')),
        h('div', { style: { flex: 1, minWidth: 0 } },
          h('div.chunk-title', ch.title, h('span.chunk-status', status)),
          h('div', { style: { maxWidth: '260px', marginTop: '6px' } }, bar(chunkProgress(cid, ch))),
        ),
        h('div.chunk-actions', { onclick: (e) => e.stopPropagation() },
          ['not started', 'in progress'].includes(status) && h('button.btn.ghost.done-btn', {
            title: 'Already did this page: count its skills as learned and review them normally',
            onclick: () => { markDone(cid, [ch.id]); render(); },
          }, '✓ Mark done'),
          h('a.btn', { href: `#/learn/${cid}/read/${ch.id}` }, 'Read'),
          h('a.btn', { href: `#/learn/${cid}/session/chunk/${ch.id}` }, status === 'not started' ? 'Learn now' : 'Practice'),
          h('a.btn.ghost', { href: `#/learn/${cid}/session/test/${ch.id}`, title: 'One card per skill, no lesson. Clean answers skip ahead to box 3.' }, 'Test out'),
        ),
        h('span.chev', isOpen ? '▾' : '▸'),
      ),
      isOpen && h('div.chunk-body',
        md(ch.intro),
        h('table.skill-table', (ch.skills || []).map((s) => skillRow(s))),
        h('div', { style: { marginTop: '10px' } },
          h('button.btn.ghost', {
            onclick: () => {
              const ids = pagesUpTo(cid, ch.id);
              if (confirm(`Mark all ${ids.length} pages up to "${ch.title}" as done? Skills you already practised keep their progress.`)) { markDone(cid, ids); render(); }
            },
          }, `✓ Mark all pages up to here as done`),
          h('button.btn.ghost', { onclick: () => { if (confirm(`Mark every skill of "${ch.title}" as well known (box 3, first review in a week) without testing?`)) { skipChunk(cid, ch.id); render(); } } }, 'I know this page well')),
      ),
    );
  }

  function skillRow(s) {
    const status = skillStatus(cid, s.id);
    const r = rec(cid, s.id);
    const act = (label, fn, title) => h('button.btn.ghost.small', { onclick: () => { fn(cid, s.id); render(); }, title }, label);
    const label = { new: 'not seen', removed: 'removed (not relevant)', mastered: 'mastered · no more reviews' }[status]
      || `box ${r.box} · ${nextDueLabel(r)}`;
    return h(`tr${status === 'removed' ? '.removed' : ''}`,
      h('td', h('span.dot', { style: { background: ST_COLOR[status], border: status === 'removed' ? '1px solid var(--faint)' : 0 } })),
      h('td', s.name),
      h('td.muted', label),
      h('td.skill-actions',
        status === 'removed' ? act('Restore', restore, 'Put it back in the course')
          : status === 'mastered' ? act('Bring back', bringBack, 'Put it back into reviews')
            : [
              act('Practice next session', pin, 'Due at your next session'),
              act('Know it · review later', knowLater, 'Skip ahead: next review in ~2 weeks, then longer'),
              act('Mastered', retire, 'Stop reviewing it entirely'),
              act('Too basic · remove', removeSkill, 'Never show it again; restore any time'),
            ],
        r && status !== 'removed' && act('Reset', resetSkill),
      ),
    );
  }

  render();
  return { onStoreChange: () => {} };
}

export function renderRead(root, cid, chunkId) {
  const ch = chunk(cid, chunkId);
  window.drillContext = { cid, chunkId };
  if (!ch) {
    root.append(h('div.page', h('div.empty', 'No such page.')));
    return {};
  }
  const cards = [];
  const clearPage = () => {
    if (!confirm(`Clear everything you typed on "${ch.title}"? Your learning progress is kept.`)) return;
    clearPageAnswers(cid, ch.id);
    cards.forEach((c) => c.clear());
  };
  root.append(h('div.page',
    h('a', { href: `#/learn/${cid}` }, `← ${course(cid).title}`),
    h('h1', { style: { marginTop: '12px' } }, ch.title),
    md(ch.intro),
    ch.problems?.length && h('div.chips', ch.problems.map((p) => h('span.chip', p))),
    h('p.muted', { style: { fontSize: '13px' } }, 'Completing one card of a section counts that skill as learned, the first time. After that, cards here are free practice. What you type is kept on this page.'),
    h('button.btn.ghost', { style: { marginBottom: '8px' }, onclick: clearPage }, 'Clear my answers on this page'),
    (ch.skills || []).map((s) => {
      const badge = h('span.read-badge');
      const showBadge = () => {
        const st = skillStatus(cid, s.id);
        if (st === 'new') return;
        const r = rec(cid, s.id);
        badge.textContent = st === 'removed' ? 'removed' : st === 'mastered' ? '✓ mastered'
          : r.box === 0 ? '✓ seen · comes back next session' : `✓ learned · next review ${nextDueLabel(r)}`;
      };
      showBadge();
      return h('section.read-skill',
        h('div.read-head', h('h2', s.name), badge),
        h('div.teach', md(s.teach)),
        h('div.ex-list', (s.cards || []).map((card) => {
          const key = answerKey(cid, ch.id, s.id, card.id);
          const c = courseCard(card, {
            meta: { cid, chunkId: ch.id, sid: s.id },
            onGrade: (g) => { if (markRead(cid, ch.id, s.id, g)) showBadge(); },
            saved: getAnswer(key),
            onSave: (state) => setAnswer(key, state),
          });
          cards.push(c);
          return c.el;
        })),
      );
    }),
  ));
  return {};
}

/** All courses, with progress and a one-click way into each. */
export function renderCourses(root) {
  window.drillContext = {};
  const list = Object.values(store.content.courses || {});
  root.append(h('div.page',
    h('div.kicker', 'Drills'),
    h('h1', 'Your courses'),
    h('p.muted', { style: { margin: '0 0 20px' } }, 'Pick a course. To add or change a lesson, or to create a whole new course, use “Edit with Claude” at the top right.'),
    h('div.course-grid', list.map((c) => {
      const p = courseProgress(c.id);
      const plan = planSession(c.id);
      const due = plan.reviews.length;
      return h('a.course-card', { href: `#/learn/${c.id}` },
        h('h2', c.title),
        h('p.muted', c.summary),
        bar(p),
        h('div.course-card-foot',
          counts(p),
          h('span.course-due', due ? `${due} due` : plan.learn.length ? 'next: new page' : 'all caught up')),
      );
    })),
  ));
  return {};
}
