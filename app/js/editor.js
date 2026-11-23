// Python code editor (CodeMirror 5) with predictable, IDE-like indentation:
// Enter keeps the indent (+4 after ':', -4 after return/pass/break/continue/raise),
// Tab / Backspace move by 4-space stops, and typing the ':' of else/elif/except/finally dedents the line.
const UNIT = 4;

const indentOf = (line) => line.match(/^ */)[0].length;
const spaces = (n) => ' '.repeat(Math.max(0, n));

function enter(cm) {
  if (cm.somethingSelected()) cm.replaceSelection('');
  const cur = cm.getCursor();
  const before = cm.getLine(cur.line).slice(0, cur.ch);
  const code = before.replace(/#.*$/, '').trimEnd();
  let ind = indentOf(before);
  if (code.endsWith(':')) ind += UNIT;
  else if (/^\s*(return|pass|break|continue|raise)\b/.test(code)) ind -= UNIT;
  cm.replaceSelection('\n' + spaces(ind), 'end');
}

function tab(cm) {
  if (cm.somethingSelected()) return cm.indentSelection('add');
  const ch = cm.getCursor().ch;
  cm.replaceSelection(spaces(UNIT - (ch % UNIT)), 'end');
}

function backspace(cm) {
  if (cm.somethingSelected()) return window.CodeMirror.Pass;
  const cur = cm.getCursor();
  const before = cm.getLine(cur.line).slice(0, cur.ch);
  if (!before || /[^ ]/.test(before)) return window.CodeMirror.Pass;
  const to = Math.floor((cur.ch - 1) / UNIT) * UNIT;
  cm.replaceRange('', { line: cur.line, ch: to }, cur);
}

function colon(cm) {
  cm.replaceSelection(':', 'end');
  const cur = cm.getCursor();
  const text = cm.getLine(cur.line);
  if (!/^\s*(else|elif\b.*|except\b.*|finally)\s*:$/.test(text)) return;
  let prev = cur.line - 1;
  while (prev >= 0 && !cm.getLine(prev).trim()) prev--;
  const ind = indentOf(text);
  if (prev < 0 || ind === 0 || ind < indentOf(cm.getLine(prev))) return;
  cm.replaceRange('', { line: cur.line, ch: ind - UNIT }, { line: cur.line, ch: ind });
}

/** Mounts an editor in `el`. `keys` adds extra key bindings (e.g. run shortcuts). */
export function pythonEditor(el, value, keys = {}) {
  return window.CodeMirror(el, {
    value,
    mode: 'python',
    lineNumbers: true,
    indentUnit: UNIT,
    tabSize: UNIT,
    indentWithTabs: false,
    electricChars: false,
    viewportMargin: Infinity,
    extraKeys: {
      Enter: enter,
      Tab: tab,
      'Shift-Tab': 'indentLess',
      'Cmd-]': 'indentMore',
      'Cmd-[': 'indentLess',
      'Ctrl-]': 'indentMore',
      'Ctrl-[': 'indentLess',
      Backspace: backspace,
      "':'": colon,
      ...keys,
    },
  });
}
