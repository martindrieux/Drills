// Small DOM + formatting helpers shared by every view.

/** h('div.card#id', {onclick, class, style...}, ...children) */
export function h(tag, attrs, ...children) {
  const [, name = 'div', rest = ''] = tag.match(/^([a-z0-9-]*)(.*)$/i);
  const el = document.createElement(name || 'div');
  for (const part of rest.match(/[.#][^.#]+/g) || []) {
    if (part[0] === '.') el.classList.add(part.slice(1));
    else el.id = part.slice(1);
  }
  if (attrs != null && attrs !== false && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs);
    attrs = null;
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  append(el, children);
  return el;
}

/** Replace an element's children; accepts the same nested arrays / nulls as h(). */
export function fill(el, ...children) {
  el.replaceChildren();
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/** Render markdown (lessons, prompts) with syntax-highlighted code blocks. */
export function md(src, cls = 'md') {
  const el = h(`div.${cls}`);
  el.innerHTML = window.marked.parse(src || '');
  for (const code of el.querySelectorAll('pre code')) {
    if (!code.className) code.className = 'language-python';
    window.hljs.highlightElement(code);
  }
  return el;
}

export function codeBlock(src) {
  const code = h('code.language-python', src.replace(/\n+$/, ''));
  window.hljs.highlightElement(code);
  return h('pre', code);
}

export const dedent = (s) => {
  const lines = (s || '').replace(/\n+$/, '').split('\n');
  const ind = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return lines.map((l) => l.slice(Number.isFinite(ind) ? ind : 0)).join('\n');
};

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export function relDay(iso) {
  if (!iso) return '';
  const diff = Math.round((new Date(iso + 'T00:00:00') - new Date(today() + 'T00:00:00')) / 864e5);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  return diff > 0 ? `in ${diff}d` : `${-diff}d ago`;
}

export const STATUS_LABEL = { new: 'Not seen', learning: 'Learning', known: 'Known', due: 'Due for refresh' };

export const KIND = {
  prereq: { out: 'Requires', in: 'Required by', color: 'var(--k-prereq)' },
  uses: { out: 'Uses', in: 'Used by', color: 'var(--k-uses)' },
  contrast: { out: 'Compare with', in: 'Compare with', color: 'var(--k-contrast)' },
  variant: { out: 'Variant of', in: 'Variant of', color: 'var(--k-variant)' },
};

export function statusDot(status) {
  return h(`span.dot.st-${status}`, { title: STATUS_LABEL[status] });
}

export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
