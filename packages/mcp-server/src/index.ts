#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  generateEncryptionKeypair,
  deriveEncryptionKeypair,
  encrypt,
  decrypt,
  encryptForMultiple,
  validateEncryptedData,
  encryptionKeyToBase58,
  base58ToEncryptionKey,
  splitSecret,
  combineShares,
  verifyShares,
} from "@privacy-suite/crypto";
import {
  encryptOrderPayload,
  decryptOrderPayload,
} from "@privacy-suite/orders";
import BN from "bn.js";

// ── helpers ──────────────────────────────────────────────────────────

function fromBase64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, "base64"));
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function jsonContent(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function errorContent(message: string) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
    isError: true as const,
  };
}

// ── tool definitions ─────────────────────────────────────────────────

const TOOLS = [
  {
    name: "generate_keypair",
    description:
      "Generate a new random NaCl Box (Curve25519-XSalsa20-Poly1305) encryption keypair. Returns publicKey and secretKey as base64.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "derive_keypair",
    description:
      "Derive a deterministic NaCl Box keypair from a 32-byte seed (base64). Same seed always produces the same keypair.",
    inputSchema: {
      type: "object" as const,
      required: ["seed"],
      properties: {
        seed: { type: "string", description: "32-byte seed encoded as base64" },
      },
    },
  },
  {
    name: "encrypt",
    description:
      "Encrypt a message using NaCl Box (Curve25519-XSalsa20-Poly1305). Returns nonce, ciphertext, and combined bytes — all base64-encoded.",
    inputSchema: {
      type: "object" as const,
      required: ["message", "recipientPublicKey", "senderSecretKey", "senderPublicKey"],
      properties: {
        message: { type: "string", description: "Plaintext to encrypt (base64)" },
        recipientPublicKey: { type: "string", description: "Recipient's X25519 public key (base64)" },
        senderSecretKey: { type: "string", description: "Sender's secret key (base64)" },
        senderPublicKey: { type: "string", description: "Sender's public key (base64)" },
      },
    },
  },
  {
    name: "decrypt",
    description:
      "Decrypt NaCl Box ciphertext. Input is the combined nonce+ciphertext bytes (base64). Returns the decrypted plaintext as base64.",
    inputSchema: {
      type: "object" as const,
      required: ["encrypted", "senderPublicKey", "recipientSecretKey", "recipientPublicKey"],
      properties: {
        encrypted: { type: "string", description: "Combined nonce + ciphertext bytes (base64)" },
        senderPublicKey: { type: "string", description: "Sender's X25519 public key (base64)" },
        recipientSecretKey: { type: "string", description: "Recipient's secret key (base64)" },
        recipientPublicKey: { type: "string", description: "Recipient's public key (base64)" },
      },
    },
  },
  {
    name: "encrypt_multiple",
    description:
      "Encrypt the same message for multiple recipients. Each recipient gets a unique encrypted copy. Returns a map keyed by recipient public key (hex).",
    inputSchema: {
      type: "object" as const,
      required: ["message", "recipientPublicKeys", "senderSecretKey", "senderPublicKey"],
      properties: {
        message: { type: "string", description: "Plaintext to encrypt (base64)" },
        recipientPublicKeys: {
          type: "array",
          items: { type: "string" },
          description: "Array of recipient X25519 public keys (base64)",
        },
        senderSecretKey: { type: "string", description: "Sender's secret key (base64)" },
        senderPublicKey: { type: "string", description: "Sender's public key (base64)" },
      },
    },
  },
  {
    name: "validate_encrypted",
    description:
      "Validate that encrypted bytes have the correct NaCl Box structure (nonce + ciphertext) without decrypting. Useful as a pre-flight check.",
    inputSchema: {
      type: "object" as const,
      required: ["data"],
      properties: {
        data: { type: "string", description: "Encrypted bytes to validate (base64)" },
        minPlaintextSize: { type: "number", description: "Minimum expected plaintext size in bytes (default: 1)" },
        maxPlaintextSize: { type: "number", description: "Maximum expected plaintext size in bytes (default: 1024)" },
      },
    },
  },
  {
    name: "key_convert",
    description:
      "Convert an encryption public key between raw bytes (base64) and Solana base58 format. Provide either publicKey or base58 and get both formats back.",
    inputSchema: {
      type: "object" as const,
      properties: {
        publicKey: { type: "string", description: "Public key as base64 (will be converted to base58)" },
        base58: { type: "string", description: "Public key as Solana base58 (will be converted to raw bytes)" },
      },
    },
  },
  {
    name: "shamir_split",
    description:
      "Split a 32-byte secret into N shares using Shamir's Secret Sharing over a 256-bit prime field. Any M (threshold) shares can reconstruct the original.",
    inputSchema: {
      type: "object" as const,
      required: ["secret", "totalShares", "threshold"],
      properties: {
        secret: { type: "string", description: "32-byte secret to split (base64)" },
        totalShares: { type: "number", minimum: 2, maximum: 255, description: "Total shares to generate (N)" },
        threshold: { type: "number", minimum: 2, description: "Minimum shares needed to reconstruct (M, must be <= N)" },
      },
    },
  },
  {
    name: "shamir_combine",
    description:
      "Reconstruct a secret from Shamir threshold shares using Lagrange interpolation. Requires at least the threshold number of valid shares.",
    inputSchema: {
      type: "object" as const,
      required: ["shares"],
      properties: {
        shares: {
          type: "array",
          items: {
            type: "object",
            required: ["index", "value"],
            properties: {
              index: { type: "number", description: "Share index (1-based)" },
              value: { type: "string", description: "Share value (base64)" },
            },
          },
          minItems: 2,
          description: "Array of shares to combine",
        },
      },
    },
  },
  {
    name: "shamir_verify",
    description:
      "Verify that a set of Shamir shares are consistent by reconstructing with different subsets and checking they produce the same secret.",
    inputSchema: {
      type: "object" as const,
      required: ["shares", "threshold"],
      properties: {
        shares: {
          type: "array",
          items: {
            type: "object",
            required: ["index", "value"],
            properties: {
              index: { type: "number", description: "Share index (1-based)" },
              value: { type: "string", description: "Share value (base64)" },
            },
          },
          minItems: 2,
          description: "Array of shares to verify",
        },
        threshold: { type: "number", minimum: 2, description: "Expected threshold for these shares" },
      },
    },
  },
  {
    name: "encrypt_order",
    description:
      "Encrypt a DEX swap order payload (minOutputAmount, slippageBps, deadline) using NaCl Box. Protects order parameters from MEV bots.",
    inputSchema: {
      type: "object" as const,
      required: ["minOutputAmount", "slippageBps", "deadline", "solverPublicKey", "userSecretKey", "userPublicKey"],
      properties: {
        minOutputAmount: { type: "string", description: "Minimum output amount in lamports/smallest unit (string)" },
        slippageBps: { type: "number", description: "Slippage tolerance in basis points (e.g. 50 = 0.5%)" },
        deadline: { type: "number", description: "Order expiration as Unix timestamp in seconds" },
        solverPublicKey: { type: "string", description: "Solver's X25519 public key (base64)" },
        userSecretKey: { type: "string", description: "User's secret key (base64)" },
        userPublicKey: { type: "string", description: "User's public key (base64)" },
      },
    },
  },
  {
    name: "decrypt_order",
    description:
      "Decrypt an encrypted DEX swap order payload. Returns the original order fields: minOutputAmount, slippageBps, deadline.",
    inputSchema: {
      type: "object" as const,
      required: ["encrypted", "userPublicKey", "solverSecretKey", "solverPublicKey"],
      properties: {
        encrypted: { type: "string", description: "Combined nonce + ciphertext bytes (base64)" },
        userPublicKey: { type: "string", description: "User's X25519 public key (base64)" },
        solverSecretKey: { type: "string", description: "Solver's secret key (base64)" },
        solverPublicKey: { type: "string", description: "Solver's public key (base64)" },
      },
    },
  },
];

// ── tool handlers ────────────────────────────────────────────────────

type Args = Record<string, unknown>;

export function handleTool(name: string, args: Args) {
  switch (name) {
    case "generate_keypair": {
      const kp = generateEncryptionKeypair();
      return jsonContent({
        publicKey: toBase64(kp.publicKey),
        secretKey: toBase64(kp.secretKey),
      });
    }

    case "derive_keypair": {
      const kp = deriveEncryptionKeypair(fromBase64(args.seed as string));
      return jsonContent({
        publicKey: toBase64(kp.publicKey),
        secretKey: toBase64(kp.secretKey),
      });
    }

    case "encrypt": {
      const senderKeypair = {
        publicKey: fromBase64(args.senderPublicKey as string),
        secretKey: fromBase64(args.senderSecretKey as string),
      };
      const result = encrypt(
        fromBase64(args.message as string),
        fromBase64(args.recipientPublicKey as string),
        senderKeypair,
      );
      return jsonContent({
        nonce: toBase64(result.nonce),
        ciphertext: toBase64(result.ciphertext),
        bytes: toBase64(result.bytes),
      });
    }

    case "decrypt": {
      const recipientKeypair = {
        publicKey: fromBase64(args.recipientPublicKey as string),
        secretKey: fromBase64(args.recipientSecretKey as string),
      };
      const plaintext = decrypt(
        fromBase64(args.encrypted as string),
        fromBase64(args.senderPublicKey as string),
        recipientKeypair,
      );
      return jsonContent({ plaintext: toBase64(plaintext) });
    }

    case "encrypt_multiple": {
      const senderKeypair = {
        publicKey: fromBase64(args.senderPublicKey as string),
        secretKey: fromBase64(args.senderSecretKey as string),
      };
      const recipientKeys = (args.recipientPublicKeys as string[]).map(fromBase64);
      const resultMap = encryptForMultiple(
        fromBase64(args.message as string),
        recipientKeys,
        senderKeypair,
      );
      const recipients: Record<string, { nonce: string; ciphertext: string; bytes: string }> = {};
      for (const [hexKey, data] of resultMap.entries()) {
        recipients[hexKey] = {
          nonce: toBase64(data.nonce),
          ciphertext: toBase64(data.ciphertext),
          bytes: toBase64(data.bytes),
        };
      }
      return jsonContent({
        recipientCount: (args.recipientPublicKeys as string[]).length,
        recipients,
      });
    }

    case "validate_encrypted": {
      const bytes = fromBase64(args.data as string);
      const valid = validateEncryptedData(
        bytes,
        args.minPlaintextSize as number | undefined,
        args.maxPlaintextSize as number | undefined,
      );
      return jsonContent({ valid, byteLength: bytes.length });
    }

    case "key_convert": {
      if (args.publicKey) {
        const bytes = fromBase64(args.publicKey as string);
        const b58 = encryptionKeyToBase58(bytes);
        return jsonContent({ base58: b58, publicKey: toBase64(bytes) });
      } else if (args.base58) {
        const bytes = base58ToEncryptionKey(args.base58 as string);
        return jsonContent({ base58: args.base58, publicKey: toBase64(bytes) });
      }
      throw new Error("Provide either 'publicKey' (base64) or 'base58'");
    }

    case "shamir_split": {
      const shares = splitSecret(
        fromBase64(args.secret as string),
        args.threshold as number,
        args.totalShares as number,
      );
      return jsonContent({
        shares: shares.map((s) => ({ index: s.index, value: toBase64(s.value) })),
        threshold: args.threshold,
        totalShares: args.totalShares,
      });
    }

    case "shamir_combine": {
      const shares = (args.shares as Array<{ index: number; value: string }>).map((s) => ({
        index: s.index,
        value: fromBase64(s.value),
      }));
      const secret = combineShares(shares);
      return jsonContent({ secret: toBase64(secret) });
    }

    case "shamir_verify": {
      const shares = (args.shares as Array<{ index: number; value: string }>).map((s) => ({
        index: s.index,
        value: fromBase64(s.value),
      }));
      const valid = verifyShares(shares, args.threshold as number);
      return jsonContent({
        valid,
        sharesProvided: shares.length,
        threshold: args.threshold,
      });
    }

    case "encrypt_order": {
      const userKeypair = {
        publicKey: fromBase64(args.userPublicKey as string),
        secretKey: fromBase64(args.userSecretKey as string),
      };
      const payload = {
        minOutputAmount: new BN(args.minOutputAmount as string),
        slippageBps: args.slippageBps as number,
        deadline: args.deadline as number,
      };
      const result = encryptOrderPayload(
        payload,
        fromBase64(args.solverPublicKey as string),
        userKeypair,
      );
      return jsonContent({
        nonce: toBase64(result.nonce),
        ciphertext: toBase64(result.ciphertext),
        bytes: toBase64(result.bytes),
      });
    }

    case "decrypt_order": {
      const solverKeypair = {
        publicKey: fromBase64(args.solverPublicKey as string),
        secretKey: fromBase64(args.solverSecretKey as string),
      };
      const payload = decryptOrderPayload(
        fromBase64(args.encrypted as string),
        fromBase64(args.userPublicKey as string),
        solverKeypair,
      );
      return jsonContent({
        minOutputAmount: payload.minOutputAmount.toString(),
        slippageBps: payload.slippageBps,
        deadline: payload.deadline,
      });
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── server setup ─────────────────────────────────────────────────────

const server = new Server(
  { name: "veil-privacy-suite", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    return handleTool(name, (args ?? {}) as Args);
  } catch (e) {
    return errorContent(e instanceof Error ? e.message : String(e));
  }
});

// ── start ────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
