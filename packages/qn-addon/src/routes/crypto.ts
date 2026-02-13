import { Router, Request, Response } from 'express';
import * as cryptoService from '../services/crypto-service';

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

    const seedBytes = new Uint8Array(Buffer.from(seed, 'base64'));
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

    const result = cryptoService.encryptData(
      new Uint8Array(Buffer.from(plaintext, 'base64')),
      new Uint8Array(Buffer.from(recipientPublicKey, 'base64')),
      {
        publicKey: new Uint8Array(Buffer.from(senderPublicKey, 'base64')),
        secretKey: new Uint8Array(Buffer.from(senderSecretKey, 'base64')),
      },
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

    const result = cryptoService.decryptData(
      new Uint8Array(Buffer.from(bytes, 'base64')),
      new Uint8Array(Buffer.from(senderPublicKey, 'base64')),
      {
        publicKey: new Uint8Array(Buffer.from(recipientPublicKey, 'base64')),
        secretKey: new Uint8Array(Buffer.from(recipientSecretKey, 'base64')),
      },
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

export default router;
