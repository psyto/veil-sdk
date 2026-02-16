import BN from 'bn.js';
import {
  calculateSchemaSize,
  serializePayload,
  deserializePayload,
  SWAP_ORDER_SCHEMA,
  RWA_ASSET_SCHEMA,
  RWA_ACCESS_GRANT_SCHEMA,
} from '../src/payload';

describe('payload', () => {
  // ── calculateSchemaSize ─────────────────────────────────────────────

  describe('calculateSchemaSize', () => {
    it('SWAP_ORDER_SCHEMA is 24 bytes', () => {
      // u64(8) + u16(2) + i64(8) + bytes(6) = 24
      expect(calculateSchemaSize(SWAP_ORDER_SCHEMA)).toBe(24);
    });

    it('RWA_ASSET_SCHEMA is 37 bytes', () => {
      // u8(1) + u64(8) + u8(1) + u8(1) + u8(1) + u32(4) + i64(8) + i64(8) + bytes(3) + bytes(2) = 37
      expect(calculateSchemaSize(RWA_ASSET_SCHEMA)).toBe(37);
    });

    it('RWA_ACCESS_GRANT_SCHEMA is 26 bytes', () => {
      // u8(1) + i64(8) + i64(8) + u8(1) + i64(8) = 26
      expect(calculateSchemaSize(RWA_ACCESS_GRANT_SCHEMA)).toBe(26);
    });
  });

  // ── serializePayload / deserializePayload roundtrip ─────────────────

  describe('serializePayload / deserializePayload', () => {
    it('roundtrip for SWAP_ORDER_SCHEMA with BN minOutputAmount', () => {
      const data = {
        minOutputAmount: new BN('1000000000'),
        slippageBps: 50,
        deadline: 1700000000,
        padding: new Uint8Array(6),
      };
      const serialized = serializePayload(data, SWAP_ORDER_SCHEMA);
      const deserialized = deserializePayload(serialized, SWAP_ORDER_SCHEMA);

      expect(deserialized.minOutputAmount).toBeInstanceOf(BN);
      expect((deserialized.minOutputAmount as BN).toString()).toBe('1000000000');
      expect(deserialized.slippageBps).toBe(50);
      expect(deserialized.deadline).toBe(1700000000);
    });

    it('output length matches schema size for SWAP_ORDER_SCHEMA', () => {
      const data = {
        minOutputAmount: new BN('500'),
        slippageBps: 100,
        deadline: 0,
        padding: new Uint8Array(6),
      };
      const serialized = serializePayload(data, SWAP_ORDER_SCHEMA);
      expect(serialized.length).toBe(calculateSchemaSize(SWAP_ORDER_SCHEMA));
    });

    it('roundtrip for RWA_ASSET_SCHEMA', () => {
      const data = {
        assetType: 1,
        valuationAmount: new BN('5000000'),
        valuationCurrency: 2,
        ownerCount: 3,
        encumbered: 0,
        complianceFlags: 0x0f,
        issuanceDate: 1690000000,
        expirationDate: 1700000000,
        jurisdiction: new Uint8Array([85, 83, 0]), // "US\0"
        padding: new Uint8Array(2),
      };
      const serialized = serializePayload(data, RWA_ASSET_SCHEMA);
      expect(serialized.length).toBe(calculateSchemaSize(RWA_ASSET_SCHEMA));

      const deserialized = deserializePayload(serialized, RWA_ASSET_SCHEMA);
      expect(deserialized.assetType).toBe(1);
      expect((deserialized.valuationAmount as BN).toString()).toBe('5000000');
      expect(deserialized.valuationCurrency).toBe(2);
      expect(deserialized.ownerCount).toBe(3);
      expect(deserialized.encumbered).toBe(0);
      expect(deserialized.complianceFlags).toBe(0x0f);
    });

    it('u16 is little-endian', () => {
      const data = {
        minOutputAmount: new BN(0),
        slippageBps: 0x0102, // 258
        deadline: 0,
        padding: new Uint8Array(6),
      };
      const serialized = serializePayload(data, SWAP_ORDER_SCHEMA);
      // slippageBps is at offset 8 (after u64), LE: [0x02, 0x01]
      expect(serialized[8]).toBe(0x02);
      expect(serialized[9]).toBe(0x01);
    });

    it('u32 is little-endian', () => {
      const data = {
        assetType: 0,
        valuationAmount: new BN(0),
        valuationCurrency: 0,
        ownerCount: 0,
        encumbered: 0,
        complianceFlags: 0x01020304,
        issuanceDate: 0,
        expirationDate: 0,
        jurisdiction: new Uint8Array(3),
        padding: new Uint8Array(2),
      };
      const serialized = serializePayload(data, RWA_ASSET_SCHEMA);
      // complianceFlags at offset: u8(1)+u64(8)+u8(1)+u8(1)+u8(1) = 12
      expect(serialized[12]).toBe(0x04);
      expect(serialized[13]).toBe(0x03);
      expect(serialized[14]).toBe(0x02);
      expect(serialized[15]).toBe(0x01);
    });

    it('u64 field deserializes as BN', () => {
      const data = {
        minOutputAmount: new BN('18446744073709551615'), // max u64
        slippageBps: 0,
        deadline: 0,
        padding: new Uint8Array(6),
      };
      const serialized = serializePayload(data, SWAP_ORDER_SCHEMA);
      const deserialized = deserializePayload(serialized, SWAP_ORDER_SCHEMA);
      expect(deserialized.minOutputAmount).toBeInstanceOf(BN);
      expect((deserialized.minOutputAmount as BN).toString()).toBe('18446744073709551615');
    });
  });
});
