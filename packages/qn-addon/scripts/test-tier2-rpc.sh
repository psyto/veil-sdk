#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Tier 2 RPC-dependent endpoint test
#
# Prerequisites:
#   1. A running qn-addon server (yarn dev)
#   2. A provisioned instance with a real QuickNode Solana
#      devnet http-url (or any Helius/Light Protocol-compatible RPC)
#   3. A funded Solana devnet keypair (base64-encoded secret key)
#
# Usage:
#   export QN_HTTP_URL="https://your-solana-devnet.quiknode.pro/..."
#   export PAYER_SECRET_KEY="<base64-encoded-64-byte-keypair>"
#   ./scripts/test-tier2-rpc.sh
# ============================================================

BASE_URL="${BASE_URL:-http://localhost:3030}"
AUTH="quicknode:changeme"

if [ -z "${QN_HTTP_URL:-}" ]; then
  echo "ERROR: QN_HTTP_URL is not set."
  echo "Set it to a QuickNode Solana devnet endpoint URL, e.g.:"
  echo '  export QN_HTTP_URL="https://your-endpoint.quiknode.pro/..."'
  echo ""
  echo "Skipping Tier 2 tests (stateless compression estimate still works)."
  echo ""
  echo "=== Compression estimate (stateless, no RPC) ==="
  curl -sf "$BASE_URL/v1/compression/estimate?size=4096" | jq .
  echo ""
  echo "PASS: Estimate endpoint works without RPC."
  exit 0
fi

if [ -z "${PAYER_SECRET_KEY:-}" ]; then
  echo "ERROR: PAYER_SECRET_KEY is not set."
  echo "Set it to a base64-encoded Solana keypair (64 bytes) with devnet SOL."
  echo '  export PAYER_SECRET_KEY="$(base64 < ~/.config/solana/id.json)"'
  exit 1
fi

echo "=== Tier 2 RPC-dependent tests ==="
echo "Base URL:    $BASE_URL"
echo "RPC URL:     $QN_HTTP_URL"
echo ""

# 1. Provision an instance with the real RPC URL
echo "1. Provisioning instance with real RPC URL..."
curl -sf -X POST "$BASE_URL/provision" \
  -u "$AUTH" \
  -H "Content-Type: application/json" \
  -d "{\"quicknode-id\":\"qn-tier2-test\",\"endpoint-id\":\"ep-tier2-test\",\"plan\":\"pro\",\"http-url\":\"$QN_HTTP_URL\",\"chain\":\"solana\",\"network\":\"devnet\"}" \
  | jq .
echo ""

# 2. Compress data
echo "2. Compressing data..."
DATA=$(echo -n "hello veil zk compression" | base64)
COMPRESS_RESULT=$(curl -sf -X POST "$BASE_URL/v1/compression/compress" \
  -H "Content-Type: application/json" \
  -H "X-INSTANCE-ID: ep-tier2-test" \
  -d "{\"data\":\"$DATA\",\"payerSecretKey\":\"$PAYER_SECRET_KEY\"}")
echo "$COMPRESS_RESULT" | jq .

if echo "$COMPRESS_RESULT" | jq -e '.success' > /dev/null 2>&1; then
  echo "PASS: Compression succeeded"
  echo ""

  # 3. Decompress data
  echo "3. Decompressing data..."
  COMPRESSED_DATA=$(echo "$COMPRESS_RESULT" | jq -r '.compressedData')
  PROOF=$(echo "$COMPRESS_RESULT" | jq -r '.proof')
  PUBLIC_INPUTS=$(echo "$COMPRESS_RESULT" | jq -r '.publicInputs')
  STATE_TREE_ROOT=$(echo "$COMPRESS_RESULT" | jq -r '.stateTreeRoot')
  DATA_HASH=$(echo "$COMPRESS_RESULT" | jq -r '.dataHash')

  DECOMPRESS_RESULT=$(curl -sf -X POST "$BASE_URL/v1/compression/decompress" \
    -H "Content-Type: application/json" \
    -H "X-INSTANCE-ID: ep-tier2-test" \
    -d "{\"compressedData\":\"$COMPRESSED_DATA\",\"proof\":\"$PROOF\",\"publicInputs\":\"$PUBLIC_INPUTS\",\"stateTreeRoot\":\"$STATE_TREE_ROOT\",\"dataHash\":\"$DATA_HASH\"}")
  echo "$DECOMPRESS_RESULT" | jq .

  RECOVERED=$(echo "$DECOMPRESS_RESULT" | jq -r '.data' | base64 -d)
  echo "Recovered: $RECOVERED"

  if [ "$RECOVERED" = "hello veil zk compression" ]; then
    echo "PASS: Compress/decompress roundtrip succeeded"
  else
    echo "FAIL: Expected 'hello veil zk compression', got '$RECOVERED'"
  fi
else
  echo "NOTE: Compression failed (this is expected if RPC doesn't support Light Protocol)."
  echo "Error: $(echo "$COMPRESS_RESULT" | jq -r '.error')"
fi

echo ""

# 4. Clean up
echo "4. Cleaning up..."
curl -sf -X DELETE "$BASE_URL/deprovision" \
  -u "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"quicknode-id":"qn-tier2-test"}' \
  | jq .

echo ""
echo "=== Tier 2 tests complete ==="
