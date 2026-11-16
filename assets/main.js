// Router (/ · /app · /v/:address), nav, wallet pill and the certificate footer.
import { CONFIG } from './config.js';
import { NET, MODE, wallet, connect, switchNetwork, restoreWallet, onChange, registry, explorerAddress, short } from './chain.js';
import { buddy, logo, icons } from './buddy.js';
import { $, $$, esc, toast, copy, chev, hasGsap, reduced } from './ui.js';

const BASE = window.VB_BASE || '/';
const view = $('#view');
let cleanup = null;

// ------------------------------------------------------------------ routing
const routes = [
  [/^$/, () => import('./home.js'), 'home'],
  [/^app\/?$/, () => import('./app.js'), 'app'],
  [/^v\/(0x[0-9a-fA-F]{40})\/?$/, () => import('./proof.js'), 'proof'],
];
export function navigate(href, { replace = false } = {}) {
  const url = new URL(href, location.origin + BASE);
  if (url.origin !== location.origin) { location.href = href; return; }
  if (url.pathname === location.pathname && url.search === location.search && url.hash) {
    history[replace ? 'replaceState' : 'pushState'](null, '', url);
    scrollToHash(url.hash);
    return;
  }
  history[replace ? 'replaceState' : 'pushState'](null, '', url);
  render();
}
function scrollToHash(hash) {
  const el = hash && document.getElementById(hash.slice(1));
  if (el) el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
}
async function render() {
  const path = location.pathname.slice(BASE.length).replace(/^\/+/, '');
  const hit = routes.find(([re]) => re.test(path));
  try { cleanup?.(); } catch { /* ignore */ }
  cleanup = null;
  if (hasGsap() && window.ScrollTrigger) ScrollTrigger.getAll().forEach((t) => t.kill());
  $('#nav').classList.remove('open');
  document.body.dataset.route = hit ? hit[2] : '404';
  if (!hit) { view.innerHTML = notFound(); window.scrollTo(0, 0); renderFooter(); return; }
  const mod = await hit[1]();
  const params = path.match(hit[0]).slice(1);
  view.innerHTML = '';
  window.scrollTo(0, 0);
  cleanup = (await mod.render(view, ...params)) || null;
  renderFooter(); // re-created each route: its ScrollTriggers were killed above
  if (location.hash) requestAnimationFrame(() => scrollToHash(location.hash));
  $$('.nav-links a').forEach((a) => a.removeAttribute('aria-current'));
}
const notFound = () => `<section class="section"><div class="wrap empty-state">${buddy('sad', { size: 120 })}<h1 class="h2" style="margin:0 auto">This page does not exist.</h1><p class="lede" style="margin:14px auto 0">But your contract might deserve a green checkmark.</p><div class="hero-ctas"><a class="btn btn-primary btn-lg" href="app" data-link>Verify my contract ${chev()}</a></div></div></section>`;

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (!a || e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
  e.preventDefault();
  navigate(a.getAttribute('href'));
});
addEventListener('popstate', render);

// ------------------------------------------------------------------ nav
$('#brandMark').innerHTML = logo(26);
$('#navChev').outerHTML = chev();
$('#navMenu').innerHTML = icons.menu;
$('#navMenu').addEventListener('click', () => {
  const open = !$('#nav').classList.contains('open');
  $('#nav').classList.toggle('open', open);
  $('#navMenu').setAttribute('aria-expanded', String(open));
});
addEventListener('scroll', () => $('#nav').classList.toggle('is-scrolled', scrollY > 8), { passive: true });

function paintWallet() {
  const b = $('#walletBtn');
  b.classList.remove('warn');
  if (!wallet.account) { b.innerHTML = `${icons.wallet}<span class="lbl">Connect wallet</span>`; b.setAttribute('aria-label', 'Connect wallet'); return; }
  if (!wallet.chainOk) { b.classList.add('warn'); b.innerHTML = `<span class="dot"></span><span class="lbl">Switch to BOT Chain</span>`; return; }
  b.innerHTML = `<span class="dot"></span>${esc(short(wallet.account))}`;
}
$('#walletBtn').addEventListener('click', async () => {
  try {
    if (!wallet.hasWallet) { toast('MetaMask not found — matching and the guide still work without it.'); return; }
    if (wallet.account && !wallet.chainOk) await switchNetwork();
    else if (!wallet.account) await connect();
    else copy(wallet.account, 'Address copied');
  } catch (e) { toast(e.message); }
});
onChange((w) => { if (w === 'wallet') paintWallet(); if (w === 'proofs') paintFooterStats(); });
paintWallet();
restoreWallet();

if (MODE === 'preview') {
  const bar = $('#previewBar');
  bar.hidden = false;
  bar.innerHTML = `Preview mode — ProofRegistry isn’t deployed yet, so proofs are saved in this browser. Bytecode, compiling and the explorer are live. Set <code>registry</code> in <code>assets/config.js</code>.`;
}

// ------------------------------------------------------------------ footer: certificate of match
function sealSvg() {
  // wax-stamp disc with a scalloped rim
  let d = '';
  const n = 18, steps = n * 10;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = 54 + Math.cos(a * n) * 3;
    d += (i ? 'L' : 'M') + (58 + Math.cos(a) * r).toFixed(2) + ' ' + (58 + Math.sin(a) * r).toFixed(2);
  }
  return `<svg class="seal-disc" viewBox="0 0 116 116" aria-hidden="true">
    <path d="${d}Z" fill="var(--ink)"/>
    <circle cx="58" cy="58" r="44" fill="none" stroke="rgba(18,18,18,.35)" stroke-width="1" stroke-dasharray="2 3"/>
    <defs><path id="sealArc" d="M58 58 m-37 0 a37 37 0 1 1 74 0 a37 37 0 1 1 -74 0"/></defs>
    <text font-family="IBM Plex Mono, monospace" font-size="8.4" font-weight="600" letter-spacing="2.4" fill="#121212"><textPath href="#sealArc">STAMPED BY BOT CHAIN · MAINNET 677 ·</textPath></text>
  </svg>`;
}
function renderFooter() {
  const addr = NET.registry;
  const s = CONFIG.self;
  const explorerHref = addr ? explorerAddress(addr) : NET.explorer;
  $('#footer').innerHTML = `
  <div class="wrap">
    <div class="foot-grid">
      <div class="cert-wrap" style="position:relative">
        <a class="seal" href="${CONFIG.links.botchain}" target="_blank" rel="noopener" aria-label="BOT Chain — botchain.ai (opens in a new tab)">
          ${sealSvg()}<img src="assets/botchain-mark.png" alt="" width="52" height="52">
        </a>
        <div class="seal-buddy">${buddy('read', { size: 70, title: 'Buddy inspecting the BOT Chain seal' })}</div>
        <div class="cert-shadow" id="cert"><div class="cert">
          <div class="cert-in">
            <div class="cert-kicker">CERTIFICATE OF MATCH</div>
            <div class="cert-file">${esc(s.file)}</div>
            <div class="cert-settings">solc ${esc(s.compiler)} · evmVersion ${esc(s.evmVersion)} · ${esc(s.optimizer)}</div>
            <div class="cert-match">${icons.check} Source matches bytecode ✓</div>
            <div class="cert-addr">
              <span class="mono">${addr ? esc(short(addr)) : '0x…not deployed yet'}</span>
              ${addr ? `<button class="icon-btn" type="button" id="copyReg" aria-label="Copy contract address">${icons.copy}</button>` : ''}
              <a class="btn btn-primary btn-sm" href="${explorerHref}" target="_blank" rel="noopener">View on explorer ${icons.arrowUpRight}</a>
            </div>
            <div class="cert-live"><span>PROOFS <b id="fProofs">—</b></span><span>MATCHED TODAY <b id="fToday">—</b></span><span>${MODE === 'live' ? 'MAINNET' : 'PREVIEW'}</span></div>
          </div>
        </div></div>
      </div>
      <div>
        <div class="foot-cols">
          <div><h4>Product</h4><a href="app" data-link>Verify a contract</a><a href="${addr ? `v/${addr}` : 'app'}" data-link>Proof pages</a><a href="./#compare" data-link>Compare</a></div>
          <div><h4>Learn</h4><a href="./#features" data-link>How matching works</a><a href="./#faq" data-link>evmVersion explained</a><a href="${CONFIG.links.docs}" target="_blank" rel="noopener">BOT Chain docs</a><a href="${CONFIG.links.faucet}" target="_blank" rel="noopener">Faucet</a></div>
          <div><h4>Social</h4><a href="${CONFIG.links.x}" target="_blank" rel="noopener">X</a><a href="${CONFIG.links.telegram}" target="_blank" rel="noopener">Telegram</a></div>
        </div>
        <div class="foot-brand">
          <a class="brand" href="./" data-link>${logo(30)}<span>Verify Buddy</span></a>
          <p>Verify your BOT Chain contract in minutes, not hours. Exact settings found by matching your source to the deployed bytecode.</p>
        </div>
      </div>
    </div>
    <div class="foot-bottom"><span>© 2026 Verify Buddy · your source stays in your browser unless you record a proof</span><span class="mono">chain ${NET.chainId}</span></div>
  </div>`;
  $('#copyReg')?.addEventListener('click', () => copy(addr, 'Contract address copied'));
  paintFooterStats();
  if (hasGsap() && window.ScrollTrigger && !reduced()) {
    gsap.from('#cert', { y: 40, opacity: 0, duration: .9, ease: 'power3.out', scrollTrigger: { trigger: '#footer', start: 'top 85%' } });
    gsap.from('.seal', { scale: 1.6, opacity: 0, rotate: -40, duration: .7, delay: .35, ease: 'back.out(2)', scrollTrigger: { trigger: '#footer', start: 'top 85%' } });
  }
}
async function paintFooterStats() {
  try {
    const st = await registry.stats();
    const p = $('#fProofs'), t = $('#fToday');
    if (p) p.textContent = st.proofs.toLocaleString();
    if (t) t.textContent = st.today.toLocaleString();
  } catch { /* registry unreachable — leave dashes */ }
}

// GSAP plugins register once they've loaded (scripts are deferred)
function boot() {
  if (window.gsap) {
    const plugins = [window.ScrollTrigger, window.SplitText, window.DrawSVGPlugin].filter(Boolean);
    gsap.registerPlugin(...plugins);
    gsap.ticker.lagSmoothing(0); // after a background tab / dropped frames, reveals jump to where they should be instead of crawling
  }
  render();
}
if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot); else boot();
