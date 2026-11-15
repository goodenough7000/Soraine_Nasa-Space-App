#!/usr/bin/env sh
# Assembles the Rust-driven site in site/: the published assets from ../dist,
# with app.mjs and the modules already ported replaced by the WebAssembly build.
#   sh tools/build-site.sh
set -eu
cd "$(dirname "$0")/.."
sh tools/build-web.sh >/dev/null
rm -rf site
cp -R ../dist site
# Ported to Rust: no longer shipped.
rm -f site/app.mjs site/data.mjs site/reading.mjs site/specimen.mjs site/scene-link.mjs
mkdir -p site/pkg
cp pkg/soraine_web.js pkg/soraine_web_bg.wasm site/pkg/
cp -R pkg/snippets site/pkg/snippets
# The one line of JavaScript a browser needs to start a WebAssembly module.
python3 - <<'PY'
import re
path = 'site/index.html'
html = open(path, encoding='utf-8').read()
html, count = re.subn(r'<script type="module" src="\./app\.mjs[^"]*"></script>',
    '<script type="module">import init, {startPage} from "./pkg/soraine_web.js"; await init(); startPage();</script>', html)
assert count == 1, 'app.mjs script tag not found'
open(path, 'w', encoding='utf-8').write(html)
PY
echo "site/ ready: $(ls site | wc -l) entries, wasm $(wc -c < site/pkg/soraine_web_bg.wasm) bytes"
