# veil-sdk

Reusable SDK primitives for [Veil](https://github.com/psyto/veil) privacy-focused DeFi infrastructure on Solana.

## Packages

### `@privacy-suite/crypto`

Shared encryption and privacy utilities:

- NaCl box encryption (Curve25519-XSalsa20-Poly1305)
- Shamir's Secret Sharing for threshold decryption
- ZK compression via Light Protocol
- Shielded transfers via Privacy Cash SDK
- RPC provider configuration (Helius, Quicknode)
- Noir ZK proofs (swap validity, range proofs, KYC compliance)

### `@privacy-suite/orders`

Order encryption utilities for Privacy Suite:

- Serialize, encrypt, and decrypt swap order payloads
- Depends on `@privacy-suite/crypto` for encryption primitives

### `@umbra/fairscore-middleware`

FairScore integration middleware for Umbra:

- Reputation score lookups and tier resolution
- Middleware for FairScore-aware order execution

## Getting Started

```bash
yarn install
yarn build
```

## License

MIT
