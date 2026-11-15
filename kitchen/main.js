import * as THREE from 'three';
import { WORLD, SWEEP, SWEEP_GLSL, SWEEP_FN, buildKitchen, buildFlame, buildSky, buildLights } from './scene.js?v=meadow-20261114';
import { buildStars } from './stars.js?v=meadow-20261114';
import { buildTerrain } from './terrain.js?v=meadow-20261114';
import { Props } from './props.js?v=meadow-20261114';
import { WavePass, Wave } from './wave.js?v=meadow-20261114';
import { Pages } from './pages.js?v=meadow-20261114';

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const LITE = new URLSearchParams(location.search).has('lite');
renderer.setPixelRatio(LITE ? 1 : Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = !LITE; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping; // tone mapping happens in the post pass
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe8e3d6, 30, 110);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 900);

const kitchen = buildKitchen(scene);
const flame = buildFlame(scene);
// No tufts on the kitchen footprint or where the camera rigs stand (world metres).
const KEEP_OUT = [[-1.85, -0.75, 0.85, 0.75], [0.6, -0.75, 2.85, 0.75], [-1.85, 0.3, -0.4, 2.1]];
const STANDS = [[0.35, 1.75, 0.9], [-2.6, 3.4, 1.1]];
const keepOut = (x, z) => KEEP_OUT.some(([x0, z0, x1, z1]) => x > x0 && x < x1 && z > z0 && z < z1) || STANDS.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r);
const terrain = buildTerrain(scene, SWEEP, SWEEP_GLSL, SWEEP_FN, { keepOut });
const stars = buildStars(scene);
const sky = buildSky(scene);
const lights = buildLights(scene);
const pass = new WavePass(renderer);
const wave = new Wave(WORLD.flame);
const props = new Props(scene, camera, canvas, WORLD.flame);

// ---------- camera rigs ----------
const RIG = {
  landing: { pos: new THREE.Vector3(WORLD.pan.x + 0.02, WORLD.pan.y + 0.95, WORLD.pan.z + 0.03), look: WORLD.pan.clone(), fov: 38 },
  cook:    { pos: new THREE.Vector3(0.35, 1.6, 1.75), look: new THREE.Vector3(0.1, 1.33, 0.0), fov: 48 },
  detail:  { pos: new THREE.Vector3(0.42, 1.18, 0.55), look: new THREE.Vector3(0.05, 0.94, 0.08), fov: 34 },
  about:   { pos: new THREE.Vector3(-2.6, 1.5, 3.4), look: new THREE.Vector3(0.6, 0.8, 0.2), fov: 44 }
};
const cam = { pos: RIG.landing.pos.clone(), look: RIG.landing.look.clone(), fov: RIG.landing.fov, from: null, to: RIG.landing, t: 1, dur: 1 };
function snap(rig) { cam.pos.copy(rig.pos); cam.look.copy(rig.look); cam.fov = rig.fov; cam.t = 1; cam.to = rig; }
function goTo(rig, dur = 1.6) { cam.from = { pos: cam.pos.clone(), look: cam.look.clone(), fov: cam.fov }; cam.to = rig; cam.t = 0; cam.dur = dur; }
const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ---------- scenarios / environment ----------
let scenarios = [], current = null, target = null, blend = 1;   // env blends when the wave reaches the camera
const env = { sky: new THREE.Color(), hor: new THREE.Color(), sun: new THREE.Color(), elev: 48, az: 215 };
const flameState = { height: 1, width: 1, blue: 0, sphere: 0, flicker: 1 };
const flameTarget = { ...flameState };
let flameSwept = true;

function sunVector(elev, az) { const e = THREE.MathUtils.degToRad(elev), a = THREE.MathUtils.degToRad(az); return new THREE.Vector3(Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)); }
// Lighting / fog / sky lerp between two scenario states. The sky dome does its own horizon-first wipe from k.
function applyEnv(a, b, k) {
  env.sky.setRGB(...a.sky).lerp(new THREE.Color(...b.sky), k);
  env.hor.setRGB(...a.horizon).lerp(new THREE.Color(...b.horizon), k);
  env.sun.setRGB(...a.sun).lerp(new THREE.Color(...b.sun), k);
  env.elev = THREE.MathUtils.lerp(a.sunElev, b.sunElev, k);
  let dAz = ((b.sunAz - a.sunAz + 540) % 360) - 180; env.az = a.sunAz + dAz * k;   // shortest way round
  const U = sky.uniforms;
  U.uTopA.value.setRGB(...a.sky); U.uHorA.value.setRGB(...a.horizon); U.uSunColA.value.setRGB(...a.sun);
  stars.uniforms.uAlpha.value = (a.void ? 1 - k : 0) + (b.void ? k : 0);
  U.uTopB.value.setRGB(...b.sky); U.uHorB.value.setRGB(...b.horizon); U.uSunColB.value.setRGB(...b.sun); U.uK.value = k;
  const sv = sunVector(env.elev, env.az); U.uSunDir.value.copy(sv);
  lights.sun.position.copy(sv).multiplyScalar(18); lights.sun.color.copy(env.sun);
  const day = THREE.MathUtils.smoothstep(env.elev, 5, 35);
  lights.sun.intensity = 0.9 + 1.9 * day; lights.hemi.intensity = 0.25 + 0.35 * day;
  lights.hemi.color.copy(env.sky).lerp(new THREE.Color(1, 1, 1), 0.3); lights.hemi.groundColor.copy(env.hor).multiplyScalar(0.45);
  lights.fill.intensity = 0.15 + 0.25 * day;
  scene.fog.color.copy(env.hor); scene.fog.near = THREE.MathUtils.lerp(a.fogNear, b.fogNear, k); scene.fog.far = THREE.MathUtils.lerp(a.fogFar, b.fogFar, k); pass.uniforms.uExposure.value = 0.95 + 0.25 * day;
}
// Blended snapshot, used when a new scan starts before the previous one finished (no snap back).
function mixScenario(a, b, k) {
  const L = (x, y) => x + (y - x) * k, V = (x, y) => x.map((v, i) => L(v, y[i]));
  return { ...b, g: L(a.g, b.g), sky: V(a.sky, b.sky), horizon: V(a.horizon, b.horizon), sun: V(a.sun, b.sun),
    sunElev: L(a.sunElev, b.sunElev), sunAz: env.az, fogNear: L(a.fogNear, b.fogNear), fogFar: L(a.fogFar, b.fogFar), terrain: k < 0.5 ? a.terrain : b.terrain, ground: V(a.ground, b.ground), void: k < 0.5 ? a.void : b.void };
}
function setTerrain(a, b) {
  SWEEP.uGroundOld.value.setRGB(...a.ground); SWEEP.uGroundNew.value.setRGB(...b.ground);
  terrain.set(a, b);
}
function selectScenario(slug, immediate = false) {
  const s = scenarios.find(x => x.slug === slug); if (!s || (current && s === current && !immediate)) return;
  if (immediate || !current) { current = target = s; blend = 1; Object.assign(flameTarget, s.flame); Object.assign(flameState, s.flame); applyEnv(s, s, 1); setTerrain(s, s); SWEEP.uRadius.value = 1e5; props.setGravity(s.g, s.g, -1); }
  else { if (wave.active) { current = mixScenario(current, target, blend); } target = s; blend = 0; Object.assign(flameTarget, s.flame); flameSwept = false; setTerrain(current, target); wave.fire(); props.fire(current.g, target.g); }
  pages.setScenario(s);
}
wave.onSweep = () => { /* environment crossfade begins when the front reaches the camera */ };

// ---------- pages ----------
const pages = new Pages({
  onPage: (p) => { goTo(RIG[p] || RIG.cook, 1.5); pass.uniforms.uDof.value = 0; },
  onScenario: (slug) => selectScenario(slug)
});

document.getElementById('start').addEventListener('click', () => {
  document.getElementById('landing').classList.add('gone');
  goTo(RIG.cook, 2.4);
  setTimeout(() => { document.getElementById('dots').hidden = false; pages.show('observe'); }, 900);
});

// ---------- resize ----------
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  const s = renderer.getDrawingBufferSize(new THREE.Vector2()); pass.setSize(s.x, s.y);
}
addEventListener('resize', resize); resize();

// ---------- loop ----------
const clock = new THREE.Clock(); let time = 0;
const tmpUp = new THREE.Vector3(0, 1, 0);
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05); time += dt;
  // camera tween
  if (cam.t < 1) {
    cam.t = Math.min(1, cam.t + dt / cam.dur); const k = ease(cam.t);
    cam.pos.lerpVectors(cam.from.pos, cam.to.pos, k); cam.look.lerpVectors(cam.from.look, cam.to.look, k); cam.fov = THREE.MathUtils.lerp(cam.from.fov, cam.to.fov, k);
  }
  // idle drift (breathing) in cook view
  const drift = pages.page === 'observe' ? 1 : 0.4;
  camera.position.copy(cam.pos); camera.position.x += Math.sin(time * 0.45) * 0.012 * drift; camera.position.y += Math.sin(time * 0.7) * 0.008 * drift;
  camera.fov = cam.fov; camera.updateProjectionMatrix();
  camera.lookAt(cam.look);
  // wave + shake
  wave.update(dt, camera.position);
  const sh = wave.shake(camera.position, time);
  if (sh) { camera.position.add(new THREE.Vector3(sh.x, sh.y, 0).applyQuaternion(camera.quaternion)); camera.rotateZ(sh.roll); }
  SWEEP.uRadius.value = wave.active ? wave.R : 1e5; SWEEP.uSweepW.value = wave.trail() * 0.8; props.R = wave.active ? wave.R : 1e5; props.update(dt, time);
  pass.uniforms.uRadius.value = wave.R; pass.uniforms.uStrength.value = wave.strength(); pass.uniforms.uCenter.value.copy(wave.center);
  pass.uniforms.uTrail.value = wave.trail(); pass.uniforms.uSpacing.value = 0.25 + Math.max(wave.R, 0) * 0.045;   // lines ride with the front, so spacing can grow
  // flame morphs as soon as the wave leaves it (it is the origin)
  if (!flameSwept && wave.active) flameSwept = true;
  const fk = 1 - Math.exp(-dt * 2.2);
  for (const key in flameState) flameState[key] += (flameTarget[key] - flameState[key]) * fk;
  flame.uniforms.uTime.value = time; flame.uniforms.uBlue.value = flameState.blue; flame.uniforms.uSphere.value = flameState.sphere; flame.uniforms.uFlicker.value = flameState.flicker;
  flame.mesh.scale.set(flameState.width, flameState.height, flameState.width); flame.inner.scale.set(flameState.width * 0.5, flameState.height * 0.65, flameState.width * 0.5);
  flame.light.color.setRGB(1, 0.63, 0.25).lerp(new THREE.Color(0.45, 0.6, 1), flameState.blue);
  flame.light.intensity = (1.6 + 0.6 * Math.sin(time * 17) * flameState.flicker + 0.3 * Math.sin(time * 5.1) * flameState.flicker) * (0.45 + 0.55 * flameState.height);
  // environment crossfade once the front has passed the camera
  if (target && current !== target) {
    const dCam = camera.position.distanceTo(WORLD.flame);
    blend = wave.active ? THREE.MathUtils.smoothstep(wave.R, dCam * 0.6, 60) : 1;
    applyEnv(current, target, blend);
    if (!wave.active) { current = target; setTerrain(current, current); }
  }
  // detail page DoF
  const wantDof = pages.page === 'detail' ? 1 : 0; pass.uniforms.uDof.value += (wantDof - pass.uniforms.uDof.value) * (1 - Math.exp(-dt * 3));
  pass.uniforms.uFocus.value = camera.position.distanceTo(WORLD.pan);
  terrain.update(time, camera);
  stars.uniforms.uTime.value = time;
  lights.sun.target.position.set(0.3, 0.8, 0.2);
  pass.render(scene, camera);
  requestAnimationFrame(frame);
}

fetch('data/scenarios.json').then(r => r.json()).then(d => {
  scenarios = d.scenarios; terrain.preload(scenarios); pages.setScenarios(scenarios); selectScenario('earth', true); frame();
}).catch(e => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<pre style="position:fixed;left:12px;bottom:12px;color:#fff">${e}</pre>`); });

window.__kitchen = { terrain, props, pass, scene, camera, wave, selectScenario, goTo, snap, RIG, pages, env: () => ({ current: current?.slug, target: target?.slug, blend, R: wave.R }) };
