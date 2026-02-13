import { Router, Request, Response } from 'express';
import * as compressionService from '../services/compression-service';
import { instanceLookup } from '../middleware/instance-lookup';

const router = Router();

router.get('/v1/compression/estimate', (req: Request, res: Response) => {
  try {
    const size = parseInt(req.query.size as string, 10);
    if (isNaN(size) || size <= 0) {
      res.status(400).json({ success: false, error: 'size query parameter is required (positive integer)' });
      return;
    }

    const result = compressionService.estimate(size);
    res.json({
      success: true,
      dataSize: size,
      uncompressedCost: result.uncompressedCost.toString(),
      compressedCost: result.compressedCost.toString(),
      savings: result.savings.toString(),
      savingsPercent: result.savingsPercent,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/v1/compression/compress', instanceLookup, async (req: Request, res: Response) => {
  try {
    const { data, payerSecretKey } = req.body;

    if (!data || typeof data !== 'string') {
      res.status(400).json({ success: false, error: 'data is required (base64 string)' });
      return;
    }
    if (!payerSecretKey || typeof payerSecretKey !== 'string') {
      res.status(400).json({ success: false, error: 'payerSecretKey is required (base64 string)' });
      return;
    }

    const httpUrl = req.instance?.http_url;
    if (!httpUrl) {
      res.status(400).json({ success: false, error: 'No RPC URL configured for this instance. Provision with http-url.' });
      return;
    }

    const result = await compressionService.compress(
      httpUrl,
      new Uint8Array(Buffer.from(data, 'base64')),
      new Uint8Array(Buffer.from(payerSecretKey, 'base64')),
    );

    res.json({
      success: true,
      compressedData: Buffer.from(result.compressedData).toString('base64'),
      proof: Buffer.from(result.proof).toString('base64'),
      publicInputs: Buffer.from(result.publicInputs).toString('base64'),
      stateTreeRoot: Buffer.from(result.stateTreeRoot).toString('base64'),
      dataHash: Buffer.from(result.dataHash).toString('base64'),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/v1/compression/decompress', instanceLookup, async (req: Request, res: Response) => {
  try {
    const { compressedData, proof, publicInputs, stateTreeRoot, dataHash } = req.body;

    if (!compressedData || !proof || !publicInputs || !stateTreeRoot || !dataHash) {
      res.status(400).json({
        success: false,
        error: 'Required fields: compressedData, proof, publicInputs, stateTreeRoot, dataHash (all base64)',
      });
      return;
    }

    const httpUrl = req.instance?.http_url;
    if (!httpUrl) {
      res.status(400).json({ success: false, error: 'No RPC URL configured for this instance. Provision with http-url.' });
      return;
    }

    const result = await compressionService.decompress(httpUrl, {
      compressedData: new Uint8Array(Buffer.from(compressedData, 'base64')),
      proof: new Uint8Array(Buffer.from(proof, 'base64')),
      publicInputs: new Uint8Array(Buffer.from(publicInputs, 'base64')),
      stateTreeRoot: new Uint8Array(Buffer.from(stateTreeRoot, 'base64')),
      dataHash: new Uint8Array(Buffer.from(dataHash, 'base64')),
    });

    res.json({
      success: true,
      data: Buffer.from(result).toString('base64'),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
