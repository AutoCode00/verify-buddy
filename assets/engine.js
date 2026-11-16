// Verify Buddy's matching engine — pure functions, no DOM, so the same file runs in the browser and in Node tests.
//   • readBytecode(): CBOR metadata tail → solc version + IPFS hash, PUSH0 / MCOPY detection, size
//   • compareRuntime(): strip metadata, mask immutables (and embedded child metadata) → match / perfect match
//   • flatten(): dependency-ordered single file, one SPDX line, de-duplicated pragmas
//   • attemptPlan(): the order Buddy tries compiler settings in

// ------------------------------------------------------------------ hex helpers
export const strip0x = (h) => String(h || '').trim().replace(/^0x/i, '').toLowerCase();
export const hexToBytes = (h) => {
  const s = strip0x(h);
  const out = new Uint8Array(s.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
  return out;
};
export const bytesToHex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

// ------------------------------------------------------------------ tiny CBOR decoder (maps, text, bytes, uints, bools)
export function decodeCbor(bytes) {
  let i = 0;
  const len = (info) => {
    if (info < 24) return info;
    if (info === 24) return bytes[i++];
    if (info === 25) { const v = (bytes[i] << 8) | bytes[i + 1]; i += 2; return v; }
    if (info === 26) { const v = ((bytes[i] << 24) >>> 0) + ((bytes[i + 1] << 16) | (bytes[i + 2] << 8) | bytes[i + 3]); i += 4; return v; }
    throw new Error('CBOR: unsupported length');
  };
  const item = () => {
    if (i >= bytes.length) throw new Error('CBOR: truncated');
    const b = bytes[i++];
    const major = b >> 5, info = b & 31;
    switch (major) {
      case 0: return len(info);
      case 2: { const n = len(info); const v = bytes.slice(i, i + n); i += n; if (v.length !== n) throw new Error('CBOR: truncated'); return v; }
      case 3: { const n = len(info); const v = new TextDecoder().decode(bytes.slice(i, i + n)); i += n; return v; }
      case 4: { const n = len(info); return Array.from({ length: n }, item); }
      case 5: { const n = len(info); const o = {}; for (let k = 0; k < n; k++) { const key = item(); o[key] = item(); } return o; }
      case 7: if (info === 20) return false; if (info === 21) return true; if (info === 22) return null;
      // falls through
      default: throw new Error('CBOR: unsupported type');
    }
  };
  const v = item();
  if (i !== bytes.length) throw new Error('CBOR: trailing bytes');
  return v;
}

// ------------------------------------------------------------------ base58 (for IPFS CIDv0 display)
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function base58(bytes) {
  let n = 0n;
  for (const b of bytes) n = n * 256n + BigInt(b);
  let s = '';
  while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b !== 0) break; s = '1' + s; }
  return s;
}

/**
 * Reads the CBOR metadata at the end of runtime bytecode.
 * Returns { length (bytes incl. the 2-byte size), solc: '0.8.24' | null, ipfs: hex | null, cid, bzzr, experimental } or null.
 */
export function readMetadata(code) {
  const b = hexToBytes(code);
  if (b.length < 4) return null;
  const n = (b[b.length - 2] << 8) | b[b.length - 1];
  if (n < 2 || n + 2 > b.length) return null;
  const raw = b.slice(b.length - 2 - n, b.length - 2);
  if ((raw[0] & 0xe0) !== 0xa0) return null; // must be a CBOR map
  let m;
  try { m = decodeCbor(raw); } catch { return null; }
  if (!m || typeof m !== 'object') return null;
  const solc = m.solc instanceof Uint8Array && m.solc.length === 3 ? `${m.solc[0]}.${m.solc[1]}.${m.solc[2]}` : typeof m.solc === 'string' ? m.solc : null;
  const ipfs = m.ipfs instanceof Uint8Array ? bytesToHex(m.ipfs) : null;
  const bzzr = m.bzzr1 instanceof Uint8Array ? bytesToHex(m.bzzr1) : m.bzzr0 instanceof Uint8Array ? bytesToHex(m.bzzr0) : null;
  return { length: n + 2, solc, ipfs, cid: ipfs ? base58(hexToBytes(ipfs)) : null, bzzr, experimental: !!m.experimental, keys: Object.keys(m) };
}

/** Walks opcodes (skipping PUSH data) up to the metadata tail. */
export function scanOpcodes(code, metaLen = 0) {
  const b = hexToBytes(code);
  const end = b.length - metaLen;
  const seen = new Set();
  for (let i = 0; i < end; i++) {
    const op = b[i];
    seen.add(op);
    if (op >= 0x60 && op <= 0x7f) i += op - 0x5f;
  }
  return { push0: seen.has(0x5f), mcopy: seen.has(0x5e), tstore: seen.has(0x5d) || seen.has(0x5c), clz: seen.has(0x1e) };
}

/** Everything Buddy says about deployed runtime code in Step 1. */
export function readBytecode(code) {
  const hex = strip0x(code);
  const meta = readMetadata(hex);
  const ops = scanOpcodes(hex, meta ? meta.length : 0);
  return { size: hex.length / 2, meta, ...ops };
}

// ------------------------------------------------------------------ comparison
const META_RE = /a2646970667358221220[0-9a-f]{64}64736f6c6343[0-9a-f]{6}0033/g;

/** Removes the trailing metadata (if present) and zeroes metadata embedded in child-contract creation code. */
export function normalizeRuntime(code, immutableRefs) {
  let hex = strip0x(code);
  const meta = readMetadata(hex);
  if (meta) hex = hex.slice(0, hex.length - meta.length * 2);
  // embedded metadata of contracts created with `new X()` — their hashes depend on comments too
  hex = hex.replace(META_RE, (m, offset) => (offset % 2 ? m : m.slice(0, 20) + '0'.repeat(64) + m.slice(84)));
  // immutables: the chain has real values, the compiler leaves zeros — mask both
  const ranges = [];
  for (const refs of Object.values(immutableRefs || {})) for (const r of refs) ranges.push([r.start, r.length]);
  if (ranges.length) {
    const arr = hex.split('');
    for (const [start, length] of ranges) for (let k = start * 2; k < (start + length) * 2 && k < arr.length; k++) arr[k] = '0';
    hex = arr.join('');
  }
  return { hex, meta, ranges };
}

/**
 * Compares deployed runtime code with compiler output.
 * Returns { match, perfect, reason, firstDiff, ranges } — ranges are the masked immutable byte ranges.
 */
export function compareRuntime(chainCode, compiledCode, immutableRefs) {
  const a = normalizeRuntime(chainCode, immutableRefs);
  const b = normalizeRuntime(compiledCode, immutableRefs);
  if (!b.hex) return { match: false, perfect: false, reason: 'empty', ranges: a.ranges };
  if (a.hex.length !== b.hex.length) return { match: false, perfect: false, reason: 'length', lengths: [a.hex.length / 2, b.hex.length / 2], ranges: a.ranges, firstDiff: firstDiff(a.hex, b.hex) };
  if (a.hex !== b.hex) return { match: false, perfect: false, reason: 'bytes', ranges: a.ranges, firstDiff: firstDiff(a.hex, b.hex) };
  const perfect = !!(a.meta && b.meta && a.meta.ipfs && a.meta.ipfs === b.meta.ipfs);
  return { match: true, perfect, ranges: a.ranges };
}
function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 2) if (a.substr(i, 2) !== b.substr(i, 2)) return i / 2;
  return n / 2;
}

/**
 * Constructor arguments = creation input minus the compiled creation code.
 * The metadata hash inside creation code may differ (comments), so the prefix is compared with metadata zeroed.
 */
export function constructorArgs(creationInput, compiledCreation) {
  const input = strip0x(creationInput);
  const code = strip0x(compiledCreation);
  if (!input || !code || input.length < code.length) return { ok: false, args: '' };
  const zero = (h) => h.replace(META_RE, (m) => m.slice(0, 20) + '0'.repeat(64) + m.slice(84));
  const ok = zero(input.slice(0, code.length)) === zero(code);
  return { ok, args: input.slice(code.length) };
}

// ------------------------------------------------------------------ Solidity source helpers
/** Same-length copy of `src` with comments and string contents blanked (newlines kept), so regexes never hit them. */
export function maskSource(src, { keepStrings = false } = {}) {
  const out = src.split('');
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') out[i++] = ' '; continue; }
    if (c === '/' && d === '*') {
      out[i++] = ' '; out[i++] = ' ';
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] !== '\n') out[i] = ' '; i++; }
      if (i < n) { out[i++] = ' '; out[i++] = ' '; }
      continue;
    }
    if (c === '"' || c === "'") {
      const q = c; i++;
      while (i < n && src[i] !== q && src[i] !== '\n') {
        if (src[i] === '\\') { if (!keepStrings) { out[i] = ' '; if (i + 1 < n) out[i + 1] = ' '; } i += 2; continue; }
        if (!keepStrings) out[i] = ' ';
        i++;
      }
      i++;
      continue;
    }
    i++;
  }
  return out.join('');
}

/** import statements: [{ start, end, path, aliased }] (positions in the original source). */
export function parseImports(src) {
  const masked = maskSource(src); // strings blanked (quotes kept) so "import" inside a string never matches
  const out = [];
  const re = /\bimport\b[^;]*;/g;
  let m;
  while ((m = re.exec(masked))) {
    const stmt = src.slice(m.index, m.index + m[0].length);
    const p = stmt.match(/["']([^"']+)["']/);
    if (!p) continue;
    const aliased = /\*\s*as\b|["']\s*as\b|\bas\s+[A-Za-z_$]/.test(stmt);
    out.push({ start: m.index, end: m.index + stmt.length, path: p[1], aliased });
  }
  return out;
}

/** contract / library / interface declarations: [{ name, kind, abstract }] */
export function findContracts(src) {
  const masked = maskSource(src);
  const out = [];
  const re = /\b(abstract\s+)?(contract|library|interface)\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(masked))) out.push({ name: m[3], kind: m[2], abstract: !!m[1] });
  return out;
}

export const findPragmas = (src) => {
  const masked = maskSource(src);
  return [...masked.matchAll(/\bpragma\s+[^;]+;/g)].map((m) => ({ start: m.index, end: m.index + m[0].length, text: src.slice(m.index, m.index + m[0].length).replace(/\s+/g, ' ') }));
};
export const findSpdx = (src) => [...src.matchAll(/SPDX-License-Identifier:\s*([^\s*]+)/g)].map((m) => m[1]);

/** Best guess for a solc version from `pragma solidity` (used only when bytecode has no metadata). */
export function pragmaVersion(src) {
  const p = findPragmas(src).find((x) => /pragma solidity/.test(x.text));
  if (!p) return null;
  const v = p.text.match(/(\d+)\.(\d+)\.(\d+)/);
  return v ? `${v[1]}.${v[2]}.${v[3]}` : null;
}

// ------------------------------------------------------------------ path helpers
export function joinPath(base, rel) {
  const parts = base.split('/');
  parts.pop();
  for (const seg of rel.split('/')) {
    if (seg === '.' || seg === '') continue;
    if (seg === '..') parts.pop(); else parts.push(seg);
  }
  return parts.join('/');
}
export const resolveImport = (from, path) => (path.startsWith('./') || path.startsWith('../') ? joinPath(from, path) : path);
export const npmPackageOf = (path) => {
  const seg = path.split('/');
  if (seg[0].startsWith('@')) return seg.length > 2 ? `${seg[0]}/${seg[1]}` : null;
  return seg.length > 1 ? seg[0] : null;
};

/**
 * Flattens `main` and its imports into one file.
 * `load(path)` → Promise<string> returns a file's source (local or fetched); it throws ImportError if not found.
 * Returns { source, order: [paths], spdx, pragmas, warnings, files: {path: source} }.
 */
export async function flatten(main, load) {
  const files = {};
  const order = [];
  const warnings = [];
  const visiting = new Set();
  async function visit(path, from) {
    if (order.includes(path)) return;
    if (visiting.has(path)) return; // import cycles are legal in Solidity; first visit wins
    visiting.add(path);
    if (!(path in files)) files[path] = await load(path, from);
    for (const imp of parseImports(files[path])) {
      if (imp.aliased) warnings.push(`${path} uses an import alias (“${imp.path}”) — aliased imports may not compile once flattened.`);
      await visit(resolveImport(path, imp.path), path);
    }
    order.push(path);
  }
  await visit(main, null);

  // single file with no imports → leave it byte-for-byte (keeps a perfect match possible)
  if (order.length === 1) {
    const src = files[main];
    return { source: src, order, spdx: findSpdx(src)[0] || '', pragmas: findPragmas(src).map((p) => p.text), warnings, files };
  }

  const spdxAll = order.map((p) => findSpdx(files[p])[0]).filter(Boolean);
  const spdx = findSpdx(files[main])[0] || spdxAll[spdxAll.length - 1] || 'UNLICENSED';
  const pragmas = [];
  const bodies = order.map((path) => {
    let src = files[path];
    const cuts = [...parseImports(src), ...findPragmas(src)].sort((a, b) => b.start - a.start);
    for (const c of cuts) {
      const text = src.slice(c.start, c.end).replace(/\s+/g, ' ');
      if (/^pragma /.test(text) && !pragmas.includes(text)) pragmas.push(text);
      src = src.slice(0, c.start) + src.slice(c.end);
    }
    src = src.replace(/^[ \t]*\/\/[ \t]*SPDX-License-Identifier:[^\n]*\n?/gm, '').replace(/\/\*\s*SPDX-License-Identifier:[^*]*\*\//g, '');
    src = src.replace(/^\s*\n/, '').replace(/\n{3,}/g, '\n\n').trimEnd();
    return `// File: ${path}\n\n${src}\n`;
  });
  // `pragma solidity` first, then the rest (abicoder / experimental)
  // the main file's pragmas first, `pragma solidity` before abicoder / experimental
  const mainP = findPragmas(files[main]).map((p) => p.text);
  const rank = (p) => (mainP.includes(p) ? 0 : 2) + (/pragma solidity/.test(p) ? 0 : 1);
  pragmas.sort((a, b) => rank(a) - rank(b));
  const source = `// SPDX-License-Identifier: ${spdx}\n${pragmas.join('\n')}\n\n${bodies.join('\n')}`;
  return { source, order, spdx, pragmas, warnings, files };
}

export class ImportError extends Error {
  constructor(path, from, pkg) { super(`Import not found: ${path}`); this.path = path; this.from = from; this.pkg = pkg; }
}

// ------------------------------------------------------------------ settings search
const cmp = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
export const versionAtLeast = (v, min) => cmp(v, min) >= 0;

/** The EVM version solc uses when none is given. */
export function defaultEvm(v) {
  if (versionAtLeast(v, '0.8.31')) return 'osaka';
  if (versionAtLeast(v, '0.8.30')) return 'prague';
  if (versionAtLeast(v, '0.8.25')) return 'cancun';
  if (versionAtLeast(v, '0.8.20')) return 'shanghai';
  if (versionAtLeast(v, '0.8.18')) return 'paris';
  if (versionAtLeast(v, '0.8.7')) return 'london';
  if (versionAtLeast(v, '0.8.5')) return 'berlin';
  if (versionAtLeast(v, '0.5.14')) return 'istanbul';
  if (versionAtLeast(v, '0.5.5')) return 'petersburg';
  return 'byzantium';
}
const EVM_MIN = { homestead: '0.4.0', byzantium: '0.4.21', constantinople: '0.4.21', petersburg: '0.5.5', istanbul: '0.5.13', berlin: '0.8.5', london: '0.8.7', paris: '0.8.18', shanghai: '0.8.20', cancun: '0.8.24', prague: '0.8.27', osaka: '0.8.29' };
export const evmSupported = (evm, v) => !!EVM_MIN[evm] && versionAtLeast(v, EVM_MIN[evm]);

/**
 * Settings to try, most likely first. Bytecode with PUSH0 needs shanghai or later; without it, paris or earlier.
 * Each attempt: { evmVersion, optimizer, runs, viaIR }.
 */
export function attemptPlan(version, { push0 = false, mcopy = false, viaIR = false, runsList = [200, 1000] } = {}) {
  const def = defaultEvm(version);
  let evms;
  if (mcopy) evms = ['cancun', 'prague', 'osaka'];
  else if (push0) evms = ['shanghai', 'cancun', 'prague', 'osaka'];
  else evms = ['paris', 'london', 'berlin', 'istanbul', 'petersburg', 'byzantium'];
  evms = evms.filter((e) => evmSupported(e, version));
  if (evms.includes(def)) evms = [def, ...evms.filter((e) => e !== def)];
  // older compilers: a few EVM targets is plenty
  evms = evms.slice(0, 4);
  const opts = [{ optimizer: false, runs: 200 }, ...runsList.map((runs) => ({ optimizer: true, runs }))];
  const plan = [];
  // paris + off, then paris + 200, … (evm-major order keeps the most common combos up front)
  for (const evmVersion of evms) for (const o of opts) plan.push({ evmVersion, ...o, viaIR });
  return plan;
}

export const settingsLabel = (s) => `${s.evmVersion} · ${s.optimizer ? `${s.runs} runs` : 'optimizer off'}${s.viaIR ? ' · via-IR' : ''}`;

/** Standard JSON input for one attempt. */
export function standardInput(fileName, source, s) {
  return {
    language: 'Solidity',
    sources: { [fileName]: { content: source } },
    settings: {
      optimizer: { enabled: !!s.optimizer, runs: s.runs || 200 },
      evmVersion: s.evmVersion,
      ...(s.viaIR ? { viaIR: true } : {}),
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object', 'evm.deployedBytecode.immutableReferences'] } },
    },
  };
}

// ------------------------------------------------------------------ explorer license values (Blockscout `license_type`)
const LICENSES = {
  'unlicense': 'unlicense', 'mit': 'mit', 'gpl-2.0': 'gnu_gpl_v2', 'gpl-2.0-or-later': 'gnu_gpl_v2', 'gpl-2.0-only': 'gnu_gpl_v2',
  'gpl-3.0': 'gnu_gpl_v3', 'gpl-3.0-or-later': 'gnu_gpl_v3', 'gpl-3.0-only': 'gnu_gpl_v3', 'lgpl-2.1': 'gnu_lgpl_v2_1', 'lgpl-2.1-or-later': 'gnu_lgpl_v2_1',
  'lgpl-3.0': 'gnu_lgpl_v3', 'lgpl-3.0-or-later': 'gnu_lgpl_v3', 'lgpl-3.0-only': 'gnu_lgpl_v3', 'bsd-2-clause': 'bsd_2_clause', 'bsd-3-clause': 'bsd_3_clause',
  'mpl-2.0': 'mpl_2_0', 'osl-3.0': 'osl_3_0', 'apache-2.0': 'apache_2_0', 'agpl-3.0': 'gnu_agpl_v3', 'agpl-3.0-or-later': 'gnu_agpl_v3', 'agpl-3.0-only': 'gnu_agpl_v3', 'busl-1.1': 'bsl_1_1',
};
export const licenseType = (spdx) => LICENSES[String(spdx || '').toLowerCase()] || 'none';
export const LICENSE_LABEL = { none: 'No License (None)', unlicense: 'The Unlicense', mit: 'MIT License', gnu_gpl_v2: 'GNU GPLv2', gnu_gpl_v3: 'GNU GPLv3', gnu_lgpl_v2_1: 'GNU LGPLv2.1', gnu_lgpl_v3: 'GNU LGPLv3', bsd_2_clause: 'BSD 2-clause', bsd_3_clause: 'BSD 3-clause', mpl_2_0: 'Mozilla Public License 2.0', osl_3_0: 'Open Software License 3.0', apache_2_0: 'Apache 2.0', gnu_agpl_v3: 'GNU AGPLv3', bsl_1_1: 'Business Source License' };
