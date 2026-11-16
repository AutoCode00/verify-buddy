// Tests the matching engine end to end: deploy sample contracts on an in-memory chain with known settings,
// then let the engine find those settings from source + deployed bytecode (the same code the browser runs).
// Usage (from the project root): node tools/test-engine.mjs
import assert from 'node:assert/strict';
import solc from 'solc';
import ganache from 'ganache';
import * as ethers from 'ethers';
import {
  readBytecode, compareRuntime, constructorArgs, flatten, parseImports, findContracts, attemptPlan, standardInput,
  licenseType, maskSource, readMetadata, ImportError, defaultEvm,
} from '../assets/engine.js';

let checks = 0;
const ok = (label) => { checks++; console.log(`  ✓ ${label}`); };

// ------------------------------------------------------------------ sources
const FILES = {
  'contracts/SnackPoll.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./lib/Owned.sol";
import {Counter} from "./lib/Counter.sol"; // a comment with import "nope.sol"; inside

/// A tiny poll: "import" in a string must not confuse the flattener.
contract SnackPoll is Owned {
    using Counter for uint256;
    string public name;
    uint256 public immutable created;
    mapping(uint8 => uint256) public votes;
    string constant NOTE = "import 'x.sol';";

    constructor(string memory _name, address _owner) Owned(_owner) {
        name = _name;
        created = block.timestamp;
    }

    function vote(uint8 snack) external { votes[snack] = votes[snack].inc(); }
}
`,
  'contracts/lib/Owned.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract Owned {
    address public immutable owner;
    constructor(address o) { owner = o; }
}
`,
  'contracts/lib/Counter.sol': `// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.0;
import "./Owned.sol";

library Counter {
    function inc(uint256 x) internal pure returns (uint256) { return x + 1; }
}
`,
};

console.log('Source helpers');
const imps = parseImports(FILES['contracts/SnackPoll.sol']);
assert.deepEqual(imps.map((i) => i.path), ['./lib/Owned.sol', './lib/Counter.sol']);
assert.equal(maskSource('a // x\nb').length, 'a // x\nb'.length);
ok('imports found, comments and strings ignored');
assert.deepEqual(findContracts(FILES['contracts/lib/Owned.sol']), [{ name: 'Owned', kind: 'contract', abstract: true }]);
ok('contracts detected (abstract flagged)');

const load = async (p) => { if (!(p in FILES)) throw new ImportError(p); return FILES[p]; };
const flat = await flatten('contracts/SnackPoll.sol', load);
assert.deepEqual(flat.order, ['contracts/lib/Owned.sol', 'contracts/lib/Counter.sol', 'contracts/SnackPoll.sol']);
assert.equal((flat.source.match(/SPDX-License-Identifier/g) || []).length, 1);
assert.match(flat.source, /^\/\/ SPDX-License-Identifier: MIT\npragma solidity \^0\.8\.20;\npragma solidity \^0\.8\.0;\npragma solidity >=0\.8\.0;\n/);
assert.ok(!/\nimport /.test(flat.source));
assert.ok(flat.source.includes(`"import 'x.sol';"`));
assert.equal(licenseType(flat.spdx), 'mit');
ok('flatten: dependency order, one SPDX (main file wins), pragmas de-duplicated, string kept');
await assert.rejects(flatten('contracts/Missing.sol', load), ImportError);
ok('missing import → ImportError');
const single = await flatten('contracts/lib/Owned.sol', load);
assert.equal(single.source, FILES['contracts/lib/Owned.sol']);
ok('single file without imports stays byte-for-byte');

// ------------------------------------------------------------------ compile + deploy with a hidden setting
const chain = ganache.provider({ logging: { quiet: true }, chain: { hardfork: 'shanghai' }, wallet: { totalAccounts: 1 } });
const provider = new ethers.BrowserProvider(chain);
const signer = await provider.getSigner(0);
const compile = (input) => JSON.parse(solc.compile(JSON.stringify(input)));
const version = solc.version().split('+')[0];

const SECRET = { evmVersion: 'shanghai', optimizer: true, runs: 1000, viaIR: false };
const out = compile(standardInput('SnackPoll.sol', flat.source, SECRET));
assert.ok(!(out.errors || []).some((e) => e.severity === 'error'), (out.errors || []).map((e) => e.formattedMessage).join('\n'));
const art = out.contracts['SnackPoll.sol'].SnackPoll;
const owner = '0x' + 'ab'.repeat(20);
const factory = new ethers.ContractFactory(art.abi, art.evm.bytecode.object, signer);
const deployed = await (await factory.deploy('Snack Poll', owner)).waitForDeployment();
const addr = await deployed.getAddress();
const code = await provider.getCode(addr);
const deployTx = await provider.getTransaction(deployed.deploymentTransaction().hash);

console.log('\nBytecode reading');
const info = readBytecode(code);
assert.equal(info.meta.solc, version);
assert.match(info.meta.cid, /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/);
assert.equal(info.push0, true, 'shanghai uses PUSH0');
ok(`metadata → solc ${info.meta.solc}, ${info.size} bytes, PUSH0: yes, CID ${info.meta.cid.slice(0, 10)}…`);
assert.equal(readMetadata('0x6080'), null);
ok('no metadata → null (no crash)');

console.log('\nMatching');
const plan = attemptPlan(version, { push0: info.push0 });
assert.equal(plan[0].evmVersion, 'shanghai');
assert.deepEqual(plan.slice(0, 3).map((p) => p.optimizer ? p.runs : 'off'), ['off', 200, 1000]);
ok(`plan: ${plan.length} attempts, shanghai (0.8.24 default) + optimizer off first`);
const noPush = attemptPlan(version, { push0: false });
assert.equal(noPush[0].evmVersion, 'paris');
ok('no PUSH0 → paris first');

let found = null, tries = 0;
for (const s of plan) {
  tries++;
  const o = compile(standardInput('SnackPoll.sol', flat.source, s));
  const c = o.contracts?.['SnackPoll.sol']?.SnackPoll;
  if (!c) continue;
  const r = compareRuntime(code, c.evm.deployedBytecode.object, c.evm.deployedBytecode.immutableReferences);
  if (r.match) { found = { s, r, c }; break; }
}
assert.ok(found, 'should find the settings');
assert.deepEqual({ evm: found.s.evmVersion, opt: found.s.optimizer, runs: found.s.runs }, { evm: 'shanghai', opt: true, runs: 1000 });
assert.equal(found.r.perfect, true, 'same flattened source → same metadata hash');
assert.equal(found.r.ranges.length, 2, 'two immutables masked');
ok(`found shanghai · 1000 runs after ${tries} attempts (perfect match, ${found.r.ranges.length} immutable ranges masked)`);

const wrong = compile(standardInput('SnackPoll.sol', flat.source, { evmVersion: 'shanghai', optimizer: true, runs: 200 })).contracts['SnackPoll.sol'].SnackPoll;
assert.equal(compareRuntime(code, wrong.evm.deployedBytecode.object, wrong.evm.deployedBytecode.immutableReferences).match, false);
ok('200 runs does not match (no false positive)');

const commented = flat.source.replace('/// A tiny poll', '/// A tiny, tasty poll');
const c2 = compile(standardInput('SnackPoll.sol', commented, SECRET)).contracts['SnackPoll.sol'].SnackPoll;
const r2 = compareRuntime(code, c2.evm.deployedBytecode.object, c2.evm.deployedBytecode.immutableReferences);
assert.equal(r2.match, true); assert.equal(r2.perfect, false);
ok('changed comment → still a match, but not “perfect”');

const ca = constructorArgs(deployTx.data, c2.evm.bytecode.object);
assert.equal(ca.ok, true);
const [n, o] = ethers.AbiCoder.defaultAbiCoder().decode(['string', 'address'], '0x' + ca.args);
assert.equal(n, 'Snack Poll'); assert.equal(o.toLowerCase(), owner);
ok(`constructor args recovered and decoded (name = '${n}', owner = ${o.slice(0, 6)}…)`);

assert.equal(defaultEvm('0.8.24'), 'shanghai');
assert.equal(attemptPlan('0.8.24', { push0: true })[0].evmVersion, 'shanghai');
assert.equal(attemptPlan('0.8.28', { push0: true })[0].evmVersion, 'cancun');
ok('PUSH0 bytecode → compiler default EVM first (shanghai on 0.8.24, cancun on 0.8.28)');

console.log(`\n${checks} checks passed`);
process.exit(0);
