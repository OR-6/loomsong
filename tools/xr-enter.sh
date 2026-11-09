#!/usr/bin/env bash
# Enter emulated XR (if not active) and switch to hand-tracking input.
set -e
cd "$(dirname "$0")/.."
active=$(npx @iwsdk/cli xr status --raw 2>/dev/null | grep -m1 '"sessionActive"' || true)
if ! echo "$active" | grep -q true; then npx @iwsdk/cli xr enter --raw >/dev/null; fi
npx @iwsdk/cli xr set-input-mode --input-json '{"mode":"hand"}' --raw >/dev/null
echo "xr: active, hand mode"
