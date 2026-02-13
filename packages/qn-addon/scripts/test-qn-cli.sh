#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3030}"
AUTH="quicknode:changeme"

echo "=== Veil QN Add-On PUDD Lifecycle Test ==="
echo "Base URL: $BASE_URL"
echo ""

# 1. Health check
echo "1. Health check..."
curl -sf "$BASE_URL/healthcheck" | jq .
echo ""

# 2. Provision
echo "2. Provision endpoint..."
curl -sf -X POST "$BASE_URL/provision" \
  -u "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"quicknode-id":"qn-test-1","endpoint-id":"ep-test-1","plan":"starter","http-url":"https://example.solana-mainnet.quiknode.pro/abc","chain":"solana","network":"mainnet-beta"}' \
  | jq .
echo ""

# 3. Update
echo "3. Update endpoint..."
curl -sf -X PUT "$BASE_URL/update" \
  -u "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"endpoint-id":"ep-test-1","plan":"pro"}' \
  | jq .
echo ""

# 4. Deactivate
echo "4. Deactivate endpoint..."
curl -sf -X DELETE "$BASE_URL/deactivate_endpoint" \
  -u "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"endpoint-id":"ep-test-1"}' \
  | jq .
echo ""

# 5. Deprovision
echo "5. Deprovision account..."
curl -sf -X DELETE "$BASE_URL/deprovision" \
  -u "$AUTH" \
  -H "Content-Type: application/json" \
  -d '{"quicknode-id":"qn-test-1"}' \
  | jq .
echo ""

echo "=== Crypto roundtrip test ==="

# 6. Generate keypairs
echo "6. Generate sender keypair..."
SENDER=$(curl -sf -X POST "$BASE_URL/v1/keypair/generate")
echo "$SENDER" | jq .
SENDER_PUB=$(echo "$SENDER" | jq -r '.publicKey.base64')
SENDER_SEC=$(echo "$SENDER" | jq -r '.secretKey.base64')

echo "7. Generate recipient keypair..."
RECIPIENT=$(curl -sf -X POST "$BASE_URL/v1/keypair/generate")
echo "$RECIPIENT" | jq .
RECIPIENT_PUB=$(echo "$RECIPIENT" | jq -r '.publicKey.base64')
RECIPIENT_SEC=$(echo "$RECIPIENT" | jq -r '.secretKey.base64')

PLAINTEXT=$(echo -n "hello veil" | base64)

# 7. Encrypt
echo "8. Encrypt..."
ENCRYPTED=$(curl -sf -X POST "$BASE_URL/v1/encrypt" \
  -H "Content-Type: application/json" \
  -d "{\"plaintext\":\"$PLAINTEXT\",\"recipientPublicKey\":\"$RECIPIENT_PUB\",\"senderSecretKey\":\"$SENDER_SEC\",\"senderPublicKey\":\"$SENDER_PUB\"}")
echo "$ENCRYPTED" | jq .
ENCRYPTED_BYTES=$(echo "$ENCRYPTED" | jq -r '.bytes.base64')

# 8. Decrypt
echo "9. Decrypt..."
DECRYPTED=$(curl -sf -X POST "$BASE_URL/v1/decrypt" \
  -H "Content-Type: application/json" \
  -d "{\"bytes\":\"$ENCRYPTED_BYTES\",\"senderPublicKey\":\"$SENDER_PUB\",\"recipientSecretKey\":\"$RECIPIENT_SEC\",\"recipientPublicKey\":\"$RECIPIENT_PUB\"}")
echo "$DECRYPTED" | jq .
RESULT=$(echo "$DECRYPTED" | jq -r '.plaintext.base64' | base64 -d)
echo "Decrypted: $RESULT"

if [ "$RESULT" = "hello veil" ]; then
  echo "PASS: Encrypt/decrypt roundtrip succeeded"
else
  echo "FAIL: Expected 'hello veil', got '$RESULT'"
  exit 1
fi

echo ""
echo "=== Tier lookup test ==="
echo "10. Get tier benefits for score 75..."
curl -sf "$BASE_URL/v1/tiers/75" | jq .

echo ""
echo "=== Compression estimate test ==="
echo "11. Estimate savings for 4096 bytes..."
curl -sf "$BASE_URL/v1/compression/estimate?size=4096" | jq .

echo ""
echo "=== All tests passed! ==="
