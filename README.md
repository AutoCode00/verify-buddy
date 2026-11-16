# Verify Buddy {✓}

**Verify your BOT Chain contract in minutes, not hours.** Verify Buddy reads the compiler version from your deployed bytecode, finds the exact settings by compiling your source in the browser, and submits it to the explorer for you, or walks you through the form field by field.

*Free (gas only). No tokens, no payments, no accounts. Your source stays in your browser unless you submit it or record a proof.*

## Status

| | |
|---|---|
| Live site | _not published yet_ (GitHub Pages + custom domain) |
| ProofRegistry (BOT Chain mainnet, chain ID 677) | [`0x0756052E57Ac380F873B417061E35e37cE05757e`](https://scan.botchain.ai/address/0x0756052E57Ac380F873B417061E35e37cE05757e). Set in `assets/config.js`, shown in the footer. Deployed by `0xA198…E2F6` in tx [`0xba2e…b5bb`](https://scan.botchain.ai/tx/0xba2e9a08401f40907f5f4f267cae957183d027c5520ca1eb15d952adbabb85bb). Compiled with **solc v0.8.34+commit.80d5c536 · EVM default (osaka) · optimizer off**. Verify Buddy gets a perfect match with `contracts/ProofRegistry.sol`. Not yet verified on the explorer. |
| ProofRegistry (testnet, chain ID 968) | _not deployed yet_ |
| IPFS Worker | _not configured_. Set `worker` in `assets/config.js` to a Worker with `POST /upload → { cid }`. Without it, proofs store the source hash only. |

With the registry set, the site runs in **live mode** (proofs are real transactions). Add `?preview` to force preview mode, where proofs are saved in your browser instead.

## Explorer research (PRD §0)

`scan.botchain.ai` runs **Blockscout** with CORS open (`access-control-allow-origin: *`):

- `GET /api/v2/addresses/:addr` → `is_verified`, `creation_transaction_hash`
- `GET /api/v2/smart-contracts/:addr` → `creation_bytecode` (constructor args come from here)
- `GET /api/v2/smart-contracts/verification/config` → solc versions up to 0.8.38; EVM versions up to `cancun` plus `default`
- `POST /api/v2/smart-contracts/:addr/verification/via/flattened-code` (and `/standard-input` for via-IR builds)

So the app does **one-click API submit** with status polling. Guide mode stays available as a tab, and turns on by itself if the API can't be reached.

## What's inside

| Route | What it is |
|---|---|
| `/` | Website following Zoah's dark theme (black, Zalando Sans + IBM Plex Mono, white pill buttons), with emerald/ember accents: hero with a rotating phrase · pinned dark stage (Drop · Detect · Match · Verify, scrubbed with DrawSVG wires) · live registry counters + feed · "What makes Buddy different" · "Source in. Match out." (SnackPoll.sol beside its bytecode) · "Every setting, found." (live attempt log + inspector) · "Imports? Flattened." · Compare table · FAQ + CTA · certificate footer |
| `/app` | 6 steps: **Contract** (network auto-detected, metadata → solc version, PUSH0/MCOPY, explorer status) · **Source** (drop files/folder or paste, `package.json` versions, npm from jsDelivr with a version picker, flatten preview + Copy/Download) · **Match** (solc in a Web Worker, cached; tries EVM × optimizer most likely first; cancel; hints + via-IR toggle) · **Constructor args** (from explorer creation code / creation tx / pasted tx hash / pasted hex, decoded) · **Verify** (API submit + polling, or guide checklist with Copy buttons and Buddy pointing) · **Proof** (`record` tx) |
| `/v/:address` | Proof page: settings, source hash, IPFS link, live bytecode facts, history, and **Re-check**, which recompiles in your browser and compares with live code |

```
index.html · 404.html (GitHub Pages SPA redirect) · deploy.html (deploy ProofRegistry from MetaMask)
assets/
  config.js       ← registry addresses, Worker URL, links (the one place to edit)
  engine.js       CBOR metadata, opcode scan, compare (metadata strip + immutable masks), flattener, attempt plan
  solc-worker.js  Web Worker: downloads soljson with progress (Cache API), compiles Standard JSON
  compiler.js     version → soljson build (binaries.soliditylang.org/bin/list.json), worker client, cancel
  chain.js        RPC, Blockscout API, jsDelivr, IPFS, wallet, ProofRegistry (live + preview)
  buddy.js        Buddy 🔍 poses (read · sweat · thumbs · point · sad), {✓} logo, icons
  main.js · home.js · app.js · proof.js · ui.js · styles.css
contracts/ProofRegistry.sol
tools/            compile, tests, dev server
build/            ABI + bytecode + flattened source + standard JSON (for explorer verification)
```

## How matching works

1. **Metadata.** The last 2 bytes of runtime code give the CBOR length. Decoding it gives `solc` (3 bytes → `0.8.24`) and `ipfs` (shown as a CIDv0).
2. **EVM hint.** Buddy walks the opcodes (skipping PUSH data). No `PUSH0` means paris or older; `PUSH0` means shanghai or newer; `MCOPY` means cancun or newer. The compiler's own default EVM goes first, so the metadata can match too.
3. **Attempts.** EVM target × optimizer (off, 200, 1000; optionally 1, 10,000 and 999,999), via-IR toggle. Buddy stops at the first exact match.
4. **Compare.** Strip the trailing metadata, zero metadata embedded in child-contract creation code, and mask `immutableReferences` ranges in both. If the bytes are equal, it's a **match**. If the IPFS hashes are equal too, it's a **perfect match** (same source byte for byte).
5. **Constructor args.** Creation code minus the compiled creation bytecode, decoded with the constructor ABI.

Tested live against `0x505f…1910` on mainnet (an unverified solc 0.8.34 contract): **perfect match, osaka · 200 runs, in about 2.5 s**, and Re-check reproduces it.

## Contract

`contracts/ProofRegistry.sol`: Solidity ^0.8.20, compiled with **solc 0.8.24 · evmVersion paris · optimizer off**, runtime ≈ 8.9 KB, no owner, no tokens.
`record(target, sourceHash, compiler, evmVersion, optimizer, runs, perfect, cid)` requires `target.code.length > 0` · views `latestFor`, `proofsOf`, `getProofs(from, count)`, `getTargets(from, count)`, `total`, `totalTargets` · event `ProofRecorded(target, recorder, perfect)`.

To verify it on the explorer, use Verify Buddy itself (`/app?address=<registry>`, drop `contracts/ProofRegistry.sol`), or paste `build/ProofRegistry.flat.sol` with the settings above.

## Run locally

```bash
node tools/serve.mjs
```

Open http://localhost:4677. Unknown paths fall back to `index.html`, like GitHub Pages + `404.html`. Add `?net=testnet` for the testnet registry, or `?preview` to force preview mode.

## Tests

```bash
npm --prefix tools install
```

```bash
node tools/compile.mjs && node tools/test-contract.mjs && node tools/test-engine.mjs
```

`test-engine.mjs` deploys a sample with immutables and constructor args on an in-memory chain using hidden settings, then checks that the engine finds them. It also checks the flattener, metadata decoding, no false positives, "perfect" vs "exact", and constructor-arg decoding.

## Deploy checklist

1. `node tools/serve.mjs` → open `/deploy.html` → **Deploy to Testnet**, then record a proof on testnet (`/app?net=testnet`).
2. **Deploy to Mainnet** → put the address in `assets/config.js` → `registry` and in the Status table above.
3. Verify the registry with Verify Buddy, then record its first proof. The footer's "See a proof page" then points at it.
4. Push to GitHub → Settings → Pages (deploy from branch, root) → add the custom domain.
