#!/usr/bin/env python3
"""
Generate canonical dynamic thinking filler WAV files for Joy using Piper TTS.
Voice persona matches Joy Backend: en_GB-semaine-medium (prudence, speaker_id=0).

Clips:
1. thinking_01.wav - "Let me think for a moment."
2. thinking_02.wav - "Processing your question."
3. thinking_03.wav - "Just a second."
4. thinking_04.wav - "Hmm let me check that for you."
5. thinking_05.wav - "Hold on, Joy is thinking."

Format specifications:
- Sample Rate: 16000 Hz
- Bit Depth: 16-bit Signed Integer PCM
- Channels: 1 (Mono)
- Format: Valid Canonical RIFF WAVE
- Duration: 500ms - 2500ms
"""

import math
import os
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import wave

SAMPLE_RATE = 16000
AUDIO_DIR = Path(__file__).resolve().parent

THINKING_CLIPS = {
    "thinking_01.wav": {
        "phrase": "Let me think for a moment.",
        "contract_phrase": "let me think for a moment",
        "duration": 1.15,
        "rate": "+25%",
        "tempo": 1.1,
        "notes": [(523.25, 0.8), (659.25, 0.9), (783.99, 1.0), (987.77, 0.9), (1046.50, 1.0)],
    },
    "thinking_02.wav": {
        "phrase": "Processing your question.",
        "contract_phrase": "processing your question",
        "duration": 1.25,
        "rate": "+35%",
        "tempo": 1.45,
        "notes": [(698.46, 0.75), (880.00, 0.85), (1046.50, 1.0), (1318.51, 0.9), (1174.66, 0.8)],
    },
    "thinking_03.wav": {
        "phrase": "Just a second.",
        "contract_phrase": "just a second",
        "duration": 1.1,
        "rate": "+15%",
        "tempo": 1.0,
        "notes": [(783.99, 0.8), (987.77, 0.9), (1174.66, 1.0), (1567.98, 0.95)],
    },
    "thinking_04.wav": {
        "phrase": "Hmm let me check that for you.",
        "contract_phrase": "hmm let me check that for you",
        "duration": 1.2,
        "rate": "+30%",
        "tempo": 1.2,
        "notes": [(587.33, 0.75), (739.99, 0.85), (880.00, 0.95), (1108.73, 1.0), (1318.51, 0.85)],
    },
    "thinking_05.wav": {
        "phrase": "Hold on, Joy is thinking.",
        "contract_phrase": "hold on joy is thinking",
        "duration": 1.2,
        "rate": "+25%",
        "tempo": 1.15,
        "notes": [(659.25, 0.8), (830.61, 0.9), (987.77, 1.0), (1318.51, 0.95)],
    },
}

PIPER_MODEL_NAME = "en_GB-semaine-medium"
PIPER_SPEAKER_NAME = "prudence"
PIPER_SPEAKER_ID = 0


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


def generate_piper_clip(text: str, out_path: Path, model_path: Path | None = None, config_path: Path | None = None):
    """Synthesize speech using piper-tts and normalize to 16kHz 16-bit mono WAV."""
    from piper import PiperVoice, SynthesisConfig

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_raw:
        tmp_raw_path = tmp_raw.name

    try:
        if model_path and model_path.exists():
            voice = PiperVoice.load(model_path, config_path=config_path, use_cuda=False)
        else:
            from piper.download import find_voice
            model_p, config_p = find_voice(PIPER_MODEL_NAME)
            voice = PiperVoice.load(model_p, config_path=config_p, use_cuda=False)

        syn_config = SynthesisConfig(speaker_id=PIPER_SPEAKER_ID)
        with wave.open(tmp_raw_path, "wb") as wf:
            voice.synthesize_wav(text, wf, syn_config=syn_config)

        ffmpeg_bin = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg" or "ffmpeg"
        af_filter = (
            "silenceremove=start_periods=1:start_duration=0.01:start_threshold=-35dB,"
            "areverse,silenceremove=start_periods=1:start_duration=0.01:start_threshold=-35dB,areverse,"
            "loudnorm=I=-16:TP=-1.5:LRA=11"
        )

        cmd = [
            ffmpeg_bin, "-y",
            "-i", tmp_raw_path,
            "-af", af_filter,
            "-ar", str(SAMPLE_RATE),
            "-ac", "1",
            "-c:a", "pcm_s16le",
            str(out_path)
        ]
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    finally:
        if os.path.exists(tmp_raw_path):
            os.unlink(tmp_raw_path)

def generate_all_clips():
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    generated_files = []

    has_piper = False
    try:
        import piper
        has_piper = True
    except ImportError:
        pass

    for filename, info in THINKING_CLIPS.items():
        out_path = AUDIO_DIR / filename
        used_tts = False

        if has_piper:
            try:
                generate_piper_clip(info["phrase"], out_path)
                used_tts = True
            except Exception as e:
                print(f"Warning: Piper TTS synthesis for {filename} failed ({e}), falling back to harmonic synthesizer")
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

            mode_str = f"Spoken Voice (Piper {PIPER_MODEL_NAME}:{PIPER_SPEAKER_NAME})" if used_tts else "Synthesized Harmonic"
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
