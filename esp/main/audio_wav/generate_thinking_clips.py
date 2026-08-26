#!/usr/bin/env python3
"""
Generate canonical dynamic thinking filler WAV files for BMO.

Clips:
1. thinking_01.wav - "bentar aku pikir dulu" (~1.9s)
2. thinking_02.wav - "aku lagi proses dulu pertanyaannya" (~2.3s)
3. thinking_03.wav - "tunggu sebentar ya" (~1.1s)
4. thinking_04.wav - "hmm coba aku cari tahu dulu" (~2.2s)
5. thinking_05.wav - "bentar ya joy lagi mikir" (~2.2s)

Format specifications:
- Sample Rate: 16000 Hz
- Bit Depth: 16-bit Signed Integer PCM
- Channels: 1 (Mono)
- Format: Valid Canonical RIFF WAVE
- Duration: 500ms - 2500ms
"""

import asyncio
import math
import os
import shutil
import struct
import subprocess
import tempfile
import wave
from pathlib import Path

SAMPLE_RATE = 16000
AUDIO_DIR = Path(__file__).resolve().parent

THINKING_CLIPS = {
    "thinking_01.wav": {
        "phrase": "Bentar aku pikir dulu.",
        "contract_phrase": "bentar aku pikir dulu",
        "duration": 1.15,
        "rate": "+25%",
        "tempo": 1.1,
        "notes": [(523.25, 0.8), (659.25, 0.9), (783.99, 1.0), (987.77, 0.9), (1046.50, 1.0)],
    },
    "thinking_02.wav": {
        "phrase": "Aku lagi proses dulu pertanyaannya.",
        "contract_phrase": "aku lagi proses dulu pertanyaannya",
        "duration": 1.25,
        "rate": "+35%",
        "tempo": 1.45,
        "notes": [(698.46, 0.75), (880.00, 0.85), (1046.50, 1.0), (1318.51, 0.9), (1174.66, 0.8)],
    },
    "thinking_03.wav": {
        "phrase": "Tunggu sebentar ya.",
        "contract_phrase": "tunggu sebentar ya",
        "duration": 1.1,
        "rate": "+15%",
        "tempo": 1.0,
        "notes": [(783.99, 0.8), (987.77, 0.9), (1174.66, 1.0), (1567.98, 0.95)],
    },
    "thinking_04.wav": {
        "phrase": "Hmm coba aku cari tahu dulu.",
        "contract_phrase": "hmm coba aku cari tahu dulu",
        "duration": 1.2,
        "rate": "+30%",
        "tempo": 1.2,
        "notes": [(587.33, 0.75), (739.99, 0.85), (880.00, 0.95), (1108.73, 1.0), (1318.51, 0.85)],
    },
    "thinking_05.wav": {
        "phrase": "Bentar ya Joy lagi mikir.",
        "contract_phrase": "bentar ya joy lagi mikir",
        "duration": 1.2,
        "rate": "+25%",
        "tempo": 1.15,
        "notes": [(659.25, 0.8), (830.61, 0.9), (987.77, 1.0), (1318.51, 0.95)],
    },
}

VOICE = "id-ID-GadisNeural"


def synthesize_fallback_clip(notes: list, duration_s: float, sample_rate: int = 16000, max_amplitude: int = 22000) -> bytes:
    total_samples = int(duration_s * sample_rate)
    buffer = [0.0] * total_samples
    num_notes = len(notes)
    note_duration_s = duration_s / num_notes
    note_samples = int(note_duration_s * sample_rate)

    for i, (freq, weight) in enumerate(notes):
        start_sample = int(i * (total_samples - note_samples) / max(1, num_notes - 1)) if num_notes > 1 else 0
        end_sample = min(total_samples, start_sample + note_samples)
        note_len = end_sample - start_sample

        for s in range(note_len):
            t = s / sample_rate
            attack = min(1.0, s / (0.03 * sample_rate))
            release = max(0.0, 1.0 - (s / note_len) ** 1.4)
            env = attack * release * weight

            sample_val = (
                math.sin(2.0 * math.pi * freq * t) * 0.60
                + math.sin(2.0 * math.pi * freq * 2.0 * t) * 0.25
                + math.sin(2.0 * math.pi * freq * 3.0 * t) * 0.10
                + math.sin(2.0 * math.pi * (freq * 1.002) * t) * 0.05
            )
            buffer[start_sample + s] += sample_val * env

    peak = max(abs(x) for x in buffer) if buffer else 1.0
    scale = (max_amplitude / peak) if peak > 0 else 1.0

    pcm_bytes = bytearray()
    for val in buffer:
        sample = int(max(-32767, min(32767, val * scale)))
        pcm_bytes.extend(struct.pack("<h", sample))

    return bytes(pcm_bytes)


async def generate_tts_clip(text: str, out_path: Path, rate: str = "+25%", tempo: float = 1.0):
    import edge_tts

    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp_mp3:
        tmp_mp3_path = tmp_mp3.name

    try:
        communicate = edge_tts.Communicate(text, VOICE, rate=rate)
        await communicate.save(tmp_mp3_path)

        ffmpeg_bin = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
        af_filter = (
            "silenceremove=start_periods=1:start_duration=0.01:start_threshold=-35dB,"
            "areverse,silenceremove=start_periods=1:start_duration=0.01:start_threshold=-35dB,areverse"
        )
        if tempo != 1.0:
            af_filter += f",atempo={tempo}"
        af_filter += ",loudnorm=I=-16:TP=-1.5:LRA=11"

        cmd = [
            ffmpeg_bin, "-y",
            "-i", tmp_mp3_path,
            "-af", af_filter,
            "-ar", str(SAMPLE_RATE),
            "-ac", "1",
            "-c:a", "pcm_s16le",
            str(out_path)
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    finally:
        if os.path.exists(tmp_mp3_path):
            os.unlink(tmp_mp3_path)


def generate_all_clips():
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    generated_files = []

    has_edge_tts = False
    try:
        import edge_tts
        has_edge_tts = True
    except ImportError:
        pass

    for filename, info in THINKING_CLIPS.items():
        out_path = AUDIO_DIR / filename
        used_tts = False

        if has_edge_tts:
            try:
                asyncio.run(generate_tts_clip(info["phrase"], out_path, rate=info.get("rate", "+25%"), tempo=info.get("tempo", 1.0)))
                used_tts = True
            except Exception as e:
                print(f"Warning: TTS synthesis for {filename} failed ({e}), falling back to harmonic synthesizer")

        if not used_tts:
            pcm_data = synthesize_fallback_clip(info["notes"], info["duration"], SAMPLE_RATE)
            with wave.open(str(out_path), "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(SAMPLE_RATE)
                wf.writeframes(pcm_data)

        with wave.open(str(out_path), "rb") as wf:
            nchannels = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            framerate = wf.getframerate()
            nframes = wf.getnframes()
            dur_ms = (nframes * 1000) / framerate

            mode_str = "Spoken Voice (Edge TTS)" if used_tts else "Synthesized Harmonic"
            print(
                f"Generated {filename} [{mode_str}] (\"{info['phrase']}\"): "
                f"{nchannels}ch, {sampwidth*8}bit, {framerate}Hz, {dur_ms:.1f}ms ({dur_ms/1000:.2f}s)"
            )
            assert nchannels == 1, "Must be mono"
            assert sampwidth == 2, "Must be 16-bit"
            assert framerate == 16000, "Must be 16kHz"
            assert 500 <= dur_ms <= 2500, f"Duration {dur_ms}ms outside 500-2500ms"

        generated_files.append(out_path)

    print(f"\nSuccessfully generated {len(generated_files)} dynamic thinking clips in {AUDIO_DIR}")


if __name__ == "__main__":
    generate_all_clips()
