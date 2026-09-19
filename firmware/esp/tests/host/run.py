#!/usr/bin/env python3
import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import List

HERE = Path(__file__).resolve().parent
MAIN_DIR = HERE.parent.parent / "main"

def run_readiness_suite(compiler: List[str]) -> int:
    with tempfile.TemporaryDirectory() as tmpdir:
        exe = os.path.join(tmpdir, "test_readiness.exe" if os.name == "nt" else "test_readiness")
        srcs = [
            str(HERE / "test_readiness.cpp"),
            str(MAIN_DIR / "ble_framing.cpp"),
            str(MAIN_DIR / "playback.cpp"),
        ]
        cmd = compiler + [
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

def run_voice_suite(compiler: List[str]) -> int:
    with tempfile.TemporaryDirectory() as tmpdir:
        # 1. Voice Transfer Integrity Test
        exe_transfer = os.path.join(tmpdir, "test_voice_transfer.exe" if os.name == "nt" else "test_voice_transfer")
        cmd_transfer = compiler + [
            "-std=c++17",
            "-O2",
            f"-I{HERE / 'shims'}",
            f"-I{MAIN_DIR}",
            "-o",
            exe_transfer,
            str(HERE / "test_voice_transfer.cpp"),
            str(MAIN_DIR / "playback.cpp"),
        ]
        print(f"[RUN] Compiling voice transfer suite: {' '.join(cmd_transfer)}")
        compile_res = subprocess.run(cmd_transfer, capture_output=True, text=True)
        if compile_res.returncode != 0:
            print("[ERROR] Compilation failed:")
            print(compile_res.stderr)
            return compile_res.returncode

        print(f"[RUN] Executing {exe_transfer}")
        run_res = subprocess.run([exe_transfer])
        if run_res.returncode != 0:
            return run_res.returncode

        # 2. Voice Lifecycle & Single Owner Test
        exe_lifecycle = os.path.join(tmpdir, "test_voice_lifecycle.exe" if os.name == "nt" else "test_voice_lifecycle")
        cmd_lifecycle = compiler + [
            "-std=c++17",
            "-O2",
            f"-I{HERE / 'shims'}",
            f"-I{MAIN_DIR}",
            "-o",
            exe_lifecycle,
            str(HERE / "test_voice_lifecycle.cpp"),
            str(MAIN_DIR / "state.cpp"),
        ]
        print(f"[RUN] Compiling voice lifecycle suite: {' '.join(cmd_lifecycle)}")
        compile_res = subprocess.run(cmd_lifecycle, capture_output=True, text=True)
        if compile_res.returncode != 0:
            print("[ERROR] Compilation failed:")
            print(compile_res.stderr)
            return compile_res.returncode

        print(f"[RUN] Executing {exe_lifecycle}")
        run_res = subprocess.run([exe_lifecycle])
        return run_res.returncode

def run_core_suite(compiler: List[str]) -> int:
    with tempfile.TemporaryDirectory() as tmpdir:
        # 1. Test Buttons
        exe_buttons = os.path.join(tmpdir, "test_buttons.exe" if os.name == "nt" else "test_buttons")
        cmd_buttons = compiler + [
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

        # 2. Test Faces
        exe_faces = os.path.join(tmpdir, "test_faces.exe" if os.name == "nt" else "test_faces")
        cmd_faces = compiler + [
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
        exe_spotify = os.path.join(tmpdir, "test_spotify.exe" if os.name == "nt" else "test_spotify")
        cmd_spotify = compiler + [
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
    parser.add_argument("--suite", choices=["readiness", "voice", "core", "all"], default="all")
    parser.add_argument("--cxx", default="/usr/bin/c++", help="C++ compiler executable")
    parser.add_argument("--cxx-arg", action="append", default=[], help="Extra compiler arguments")
    args = parser.parse_args()

    compiler = [args.cxx] + args.cxx_arg

    if args.suite in ("readiness", "all"):
        rc = run_readiness_suite(compiler)
        if rc != 0:
            return rc

    if args.suite in ("voice", "all"):
        rc = run_voice_suite(compiler)
        if rc != 0:
            return rc

    if args.suite in ("core", "all"):
        rc = run_core_suite(compiler)
        if rc != 0:
            return rc

    return 0

if __name__ == "__main__":
    sys.exit(main())
