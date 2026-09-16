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

def run_core_suite(cxx: str) -> int:
    with tempfile.TemporaryDirectory() as tmpdir:
        exe_buttons = os.path.join(tmpdir, "test_buttons")
        cmd_buttons = [
            cxx,
            "-std=c++17",
            "-O2",
            f"-I{HERE / 'shims'}",
            f"-I{MAIN_DIR}",
            "-o",
            exe_buttons,
            str(HERE / "test_buttons.cpp"),
            str(MAIN_DIR / "button_policy.cpp"),
        ]
        print(f"[RUN] Compiling core button suite: {' '.join(cmd_buttons)}")
        compile_res = subprocess.run(cmd_buttons, capture_output=True, text=True)
        if compile_res.returncode != 0:
            print("[ERROR] Compilation failed:")
            print(compile_res.stderr)
            return compile_res.returncode

        print(f"[RUN] Executing {exe_buttons}")
        run_res = subprocess.run([exe_buttons])
        if run_res.returncode != 0:
            return run_res.returncode

        exe_faces = os.path.join(tmpdir, "test_faces")
        cmd_faces = [
            cxx,
            "-std=c++17",
            "-O2",
            f"-I{HERE / 'shims'}",
            f"-I{MAIN_DIR}",
            "-o",
            exe_faces,
            str(HERE / "test_faces.cpp"),
            str(MAIN_DIR / "face_policy.cpp"),
        ]
        print(f"[RUN] Compiling core face suite: {' '.join(cmd_faces)}")
        compile_res = subprocess.run(cmd_faces, capture_output=True, text=True)
        if compile_res.returncode != 0:
            print("[ERROR] Compilation failed:")
            print(compile_res.stderr)
            return compile_res.returncode

        print(f"[RUN] Executing {exe_faces}")
        run_res = subprocess.run([exe_faces])
        if run_res.returncode != 0:
            return run_res.returncode

        # 3. Test Spotify Controller
        exe_spotify = os.path.join(tmpdir, "test_spotify")
        cmd_spotify = [
            cxx,
            "-std=c++17",
            "-O2",
            f"-I{HERE / 'shims'}",
            f"-I{MAIN_DIR}",
            "-o",
            exe_spotify,
            str(HERE / "test_spotify.cpp"),
            str(MAIN_DIR / "spotify_controller.cpp"),
        ]
        print(f"[RUN] Compiling core spotify suite: {' '.join(cmd_spotify)}")
        compile_res = subprocess.run(cmd_spotify, capture_output=True, text=True)
        if compile_res.returncode != 0:
            print("[ERROR] Compilation failed:")
            print(compile_res.stderr)
            return compile_res.returncode

        print(f"[RUN] Executing {exe_spotify}")
        run_res = subprocess.run([exe_spotify])
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

    if args.suite in ("core", "all"):
        rc = run_core_suite(args.cxx)
        if rc != 0:
            return rc

    return 0

if __name__ == "__main__":
    sys.exit(main())
