#!/usr/bin/env bash
# Extract the raw secp256k1 private key hex from a p12 keystore (for dag4).
# Usage: ./extract-key.sh <p12-file> <password>
set -euo pipefail
P12="${1:-../data/p12-files/token-key.p12}"
PASS="${2:-password}"
# -legacy required for OpenSSL 3.x: these p12 keystores use legacy RC2-40-CBC
# encryption, which the default provider no longer supports.
openssl pkcs12 -in "$P12" -passin "pass:$PASS" -nocerts -nodes -legacy 2>/dev/null \
  | openssl ec -text -noout 2>/dev/null \
  | sed -n '/priv:/,/pub:/p' \
  | grep -E '^[[:space:]]+[0-9a-f:]+' \
  | tr -d ' :\n'
echo
