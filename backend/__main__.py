"""Run from the project root with python -m backend."""
import argparse
from pathlib import Path
import subprocess
import sys

from .contracts import validate
from .release import prepare

ROOT = Path(__file__).resolve().parents[1]
JOBS = {
    # offline science jobs land here (e.g. "flame": "flame_shape.py" once the heuristic is replaced by data)
}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    check = commands.add_parser("check", help="Validate public data and asset references")
    check.add_argument("--source", type=Path, default=ROOT)
    build = commands.add_parser("build", help="Create a new static release directory")
    build.add_argument("output", type=Path)
    build.add_argument("--host", choices=("vercel", "static"), default="vercel")
    build.add_argument("--source", type=Path, default=ROOT)
    job = commands.add_parser("run", help="Run one offline job with its native arguments")
    job.add_argument("job", choices=JOBS or ["none"])
    job.add_argument("arguments", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if args.command == "check":
        print(f"Verified {validate(args.source)} scenarios.")
    elif args.command == "build":
        prepare(args.source, args.output, args.host)
    else:
        if args.job not in JOBS:
            raise SystemExit("No offline jobs registered yet.")
        script = Path(__file__).with_name("science") / JOBS[args.job]
        return subprocess.call([sys.executable, str(script), *args.arguments])
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
