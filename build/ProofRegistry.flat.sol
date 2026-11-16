// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ProofRegistry — Verify Buddy's on-chain record of source ↔ bytecode matches.
/// @notice A proof records what the recorder's browser matched: the deployed contract, the hash of the
///         flattened source, and the exact compiler settings. Anyone can re-check it by recompiling the
///         source (stored on IPFS under `cid`) with those settings. No tokens, no payments, no owner.
contract ProofRegistry {
    struct Proof {
        address target;     // the verified contract
        address recorder;   // who recorded the proof
        bytes32 sourceHash; // keccak256 of the flattened source (UTF-8)
        string compiler;    // e.g. "v0.8.24+commit.e11b9ed9"
        string evmVersion;  // e.g. "paris"
        uint32 runs;        // optimizer runs (0 when the optimizer is off)
        bool optimizer;
        bool perfect;       // metadata hash matched too (byte-for-byte source)
        string cid;         // IPFS CID of the flattened source ("" if not uploaded)
        uint64 at;          // block timestamp
    }

    Proof[] internal proofs;
    mapping(address => uint256[]) internal idsFor;
    address[] public targets;

    event ProofRecorded(address indexed target, address indexed recorder, bool perfect);

    error NoCode();
    error EmptySource();
    error BadCompiler();
    error BadEvmVersion();
    error BadCid();

    function record(
        address target,
        bytes32 sourceHash,
        string calldata compiler,
        string calldata evmVersion,
        bool optimizer,
        uint32 runs,
        bool perfect,
        string calldata cid
    ) external returns (uint256 id) {
        if (target.code.length == 0) revert NoCode();
        if (sourceHash == bytes32(0)) revert EmptySource();
        if (bytes(compiler).length == 0 || bytes(compiler).length > 64) revert BadCompiler();
        if (bytes(evmVersion).length == 0 || bytes(evmVersion).length > 32) revert BadEvmVersion();
        if (bytes(cid).length > 100) revert BadCid();

        id = proofs.length;
        proofs.push(Proof(target, msg.sender, sourceHash, compiler, evmVersion, optimizer ? runs : 0, optimizer, perfect, cid, uint64(block.timestamp)));
        if (idsFor[target].length == 0) targets.push(target);
        idsFor[target].push(id);
        emit ProofRecorded(target, msg.sender, perfect);
    }

    /// @notice Total number of proofs recorded.
    function total() external view returns (uint256) {
        return proofs.length;
    }

    /// @notice Number of distinct contracts with at least one proof.
    function totalTargets() external view returns (uint256) {
        return targets.length;
    }

    /// @notice The most recent proof for `target` (reverts with NoCode-free `exists=false` when none).
    function latestFor(address target) external view returns (bool exists, Proof memory proof) {
        uint256[] storage ids = idsFor[target];
        if (ids.length == 0) return (false, proof);
        return (true, proofs[ids[ids.length - 1]]);
    }

    /// @notice Every proof for `target`, oldest first.
    function proofsOf(address target) external view returns (Proof[] memory out) {
        uint256[] storage ids = idsFor[target];
        out = new Proof[](ids.length);
        for (uint256 i; i < ids.length; ++i) out[i] = proofs[ids[i]];
    }

    /// @notice Page through all proofs (oldest first).
    function getProofs(uint256 from, uint256 count) external view returns (Proof[] memory out) {
        uint256 n = proofs.length;
        if (from >= n) return out;
        uint256 end = from + count > n ? n : from + count;
        out = new Proof[](end - from);
        for (uint256 i = from; i < end; ++i) out[i - from] = proofs[i];
    }

    /// @notice Page through the distinct contracts that have proofs.
    function getTargets(uint256 from, uint256 count) external view returns (address[] memory out) {
        uint256 n = targets.length;
        if (from >= n) return out;
        uint256 end = from + count > n ? n : from + count;
        out = new address[](end - from);
        for (uint256 i = from; i < end; ++i) out[i - from] = targets[i];
    }
}
