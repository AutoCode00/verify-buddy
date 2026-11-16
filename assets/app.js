// /app — Contract → Source → Match → Constructor args → Verify → Proof.
// Desktop: canvas layout (steps · code + bytecode · inspector + attempt log · sticky action bar). Mobile: one step at a time.
import { CONFIG } from './config.js';
import {
  NETS, NET, MODE, wallet, isAddress, short, detectNetwork, explorerInfo, getTx, explorerAddress, explorerTx, explorerVerifyForm,
  submitFlattened, submitStandardInput, waitVerified, npmVersions, npmFile, registry, uploadSource, loadEthers, localSource, connect,
} from './chain.js';
import {
  readBytecode, compareRuntime, constructorArgs, flatten, ImportError, findContracts, parseImports, resolveImport, npmPackageOf,
  attemptPlan, standardInput, settingsLabel, licenseType, LICENSE_LABEL, defaultEvm, pragmaVersion, strip0x, versionAtLeast,
} from './engine.js';
import { Compiler, resolveVersion, compilerList } from './compiler.js';
import { buddy, icons } from './buddy.js';
import { $, $$, esc, chev, toast, copy, download, highlightInto, fmtBytes, fmtMs, hasGsap, reduced } from './ui.js';

const STEPS = [
  ['Contract', 'Address + network'],
  ['Source', 'Drop your .sol files'],
  ['Match', 'Find the settings'],
  ['Constructor args', 'From the creation tx'],
  ['Verify', 'Explorer submit or guide'],
  ['Proof', 'Record on BOT Chain'],
];
const fresh = () => ({
  step: 1, maxStep: 1, busy: '',
  address: '', net: null, code: '', info: null, explorer: null, error: '', verifiedAck: false,
  files: {}, order: [], pkgs: {}, pkgList: {}, pasteName: 'Contract.sol', pasteOpen: false,
  mainFile: '', contractName: '', flat: null, flatError: null,
  version: '', long: '', soljson: '', dl: null,
  attempts: [], viaIR: false, moreRuns: false, match: null, miss: null,
  ctor: null, ctorHash: '', ctorPaste: '',
  verifyTab: 'api', verify: { status: 'idle', msg: '' }, point: -1,
  proof: null, view: 'code',
});

export async function render(root) {
  let S = fresh();
  const compiler = new Compiler();
  let cancelled = false;
  let pollCtl = null;
  const q = new URLSearchParams(location.search);
  if (isAddress(q.get('address'))) S.address = q.get('address');

  root.innerHTML = `
  <div class="app-shell">
    <div class="app-grid">
      <aside class="app-left"><div class="panel sticky">
        <div class="panel-head"><span class="panel-title">${icons.layers} Steps</span><span class="chip" id="netChip">BOT Chain</span></div>
        <ol class="steps" id="steps"></ol>
        <div class="side-buddy"><div id="buddyBox">${buddy('idle', { size: 64 })}</div><div class="bubble" id="bubble">Paste an address — I’ll read its bytecode.</div></div>
      </div></aside>
      <section class="app-centre">
        <div class="panel" id="card"></div>
        <div class="tabs mobile-tabs" role="tablist" id="mTabs"><button role="tab" data-view="code" aria-selected="true">Source</button><button role="tab" data-view="hex" aria-selected="false">Bytecode</button></div>
        <div class="work" id="work">
          <div class="panel code-panel">
            <div class="panel-head"><span class="panel-title">${icons.file} <span id="codeTitle">Flattened source</span></span><span class="row"><span class="chip" id="codeMeta">—</span><button class="icon-btn" data-action="copy-flat" aria-label="Copy flattened source">${icons.copy}</button><button class="icon-btn" data-action="download-flat" aria-label="Download flattened source">${icons.download}</button></span></div>
            <pre class="language-solidity"><code id="codeOut">// Your flattened source appears here after Step 2.</code></pre>
          </div>
          <div class="panel hex-panel">
            <div class="panel-head"><span class="panel-title">${icons.bytes} Runtime bytecode</span><span class="chip" id="hexMeta">—</span></div>
            <div class="hex" id="hexOut">Deployed bytecode appears here after Step 1.</div>
          </div>
        </div>
      </section>
      <aside class="app-right">
        <div class="panel sticky" style="margin-bottom:16px">
          <div class="panel-head"><span class="panel-title">${icons.sliders} Settings inspector</span><span class="chip" id="inspState">waiting</span></div>
          <div id="inspector"></div>
        </div>
        <div class="panel">
          <div class="panel-head"><span class="panel-title">${icons.clock} Attempt log</span><span class="small mono" id="logMeta"></span></div>
          <ul class="attempts" id="log"><li class="attempt"><span></span><span class="t">No attempts yet</span><span></span></li></ul>
        </div>
      </aside>
    </div>
  </div>
  <div class="actionbar"><div class="actionbar-in">
    <div class="status" id="status"><span>Step 1 of 6 · Contract</span></div>
    <div class="row" id="actions"></div>
  </div></div>`;

  // ---------------------------------------------------------------- painting
  const set = (patch) => { Object.assign(S, patch); paint(); };
  function paint() {
    paintSteps(); paintCard(); paintInspector(); paintLog(); paintBar(); paintBuddy();
  }
  function stepSummary(i) {
    switch (i) {
      case 1: return S.info ? `${short(S.address)} · ${S.net?.name || ''}` : STEPS[0][1];
      case 2: return S.flat ? `${S.contractName || 'auto'} · ${S.flat.order.length} file${S.flat.order.length > 1 ? 's' : ''}` : STEPS[1][1];
      case 3: return S.match ? settingsLabel(S.match.s) : S.miss ? 'No match yet' : STEPS[2][1];
      case 4: return S.ctor ? (S.ctor.args ? `${S.ctor.args.length / 2} bytes` : 'none') : STEPS[3][1];
      case 5: return S.verify.status === 'done' ? 'Verified ✓' : S.verify.status === 'guide' ? 'Guide' : STEPS[4][1];
      case 6: return S.proof ? 'Recorded ✓' : STEPS[5][1];
      default: return '';
    }
  }
  function paintSteps() {
    $('#steps', root).innerHTML = STEPS.map(([t], k) => {
      const i = k + 1;
      const done = i < S.step || (i === 6 && S.proof) || (i === 5 && S.verify.status === 'done');
      return `<li><button class="step${i === S.step ? ' is-current' : ''}${done ? ' is-done' : ''}" type="button" data-goto="${i}" ${i > S.maxStep ? 'disabled' : ''} ${i === S.step ? 'aria-current="step"' : ''}>
        <span class="step-n">${done ? icons.check : i}</span><span><span class="step-t">${t}</span><span class="step-s">${esc(stepSummary(i))}</span></span></button></li>`;
    }).join('');
    $('#netChip', root).textContent = S.net ? `${S.net.name} · ${S.net.chainId}` : 'auto-detect';
  }
  function paintBuddy() {
    let pose = 'idle', say = 'Paste an address — I’ll read its bytecode.';
    if (S.busy === 'read') { pose = 'read'; say = 'Reading the bytecode…'; }
    else if (S.step === 1 && S.info) { pose = 'read'; say = S.info.meta?.solc ? `Compiled with solc ${S.info.meta.solc}. Drop the source next.` : 'No metadata — pick the compiler in Step 3.'; }
    if (S.step === 2) { pose = 'read'; say = S.flat ? `Flattened ${S.flat.order.length} file${S.flat.order.length > 1 ? 's' : ''}. Ready to match!` : S.flatError ? 'One import is missing — help me find it.' : 'Drop your .sol files (or paste).'; }
    if (S.step === 3) {
      const run = S.attempts.find((a) => a.status === 'run');
      if (S.busy === 'dl') { pose = 'sweat'; say = 'Downloading the compiler…'; }
      else if (run) { pose = 'sweat'; say = `Trying ${run.label}…`; }
      else if (S.match) { pose = 'thumbs'; say = 'Exact match! 🎉'; }
      else if (S.miss) { pose = 'sad'; say = 'No match yet — see the hints.'; }
      else { pose = 'read'; say = 'Ready when you are.'; }
    }
    if (S.step === 4) { pose = S.ctor ? 'thumbs' : 'read'; say = !S.ctor ? 'Looking for constructor args…' : !S.ctor.hasCtorInputs ? 'No constructor args needed.' : S.ctor.args ? 'Found the constructor args.' : 'Help me find the deploy tx.'; }
    if (S.step === 5) { pose = S.verify.status === 'done' ? 'thumbs' : 'point'; say = S.verify.status === 'done' ? 'Verified on the explorer ✓' : S.verifyTab === 'api' ? 'One click and I’ll submit it.' : 'Copy each field into the form →'; }
    if (S.step === 6) { pose = S.proof ? 'thumbs' : 'point'; say = S.proof ? 'Proof recorded on BOT Chain!' : 'Leave a proof on BOT Chain?'; }
    const box = $('#buddyBox', root);
    if (box.dataset.pose !== pose) { box.dataset.pose = pose; box.innerHTML = buddy(pose, { size: 64 }); if (hasGsap() && !reduced()) gsap.from(box.firstElementChild, { y: 6, opacity: 0, duration: .3 }); }
    $('#bubble', root).textContent = say;
  }

  function inspectorRows() {
    const m = S.match?.s;
    return [
      ['Contract', S.contractName || S.match?.name ? `<span class="mono">${esc(S.match?.name || S.contractName)}</span>` : '<span class="small">auto</span>'],
      ['Compiler', S.long ? `<span class="chip chip-indigo">${esc(S.long)}</span>` : S.version ? `<span class="chip chip-indigo">v${esc(S.version)}</span>` : '—'],
      ['EVM version', m ? `<span class="chip">${esc(m.evmVersion)}</span>` : '—'],
      ['Optimization', m ? `<span class="chip ${m.optimizer ? 'chip-emerald' : ''}">${m.optimizer ? 'enabled' : 'off'}</span>` : '—'],
      ['Runs', m ? `<span class="mono">${m.optimizer ? m.runs : '—'}</span>` : '—'],
      ['via-IR', m ? `<span class="mono">${m.viaIR ? 'yes' : 'no'}</span>` : '—'],
      ['License', S.flat ? `<span class="chip">${esc(S.flat.spdx || 'none')}</span>` : '—'],
      ['Match', S.match ? `<span class="chip chip-emerald">${S.match.perfect ? 'perfect ✓' : 'exact ✓'}</span>` : S.miss ? '<span class="chip chip-ember">no match</span>' : '—'],
    ];
  }
  function paintInspector() {
    $('#inspector', root).innerHTML = inspectorRows().map(([k, v]) => `<div class="insp-row"><span>${k}</span>${v}</div>`).join('');
    const st = $('#inspState', root);
    st.textContent = S.match ? 'matched' : S.attempts.some((a) => a.status === 'run') ? 'searching' : S.miss ? 'no match' : 'waiting';
    st.className = 'chip' + (S.match ? ' chip-emerald' : S.miss ? ' chip-ember' : '');
  }
  function paintLog() {
    const log = $('#log', root);
    if (!S.attempts.length) { log.innerHTML = `<li class="attempt"><span></span><span class="t">No attempts yet</span><span></span></li>`; $('#logMeta', root).textContent = ''; return; }
    log.innerHTML = S.attempts.map((a) => `<li class="attempt ${a.status === 'ok' ? 'ok-row' : a.status === 'run' ? 'run' : ''}"><span>${a.status === 'run' ? '<i class="spin"></i>' : a.status === 'ok' ? '✅' : a.status === 'err' ? '⚠️' : a.status === 'skip' ? '·' : '❌'}</span><span>${esc(a.label)}</span><span class="t">${a.ms != null ? fmtMs(a.ms) : ''}</span></li>`).join('');
    $('#logMeta', root).textContent = `${S.attempts.filter((a) => a.status !== 'run').length}/${S.attempts.length}`;
    const run = log.querySelector('.run, .ok-row');
    run?.scrollIntoView({ block: 'nearest' });
  }

  // ---------------------------------------------------------------- the step card
  function paintCard() {
    const c = $('#card', root);
    c.innerHTML = [card1, card2, card3, card4, card5, card6][S.step - 1]();
    afterCard();
  }
  const head = (n, title, sub) => `<div class="stage-card"><div class="eyebrow eyebrow-mono">Step ${n} of 6</div><h2>${title}</h2><p class="sub">${sub}</p>`;

  function card1() {
    const i = S.info;
    let body = `<form class="row" style="margin-top:18px" data-form="address">
        <input class="input mono grow" id="addr" name="addr" placeholder="0x… deployed contract address" value="${esc(S.address)}" autocomplete="off" spellcheck="false" aria-label="Contract address">
        <button class="btn btn-dark" type="submit" ${S.busy ? 'disabled' : ''}>${S.busy === 'read' ? '<i class="spin"></i> Reading…' : `Read bytecode ${chev()}`}</button>
      </form>
      <p class="small" style="margin-top:8px">Mainnet (677) or testnet (968) — detected automatically.</p>`;
    if (S.error) body += `<div class="notice notice-err">${esc(S.error)}</div>`;
    if (i) {
      const m = i.meta;
      body += `<div class="facts">
        <div class="fact"><span>Network</span><b>${esc(S.net.name)}</b></div>
        <div class="fact"><span>Compiler</span><b>${m?.solc ? 'solc ' + esc(m.solc) : 'unknown'}</b></div>
        <div class="fact"><span>Runtime size</span><b>${fmtBytes(i.size)}</b></div>
        <div class="fact"><span>Uses PUSH0</span><b>${i.push0 ? 'yes' : 'no'}</b></div>
        <div class="fact"><span>Metadata</span><b title="${esc(m?.cid || '')}">${m?.cid ? esc(m.cid.slice(0, 10)) + '…' : m ? 'present' : 'none'}</b></div>
        <div class="fact"><span>Explorer</span><b>${S.explorer?.reachable ? (S.explorer.verified ? '<span class="ok">verified</span>' : 'not verified') : 'unreachable'}</b></div>
      </div>
      <div class="say">${icons.search}<span>Compiled with ${m?.solc ? 'solc ' + esc(m.solc) : 'an unknown solc'} · ${i.size.toLocaleString()} bytes · uses PUSH0: ${i.push0 ? 'yes' : 'no'}${i.mcopy ? ' · MCOPY: yes' : ''}</span></div>`;
      if (S.explorer?.verified) body += `<div class="notice notice-ok"><b>Already verified ✓</b> — ${S.explorer.verifiedName ? esc(S.explorer.verifiedName) + ' is ' : 'this contract is '}verified on the explorer. <a href="${explorerAddress(S.address, S.net)}?tab=contract" target="_blank" rel="noopener">See it ↗</a>. You can still match it and record a proof anyway.</div>`;
      if (!S.explorer?.reachable) body += `<div class="notice notice-warn">The explorer API didn’t answer — Buddy will use <b>guide mode</b> in Step 5. Matching still works.</div>`;
      if (!m) body += `<div class="notice notice-warn">This bytecode has no metadata tail, so Buddy can’t read the compiler version. You’ll pick it in Step 3 (Buddy suggests one from your pragma).</div>`;
    }
    return head(1, 'Which contract?', 'Paste the deployed address. Buddy reads its runtime bytecode and the compiler version hidden in the metadata.') + body + '</div>';
  }

  function card2() {
    const names = Object.keys(S.files);
    const candidates = contractCandidates();
    let body = `<div class="drop" id="drop" tabindex="0" role="button" aria-label="Drop or choose .sol files">
        ${icons.upload}<b>Drop .sol files or a folder</b><p>…or <u>choose files</u>. Add <code>package.json</code> and Buddy uses its package versions.</p>
        <input type="file" id="fileIn" multiple accept=".sol,.json" hidden>
      </div>
      <div class="row" style="margin-top:10px"><button class="btn btn-ghost btn-sm" type="button" data-action="toggle-paste">${S.pasteOpen ? 'Hide paste box' : 'Paste source instead'}</button></div>`;
    if (S.pasteOpen) body += `<div style="margin-top:8px"><label class="field"><span>File name</span><input class="input mono" id="pasteName" value="${esc(S.pasteName)}"></label>
      <label class="field"><span>Solidity source</span><textarea class="textarea mono" id="pasteSrc" rows="8" placeholder="// SPDX-License-Identifier: MIT&#10;pragma solidity ^0.8.24;&#10;contract …"></textarea></label>
      <button class="btn btn-reverse btn-sm" type="button" data-action="add-paste">Add file ${icons.plus}</button></div>`;
    if (names.length) body += `<div class="files">${names.map((n) => `<span class="file-chip">${icons.file}${esc(n)}<button type="button" data-remove="${esc(n)}" aria-label="Remove ${esc(n)}">${icons.x}</button></span>`).join('')}</div>`;
    if (names.length) {
      body += `<div class="row" style="margin-top:16px;align-items:flex-end">
        <label class="field grow" style="margin:0"><span>Main file</span><select class="select" id="mainFile">${names.map((n) => `<option ${n === S.mainFile ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
        <label class="field grow" style="margin:0"><span>Main contract</span><select class="select" id="contractSel"><option value="">Auto-detect (try every contract)</option>${candidates.map((n) => `<option ${n === S.contractName ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      </div>`;
    }
    const pk = Object.keys(S.pkgs);
    if (pk.length) {
      body += `<div style="margin-top:16px"><div class="small" style="margin-bottom:4px">npm packages (from jsDelivr) — pick the exact version you deployed with:</div>${pk.map((p) => `<div class="pkg-row"><span>${esc(p)}</span><select class="select" data-pkg="${esc(p)}" style="height:34px">${(S.pkgList[p] || [S.pkgs[p]]).slice(0, 80).map((v) => `<option ${v === S.pkgs[p] ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></div>`).join('')}</div>`;
    }
    if (S.flatError) {
      const e = S.flatError;
      body += `<div class="notice notice-warn"><b>Import not found:</b> <code>${esc(e.path)}</code>${e.from ? ` (imported by <code>${esc(e.from)}</code>)` : ''}. ${e.pkg ? `Pick another version of <code>${esc(e.pkg)}</code> above, or drop the file.` : 'Drop that file too, or paste it.'}</div>`;
    }
    if (S.flat) {
      body += `<div class="notice notice-ok">Flattened <b>${S.flat.order.length}</b> file${S.flat.order.length > 1 ? 's' : ''} → ${S.flat.source.length.toLocaleString()} characters · SPDX <b>${esc(S.flat.spdx || 'none')}</b>.
        <span class="row" style="margin-top:8px"><button class="btn btn-reverse btn-sm" type="button" data-action="copy-flat">${icons.copy} Copy</button><button class="btn btn-reverse btn-sm" type="button" data-action="download-flat">${icons.download} Download</button></span></div>`;
      for (const w of S.flat.warnings) body += `<div class="notice notice-warn">${esc(w)}</div>`;
    }
    return head(2, 'Drop the source.', 'Add the contract and anything it imports. Local imports resolve against your files; npm packages come from jsDelivr.') + body + '</div>';
  }

  function card3() {
    let body = '';
    if (!S.info?.meta?.solc) {
      body += `<label class="field" style="margin-top:16px;max-width:280px"><span>Compiler version</span><input class="input mono" id="verIn" value="${esc(S.version)}" placeholder="0.8.24"><small>No metadata in the bytecode — Buddy guessed from your pragma.</small></label>`;
    }
    if (S.dl) {
      const pct = S.dl.total ? Math.min(100, (S.dl.loaded / S.dl.total) * 100) : Math.min(95, (S.dl.loaded / 9e6) * 100);
      body += `<div style="margin-top:16px"><div class="row-between small"><span>${S.dl.cached ? 'Compiler loaded from cache' : `Downloading soljson ${esc(S.version)}…`}</span><span class="mono">${(S.dl.loaded / 1e6).toFixed(1)} MB</span></div><div class="bar"><i style="width:${S.dl.cached ? 100 : pct}%"></i></div></div>`;
    }
    if (S.match) {
      const m = S.match;
      body += `<div class="notice notice-ok" style="font-size:15px">✅ <b>${m.perfect ? 'Perfect match' : 'Exact match'}:</b> solc ${esc(S.version)} · evmVersion ${esc(m.s.evmVersion)} · ${m.s.optimizer ? `optimizer on, ${m.s.runs} runs` : 'optimizer off'}${m.s.viaIR ? ' · via-IR' : ''} · license ${esc(S.flat?.spdx || 'none')} · contract <b>${esc(m.name)}</b>${m.perfect ? '<br><span class="small">The metadata hash matches too — same source byte for byte, comments included.</span>' : ''}${m.ranges.length ? `<br><span class="small">${m.ranges.length} immutable range${m.ranges.length > 1 ? 's' : ''} masked.</span>` : ''}</div>`;
    } else if (S.miss) {
      body += `<div class="notice notice-err"><b>No match after ${S.attempts.filter((a) => a.status === 'x').length} attempts.</b> ${esc(S.miss.why || '')}</div>
        <div class="notice notice-info"><b>Hints</b><br>• Wrong source version? Paste exactly what you deployed (Remix → the file at deploy time).<br>• Different OpenZeppelin version? Change it in Step 2 — even a patch release changes bytecode.<br>• Uses an external library? Library linking is out of scope for now.<br>• Built with via-IR (Foundry/Hardhat <code>viaIR: true</code>)? Toggle it below and retry.</div>`;
    }
    if (S.compileError) body += `<div class="notice notice-err"><b>Compiler error</b><pre class="mono" style="white-space:pre-wrap;margin:6px 0 0;font-size:12px">${esc(S.compileError)}</pre></div>`;
    const running = S.attempts.some((a) => a.status === 'run') || S.busy === 'dl';
    body += `<div class="row" style="margin-top:16px">
      <label class="row small"><input type="checkbox" id="viaIR" ${S.viaIR ? 'checked' : ''} ${running ? 'disabled' : ''}> via-IR</label>
      <label class="row small"><input type="checkbox" id="moreRuns" ${S.moreRuns ? 'checked' : ''} ${running ? 'disabled' : ''}> also try 1, 10,000 and 999,999 runs</label>
    </div>`;
    return head(3, S.match ? 'Exact match found.' : 'Find the settings.', `Buddy compiles in your browser and tries EVM version × optimizer settings, most likely first, and stops at the first exact match (metadata stripped, immutables masked).`) + body + '</div>';
  }

  function card4() {
    const c = S.ctor;
    let body = '';
    if (!c) body += `<div class="notice notice-info"><i class="spin"></i> Looking up the creation transaction…</div>`;
    else {
      if (!c.hasCtorInputs) body += `<div class="notice notice-ok">This contract’s constructor takes no arguments — nothing to encode.</div>`;
      else if (c.args) {
        body += `<label class="field" style="margin-top:16px"><span>ABI-encoded constructor arguments <span class="chip" style="margin-left:6px">${esc(c.source)}</span></span>
          <div class="row"><input class="input mono grow" readonly value="${esc(c.args)}" aria-label="Constructor arguments hex"><button class="btn btn-reverse btn-sm" type="button" data-copy="${esc(c.args)}">${icons.copy} Copy</button></div></label>`;
        if (c.decoded) body += `<div class="decoded">${c.decoded.map(([n, v]) => `${esc(n)} = ${esc(v)}`).join('<br>')}</div>`;
        else if (c.decodeError) body += `<div class="notice notice-warn">Couldn’t decode with the constructor ABI: ${esc(c.decodeError)}</div>`;
      } else {
        body += `<div class="notice notice-warn">${esc(c.error || 'Creation transaction not found.')} Paste the deploy tx hash (from Remix or the explorer):</div>`;
      }
      if (c.hasCtorInputs) {
        body += `<form class="row" style="margin-top:12px" data-form="ctor-tx"><input class="input mono grow" id="ctorTx" placeholder="0x… deploy transaction hash" value="${esc(S.ctorHash)}"><button class="btn btn-reverse" type="submit">Use tx ${chev()}</button></form>
          <details style="margin-top:10px"><summary class="small" style="cursor:pointer">…or paste the encoded args yourself</summary>
          <form class="row" style="margin-top:8px" data-form="ctor-hex"><input class="input mono grow" id="ctorHex" placeholder="0000…" value="${esc(S.ctorPaste)}"><button class="btn btn-reverse" type="submit">Use hex</button></form></details>`;
      }
    }
    return head(4, 'Constructor arguments.', 'The explorer needs the ABI-encoded arguments your contract was deployed with. Buddy reads them from the creation transaction.') + body + '</div>';
  }

  function guideFields() {
    const m = S.match;
    const ev = explorerEvm();
    return [
      ['Contract address', S.address],
      ['Verification method', m.s.viaIR ? 'Solidity (Standard JSON input)' : 'Solidity (Flattened source code)'],
      ['Compiler', S.long],
      ['EVM version', ev],
      ['Optimization enabled', m.s.optimizer ? 'Yes' : 'No'],
      ['Optimization runs', m.s.optimizer ? String(m.s.runs) : '200 (ignored)'],
      ['Contract name', m.name],
      ['License', LICENSE_LABEL[licenseType(S.flat.spdx)] || 'None'],
      ['Contract code', S.flat.source, `${S.flat.source.split('\n').length} lines`],
      ['Constructor args', S.ctor?.args || '', S.ctor?.args ? `${S.ctor.args.length / 2} bytes` : 'none (leave empty)'],
    ];
  }
  function card5() {
    const reachable = S.explorer?.reachable;
    const tab = reachable ? S.verifyTab : 'guide';
    let body = `<div class="tabs" role="tablist" style="margin-top:16px;display:inline-flex">
      <button role="tab" data-vtab="api" aria-selected="${tab === 'api'}" ${reachable ? '' : 'disabled title="Explorer API unreachable"'}>One-click submit</button>
      <button role="tab" data-vtab="guide" aria-selected="${tab === 'guide'}">Guide mode</button></div>`;
    if (S.explorer?.verified && S.verify.status !== 'done') body += `<div class="notice notice-ok">Already verified on the explorer ✓ — you can skip to the proof.</div>`;
    if (tab === 'api') {
      const v = S.verify;
      body += `<p class="small" style="margin-top:14px">Buddy sends the flattened source, ${esc(S.long)}, evmVersion <b>${esc(explorerEvm())}</b>, ${S.match.s.optimizer ? `optimizer ${S.match.s.runs} runs` : 'optimizer off'}, contract <b>${esc(S.match.name)}</b>, license and constructor args to <code>${esc(S.net.explorer.replace('https://', ''))}</code>, then polls until it’s verified.</p>`;
      if (v.status === 'sending' || v.status === 'polling') body += `<div class="notice notice-info"><i class="spin"></i> ${esc(v.msg)}</div>`;
      if (v.status === 'done') body += `<div class="notice notice-ok" style="font-size:15px"><b>Verified ✓</b> — <a href="${explorerAddress(S.address, S.net)}?tab=contract" target="_blank" rel="noopener">see it on the explorer ↗</a></div>`;
      if (v.status === 'error') body += `<div class="notice notice-err">${esc(v.msg)} — try again, or switch to <b>Guide mode</b>.</div>`;
      if (v.status === 'timeout') body += `<div class="notice notice-warn">${esc(v.msg)} <a href="${explorerAddress(S.address, S.net)}?tab=contract" target="_blank" rel="noopener">Check the explorer ↗</a></div>`;
    } else {
      body += `<p class="small" style="margin-top:14px">Open the explorer form and copy each field — Buddy points at the next one.</p><div class="checklist" id="checklist">${guideFields().map(([k, v, hint], i) => `<div class="check-item${S.point === i ? ' is-point' : ''}" data-i="${i}"><span>${esc(k)}</span><span class="val" title="${esc(String(v).slice(0, 200))}">${esc(hint || v || '—')}</span><button class="btn btn-reverse btn-sm" type="button" data-guide="${i}">${icons.copy} Copy</button>${S.point === i ? `<span class="pointer">${buddy('point', { size: 50 })}</span>` : ''}</div>`).join('')}</div>
        <div class="row" style="margin-top:14px"><a class="btn btn-dark" href="${explorerVerifyForm(S.address, S.net)}" target="_blank" rel="noopener">Open explorer form ${icons.arrowUpRight}</a><button class="btn btn-ghost" type="button" data-action="guide-done">I’ve verified it ✓</button></div>`;
    }
    return head(5, S.verify.status === 'done' ? 'Verified ✓' : 'Verify on the explorer.', 'scan.botchain.ai runs Blockscout with an open verification API — submit in one click, or follow the guide.') + body + '</div>';
  }

  function card6() {
    const m = S.match;
    let body = `<div class="facts facts-4">
      <div class="fact"><span>Contract</span><b>${esc(short(S.address))}</b></div>
      <div class="fact"><span>Compiler</span><b>${esc(S.long.split('+')[0])}</b></div>
      <div class="fact"><span>Settings</span><b>${esc(m.s.evmVersion)} · ${m.s.optimizer ? m.s.runs + ' runs' : 'opt off'}</b></div>
      <div class="fact"><span>Source hash</span><b title="${esc(S.sourceHash || '')}">${S.sourceHash ? esc(S.sourceHash.slice(0, 12)) + '…' : '—'}</b></div>
    </div>`;
    if (MODE === 'preview') body += `<div class="notice notice-warn">Preview mode — the ProofRegistry isn’t deployed yet, so this proof is saved in your browser (no transaction).</div>`;
    else if (S.net.chainId !== NET.chainId) body += `<div class="notice notice-warn">This contract is on ${esc(S.net.name)}, the registry is on ${esc(NET.name)}. The proof is recorded on ${esc(NET.name)}.</div>`;
    if (!CONFIG.worker) body += `<p class="small" style="margin-top:12px">IPFS upload isn’t configured, so the proof stores the source hash only. Your flattened file stays in this browser for re-checks.</p>`;
    else body += `<p class="small" style="margin-top:12px">Recording uploads the flattened source to IPFS so anyone can recompile it — that’s the only time your code leaves the browser.</p>`;
    if (!wallet.hasWallet && MODE === 'live') body += `<div class="notice notice-warn">Install <a href="https://metamask.io/download/" target="_blank" rel="noopener">MetaMask</a> to record a proof. Matching and verifying work without it.</div>`;
    if (S.proofState) body += `<div class="notice ${S.proofState.err ? 'notice-err' : 'notice-info'}">${S.proofState.err ? '' : '<i class="spin"></i> '}${esc(S.proofState.msg)}${S.proofState.hash ? ` · <a href="${explorerTx(S.proofState.hash, NET)}" target="_blank" rel="noopener">tx ↗</a>` : ''}</div>`;
    if (S.proof) body += `<div class="notice notice-ok" style="font-size:15px"><b>Proof recorded ✓</b>${S.proof.hash && MODE === 'live' ? ` · <a href="${explorerTx(S.proof.hash, NET)}" target="_blank" rel="noopener">view tx ↗</a>` : ''}<div class="row" style="margin-top:10px"><a class="btn btn-primary btn-sm" href="v/${S.address}" data-link>Open proof page ${chev()}</a><button class="btn btn-reverse btn-sm" type="button" data-copy="${location.origin}${window.VB_BASE || '/'}v/${S.address}">${icons.link} Copy link</button></div></div>`;
    return head(6, S.proof ? 'Proof recorded.' : 'Leave a proof on BOT Chain.', 'Record what your browser matched — the address, the flattened-source hash, the compiler and settings — on the ProofRegistry. Optional, gas only.') + body + '</div>';
  }

  // ---------------------------------------------------------------- action bar
  function paintBar() {
    $('#status', root).innerHTML = `<span>Step ${S.step} of 6 · ${STEPS[S.step - 1][0]}</span>${S.match ? `<span class="chip chip-emerald">${esc(settingsLabel(S.match.s))}</span>` : ''}`;
    const back = S.step > 1 ? `<button class="btn btn-ghost" type="button" data-action="back">Back</button>` : '';
    let main = '';
    const running = S.attempts.some((a) => a.status === 'run') || S.busy === 'dl';
    switch (S.step) {
      case 1: main = `<button class="btn btn-primary" type="button" data-action="next" ${S.info ? '' : 'disabled'}>Continue to source ${chev()}</button>`; break;
      case 2: main = S.flat ? `<button class="btn btn-primary" type="button" data-action="next">Find settings ${chev()}</button>` : `<button class="btn btn-dark" type="button" data-action="flatten" ${Object.keys(S.files).length && S.busy !== 'flat' ? '' : 'disabled'}>${S.busy === 'flat' ? '<i class="spin"></i> Flattening…' : `Flatten ${chev()}`}</button>`; break;
      case 3: main = running ? `<button class="btn btn-outline" type="button" data-action="cancel">${icons.stop} Cancel</button>`
        : S.match ? `<button class="btn btn-primary" type="button" data-action="next">Constructor args ${chev()}</button>`
          : `<button class="btn btn-primary" type="button" data-action="match">${S.miss ? `${icons.refresh} Retry` : `${icons.play} Start matching`}</button>`; break;
      case 4: main = `<button class="btn btn-primary" type="button" data-action="next" ${S.ctor && (!S.ctor.hasCtorInputs || S.ctor.args) ? '' : 'disabled'}>Verify ${chev()}</button>`; break;
      case 5: {
        const tab = S.explorer?.reachable ? S.verifyTab : 'guide';
        const busy = ['sending', 'polling'].includes(S.verify.status);
        main = tab === 'api' && S.verify.status !== 'done'
          ? `<button class="btn btn-dark" type="button" data-action="submit" ${busy ? 'disabled' : ''}>${busy ? '<i class="spin"></i> Verifying…' : `Submit to explorer ${chev()}`}</button><button class="btn btn-ghost" type="button" data-action="next">Skip to proof</button>`
          : `<button class="btn btn-primary" type="button" data-action="next">Record proof ${chev()}</button>`;
        break;
      }
      case 6: main = S.proof ? `<a class="btn btn-primary" href="v/${S.address}" data-link>Open proof page ${chev()}</a>` : `<button class="btn btn-primary" type="button" data-action="record" ${S.proofState && !S.proofState.err ? 'disabled' : ''}>${icons.stamp} Record proof</button>`; break;
    }
    $('#actions', root).innerHTML = back + main;
  }

  // ---------------------------------------------------------------- centre panels
  function paintCode() {
    const out = $('#codeOut', root);
    if (S.flat) { highlightInto(out, S.flat.source); $('#codeMeta', root).textContent = `${S.flat.source.split('\n').length} lines · ${S.flat.spdx || 'no SPDX'}`; $('#codeTitle', root).textContent = S.flat.order.length > 1 ? 'Flattened source' : S.mainFile; }
    else { out.textContent = '// Your flattened source appears here after Step 2.'; $('#codeMeta', root).textContent = '—'; }
  }
  /** Bytecode with regions: metadata (grey), immutables (striped), matched (green), first mismatch onward (ember). */
  function paintHex() {
    const out = $('#hexOut', root);
    if (!S.code) { out.textContent = 'Deployed bytecode appears here after Step 1.'; $('#hexMeta', root).textContent = '—'; return; }
    const hex = strip0x(S.code);
    const n = hex.length / 2;
    const metaLen = S.info?.meta?.length || 0;
    const cls = new Array(n).fill('');
    for (let k = n - metaLen; k < n; k++) cls[k] = 'meta';
    if (S.match) {
      for (let k = 0; k < n - metaLen; k++) cls[k] = 'm';
      for (const [st, len] of S.match.ranges) for (let k = st; k < st + len && k < n; k++) cls[k] = 'im';
    } else if (S.miss?.firstDiff != null) {
      for (let k = 0; k < Math.min(S.miss.firstDiff, n - metaLen); k++) cls[k] = 'm';
      for (let k = S.miss.firstDiff; k < n - metaLen; k++) cls[k] = 'x';
    }
    let html = '', cur = null, buf = '';
    const flush = () => { if (buf) html += cur ? `<span class="${cur}">${buf}</span>` : buf; buf = ''; };
    for (let k = 0; k < n; k++) { if (cls[k] !== cur) { flush(); cur = cls[k]; } buf += hex.substr(k * 2, 2); }
    flush();
    out.innerHTML = '0x' + html;
    $('#hexMeta', root).textContent = `${n.toLocaleString()} bytes${metaLen ? ` · ${metaLen} metadata` : ''}${S.match?.ranges.length ? ` · ${S.match.ranges.length} immutable` : ''}`;
  }

  // ---------------------------------------------------------------- step 1: read bytecode
  async function readAddress(addr) {
    addr = addr.trim();
    if (!isAddress(addr)) { set({ error: 'That doesn’t look like an address — it should be 0x followed by 40 hex characters.' }); return; }
    S = { ...fresh(), files: S.files, mainFile: S.mainFile, pkgs: S.pkgs, pkgList: S.pkgList, address: addr, busy: 'read' };
    paint();
    try {
      const { net, code } = await detectNetwork(addr);
      if (!net) { set({ busy: '', error: 'No contract code at this address on BOT Chain mainnet or testnet. Is it a wallet address, or not deployed yet?' }); return; }
      const info = readBytecode(code);
      set({ net, code, info, version: info.meta?.solc || '', explorer: null });
      paintHex();
      const explorer = await explorerInfo(net, addr);
      set({ explorer, busy: '', maxStep: Math.max(S.maxStep, 2) });
      history.replaceState(null, '', `app?address=${addr}${location.search.includes('net=') ? '&net=' + new URLSearchParams(location.search).get('net') : ''}`);
    } catch (e) { set({ busy: '', error: e.message }); }
  }

  // ---------------------------------------------------------------- step 2: files + flatten
  function contractCandidates() {
    const out = [];
    for (const [name, src] of Object.entries(S.files)) for (const c of findContracts(src)) if (c.kind === 'contract' && !c.abstract && !out.includes(c.name)) out.push(c.name);
    return out;
  }
  function guessMain() {
    const names = Object.keys(S.files);
    const imported = new Set();
    for (const [n, src] of Object.entries(S.files)) for (const imp of parseImports(src)) imported.add(resolveImport(n, imp.path).split('/').pop());
    const roots = names.filter((n) => !imported.has(n.split('/').pop()) && findContracts(S.files[n]).some((c) => c.kind === 'contract' && !c.abstract));
    return roots[roots.length - 1] || names[names.length - 1] || '';
  }
  async function addFiles(list) {
    let pkgJson = null;
    for (const f of list) {
      const name = (f.webkitRelativePath || f.relPath || f.name).replace(/^\/+/, '');
      const text = await f.text();
      if (/package\.json$/i.test(name)) { pkgJson = text; continue; }
      if (!/\.sol$/i.test(name)) continue;
      S.files[name] = text;
    }
    if (pkgJson) {
      try {
        const j = JSON.parse(pkgJson);
        for (const [p, v] of Object.entries({ ...j.dependencies, ...j.devDependencies })) if (/solidity|contracts|openzeppelin|solmate|solady/i.test(p)) S.pkgs[p] = String(v).replace(/^[\^~>=<\s]+/, '');
        toast('package.json read — package versions set');
      } catch { toast('Couldn’t read package.json'); }
    }
    S.mainFile = guessMain();
    S.flat = null; S.flatError = null; S.match = null; S.miss = null;
    paint(); paintCode();
  }
  // walk dropped folders
  async function entriesToFiles(items) {
    const out = [];
    const walk = async (entry, path) => {
      if (entry.isFile) { const f = await new Promise((r, j) => entry.file(r, j)); f.relPath = path + f.name; out.push(f); }
      else if (entry.isDirectory) {
        if (/^(node_modules|\.git|cache|out|artifacts)$/.test(entry.name)) return;
        const reader = entry.createReader();
        let batch;
        do { batch = await new Promise((r) => reader.readEntries(r)); for (const e of batch) await walk(e, path + entry.name + '/'); } while (batch.length);
      }
    };
    for (const it of items) { const e = it.webkitGetAsEntry?.(); if (e) await walk(e, ''); }
    return out;
  }

  async function defaultPkgVersion(pkg) {
    const list = await npmVersions(pkg);
    S.pkgList[pkg] = list;
    if (!list.length) return 'latest';
    if (/@openzeppelin\/contracts/.test(pkg)) {
      const v = S.version || pragmaVersion(S.files[S.mainFile] || '') || '0.8.20';
      const major = versionAtLeast(v, '0.8.20') ? '5.' : '4.';
      return list.find((x) => x.startsWith(major)) || list[0];
    }
    return list[0];
  }
  async function loadSource(path, from) {
    if (path in S.files) return S.files[path];
    const base = path.split('/').pop();
    const local = Object.keys(S.files).filter((k) => k === path || k.endsWith('/' + path) || path.endsWith('/' + k) || k.split('/').pop() === base);
    const pkg = !path.startsWith('.') ? npmPackageOf(path) : null;
    // prefer a local file with the same tail path (e.g. dropped lib/…); otherwise npm
    const exact = local.find((k) => k.endsWith(path) || path.endsWith(k));
    if (exact) return S.files[exact];
    if (pkg && !Object.keys(S.files).some((k) => k.startsWith(pkg + '/'))) {
      if (!S.pkgs[pkg]) S.pkgs[pkg] = await defaultPkgVersion(pkg);
      else if (!S.pkgList[pkg]) npmVersions(pkg).then((l) => { S.pkgList[pkg] = l; });
      const text = await npmFile(pkg, S.pkgs[pkg], path.slice(pkg.length + 1));
      if (text != null) return text;
    }
    if (local.length === 1) return S.files[local[0]];
    throw new ImportError(path, from, pkg);
  }
  async function doFlatten() {
    if (!S.mainFile) return;
    set({ busy: 'flat', flatError: null, flat: null });
    try {
      const flat = await flatten(S.mainFile, loadSource);
      const cands = contractCandidates();
      if (S.contractName && !cands.includes(S.contractName)) S.contractName = '';
      if (!S.contractName) {
        const inMain = findContracts(S.files[S.mainFile] || '').filter((c) => c.kind === 'contract' && !c.abstract);
        S.contractName = inMain.length === 1 ? inMain[0].name : '';
      }
      if (!S.version && !S.info?.meta?.solc) S.version = pragmaVersion(flat.source) || '';
      set({ busy: '', flat, match: null, miss: null, attempts: [], maxStep: Math.max(S.maxStep, 3) });
      paintCode();
      if (hasGsap() && !reduced()) gsap.from('#codeOut', { opacity: 0, y: 8, duration: .35 });
    } catch (e) {
      if (e instanceof ImportError) set({ busy: '', flatError: { path: e.path, from: e.from, pkg: e.pkg } });
      else { set({ busy: '' }); toast(e.message); }
    }
  }

  // ---------------------------------------------------------------- step 3: match
  // scan.botchain.ai lists EVM targets up to cancun + "default" (the compiler's own default)
  function explorerEvm() {
    const e = S.match?.s.evmVersion;
    if (!['prague', 'osaka'].includes(e)) return e;
    return e === defaultEvm(S.version) ? 'default' : e;
  }
  async function doMatch() {
    cancelled = false;
    const version = (S.version || '').trim();
    if (!/^\d+\.\d+\.\d+$/.test(version)) { toast('Enter a compiler version like 0.8.24'); return; }
    if (!versionAtLeast(version, '0.4.11')) { toast('Compilers before 0.4.11 aren’t supported'); return; }
    S.match = null; S.miss = null; S.compileError = ''; S.attempts = []; S.ctor = null;
    try {
      const { file, long } = await resolveVersion(version);
      set({ long, soljson: file, busy: 'dl', dl: { loaded: 0, total: 0 } });
      await compiler.load(file, (p) => { S.dl = p; paintCardProgress(); });
      if (cancelled) return;
      S.dl = null; S.busy = '';
    } catch (e) { if (!e.cancelled) toast(e.message); set({ busy: '', dl: null }); return; }

    const plan = attemptPlan(version, { push0: S.info.push0, mcopy: S.info.mcopy, viaIR: S.viaIR, runsList: S.moreRuns ? [200, 1000, 1, 10000, 999999] : [200, 1000] });
    S.attempts = plan.map((s) => ({ s, label: settingsLabel(s), status: 'wait' }));
    paint();
    const fileName = (S.mainFile.split('/').pop() || 'Contract.sol');
    let best = null;
    for (const a of S.attempts) {
      if (cancelled) return;
      a.status = 'run'; paintLog(); paintInspector(); paintBuddy(); paintBar();
      const t0 = performance.now();
      let out;
      try { out = (await compiler.compile(standardInput(fileName, S.flat.source, a.s))).output; }
      catch (e) { if (e.cancelled || cancelled) return; a.status = 'err'; a.ms = Math.round(performance.now() - t0); continue; }
      a.ms = Math.round(performance.now() - t0);
      const errs = (out.errors || []).filter((x) => x.severity === 'error');
      if (errs.length) {
        const msg = errs.map((x) => x.formattedMessage || x.message).join('\n');
        if (/evmVersion|EVM version|Invalid EVM/i.test(msg)) { a.status = 'skip'; a.label += ' (not supported)'; continue; }
        a.status = 'err';
        S.compileError = msg.slice(0, 1600);
        S.attempts.forEach((x) => { if (x.status === 'wait') x.status = 'skip'; });
        set({ miss: { why: 'The source doesn’t compile with this compiler — see the error below.' } });
        return;
      }
      const contracts = Object.values(out.contracts?.[fileName] || {});
      const names = Object.keys(out.contracts?.[fileName] || {});
      let hit = null;
      for (let k = 0; k < contracts.length; k++) {
        if (S.contractName && names[k] !== S.contractName) continue;
        const c = contracts[k];
        const runtime = c.evm?.deployedBytecode?.object;
        if (!runtime) continue;
        const r = compareRuntime(S.code, runtime, c.evm.deployedBytecode.immutableReferences);
        if (r.match) { hit = { name: names[k], c, r }; break; }
        if (!best || (r.firstDiff || 0) > (best.firstDiff || 0)) best = { ...r, name: names[k] };
      }
      if (hit) {
        a.status = 'ok';
        S.attempts.forEach((x) => { if (x.status === 'wait') x.status = 'skip'; });
        S.attempts = S.attempts.filter((x) => x.status !== 'skip' || x.label.includes('not supported'));
        S.match = { s: a.s, name: hit.name, perfect: hit.r.perfect, ranges: hit.r.ranges, abi: hit.c.abi, creation: hit.c.evm.bytecode.object, runtime: hit.c.evm.deployedBytecode.object, input: standardInput(fileName, S.flat.source, a.s) };
        S.contractName = S.contractName || hit.name;
        set({ maxStep: Math.max(S.maxStep, 4) });
        paintHex();
        celebrate();
        return;
      }
      a.status = 'x';
    }
    const why = best?.reason === 'length' ? `Closest was ${best.name}: ${best.lengths[1].toLocaleString()} bytes vs ${best.lengths[0].toLocaleString()} on chain — the source probably differs.` : best ? `Closest was ${best.name}, identical for the first ${best.firstDiff.toLocaleString()} bytes.` : '';
    set({ miss: { why, firstDiff: best?.firstDiff ?? null } });
    paintHex();
  }
  function paintCardProgress() {
    if (S.step !== 3) return;
    const bar = $('#card .bar i', root);
    if (!bar) { paintCard(); return; }
    const pct = S.dl.total ? Math.min(100, (S.dl.loaded / S.dl.total) * 100) : Math.min(95, (S.dl.loaded / 9e6) * 100);
    bar.style.width = (S.dl.cached ? 100 : pct) + '%';
    const mb = $('#card .bar', root).previousElementSibling?.lastElementChild;
    if (mb) mb.textContent = (S.dl.loaded / 1e6).toFixed(1) + ' MB';
  }
  function celebrate() {
    if (!hasGsap() || reduced()) return;
    gsap.fromTo('#hexOut .m', { opacity: .3 }, { opacity: 1, duration: .6, stagger: { each: .002, from: 'start' } });
    gsap.from('#card .notice-ok', { scale: .96, opacity: 0, duration: .45, ease: 'back.out(2)' });
  }

  // ---------------------------------------------------------------- step 4: constructor args
  async function findCtor(fromTxHash, pastedHex) {
    const m = S.match;
    const ctorAbi = (m.abi || []).find((x) => x.type === 'constructor');
    const inputs = ctorAbi?.inputs || [];
    const base = { hasCtorInputs: inputs.length > 0, args: '', source: '', decoded: null };
    if (!inputs.length) { set({ ctor: { ...base, args: '' } }); return; }
    let creationInput = '', source = '', error = '';
    if (pastedHex != null) { creationInput = null; source = 'pasted'; }
    else if (fromTxHash) {
      try { const tx = await getTx(S.net, fromTxHash); if (!tx) error = 'That transaction wasn’t found on ' + S.net.name + '.'; else if (tx.to) error = 'That transaction calls a contract (a factory?) — paste the encoded args instead.'; else { creationInput = tx.input; source = 'deploy tx'; } }
      catch (e) { error = e.message; }
    } else {
      if (S.explorer?.creationCode) { creationInput = S.explorer.creationCode; source = 'explorer'; }
      else if (S.explorer?.creationTx) {
        try { const tx = await getTx(S.net, S.explorer.creationTx); if (tx && !tx.to) { creationInput = tx.input; source = 'creation tx'; } } catch { /* fall through */ }
      }
      if (!creationInput) error = 'Creation transaction not found.';
    }
    let args = '';
    if (pastedHex != null) args = strip0x(pastedHex);
    else if (creationInput) {
      const r = constructorArgs(creationInput, m.creation);
      if (r.ok) args = r.args; else { error = 'The creation code doesn’t start with the compiled bytecode (proxy or factory?) — paste the deploy tx hash or the args.'; }
    }
    const ctor = { ...base, args, source, error };
    if (args) {
      try {
        const E = await loadEthers();
        const vals = E.AbiCoder.defaultAbiCoder().decode(inputs.map((i) => (i.type.startsWith('tuple') ? E.ParamType.from(i) : i.type)), '0x' + args);
        const fmt = (v) => (typeof v === 'string' ? (E.isAddress(v) ? short(v) : `'${v}'`) : typeof v === 'bigint' ? v.toString() : Array.isArray(v) ? `[${[...v].map(fmt).join(', ')}]` : String(v));
        ctor.decoded = inputs.map((inp, k) => [inp.name || `arg${k}`, fmt(vals[k])]);
      } catch (e) { ctor.decodeError = e.shortMessage || e.message; }
    }
    set({ ctor, maxStep: Math.max(S.maxStep, ctor.args || !ctor.hasCtorInputs ? 5 : 4) });
  }

  // ---------------------------------------------------------------- step 5: verify
  async function doSubmit() {
    const m = S.match;
    pollCtl?.abort();
    pollCtl = new AbortController();
    set({ verify: { status: 'sending', msg: 'Sending to the explorer…' } });
    const p = {
      compiler: S.long, source: S.flat.source, optimizer: m.s.optimizer, runs: m.s.runs, contractName: m.name, evmVersion: explorerEvm(),
      constructorArgs: S.ctor?.args || '', license: licenseType(S.flat.spdx), fileName: (S.mainFile.split('/').pop() || 'Contract.sol'), input: { ...m.input, settings: { ...m.input.settings, outputSelection: { '*': { '*': ['*'] } } } },
    };
    try {
      if (m.s.viaIR) await submitStandardInput(S.net, S.address, p); else await submitFlattened(S.net, S.address, p);
    } catch (e) {
      if (/already verified/i.test(e.message)) { set({ verify: { status: 'done', msg: '' }, maxStep: 6 }); return; }
      set({ verify: { status: 'error', msg: e.message || 'The explorer rejected the request' } });
      return;
    }
    set({ verify: { status: 'polling', msg: 'Submitted — waiting for the explorer to compile and check…' } });
    const ok = await waitVerified(S.net, S.address, { tries: 40, every: 3000, signal: pollCtl.signal, onTick: (n) => { S.verify.msg = `Waiting for the explorer… (${n * 3}s)`; if (S.step === 5) { const el = $('#card .notice-info', root); if (el) el.lastChild.textContent = ' ' + S.verify.msg; } } });
    if (pollCtl.signal.aborted) return;
    if (ok) { set({ verify: { status: 'done', msg: '' }, maxStep: 6 }); if (hasGsap() && !reduced()) gsap.from('#card .notice-ok', { scale: .95, opacity: 0, duration: .4 }); }
    else set({ verify: { status: 'timeout', msg: 'The explorer hasn’t confirmed yet — it may still be working.' } });
  }

  // ---------------------------------------------------------------- step 6: proof
  async function doRecord() {
    const m = S.match;
    try {
      if (MODE === 'live' && !wallet.account) { set({ proofState: { msg: 'Connect your wallet…' } }); await connect(); }
      let cid = '';
      if (CONFIG.worker) {
        set({ proofState: { msg: 'Uploading the flattened source to IPFS…' } });
        try { cid = await uploadSource(S.flat.source, `${m.name}.flat.sol`); } catch (e) { toast(e.message + ' — recording without a CID'); }
      }
      set({ proofState: { msg: MODE === 'live' ? 'Confirm the transaction in MetaMask…' : 'Saving the proof in this browser…' } });
      localSource.set(S.sourceHash, S.flat.source);
      const r = await registry.record({ target: S.address, sourceHash: S.sourceHash, compiler: S.long, evmVersion: m.s.evmVersion + (m.s.viaIR ? '+viaIR' : ''), optimizer: m.s.optimizer, runs: m.s.runs, perfect: m.perfect, cid }, (hash) => { S.proofState = { msg: 'Waiting for confirmation…', hash }; paintCard(); });
      set({ proofState: null, proof: { hash: r.hash, cid } });
      if (hasGsap() && !reduced()) gsap.from('#card .notice-ok', { scale: .95, opacity: 0, duration: .4, ease: 'back.out(2)' });
    } catch (e) {
      set({ proofState: { err: true, msg: e.message || 'Something went wrong — try again.' } });
    }
  }

  // ---------------------------------------------------------------- navigation between steps
  async function go(step) {
    if (step < 1 || step > S.maxStep) return;
    if (step === 5 && S.verify.status === 'idle' && !S.explorer?.reachable) S.verifyTab = 'guide';
    set({ step });
    if (step === 4 && !S.ctor) findCtor();
    if (step === 6 && !S.sourceHash) { const E = await loadEthers(); S.sourceHash = E.id(S.flat.source); paintCard(); }
    if (hasGsap() && !reduced()) gsap.from('#card .stage-card', { y: 10, opacity: 0, duration: .35, ease: 'power2.out' });
    if (matchMedia('(max-width: 860px)').matches) $('#card', root).scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function next() {
    if (S.step === 1 && S.info) { S.maxStep = Math.max(S.maxStep, 2); go(2); }
    else if (S.step === 2 && S.flat) { S.maxStep = Math.max(S.maxStep, 3); go(3); if (!S.match && !S.attempts.length) doMatch(); }
    else if (S.step === 3 && S.match) go(4);
    else if (S.step === 4) { S.maxStep = Math.max(S.maxStep, 5); go(5); }
    else if (S.step === 5) { S.maxStep = 6; go(6); }
  }

  // ---------------------------------------------------------------- events
  function afterCard() {
    const drop = $('#drop', root);
    if (drop) {
      const fi = $('#fileIn', root);
      drop.addEventListener('click', () => fi.click());
      drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); } });
      fi.addEventListener('change', () => addFiles([...fi.files]));
      drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', async (e) => {
        e.preventDefault(); drop.classList.remove('over');
        const items = [...(e.dataTransfer.items || [])];
        const files = items.some((i) => i.webkitGetAsEntry?.()?.isDirectory) ? await entriesToFiles(items) : [...e.dataTransfer.files];
        addFiles(files);
      });
    }
    $('#addr', root)?.focus({ preventScroll: true });
  }
  root.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    if (f.dataset.form === 'address') readAddress($('#addr', root).value);
    if (f.dataset.form === 'ctor-tx') { S.ctorHash = $('#ctorTx', root).value.trim(); if (/^0x[0-9a-fA-F]{64}$/.test(S.ctorHash)) { set({ ctor: null }); findCtor(S.ctorHash); } else toast('Paste a 0x… transaction hash (66 characters)'); }
    if (f.dataset.form === 'ctor-hex') { S.ctorPaste = $('#ctorHex', root).value.trim(); if (/^(0x)?([0-9a-fA-F]{2})*$/.test(S.ctorPaste)) findCtor(null, S.ctorPaste); else toast('That isn’t hex'); }
  });
  root.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'mainFile') { S.mainFile = t.value; set({ flat: null, flatError: null, match: null, miss: null }); paintCode(); }
    if (t.id === 'contractSel') { S.contractName = t.value; set({ match: null, miss: null, attempts: [] }); }
    if (t.dataset.pkg) { S.pkgs[t.dataset.pkg] = t.value; set({ flat: null, flatError: null, match: null, miss: null }); paintCode(); }
    if (t.id === 'viaIR') S.viaIR = t.checked;
    if (t.id === 'moreRuns') S.moreRuns = t.checked;
    if (t.id === 'verIn') S.version = t.value.trim();
  });
  root.addEventListener('mouseover', (e) => {
    const it = e.target.closest('.check-item');
    if (it && S.step === 5 && Number(it.dataset.i) !== S.point) { S.point = Number(it.dataset.i); $$('.check-item', root).forEach((x) => x.classList.toggle('is-point', x === it)); $$('.check-item .pointer', root).forEach((p) => p.remove()); it.insertAdjacentHTML('beforeend', `<span class="pointer">${buddy('point', { size: 50 })}</span>`); }
  });
  root.addEventListener('click', (e) => {
    const t = e.target.closest('[data-action],[data-goto],[data-remove],[data-copy],[data-guide],[data-vtab],[data-view]');
    if (!t) return;
    if (t.dataset.goto) return go(Number(t.dataset.goto));
    if (t.dataset.remove) { delete S.files[t.dataset.remove]; S.mainFile = guessMain(); set({ flat: null, flatError: null, match: null, miss: null }); paintCode(); return; }
    if (t.dataset.copy) return copy(t.dataset.copy);
    if (t.dataset.vtab) return set({ verifyTab: t.dataset.vtab });
    if (t.dataset.view) { S.view = t.dataset.view; $('#work', root).classList.toggle('show-hex', S.view === 'hex'); $$('#mTabs button', root).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === S.view))); return; }
    if (t.dataset.guide) {
      const i = Number(t.dataset.guide);
      const f = guideFields()[i];
      copy(f[1] || '', `${f[0]} copied`);
      S.point = Math.min(i + 1, guideFields().length - 1);
      paintCard();
      return;
    }
    switch (t.dataset.action) {
      case 'next': return next();
      case 'back': return go(S.step - 1);
      case 'flatten': return doFlatten();
      case 'match': return doMatch();
      case 'cancel': cancelled = true; compiler.terminate(); S.attempts.forEach((a) => { if (a.status === 'run' || a.status === 'wait') a.status = 'skip'; }); return set({ busy: '', dl: null, miss: S.match ? null : { why: 'Cancelled.' } });
      case 'submit': return doSubmit();
      case 'guide-done': return set({ verify: { status: 'done', msg: '' }, maxStep: 6 });
      case 'record': return doRecord();
      case 'toggle-paste': return set({ pasteOpen: !S.pasteOpen });
      case 'add-paste': {
        const name = ($('#pasteName', root).value.trim() || 'Contract.sol').replace(/[^\w./@-]/g, '');
        const src = $('#pasteSrc', root).value;
        if (!src.trim()) { toast('Paste some Solidity first'); return; }
        S.pasteName = name.endsWith('.sol') ? name : name + '.sol';
        S.files[S.pasteName] = src;
        S.mainFile = guessMain();
        return set({ flat: null, flatError: null, match: null, miss: null, pasteOpen: false });
      }
      case 'copy-flat': if (S.flat) copy(S.flat.source, 'Flattened source copied'); else toast('Flatten first (Step 2)'); return;
      case 'download-flat': if (S.flat) download(`${(S.match?.name || S.contractName || S.mainFile.replace(/\.sol$/, '') || 'Contract').split('/').pop()}.flat.sol`, S.flat.source); else toast('Flatten first (Step 2)'); return;
    }
  });

  paint();
  if (S.address) readAddress(S.address);
  // warm the compiler list in the background
  compilerList().catch(() => {});
  void NETS;
  return () => { cancelled = true; compiler.terminate(); pollCtl?.abort(); };
}
