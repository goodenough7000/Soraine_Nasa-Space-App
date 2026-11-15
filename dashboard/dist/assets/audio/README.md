# Soraine: Quiet Orbit

An original, gentle instrumental for the Soraine dashboard: soft celesta, a sparse harp accompaniment, warm sustained tones, and a quiet bass in 3/4 time. The sixteen-bar loop lasts 53.33 seconds at 54 BPM.

The score and sounds were created for this project with Python and NumPy. All tones are synthesized; no music recordings, game audio, or external samples were used. The full note sequence and synthesis code are in `scripts/compose-observatory.py`.

`soraine-quiet-orbit.wav` is a stereo, 24 kHz, 16-bit PCM file. Note decays and reverb wrap around the loop boundary. The accompanying render report records duration, levels, clipping and boundary checks.

Start playback only after the visitor chooses it. Keep the volume gentle and make pause, mute and volume controls available.
