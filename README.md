# veil-sdk

Reusable SDK primitives for [Veil](https://github.com/psyto/veil) privacy-focused DeFi infrastructure on Solana.

## Packages

| Package | Description |
|---------|-------------|
| [`@veil/crypto`](#veilcrypto) | Encryption, secret sharing, ZK compression, shielded transfers, Arcium MPC, Noir proofs |
| [`@veil/orders`](#veilorders) | Encrypt and decrypt swap order payloads for MEV protection |
| [`@veil/qn-addon`](#veilqn-addon) | QuickNode Marketplace REST Add-On wrapping Veil privacy primitives |
| [`@veil/mcp-server`](#veilmcp-server) | MCP server exposing Veil privacy primitives for AI agents |

## Getting Started

```bash
# Install dependencies
yarn install

# Build all packages
yarn build

# Run tests
yarn test
```

### Environment Variables

```bash
# RPC provider (pick one)
HELIUS_API_KEY=your-helius-key          # Recommended — supports ZK compression
QUICKNODE_ENDPOINT=https://your-qn.url  # Alternative
RPC_URL=https://custom-rpc.url          # Fallback

# Network
SOLANA_NETWORK=devnet                   # mainnet-beta | devnet | testnet
```

---

## `@veil/crypto`

Shared encryption and privacy utilities for the entire Privacy Suite.

### NaCl Box Encryption

Curve25519-XSalsa20-Poly1305 authenticated encryption for encrypting order payloads, routing hints, and any data that must be kept private from MEV searchers.

```typescript
import {
  generateEncryptionKeypair,
  deriveEncryptionKeypair,
  encrypt,
  decrypt,
  encryptForMultiple,
  encryptionKeyToBase58,
  base58ToEncryptionKey,
  validateEncryptedData,
} from '@veil/crypto';

// Generate a random keypair
const alice = generateEncryptionKeypair();
const bob = generateEncryptionKeypair();

// Or derive deterministically from a wallet seed
const derived = deriveEncryptionKeypair(walletSecretKey.slice(0, 32));

// Encrypt data for a single recipient
const plaintext = new TextEncoder().encode('secret order data');
const encrypted = encrypt(plaintext, bob.publicKey, alice);
// encrypted.bytes contains nonce + ciphertext, ready for on-chain storage

// Decrypt
const decrypted = decrypt(encrypted.bytes, alice.publicKey, bob);

// Encrypt for multiple recipients (each gets their own ciphertext)
const solverKeys = [solver1.publicKey, solver2.publicKey];
const multiEncrypted = encryptForMultiple(plaintext, solverKeys, alice);
// Returns Map<hexPubkey, EncryptedData>

// Convert keys to/from base58 for display or storage
const b58 = encryptionKeyToBase58(alice.publicKey); // "7xKX..."
const bytes = base58ToEncryptionKey(b58);

// Validate encrypted data structure
const isValid = validateEncryptedData(encrypted.bytes);
```

#### Types

```typescript
interface EncryptionKeypair {
  publicKey: Uint8Array;  // 32 bytes, X25519
  secretKey: Uint8Array;  // 32 bytes
}

interface EncryptedData {
  nonce: Uint8Array;      // 24 bytes
  ciphertext: Uint8Array;
  bytes: Uint8Array;      // nonce + ciphertext combined
}
```

### Shamir's Secret Sharing

M-of-N threshold secret splitting for scenarios where multiple parties must cooperate to decrypt (e.g., multi-solver decryption, escrow).

```typescript
import {
  splitSecret,
  combineShares,
  verifyShares,
  createThresholdEncryption,
  decryptWithThreshold,
} from '@veil/crypto';

// Split a 32-byte secret into 5 shares, requiring 3 to reconstruct
const secret = new Uint8Array(32); // your secret key
crypto.getRandomValues(secret);

const shares = splitSecret(secret, 3, 5);
// shares[0..4], each with { index, value }

// Any 3 shares can reconstruct the secret
const reconstructed = combineShares([shares[0], shares[2], shares[4]]);
// reconstructed === secret

// Verify shares are consistent
const valid = verifyShares(shares, 3); // true

// Higher-level: encrypt data, split the key
const { encryptedSecret, keyShares } = createThresholdEncryption(
  myData,   // Uint8Array to protect
  3,        // threshold
  5         // total shares
);

// Decrypt with enough shares
const original = decryptWithThreshold(encryptedSecret, [
  keyShares[0], keyShares[1], keyShares[3],
]);
```

#### Types

```typescript
interface SecretShare {
  index: number;       // 1-based share index
  value: Uint8Array;   // 32 bytes
}

interface ThresholdConfig {
  threshold: number;   // minimum shares required (M)
  totalShares: number; // total shares generated (N)
}
```

#### Constraints

- Secret must be exactly 32 bytes
- Threshold must be >= 2
- Total shares must be >= threshold and <= 255

### Payload Serialization

Type-safe binary serialization for structured data that needs to go on-chain. Includes pre-defined schemas for common Veil payloads.

```typescript
import {
  serializePayload,
  deserializePayload,
  calculateSchemaSize,
  SWAP_ORDER_SCHEMA,
  RWA_ASSET_SCHEMA,
  RWA_ACCESS_GRANT_SCHEMA,
} from '@veil/crypto';

// Use a built-in schema
const size = calculateSchemaSize(SWAP_ORDER_SCHEMA);
const bytes = serializePayload({
  minOutputAmount: new Uint8Array(8),
  slippageBps: 50,
  deadline: Math.floor(Date.now() / 1000) + 300,
  padding: new Uint8Array(6),
}, SWAP_ORDER_SCHEMA);

const parsed = deserializePayload(bytes, SWAP_ORDER_SCHEMA);

// Define a custom schema
const MY_SCHEMA = {
  fields: [
    { name: 'amount', type: 'u64' as const },
    { name: 'recipient', type: 'pubkey' as const },
    { name: 'memo', type: 'bytes' as const, size: 32 },
  ],
};
```

#### Field Types

| Type | Size | Description |
|------|------|-------------|
| `u8` | 1 byte | Unsigned 8-bit integer |
| `u16` | 2 bytes | Unsigned 16-bit integer (LE) |
| `u32` | 4 bytes | Unsigned 32-bit integer (LE) |
| `u64` | 8 bytes | Unsigned 64-bit integer (LE) |
| `i64` | 8 bytes | Signed 64-bit integer (LE) |
| `pubkey` | 32 bytes | Solana public key |
| `bytes` | variable | Raw bytes (requires `size` field) |

### ZK Compression (Light Protocol)

Compress on-chain data using Light Protocol for ~99% cost savings. Includes compressed token operations.

```typescript
import {
  createZkRpc,
  compressData,
  decompressData,
  createCompressedMint,
  mintCompressedTokens,
  transferCompressedTokens,
  getCompressedTokenBalance,
  compressTokenAccount,
  decompressTokenAccount,
  estimateCompressionSavings,
} from '@veil/crypto';

// Set up the ZK-enabled RPC
const rpc = createZkRpc({
  endpoint: 'https://devnet.helius-rpc.com/?api-key=YOUR_KEY',
  compressionEndpoint: 'https://devnet.helius-rpc.com/?api-key=YOUR_KEY',
  proverEndpoint: 'https://devnet.helius-rpc.com/?api-key=YOUR_KEY',
});

// Compress arbitrary data
const payload = await compressData(rpc, myData, payerKeypair);
const original = await decompressData(rpc, payload);

// Compressed token operations
const mint = await createCompressedMint(rpc, payer, mintAuthority, 6);
await mintCompressedTokens(rpc, payer, mint, destination, mintAuthority, 1_000_000n);
await transferCompressedTokens(rpc, payer, mint, 500_000n, owner, toAddress);

const balance = await getCompressedTokenBalance(rpc, owner, mint);

// Move between compressed and standard token accounts
await compressTokenAccount(rpc, payer, owner, mint, 1_000_000n);
await decompressTokenAccount(rpc, payer, owner, mint, 500_000n);

// Estimate savings before compressing
const savings = estimateCompressionSavings(1024, 6960);
// { uncompressedCost, compressedCost, savings, savingsPercent }
```

### Shielded Transfers (Privacy Cash)

Private token transfers where amounts and participants are hidden on-chain.

```typescript
import {
  PrivacyCashClient,
  createShieldedTransfer,
  verifyShieldedProof,
  estimateShieldedFee,
  isPrivacyCashAvailable,
  shieldTokens,
  unshieldTokens,
} from '@veil/crypto';

// Check if Privacy Cash is available on the network
const available = await isPrivacyCashAvailable(connection);

// High-level client
const client = new PrivacyCashClient({ connection, network: 'devnet' });
await client.initialize(walletKeypair);

// Check private balance
const balance = await client.getPrivateBalance();
const usdcBalance = await client.getPrivateBalanceSpl('USDC');

// Deposit into shielded pool
const deposit = await client.deposit(1_000_000_000n); // 1 SOL
const depositUsdc = await client.depositSpl(1_000_000n, 'USDC');

// Withdraw from shielded pool
const withdrawal = await client.withdraw(500_000_000n, recipientPubkey);
const withdrawUsdc = await client.withdrawSpl(500_000n, recipientPubkey, 'USDC');

// Lower-level functions
const txId = await createShieldedTransfer(connection, sender, {
  amount: 1_000_000n,
  recipient: recipientPubkey,
  tokenType: 'USDC',
});
const fee = estimateShieldedFee('USDC');

// Convenience wrappers
await shieldTokens(connection, wallet, 1_000_000n, 'USDC');
await unshieldTokens(connection, wallet, 500_000n, recipient, 'USDC');
```

### Arcium Integration

Encrypted shared state and multi-party computation for dark pools and confidential DeFi.

```typescript
import {
  ArciumClient,
  DarkPoolStateManager,
  createArciumClient,
  createDarkPoolManager,
} from '@veil/crypto';

// Create an Arcium client
const arcium = createArciumClient(connection, 'devnet', 'YOUR_API_KEY');

// Encrypt data for shared state
const encrypted = arcium.encryptForState(data, recipientPubkey);
const decrypted = arcium.decryptFromState(encrypted, senderPubkey);

// Submit an encrypted position to a dark pool
const position = await arcium.submitEncryptedPosition(
  poolAddress,
  1_000_000n,         // amount
  poolEncryptionKey   // pool's public key
);

// Submit a dark order
const order = await arcium.submitDarkOrder(
  inputMint,
  outputMint,
  inputAmount,
  minOutputAmount,
  deadline,
  solverKey
);

// Query aggregated pool state (without revealing individual positions)
const aggregates = await arcium.queryPoolAggregates(poolAddress);

// Run an MPC computation
const result = await arcium.mpcCompute('sum', [input1, input2]);

// Dark pool management
const pool = createDarkPoolManager(connection, poolAddress, 'devnet');
await pool.processEncryptedDeposit(position);
await pool.processDarkSwap(order, proof);
const poolAggregates = await pool.getAggregates();
```

### Noir ZK Proofs

Generate and verify zero-knowledge proofs for swap validity, range checks, and more.

```typescript
import {
  createNoirProver,
  createNoirVerifier,
  generateSwapProof,
  verifySwapProof,
  generateRangeProof,
} from '@veil/crypto';

// Generate a swap validity proof
const swapProof = await generateSwapProof({
  inputAmount: 1_000_000n,
  minOutputAmount: 990_000n,
  balanceCommitment: commitment,
  poolStateRoot: root,
  balanceMerkleProof: proof,
});

// Verify the proof
const result = await verifySwapProof(swapProof);
// { valid: true, estimatedGas?: number }

// Generate a range proof (prove value is within bounds without revealing it)
const rangeProof = await generateRangeProof({
  value: 500_000n,
  min: 0n,
  max: 1_000_000n,
});

// For custom circuits, use the prover/verifier directly
const prover = createNoirProver('./circuits/my_circuit');
const verifier = createNoirVerifier();
```

### RPC Provider Configuration

Unified configuration for connecting to Solana RPC providers with ZK compression support.

```typescript
import {
  createRpcConnections,
  createHeliusRpc,
  createQuicknodeRpc,
  createRpcFromEnv,
  createPublicRpc,
  getRpcAttribution,
} from '@veil/crypto';

// From explicit config
const { connection, zkRpc } = createRpcConnections({
  provider: 'helius',
  apiKey: 'YOUR_KEY',
  network: 'devnet',
  enableZkCompression: true,
});

// Convenience constructors
const helius = createHeliusRpc('YOUR_KEY', 'devnet', true);
const quicknode = createQuicknodeRpc('https://your-qn.url', 'devnet');

// Auto-detect from environment variables
// Checks HELIUS_API_KEY -> QUICKNODE_ENDPOINT -> RPC_URL
const fromEnv = createRpcFromEnv();

// Public RPC (testing only — rate limited)
const publicConn = createPublicRpc('devnet');

// Attribution string for UI
const attribution = getRpcAttribution(helius); // "Powered by Helius"
```

---

## `@veil/orders`

Order encryption utilities for Privacy Suite. Wraps `@veil/crypto` to provide a high-level API for encrypting swap orders that solvers can decrypt but MEV searchers cannot.

### Quick Start

```typescript
import {
  createEncryptedOrder,
  decryptOrderPayload,
  generateEncryptionKeypair,
} from '@veil/orders';
import BN from 'bn.js';

// User side: encrypt an order
const userKeypair = generateEncryptionKeypair();
const solverPublicKey = /* solver's known public key */;

const encryptedBytes = createEncryptedOrder(
  new BN('1000000'),      // minOutputAmount (1 USDC)
  50,                      // slippageBps (0.5%)
  Math.floor(Date.now() / 1000) + 300, // deadline (5 minutes)
  solverPublicKey,
  userKeypair,
);
// encryptedBytes is ready for on-chain submission

// Solver side: decrypt the order
const order = decryptOrderPayload(
  encryptedBytes,
  userKeypair.publicKey,   // user's public key (from on-chain order account)
  solverKeypair,
);
console.log(order.minOutputAmount.toString()); // "1000000"
console.log(order.slippageBps);                // 50
console.log(order.deadline);                   // unix timestamp
```

### Detailed API

```typescript
import {
  serializeOrderPayload,
  deserializeOrderPayload,
  encryptOrderPayload,
  decryptOrderPayload,
  createEncryptedOrder,
  validateEncryptedPayload,
  getEncryptionPublicKey,
} from '@veil/orders';

// Serialize/deserialize without encryption (useful for testing)
const payload = {
  minOutputAmount: new BN('1000000'),
  slippageBps: 50,
  deadline: 1700000000,
};
const bytes = serializeOrderPayload(payload);
const parsed = deserializeOrderPayload(bytes);

// Encrypt with full control over the EncryptedPayload object
const encrypted = encryptOrderPayload(payload, solverPublicKey, userKeypair);
// encrypted.nonce     — 24-byte nonce
// encrypted.ciphertext — encrypted order data
// encrypted.bytes     — nonce + ciphertext combined

// Validate that bytes look like a valid encrypted payload
const isValid = validateEncryptedPayload(encrypted.bytes); // true

// Extract public key from keypair to share with solver
const pubkey = getEncryptionPublicKey(userKeypair);
```

### Types

```typescript
interface OrderPayload {
  minOutputAmount: BN;        // Minimum tokens the user expects
  slippageBps: number;        // Slippage tolerance (50 = 0.5%)
  deadline: number;           // Unix timestamp in seconds
  routingHint?: Uint8Array;   // Optional routing data
}

interface EncryptedPayload {
  nonce: Uint8Array;          // 24-byte NaCl nonce
  ciphertext: Uint8Array;     // Encrypted order data
  bytes: Uint8Array;          // Combined nonce + ciphertext
}
```

---

## `@veil/qn-addon`

QuickNode Marketplace REST Add-On that wraps all Veil privacy primitives as a JSON API. Install it on any QuickNode Solana endpoint to access NaCl encryption, Shamir secret sharing, order encryption, and ZK compression estimation over HTTP.

### Running

```bash
# From the monorepo root
yarn install && yarn build

# Start the add-on server (default port 3030)
cd packages/qn-addon
yarn dev
```

```bash
# Health check
curl http://localhost:3030/healthcheck
# {"status":"ok"}
```

### QuickNode PUDD Lifecycle

The add-on implements the four mandatory QuickNode Marketplace provisioning endpoints, all protected by HTTP Basic Auth:

| Method | Path | Action |
|--------|------|--------|
| POST | `/provision` | Store or update endpoint (idempotent — quicknode-id, endpoint-id, plan, http-url, chain, network) |
| PUT | `/update` | Update an existing endpoint |
| DELETE | `/deactivate_endpoint` | Soft-deactivate (set active=0) |
| DELETE | `/deprovision` | Hard-delete all instances for an account |

```bash
# Provision an endpoint
curl -X POST http://localhost:3030/provision \
  -u quicknode:changeme \
  -H "Content-Type: application/json" \
  -d '{"quicknode-id":"qn-1","endpoint-id":"ep-1","plan":"starter","http-url":"https://example.solana-mainnet.quiknode.pro/abc","chain":"solana","network":"mainnet-beta"}'
# {"status":"success"}
```

### REST API Endpoints

All binary data in JSON uses **base64** encoding. Key material responses include both `base64` and `hex` fields.

#### Crypto (NaCl Box)

```bash
# Generate a keypair
curl -X POST http://localhost:3030/v1/keypair/generate
# {"success":true,"publicKey":{"base64":"...","hex":"..."},"secretKey":{"base64":"...","hex":"..."}}

# Derive a keypair from a seed
curl -X POST http://localhost:3030/v1/keypair/derive \
  -H "Content-Type: application/json" \
  -d '{"seed":"<base64-encoded-32-bytes>"}'

# Encrypt
curl -X POST http://localhost:3030/v1/encrypt \
  -H "Content-Type: application/json" \
  -d '{"plaintext":"<base64>","recipientPublicKey":"<base64>","senderSecretKey":"<base64>","senderPublicKey":"<base64>"}'

# Decrypt
curl -X POST http://localhost:3030/v1/decrypt \
  -H "Content-Type: application/json" \
  -d '{"bytes":"<base64>","senderPublicKey":"<base64>","recipientSecretKey":"<base64>","recipientPublicKey":"<base64>"}'

# Encrypt for multiple recipients at once
curl -X POST http://localhost:3030/v1/crypto/encrypt-multiple \
  -H "Content-Type: application/json" \
  -d '{"plaintext":"<base64>","recipientPublicKeys":["<base64>","<base64>"],"senderSecretKey":"<base64>","senderPublicKey":"<base64>"}'

# Validate encrypted data structure
curl -X POST http://localhost:3030/v1/crypto/validate \
  -H "Content-Type: application/json" \
  -d '{"bytes":"<base64>"}'

# Convert key between base64 and base58
curl -X POST http://localhost:3030/v1/crypto/key-convert \
  -H "Content-Type: application/json" \
  -d '{"publicKey":"<base64>"}'
# or: -d '{"base58":"7xKX..."}'
```

#### Threshold (Shamir Secret Sharing)

```bash
# Split a 32-byte secret into shares
curl -X POST http://localhost:3030/v1/threshold/split \
  -H "Content-Type: application/json" \
  -d '{"secret":"<base64-32-bytes>","threshold":3,"totalShares":5}'

# Combine shares to recover the secret
curl -X POST http://localhost:3030/v1/threshold/combine \
  -H "Content-Type: application/json" \
  -d '{"shares":[{"index":1,"value":"<base64>"},{"index":3,"value":"<base64>"},{"index":5,"value":"<base64>"}]}'

# Verify shares are consistent with a given threshold
curl -X POST http://localhost:3030/v1/threshold/verify \
  -H "Content-Type: application/json" \
  -d '{"shares":[{"index":1,"value":"<base64>"},{"index":2,"value":"<base64>"}],"threshold":2}'
```

#### Orders (Encrypted Swap Orders)

```bash
# Encrypt an order payload
curl -X POST http://localhost:3030/v1/orders/encrypt \
  -H "Content-Type: application/json" \
  -d '{"minOutputAmount":"1000000","slippageBps":50,"deadline":1700000000,"solverPublicKey":"<base64>","userSecretKey":"<base64>","userPublicKey":"<base64>"}'

# Decrypt an order payload
curl -X POST http://localhost:3030/v1/orders/decrypt \
  -H "Content-Type: application/json" \
  -d '{"bytes":"<base64>","userPublicKey":"<base64>","solverSecretKey":"<base64>","solverPublicKey":"<base64>"}'

# Validate encrypted order structure
curl -X POST http://localhost:3030/v1/orders/validate \
  -H "Content-Type: application/json" \
  -d '{"bytes":"<base64>"}'
```

#### Payload Serialization

```bash
# Serialize structured data (schemas: SWAP_ORDER, RWA_ASSET, RWA_ACCESS_GRANT)
curl -X POST http://localhost:3030/v1/payload/serialize \
  -H "Content-Type: application/json" \
  -d '{"data":{"minOutputAmount":"5000000","slippageBps":100,"deadline":1700000000,"padding":"AAAAAAAA"},"schema":"SWAP_ORDER"}'

# Deserialize bytes back to structured data
curl -X POST http://localhost:3030/v1/payload/deserialize \
  -H "Content-Type: application/json" \
  -d '{"bytes":"<base64>","schema":"SWAP_ORDER"}'
```

#### Compression (ZK)

```bash
# Estimate compression savings (stateless, no RPC needed)
curl "http://localhost:3030/v1/compression/estimate?size=4096"
# {"success":true,"dataSize":4096,"uncompressedCost":"...","compressedCost":"...","savings":"...","savingsPercent":...}

# Compress data (requires provisioned endpoint with http-url)
# Header X-INSTANCE-ID must match a provisioned endpoint
curl -X POST http://localhost:3030/v1/compression/compress \
  -H "Content-Type: application/json" \
  -H "X-INSTANCE-ID: ep-1" \
  -d '{"data":"<base64>","payerSecretKey":"<base64>"}'

# Decompress data
curl -X POST http://localhost:3030/v1/compression/decompress \
  -H "Content-Type: application/json" \
  -H "X-INSTANCE-ID: ep-1" \
  -d '{"compressedData":"<base64>","proof":"<base64>","publicInputs":"<base64>","stateTreeRoot":"<base64>","dataHash":"<base64>"}'
```

### Configuration

Copy `.env.example` and edit:

```bash
PORT=3030                          # Server port
QN_BASIC_AUTH_USERNAME=quicknode   # Basic Auth for PUDD endpoints
QN_BASIC_AUTH_PASSWORD=changeme
DB_PATH=./data/qn-addon.db        # SQLite database path
```

### Rate Limiting

API endpoints are rate-limited by default:

| Scope | Limit |
|-------|-------|
| API endpoints (`/v1/*`) | 100 requests/minute per IP |
| Provisioning (`/provision`, `/update`, etc.) | 20 requests/minute per IP |
| Health check (`/healthcheck`) | No limit |

Rate limit headers (`RateLimit-*`) are included in responses per the IETF draft standard.

### Docker

Build and run from the monorepo root:

```bash
docker build -f packages/qn-addon/Dockerfile -t veil-qn-addon .
docker run -p 3030:3030 \
  -e QN_BASIC_AUTH_USERNAME=quicknode \
  -e QN_BASIC_AUTH_PASSWORD=your-secret \
  veil-qn-addon
```

### Testing

```bash
cd packages/qn-addon

# Run all tests (125 tests across 21 suites)
yarn test

# End-to-end curl test (server must be running)
./scripts/test-qn-cli.sh

# Validate with QuickNode's official CLI (requires Go)
go install github.com/quiknode-labs/qn-marketplace-cli@latest
qn-marketplace-cli pudd \
  --base-url http://localhost:3030 \
  --basic-auth "$(echo -n 'quicknode:changeme' | base64)" \
  --chain solana --network mainnet-beta --plan starter

# Tier 2 RPC test (requires real QuickNode Solana devnet endpoint)
export QN_HTTP_URL="https://your-endpoint.quiknode.pro/..."
export PAYER_SECRET_KEY="<base64-encoded-solana-keypair>"
./scripts/test-tier2-rpc.sh
```

### CI

GitHub Actions runs `yarn build` and `yarn test` on every push and PR to `main`, tested against Node 18 and 20.

### RapidAPI

The add-on is also available on RapidAPI as a hosted API. The OpenAPI specification is at `openapi-rapidapi.yaml`.

```
https://veil-privacy-suite.p.rapidapi.com
```

All the same endpoints listed below are available via RapidAPI with your RapidAPI API key.

### API Endpoint Summary

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/healthcheck` | Health check | None |
| GET | `/` | Add-on info and endpoint listing | None |
| POST | `/provision` | Provision endpoint | Basic |
| PUT | `/update` | Update endpoint | Basic |
| DELETE | `/deactivate_endpoint` | Soft-deactivate | Basic |
| DELETE | `/deprovision` | Hard-delete account | Basic |
| POST | `/v1/keypair/generate` | Generate NaCl keypair | None |
| POST | `/v1/keypair/derive` | Derive keypair from seed | None |
| POST | `/v1/encrypt` | NaCl box encrypt | None |
| POST | `/v1/decrypt` | NaCl box decrypt | None |
| POST | `/v1/crypto/encrypt-multiple` | Encrypt for multiple recipients | None |
| POST | `/v1/crypto/validate` | Validate encrypted data structure | None |
| POST | `/v1/crypto/key-convert` | Convert key between base64 and base58 | None |
| POST | `/v1/threshold/split` | Shamir split secret | None |
| POST | `/v1/threshold/combine` | Shamir combine shares | None |
| POST | `/v1/threshold/verify` | Verify shares consistency | None |
| POST | `/v1/orders/encrypt` | Encrypt swap order | None |
| POST | `/v1/orders/decrypt` | Decrypt swap order | None |
| POST | `/v1/orders/validate` | Validate encrypted order structure | None |
| POST | `/v1/payload/serialize` | Serialize structured data | None |
| POST | `/v1/payload/deserialize` | Deserialize structured data | None |
| GET | `/v1/compression/estimate` | Estimate ZK compression savings | None |
| POST | `/v1/compression/compress` | Compress data via Light Protocol | X-INSTANCE-ID |
| POST | `/v1/compression/decompress` | Decompress data via Light Protocol | X-INSTANCE-ID |

---

## `@veil/mcp-server`

[Model Context Protocol](https://modelcontextprotocol.io/) server that exposes Veil privacy primitives as MCP tools for AI agents (Claude, GPT, etc.). Runs over stdio transport.

### Running

```bash
# Build
cd packages/mcp-server
yarn build

# Run directly
node dist/index.js

# Or use the bin alias
npx veil-mcp
```

### Claude Desktop Configuration

Add to your Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "veil-privacy-suite": {
      "command": "node",
      "args": ["/path/to/veil-sdk/packages/mcp-server/dist/index.js"]
    }
  }
}
```

### Available Tools

| Tool | Description |
|------|-------------|
| `generate_keypair` | Generate a random NaCl Box encryption keypair |
| `derive_keypair` | Derive a deterministic keypair from a 32-byte seed |
| `encrypt` | Encrypt a message using NaCl Box |
| `decrypt` | Decrypt NaCl Box ciphertext |
| `encrypt_multiple` | Encrypt for multiple recipients at once |
| `validate_encrypted` | Validate encrypted data structure without decrypting |
| `key_convert` | Convert keys between base64 and Solana base58 |
| `shamir_split` | Split a 32-byte secret into M-of-N Shamir shares |
| `shamir_combine` | Reconstruct a secret from Shamir shares |
| `shamir_verify` | Verify that shares are consistent |
| `encrypt_order` | Encrypt a DEX swap order payload (MEV protection) |
| `decrypt_order` | Decrypt an encrypted swap order payload |

All binary data (keys, ciphertext, nonces, secrets) is base64-encoded in both inputs and outputs.

### Example

```
User: Generate an encryption keypair and encrypt "hello" for another keypair.

Agent calls: generate_keypair → gets sender keys
Agent calls: generate_keypair → gets recipient keys
Agent calls: encrypt { message: <base64("hello")>, recipientPublicKey: ..., senderSecretKey: ..., senderPublicKey: ... }
→ returns { nonce, ciphertext, bytes } (all base64)
```

---

## Dependencies

| Package | Key Dependencies |
|---------|-----------------|
| `@veil/crypto` | `@solana/web3.js`, `tweetnacl`, `@lightprotocol/stateless.js`, `@lightprotocol/compressed-token`, `privacycash`, `bn.js` |
| `@veil/orders` | `@veil/crypto`, `bn.js` |
| `@veil/qn-addon` | `@veil/crypto`, `@veil/orders`, `express`, `better-sqlite3`, `morgan`, `express-rate-limit`, `bn.js` |
| `@veil/mcp-server` | `@modelcontextprotocol/sdk`, `@veil/crypto`, `@veil/orders`, `zod` |

## License

MIT
