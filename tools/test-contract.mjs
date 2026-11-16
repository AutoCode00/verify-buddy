// Runs ProofRegistry on an in-memory chain and checks the PRD rules (section 5).
// Usage (from the project root): node tools/compile.mjs && node tools/test-contract.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ganache from 'ganache';
import * as ethers from 'ethers';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { abi, bytecode } = JSON.parse(readFileSync(join(root, 'build/ProofRegistry.json'), 'utf8'));
const chain = ganache.provider({ logging: { quiet: true }, chain: { hardfork: 'shanghai', chainId: 677 }, wallet: { totalAccounts: 2 } });
const provider = new ethers.BrowserProvider(chain);
const [alice, bob] = await Promise.all([0, 1].map((i) => provider.getSigner(i)));
const c = await (await new ethers.ContractFactory(abi, bytecode, alice).deploy()).waitForDeployment();
const as = (s) => c.connect(s);
const reverts = (call, name) => assert.rejects(call, (e) => e.revert?.name === name || (e.message || '').includes(name), `expected ${name}`);
let checks = 0;
const ok = (label) => { checks++; console.log(`  ✓ ${label}`); };

console.log('ProofRegistry contract');
assert.equal(await c.total(), 0n);
const [exists0] = await c.latestFor(await c.getAddress());
assert.equal(exists0, false);
ok('deploys empty; latestFor → exists = false');

const target = await c.getAddress(); // a contract with code
const eoa = await bob.getAddress();
const H = ethers.id('flattened source');
await reverts(as(alice).record.staticCall(eoa, H, 'v0.8.24+commit.e11b9ed9', 'paris', false, 0, false, ''), 'NoCode');
await reverts(as(alice).record.staticCall(target, ethers.ZeroHash, 'v0.8.24', 'paris', false, 0, false, ''), 'EmptySource');
await reverts(as(alice).record.staticCall(target, H, '', 'paris', false, 0, false, ''), 'BadCompiler');
await reverts(as(alice).record.staticCall(target, H, 'v0.8.24', '', false, 0, false, ''), 'BadEvmVersion');
await reverts(as(alice).record.staticCall(target, H, 'v0.8.24', 'paris', false, 0, false, 'x'.repeat(101)), 'BadCid');
ok('target must have code; source hash, compiler, evmVersion required; CID ≤ 100 bytes');

const rc = await (await as(alice).record(target, H, 'v0.8.24+commit.e11b9ed9', 'paris', false, 200, true, 'bafyTEST')).wait();
const ev = rc.logs.map((l) => c.interface.parseLog(l)).find((l) => l?.name === 'ProofRecorded');
assert.equal(ev.args.target, target); assert.equal(ev.args.recorder, await alice.getAddress()); assert.equal(ev.args.perfect, true);
ok('record emits ProofRecorded(target, recorder, perfect)');

const [exists, p] = await c.latestFor(target);
assert.equal(exists, true);
assert.equal(p.sourceHash, H); assert.equal(p.compiler, 'v0.8.24+commit.e11b9ed9'); assert.equal(p.evmVersion, 'paris');
assert.equal(p.optimizer, false); assert.equal(p.runs, 0n, 'runs stored as 0 when optimizer is off'); assert.equal(p.cid, 'bafyTEST');
ok('latestFor returns the stored proof (runs = 0 when the optimizer is off)');

await (await as(bob).record(target, ethers.id('v2'), 'v0.8.24+commit.e11b9ed9', 'shanghai', true, 1000, false, '')).wait();
assert.equal(await c.total(), 2n);
assert.equal(await c.totalTargets(), 1n);
assert.equal((await c.proofsOf(target)).length, 2);
assert.equal((await c.latestFor(target))[1].evmVersion, 'shanghai');
assert.deepEqual([...(await c.getTargets(0, 10))], [target]);
assert.equal((await c.getProofs(1, 10)).length, 1);
assert.equal((await c.getProofs(5, 10)).length, 0);
ok('a second proof for the same target: proofsOf = 2, targets de-duplicated, paging is safe');

console.log(`\n${checks} checks passed`);
process.exit(0);
