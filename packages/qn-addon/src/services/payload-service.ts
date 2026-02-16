import {
  serializePayload,
  deserializePayload,
  PayloadSchema,
  SWAP_ORDER_SCHEMA,
  RWA_ASSET_SCHEMA,
  RWA_ACCESS_GRANT_SCHEMA,
} from '@veil/crypto';

const NAMED_SCHEMAS: Record<string, PayloadSchema> = {
  SWAP_ORDER: SWAP_ORDER_SCHEMA,
  RWA_ASSET: RWA_ASSET_SCHEMA,
  RWA_ACCESS_GRANT: RWA_ACCESS_GRANT_SCHEMA,
};

export function resolveSchema(schema: string | PayloadSchema): PayloadSchema {
  if (typeof schema === 'string') {
    const named = NAMED_SCHEMAS[schema.toUpperCase()];
    if (!named) {
      throw new Error(`Unknown schema: ${schema}. Available: ${Object.keys(NAMED_SCHEMAS).join(', ')}`);
    }
    return named;
  }
  return schema;
}

export function serialize(data: Record<string, any>, schema: string | PayloadSchema): Uint8Array {
  const resolved = resolveSchema(schema);
  return serializePayload(data, resolved);
}

export function deserialize(bytes: Uint8Array, schema: string | PayloadSchema): Record<string, any> {
  const resolved = resolveSchema(schema);
  return deserializePayload(bytes, resolved);
}

export function getAvailableSchemas(): string[] {
  return Object.keys(NAMED_SCHEMAS);
}
