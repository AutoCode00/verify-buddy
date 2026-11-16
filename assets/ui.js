// Small DOM helpers shared by every view.
import { icons } from './buddy.js';

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const chev = () => icons.chevron.replace('class="ic"', 'class="ic ic-chev"');
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const hasGsap = () => !!window.gsap;

let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
export async function copy(text, what = 'Copied') {
  try { await navigator.clipboard.writeText(text); toast(`${what} ✓`); }
  catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(ta); ta.select();
    try { document.execCommand('copy'); toast(`${what} ✓`); } catch { toast('Copy failed — select and copy manually'); }
    ta.remove();
  }
}
export function download(name, text, type = 'text/plain') {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
export const fmtBytes = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : n >= 1e3 ? `${n.toLocaleString()} bytes` : `${n} bytes`);
export const fmtMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`);
export function ago(ts) {
  const s = Math.max(0, Math.floor(Date.now() / 1000 - ts));
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

// ------------------------------------------------------------------ Prism (lazy) for Solidity highlighting
let prismReady;
export function loadPrism() {
  if (window.Prism?.languages?.solidity) return Promise.resolve(window.Prism);
  const add = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });
  window.Prism = window.Prism || { manual: true };
  prismReady ||= add('https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js')
    .then(() => add('https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-clike.min.js'))
    .then(() => add('https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-solidity.min.js'))
    .then(() => window.Prism)
    .catch(() => { prismReady = null; return null; });
  return prismReady;
}
/** Highlights `code` into `el` (falls back to plain text). Very large files stay plain for speed. */
export async function highlightInto(el, code) {
  el.textContent = code;
  if (code.length > 400000) return;
  const P = await loadPrism();
  if (P?.languages?.solidity && el.isConnected) el.innerHTML = P.highlight(code, P.languages.solidity, 'solidity');
}

/** Accordion (Zoah style, + rotates to ×). Height animated with GSAP when present. */
export function accordion(root) {
  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.acc-btn');
    if (!btn || !root.contains(btn)) return;
    const item = btn.closest('.acc-item');
    const panel = item.querySelector('.acc-panel');
    const open = btn.getAttribute('aria-expanded') !== 'true';
    if (root.dataset.single !== undefined) {
      for (const other of root.querySelectorAll('.acc-item.open')) if (other !== item) toggle(other, false);
    }
    toggle(item, open);
    function toggle(it, on) {
      const b = it.querySelector('.acc-btn'), p = it.querySelector('.acc-panel');
      b.setAttribute('aria-expanded', String(on));
      it.classList.toggle('open', on);
      if (hasGsap() && !reduced()) gsap.fromTo(p, { height: on ? 0 : p.scrollHeight }, { height: on ? 'auto' : 0, duration: .35, ease: 'power2.out' });
      else p.style.height = on ? 'auto' : '0';
    }
    void panel;
  });
}

/** Counts a number up from its current text (transform-free, text only). */
export function countTo(el, to, { duration = 1.4, format = (n) => Math.round(n).toLocaleString() } = {}) {
  if (!hasGsap() || reduced()) { el.textContent = format(to); return; }
  const o = { v: Number(String(el.textContent).replace(/[^\d.]/g, '')) || 0 };
  gsap.to(o, { v: to, duration, ease: 'power2.out', onUpdate: () => { el.textContent = format(o.v); } });
}
