#!/usr/bin/env python3
import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
MAIN_DIR = HERE.parent.parent / "main"

def run_readiness_suite(cxx: str) -> int:
    with tempfile.TemporaryDirectory() as tmpdir:
        exe = os.path.join(tmpdir, "test_readiness")
        srcs = [
            str(HERE / "test_readiness.cpp"),
            str(MAIN_DIR / "ble_framing.cpp"),
            str(MAIN_DIR / "playback.cpp"),
        ]
        cmd = [
            cxx,
            "-std=c++17",
            "-O2",
            f"-I{HERE / 'shims'}",
            f"-I{MAIN_DIR}",
            "-o",
            exe,
        ] + srcs

        print(f"[RUN] Compiling readiness suite: {' '.join(cmd)}")
        compile_res = subprocess.run(cmd, capture_output=True, text=True)
        if compile_res.returncode != 0:
            print("[ERROR] Compilation failed:")
            print(compile_res.stderr)
            return compile_res.returncode

        print(f"[RUN] Executing {exe}")
        run_res = subprocess.run([exe])
        return run_res.returncode

def main() -> int:
    parser = argparse.ArgumentParser(description="Host C++ contract test runner")
    parser.add_argument("--suite", choices=["readiness", "core", "all"], default="readiness")
    parser.add_argument("--cxx", default="/usr/bin/c++", help="C++ compiler executable")
    args = parser.parse_args()

    if args.suite in ("readiness", "all"):
        rc = run_readiness_suite(args.cxx)
        if rc != 0:
            return rc

    return 0

if __name__ == "__main__":
    sys.exit(main())
