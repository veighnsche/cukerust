#!/usr/bin/env bash
set -Eeuo pipefail

on_err() {
  local exit_code=$?
  local cmd=${BASH_COMMAND}
  echo "ERROR: command failed (exit ${exit_code}): ${cmd}" >&2
  echo "At line ${BASH_LINENO[0]} in ${BASH_SOURCE[1]:-$0}" >&2
  exit "$exit_code"
}
trap on_err ERR

# Open CukeRust showcase workspace with the extension installed
# Usage: ./scripts/open-showcase.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
EXT_DIR="$REPO_ROOT/extension"
WS_FILE="$REPO_ROOT/examples/cukerust-showcase.code-workspace"
BASIC_DIR="$REPO_ROOT/extension/test-fixtures/basic"

# Checks
need() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: Missing dependency: $1"; exit 1; }; }
need node
need npm
need code
need cargo

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
  echo "Ensuring rust-analyzer extension is installed ..."
  code --install-extension rust-lang.rust-analyzer --force
  echo "Removing any old publisher install (your-publisher.cukerust) to avoid duplicates ..."
  code --uninstall-extension your-publisher.cukerust || true
popd >/dev/null

if [[ ! -f "$WS_FILE" ]]; then
  echo "ERROR: Workspace file not found at $WS_FILE"
  exit 1
fi

echo "Verifying example crate compiles (cargo check) ..."
pushd "$BASIC_DIR" >/dev/null
  cargo check
popd >/dev/null

echo "Opening showcase workspace ..."
if code -n "$WS_FILE"; then
  echo "VS Code launch requested. If no window appears, verify the 'code' CLI is connected to a running VS Code instance."
else
  echo "ERROR: Failed to open VS Code with workspace: $WS_FILE" >&2
  exit 1
fi

echo "Done. Tips:"
echo " - Toggle discovery modes via Settings: cukerust.discovery.mode"
echo " - Commands: CukeRust: Rebuild Step Index, Force Static Scan Rebuild, Clear Ambiguity Choices"
echo " - The workspace includes prebuilt docs/cukerust/step_index.json for Artifact mode"
