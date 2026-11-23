// What you typed in Read mode (answers.json), so a page shows your code again when you come back.
// Separate from progress: clearing answers never changes what you have learned. Sessions don't use it.

let answers = {}; // "<course>/<page>/<skill>/<card>" -> { code, result, cls, passed, at }
let loaded = null;

export const answerKey = (cid, chunkId, sid, cardId) => [cid, chunkId, sid, cardId].join('/');

export function loadAnswers() {
  loaded ||= fetch('/api/answers').then((r) => r.json()).then((a) => { answers = a || {}; })
    .catch(() => { loaded = null; });
  return loaded;
}

export const getAnswer = (key) => answers[key] || null;

export function setAnswer(key, value) {
  if (value) answers[key] = { ...value, at: Date.now() };
  else delete answers[key];
  save();
}

/** Remove every saved answer of a page; returns how many there were. */
export function clearPageAnswers(cid, chunkId) {
  const prefix = `${cid}/${chunkId}/`;
  const keys = Object.keys(answers).filter((k) => k.startsWith(prefix));
  keys.forEach((k) => delete answers[k]);
  if (keys.length) save();
  return keys.length;
}

let timer = null;
function save() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    fetch('/api/answers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(answers),
    }).catch((e) => console.error('Could not save answers', e));
  }, 400);
}

// Don't lose the last keystrokes if the window closes during the debounce.
window.addEventListener('beforeunload', () => {
  if (!timer) return;
  clearTimeout(timer);
  navigator.sendBeacon?.('/api/answers', new Blob([JSON.stringify(answers)], { type: 'application/json' }));
});
