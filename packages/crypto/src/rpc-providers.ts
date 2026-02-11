/**
 * RPC Provider Configuration
 *
 * Utilities for connecting to supported RPC providers that enable
 * ZK compression and other privacy features.
 *
 * Supported Providers:
 * - Helius: High-performance RPC with ZK compression support
 * - Quicknode: Enterprise-grade RPC infrastructure
 *
 * @see https://helius.dev/
 * @see https://www.quicknode.com/
 */

import { Connection } from '@solana/web3.js';
import { Rpc, createRpc } from '@lightprotocol/stateless.js';

/**
 * Supported RPC providers
 */
export type RpcProvider = 'helius' | 'quicknode' | 'custom';

/**
 * Network configuration
 */
export type Network = 'mainnet-beta' | 'devnet' | 'testnet';

/**
 * RPC provider configuration
 */
export interface RpcProviderConfig {
  /** The RPC provider to use */
  provider: RpcProvider;
  /** API key (required for Helius and Quicknode) */
  apiKey?: string;
  /** Custom endpoint URL (required for 'custom' provider) */
  customEndpoint?: string;
  /** Network to connect to */
  network: Network;
  /** Enable ZK compression support */
  enableZkCompression?: boolean;
}

/**
 * RPC connection result
 */
export interface RpcConnections {
  /** Standard Solana connection */
  connection: Connection;
  /** Light Protocol RPC (for ZK compression, if enabled) */
  zkRpc?: Rpc;
  /** Provider name for attribution */
  providerName: string;
  /** Provider website for attribution */
  providerUrl: string;
}

/**
 * Get the Helius RPC endpoint URL
 */
function getHeliusEndpoint(apiKey: string, network: Network): string {
  const networkSlug = network === 'mainnet-beta' ? 'mainnet' : network;
  return `https://${networkSlug}.helius-rpc.com/?api-key=${apiKey}`;
}

/**
 * Get the Quicknode RPC endpoint URL
 *
 * Note: Quicknode requires a custom endpoint URL from their dashboard
 */
function getQuicknodeEndpoint(customEndpoint: string): string {
  // Quicknode endpoints are fully custom, provided in config
  return customEndpoint;
}

/**
 * Create RPC connections for the specified provider
 *
 * @param config - RPC provider configuration
 * @returns RPC connections object
 *
 * @example
 * ```typescript
 * // Using Helius
 * const { connection, zkRpc } = createRpcConnections({
 *   provider: 'helius',
 *   apiKey: 'YOUR_HELIUS_API_KEY',
 *   network: 'devnet',
 *   enableZkCompression: true,
 * });
 *
 * // Using Quicknode
 * const { connection } = createRpcConnections({
 *   provider: 'quicknode',
 *   customEndpoint: 'https://your-quicknode-endpoint.solana-devnet.quiknode.pro/YOUR_KEY/',
 *   network: 'devnet',
 * });
 * ```
 */
export function createRpcConnections(config: RpcProviderConfig): RpcConnections {
  let endpoint: string;
  let providerName: string;
  let providerUrl: string;

  switch (config.provider) {
    case 'helius':
      if (!config.apiKey) {
        throw new Error('Helius requires an API key');
      }
      endpoint = getHeliusEndpoint(config.apiKey, config.network);
      providerName = 'Helius';
      providerUrl = 'https://helius.dev/';
      break;

    case 'quicknode':
      if (!config.customEndpoint) {
        throw new Error('Quicknode requires a custom endpoint URL');
      }
      endpoint = getQuicknodeEndpoint(config.customEndpoint);
      providerName = 'Quicknode';
      providerUrl = 'https://www.quicknode.com/';
      break;

    case 'custom':
      if (!config.customEndpoint) {
        throw new Error('Custom provider requires an endpoint URL');
      }
      endpoint = config.customEndpoint;
      providerName = 'Custom';
      providerUrl = '';
      break;

    default:
      throw new Error(`Unknown RPC provider: ${config.provider}`);
  }

  // Create standard Solana connection
  const connection = new Connection(endpoint, 'confirmed');

  // Create ZK RPC if enabled
  let zkRpc: Rpc | undefined;
  if (config.enableZkCompression) {
    // For Helius, the same endpoint supports ZK compression
    // For other providers, they may need separate endpoints
    zkRpc = createRpc(endpoint, endpoint, endpoint);
  }

  return {
    connection,
    zkRpc,
    providerName,
    providerUrl,
  };
}

/**
 * Create a Helius-connected RPC (convenience function)
 *
 * @param apiKey - Helius API key
 * @param network - Network to connect to
 * @param enableZkCompression - Enable ZK compression support
 * @returns RPC connections
 */
export function createHeliusRpc(
  apiKey: string,
  network: Network = 'devnet',
  enableZkCompression: boolean = true
): RpcConnections {
  return createRpcConnections({
    provider: 'helius',
    apiKey,
    network,
    enableZkCompression,
  });
}

/**
 * Create a Quicknode-connected RPC (convenience function)
 *
 * @param endpoint - Quicknode endpoint URL
 * @param network - Network (for reference)
 * @returns RPC connections
 */
export function createQuicknodeRpc(
  endpoint: string,
  network: Network = 'devnet'
): RpcConnections {
  return createRpcConnections({
    provider: 'quicknode',
    customEndpoint: endpoint,
    network,
    enableZkCompression: false, // Quicknode ZK support may vary
  });
}

/**
 * Environment variable names for RPC configuration
 */
export const RPC_ENV_VARS = {
  /** Helius API key */
  HELIUS_API_KEY: 'HELIUS_API_KEY',
  /** Quicknode endpoint URL */
  QUICKNODE_ENDPOINT: 'QUICKNODE_ENDPOINT',
  /** Generic RPC URL (fallback) */
  RPC_URL: 'RPC_URL',
  /** Network selection */
  SOLANA_NETWORK: 'SOLANA_NETWORK',
} as const;

/**
 * Create RPC connections from environment variables
 *
 * Checks for Helius first, then Quicknode, then falls back to generic RPC_URL.
 *
 * @returns RPC connections or null if no configuration found
 */
export function createRpcFromEnv(): RpcConnections | null {
  const heliusKey = process.env[RPC_ENV_VARS.HELIUS_API_KEY];
  const quicknodeEndpoint = process.env[RPC_ENV_VARS.QUICKNODE_ENDPOINT];
  const rpcUrl = process.env[RPC_ENV_VARS.RPC_URL];
  const networkEnv = process.env[RPC_ENV_VARS.SOLANA_NETWORK];

  const network: Network = (networkEnv as Network) || 'devnet';

  // Prefer Helius if API key is provided
  if (heliusKey) {
    return createHeliusRpc(heliusKey, network, true);
  }

  // Then try Quicknode
  if (quicknodeEndpoint) {
    return createQuicknodeRpc(quicknodeEndpoint, network);
  }

  // Fall back to generic RPC URL
  if (rpcUrl) {
    return createRpcConnections({
      provider: 'custom',
      customEndpoint: rpcUrl,
      network,
      enableZkCompression: false,
    });
  }

  return null;
}

/**
 * Get attribution string for the current RPC provider
 *
 * Use this in your app's footer or about page to attribute the RPC provider.
 *
 * @param connections - RPC connections object
 * @returns Attribution string
 */
export function getRpcAttribution(connections: RpcConnections): string {
  if (!connections.providerName || connections.providerName === 'Custom') {
    return '';
  }

  return `Powered by ${connections.providerName}`;
}

/**
 * Default public RPC endpoints (for testing only, not for production)
 */
export const PUBLIC_RPC_ENDPOINTS = {
  'mainnet-beta': 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
} as const;

/**
 * Create a connection using public RPC (for testing only)
 *
 * WARNING: Public RPCs have rate limits and should not be used in production.
 *
 * @param network - Network to connect to
 * @returns Solana connection
 */
export function createPublicRpc(network: Network = 'devnet'): Connection {
  console.warn('Using public RPC - not recommended for production');
  return new Connection(PUBLIC_RPC_ENDPOINTS[network], 'confirmed');
}
