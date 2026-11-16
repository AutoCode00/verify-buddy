// Main-thread client for assets/solc-worker.js: resolves a short version (0.8.24) to its soljson build,
// downloads it once (cached), and compiles. cancel() terminates the worker mid-compile.
const LIST = 'https://binaries.soliditylang.org/bin/list.json';
let listPromise = null;

/** { releases: { '0.8.24': 'soljson-v0.8.24+commit.e11b9ed9.js', … }, latest, builds: { file → longVersion } } */
export function compilerList() {
  listPromise ||= fetch(LIST).then((r) => { if (!r.ok) throw new Error('Could not load the compiler list'); return r.json(); }).then((j) => ({
    releases: j.releases,
    latest: j.latestRelease,
    builds: Object.fromEntries(j.builds.map((b) => [b.path, b.longVersion])),
    sizes: Object.fromEntries(j.builds.filter((b) => b.path).map((b) => [b.path, b.size || 0])),
  })).catch((e) => { listPromise = null; throw e; });
  return listPromise;
}

/** '0.8.24' → { file, long: 'v0.8.24+commit.e11b9ed9' } */
export async function resolveVersion(short) {
  const l = await compilerList();
  const file = l.releases[short];
  if (!file) throw new Error(`solc ${short} is not a published release`);
  return { file, long: 'v' + (l.builds[file] || file.replace(/^soljson-v|\.js$/g, '')) };
}

export class Compiler {
  constructor() { this.worker = null; this.file = null; this.seq = 0; this.pending = new Map(); }
  #spawn() {
    this.worker = new Worker(new URL('./solc-worker.js', import.meta.url));
    this.worker.onmessage = ({ data }) => {
      const p = this.pending.get(data.id);
      if (!p) return;
      if (data.type === 'progress') { p.onProgress?.(data); return; }
      this.pending.delete(data.id);
      if (data.type === 'error') p.reject(new Error(data.message)); else p.resolve(data);
    };
    this.worker.onerror = (e) => { for (const p of this.pending.values()) p.reject(new Error(e.message || 'Compiler worker crashed')); this.pending.clear(); };
  }
  #send(msg, onProgress) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject, onProgress }); this.worker.postMessage({ ...msg, id }); });
  }
  /** Loads `file` (a soljson filename). Reuses the worker if it already has it. */
  async load(file, onProgress) {
    if (this.worker && this.file === file) return;
    this.terminate();
    this.#spawn();
    await this.#send({ type: 'load', file }, onProgress);
    this.file = file;
  }
  async compile(input) {
    if (!this.worker) throw new Error('Load a compiler first');
    const r = await this.#send({ type: 'compile', input });
    return { output: r.output, ms: r.ms };
  }
  /** Stops everything (used by Cancel). The next load() starts a fresh worker. */
  terminate() {
    this.worker?.terminate();
    for (const p of this.pending.values()) p.reject(Object.assign(new Error('Cancelled'), { cancelled: true }));
    this.pending.clear();
    this.worker = null; this.file = null;
  }
}
