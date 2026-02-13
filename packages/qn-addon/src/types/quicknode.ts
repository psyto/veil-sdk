export interface ProvisionRequest {
  'quicknode-id': string;
  'endpoint-id': string;
  plan: string;
  'wss-url'?: string;
  'http-url'?: string;
  chain?: string;
  network?: string;
}

export interface UpdateRequest {
  'quicknode-id': string;
  'endpoint-id': string;
  plan: string;
  'wss-url'?: string;
  'http-url'?: string;
  chain?: string;
  network?: string;
}

export interface DeactivateRequest {
  'quicknode-id': string;
  'endpoint-id': string;
}

export interface DeprovisionRequest {
  'quicknode-id': string;
}

export interface QnHeaders {
  'x-quicknode-id'?: string;
  'x-instance-id'?: string;
  'x-qn-chain'?: string;
  'x-qn-network'?: string;
}

export interface Instance {
  id: number;
  quicknode_id: string;
  endpoint_id: string;
  plan: string;
  wss_url: string | null;
  http_url: string | null;
  chain: string | null;
  network: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface QnResponse {
  status: 'success' | 'error';
  message?: string;
}
