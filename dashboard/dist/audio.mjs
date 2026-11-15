const audio = document.querySelector('#ambient-audio');
const player = document.querySelector('#sound-player');
const toggle = document.querySelector('#sound-toggle');
const controls = document.querySelector('#sound-controls');
const play = document.querySelector('#sound-play');
const playLabel = document.querySelector('#sound-play-label');
const playIcon = document.querySelector('#sound-play-icon');
const mute = document.querySelector('#sound-mute');
const slider = document.querySelector('#sound-volume');
const output = document.querySelector('#sound-volume-value');
const status = document.querySelector('#sound-status');
const storageKey = 'soraine-sound-v1';
let volume = .22, muted = false, lastAudible = .22, desiredPlaying = false, request = 0;
let context, gain, source;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
  if (saved && typeof saved.volume === 'number' && Number.isFinite(saved.volume)) volume = Math.max(0, Math.min(1, saved.volume));
  muted = saved?.muted === true;
  if (volume > 0) lastAudible = volume;
} catch { /* Audio remains usable without browser storage. */ }
audio.volume = volume;
audio.muted = muted;
function applyVolume() {
  if (gain) gain.gain.setTargetAtTime(volume, context.currentTime, .025);
  else audio.volume = volume;
  audio.muted = muted;
}
function prepareAudio() {
  // The graph is created only in a play gesture. Gain also works on iOS,
  // where the media element's volume is controlled by the device.
  if (!context) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      context = new AudioContext();
      source = context.createMediaElementSource(audio);
      gain = context.createGain();
      source.connect(gain); gain.connect(context.destination);
      gain.gain.value = volume;
      audio.volume = 1;
    }
  }
  return context?.resume();
}
function playbackStatus() {
  status.textContent = audio.paused ? 'Paused.' : muted || volume === 0 ? 'Playing silently. Unmute to listen.' : 'Playing · seamless loop';
}
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify({volume, muted})); } catch {}
}
function render() {
  const silent = muted || volume === 0;
  toggle.classList.toggle('is-playing', !audio.paused && !silent);
  play.setAttribute('aria-pressed', String(desiredPlaying));
  playLabel.textContent = desiredPlaying ? 'Pause music' : 'Play music';
  playIcon.textContent = desiredPlaying ? 'Ⅱ' : '▶';
  mute.setAttribute('aria-pressed', String(silent));
  mute.setAttribute('aria-label', silent ? 'Unmute music' : 'Mute music');
  mute.title = silent ? 'Unmute music' : 'Mute music';
  mute.querySelector('path').setAttribute('d', silent ? 'M11 4 5 9H2v6h3l6 5V4m5 5 6 6m0-6-6 6' : 'M11 4 5 9H2v6h3l6 5V4m4 4q4 4 0 8m3-11q7 7 0 14');
  slider.value = String(Math.round(volume * 100));
  output.textContent = `${Math.round(volume * 100)}%`;
}
function setOpen(open, restoreFocus = false) {
  controls.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
  if (open) play.focus();
  else if (restoreFocus) toggle.focus();
}
toggle.addEventListener('click', () => setOpen(controls.hidden));
document.querySelector('#sound-close').addEventListener('click', () => setOpen(false, true));
document.addEventListener('pointerdown', event => { if (!controls.hidden && !player.contains(event.target)) setOpen(false); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !controls.hidden) { setOpen(false, true); event.preventDefault(); }
});
play.addEventListener('click', async () => {
  const current = ++request;
  desiredPlaying = !desiredPlaying;
  if (!desiredPlaying) { audio.pause(); status.textContent = 'Paused.'; render(); return; }
  // Request the audio only after an explicit play gesture, never on page load.
  if (!audio.getAttribute('src')) audio.src = audio.canPlayType('audio/mp4; codecs="mp4a.40.2"') ? './assets/audio/soraine-quiet-orbit.m4a' : './assets/audio/soraine-quiet-orbit.wav';   // the AAC copy is about a tenth of the download
  if (audio.error) audio.load();
  status.textContent = 'Loading music…';
  render();
  try {
    const ready = prepareAudio();
    await Promise.all([ready, audio.play()]);
    if (current !== request) return;
    playbackStatus();
    render();
  } catch {
    if (current !== request) return;
    desiredPlaying = false;
    audio.pause();
    status.textContent = 'Music could not start. Tap Play to try again.';
    render();
  }
});
mute.addEventListener('click', () => {
  if (muted || volume === 0) { muted = false; if (volume === 0) volume = lastAudible; }
  else muted = true;
  applyVolume();
  playbackStatus();
  save(); render();
});
slider.addEventListener('input', () => {
  volume = Number(slider.value) / 100;
  if (volume > 0) { lastAudible = volume; muted = false; }
  applyVolume();
  playbackStatus();
  save(); render();
});
audio.addEventListener('error', () => {
  ++request; desiredPlaying = false; audio.pause();
  status.textContent = 'Music could not load. Tap Play to try again.';
  render();
});
audio.addEventListener('playing', () => { desiredPlaying = !audio.paused; playbackStatus(); render(); });
audio.addEventListener('pause', () => {
  if (audio.paused && desiredPlaying) { ++request; desiredPlaying = false; playbackStatus(); }
  render();
});
audio.addEventListener('volumechange', render);
window.addEventListener('pagehide', () => { ++request; desiredPlaying = false; audio.pause(); render(); });
render();
