import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import healthcheckRouter from './routes/healthcheck';
import provisionRouter from './routes/provision';
import cryptoRouter from './routes/crypto';
import thresholdRouter from './routes/threshold';
import ordersRouter from './routes/orders';
import payloadRouter from './routes/payload';
import compressionRouter from './routes/compression';
import tiersRouter from './routes/tiers';
import { errorHandler } from './middleware/error-handler';
import { apiLimiter, provisionLimiter } from './middleware/rate-limit';

export function createApp(): express.Application {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  // Request logging (skip in test environment)
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('short'));
  }

  // Root info endpoint
  app.get('/', (_req, res) => {
    res.json({
      name: 'Veil Privacy Suite — QuickNode Add-On',
      version: '0.1.0',
      endpoints: {
        healthcheck: 'GET /healthcheck',
        provision: 'POST /provision (Basic Auth)',
        update: 'PUT /update (Basic Auth)',
        deactivate: 'DELETE /deactivate_endpoint (Basic Auth)',
        deprovision: 'DELETE /deprovision (Basic Auth)',
        crypto: [
          'POST /v1/keypair/generate',
          'POST /v1/keypair/derive',
          'POST /v1/encrypt',
          'POST /v1/decrypt',
          'POST /v1/crypto/encrypt-multiple',
          'POST /v1/crypto/validate',
          'POST /v1/crypto/key-convert',
        ],
        threshold: [
          'POST /v1/threshold/split',
          'POST /v1/threshold/combine',
          'POST /v1/threshold/verify',
        ],
        orders: [
          'POST /v1/orders/encrypt',
          'POST /v1/orders/decrypt',
          'POST /v1/orders/validate',
        ],
        payload: [
          'POST /v1/payload/serialize',
          'POST /v1/payload/deserialize',
        ],
        compression: [
          'GET /v1/compression/estimate?size=N',
          'POST /v1/compression/compress',
          'POST /v1/compression/decompress',
        ],
        tiers: [
          'GET /v1/tiers/:score',
        ],
      },
    });
  });

  // Public endpoints (no auth, no rate limit)
  app.use(healthcheckRouter);

  // PUDD provisioning (Basic Auth — handled inside router)
  app.use(provisionLimiter, provisionRouter);

  // API endpoints with rate limiting (instance lookup applied inside routes that need it)
  app.use(apiLimiter);
  app.use(cryptoRouter);
  app.use(thresholdRouter);
  app.use(ordersRouter);
  app.use(payloadRouter);
  app.use(compressionRouter);
  app.use(tiersRouter);

  // Global error handler
  app.use(errorHandler);

  return app;
}
