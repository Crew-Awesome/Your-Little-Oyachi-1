#!/bin/sh
set -eu

base_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
case "$(uname -m)" in
  x86_64) exec "$base_dir/oyachi-discord-rpc-x64" ;;
  aarch64|arm64) exec "$base_dir/oyachi-discord-rpc-arm64" ;;
  *) exit 0 ;;
esac
