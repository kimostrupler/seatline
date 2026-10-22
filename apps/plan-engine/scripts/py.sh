#!/bin/sh
# The plan engine's Python: the local .venv if there is one (see README), else python3 (CI).
cd "$(dirname "$0")/.." || exit 1
if [ -x .venv/bin/python ]; then exec .venv/bin/python "$@"; fi
exec python3 "$@"
