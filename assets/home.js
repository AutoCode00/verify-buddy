// The website (/): 9 sections in the Zoah layout, our colours. GSAP: transform/opacity only, reduced-motion aware.
import { CONFIG } from './config.js';
import { NET, registry, short } from './chain.js';
import { buddy, icons } from './buddy.js';
import { $, $$, esc, chev, accordion, countTo, hasGsap, reduced, ago } from './ui.js';

const SNACK = [
  ['c', '// SPDX-License-Identifier: MIT'],
  ['k', 'pragma solidity ^0.8.24;'],
  ['', ''],
  ['k', 'contract SnackPoll {'],
  ['', '    string public name;'],
  ['', '    address public immutable owner;'],
  ['', '    mapping(uint8 => uint256) public votes;'],
  ['', ''],
  ['', '    constructor(string memory n) {'],
  ['', '        name = n; owner = msg.sender;'],
  ['', '    }'],
  ['', '    function vote(uint8 snack) external {'],
  ['', '        votes[snack] += 1;'],
  ['', '    }'],
  ['k', '}'],
];
// bytecode chunks shown next to SnackPoll.sol: [hex, kind] — m = matches a source line, im = immutable (masked), meta = metadata (stripped)
const HEX = [
  ['6080', 'm'], ['6040', 'm'], ['5234', 'm'], ['8015', ''], ['600f', ''], ['5760', 'm'], ['0080', ''], ['fd5b', ''],
  ['5060', 'm'], ['0436', 'm'], ['1061', ''], ['0041', ''], ['575f', 'm'], ['3560', 'm'], ['e01c', 'm'], ['8063', ''],
  ['06fd', 'm'], ['de03', 'm'], ['1461', ''], ['0045', ''], ['5780', 'm'], ['638d', 'm'], ['a5cb', 'm'], ['5b14', ''],
  ['7f00', 'im'], ['0000', 'im'], ['0000', 'im'], ['0000', 'im'], ['6100', ''], ['6a57', 'm'], ['8063', 'm'], ['b3f9', 'm'],
  ['8adc', 'm'], ['1461', ''], ['007a', ''], ['575b', 'm'], ['5f80', 'm'], ['fd5b', 'm'], ['a264', 'meta'], ['6970', 'meta'],
  ['6673', 'meta'], ['5822', 'meta'], ['1220', 'meta'], ['…', 'meta'], ['0033', 'meta'],
];
const ATTEMPTS = [
  ['shanghai · optimizer off', false, '1.2s'], ['shanghai · 200 runs', false, '1.4s'], ['shanghai · 1000 runs', false, '1.3s'],
  ['paris · optimizer off', false, '1.1s'], ['paris · 200 runs', true, '1.4s'],
];

const lineArt = {
  // "what makes Buddy different" — tiny line drawings in each card
  bytes: `<svg class="line-art" viewBox="0 0 160 90" width="160" height="90"><rect class="fill-w" x="8" y="14" width="144" height="62" rx="6"/><path class="thin" d="M20 32h20M46 32h20M72 32h20M98 32h20"/><path class="thin" d="M20 46h20M46 46h20M72 46h20"/><rect class="fill-e em" x="96" y="40" width="44" height="14" rx="3"/><path d="M104 47h28" class="em"/><circle class="fill-w" cx="118" cy="66" r="9"/><path d="M124.5 72.5l7 7"/></svg>`,
  browser: `<svg class="line-art" viewBox="0 0 160 90" width="160" height="90"><rect class="fill-w" x="10" y="10" width="140" height="70" rx="6"/><path d="M10 24h140"/><circle cx="20" cy="17" r="2"/><circle cx="28" cy="17" r="2"/><rect class="fill-p" x="22" y="34" width="56" height="34" rx="4"/><path class="thin" d="M30 44h28M30 52h36M30 60h20"/><path class="dash" d="M82 51h18"/><rect class="fill-e em" x="104" y="38" width="34" height="26" rx="4"/><path class="em" d="M113 51l5 5 9-10"/></svg>`,
  sliders: `<svg class="line-art" viewBox="0 0 160 90" width="160" height="90"><path class="thin" d="M24 24h112M24 46h112M24 68h112"/><circle class="fill-w" cx="52" cy="24" r="6"/><circle class="fill-w" cx="104" cy="46" r="6"/><circle class="fill-e em" cx="76" cy="68" r="6"/><path d="M118 74l6 6" /><path d="M110 60l14 4-6 3 5 6-3 2-5-6-4 5z" class="fill-w"/></svg>`,
  stamp: `<svg class="line-art" viewBox="0 0 160 90" width="160" height="90"><rect class="fill-w" x="20" y="14" width="74" height="62" rx="4"/><path class="thin" d="M30 28h40M30 38h50M30 48h32"/><circle class="fill-e em" cx="110" cy="56" r="20"/><path class="em" d="M101 56l6 6 12-13"/><path class="thin dash" d="M110 30v6M130 56h6M110 82v-6"/></svg>`,
  // imports section cells
  local: `<svg class="line-art" viewBox="0 0 260 150" width="260" height="150"><rect class="fill-w" x="16" y="20" width="70" height="44" rx="5"/><path class="thin" d="M26 34h40M26 44h28"/><rect class="fill-w" x="16" y="84" width="70" height="44" rx="5"/><path class="thin" d="M26 98h32M26 108h44"/><path class="dash" d="M86 42h40M86 106h40M126 42v64"/><rect class="fill-w" x="150" y="44" width="92" height="62" rx="5"/><path class="thin" d="M162 60h50M162 72h64M162 84h40"/><path d="M192 112l10 10" /><path d="M186 104l16 5-7 3 6 7-3 2-6-7-4 6z" class="fill-w"/></svg>`,
  npm: `<svg class="line-art" viewBox="0 0 260 150" width="260" height="150"><rect class="fill-b" x="20" y="30" width="90" height="26" rx="13"/><path class="thin" d="M36 43h58"/><rect class="fill-w" x="20" y="70" width="90" height="26" rx="13"/><path class="thin" d="M36 83h44"/><path class="dash" d="M110 43c30 0 30 32 52 32M110 83h52"/><rect class="fill-w" x="162" y="44" width="80" height="62" rx="5"/><path class="thin" d="M174 60h40M174 72h56M174 84h34"/><path d="M226 98l8-8" class="em"/><circle cx="214" cy="118" r="0"/></svg>`,
  flat: `<svg class="line-art" viewBox="0 0 260 150" width="260" height="150"><g class="flat-stack"><rect class="fill-w fs1" x="40" y="16" width="120" height="30" rx="5"/><path class="thin fs1" d="M52 31h60"/><rect class="fill-w fs2" x="50" y="56" width="120" height="30" rx="5"/><path class="thin fs2" d="M62 71h76"/><rect class="fill-w fs3" x="60" y="96" width="120" height="30" rx="5"/><path class="thin fs3" d="M72 111h50"/></g><path class="em draw" d="M196 40v70"/><path class="em draw" d="M188 100l8 10 8-10"/><rect class="fill-e em" x="212" y="56" width="34" height="46" rx="4"/><path class="em" d="M220 70h18M220 79h18M220 88h12"/></svg>`,
};

const FAQ = [
  ['Does my code leave my browser?', 'No. Buddy downloads the official Solidity compiler (soljson) and compiles in a Web Worker on your machine. Your source only leaves the browser if you submit it to the explorer or record a proof — then the flattened file is uploaded to IPFS so anyone can re-check the match.'],
  ['Why didn’t it match?', 'Usually a different source version than the one deployed, a different OpenZeppelin version, an external library that needs linking, or via-IR. Buddy shows hints after every miss — toggle via-IR, change the package version, or paste the exact source you deployed from Remix.'],
  ['What’s evmVersion paris?', 'It’s the EVM “hardfork” the compiler targets. Newer targets (shanghai, cancun) add opcodes like PUSH0 and MCOPY. Buddy reads the deployed bytecode: no PUSH0 means paris or older, PUSH0 means shanghai or newer — so it only tries settings that can actually match.'],
  ['Does it verify for me?', 'Yes. scan.botchain.ai runs Blockscout with an open verification API, so one click submits the flattened source, settings and constructor args and Buddy polls until it says Verified ✓. If the API is down, guide mode shows every explorer field with a Copy button.'],
  ['What is a proof?', 'An optional transaction on BOT Chain’s ProofRegistry: the contract address, the flattened-source hash, the compiler and settings. It records what your browser matched; anyone can recompile the source from IPFS and check it.'],
];

const COMPARE = [
  ['Compiler version', 'Guess from the pragma', 'Read from the bytecode metadata'],
  ['Optimizer & EVM', 'Trial and error on the explorer', 'Auto-matched in your browser'],
  ['Imports', 'Flatten by hand', 'Flattened automatically (npm too)'],
  ['Constructor args', 'ABI-encode by hand', 'Pulled from the creation tx + decoded'],
  ['After verifying', 'No record', 'On-chain proof + proof page'],
];

export async function render(el) {
  const proofHref = NET.registry ? `v/${NET.registry}` : 'v/0x505fc62244B7E490c463B0390492F19C97d51910';
  el.innerHTML = `
  <section class="hero" aria-labelledby="heroTitle">
    <div class="wrap">
      <h1 class="h1" id="heroTitle"><span class="hero-lead">Verify contracts</span> <span class="hero-rot"><span class="word" id="heroWord">completely visually.</span></span></h1>
      <p class="lede reveal">Drop your Solidity, paste your address. Verify Buddy finds the exact settings and fills the explorer form for you.</p>
      <div class="hero-ctas reveal">
        <a class="btn btn-primary btn-lg" href="app" data-link><span class="btn-beam"></span>Verify my contract ${chev()}</a>
        <a class="btn btn-reverse btn-lg" href="${proofHref}" data-link>See a proof page ${chev()}</a>
      </div>
      <p class="hero-note reveal">BOT Chain mainnet · chain 677 · compiles in your browser</p>
    </div>
  </section>

  <section class="stage-wrap" id="how" aria-label="How it works: Drop, Detect, Match, Verify">
    <div class="wrap-wide">
      <div class="stage" id="stage">
        <div class="stage-art">${stageArt()}</div>
        <div class="stage-buddy" id="stageBuddy">${buddy('read', { size: 110 })}</div>
        <div class="stage-copy">
          <div class="stage-panels">
            ${[
              ['01 · Drop', 'Drop your Solidity.'],
              ['02 · Detect', 'Buddy reads the bytecode.'],
              ['03 · Match', 'Every setting, tried.'],
              ['04 · Verify', 'Verified on the explorer.'],
            ].map(([e, t], i) => `<div class="stage-panel${i === 0 ? ' is-active' : ''}" data-i="${i}"><div class="stage-eyebrow">${e}</div><h3 class="stage-title">${t}</h3></div>`).join('')}
          </div>
        </div>
        <div class="stage-progress" role="tablist">
          ${['Drop', 'Detect', 'Match', 'Verify'].map((t, i) => `<button type="button" role="tab" data-i="${i}" class="${i === 0 ? 'is-active' : ''}"><i></i>${t}</button>`).join('')}
        </div>
      </div>
    </div>
  </section>

  <section class="section alt" aria-labelledby="statsTitle">
    <div class="wrap">
      <div class="eyebrow reveal">Live from the registry</div>
      <h2 class="h2 reveal" id="statsTitle">Proofs that pile up while you ship.</h2>
      <p class="lede reveal" style="margin-top:12px">Every recorded match lands on BOT Chain’s ProofRegistry — the source hash and the exact settings, for anyone to re-check.</p>
      <div class="stats-grid">
        <div>
          <div class="stat reveal"><span class="stat-num" id="sProofs">0</span><span class="stat-label">Proofs recorded</span></div>
          <div class="stat reveal"><span class="stat-num" id="sToday">0</span><span class="stat-label">Matched today</span></div>
          <div class="stat reveal"><span class="stat-num" id="sTop">—</span><span class="stat-label">Most used compiler</span></div>
        </div>
        <div class="feed reveal">
          <div class="feed-head"><span>${icons.stamp} Registry</span><span class="small"><i class="live-dot"></i>live</span></div>
          <div class="feed-body" id="feed"><div class="feed-empty">Loading proofs…</div></div>
        </div>
      </div>
    </div>
  </section>

  <section class="section" aria-labelledby="diffTitle">
    <div class="wrap">
      <div class="eyebrow reveal">Verify buddy</div>
      <h2 class="h2 reveal" id="diffTitle">What makes Buddy different.</h2>
      <div class="diff-grid" style="margin-top:56px">
        ${[
          ['bytes', 'Reads the bytecode', 'Your deployed code carries the compiler version in its metadata. Buddy decodes it, so there’s no guessing from the pragma.', icons.bytes],
          ['browser', 'Compiles in your browser', 'The official solc runs in a Web Worker on your machine. No upload of private code needed to find a match.', icons.cpu],
          ['sliders', 'Finds the settings for you', 'EVM version × optimizer × runs, most likely first, with a live log of every attempt and a cancel button.', icons.sliders],
          ['stamp', 'Leaves a proof on BOT Chain', 'Record the match on the ProofRegistry and share a proof page anyone can re-check.', icons.stamp],
        ].map(([art, t, p, ic]) => `<div class="diff-card reveal"><div class="diff-icon">${ic}</div><div class="diff-art">${lineArt[art]}</div><h4>${t}</h4><p>${p}</p></div>`).join('')}
      </div>
    </div>
  </section>

  <section class="section alt" id="features" aria-labelledby="srcTitle">
    <div class="wrap">
      <div class="show">
        <div class="show-copy">
          <div class="eyebrow reveal">Bytecode match</div>
          <h2 class="h2 reveal" id="srcTitle">Source in. Match out.</h2>
          <p class="lede reveal">Buddy compiles your source and lines it up with what’s on chain, byte for byte — minus the parts that are allowed to differ.</p>
          <div class="acc reveal" data-single>
            ${acc('Metadata stripped', 'The last bytes of runtime code are a CBOR blob with the compiler version and an IPFS hash of your metadata. Buddy reads it, then strips it before comparing.', true)}
            ${acc('Immutables masked', 'Immutable values are written at deploy time. Buddy masks those byte ranges (striped butter) using the compiler’s immutableReferences.')}
            ${acc('Perfect match', 'If the metadata hashes match too, your source is identical byte for byte — comments included. Buddy calls that a perfect match.')}
          </div>
        </div>
        <div class="show-panel reveal" id="matchPanel">
          <div class="mock-split" id="mockSplit">
            <div class="file"><div class="file-tab">${icons.file}<b>SnackPoll.sol</b></div><pre id="snackCode">${SNACK.map(([k, t], i) => `<div class="code-line" data-l="${i}">${t ? `<span class="${k ? 'tok-' + k : ''}">${esc(t)}</span>` : ' '}</div>`).join('')}</pre></div>
            <div class="file"><div class="file-tab">${icons.bytes}<b>runtime</b> · 0x6080…0033</div><div class="hexgrid" id="hexgrid">${HEX.map(([h, k]) => `<span data-k="${k}">${h}</span>`).join('')}</div></div>
          </div>
          <div class="mock-legend"><span><i style="background:var(--emerald-soft);box-shadow:inset 0 0 0 1px var(--emerald)"></i>matches</span><span><i style="background:repeating-linear-gradient(-45deg,var(--butter-soft) 0 3px,var(--butter) 3px 5px)"></i>immutable (masked)</span><span><i style="background:var(--paper-2)"></i>metadata (stripped)</span></div>
        </div>
      </div>
    </div>
  </section>

  <section class="section" aria-labelledby="setTitle">
    <div class="wrap">
      <div class="show flip">
        <div class="show-copy">
          <div class="eyebrow reveal">Settings search</div>
          <h2 class="h2 reveal" id="setTitle">Every setting, found.</h2>
          <p class="lede reveal">Version from the metadata. EVM target from the opcodes. Then optimizer off, 200 and 1000 runs — most likely first, stopping at the first exact match.</p>
          <div class="acc reveal" data-single>
            ${acc('Most likely first', 'No PUSH0 in your bytecode? Buddy starts at paris. PUSH0 present? It starts at the compiler’s own default. Typical contracts match in a few seconds.', true)}
            ${acc('Live attempt log', 'Every attempt is listed with its time. Cancel any time — the compiler is cached, so retrying is instant.')}
            ${acc('Helpful misses', 'No match? Buddy tells you why it might be: a different source version, another OpenZeppelin release, a library, or via-IR — with a toggle to retry.')}
          </div>
        </div>
        <div class="show-panel reveal">
          <div class="mock-inspect">
            <div class="log">
              <div class="log-head"><span>attempt log</span><span>solc 0.8.24</span></div>
              <div class="log-body" id="logBody"></div>
            </div>
            <div class="inspector" id="inspector">
              ${[['Compiler', '<span class="chip chip-indigo">v0.8.24</span>'], ['EVM version', '<span class="chip" id="iEvm">—</span>'], ['Optimizer', '<span class="chip" id="iOpt">—</span>'], ['Runs', '<span class="mono" id="iRuns">—</span>'], ['License', '<span class="chip">MIT</span>'], ['Result', '<span class="chip" id="iRes">searching…</span>']].map(([k, v]) => `<div class="insp-row"><span>${k}</span>${v}</div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section alt" aria-labelledby="impTitle">
    <div class="wrap">
      <div class="section-head">
        <div class="eyebrow reveal">Flattener</div>
        <h2 class="h2 reveal" id="impTitle">Imports? Flattened.</h2>
        <p class="lede reveal">Drop your files or let Buddy fetch packages. One file comes out — dependency order, a single SPDX line, de-duplicated pragmas.</p>
      </div>
      <div class="cells reveal" id="cells">
        <div class="cell"><div class="cell-art">${lineArt.local}</div><div class="cell-copy"><h4>Local files</h4><p>Drop the whole folder. Relative imports like <code>./lib/Owned.sol</code> resolve against what you dropped.</p></div></div>
        <div class="cell"><div class="cell-art">${lineArt.npm}</div><div class="cell-copy"><h4>npm packages</h4><p><code>@openzeppelin/contracts</code> comes straight from jsDelivr, with a version picker for the exact release you used.</p></div></div>
        <div class="cell"><div class="cell-art">${lineArt.flat}</div><div class="cell-copy"><h4>One flat file</h4><p>Preview it with syntax highlighting, then Copy or Download — exactly what the explorer gets.</p></div></div>
      </div>
    </div>
  </section>

  <section class="section" id="compare" aria-labelledby="cmpTitle">
    <div class="wrap">
      <div class="section-head">
        <div class="eyebrow reveal">Compare</div>
        <h2 class="h2 reveal" id="cmpTitle">Manual verifying vs Verify Buddy.</h2>
        <p class="lede reveal">The same explorer, the same green checkmark — minus the afternoon of trial and error.</p>
      </div>
      <div class="compare-wrap reveal">
        <table class="compare" id="cmp">
          <thead><tr><th scope="col">Step</th><th scope="col">Manual</th><th scope="col">Verify Buddy</th></tr></thead>
          <tbody>${COMPARE.map(([s, m, b]) => `<tr><td>${s}</td><td class="manual"><span class="mark n">⏳</span>${m}</td><td class="buddy"><span class="mark y">${icons.check}</span>${b}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
  </section>

  <section class="section alt" id="faq" aria-labelledby="faqTitle">
    <div class="wrap">
      <div class="section-head">
        <div class="eyebrow reveal">FAQ</div>
        <h2 class="h2 reveal" id="faqTitle">Questions, answered.</h2>
      </div>
      <div class="acc faq reveal" data-single>${FAQ.map(([q, a], i) => acc(q, a, i === 0)).join('')}</div>
    </div>
  </section>

  <section class="closing" aria-labelledby="ctaTitle">
    <div class="wrap">
      <div class="closing-buddy reveal">${buddy('thumbs', { size: 120 })}</div>
      <h2 class="h2 reveal" id="ctaTitle">Your contract deserves a green checkmark.</h2>
      <p class="lede reveal">Paste an address. Drop a file. Buddy does the rest.</p>
      <div class="hero-ctas reveal"><a class="btn btn-primary btn-lg" href="app" data-link>Verify my contract ${chev()}</a></div>
    </div>
  </section>`;

  $$('.acc', el).forEach(accordion);
  const stopFns = [];
  loadStats(el);
  stopFns.push(attemptLoop(el));
  stopFns.push(heroRotator(el));
  animate(el);
  return () => stopFns.forEach((f) => f?.());
}

function acc(title, body, open = false) {
  return `<div class="acc-item${open ? ' open' : ''}"><button class="acc-btn" type="button" aria-expanded="${open}">${esc(title)}${icons.plus}</button><div class="acc-panel"${open ? ' style="height:auto"' : ''}><p>${esc(body)}</p></div></div>`;
}

// ------------------------------------------------------------------ the stage art (one SVG, animated by the scrubbed timeline)
function stageArt() {
  // two layouts from the same pieces: wide (file left, bytecode right) and phone (stacked)
  const M = matchMedia('(max-width: 640px)').matches;
  const lines = [
    [0, 'pragma solidity ^0.8.24;', 'k'], [1, '', ''], [2, 'contract SnackPoll {', 'k'], [3, '  string public name;', ''], [4, '  address immutable owner;', ''],
    [5, '  function vote(uint8 s)', ''], [6, '    external { … }', ''], [7, '}', 'k'],
  ];
  const chunks = Array.from({ length: 40 }, (_, i) => i);
  const matches = [[0, 2], [2, 9], [3, 14], [4, 21], [5, 27], [6, 30], [7, 35]]; // [line, chunk]
  const L = M
    ? { vb: '0 0 420 700', file: [45, 150], hexAt: (i) => [(i % 8) * 44 + 36, Math.floor(i / 8) * 30 + 486], hw: 38, chips: [36, 446], chipGap: [0, 104, 210], verified: [115, 534],
      wire: (sy, x, y) => `M375 ${sy} C 414 ${sy}, ${x + 19} ${y - 70}, ${x + 19} ${y}` }
    : { vb: '0 0 1016 560', file: [70, 186], hexAt: (i) => [(i % 8) * 48 + 618, Math.floor(i / 8) * 34 + 214], hw: 40, chips: [618, 164], chipGap: [0, 108, 222], verified: [618, 404],
      wire: (sy, x, y) => `M400 ${sy} C 500 ${sy}, 520 ${y + 12}, ${x} ${y + 12}` };
  const [fx, fy] = L.file;
  return `<svg viewBox="${L.vb}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <defs><linearGradient id="fadeR" x1="0" x2="1"><stop offset="0" stop-color="#10A36B" stop-opacity=".9"/><stop offset="1" stop-color="#10A36B" stop-opacity=".4"/></linearGradient></defs>
    <g id="stFile" transform="translate(${fx} ${fy})">
      <rect width="330" height="282" rx="10" fill="#1E1E1C" stroke="rgba(246,244,239,.12)"/>
      <path d="M0 34h330" stroke="rgba(246,244,239,.1)"/>
      <circle cx="16" cy="17" r="4" fill="rgba(246,244,239,.2)"/><circle cx="30" cy="17" r="4" fill="rgba(246,244,239,.2)"/>
      <text x="50" y="21" class="stage-chip">SnackPoll.sol</text>
      <g id="stImports">
        <text x="20" y="58" font-family="IBM Plex Mono, monospace" font-size="11" fill="rgba(246,244,239,.4)">import "@openzeppelin/…/Ownable.sol";</text>
      </g>
      ${lines.map(([i, t, k]) => `<text class="st-line" data-l="${i}" x="20" y="${84 + i * 24}" font-family="IBM Plex Mono, monospace" font-size="12.5" fill="${k === 'k' ? '#9AA5FF' : 'rgba(246,244,239,.86)'}">${esc(t)}</text>`).join('')}
    </g>
    <g id="stChips" transform="translate(${L.chips[0]} ${L.chips[1]})">
      ${[['solc 0.8.24', L.chipGap[0]], ['3,912 bytes', L.chipGap[1]], ['PUSH0: no', L.chipGap[2]]].map(([t, x]) => `<g class="st-chip" transform="translate(${x} 0)"><rect width="${t.length * 8 + 22}" height="28" rx="6" fill="rgba(75,91,219,.22)" stroke="rgba(154,165,255,.5)"/><text x="11" y="18" font-family="IBM Plex Mono, monospace" font-size="12" fill="#C9CEFF">${t}</text></g>`).join('')}
    </g>
    <g id="stHex">
      ${chunks.map((i) => { const [x, y] = L.hexAt(i); const im = i === 18 || i === 19; const meta = i >= 37; return `<rect class="st-hex${im ? ' im' : ''}${meta ? ' meta' : ''}" data-i="${i}" x="${x}" y="${y}" width="${L.hw}" height="24" rx="4" fill="${im ? 'rgba(245,215,110,.25)' : meta ? 'rgba(246,244,239,.04)' : 'rgba(246,244,239,.07)'}" stroke="${im ? 'rgba(245,215,110,.6)' : 'rgba(246,244,239,.14)'}"/>`; }).join('')}
    </g>
    <g id="stWires" fill="none" stroke="url(#fadeR)" stroke-width="1.6">
      ${matches.map(([l, c]) => { const [x, y] = L.hexAt(c); const sy = fy + 80 + l * 24; return `<path class="st-wire" data-c="${c}" d="${L.wire(sy, x, y)}"/>`; }).join('')}
    </g>
    <g transform="translate(${L.verified[0]} ${L.verified[1]})"><g id="stVerified" opacity="0">
      <rect width="190" height="40" rx="20" fill="#10A36B"/>
      <path d="M22 20l6 6 12-13" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <text x="50" y="26" font-family="Zalando Sans, sans-serif" font-weight="700" font-size="16" fill="#fff">Verified on scan</text>
    </g></g>
  </svg>`;
}

// ------------------------------------------------------------------ data: counters + registry feed
async function loadStats(el) {
  const feed = $('#feed', el);
  try {
    const st = await registry.stats();
    const go = () => {
      countTo($('#sProofs', el), st.proofs);
      countTo($('#sToday', el), st.today);
      $('#sTop', el).textContent = st.topCompiler || '—';
    };
    if (hasGsap() && window.ScrollTrigger && !reduced()) ScrollTrigger.create({ trigger: '#sProofs', start: 'top 85%', once: true, onEnter: go });
    else go();
    if (!st.recent.length) {
      feed.innerHTML = `<div class="feed-empty">No proofs yet${NET.registry ? '' : ' (preview mode — proofs you record are saved in this browser)'}. <a href="app" data-link style="text-decoration:underline">Be the first →</a></div>`;
      return;
    }
    feed.innerHTML = st.recent.map((p) => `<a class="feed-row" href="v/${p.target}" data-link><span class="pip${p.perfect ? '' : ''}"></span><span class="who mono">${esc(short(p.target))}</span><span class="what">${esc(String(p.compiler).split('+')[0])} · ${esc(p.evmVersion)} · ${p.optimizer ? p.runs + ' runs' : 'optimizer off'}${p.perfect ? ' · perfect' : ''}</span><span class="when">${ago(p.at)}</span></a>`).join('');
    if (hasGsap() && !reduced()) gsap.from($$('.feed-row', feed), { y: -16, opacity: 0, stagger: .08, duration: .5, ease: 'power2.out', scrollTrigger: { trigger: feed, start: 'top 85%' } });
  } catch {
    feed.innerHTML = `<div class="feed-empty">Couldn’t reach the registry right now.</div>`;
  }
}

// ------------------------------------------------------------------ section 6: looping attempt log + inspector
function attemptLoop(el) {
  const body = $('#logBody', el);
  let i = 0, timer = null, alive = true;
  const step = () => {
    if (!alive || !body.isConnected) return;
    if (i === 0) { body.innerHTML = ''; setInsp('—', '—', '—', 'searching…', ''); }
    const [label, ok, t] = ATTEMPTS[i];
    const row = document.createElement('div');
    row.className = 'log-row' + (ok ? ' ok-row' : '');
    row.innerHTML = `<span>${ok ? '✅' : '❌'}</span><span>${label}</span><span class="t">${t}</span>`;
    body.append(row);
    const [evm, opt] = label.split(' · ');
    setInsp(evm, opt.includes('off') ? 'off' : 'on', opt.includes('off') ? '—' : opt.replace(' runs', ''), ok ? 'exact match ✓' : 'no match', ok ? 'ok' : '');
    if (hasGsap() && !reduced()) gsap.from(row, { y: 14, opacity: 0, duration: .4, ease: 'power2.out' });
    i = (i + 1) % ATTEMPTS.length;
    timer = setTimeout(step, ok ? 3200 : 900);
  };
  const setInsp = (evm, opt, runs, res, cls) => {
    $('#iEvm', el).textContent = evm; $('#iOpt', el).textContent = opt; $('#iRuns', el).textContent = runs;
    const r = $('#iRes', el); r.textContent = res; r.className = 'chip' + (cls === 'ok' ? ' chip-emerald' : res === 'no match' ? ' chip-ember' : '');
  };
  if (reduced()) {
    body.innerHTML = ATTEMPTS.map(([l, ok, t]) => `<div class="log-row${ok ? ' ok-row' : ''}"><span>${ok ? '✅' : '❌'}</span><span>${l}</span><span class="t">${t}</span></div>`).join('');
    setInsp('paris', 'on', '200', 'exact match ✓', 'ok');
    return () => {};
  }
  if (window.IntersectionObserver) {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !timer) step(); }, { threshold: .3 });
    io.observe(body);
    return () => { alive = false; clearTimeout(timer); io.disconnect(); };
  }
  step();
  return () => { alive = false; clearTimeout(timer); };
}

// ------------------------------------------------------------------ hero: rotating phrase
function heroRotator(el) {
  const words = ['completely visually.', 'in minutes, not hours.', 'without guessing.', 'right in your browser.'];
  const w = $('#heroWord', el);
  if (!hasGsap() || reduced()) return () => {};
  let i = 0, alive = true;
  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0 });
  const cycle = () => {
    const next = words[(i = (i + 1) % words.length)];
    gsap.timeline()
      .to(w, { yPercent: -40, opacity: 0, duration: .35, ease: 'power2.in' })
      .add(() => { w.textContent = next; })
      .fromTo(w, { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .45, ease: 'power3.out' });
  };
  tl.call(() => alive && cycle(), null, 3.2);
  return () => { alive = false; tl.kill(); };
}

// ------------------------------------------------------------------ GSAP choreography
function animate(el) {
  const g = hasGsap() && window.ScrollTrigger;
  const stage = $('#stage', el);
  const panels = $$('.stage-panel', stage);
  const tabs = $$('.stage-progress button', stage);
  const buddyBox = $('#stageBuddy', el);
  let pose = 'read';
  const setPose = (p) => { if (p !== pose) { pose = p; buddyBox.innerHTML = buddy(p, { size: 110 }); } };
  const setPhase = (k) => {
    panels.forEach((p, i) => p.classList.toggle('is-active', i === k));
    tabs.forEach((t, i) => { t.classList.toggle('is-active', i === k); t.classList.toggle('is-passed', i < k); });
    setPose(['read', 'sweat', 'sweat', 'thumbs'][k]);
  };

  if (!g || reduced()) {
    // static: final state, tabs switch the copy
    setPhase(3);
    $$('.st-hex:not(.im):not(.meta)', stage).forEach((r) => r.setAttribute('fill', 'rgba(16,163,107,.55)'));
    $('#stVerified', stage).setAttribute('opacity', '1');
    tabs.forEach((t) => t.addEventListener('click', () => setPhase(Number(t.dataset.i))));
    staticSection5(el);
    return;
  }

  // hero intro — SplitText words rise in
  const h1 = $('#heroTitle', el);
  if (window.SplitText) {
    const split = new SplitText($('.hero-lead', h1), { type: 'chars', mask: 'chars' });
    gsap.from(split.chars, { yPercent: 110, duration: .8, ease: 'power4.out', stagger: .025 });
    gsap.from('#heroWord', { yPercent: 110, opacity: 0, duration: .8, delay: .35, ease: 'power4.out' });
  }
  gsap.from($$('.hero .reveal', el), { y: 18, opacity: 0, duration: .7, ease: 'power3.out', stagger: .1, delay: .45 });
  gsap.from(stage, { y: 60, opacity: 0, duration: 1, ease: 'power3.out', delay: .6 });

  // stage: pinned, scrubbed through Drop · Detect · Match · Verify
  const S = stage;
  const wires = $$('.st-wire', S);
  const hex = $$('.st-hex', S);
  const lines = $$('.st-line', S);
  gsap.set($$('.st-chip', S), { opacity: 0, y: 10 });
  gsap.set(hex, { opacity: 0, scale: .6, transformOrigin: '50% 50%' });
  gsap.set(lines, { opacity: .25 });
  if (window.DrawSVGPlugin) gsap.set(wires, { drawSVG: '0%' }); else gsap.set(wires, { opacity: 0 });
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '#how', start: 'top top+=72', end: '+=2400', pin: true, scrub: .6, anticipatePin: 1,
      onUpdate: (st) => setPhase(Math.min(3, Math.floor(st.progress * 4 * 0.999))),
    },
  });
  // Drop: file slides in, the import line collapses
  tl.to(lines, { opacity: 1, stagger: .08, duration: .4 })
    .to('#stImports', { opacity: 0, y: -8, duration: .5 }, '+=.2')
    // Detect: bytecode appears, chips pop
    .to(hex, { opacity: 1, scale: 1, stagger: { each: .02, from: 'start' }, duration: .4 })
    .to($$('.st-chip', S), { opacity: 1, y: 0, stagger: .2, duration: .4 }, '-=.4')
    // Match: wires draw one by one, chunks go green
    .add('match');
  wires.forEach((w, k) => {
    const c = Number(w.dataset.c);
    tl.to(w, window.DrawSVGPlugin ? { drawSVG: '100%', duration: .5 } : { opacity: 1, duration: .5 }, `match+=${k * .45}`)
      .to(hex[c], { fill: 'rgba(16,163,107,.6)', duration: .2 }, `match+=${k * .45 + .4}`)
      .to(lines[[0, 2, 3, 4, 5, 6, 7][k]] || lines[0], { fill: '#7CE0B2', duration: .2 }, `match+=${k * .45 + .4}`);
  });
  // Verify: the whole strip turns green, badge appears
  tl.to($$('.st-hex:not(.im):not(.meta)', S), { fill: 'rgba(16,163,107,.55)', stagger: .01, duration: .3 })
    .to(wires, { opacity: .35, duration: .3 }, '<')
    .to('#stVerified', { opacity: 1, duration: .4 })
    .from('#stVerified', { y: 14, duration: .4 }, '<')
    .to({}, { duration: .6 });
  tabs.forEach((t) => t.addEventListener('click', () => {
    const st = tl.scrollTrigger;
    const target = st.start + (st.end - st.start) * ((Number(t.dataset.i) + .5) / 4);
    window.scrollTo({ top: target, behavior: 'smooth' });
  }));

  // generic reveals (outside hero)
  $$('.section .reveal, .closing .reveal', el).forEach((r) => {
    gsap.from(r, { y: 24, opacity: 0, duration: .8, ease: 'power3.out', scrollTrigger: { trigger: r, start: 'top 88%' } });
  });

  // section 4: line-art draws on
  if (window.DrawSVGPlugin) {
    $$('.diff-art .line-art, .cell-art .line-art', el).forEach((svg) => {
      const parts = $$('path, rect, circle', svg);
      gsap.from(parts, { drawSVG: '0%', duration: 1.1, ease: 'power2.inOut', stagger: .04, scrollTrigger: { trigger: svg, start: 'top 85%' } });
    });
  }

  // section 5: source lines light up and bytecode chunks shade green
  const codeLines = $$('#snackCode .code-line', el);
  const spans = $$('#hexgrid span', el);
  const t5 = gsap.timeline({ scrollTrigger: { trigger: '#matchPanel', start: 'top 70%' } });
  const pairs = [[3, 0], [4, 5], [5, 24], [6, 12], [8, 9], [11, 29], [12, 35]];
  pairs.forEach(([l, s], k) => {
    t5.add(() => { codeLines.forEach((c) => c.classList.remove('hl')); codeLines[l]?.classList.add('hl'); }, k * .35);
    t5.add(() => {
      spans.slice(s, s + 5).forEach((sp) => { const kk = sp.dataset.k; if (kk) sp.className = kk; });
    }, k * .35 + .15);
  });
  t5.add(() => { spans.forEach((sp) => { if (sp.dataset.k) sp.className = sp.dataset.k; }); codeLines.forEach((c) => c.classList.remove('hl')); }, pairs.length * .35 + .2);

  // section 7: the three stacked files collapse into one
  gsap.timeline({ scrollTrigger: { trigger: '#cells', start: 'top 70%' }, repeat: -1, repeatDelay: 1.6 })
    .to($$('#cells .fs1', el), { y: 40, opacity: .2, duration: .6, ease: 'power2.in' })
    .to($$('#cells .fs3', el), { y: -40, opacity: .2, duration: .6, ease: 'power2.in' }, '<')
    .to($$('#cells .fs1, #cells .fs3', el), { y: 0, opacity: 1, duration: .6, ease: 'power2.out', delay: 1.2 });

  // section 8: the Buddy column checks off; manual stays ⏳
  const rows = $$('#cmp tbody tr', el);
  gsap.set($$('#cmp .mark.y', el), { scale: 0 });
  gsap.set($$('#cmp .mark.n', el), { opacity: 0 });
  const t8 = gsap.timeline({ scrollTrigger: { trigger: '#cmp', start: 'top 75%' } });
  rows.forEach((r, k) => {
    t8.to($('.mark.y', r), { scale: 1, duration: .35, ease: 'back.out(3)' }, k * .25)
      .to($('.mark.n', r), { opacity: 1, duration: 1.2, ease: 'power1.in' }, k * .5 + .4);
  });
}
function staticSection5(el) {
  $$('#hexgrid span', el).forEach((sp) => { if (sp.dataset.k) sp.className = sp.dataset.k; });
}
void CONFIG;
