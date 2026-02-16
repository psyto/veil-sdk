import { config } from './config';
import { initDb, closeDb } from './db/database';
import { createApp } from './app';
import http from 'http';

// Refuse to start with default credentials in production
if (process.env.NODE_ENV === 'production') {
  if (!process.env.QN_BASIC_AUTH_PASSWORD || process.env.QN_BASIC_AUTH_PASSWORD === 'changeme') {
    console.error('FATAL: QN_BASIC_AUTH_PASSWORD must be set to a secure value in production.');
    process.exit(1);
  }
  if (!process.env.QN_BASIC_AUTH_USERNAME || process.env.QN_BASIC_AUTH_USERNAME === 'quicknode') {
    console.error('FATAL: QN_BASIC_AUTH_USERNAME must be set in production.');
    process.exit(1);
  }
}

initDb(config.dbPath);

const app = createApp();

const server: http.Server = app.listen(config.port, () => {
  console.log(`Veil QN Add-On running at http://localhost:${config.port}`);
  console.log(`Health check: http://localhost:${config.port}/healthcheck`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`DB path: ${config.dbPath}`);
});

// Graceful shutdown handler
function shutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    closeDb();
    console.log('Database connection closed.');
    process.exit(0);
  });

  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('Forced shutdown after timeout.');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
