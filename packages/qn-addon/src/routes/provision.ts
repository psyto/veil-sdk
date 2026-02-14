import { Router, Request, Response } from 'express';
import { basicAuth } from '../middleware/basic-auth';
import {
  createInstance,
  updateInstance,
  deactivateInstance,
  deprovisionByQuicknodeId,
  getInstanceByEndpointId,
} from '../db/models';
import { ProvisionRequest, UpdateRequest, DeactivateRequest, DeprovisionRequest } from '../types/quicknode';

const router = Router();

router.post('/provision', basicAuth, (req: Request, res: Response) => {
  try {
    const body = req.body as ProvisionRequest;
    const quicknodeId = body['quicknode-id'];
    const endpointId = body['endpoint-id'];

    if (!quicknodeId || !endpointId || !body.plan) {
      res.status(400).json({ status: 'error', message: 'Missing required fields: quicknode-id, endpoint-id, plan' });
      return;
    }

    const existing = getInstanceByEndpointId(endpointId);
    if (existing) {
      // Idempotent: update the existing instance instead of rejecting
      updateInstance(endpointId, {
        plan: body.plan,
        wss_url: body['wss-url'],
        http_url: body['http-url'],
        chain: body.chain,
        network: body.network,
      });
    } else {
      createInstance({
        quicknode_id: quicknodeId,
        endpoint_id: endpointId,
        plan: body.plan,
        wss_url: body['wss-url'],
        http_url: body['http-url'],
        chain: body.chain,
        network: body.network,
      });
    }

    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.put('/update', basicAuth, (req: Request, res: Response) => {
  try {
    const body = req.body as UpdateRequest;
    const endpointId = body['endpoint-id'];

    if (!endpointId) {
      res.status(400).json({ status: 'error', message: 'Missing required field: endpoint-id' });
      return;
    }

    const updated = updateInstance(endpointId, {
      plan: body.plan,
      wss_url: body['wss-url'],
      http_url: body['http-url'],
      chain: body.chain,
      network: body.network,
    });

    if (!updated) {
      res.status(404).json({ status: 'error', message: 'Instance not found' });
      return;
    }

    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.delete('/deactivate_endpoint', basicAuth, (req: Request, res: Response) => {
  try {
    const body = req.body as DeactivateRequest;
    const endpointId = body['endpoint-id'];

    if (!endpointId) {
      res.status(400).json({ status: 'error', message: 'Missing required field: endpoint-id' });
      return;
    }

    const deactivated = deactivateInstance(endpointId);
    if (!deactivated) {
      res.status(404).json({ status: 'error', message: 'Instance not found' });
      return;
    }

    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

router.delete('/deprovision', basicAuth, (req: Request, res: Response) => {
  try {
    const body = req.body as DeprovisionRequest;
    const quicknodeId = body['quicknode-id'];

    if (!quicknodeId) {
      res.status(400).json({ status: 'error', message: 'Missing required field: quicknode-id' });
      return;
    }

    deprovisionByQuicknodeId(quicknodeId);
    res.json({ status: 'success' });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

export default router;
