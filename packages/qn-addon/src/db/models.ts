import { getDb } from './database';
import { Instance } from '../types/quicknode';

export function createInstance(data: {
  quicknode_id: string;
  endpoint_id: string;
  plan: string;
  wss_url?: string;
  http_url?: string;
  chain?: string;
  network?: string;
}): Instance {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO instances (quicknode_id, endpoint_id, plan, wss_url, http_url, chain, network)
    VALUES (@quicknode_id, @endpoint_id, @plan, @wss_url, @http_url, @chain, @network)
  `);
  stmt.run({
    quicknode_id: data.quicknode_id,
    endpoint_id: data.endpoint_id,
    plan: data.plan,
    wss_url: data.wss_url || null,
    http_url: data.http_url || null,
    chain: data.chain || null,
    network: data.network || null,
  });
  return getInstanceByEndpointId(data.endpoint_id)!;
}

export function getInstanceByEndpointId(endpointId: string): Instance | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM instances WHERE endpoint_id = ?').get(endpointId) as Instance | undefined;
}

export function getActiveInstanceByEndpointId(endpointId: string): Instance | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM instances WHERE endpoint_id = ? AND active = 1').get(endpointId) as Instance | undefined;
}

export function updateInstance(endpointId: string, data: {
  plan?: string;
  wss_url?: string;
  http_url?: string;
  chain?: string;
  network?: string;
}): Instance | undefined {
  const db = getDb();
  const existing = getInstanceByEndpointId(endpointId);
  if (!existing) return undefined;

  const stmt = db.prepare(`
    UPDATE instances
    SET plan = @plan, wss_url = @wss_url, http_url = @http_url,
        chain = @chain, network = @network, active = 1,
        updated_at = datetime('now')
    WHERE endpoint_id = @endpoint_id
  `);
  stmt.run({
    endpoint_id: endpointId,
    plan: data.plan ?? existing.plan,
    wss_url: data.wss_url ?? existing.wss_url,
    http_url: data.http_url ?? existing.http_url,
    chain: data.chain ?? existing.chain,
    network: data.network ?? existing.network,
  });
  return getInstanceByEndpointId(endpointId);
}

export function deactivateInstance(endpointId: string): boolean {
  const db = getDb();
  const result = db.prepare(`
    UPDATE instances SET active = 0, updated_at = datetime('now')
    WHERE endpoint_id = ?
  `).run(endpointId);
  return result.changes > 0;
}

export function deprovisionByQuicknodeId(quicknodeId: string): number {
  const db = getDb();
  const result = db.prepare('DELETE FROM instances WHERE quicknode_id = ?').run(quicknodeId);
  return result.changes;
}
