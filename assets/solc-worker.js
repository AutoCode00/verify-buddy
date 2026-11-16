// Web Worker: downloads one soljson build (with progress, cached via the Cache API) and compiles Standard JSON input.
// Messages in:  { id, type: 'load', file }  |  { id, type: 'compile', input }
// Messages out: { id, type: 'progress', loaded, total } | { id, type: 'ready', version } | { id, type: 'result', output } | { id, type: 'error', message }
/* eslint-env worker */
const BIN = 'https://binaries.soliditylang.org/bin/';
const CACHE = 'verifybuddy-soljson-v1';
let compileFn = null;
let loadedFile = null;

async function fetchWithProgress(url, id) {
  let cache = null;
  try { cache = await caches.open(CACHE); const hit = await cache.match(url); if (hit) { postMessage({ id, type: 'progress', loaded: 1, total: 1, cached: true }); return await hit.text(); } } catch { /* no Cache API */ }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Compiler download failed (${res.status})`);
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let loaded = 0, last = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); loaded += value.length;
    if (loaded - last > 200000) { last = loaded; postMessage({ id, type: 'progress', loaded, total }); }
  }
  const text = new TextDecoder().decode(await new Blob(chunks).arrayBuffer());
  try { await cache?.put(url, new Response(text, { headers: { 'content-type': 'text/javascript' } })); } catch { /* quota */ }
  postMessage({ id, type: 'progress', loaded: total || loaded, total: total || loaded });
  return text;
}

async function load(file, id) {
  if (loadedFile === file && compileFn) return;
  if (loadedFile && loadedFile !== file) throw new Error('This worker already has another compiler — start a new one.');
  const text = await fetchWithProgress(BIN + file, id);
  const blob = URL.createObjectURL(new Blob([text], { type: 'text/javascript' }));
  self.Module = undefined;
  importScripts(blob);
  URL.revokeObjectURL(blob);
  const M = self.Module;
  if (!M) throw new Error('Compiler did not load');
  if (!M.calledRun && !M.asm && M.onRuntimeInitialized !== undefined) await new Promise((r) => { M.onRuntimeInitialized = r; });
  const has = (n) => typeof M['_' + n] === 'function';
  if (has('solidity_compile')) {
    const c = M.cwrap('solidity_compile', 'string', ['string', 'number', 'number']);
    compileFn = (input) => c(input, 0, 0);
  } else if (has('compileStandard')) {
    const c = M.cwrap('compileStandard', 'string', ['string', 'number']);
    compileFn = (input) => c(input, 0);
  } else throw new Error('This compiler build has no Standard JSON interface');
  loadedFile = file;
}

self.onmessage = async ({ data }) => {
  const { id, type } = data;
  try {
    if (type === 'load') {
      await load(data.file, id);
      postMessage({ id, type: 'ready', file: loadedFile });
    } else if (type === 'compile') {
      if (!compileFn) throw new Error('No compiler loaded');
      const t0 = performance.now();
      const output = JSON.parse(compileFn(JSON.stringify(data.input)));
      postMessage({ id, type: 'result', output, ms: Math.round(performance.now() - t0) });
    }
  } catch (e) {
    postMessage({ id, type: 'error', message: e.message || String(e) });
  }
};
