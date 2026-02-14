# veil-sdk

Reusable SDK primitives for [Veil](https://github.com/psyto/veil) privacy-focused DeFi infrastructure on Solana.

## Packages

| Package | Description |
|---------|-------------|
| [`@privacy-suite/crypto`](#privacy-suitecrypto) | Encryption, secret sharing, ZK compression, shielded transfers, Arcium MPC, Noir proofs |
| [`@privacy-suite/orders`](#privacy-suiteorders) | Encrypt and decrypt swap order payloads for MEV protection |
| [`@umbra/fairscore-middleware`](#umbrafairscore-middleware) | Reputation-based fee tiers and access control via FairScale |
| [`@privacy-suite/qn-addon`](#privacy-suiteqn-addon) | QuickNode Marketplace REST Add-On wrapping Veil privacy primitives |

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

## `@privacy-suite/crypto`

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
} from '@privacy-suite/crypto';

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
} from '@privacy-suite/crypto';

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
} from '@privacy-suite/crypto';

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
} from '@privacy-suite/crypto';

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
} from '@privacy-suite/crypto';

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
} from '@privacy-suite/crypto';

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
} from '@privacy-suite/crypto';

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
} from '@privacy-suite/crypto';

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

## `@privacy-suite/orders`

Order encryption utilities for Privacy Suite. Wraps `@privacy-suite/crypto` to provide a high-level API for encrypting swap orders that solvers can decrypt but MEV searchers cannot.

### Quick Start

```typescript
import {
  createEncryptedOrder,
  decryptOrderPayload,
  generateEncryptionKeypair,
} from '@privacy-suite/orders';
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
} from '@privacy-suite/orders';

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

## `@umbra/fairscore-middleware`

FairScale FairScore integration for Umbra. Provides reputation-based fee tiers, access control, and on-chain proof verification.

### Tier System

| FairScore | Tier | Fee | MEV Protection | Order Types | Derivatives | Max Order |
|-----------|------|-----|----------------|-------------|-------------|-----------|
| 0-19 | None | 0.50% | None | Market | None | $10k |
| 20-39 | Bronze | 0.30% | Basic (delayed reveal) | + Limit | None | $50k |
| 40-59 | Silver | 0.15% | Full (encryption) | + TWAP | Perpetuals | $250k |
| 60-79 | Gold | 0.08% | Full + Priority | + Iceberg | + Variance | Unlimited |
| 80-100 | Diamond | 0.05% | Priority routing | + Dark pool | + Exotic | Unlimited |

### FairScoreClient

```typescript
import { FairScoreClient, createFairScoreClient } from '@umbra/fairscore-middleware';

const client = createFairScoreClient({
  apiKey: 'YOUR_FAIRSCALE_API_KEY',
  baseUrl: 'https://api.fairscale.xyz',  // optional, this is the default
  cacheTtlMs: 5 * 60 * 1000,             // optional, default 5 minutes
});

// Fetch a wallet's score
const score = await client.getFairScore('7xKX...');
console.log(score.score);       // 72
console.log(score.tier);        // 3 (Gold)
console.log(score.components);
// {
//   transaction_history: 15,
//   defi_activity: 20,
//   nft_holdings: 12,
//   governance_participation: 10,
//   account_age: 15,
// }

// Get tier benefits directly
const benefits = await client.getTierBenefits('7xKX...');
console.log(benefits.feeBps);        // 8
console.log(benefits.tierName);      // "Gold"
console.log(benefits.orderTypes);    // ["market", "limit", "twap", "iceberg"]
console.log(benefits.maxOrderSize);  // null (unlimited)

// Check minimum tier requirement
const allowed = await client.meetsMinimumTier('7xKX...', 2); // Silver or above?

// Get fee for a specific wallet
const feeBps = await client.getFeeBps('7xKX...'); // 8

// Batch fetch for multiple wallets
const scores = await client.getBatchFairScores([wallet1, wallet2, wallet3]);

// Cache management
client.clearCache();
client.clearCacheForWallet('7xKX...');
```

### TierCalculator

Static utility for calculating tiers and benefits without API calls. Useful for on-chain logic or when you already have the score.

```typescript
import { TierCalculator, TierLevel } from '@umbra/fairscore-middleware';

// Get tier from score
const tier = TierCalculator.getTierFromScore(72); // TierLevel.Gold

// Get full benefits
const benefits = TierCalculator.getBenefitsFromScore(72);

// Individual checks
TierCalculator.getFeeBps(72);                              // 8
TierCalculator.getMevProtection(72);                       // MevProtectionLevel.Priority
TierCalculator.isOrderTypeAllowed(72, OrderType.Iceberg);  // true
TierCalculator.isOrderTypeAllowed(72, OrderType.Dark);     // false (requires Diamond)
TierCalculator.isDerivativeAllowed(72, DerivativeType.Perpetuals); // true
TierCalculator.isOrderSizeAllowed(72, 500_000);            // true (Gold = unlimited)

// Calculate fee amount
const fee = TierCalculator.calculateFee(72, 1_000_000_000n); // 800_000n (0.08%)

// Export tier config for on-chain storage
const onChainTiers = TierCalculator.toOnChainFormat();
// Returns TierDefinition[] with bitmask-encoded order types and derivatives
```

### Proof Verification

Create and verify FairScore proofs for on-chain submission.

```typescript
import {
  verifyFairScoreProof,
  createProofMessage,
} from '@umbra/fairscore-middleware';

// Create a proof via the client
const proof = await client.createProof('7xKX...');
// proof.wallet, proof.score, proof.tier, proof.timestamp, proof.signature, proof.message

// Verify the proof (checks age, format, score-tier consistency)
const result = verifyFairScoreProof(proof);
if (!result.valid) {
  console.error(result.error);
}

// Custom max age (default is 10 minutes)
const result2 = verifyFairScoreProof(proof, 5 * 60 * 1000); // 5 minutes

// Prepare proof data for on-chain instruction
import { prepareProofForOnChain } from '@umbra/fairscore-middleware';
const onChainData = prepareProofForOnChain(proof);
// { wallet: Uint8Array, score, tier, timestamp: bigint, signature: Uint8Array }
```

### Types Reference

```typescript
enum TierLevel { None = 0, Bronze = 1, Silver = 2, Gold = 3, Diamond = 4 }
enum MevProtectionLevel { None = 0, Basic = 1, Full = 2, Priority = 3 }
enum OrderType { Market = 'market', Limit = 'limit', Twap = 'twap', Iceberg = 'iceberg', Dark = 'dark' }
enum DerivativeType { Perpetuals = 'perpetuals', Variance = 'variance', Exotic = 'exotic' }

interface FairScoreConfig {
  apiKey: string;
  baseUrl?: string;      // default: https://api.fairscale.xyz
  cacheTtlMs?: number;   // default: 300000 (5 min)
}

interface FairScoreResponse {
  wallet: string;
  score: number;          // 0-100
  tier: number;           // 0-4
  components: {
    transaction_history: number;
    defi_activity: number;
    nft_holdings: number;
    governance_participation: number;
    account_age: number;
  };
  last_updated: string;
  signature: string;
}

interface FairScoreProof {
  wallet: string;
  score: number;
  tier: number;
  timestamp: number;
  signature: Uint8Array;
  message: Uint8Array;     // "fairscore:{wallet}:{score}:{tier}:{timestamp}"
}

interface TierBenefits {
  tier: TierLevel;
  tierName: string;
  feeBps: number;
  mevProtection: MevProtectionLevel;
  orderTypes: OrderType[];
  derivativesAccess: DerivativeType[];
  maxOrderSize: number | null;  // null = unlimited
}
```

---

## `@privacy-suite/qn-addon`

QuickNode Marketplace REST Add-On that wraps all Veil privacy primitives as a JSON API. Install it on any QuickNode Solana endpoint to access NaCl encryption, Shamir secret sharing, order encryption, ZK compression estimation, and reputation tiers over HTTP.

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

#### Tiers (Reputation)

```bash
# Look up tier benefits for a FairScore value (0-100)
curl http://localhost:3030/v1/tiers/72
# {"success":true,"score":72,"tier":3,"tierName":"Gold","feeBps":8,"mevProtection":3,"orderTypes":["market","limit","twap","iceberg"],...}
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

# Run all tests (33 tests across 14 suites)
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
| POST | `/v1/threshold/split` | Shamir split secret | None |
| POST | `/v1/threshold/combine` | Shamir combine shares | None |
| POST | `/v1/orders/encrypt` | Encrypt swap order | None |
| POST | `/v1/orders/decrypt` | Decrypt swap order | None |
| POST | `/v1/payload/serialize` | Serialize structured data | None |
| POST | `/v1/payload/deserialize` | Deserialize structured data | None |
| GET | `/v1/compression/estimate` | Estimate ZK compression savings | None |
| POST | `/v1/compression/compress` | Compress data via Light Protocol | X-INSTANCE-ID |
| POST | `/v1/compression/decompress` | Decompress data via Light Protocol | X-INSTANCE-ID |
| GET | `/v1/tiers/:score` | Look up tier benefits | None |

---

## Dependencies

| Package | Key Dependencies |
|---------|-----------------|
| `@privacy-suite/crypto` | `@solana/web3.js`, `tweetnacl`, `@lightprotocol/stateless.js`, `@lightprotocol/compressed-token`, `privacycash`, `bn.js` |
| `@privacy-suite/orders` | `@privacy-suite/crypto`, `bn.js` |
| `@umbra/fairscore-middleware` | `@solana/web3.js`, `bs58` |
| `@privacy-suite/qn-addon` | `@privacy-suite/crypto`, `@privacy-suite/orders`, `@umbra/fairscore-middleware`, `express`, `better-sqlite3`, `morgan`, `express-rate-limit`, `bn.js` |

## License

MIT
