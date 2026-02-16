import { Router, Request, Response } from 'express';
import * as ordersService from '../services/orders-service';
import { decodeBase64 } from '../utils/validation';

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

    const solverPk = decodeBase64(solverPublicKey);
    const userSk = decodeBase64(userSecretKey);
    const userPk = decodeBase64(userPublicKey);

    if (!solverPk || !userSk || !userPk) {
      res.status(400).json({ success: false, error: 'solverPublicKey, userSecretKey, userPublicKey must be valid base64' });
      return;
    }

    const result = ordersService.encryptOrder(
      { minOutputAmount: String(minOutputAmount), slippageBps, deadline },
      solverPk,
      { publicKey: userPk, secretKey: userSk },
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

    const bytesArr = decodeBase64(bytes);
    const userPk = decodeBase64(userPublicKey);
    const solverSk = decodeBase64(solverSecretKey);
    const solverPk = decodeBase64(solverPublicKey);

    if (!bytesArr || !userPk || !solverSk || !solverPk) {
      res.status(400).json({ success: false, error: 'All fields must be valid base64' });
      return;
    }

    const payload = ordersService.decryptOrder(
      bytesArr,
      userPk,
      { publicKey: solverPk, secretKey: solverSk },
    );

    res.json({
      success: true,
      payload,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/v1/orders/validate', (req: Request, res: Response) => {
  try {
    const { bytes } = req.body;

    if (!bytes || typeof bytes !== 'string') {
      res.status(400).json({ success: false, error: 'bytes is required (base64 string of encrypted order)' });
      return;
    }

    const bytesArray = decodeBase64(bytes);
    if (!bytesArray) {
      res.status(400).json({ success: false, error: 'bytes must be valid base64' });
      return;
    }

    const valid = ordersService.validateOrder(bytesArray);

    res.json({ success: true, valid, byteLength: bytesArray.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
