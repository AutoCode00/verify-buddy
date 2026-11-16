// Everything that talks to BOT Chain, the explorer (Blockscout API), the ProofRegistry and IPFS.
// Reads use plain JSON-RPC / fetch (no wallet needed). Writes go through MetaMask.
// Preview mode (no registry address configured): proofs are stored in this browser; everything else is live.
import { CONFIG } from './config.js';

const params = new URLSearchParams(location.search);
const SK = CONFIG.storageKey;
export const NETS = Object.fromEntries(Object.entries(CONFIG.networks).map(([k, v]) => [k, { ...v, key: k }]));
export const NET = NETS[params.get('net') === 'testnet' ? 'testnet' : 'mainnet']; // where the registry lives

// localhost only: deploy.html remembers the address it just deployed
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname) && !NET.registry) {
  try { NET.registry = localStorage.getItem(`${SK}.registry.${NET.chainId}`) || ''; } catch { /* ignore */ }
}
export const MODE = NET.registry && params.get('preview') === null ? 'live' : 'preview';
export const netByChainId = (id) => Object.values(NETS).find((n) => n.chainId === Number(id)) || NETS.mainnet;
export const explorerAddress = (a, net = NET) => `${net.explorer}/address/${a}`;
export const explorerTx = (h, net = NET) => `${net.explorer}/tx/${h}`;
export const explorerVerifyForm = (a, net = NET) => `${net.explorer}/address/${a}/contract-verification`;
export const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '');
export const isAddress = (a) => /^0x[0-9a-fA-F]{40}$/.test(String(a || '').trim());
export const sameAddr = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

const listeners = new Set();
export const onChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const emit = (what) => [...listeners].forEach((fn) => fn(what));

// ------------------------------------------------------------------ ethers (lazy)
let ethersReady;
export function loadEthers() {
  if (window.ethers) return Promise.resolve(window.ethers);
  ethersReady ||= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/ethers/6.13.5/ethers.umd.min.js';
    s.crossOrigin = 'anonymous';
    s.onload = () => resolve(window.ethers);
    s.onerror = () => { ethersReady = null; reject(new Error('Could not load ethers.js')); };
    document.head.append(s);
  });
  return ethersReady;
}

// ------------------------------------------------------------------ JSON-RPC
let rpcId = 1;
export async function rpc(net, method, params = []) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(net.rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params }), signal: ctl.signal });
    const out = await res.json();
    if (out.error) throw new Error(out.error.message || 'RPC error');
    return out.result;
  } finally { clearTimeout(t); }
}

/** Which network has code at this address? → { net, code } (net null when neither has code). */
export async function detectNetwork(address) {
  const order = [NETS.mainnet, NETS.testnet];
  const codes = await Promise.all(order.map((n) => rpc(n, 'eth_getCode', [address, 'latest']).catch(() => null)));
  if (codes.every((c) => c === null)) throw new Error('Could not reach BOT Chain — check your connection and try again.');
  const i = codes.findIndex((c) => c && c !== '0x');
  return i < 0 ? { net: null, code: '0x' } : { net: order[i], code: codes[i] };
}
export const getTx = (net, hash) => rpc(net, 'eth_getTransactionByHash', [hash]);

// ------------------------------------------------------------------ explorer (Blockscout API v2, CORS open)
async function getJson(url, init) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal });
    const text = await r.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = { message: text.slice(0, 200) }; }
    if (!r.ok) throw Object.assign(new Error(body?.message || `Explorer error ${r.status}`), { status: r.status, body });
    return body;
  } finally { clearTimeout(t); }
}

/**
 * What the explorer knows: { reachable, verified, name, creationTx, creator, creationCode, verifiedName, compiler }.
 * Never throws — `reachable: false` switches the app to guide mode.
 */
export async function explorerInfo(net, address) {
  const out = { reachable: false, verified: false, name: '', creationTx: '', creator: '', creationCode: '', verifiedName: '', compiler: '' };
  try {
    const a = await getJson(`${net.explorer}/api/v2/addresses/${address}`);
    out.reachable = true;
    out.verified = !!a.is_verified;
    out.name = a.name || '';
    out.creationTx = a.creation_transaction_hash || a.creation_tx_hash || '';
    out.creator = a.creator_address_hash || '';
  } catch { return out; }
  try {
    const s = await getJson(`${net.explorer}/api/v2/smart-contracts/${address}`);
    out.creationCode = s.creation_bytecode || '';
    out.verified ||= !!s.is_verified || !!s.is_fully_verified || !!s.is_partially_verified;
    out.verifiedName = s.name || '';
    out.compiler = s.compiler_version || '';
  } catch { /* fine — the creation tx is the fallback */ }
  return out;
}

/** Submits flattened source to the explorer (one-click verify). */
export async function submitFlattened(net, address, p) {
  return getJson(`${net.explorer}/api/v2/smart-contracts/${address}/verification/via/flattened-code`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      compiler_version: p.compiler,
      source_code: p.source,
      is_optimization_enabled: p.optimizer,
      optimization_runs: p.runs,
      contract_name: p.contractName,
      evm_version: p.evmVersion,
      autodetect_constructor_args: !p.constructorArgs,
      constructor_args: p.constructorArgs || '',
      license_type: p.license,
      libraries: {},
    }),
  });
}
/** via-IR builds go through standard JSON input (the flattened endpoint has no via-IR switch). */
export async function submitStandardInput(net, address, p) {
  const fd = new FormData();
  fd.append('compiler_version', p.compiler);
  fd.append('contract_name', `${p.fileName}:${p.contractName}`);
  fd.append('autodetect_constructor_args', String(!p.constructorArgs));
  fd.append('constructor_args', p.constructorArgs || '');
  fd.append('license_type', p.license);
  fd.append('files[0]', new Blob([JSON.stringify(p.input)], { type: 'application/json' }), 'input.json');
  return getJson(`${net.explorer}/api/v2/smart-contracts/${address}/verification/via/standard-input`, { method: 'POST', body: fd });
}
/** Polls until the explorer says verified (or gives up). onTick(n) is called each round. */
export async function waitVerified(net, address, { tries = 30, every = 3000, onTick, signal } = {}) {
  for (let n = 1; n <= tries; n++) {
    if (signal?.aborted) return false;
    await new Promise((r) => setTimeout(r, every));
    onTick?.(n);
    try {
      const s = await getJson(`${net.explorer}/api/v2/smart-contracts/${address}`);
      if (s.is_verified || s.is_fully_verified || s.is_partially_verified) return true;
    } catch { /* keep polling */ }
  }
  return false;
}

// ------------------------------------------------------------------ npm via jsDelivr
const pkgVersions = new Map();
export async function npmVersions(pkg) {
  if (!pkgVersions.has(pkg)) {
    pkgVersions.set(pkg, getJson(`https://data.jsdelivr.com/v1/packages/npm/${pkg}`).then((j) => (j.versions || []).map((v) => v.version).filter((v) => !/-/.test(v))).catch(() => []));
  }
  return pkgVersions.get(pkg);
}
export async function npmFile(pkg, version, path) {
  const r = await fetch(`https://cdn.jsdelivr.net/npm/${pkg}@${version}/${path}`);
  if (!r.ok) return null;
  return r.text();
}

// ------------------------------------------------------------------ IPFS (shared Worker)
export async function uploadSource(text, name) {
  if (!CONFIG.worker) return '';
  const fd = new FormData();
  fd.append('file', new Blob([text], { type: 'text/plain' }), name);
  const r = await fetch(`${CONFIG.worker.replace(/\/$/, '')}/upload`, { method: 'POST', body: fd });
  if (!r.ok) throw new Error('IPFS upload failed');
  const j = await r.json();
  return j.cid || j.IpfsHash || j.Hash || '';
}
export async function fetchCid(cid) {
  const r = await fetch(CONFIG.ipfsGateway + cid);
  if (!r.ok) throw new Error('Could not fetch the source from IPFS');
  return r.text();
}

// ------------------------------------------------------------------ wallet
export const wallet = { account: '', chainOk: true, hasWallet: typeof window.ethereum !== 'undefined' };
export class ChainError extends Error { constructor(code, message) { super(message); this.code = code; } }
const MESSAGES = {
  NoCode: 'That address has no contract code on this network.',
  EmptySource: 'The source hash is empty.',
  BadCompiler: 'Compiler version is missing or too long.',
  BadEvmVersion: 'EVM version is missing or too long.',
  BadCid: 'IPFS CID is too long.',
  rejected: 'Cancelled in MetaMask — nothing was sent. You can try again.',
  noWallet: 'Install MetaMask to record a proof. Matching and the explorer guide work without it.',
  wrongNetwork: 'Switch to BOT Chain to continue.',
  failed: 'The transaction failed — try again.',
};
const fail = (code, extra) => { throw new ChainError(code, MESSAGES[code] || extra || 'Something went wrong.'); };
const hex = (n) => '0x' + Number(n).toString(16);

async function refreshChain() {
  if (!window.ethereum) return;
  const id = await ethereum.request({ method: 'eth_chainId' });
  wallet.chainOk = parseInt(id, 16) === NET.chainId;
}
export async function connect() {
  if (!window.ethereum) fail('noWallet');
  let accounts;
  try { accounts = await ethereum.request({ method: 'eth_requestAccounts' }); } catch (e) { if (e.code === 4001) fail('rejected'); throw e; }
  wallet.account = accounts[0] || '';
  await refreshChain();
  if (!wallet.chainOk) { try { await switchNetwork(); } catch { /* nav shows "Switch to BOT Chain" */ } }
  emit('wallet');
  return wallet.account;
}
export async function switchNetwork() {
  const chainId = hex(NET.chainId);
  try {
    await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId }] });
  } catch (e) {
    const unknown = e.code === 4902 || e?.data?.originalError?.code === 4902 || /unrecognized chain/i.test(e.message || '');
    if (e.code === 4001) fail('rejected');
    if (!unknown) fail('wrongNetwork');
    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{ chainId, chainName: NET.name, nativeCurrency: { name: 'BOT', symbol: 'BOT', decimals: 18 }, rpcUrls: [NET.rpc], blockExplorerUrls: [NET.explorer] }],
    });
  }
  await refreshChain();
  emit('wallet');
}
export async function restoreWallet() {
  if (!window.ethereum) return;
  try {
    const accounts = await ethereum.request({ method: 'eth_accounts' });
    wallet.account = accounts[0] || '';
    await refreshChain();
  } catch { /* ignore */ }
  ethereum.on?.('accountsChanged', (a) => { wallet.account = a[0] || ''; emit('wallet'); });
  ethereum.on?.('chainChanged', async () => { await refreshChain(); emit('wallet'); });
  emit('wallet');
}
async function signer() {
  if (!window.ethereum) fail('noWallet');
  const { BrowserProvider } = await loadEthers();
  if (!wallet.account) await connect();
  if (!wallet.chainOk) { await switchNetwork(); if (!wallet.chainOk) fail('wrongNetwork'); }
  return new BrowserProvider(window.ethereum).getSigner();
}

// ------------------------------------------------------------------ ProofRegistry
const PROOF = 'tuple(address target,address recorder,bytes32 sourceHash,string compiler,string evmVersion,uint32 runs,bool optimizer,bool perfect,string cid,uint64 at)';
export const REGISTRY_ABI = [
  'function record(address,bytes32,string,string,bool,uint32,bool,string) returns (uint256)',
  'function total() view returns (uint256)',
  'function totalTargets() view returns (uint256)',
  `function latestFor(address) view returns (bool exists, ${PROOF} proof)`,
  `function proofsOf(address) view returns (${PROOF}[])`,
  `function getProofs(uint256,uint256) view returns (${PROOF}[])`,
  'function getTargets(uint256,uint256) view returns (address[])',
  'event ProofRecorded(address indexed target, address indexed recorder, bool perfect)',
  'error NoCode()', 'error EmptySource()', 'error BadCompiler()', 'error BadEvmVersion()', 'error BadCid()',
];
// read by position — ethers Result has a built-in .at() that shadows a field called `at`
const decodeProof = (p) => ({ target: p[0], recorder: p[1], sourceHash: p[2], compiler: p[3], evmVersion: p[4], runs: Number(p[5]), optimizer: !!p[6], perfect: !!p[7], cid: p[8], at: Number(p[9]) });

let reader;
async function readRegistry() {
  if (reader) return reader;
  const { JsonRpcProvider, Contract } = await loadEthers();
  reader = new Contract(NET.registry, REGISTRY_ABI, new JsonRpcProvider(NET.rpc, NET.chainId, { staticNetwork: true }));
  return reader;
}
function liveError(e, iface) {
  if (e instanceof ChainError) return e;
  if (e.code === 'ACTION_REJECTED' || e.code === 4001 || e.info?.error?.code === 4001) return new ChainError('rejected', MESSAGES.rejected);
  const name = e.revert?.name || (() => { try { return iface?.parseError(e.data)?.name; } catch { return null; } })();
  if (name && MESSAGES[name]) return new ChainError(name, MESSAGES[name]);
  return new ChainError('failed', e.shortMessage || e.message || MESSAGES.failed);
}

const live = {
  async latestFor(t) { const [exists, p] = await (await readRegistry()).latestFor(t); return exists ? decodeProof(p) : null; },
  async proofsOf(t) { return [...(await (await readRegistry()).proofsOf(t))].map(decodeProof); },
  async all() {
    const c = await readRegistry(); const out = [];
    for (let from = 0; ; from += 100) {
      const page = await c.getProofs(from, 100);
      out.push(...[...page].map(decodeProof));
      if (page.length < 100) return out;
    }
  },
  async record(args, onSent) {
    const s = await signer();
    const c = new (window.ethers.Contract)(NET.registry, REGISTRY_ABI, s);
    try {
      await c.record.estimateGas(...args); // surfaces custom errors before MetaMask opens
      const tx = await c.record(...args);
      onSent?.(tx.hash);
      const receipt = await tx.wait();
      if (receipt.status !== 1) fail('failed');
      return { hash: tx.hash };
    } catch (e) { throw liveError(e, c.interface); }
  },
};

// preview: same API, stored in this browser
const PKEY = `${SK}.preview.${NET.key}.v1`;
const pload = () => { try { return JSON.parse(localStorage.getItem(PKEY) || '{"proofs":[]}'); } catch { return { proofs: [] }; } };
const psave = (s) => { try { localStorage.setItem(PKEY, JSON.stringify(s)); } catch { /* ignore */ } };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const fakeHash = () => '0x' + [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
const preview = {
  async latestFor(t) { const l = pload().proofs.filter((p) => sameAddr(p.target, t)); return l[l.length - 1] || null; },
  async proofsOf(t) { return pload().proofs.filter((p) => sameAddr(p.target, t)); },
  async all() { return pload().proofs; },
  async record(args, onSent) {
    const [target, sourceHash, compiler, evmVersion, optimizer, runs, perfect, cid] = args;
    const code = await rpc(NET, 'eth_getCode', [target, 'latest']).catch(() => '0x');
    if (!code || code === '0x') fail('NoCode');
    await pause(500); const hash = fakeHash(); onSent?.(hash); await pause(700);
    const s = pload();
    s.proofs.push({ target, recorder: wallet.account || '0x0000000000000000000000000000000000000000', sourceHash, compiler, evmVersion, runs: optimizer ? Number(runs) : 0, optimizer: !!optimizer, perfect: !!perfect, cid, at: Math.floor(Date.now() / 1000), tx: hash });
    psave(s);
    return { hash };
  },
};
const R = () => (MODE === 'live' ? live : preview);

export const registry = {
  latestFor: (t) => R().latestFor(t),
  proofsOf: (t) => R().proofsOf(t),
  all: () => R().all(),
  async record(p, onSent) {
    const args = [p.target, p.sourceHash, p.compiler, p.evmVersion, !!p.optimizer, Number(p.runs) || 0, !!p.perfect, p.cid || ''];
    const r = await R().record(args, onSent);
    emit('proofs');
    return r;
  },
  /** Counters for the home page + footer: { proofs, contracts, today, topCompiler, recent: [] } */
  async stats() {
    const all = await R().all();
    const dayAgo = Date.now() / 1000 - 86400;
    const counts = {};
    for (const p of all) { const v = String(p.compiler).replace(/^v/, '').split('+')[0]; counts[v] = (counts[v] || 0) + 1; }
    const topCompiler = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    return {
      proofs: all.length,
      contracts: new Set(all.map((p) => p.target.toLowerCase())).size,
      today: all.filter((p) => p.at >= dayAgo).length,
      topCompiler,
      recent: all.slice(-8).reverse(),
    };
  },
};

// ------------------------------------------------------------------ source copies kept in this browser (for re-checks without IPFS)
const SKEY = `${SK}.sources.v1`;
export const localSource = {
  get(hash) { try { return JSON.parse(localStorage.getItem(SKEY) || '{}')[hash] || null; } catch { return null; } },
  set(hash, text) {
    try {
      const all = JSON.parse(localStorage.getItem(SKEY) || '{}');
      all[hash] = text;
      const keys = Object.keys(all);
      while (keys.length > 20) delete all[keys.shift()];
      localStorage.setItem(SKEY, JSON.stringify(all));
    } catch { /* quota */ }
  },
};
