import { initMemoryDb, closeDb } from '../../src/db/database';
import { createApp } from '../../src/app';
import express from 'express';

let app: express.Application;

export function getTestApp(): express.Application {
  if (!app) {
    initMemoryDb();
    app = createApp();
  }
  return app;
}

export function resetTestDb(): void {
  closeDb();
  initMemoryDb();
  app = createApp();
}

export const AUTH_HEADER = 'Basic ' + Buffer.from('quicknode:changeme').toString('base64');
