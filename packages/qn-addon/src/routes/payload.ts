import { Router, Request, Response } from 'express';
import * as payloadService from '../services/payload-service';
import { decodeBase64 } from '../utils/validation';

const router = Router();

router.post('/v1/payload/serialize', (req: Request, res: Response) => {
  try {
    const { data, schema } = req.body;

    if (!data || typeof data !== 'object') {
      res.status(400).json({ success: false, error: 'data is required (object)' });
      return;
    }
    if (!schema) {
      res.status(400).json({
        success: false,
        error: `schema is required (one of: ${payloadService.getAvailableSchemas().join(', ')})`,
      });
      return;
    }

    const bytes = payloadService.serialize(data, schema);
    res.json({
      success: true,
      bytes: {
        base64: Buffer.from(bytes).toString('base64'),
        hex: Buffer.from(bytes).toString('hex'),
      },
      size: bytes.length,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/v1/payload/deserialize', (req: Request, res: Response) => {
  try {
    const { bytes, schema } = req.body;

    if (!bytes || typeof bytes !== 'string') {
      res.status(400).json({ success: false, error: 'bytes is required (base64 string)' });
      return;
    }
    if (!schema) {
      res.status(400).json({
        success: false,
        error: `schema is required (one of: ${payloadService.getAvailableSchemas().join(', ')})`,
      });
      return;
    }

    const bytesArray = decodeBase64(bytes);
    if (!bytesArray) {
      res.status(400).json({ success: false, error: 'bytes must be valid base64' });
      return;
    }

    const data = payloadService.deserialize(bytesArray, schema);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
