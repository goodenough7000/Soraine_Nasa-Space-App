// Space backdrop: a few geometric four-point stars that twinkle. Only visible while a "void" scenario is
// on screen (uAlpha follows the environment blend). Drawn at a fixed distance around the camera, no fog.
import * as THREE from 'three';

export function buildStars(scene, count = 180) {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count * 3);
  let s = 90211; const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    pos.set([Math.cos(a) * r * 300, u * 300, Math.sin(a) * r * 300], i * 3);
    const big = rnd() < 0.12;                                  // a handful of larger ones
    seed.set([rnd() * 6.28, 0.6 + rnd() * 2.2, big ? 16 + rnd() * 10 : 5 + rnd() * 4], i * 3);   // phase, speed, px size
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 3));
  const u = { uTime: { value: 0 }, uAlpha: { value: 0 }, uDpr: { value: Math.min(devicePixelRatio, 2) } };
  const m = new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 seed; uniform float uTime, uDpr; varying float vTw; varying float vBig;
      void main(){
        vTw = 0.55 + 0.45 * sin(uTime * seed.y + seed.x) * sin(uTime * seed.y * 0.53 + seed.x * 2.1);
        vBig = step(12.0, seed.z);
        gl_PointSize = seed.z * uDpr * (0.8 + 0.35 * vTw);
        vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform float uAlpha; varying float vTw; varying float vBig;
      void main(){
        vec2 p = abs(gl_PointCoord - 0.5) * 2.0;
        // four-point star: thin cross arms + small diamond core (geometric, no texture)
        float arms = max(1.0 - smoothstep(0.0, 0.12, p.y) , 0.0) * (1.0 - p.x) + max(1.0 - smoothstep(0.0, 0.12, p.x), 0.0) * (1.0 - p.y);
        float core = 1.0 - smoothstep(0.18, 0.32, p.x + p.y);
        float a = clamp(mix(core, max(core, arms * 0.8), vBig), 0.0, 1.0) * vTw * uAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vec3(0.9, 0.93, 1.0) * a * 1.8, a);
      }`
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; pts.renderOrder = -0.5; scene.add(pts);
  return { points: pts, uniforms: u };
}
