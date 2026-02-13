import { config } from './config';
import { initDb } from './db/database';
import { createApp } from './app';

initDb(config.dbPath);

const app = createApp();

app.listen(config.port, () => {
  console.log(`Veil QN Add-On running at http://localhost:${config.port}`);
  console.log(`Health check: http://localhost:${config.port}/healthcheck`);
});
