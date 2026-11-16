// Compiles contracts/ProofRegistry.sol and writes build/ artifacts:
//   build/ProofRegistry.json                 ABI + creation bytecode (used by deploy.html)
//   build/ProofRegistry.flat.sol             the exact source to paste into the explorer
//   build/ProofRegistry.standard-input.json  standard JSON input (alternative explorer upload)
// Settings match the footer certificate: solc 0.8.24 · evmVersion paris · optimizer off.
// Usage (from the project root): npm --prefix tools install && node tools/compile.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import solc from 'solc';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const name = 'ProofRegistry';
const path = `contracts/${name}.sol`;
const source = readFileSync(join(root, path), 'utf8');

export const SETTINGS = { optimizer: { enabled: false, runs: 200 }, evmVersion: 'paris' };

const input = {
  language: 'Solidity',
  sources: { [`${name}.sol`]: { content: source } },
  settings: {
    ...SETTINGS,
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
for (const e of output.errors || []) console.error(e.formattedMessage);
if ((output.errors || []).some((e) => e.severity === 'error')) process.exit(1);

const contract = output.contracts[`${name}.sol`][name];
const runtime = contract.evm.deployedBytecode.object.length / 2;
mkdirSync(join(root, 'build'), { recursive: true });
writeFileSync(join(root, `build/${name}.flat.sol`), source);
writeFileSync(join(root, `build/${name}.standard-input.json`), JSON.stringify({ ...input, settings: { ...SETTINGS, outputSelection: { '*': { '*': ['*'] } } } }, null, 2) + '\n');
writeFileSync(
  join(root, `build/${name}.json`),
  JSON.stringify({ compiler: 'v' + solc.version().replace('.Emscripten.clang', ''), settings: SETTINGS, abi: contract.abi, bytecode: '0x' + contract.evm.bytecode.object, deployedBytecode: '0x' + contract.evm.deployedBytecode.object }, null, 2) + '\n',
);
console.log(`${name}: compiled with ${solc.version()} — runtime ${runtime} bytes (limit 24576)`);
if (runtime > 24576) process.exit(1);
