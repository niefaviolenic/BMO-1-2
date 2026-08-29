#!/usr/bin/env python3
"""
Generate canonical facial expression WAV files for Joy using Piper TTS.
Voice persona matches Joy Backend: en_GB-semaine-medium (prudence, speaker_id=0).

Clips:
1. 01.wav - "I am happy"
2. 02.wav - "I am cute"
3. 03.wav - "I am excited"
4. 04.wav - "I am sleepy"
5. 05.wav - "I am angry"
6. 06.wav - "I am sad"
7. 07.wav - "wink"
8. 08.wav - "I am surprised"
9. 09.wav - "I love you"
10. 10.wav - "I am confused"

Format specifications:
- Sample Rate: 16000 Hz
- Bit Depth: 16-bit Signed Integer PCM
- Channels: 1 (Mono)
- Format: Valid Canonical RIFF WAVE
"""

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import wave

SAMPLE_RATE = 16000
AUDIO_DIR = Path(__file__).resolve().parent

EXPRESSION_CLIPS = {
    "01.wav": "I am happy",
    "02.wav": "I am cute",
    "03.wav": "I am excited",
    "04.wav": "I am sleepy",
    "05.wav": "I am angry",
    "06.wav": "I am sad",
    "07.wav": "wink",
    "08.wav": "I am surprised",
    "09.wav": "I love you",
    "10.wav": "I am confused",
}

PIPER_MODEL_NAME = "en_GB-semaine-medium"
PIPER_SPEAKER_NAME = "prudence"
PIPER_SPEAKER_ID = 0


def generate_piper_clip(text: str, out_path: Path, model_path: Path | None = None, config_path: Path | None = None):
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

    for filename, text in EXPRESSION_CLIPS.items():
        out_path = AUDIO_DIR / filename
        generate_piper_clip(text, out_path)

        with wave.open(str(out_path), "rb") as wf:
            nchannels = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            framerate = wf.getframerate()
            nframes = wf.getnframes()
            dur_ms = (nframes * 1000) / framerate
            print(
                f"Generated {filename} (\"{text}\"): "
                f"{nchannels}ch, {sampwidth*8}bit, {framerate}Hz, {dur_ms:.1f}ms ({dur_ms/1000:.2f}s)"
            )
            assert nchannels == 1, "Must be mono"
            assert sampwidth == 2, "Must be 16-bit"
            assert framerate == 16000, "Must be 16kHz"

        generated_files.append(out_path)

    print(f"\nSuccessfully generated {len(generated_files)} expression clips in {AUDIO_DIR}")


if __name__ == "__main__":
    generate_all_clips()
