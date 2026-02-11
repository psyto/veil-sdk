import BN from 'bn.js';

/**
 * Generic payload field types
 */
export type FieldType = 'u8' | 'u16' | 'u32' | 'u64' | 'i64' | 'pubkey' | 'bytes';

/**
 * Field definition for payload schema
 */
export interface FieldDef {
  name: string;
  type: FieldType;
  size?: number; // For 'bytes' type
}

/**
 * Payload schema definition
 */
export interface PayloadSchema {
  fields: FieldDef[];
}

/**
 * Calculate total size of a schema
 */
export function calculateSchemaSize(schema: PayloadSchema): number {
  return schema.fields.reduce((total, field) => {
    switch (field.type) {
      case 'u8':
        return total + 1;
      case 'u16':
        return total + 2;
      case 'u32':
        return total + 4;
      case 'u64':
      case 'i64':
        return total + 8;
      case 'pubkey':
        return total + 32;
      case 'bytes':
        return total + (field.size || 0);
      default:
        return total;
    }
  }, 0);
}

/**
 * Serialize a payload object according to schema
 */
export function serializePayload(
  data: Record<string, any>,
  schema: PayloadSchema
): Uint8Array {
  const size = calculateSchemaSize(schema);
  const buffer = Buffer.alloc(size);
  let offset = 0;

  for (const field of schema.fields) {
    const value = data[field.name];

    switch (field.type) {
      case 'u8':
        buffer.writeUInt8(value, offset);
        offset += 1;
        break;

      case 'u16':
        buffer.writeUInt16LE(value, offset);
        offset += 2;
        break;

      case 'u32':
        buffer.writeUInt32LE(value, offset);
        offset += 4;
        break;

      case 'u64':
        const u64Value = value instanceof BN ? value : new BN(value);
        const u64Bytes = u64Value.toArrayLike(Buffer, 'le', 8);
        u64Bytes.copy(buffer, offset);
        offset += 8;
        break;

      case 'i64':
        const i64Low = value >>> 0;
        const i64High = Math.floor(value / 0x100000000);
        buffer.writeUInt32LE(i64Low, offset);
        buffer.writeInt32LE(i64High, offset + 4);
        offset += 8;
        break;

      case 'pubkey':
        const pubkeyBytes = Buffer.from(value instanceof Uint8Array ? value : value);
        pubkeyBytes.copy(buffer, offset, 0, 32);
        offset += 32;
        break;

      case 'bytes':
        const bytesValue = Buffer.from(value instanceof Uint8Array ? value : value);
        bytesValue.copy(buffer, offset, 0, field.size);
        offset += field.size || 0;
        break;
    }
  }

  return new Uint8Array(buffer);
}

/**
 * Deserialize a payload buffer according to schema
 */
export function deserializePayload(
  bytes: Uint8Array,
  schema: PayloadSchema
): Record<string, any> {
  const buffer = Buffer.from(bytes);
  const result: Record<string, any> = {};
  let offset = 0;

  for (const field of schema.fields) {
    switch (field.type) {
      case 'u8':
        result[field.name] = buffer.readUInt8(offset);
        offset += 1;
        break;

      case 'u16':
        result[field.name] = buffer.readUInt16LE(offset);
        offset += 2;
        break;

      case 'u32':
        result[field.name] = buffer.readUInt32LE(offset);
        offset += 4;
        break;

      case 'u64':
        const u64Bytes = buffer.slice(offset, offset + 8);
        result[field.name] = new BN(u64Bytes, 'le');
        offset += 8;
        break;

      case 'i64':
        const low = buffer.readUInt32LE(offset);
        const high = buffer.readInt32LE(offset + 4);
        result[field.name] = low + high * 0x100000000;
        offset += 8;
        break;

      case 'pubkey':
        result[field.name] = new Uint8Array(buffer.slice(offset, offset + 32));
        offset += 32;
        break;

      case 'bytes':
        const size = field.size || 0;
        result[field.name] = new Uint8Array(buffer.slice(offset, offset + size));
        offset += size;
        break;
    }
  }

  return result;
}

// ============ Predefined Schemas ============

/**
 * Schema for Confidential Swap Router order payload
 */
export const SWAP_ORDER_SCHEMA: PayloadSchema = {
  fields: [
    { name: 'minOutputAmount', type: 'u64' },
    { name: 'slippageBps', type: 'u16' },
    { name: 'deadline', type: 'i64' },
    { name: 'padding', type: 'bytes', size: 6 },
  ],
};

/**
 * Schema for RWA Secrets Service asset metadata
 */
export const RWA_ASSET_SCHEMA: PayloadSchema = {
  fields: [
    { name: 'assetType', type: 'u8' },
    { name: 'valuationAmount', type: 'u64' },
    { name: 'valuationCurrency', type: 'u8' },
    { name: 'ownerCount', type: 'u8' },
    { name: 'encumbered', type: 'u8' },
    { name: 'complianceFlags', type: 'u32' },
    { name: 'issuanceDate', type: 'i64' },
    { name: 'expirationDate', type: 'i64' },
    { name: 'jurisdiction', type: 'bytes', size: 3 },
    { name: 'padding', type: 'bytes', size: 2 },
  ],
};

/**
 * Schema for RWA access grant
 */
export const RWA_ACCESS_GRANT_SCHEMA: PayloadSchema = {
  fields: [
    { name: 'accessLevel', type: 'u8' },
    { name: 'grantedAt', type: 'i64' },
    { name: 'expiresAt', type: 'i64' },
    { name: 'canDelegate', type: 'u8' },
    { name: 'revokedAt', type: 'i64' },
  ],
};
