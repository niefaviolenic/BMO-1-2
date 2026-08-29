#!/usr/bin/env bash
set -e

# Clear stale ADB port forwards and kill lingering Maestro processes before running
adb forward --remove-all 2>/dev/null || true

# Pass arguments directly to Maestro test
exec maestro test "$@"
