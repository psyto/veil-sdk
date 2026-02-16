import { Router, Request, Response } from 'express';
import * as thresholdService from '../services/threshold-service';
import { decodeBase64 } from '../utils/validation';

const router = Router();

router.post('/v1/threshold/split', (req: Request, res: Response) => {
  try {
    const { secret, threshold, totalShares } = req.body;

    if (!secret || typeof secret !== 'string') {
      res.status(400).json({ success: false, error: 'secret is required (base64 string, 32 bytes)' });
      return;
    }
    if (typeof threshold !== 'number' || threshold < 2) {
      res.status(400).json({ success: false, error: 'threshold must be a number >= 2' });
      return;
    }
    if (typeof totalShares !== 'number' || totalShares < threshold || totalShares > 255) {
      res.status(400).json({ success: false, error: 'totalShares must be a number >= threshold and <= 255' });
      return;
    }

    const secretBytes = decodeBase64(secret);
    if (!secretBytes) {
      res.status(400).json({ success: false, error: 'secret must be valid base64' });
      return;
    }
    if (secretBytes.length !== 32) {
      res.status(400).json({ success: false, error: 'secret must be exactly 32 bytes' });
      return;
    }

    const shares = thresholdService.split(secretBytes, threshold, totalShares);
    res.json({
      success: true,
      shares: shares.map((s) => ({
        index: s.index,
        value: Buffer.from(s.value).toString('base64'),
      })),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/v1/threshold/combine', (req: Request, res: Response) => {
  try {
    const { shares } = req.body;

    if (!Array.isArray(shares) || shares.length < 2) {
      res.status(400).json({ success: false, error: 'shares must be an array with at least 2 elements' });
      return;
    }

    const parsedShares = [];
    for (const s of shares) {
      if (typeof s.index !== 'number' || !s.value || typeof s.value !== 'string') {
        res.status(400).json({ success: false, error: 'Each share must have numeric index and base64 value' });
        return;
      }
      const valueBytes = decodeBase64(s.value);
      if (!valueBytes) {
        res.status(400).json({ success: false, error: 'Share value must be valid base64' });
        return;
      }
      parsedShares.push({ index: s.index, value: valueBytes });
    }

    const secret = thresholdService.combine(parsedShares);
    res.json({
      success: true,
      secret: {
        base64: Buffer.from(secret).toString('base64'),
        hex: Buffer.from(secret).toString('hex'),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/v1/threshold/verify', (req: Request, res: Response) => {
  try {
    const { shares, threshold } = req.body;

    if (!Array.isArray(shares) || shares.length < 2) {
      res.status(400).json({ success: false, error: 'shares must be an array with at least 2 elements' });
      return;
    }
    if (typeof threshold !== 'number' || threshold < 2) {
      res.status(400).json({ success: false, error: 'threshold must be a number >= 2' });
      return;
    }

    const parsedShares = [];
    for (const s of shares) {
      if (typeof s.index !== 'number' || !s.value || typeof s.value !== 'string') {
        res.status(400).json({ success: false, error: 'Each share must have numeric index and base64 value' });
        return;
      }
      const valueBytes = decodeBase64(s.value);
      if (!valueBytes) {
        res.status(400).json({ success: false, error: 'Share value must be valid base64' });
        return;
      }
      parsedShares.push({ index: s.index, value: valueBytes });
    }

    const valid = thresholdService.verify(parsedShares, threshold);
    res.json({ success: true, valid, sharesProvided: shares.length, threshold });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
