#!/usr/bin/env sh
# Builds soraine-web to WebAssembly and writes the browser package to pkg/.
#   sh tools/build-web.sh        (needs: cargo install wasm-bindgen-cli --version 0.2.130)
set -eu
cd "$(dirname "$0")/.."
if rustup target list --installed 2>/dev/null | grep -q wasm32-unknown-unknown; then
  cargo build -p soraine-web --target wasm32-unknown-unknown --release
else
  # No prebuilt wasm32 standard library here: build it from the rust-src sources.
  RUSTC_BOOTSTRAP=1 cargo build -p soraine-web --target wasm32-unknown-unknown --release -Zbuild-std=std,panic_abort
fi
wasm-bindgen --target web --out-dir pkg target/wasm32-unknown-unknown/release/soraine_web.wasm
ls -l pkg/soraine_web_bg.wasm
