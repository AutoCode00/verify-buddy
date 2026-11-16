// The one place to set contract addresses, the Worker URL and links.
// Leave `registry` empty to run in preview mode (proofs saved in this browser; bytecode, explorer data and
// compiling are still fully live).
export const CONFIG = {
  networks: {
    mainnet: {
      chainId: 677,
      name: 'BOT Chain',
      rpc: 'https://rpc.botchain.ai',
      explorer: 'https://scan.botchain.ai',
      registry: '0x0756052E57Ac380F873B417061E35e37cE05757e', // ProofRegistry on BOT Chain mainnet (also in README + footer)
    },
    testnet: {
      chainId: 968,
      name: 'BOT Chain Testnet',
      rpc: 'https://rpc.bohr.life',
      explorer: 'https://scan.bohr.life',
      registry: '', // ← testnet address (used with ?net=testnet)
    },
  },
  // ProofRegistry's own build — shown on the footer certificate (keep in sync with tools/compile.mjs).
  // The mainnet deploy was compiled with solc 0.8.34, default EVM (osaka), optimizer off — a perfect match with contracts/ProofRegistry.sol.
  self: { file: 'ProofRegistry.sol', compiler: '0.8.34', evmVersion: 'osaka', optimizer: 'optimizer off' },
  // Shared Cloudflare Worker with POST /upload → { cid }. Empty → proofs are recorded without an IPFS copy.
  worker: '',
  ipfsGateway: 'https://ipfs.io/ipfs/',
  links: {
    botchain: 'https://botchain.ai',
    docs: 'https://botchain.ai/docs',
    faucet: 'https://faucet.bohr.life',
    x: 'https://x.com/BOTChain_ai',
    telegram: 'https://t.me/botchain_ai',
  },
  storageKey: 'verifybuddy',
};
