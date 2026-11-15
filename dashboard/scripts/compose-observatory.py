"""Render Soraine: Quiet Orbit from its original score and synthesized tones.

Requires only Python and NumPy. No recordings or external samples are used.
Run from any directory; the WAV and render report go to dist/assets/audio/.
"""

from __future__ import annotations

import json
from pathlib import Path
import wave

import numpy as np


SAMPLE_RATE = 24_000
BPM = 54
BEAT = 60.0 / BPM
BAR = 3 * BEAT
BARS = 16
SAMPLES = round(BARS * BAR * SAMPLE_RATE)
DESTINATION = Path(__file__).resolve().parents[1] / "dist" / "assets" / "audio"
TITLE = "Soraine: Quiet Orbit"
mix = np.zeros((SAMPLES, 2), dtype=np.float64)

# A sixteen-bar original waltz in E major. Numbers are MIDI note pitches.
# The last suspended dominant opens naturally into the first E-major chord.
CHORDS = [
    ("Emaj9", 40, [52, 59, 63, 66, 68]),
    ("Emaj9", 40, [52, 59, 63, 66, 68]),
    ("C#m9", 37, [52, 56, 59, 63, 68]),
    ("C#m9", 37, [52, 56, 59, 63, 68]),
    ("Amaj9", 33, [52, 57, 59, 61, 68]),
    ("Amaj9", 33, [52, 57, 59, 61, 68]),
    ("F#m9", 42, [54, 57, 61, 64, 68]),
    ("B9sus", 35, [54, 57, 59, 61, 64]),
    ("Emaj9", 40, [52, 59, 63, 66, 68]),
    ("G#m7", 44, [54, 56, 59, 63, 66]),
    ("Amaj9", 33, [52, 57, 59, 61, 68]),
    ("F#m9", 42, [54, 57, 61, 64, 68]),
    ("C#m9", 37, [52, 56, 59, 63, 68]),
    ("Amaj9", 33, [52, 57, 59, 61, 68]),
    ("B9sus", 35, [54, 57, 59, 61, 64]),
    ("Badd9", 35, [54, 59, 61, 63, 66]),
]

# Each event is (beat within bar, pitch, duration in beats, relative velocity).
# Deliberate rests give the melody room to breathe over the repeating harp.
MELODY = [
    [(0.5, 78, 1.3, .78), (2.0, 80, .8, .62)],
    [(0.0, 75, 1.8, .73), (2.0, 73, .8, .58)],
    [(0.5, 76, 1.0, .74), (1.75, 80, 1.0, .65)],
    [(0.0, 78, 2.0, .71)],
    [(0.5, 73, 1.0, .70), (1.75, 71, 1.0, .57)],
    [(0.0, 76, 1.8, .73), (2.0, 75, .7, .60)],
    [(0.5, 73, 1.6, .68)],
    [(0.0, 71, 1.0, .65), (1.5, 66, 1.3, .56)],
    [(0.5, 75, .9, .72), (1.75, 78, 1.0, .65)],
    [(0.0, 83, 1.8, .67), (2.0, 82, .7, .52)],
    [(0.5, 80, .9, .70), (1.75, 76, 1.0, .62)],
    [(0.0, 78, 1.8, .70)],
    [(0.5, 75, .8, .68), (1.5, 73, 1.2, .59)],
    [(0.0, 76, 1.0, .70), (1.5, 80, 1.2, .59)],
    [(0.5, 78, 1.6, .65)],
    [(0.0, 75, 1.4, .61), (1.75, 73, .8, .48)],
]


def frequency(midi: int) -> float:
    return 440.0 * 2 ** ((midi - 69) / 12)


def place(sound: np.ndarray, seconds: float, pan: float = 0.0) -> None:
    """Circular overlap-add preserves every decay across the loop boundary."""
    start = round(seconds * SAMPLE_RATE) % SAMPLES
    gains = np.array([np.cos((pan + 1) * np.pi / 4),
                      np.sin((pan + 1) * np.pi / 4)])
    stereo = sound[:, None] * gains[None, :]
    first = min(len(sound), SAMPLES - start)
    mix[start:start + first] += stereo[:first]
    if first < len(sound):
        mix[:len(sound) - first] += stereo[first:]


def fade_tail(sound: np.ndarray, seconds: float = .15) -> np.ndarray:
    count = min(len(sound), round(seconds * SAMPLE_RATE))
    sound[-count:] *= np.cos(np.linspace(0, np.pi / 2, count)) ** 2
    return sound


def celesta(note: int, hold: float, velocity: float) -> np.ndarray:
    t = np.arange(round((hold + 3.2) * SAMPLE_RATE)) / SAMPLE_RATE
    f = frequency(note)
    attack = 1 - np.exp(-(t / .024) ** 2)
    # Primarily harmonic, with a very quiet glass partial rather than a sharp bell.
    tone = (
        np.sin(2 * np.pi * f * t) * np.exp(-t / 1.8)
        + .20 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / .78)
        + .055 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t / .42)
        + .018 * np.sin(2 * np.pi * 2.756 * f * t) * np.exp(-t / .55)
    )
    release = np.exp(-np.maximum(t - hold, 0) / .85)
    return fade_tail(.15 * velocity * attack * tone * release)


def harp(note: int, velocity: float) -> np.ndarray:
    t = np.arange(round(3.0 * SAMPLE_RATE)) / SAMPLE_RATE
    f = frequency(note)
    attack = 1 - np.exp(-(t / .018) ** 2)
    tone = (
        np.sin(2 * np.pi * f * t) * np.exp(-t / .95)
        + .19 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / .48)
        + .05 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t / .22)
    )
    return fade_tail(.075 * velocity * attack * tone)


def pad(note: int, length: float, voice: int) -> np.ndarray:
    t = np.arange(round(length * SAMPLE_RATE)) / SAMPLE_RATE
    f = frequency(note)
    attack = np.sin(np.clip(t / .95, 0, 1) * np.pi / 2) ** 2
    release = np.sin(np.clip((length - t) / 1.25, 0, 1) * np.pi / 2) ** 2
    # Very small detuning supplies width without a synthetic choir or hiss.
    phase = .22 * np.sin(2 * np.pi * .09 * t + voice)
    tone = (
        .66 * np.sin(2 * np.pi * f * t + phase)
        + .23 * np.sin(2 * np.pi * f * 1.0011 * t)
        + .09 * np.sin(2 * np.pi * 2 * f * t + .4)
        + .02 * np.sin(2 * np.pi * 3 * f * t)
    )
    return .027 * tone * attack * release


def bass(note: int) -> np.ndarray:
    t = np.arange(round(3.6 * SAMPLE_RATE)) / SAMPLE_RATE
    f = frequency(note)
    env = (1 - np.exp(-(t / .12) ** 2)) * np.exp(-t / 1.5)
    return fade_tail(.092 * env * (np.sin(2 * np.pi * f * t)
                                  + .11 * np.sin(2 * np.pi * 2 * f * t)))


def render() -> np.ndarray:
    for bar, (name, root, notes) in enumerate(CHORDS):
        start = bar * BAR
        for voice, note in enumerate(notes):
            # Starting slightly early creates a continuous bed under the downbeat.
            place(pad(note, BAR + 1.6, voice), start - .55,
                  [-.7, .45, -.3, .7, .05][voice])
        place(bass(root), start + .015, -.06)
        pattern = [notes[1], notes[3], notes[2] + 12]
        for step, note in enumerate(pattern):
            placement = start + (.04 + step + (.025 if step == 1 else 0)) * BEAT
            place(harp(note, [.72, .55, .58][step]), placement,
                  [-.42, .37, -.15][step])
        # A quiet answering upper note every other bar avoids a busy ostinato.
        if bar % 2 == 1:
            place(harp(notes[-1] + 12, .28), start + 2.5 * BEAT, .46)
        for beat, note, duration, velocity in MELODY[bar]:
            place(celesta(note, duration * BEAT, velocity), start + beat * BEAT,
                  -.08 + .13 * np.sin(bar * .7))

    dry = mix.copy()
    # Circular, darkened reverb: the final bar's tail is already present at start.
    wet = np.zeros_like(dry)
    delays = [.071, .113, .181, .293, .419, .613, .887, 1.211, 1.637, 2.117]
    for i, delay in enumerate(delays):
        source = dry[:, ::-1] if i % 2 else dry
        wet += np.roll(source, round(delay * SAMPLE_RATE), axis=0) * (.16 * .78 ** i)
    spectrum = np.fft.rfft(wet, axis=0)
    frequencies = np.fft.rfftfreq(SAMPLES, 1 / SAMPLE_RATE)
    # Softly remove high-frequency reflections and excess low-end reverberation.
    shape = (1 / (1 + (frequencies / 2600) ** 4)) * (frequencies / (frequencies + 90))
    wet = np.fft.irfft(spectrum * shape[:, None], n=SAMPLES, axis=0)
    output = dry + .64 * wet
    output -= output.mean(axis=0)
    target_rms = .105
    output *= min(target_rms / np.sqrt(np.mean(output ** 2)),
                  .72 / np.max(np.abs(output)))
    return output


def main() -> None:
    audio = render()
    assert np.isfinite(audio).all(), "Audio contains a non-finite sample"
    peak = float(np.max(np.abs(audio)))
    rms = float(np.sqrt(np.mean(audio ** 2)))
    assert peak < .73 and .03 < rms < .13
    differences = np.diff(audio, axis=0)
    boundary = audio[0] - audio[-1]
    # Compare the circular join to ordinary adjacent samples, rather than silence.
    step_rms = float(np.sqrt(np.mean(differences ** 2)))
    assert float(np.max(np.abs(boundary))) < max(.03, 8 * step_rms)
    one_second_rms = [float(np.sqrt(np.mean(chunk ** 2)))
                      for chunk in np.array_split(audio, round(SAMPLES / SAMPLE_RATE))]
    assert min(one_second_rms) > .005, "Unexpected silent section"

    DESTINATION.mkdir(parents=True, exist_ok=True)
    wav_path = DESTINATION / "soraine-quiet-orbit.wav"
    pcm = np.round(audio * 32767).astype("<i2")
    with wave.open(str(wav_path), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(pcm.tobytes())
    report = {
        "title": TITLE,
        "file": wav_path.name,
        "duration_seconds": SAMPLES / SAMPLE_RATE,
        "bytes": wav_path.stat().st_size,
        "format": "PCM signed 16-bit stereo WAV",
        "sample_rate": SAMPLE_RATE,
        "tempo_bpm": BPM,
        "meter": "3/4",
        "bars": BARS,
        "peak_dbfs": round(20 * np.log10(peak), 2),
        "rms_dbfs": round(20 * np.log10(rms), 2),
        "clipped_samples": int(np.sum(np.abs(audio) >= 1)),
        "finite": bool(np.isfinite(audio).all()),
        "boundary_step_left_right": [round(float(v), 8) for v in boundary],
        "ordinary_adjacent_step_rms": round(step_rms, 8),
        "minimum_one_second_rms": round(min(one_second_rms), 8),
        "source_recordings": [],
        "composition": "Original score in scripts/compose-observatory.py",
    }
    (DESTINATION / "soraine-quiet-orbit.render.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
