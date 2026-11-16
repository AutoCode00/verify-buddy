// /v/:address — the proof page: recorded settings, source hash, live bytecode facts, re-check in the browser.
import { CONFIG } from './config.js';
import { NET, MODE, registry, detectNetwork, explorerInfo, explorerAddress, explorerTx, short, localSource, fetchCid, loadEthers } from './chain.js';
import { readBytecode, compareRuntime, standardInput } from './engine.js';
import { Compiler } from './compiler.js';
import { buddy, icons } from './buddy.js';
import { $, esc, chev, copy, fmtBytes, hasGsap, reduced, download } from './ui.js';

export async function render(root, address) {
  root.innerHTML = `<section class="proof-hero"><div class="wrap"><div class="eyebrow">Proof page</div><h1 class="h2 mono" style="font-family:var(--font-mono);font-size:32px;letter-spacing:-.02em">${esc(short(address))}</h1><p class="lede" style="margin-top:10px">Loading proof…</p></div></section>`;
  const compiler = new Compiler();
  let proofs = [], chain = null, explorer = null;
  try {
    [proofs, chain] = await Promise.all([registry.proofsOf(address), detectNetwork(address).catch(() => ({ net: null, code: '0x' }))]);
    if (chain.net) explorer = await explorerInfo(chain.net, address);
  } catch (e) {
    root.innerHTML = `<section class="section"><div class="wrap empty-state">${buddy('sad', { size: 110 })}<h1 class="h2" style="margin:0 auto">Couldn’t load this proof.</h1><p class="lede" style="margin:12px auto 0">${esc(e.message)}</p></div></section>`;
    return () => {};
  }
  const p = proofs[proofs.length - 1];
  const info = chain.code && chain.code !== '0x' ? readBytecode(chain.code) : null;
  const local = p0 => (p0 ? localSource.get(p0.sourceHash) : null);
  const lastName = (src) => { const m = src && [...src.matchAll(/\bcontract\s+([A-Za-z_$][\w$]*)/g)]; return m && m.length ? m[m.length - 1][1] : ''; };
  const name = explorer?.verifiedName || explorer?.name || lastName(local(proofs[proofs.length - 1])) || '';

  if (!p) {
    root.innerHTML = `<section class="section"><div class="wrap empty-state">${buddy('read', { size: 120 })}
      <div class="eyebrow">Proof page</div>
      <h1 class="h2" style="margin:0 auto">No proof for ${esc(short(address))} yet.</h1>
      <p class="lede" style="margin:12px auto 0">${info ? `It’s a contract on ${esc(chain.net.name)} (${info.meta?.solc ? 'solc ' + esc(info.meta.solc) + ', ' : ''}${fmtBytes(info.size)})${explorer?.verified ? ' and it’s already verified on the explorer' : ''}. Match its source and leave the first proof.` : 'There’s no contract code at this address on BOT Chain.'}</p>
      <div class="hero-ctas">${info ? `<a class="btn btn-primary btn-lg" href="app?address=${address}" data-link>Verify this contract ${chev()}</a>` : ''}<a class="btn btn-reverse btn-lg" href="${explorerAddress(address, chain.net || NET)}" target="_blank" rel="noopener">View on explorer ${icons.arrowUpRight}</a></div>
      ${MODE === 'preview' ? '<p class="small" style="margin-top:18px">Preview mode — proofs recorded in this browser show up here.</p>' : ''}
    </div></section>`;
    return () => compiler.terminate();
  }

  const when = new Date(p.at * 1000);
  const ver = String(p.compiler).replace(/^v/, '');
  const evm = String(p.evmVersion).replace('+viaIR', '');
  const viaIR = String(p.evmVersion).includes('+viaIR');
  const hasLocal = !!localSource.get(p.sourceHash);
  root.innerHTML = `
  <section class="proof-hero"><div class="wrap">
    <div class="eyebrow">Proof page · ${esc(chain.net?.name || 'BOT Chain')}</div>
    <h1 class="h1" style="font-size:56px">${esc(name || 'Proof of match')}</h1>
    <div class="row" style="margin-top:14px"><span class="mono">${esc(address)}</span><button class="icon-btn" type="button" data-copy="${esc(address)}" aria-label="Copy address">${icons.copy}</button></div>
    <div class="big-check"><span class="disc">${icons.check}</span>Source matches bytecode ✓${p.perfect ? ' <span class="chip chip-emerald">perfect match</span>' : ''}</div>
    <div class="row" style="margin-top:16px"><span class="chip chip-indigo">solc ${esc(ver.split('+')[0])}</span><span class="chip">evmVersion ${esc(evm)}</span><span class="chip ${p.optimizer ? 'chip-emerald' : ''}">${p.optimizer ? `optimizer ${p.runs} runs` : 'optimizer off'}</span>${viaIR ? '<span class="chip">via-IR</span>' : ''}${explorer?.verified ? '<span class="chip chip-emerald">verified on explorer ✓</span>' : ''}</div>
  </div></section>
  <section style="padding:0 0 96px"><div class="wrap"><div class="proof-grid">
    <div class="panel">
      <div class="panel-head"><span class="panel-title">${icons.stamp} Recorded proof</span><span class="small mono">${when.toLocaleString()}</span></div>
      <div class="inspector" style="box-shadow:none;border-radius:0">
        ${[
          ['Compiler', `<span class="mono">${esc(p.compiler)}</span>`],
          ['EVM version', `<span class="mono">${esc(evm)}</span>`],
          ['Optimizer', `<span class="mono">${p.optimizer ? 'enabled · ' + p.runs + ' runs' : 'off'}</span>`],
          ['Flattened-source hash', `<span class="mono" title="${esc(p.sourceHash)}">${esc(p.sourceHash.slice(0, 18))}…</span>`],
          ['Source on IPFS', p.cid ? `<a class="mono" style="text-decoration:underline" href="${CONFIG.ipfsGateway}${esc(p.cid)}" target="_blank" rel="noopener">${esc(p.cid.slice(0, 16))}… ↗</a>` : '<span class="small">not uploaded</span>'],
          ['Recorded by', `<span class="mono">${esc(short(p.recorder))}</span>`],
          ['Match type', `<span class="chip ${p.perfect ? 'chip-emerald' : ''}">${p.perfect ? 'perfect (metadata too)' : 'exact (metadata stripped)'}</span>`],
          ...(p.tx && MODE === 'live' ? [['Transaction', `<a class="mono" style="text-decoration:underline" href="${explorerTx(p.tx)}" target="_blank" rel="noopener">${esc(short(p.tx))} ↗</a>`]] : []),
        ].map(([k, v]) => `<div class="insp-row"><span>${k}</span>${v}</div>`).join('')}
      </div>
      <div class="panel-body" style="border-top:1px solid var(--line)">
        <div class="row-between"><div><b>Re-check it yourself</b><p class="small" style="margin-top:4px">Recompile the source with these settings in your browser and compare with the live bytecode.</p></div>
        <button class="btn btn-dark" type="button" id="recheck" ${p.cid || hasLocal ? '' : 'disabled title="No source copy available here"'}>${icons.refresh} Re-check</button></div>
        <div id="recheckOut"></div>
        <p class="small" style="margin-top:14px">Honest note: a proof records what the recorder’s browser matched. Anyone can re-check it by recompiling the source${p.cid ? ' from IPFS' : ''} with the settings above.${!p.cid && !hasLocal ? ' This proof has no IPFS copy, and this browser doesn’t hold the source.' : ''}</p>
      </div>
    </div>
    <div>
      <div class="panel" style="margin-bottom:16px">
        <div class="panel-head"><span class="panel-title">${icons.bytes} Live on chain</span><span class="chip">${esc(chain.net?.name || '—')}</span></div>
        ${info ? `<div class="inspector" style="box-shadow:none;border-radius:0">
          <div class="insp-row"><span>Runtime size</span><span class="mono">${fmtBytes(info.size)}</span></div>
          <div class="insp-row"><span>Metadata compiler</span><span class="mono">${info.meta?.solc ? 'solc ' + esc(info.meta.solc) : '—'}</span></div>
          <div class="insp-row"><span>Uses PUSH0</span><span class="mono">${info.push0 ? 'yes' : 'no'}</span></div>
          <div class="insp-row"><span>Explorer</span><span>${explorer?.verified ? '<span class="chip chip-emerald">verified ✓</span>' : '<span class="chip">not verified</span>'}</span></div>
        </div>` : '<div class="panel-body small">No code found at this address right now.</div>'}
        <div class="panel-body" style="border-top:1px solid var(--line)"><a class="btn btn-primary btn-sm" href="${explorerAddress(address, chain.net || NET)}" target="_blank" rel="noopener">View on explorer ${icons.arrowUpRight}</a></div>
      </div>
      <div class="panel">
        <div class="panel-head"><span class="panel-title">${icons.clock} History</span><span class="small mono">${proofs.length} proof${proofs.length > 1 ? 's' : ''}</span></div>
        <ul class="history">${proofs.slice().reverse().map((x) => `<li><span>${new Date(x.at * 1000).toLocaleDateString()} · ${esc(short(x.recorder))}</span><span>${esc(String(x.compiler).replace(/^v/, '').split('+')[0])} · ${esc(String(x.evmVersion).replace('+viaIR', ''))} · ${x.optimizer ? x.runs : 'off'}${x.perfect ? ' · ✓✓' : ''}</span></li>`).join('')}</ul>
      </div>
      <div class="row" style="margin-top:16px"><a class="btn btn-reverse btn-sm" href="app?address=${address}" data-link>Record a new proof ${chev()}</a><button class="btn btn-ghost btn-sm" type="button" data-copy="${location.href}">${icons.link} Copy link</button></div>
    </div>
  </div></div></section>`;

  if (hasGsap() && !reduced()) {
    gsap.from('.proof-hero > .wrap > *', { y: 18, opacity: 0, duration: .6, stagger: .07, ease: 'power3.out' });
    gsap.from('.big-check .disc', { scale: 0, duration: .5, delay: .3, ease: 'back.out(3)' });
    gsap.from('.proof-grid > *', { y: 24, opacity: 0, duration: .7, stagger: .1, delay: .2, ease: 'power3.out' });
  }

  root.addEventListener('click', (e) => {
    const c = e.target.closest('[data-copy]');
    if (c) copy(c.dataset.copy);
  });
  $('#recheck', root)?.addEventListener('click', async () => {
    const out = $('#recheckOut', root);
    const btn = $('#recheck', root);
    btn.disabled = true;
    const say = (cls, html) => { out.innerHTML = `<div class="notice ${cls}">${html}</div>`; };
    try {
      say('notice-info', '<i class="spin"></i> Fetching the source…');
      let src = localSource.get(p.sourceHash);
      if (!src && p.cid) src = await fetchCid(p.cid);
      if (!src) throw new Error('No source available to re-check.');
      const E = await loadEthers();
      if (E.id(src) !== p.sourceHash) throw new Error('The source doesn’t hash to the recorded sourceHash.');
      const file = p.compiler.startsWith('v') ? `soljson-${p.compiler}.js` : `soljson-v${p.compiler}.js`;
      await compiler.load(file, (pr) => say('notice-info', `<i class="spin"></i> Loading solc ${esc(ver.split('+')[0])}… ${(pr.loaded / 1e6).toFixed(1)} MB`));
      say('notice-info', '<i class="spin"></i> Compiling…');
      const s = { evmVersion: evm, optimizer: p.optimizer, runs: p.runs || 200, viaIR };
      const { output } = await compiler.compile(standardInput('Contract.sol', src, s));
      const live = await detectNetwork(address);
      let hit = null;
      for (const [n, c] of Object.entries(output.contracts?.['Contract.sol'] || {})) {
        const r = compareRuntime(live.code, c.evm?.deployedBytecode?.object || '', c.evm?.deployedBytecode?.immutableReferences);
        if (r.match) { hit = n; break; }
      }
      if (hit) say('notice-ok', `<b>Re-checked in your browser ✓</b> — ${esc(hit)} compiled with ${esc(p.compiler)} matches the live bytecode. <button class="btn btn-reverse btn-sm" style="margin-left:6px" type="button" id="dlSrc">${icons.download} Source</button>`);
      else say('notice-err', '<b>No match</b> — the recorded source and settings don’t reproduce the live bytecode.');
      $('#dlSrc', root)?.addEventListener('click', () => download(`${hit}.flat.sol`, src));
    } catch (e) { say('notice-err', esc(e.message)); }
    btn.disabled = false;
  });
  return () => compiler.terminate();
}
