// A learning session, screen by screen:
//   new skills  → a lesson screen (2–3 skills), then an exercise screen with their cards
//   reviews     → exercise screens of 2–3 cards
//   a miss      → a refresher lesson screen, then the retry, a few screens later extra practice
import { h, fill, md } from '../util.js';
import { warmUp } from '../python.js';
import { courseCard } from '../course/card.js';
import {
  course, chunk, skillIndex, buildSession, pickCard, grade, rec, markChunk, nextDueLabel, MASTERED,
  removeSkill, knowLater,
} from '../course/engine.js';

const GROUP = 3; // cards (or lessons) per screen
const LESSON_GUARD_MS = 1000;

const TAG = {
  intro: ['New page', 'tag-new'],
  learn: ['New', 'tag-new'],
  recheck: ['Re-check', 'tag-review'],
  review: ['Review', 'tag-review'],
  relearn: ['Relearn', 'tag-relearn'],
  extra: ['Extra practice', 'tag-relearn'],
  test: ['Test-out', 'tag-review'],
};
const GRADE = {
  clean: ['✓ Clean', 'ok'],
  struggled: ['~ Struggled', 'warn'],
  failed: ['✗ Missed', 'err'],
};
const PRACTICE_KINDS = new Set(['review', 'recheck', 'extra', 'test']);

export function renderSession(root, cid, mode = 'auto', chunkId = null) {
  if (!course(cid)) {
    root.append(h('div.page', h('div.empty', 'No course found.')));
    return {};
  }
  warmUp();
  const session = buildSession(cid, mode, chunkId);
  const idx = skillIndex(cid);
  const log = []; // { sid, kind, grade }
  let pos = 0;
  let current = null; // { ready: () => bool, next }
  let screenRefresh = null; // re-checks the visible cards after a content reload
  // Screen history: earlier screens are kept alive (editors, grades), so Back/forward lose nothing.
  const back = [];
  let ahead = [];
  const snapshot = () => ({ nodes: [...wrap.childNodes], current, screenRefresh, pos, ctx: window.drillContext });
  function restore(snap) {
    wrap.replaceChildren(...snap.nodes);
    ({ current, screenRefresh, pos } = snap);
    window.drillContext = snap.ctx;
    wrap.querySelectorAll('.CodeMirror').forEach((el) => el.CodeMirror?.refresh());
    wrap.parentElement?.scrollTo?.({ top: 0 });
  }
  /** Move to the next screen: replay one we came back from, else build it with `build`. */
  function forward(build) {
    if (wrap.childNodes.length) back.push(snapshot());
    if (ahead.length) restore(ahead.pop());
    else build();
  }
  function goBack() {
    if (!back.length) return;
    ahead.push(snapshot());
    restore(back.pop());
  }
  const wrap = h('div.page.session');
  root.append(wrap);

  if (!session.items.length) {
    fill(wrap, h('div.empty', h('h2', 'Nothing to do right now'),
      h('p', 'No reviews are due and there is no new page to learn with your current settings.'),
      h('a.btn.primary', { href: `#/learn/${cid}` }, 'Back to the course')));
    return {};
  }

  /** Drop every later item of a skill (from index `from` on). */
  function dropFuture(sid, from) {
    session.items = session.items.filter((x, i) => i < from || x.sid !== sid);
  }

  /** "Too basic → remove" and "I know it → review later" buttons; onDone(note) after either. */
  function skillActions(sid, onDone) {
    const act = (label, title, fn, note) => h('button.btn.ghost.small', {
      title,
      onclick: () => { fn(cid, sid); onDone(note); },
    }, label);
    return h('span.skill-actions-inline',
      h('button.btn.ghost.small', {
        title: 'Ask Claude to change this skill (lesson or cards)',
        onclick: () => window.dispatchEvent(new CustomEvent('drill:edit', { detail: { cid, chunkId: idx[sid].chunk.id, sids: [sid] } })),
      }, '✎ Edit'),
      act('Too basic · remove', 'Never show this skill again (restore it from the course page)', removeSkill, 'Removed from the course. Restore it from the course page if needed.'),
      act('I know it · review later', 'Skip ahead: next review in ~2 weeks, then longer', knowLater, 'Marked as known. Next review in about 2 weeks.'),
    );
  }

  /** Up to GROUP consecutive items from pos that match, never the same skill twice. */
  function take(pred) {
    const out = [];
    const sids = new Set();
    for (let i = pos; i < session.items.length && out.length < GROUP; i++) {
      const it = session.items[i];
      if (!pred(it) || sids.has(it.sid)) break;
      sids.add(it.sid);
      out.push(it);
    }
    return out;
  }

  function header(kind, label) {
    const [tag, cls] = TAG[kind];
    const total = session.items.length;
    return h('div.session-top',
      h('div.review-progress',
        h('div.bar', h('span', { style: { width: `${(100 * pos) / total}%`, background: 'var(--accent)' } })),
        h('span', `${pos} / ${total} done`),
        h('button.btn.ghost', { onclick: goBack, disabled: !back.length, title: 'Previous screen (e.g. the lesson). Your answers are kept.' }, '← Back'),
        h('button.btn.ghost', { onclick: finish }, 'End session'),
      ),
      h('div.session-meta', h(`span.tag.${cls}`, tag), label && h('span.faint', label)),
    );
  }

  function render() {
    const it = session.items[pos];
    if (!it) return finish();
    if (it.kind === 'intro') return renderIntro(it);
    if (it.kind === 'learn') return renderLesson(take((x) => x.kind === 'learn' && x.chunkId === it.chunkId), 'learn');
    if (it.kind === 'relearn') return renderLesson(take((x) => x.kind === 'relearn'), 'relearn');
    return renderCards(take((x) => PRACTICE_KINDS.has(x.kind)));
  }

  function renderLesson(group, kind) {
    const ch = chunk(cid, group[0].chunkId);
    window.drillContext = { cid, chunkId: ch.id, sids: group.map((x) => x.sid) };
    const skipped = new Set();
    const then = () => forward(() => {
      for (const sid of skipped) dropFuture(sid, pos);
      const rest = group.filter((x) => !skipped.has(x.sid));
      if (rest.length) renderCards(rest);
      else render();
    });
    fill(wrap,
      header(kind, kind === 'learn' ? ch.title : 'The lesson comes back'),
      group.map(({ sid }) => {
        const body = h('div.teach', md(idx[sid].skill.teach));
        const block = h('section.lesson-block',
          h('div.lesson-head', h('h2', idx[sid].skill.name),
            skillActions(sid, (note) => {
              skipped.add(sid);
              block.classList.add('skipped');
              fill(body, h('p.muted', note));
            })),
          body,
        );
        return block;
      }),
      h('div.screen-actions',
        h('button.btn.primary#lesson-go', { onclick: then }, `Practice ${group.length > 1 ? `these ${group.length}` : 'it'} `, h('kbd', '↵'))),
    );
    // A held or repeated Enter (e.g. the Cmd-Enter that finished the previous screen) must not skip
    // the lesson: Enter only works, and the button only takes focus, after a short pause.
    const shownAt = Date.now();
    current = { ready: () => Date.now() - shownAt > LESSON_GUARD_MS, next: then };
    document.activeElement?.blur?.();
    setTimeout(() => wrap.querySelector('#lesson-go')?.focus({ preventScroll: true }), LESSON_GUARD_MS);
    window.scrollTo?.(0, 0);
    wrap.parentElement?.scrollTo?.({ top: 0 });
  }

  function renderCards(group) {
    const groupEnd = pos + group.length;
    window.drillContext = { cid, chunkId: group[0].chunkId, sids: group.map((x) => x.sid) };
    const entries = [];
    const continueBtn = h('button.btn.primary', { disabled: true, onclick: () => advance(groupEnd) }, 'Continue ', h('kbd', '↵'));
    const kinds = new Set(group.map((x) => x.kind));
    const headKind = kinds.size === 1 ? group[0].kind : 'review';

    group.forEach((it, i) => {
      const { skill, chunk: ch } = idx[it.sid];
      let card = pickCard(cid, it.sid, it.kind);
      let peeked = false;
      const feedback = h('div.feedback.inline', { hidden: true });
      const entry = { done: false, applied: null };
      const makeCard = () => courseCard(card, {
        peeked: () => peeked,
        onCmdEnterAfterDone: () => focusNext(i),
        // A retried (fixed) card replaces the earlier grade.
        onGrade: (g) => { if (entry.applied) override(g); else apply(g); focusNext(i); },
        meta: { cid, chunkId: ch.id, sid: it.sid },
      });
      let c = makeCard();
      const cardHolder = h('div', c.el);
      entry.focus = () => c.focus();

      // After Claude edits content: if this very card changed, offer to retry the new version.
      const retryBtn = h('button.btn.small.retry', {
        hidden: true,
        onclick: () => {
          card = skillIndex(cid)[it.sid].skill.cards.find((x) => x.id === card.id);
          c = makeCard();
          cardHolder.replaceChildren(c.el);
          retryBtn.hidden = true;
          c.focus();
        },
      }, '↻ Card updated: retry it');
      entry.checkUpdate = () => {
        const fresh = skillIndex(cid)[it.sid]?.skill.cards.find((x) => x.id === card.id);
        if (fresh && JSON.stringify(fresh) !== JSON.stringify(card)) retryBtn.hidden = false;
      };

      function apply(g) {
        const res = grade(session, it, card, g);
        // Follow-ups go after this screen: the refresher right next, extra practice a bit later.
        res.inserted = res.followUps.map(({ offset, item }) => {
          const items = session.items;
          let at = Math.min(groupEnd + Math.max(0, offset - 2), items.length);
          // Never split a new page: skip past a run of intro/learn items.
          while (at < items.length && at > 0 && items[at].kind === 'learn' && ['intro', 'learn'].includes(items[at - 1].kind)) at++;
          items.splice(at, 0, item);
          return item;
        });
        entry.applied = res;
        entry.done = true;
        log.push({ sid: it.sid, kind: it.kind, grade: g, entry });
        if (it.kind === 'learn' && (chunk(cid, it.chunkId).skills || []).every((s) => rec(cid, s.id))) {
          markChunk(cid, it.chunkId, 'done');
        }
        showFeedback(g);
        continueBtn.disabled = !entries.every((e) => e.done);
      }

      function override(g) {
        entry.applied.undo();
        session.items = session.items.filter((x) => !entry.applied.inserted.includes(x));
        const li = log.findIndex((l) => l.entry === entry);
        if (li >= 0) log.splice(li, 1);
        apply(g);
      }

      function showFeedback(g) {
        const r = rec(cid, it.sid);
        const [label, cls] = GRADE[g];
        let detail;
        if (it.kind === 'learn') detail = g === 'failed' ? 'The lesson comes back next, with extra practice.' : 'Re-checked later this session.';
        else if (it.practice || it.kind === 'extra') detail = g === 'failed' ? 'One more try is coming.' : 'Practice only. It will come back next session.';
        else if (g === 'failed') detail = 'Back to box 0. The lesson comes back next, plus extra practice.';
        else if (r?.retired) detail = 'Mastered and phased out.';
        else detail = `Box ${r?.box ?? 0}/${MASTERED - 1} · next ${nextDueLabel(r)}`;
        fill(feedback,
          h(`span.grade.${cls}`, label),
          h('span.muted', detail),
          h('span', { style: { flex: 1 } }),
          g !== 'clean'
            ? h('button.btn.ghost.small', { onclick: () => override('clean') }, 'I knew it (typo)')
            : h('button.btn.ghost.small', { onclick: () => override('struggled') }, 'I guessed'),
        );
        feedback.hidden = false;
      }

      const showLessonPeek = PRACTICE_KINDS.has(it.kind);
      entries.push(entry);
      entry.el = h('section.card-block',
        h('div.card-label',
          h('span.num', `${i + 1}`),
          h('span', skill.name),
          group.length > 1 && kinds.size > 1 && h(`span.tag.${TAG[it.kind][1]}`, TAG[it.kind][0]),
          h('span.faint', ch.title),
          retryBtn,
          h('span', { style: { flex: 1 } }),
          skillActions(it.sid, (note) => {
            dropFuture(it.sid, groupEnd);
            entry.done = true;
            entry.el.classList.add('skipped');
            cardHolder.remove();
            entry.el.querySelector('details.peek')?.remove();
            fill(feedback, h('span.muted', note));
            feedback.hidden = false;
            continueBtn.disabled = !entries.every((e) => e.done);
            focusNext(i);
          }),
        ),
        showLessonPeek && h('details.lesson.peek', { ontoggle: (e) => { if (e.target.open) peeked = true; } },
          h('summary', 'Peek at the lesson', h('span.muted', ' (caps the grade at "struggled")')),
          md(skill.teach)),
        // New skill: the lesson was just shown, so re-reading it is free.
        it.kind === 'learn' && h('details.lesson.peek',
          h('summary', 'Show the lesson again'),
          md(skill.teach)),
        cardHolder,
        feedback,
      );
    });

    function focusNext(i) {
      const nxt = entries.find((e, j) => j > i && !e.done) || entries.find((e) => !e.done);
      if (nxt) nxt.focus();
      else continueBtn.focus();
    }

    fill(wrap,
      header(headKind, group.length > 1 ? `${group.length} exercises` : null),
      entries.map((e) => e.el),
      h('div.screen-actions', continueBtn),
    );
    current = { ready: () => entries.every((e) => e.done), next: () => advance(groupEnd) };
    screenRefresh = () => entries.forEach((e) => e.checkUpdate?.());
    entries[0].focus();
    wrap.parentElement?.scrollTo?.({ top: 0 });
  }

  function advance(to) {
    forward(() => {
      pos = to;
      render();
    });
  }

  function renderIntro(it) {
    const ch = chunk(cid, it.chunkId);
    const go = () => advance(pos + 1);
    fill(wrap,
      header('intro', null),
      h('div.intro-card',
        h('div.kicker', 'New page'),
        h('h1', ch.title),
        md(ch.intro),
        ch.problems?.length && h('div', h('div.given-label', "Where you'll use it"),
          h('div.chips', ch.problems.map((p) => h('span.chip', p)))),
        h('div.given-label', { style: { marginTop: '16px' } }, 'On this page'),
        h('ol.skill-preview', (ch.skills || []).map((s) => h('li', s.name))),
        h('div', { style: { marginTop: '18px' } }, h('button.btn.primary#intro-go', { onclick: go }, 'Start ', h('kbd', '↵'))),
      ),
    );
    current = { ready: () => true, next: go };
    wrap.querySelector('#intro-go').focus();
  }

  function finish() {
    if (session.testChunk) markChunk(cid, session.testChunk, 'done');
    current = null;
    const worst = new Map(); // sid -> worst grade this session
    const rank = { clean: 0, struggled: 1, failed: 2 };
    for (const l of log) if (!worst.has(l.sid) || rank[l.grade] > rank[worst.get(l.sid)]) worst.set(l.sid, l.grade);
    const tally = { clean: 0, struggled: 0, failed: 0 };
    for (const g of worst.values()) tally[g]++;
    fill(wrap,
      h('h1', 'Session done'),
      h('p.muted', `${worst.size} skills practised · ${tally.clean} clean · ${tally.struggled} struggled · ${tally.failed} missed at least once`),
      h('table.summary-table', [...worst.keys()].map((sid) => {
        const r = rec(cid, sid);
        const grades = log.filter((l) => l.sid === sid).map((l) => h(`span.grade.mini.${GRADE[l.grade][1]}`, GRADE[l.grade][0].slice(0, 1)));
        return h('tr',
          h('td', idx[sid].skill.name, h('div.faint', { style: { fontSize: '12px' } }, idx[sid].chunk.title)),
          h('td', grades),
          h('td.muted', r?.retired ? 'mastered' : `box ${r?.box ?? 0} · ${nextDueLabel(r)}`),
        );
      })),
      h('div', { style: { display: 'flex', gap: '8px', marginTop: '20px' } },
        h('a.btn.primary', { href: `#/learn/${cid}` }, 'Back to the course'),
      ),
    );
  }

  const onKey = (e) => {
    if (e.key !== 'Enter' || !current?.ready()) return;
    if (e.target.closest?.('.CodeMirror') || e.target.tagName === 'BUTTON' || e.target.tagName === 'SUMMARY') return;
    e.preventDefault();
    current.next();
  };
  const onReload = () => screenRefresh?.();
  document.addEventListener('keydown', onKey);
  window.addEventListener('drill:content-reloaded', onReload);
  render();
  return {
    destroy: () => {
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('drill:content-reloaded', onReload);
    },
  };
}
