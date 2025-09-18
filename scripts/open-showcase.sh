#!/usr/bin/env bash
set -euo pipefail

# Open CukeRust showcase workspace with the extension installed
# Usage: ./scripts/open-showcase.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
EXT_DIR="$REPO_ROOT/extension"
WS_FILE="$REPO_ROOT/examples/cukerust-showcase.code-workspace"

# Checks
need() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: Missing dependency: $1"; exit 1; }; }
need node
need npm
need code

# wasm-pack is needed by the build script (build:wasm)
if ! command -v wasm-pack >/dev/null 2>&1; then
  echo "WARNING: wasm-pack not found. Attempting build may fail."
  echo "Install with: cargo install wasm-pack"
fi

pushd "$EXT_DIR" >/dev/null
  echo "Installing dependencies (npm ci || npm i) ..."
  if ! npm ci; then
    npm i
  fi

  echo "Building extension (npm run build) ..."
  npm run build

  echo "Packaging VSIX (npm run package) ..."
  npm run package

  VSIX_FILE="$(ls -1t *.vsix | head -n1)"
  if [[ -z "${VSIX_FILE:-}" ]]; then
    echo "ERROR: No VSIX produced. Check for packaging errors above."
    exit 1
  fi
  echo "Latest VSIX: $VSIX_FILE"

  echo "Installing VSIX into VS Code ..."
  code --install-extension "$VSIX_FILE" --force
popd >/dev/null

if [[ ! -f "$WS_FILE" ]]; then
  echo "ERROR: Workspace file not found at $WS_FILE"
  exit 1
fi

echo "Opening showcase workspace ..."
code -n "$WS_FILE"

echo "Done. Tips:"
echo " - Toggle discovery modes via Settings: cukerust.discovery.mode"
echo " - Commands: CukeRust: Rebuild Step Index, Force Static Scan Rebuild, Clear Ambiguity Choices"
echo " - The workspace includes prebuilt docs/cukerust/step_index.json for Artifact mode"
