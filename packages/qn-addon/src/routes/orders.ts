import { Router, Request, Response } from 'express';
import * as ordersService from '../services/orders-service';

const router = Router();

router.post('/v1/orders/encrypt', (req: Request, res: Response) => {
  try {
    const { minOutputAmount, slippageBps, deadline, solverPublicKey, userSecretKey, userPublicKey } = req.body;

    if (!minOutputAmount || typeof slippageBps !== 'number' || typeof deadline !== 'number') {
      res.status(400).json({
        success: false,
        error: 'Required fields: minOutputAmount (string), slippageBps (number), deadline (number)',
      });
      return;
    }
    if (!solverPublicKey || !userSecretKey || !userPublicKey) {
      res.status(400).json({
        success: false,
        error: 'Required fields: solverPublicKey, userSecretKey, userPublicKey (all base64)',
      });
      return;
    }

    const result = ordersService.encryptOrder(
      { minOutputAmount: String(minOutputAmount), slippageBps, deadline },
      new Uint8Array(Buffer.from(solverPublicKey, 'base64')),
      {
        publicKey: new Uint8Array(Buffer.from(userPublicKey, 'base64')),
        secretKey: new Uint8Array(Buffer.from(userSecretKey, 'base64')),
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

router.post('/v1/orders/decrypt', (req: Request, res: Response) => {
  try {
    const { bytes, userPublicKey, solverSecretKey, solverPublicKey } = req.body;

    if (!bytes || !userPublicKey || !solverSecretKey || !solverPublicKey) {
      res.status(400).json({
        success: false,
        error: 'Required fields: bytes, userPublicKey, solverSecretKey, solverPublicKey (all base64)',
      });
      return;
    }

    const payload = ordersService.decryptOrder(
      new Uint8Array(Buffer.from(bytes, 'base64')),
      new Uint8Array(Buffer.from(userPublicKey, 'base64')),
      {
        publicKey: new Uint8Array(Buffer.from(solverPublicKey, 'base64')),
        secretKey: new Uint8Array(Buffer.from(solverSecretKey, 'base64')),
      },
    );

    res.json({
      success: true,
      payload,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
