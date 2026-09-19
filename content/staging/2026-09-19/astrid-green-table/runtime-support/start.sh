#!/bin/sh
set -eu
support_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
python3 "$support_dir/prepare.py"
cd "$support_dir/../runtime"
HOST=127.0.0.1 PORT=4190 DEMO_GUEST_ACCESS=1 exec node server.mjs
