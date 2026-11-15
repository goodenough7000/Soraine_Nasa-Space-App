from pathlib import Path
import re
import shutil
import tempfile
from .contracts import validate

# Explicit public-asset allowlist. Add every new runtime file here or it will be missing online.
FILES = [
    "index.html",
    "kitchen/style.css", "kitchen/main.js", "kitchen/scene.js", "kitchen/wave.js", "kitchen/pages.js", "kitchen/props.js", "kitchen/terrain.js", "kitchen/meadow.js", "kitchen/stars.js",
    "vendor/three.module.js", "vendor/LICENSE-three", "vendor/cannon-es.js", "vendor/LICENSE-cannon-es", "vendor/addons/loaders/GLTFLoader.js", "vendor/addons/utils/BufferGeometryUtils.js",
    "data/scenarios.json",
]
GLOBS = ["models/*.glb", "models/planet_surfaces/*.glb"]

def _write(source, target, host):
    files = list(FILES)
    if host == "vercel":
        files.append("vercel.json")
    for pattern in GLOBS:
        files.extend(p.relative_to(source).as_posix() for p in source.glob(pattern) if ".before-" not in p.name)
    for rel in files:
        dest = target / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source / rel, dest)
    # strip development inspection handles from the release only
    main = target / "kitchen/main.js"
    main.write_text(re.sub(r"^window\.__kitchen = .*;\s*$", "", main.read_text(encoding="utf-8"), flags=re.M), encoding="utf-8", newline="\n")
    n = sum(p.is_file() for p in target.rglob("*")); size = sum(p.stat().st_size for p in target.rglob("*") if p.is_file())
    print(f"{n} files; {size:,} bytes")

def prepare(source, target, host="vercel"):
    source, target = Path(source).resolve(), Path(target).resolve()
    if host not in ("vercel", "static"):
        raise ValueError(f"Unknown host: {host}")
    if target.exists():
        raise FileExistsError(target)
    validate(source)
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=target.parent) as staging:
        release = Path(staging) / "site"
        release.mkdir()
        _write(source, release, host)
        validate(release)
        release.rename(target)
