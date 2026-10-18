#!/bin/sh
# Temporary local product preview: bypass casino login, keep BO authentication.
set -eu
cd "$(dirname "$0")"
HOST=127.0.0.1 DEMO_GUEST_ACCESS=1 exec node server.mjs
