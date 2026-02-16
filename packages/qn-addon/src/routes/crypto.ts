import { Router, Request, Response } from 'express';
import * as cryptoService from '../services/crypto-service';
import { decodeBase64 } from '../utils/validation';

const router = Router();

router.post('/v1/keypair/generate', (_req: Request, res: Response) => {
  try {
    const kp = cryptoService.generate();
    res.json({
      success: true,
      publicKey: {
        base64: Buffer.from(kp.publicKey).toString('base64'),
        hex: Buffer.from(kp.publicKey).toString('hex'),
      },
      secretKey: {
        base64: Buffer.from(kp.secretKey).toString('base64'),
        hex: Buffer.from(kp.secretKey).toString('hex'),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/v1/keypair/derive', (req: Request, res: Response) => {
  try {
    const { seed } = req.body;
    if (!seed || typeof seed !== 'string') {
      res.status(400).json({ success: false, error: 'seed is required (base64 string)' });
      return;
    }

    const seedBytes = decodeBase64(seed);
    if (!seedBytes) {
      res.status(400).json({ success: false, error: 'seed must be valid base64' });
      return;
    }
    if (seedBytes.length !== 32) {
      res.status(400).json({ success: false, error: 'seed must be exactly 32 bytes' });
      return;
    }

    const kp = cryptoService.derive(seedBytes);
    res.json({
      success: true,
      publicKey: {
        base64: Buffer.from(kp.publicKey).toString('base64'),
        hex: Buffer.from(kp.publicKey).toString('hex'),
      },
      secretKey: {
        base64: Buffer.from(kp.secretKey).toString('base64'),
        hex: Buffer.from(kp.secretKey).toString('hex'),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/v1/encrypt', (req: Request, res: Response) => {
  try {
    const { plaintext, recipientPublicKey, senderSecretKey, senderPublicKey } = req.body;

    if (!plaintext || !recipientPublicKey || !senderSecretKey || !senderPublicKey) {
      res.status(400).json({
        success: false,
        error: 'Required fields: plaintext, recipientPublicKey, senderSecretKey, senderPublicKey (all base64)',
      });
      return;
    }

    const plaintextBytes = decodeBase64(plaintext);
    const recipientPk = decodeBase64(recipientPublicKey);
    const senderSk = decodeBase64(senderSecretKey);
    const senderPk = decodeBase64(senderPublicKey);

    if (!plaintextBytes || !recipientPk || !senderSk || !senderPk) {
      res.status(400).json({ success: false, error: 'All fields must be valid base64' });
      return;
    }

    const result = cryptoService.encryptData(
      plaintextBytes,
      recipientPk,
      { publicKey: senderPk, secretKey: senderSk },
    );

    res.json({
      success: true,
      nonce: {
        base64: Buffer.from(result.nonce).toString('base64'),
        hex: Buffer.from(result.nonce).toString('hex'),
      },
      ciphertext: {
        base64: Buffer.from(result.ciphertext).toString('base64'),
        hex: Buffer.from(result.ciphertext).toString('hex'),
      },
      bytes: {
        base64: Buffer.from(result.bytes).toString('base64'),
        hex: Buffer.from(result.bytes).toString('hex'),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/v1/decrypt', (req: Request, res: Response) => {
  try {
    const { bytes, senderPublicKey, recipientSecretKey, recipientPublicKey } = req.body;

    if (!bytes || !senderPublicKey || !recipientSecretKey || !recipientPublicKey) {
      res.status(400).json({
        success: false,
        error: 'Required fields: bytes, senderPublicKey, recipientSecretKey, recipientPublicKey (all base64)',
      });
      return;
    }

    const bytesArr = decodeBase64(bytes);
    const senderPk = decodeBase64(senderPublicKey);
    const recipientSk = decodeBase64(recipientSecretKey);
    const recipientPk = decodeBase64(recipientPublicKey);

    if (!bytesArr || !senderPk || !recipientSk || !recipientPk) {
      res.status(400).json({ success: false, error: 'All fields must be valid base64' });
      return;
    }

    const result = cryptoService.decryptData(
      bytesArr,
      senderPk,
      { publicKey: recipientPk, secretKey: recipientSk },
    );

    res.json({
      success: true,
      plaintext: {
        base64: Buffer.from(result).toString('base64'),
        hex: Buffer.from(result).toString('hex'),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/v1/crypto/encrypt-multiple', (req: Request, res: Response) => {
  try {
    const { plaintext, recipientPublicKeys, senderSecretKey, senderPublicKey } = req.body;

    if (!plaintext || !Array.isArray(recipientPublicKeys) || !senderSecretKey || !senderPublicKey) {
      res.status(400).json({
        success: false,
        error: 'Required fields: plaintext (base64), recipientPublicKeys (array of base64), senderSecretKey, senderPublicKey (base64)',
      });
      return;
    }
    if (recipientPublicKeys.length === 0 || recipientPublicKeys.length > 50) {
      res.status(400).json({
        success: false,
        error: 'recipientPublicKeys must have 1-50 entries',
      });
      return;
    }

    const plaintextBytes = decodeBase64(plaintext);
    const senderSk = decodeBase64(senderSecretKey);
    const senderPk = decodeBase64(senderPublicKey);

    if (!plaintextBytes || !senderSk || !senderPk) {
      res.status(400).json({ success: false, error: 'plaintext, senderSecretKey, senderPublicKey must be valid base64' });
      return;
    }

    const recipientKeys: Uint8Array[] = [];
    for (const k of recipientPublicKeys) {
      const decoded = decodeBase64(k);
      if (!decoded) {
        res.status(400).json({ success: false, error: 'All recipientPublicKeys must be valid base64' });
        return;
      }
      recipientKeys.push(decoded);
    }

    const results = cryptoService.encryptMultiple(
      plaintextBytes,
      recipientKeys,
      { publicKey: senderPk, secretKey: senderSk },
    );

    const recipients: Record<string, any> = {};
    results.forEach((encrypted, keyHex) => {
      recipients[keyHex] = {
        nonce: {
          base64: Buffer.from(encrypted.nonce).toString('base64'),
          hex: Buffer.from(encrypted.nonce).toString('hex'),
        },
        ciphertext: {
          base64: Buffer.from(encrypted.ciphertext).toString('base64'),
          hex: Buffer.from(encrypted.ciphertext).toString('hex'),
        },
        bytes: {
          base64: Buffer.from(encrypted.bytes).toString('base64'),
          hex: Buffer.from(encrypted.bytes).toString('hex'),
        },
      };
    });

    res.json({ success: true, recipientCount: recipientPublicKeys.length, recipients });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/v1/crypto/validate', (req: Request, res: Response) => {
  try {
    const { bytes, minPlaintextSize, maxPlaintextSize } = req.body;

    if (!bytes || typeof bytes !== 'string') {
      res.status(400).json({ success: false, error: 'bytes is required (base64 string)' });
      return;
    }

    const bytesArray = decodeBase64(bytes);
    if (!bytesArray) {
      res.status(400).json({ success: false, error: 'bytes must be valid base64' });
      return;
    }

    const valid = cryptoService.validate(
      bytesArray,
      typeof minPlaintextSize === 'number' ? minPlaintextSize : undefined,
      typeof maxPlaintextSize === 'number' ? maxPlaintextSize : undefined,
    );

    res.json({ success: true, valid, byteLength: bytesArray.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/v1/crypto/key-convert', (req: Request, res: Response) => {
  try {
    const { publicKey, base58 } = req.body;

    if (!publicKey && !base58) {
      res.status(400).json({
        success: false,
        error: 'Provide either publicKey (base64) to convert to base58, or base58 to convert to bytes',
      });
      return;
    }

    if (publicKey) {
      const keyBytes = decodeBase64(publicKey);
      if (!keyBytes) {
        res.status(400).json({ success: false, error: 'publicKey must be valid base64' });
        return;
      }
      const b58 = cryptoService.keyToBase58(keyBytes);
      res.json({
        success: true,
        base58: b58,
        publicKey: {
          base64: Buffer.from(keyBytes).toString('base64'),
          hex: Buffer.from(keyBytes).toString('hex'),
        },
      });
    } else {
      const keyBytes = cryptoService.keyFromBase58(base58);
      res.json({
        success: true,
        base58,
        publicKey: {
          base64: Buffer.from(keyBytes).toString('base64'),
          hex: Buffer.from(keyBytes).toString('hex'),
        },
      });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
