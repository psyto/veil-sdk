export interface KeypairResponse {
  success: true;
  publicKey: { base64: string; hex: string };
  secretKey: { base64: string; hex: string };
}

export interface DeriveKeypairRequest {
  seed: string; // base64
}

export interface EncryptRequest {
  plaintext: string; // base64
  recipientPublicKey: string; // base64
  senderSecretKey: string; // base64
  senderPublicKey: string; // base64
}

export interface EncryptResponse {
  success: true;
  nonce: { base64: string; hex: string };
  ciphertext: { base64: string; hex: string };
  bytes: { base64: string; hex: string };
}

export interface DecryptRequest {
  bytes: string; // base64
  senderPublicKey: string; // base64
  recipientSecretKey: string; // base64
  recipientPublicKey: string; // base64
}

export interface DecryptResponse {
  success: true;
  plaintext: { base64: string; hex: string };
}

export interface ThresholdSplitRequest {
  secret: string; // base64 (32 bytes)
  threshold: number; // M
  totalShares: number; // N
}

export interface ShareJson {
  index: number;
  value: string; // base64
}

export interface ThresholdSplitResponse {
  success: true;
  shares: ShareJson[];
}

export interface ThresholdCombineRequest {
  shares: ShareJson[];
}

export interface ThresholdCombineResponse {
  success: true;
  secret: { base64: string; hex: string };
}

export interface OrderEncryptRequest {
  minOutputAmount: string;
  slippageBps: number;
  deadline: number;
  solverPublicKey: string; // base64
  userSecretKey: string; // base64
  userPublicKey: string; // base64
}

export interface OrderEncryptResponse {
  success: true;
  nonce: { base64: string; hex: string };
  ciphertext: { base64: string; hex: string };
  bytes: { base64: string; hex: string };
}

export interface OrderDecryptRequest {
  bytes: string; // base64
  userPublicKey: string; // base64
  solverSecretKey: string; // base64
  solverPublicKey: string; // base64
}

export interface OrderDecryptResponse {
  success: true;
  payload: {
    minOutputAmount: string;
    slippageBps: number;
    deadline: number;
  };
}

export interface PayloadSerializeRequest {
  data: Record<string, any>;
  schema: string; // schema name or inline schema
}

export interface PayloadSerializeResponse {
  success: true;
  bytes: { base64: string; hex: string };
  size: number;
}

export interface PayloadDeserializeRequest {
  bytes: string; // base64
  schema: string;
}

export interface PayloadDeserializeResponse {
  success: true;
  data: Record<string, any>;
}

export interface CompressionEstimateResponse {
  success: true;
  dataSize: number;
  uncompressedCost: string;
  compressedCost: string;
  savings: string;
  savingsPercent: number;
}

export interface CompressionCompressRequest {
  data: string; // base64
  payerSecretKey: string; // base64
}

export interface CompressionDecompressRequest {
  compressedData: string; // base64
  proof: string; // base64
  publicInputs: string; // base64
  stateTreeRoot: string; // base64
  dataHash: string; // base64
}

export interface ErrorResponse {
  success: false;
  error: string;
}
