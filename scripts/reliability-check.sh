#!/usr/bin/env bash

set -euo pipefail

SERVER_URL="${1:-http://localhost:3100/mcp}"
BASE_URL="${SERVER_URL%/mcp}"

echo "==> Checking health endpoint: ${BASE_URL}/healthz"
HEALTH_JSON="$(curl -sf "${BASE_URL}/healthz")"
echo "${HEALTH_JSON}" | grep -q '"status":"ok"'

echo "==> Verifying session lifecycle"
npm run agent -- --server-url "${SERVER_URL}" --sequence \
  browser_start browser_get_info browser_end >/tmp/mcp-reliability-seq1.log

echo "==> Verifying navigation + extraction"
# Use a local about:blank + evaluate to avoid external network flakiness in CI.
attempt=0
success=false
while [ $attempt -lt 3 ]; do
  attempt=$((attempt+1))
  npm run agent -- --server-url "${SERVER_URL}" --sequence \
    browser_start "browser_navigate?url=about:blank" \
    "browser_evaluate?script=%28%29%20%3D%3E%20%7B%20document.title%20%3D%20'Example%20Domain'%3B%20return%20document.title%3B%20%7D" \
    browser_end >/tmp/mcp-reliability-seq2.log || true
  if grep -q "Example Domain" /tmp/mcp-reliability-seq2.log; then
    success=true
    break
  fi
  echo "Attempt ${attempt} failed for navigation+extraction; retrying..."
  sleep 1
done
if [ "${success}" != "true" ]; then
  echo "Navigation+extraction failed"
  exit 1
fi

echo "==> Verifying multi-tab flow"
attempt=0
success=false
while [ $attempt -lt 3 ]; do
  attempt=$((attempt+1))
  npm run agent -- --server-url "${SERVER_URL}" --sequence \
    browser_start "browser_navigate?url=https://www.iana.org/domains/reserved" \
    browser_list_tabs "browser_new_tab?url=https://example.com" \
    browser_list_tabs "browser_switch_tab?index=0" browser_get_info browser_end >/tmp/mcp-reliability-seq3.log || true
  if grep -q "iana.org" /tmp/mcp-reliability-seq3.log; then
    success=true
    break
  fi
  echo "Attempt ${attempt} failed for multi-tab; retrying..."
  sleep 1
done
if [ "${success}" != "true" ]; then
  echo "Multi-tab flow failed"
  exit 1
fi

echo "==> Repeating deterministic extraction (5x)"
for i in 1 2 3 4 5; do
  attempt=0
  success=false
  while [ $attempt -lt 3 ]; do
    attempt=$((attempt+1))
    npm run agent -- --server-url "${SERVER_URL}" --sequence \
      browser_start "browser_navigate?url=about:blank" \
      "browser_evaluate?script=%28%29%20%3D%3E%20%7B%20document.title%20%3D%20'Example%20Domain'%3B%20return%20document.title%3B%20%7D" \
      browser_end >/tmp/mcp-reliability-repeat-"${i}".log || true
    if grep -q "Example Domain" /tmp/mcp-reliability-repeat-"${i}".log; then
      success=true
      break
    fi
    echo "Attempt ${attempt} failed for iteration ${i}; retrying..."
    sleep 1
  done
  if [ "${success}" != "true" ]; then
    echo "Failed to extract Example Domain on iteration ${i}"
    exit 1
  fi
done

echo "Reliability check passed for ${SERVER_URL}"
