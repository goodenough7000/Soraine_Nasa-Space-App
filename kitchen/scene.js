// Placeholder white-model kitchen on a grassland. All props are primitives; swap for GLB later.
import * as THREE from 'three';

export const WORLD = {
  stove: new THREE.Vector3(0, 0, 0),          // stove block centre (ground level)
  counterH: 0.9,
  pan: new THREE.Vector3(0.05, 1.04, 0.08),   // pan bottom centre (sits on trivet)
  flame: new THREE.Vector3(0.05, 0.955, 0.08) // wave origin (burner top)
};

// Shared by ground + grass: everything closer to the flame than uRadius shows the NEW state.
export const SWEEP = { uCenter: { value: new THREE.Vector3(0.05, 0.955, 0.08) }, uRadius: { value: 1e5 }, uSweepW: { value: 1 },
  uGroundOld: { value: new THREE.Color(0.33, 0.41, 0.23) }, uGroundNew: { value: new THREE.Color(0.33, 0.41, 0.23) },
  uGrassOld: { value: new THREE.Color(0.56, 0.71, 0.35) }, uGrassNew: { value: new THREE.Color(0.56, 0.71, 0.35) },
  uGrassKeepOld: { value: 1 }, uGrassKeepNew: { value: 1 } };
export const SWEEP_GLSL = `uniform vec3 uCenter; uniform float uRadius, uSweepW; varying vec3 vSweepW;`;
// 0 ahead of the front, 1 once the trail (width uSweepW) has fully passed: the change is spread under the scan lines
export const SWEEP_FN = `float sweepMix(vec3 p){ return 1.0 - smoothstep(uRadius - uSweepW, uRadius, distance(p, uCenter)); }`;
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0.0, ...o });
const M = {
  white: mat(0xf2efe8),
  dark: mat(0x3a3a3c, { roughness: 0.6, metalness: 0.3 }),
  wood: mat(0xb98a5a, { roughness: 0.75 }),
  woodDark: mat(0x8e6540),
  steel: mat(0x9ea3a8, { roughness: 0.35, metalness: 0.8 }),
  pan: mat(0x2c2a28, { roughness: 0.5, metalness: 0.4 }),
  eggWhite: mat(0xfbf7ee, { roughness: 0.55, side: THREE.DoubleSide }),
  yolk: mat(0xf2a62b, { roughness: 0.4 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x9ec9a2, roughness: 0.15, transmission: 0.6, thickness: 0.4, transparent: true }),
  ground: mat(0x55683a, { roughness: 1 })
};

function box(w, h, d, m, x, y, z, shadow = true) {
  const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  g.position.set(x, y, z); g.castShadow = shadow; g.receiveShadow = true; return g;
}
function cyl(rt, rb, h, m, x, y, z, seg = 32) {
  const g = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  g.position.set(x, y, z); g.castShadow = true; g.receiveShadow = true; return g;
}

export function buildKitchen(scene) {
  const root = new THREE.Group(); scene.add(root);
  const H = WORLD.counterH;

  // ground lives in terrain.js (NASA-textured, height-mapped)


  // stove block + wooden table in an L
  root.add(box(1.2, H, 0.9, M.white, 0, H / 2, 0));
  root.add(box(1.22, 0.04, 0.92, M.dark, 0, H + 0.02, 0));      // hob top
  root.add(box(1.9, H, 0.9, M.white, 1.6, H / 2, 0));           // cabinet
  root.add(box(1.95, 0.06, 0.95, M.wood, 1.6, H + 0.03, 0));    // wooden top
  root.add(box(0.9, H, 1.4, M.white, -1.1, H / 2, 1.1));        // return
  root.add(box(0.95, 0.06, 1.45, M.wood, -1.1, H + 0.03, 1.1));
  // plinth shadows
  root.add(box(1.1, 0.08, 0.8, M.dark, 0, 0.04, 0, false));

  // burner
  const burner = cyl(0.14, 0.14, 0.02, M.steel, WORLD.flame.x, H + 0.045, WORLD.flame.z);
  root.add(burner);
  const trivet = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const a = cyl(0.008, 0.008, 0.34, M.dark, 0, 0, 0, 8); a.rotation.z = Math.PI / 2; a.rotation.y = i * Math.PI / 4;
    a.position.set(WORLD.flame.x, H + 0.125, WORLD.flame.z); trivet.add(a);
  }
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; trivet.add(cyl(0.006, 0.006, 0.07, M.dark, WORLD.flame.x + Math.cos(a) * 0.15, H + 0.09, WORLD.flame.z + Math.sin(a) * 0.15, 8)); }
  root.add(trivet);
  for (let i = 0; i < 3; i++) root.add(cyl(0.025, 0.025, 0.03, M.dark, -0.4 + i * 0.12, H + 0.025, 0.4));  // knobs

  // pan
  const pan = new THREE.Group(); pan.position.copy(WORLD.pan); root.add(pan);
  const panBody = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.14, 0.035, 48, 1, true), M.pan);
  panBody.material = M.pan.clone(); panBody.material.side = THREE.DoubleSide; panBody.position.y = 0.0175; panBody.castShadow = true; panBody.receiveShadow = true; pan.add(panBody);
  const panFloor = new THREE.Mesh(new THREE.CircleGeometry(0.14, 48), M.pan); panFloor.rotation.x = -Math.PI / 2; panFloor.position.y = 0.002; panFloor.receiveShadow = true; pan.add(panFloor);
  const handle = cyl(0.014, 0.012, 0.28, M.dark, 0, 0.03, 0, 12); handle.rotation.z = Math.PI / 2 - 0.12; handle.position.set(0.3, 0.045, 0); pan.add(handle);

  // egg: irregular white (lathe), domed yolk
  const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(0.095 * Math.sin(t * Math.PI / 2 + 0.2) / Math.sin(Math.PI / 2 + 0.2), 0.012 * (1 - t * t))); }
  const white = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), M.eggWhite); white.position.set(-0.01, 0.004, 0.01); white.scale.set(1.15, 1, 0.95); white.castShadow = true; white.receiveShadow = true; pan.add(white);
  const yolk = new THREE.Mesh(new THREE.SphereGeometry(0.038, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.yolk); yolk.scale.y = 0.55; yolk.position.set(0.0, 0.014, 0.0); yolk.castShadow = true; pan.add(yolk);

  // loose props live in props.js (physics-driven)
  return { root, pan, yolk, white };
}

// Flame: a cone (buoyant) that morphs toward a sphere (microgravity). Emissive + point light.
export function buildFlame(scene) {
  const g = new THREE.Group(); g.position.copy(WORLD.flame); scene.add(g);
  const coneGeo = new THREE.ConeGeometry(0.055, 0.16, 24, 6, true);
  coneGeo.translate(0, 0.08, 0);
  
  const uniforms = { uTime: { value: 0 }, uBlue: { value: 0 }, uSphere: { value: 0 }, uFlicker: { value: 1 } };
  const material = new THREE.MeshBasicMaterial({ color: 0xffa23a, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
  material.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uniforms);
    s.vertexShader = `uniform float uTime,uSphere,uFlicker; varying float vH; varying vec3 vP;\n` + s.vertexShader.replace('#include <begin_vertex>', `
      vec3 transformed = position;
      float h = clamp(transformed.y/0.16,0.,1.); vH = h;
      // sphere morph: pull toward sphere of radius 0.075 centred at y=0.075
      vec3 toS = normalize(vec3(transformed.x, transformed.y-0.06, transformed.z)+1e-4)*0.06 + vec3(0.,0.06,0.);
      transformed = mix(transformed, toS, uSphere);
      // flicker: sideways sway growing with height
      float f = sin(uTime*18.+h*9.)*0.012 + sin(uTime*7.3+h*4.)*0.01;
      transformed.x += f*h*uFlicker; transformed.z += cos(uTime*14.+h*6.)*0.01*h*uFlicker;
      transformed.y *= 1.0 + 0.08*sin(uTime*11.)*uFlicker*(1.-uSphere);
      vP = transformed;`);
    s.fragmentShader = `uniform float uBlue,uSphere,uTime; varying float vH; varying vec3 vP;\n` + s.fragmentShader.replace('#include <color_fragment>', `
      vec3 yellow = mix(vec3(1.0,0.55,0.12), vec3(1.0,0.92,0.55), vH);
      vec3 blue = mix(vec3(0.25,0.45,1.0), vec3(0.55,0.75,1.0), vH);
      diffuseColor.rgb = mix(yellow, blue, uBlue);
      float edge = 1.0 - smoothstep(0.0, 1.0, vH);
      diffuseColor.a *= mix(edge, 0.55, uSphere);`);
  };
  const mesh = new THREE.Mesh(coneGeo, material); g.add(mesh);
  const inner = new THREE.Mesh(coneGeo, material.clone()); inner.scale.set(0.5, 0.65, 0.5); inner.material.onBeforeCompile = material.onBeforeCompile; g.add(inner);
  const light = new THREE.PointLight(0xffa040, 1.1, 3.0, 2); light.position.y = 0.08; light.castShadow = true; light.shadow.mapSize.set(512, 512); g.add(light);
  return { group: g, mesh, inner, light, uniforms };
}

// Instanced translucent grass, waist high, excluded around the kitchen slab.
export function buildGrass(scene, count = 26000, radius = 34) {
  if (new URLSearchParams(location.search).has('lite')) count = Math.min(count, 3000);
  const geo = new THREE.PlaneGeometry(0.07, 1, 1, 3); geo.translate(0, 0.5, 0);
  const mtl = new THREE.MeshStandardMaterial({ color: 0x8fb45a, roughness: 0.9, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
  const u = { uTime: { value: 0 } };
  mtl.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, u);
    Object.assign(s.uniforms, SWEEP);
    s.vertexShader = `uniform float uTime; varying float vGrassH; varying float vSw;` + SWEEP_GLSL + `\n` + SWEEP_FN + `\n` + s.vertexShader.replace('#include <begin_vertex>', `
      vec3 transformed = position;
      float h = position.y; vGrassH = h;
      vec4 wp = instanceMatrix * vec4(0.,0.,0.,1.);
      vSw = sweepMix(wp.xyz);
      float w = sin(uTime*1.4 + wp.x*0.7 + wp.z*0.5) + 0.5*sin(uTime*2.9 + wp.z*1.3);
      transformed.x += w*0.08*h*h; transformed.z += cos(uTime*1.1+wp.x*0.4)*0.05*h*h;`);
    s.fragmentShader = `varying float vGrassH; varying float vSw; uniform vec3 uGrassOld,uGrassNew; uniform float uGrassKeepOld,uGrassKeepNew;\n` + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      diffuseColor.rgb *= mix(uGrassOld, uGrassNew, vSw) / vec3(0.56,0.71,0.35);
      diffuseColor.a *= mix(0.35, 1.0, vGrassH*vGrassH) * mix(uGrassKeepOld, uGrassKeepNew, vSw);`);
  };
  const mesh = new THREE.InstancedMesh(geo, mtl, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color();
  const up = new THREE.Vector3(0, 1, 0);
  let i = 0, tries = 0;
  while (i < count && tries < count * 4) {
    tries++;
    const r = Math.sqrt(Math.random()) * radius, a = Math.random() * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (x > -2.0 && x < 3.1 && z > -1.2 && z < 2.3) continue;             // kitchen slab
    if (r > 6 && Math.abs(Math.atan2(x, -z)) > 1.75) continue;             // behind every camera rig: never on screen
    const hgt = 0.7 + Math.random() * 0.45;                                 // 0.7–1.15 m
    p.set(x, 0, z); q.setFromAxisAngle(up, Math.random() * Math.PI); s.set(1 + Math.random() * 0.6, hgt, 1);
    m.compose(p, q, s); mesh.setMatrixAt(i, m);
    c.setHSL(0.24 + Math.random() * 0.06, 0.45 + Math.random() * 0.2, 0.42 + Math.random() * 0.14); mesh.setColorAt(i, c);
    i++;
  }
  mesh.count = i; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = false; mesh.receiveShadow = true; mesh.frustumCulled = false; mesh.renderOrder = 2;
  scene.add(mesh);
  return { mesh, uniforms: u };
}

// Sky dome: gradient driven by scenario colours; also feeds fog + hemisphere light.
export function buildSky(scene) {
  const C = (r, g, b) => ({ value: new THREE.Color(r, g, b) });
  const u = { uTopA: C(0.56, 0.72, 0.92), uHorA: C(0.93, 0.9, 0.82), uSunColA: C(1, 0.95, 0.86),
              uTopB: C(0.56, 0.72, 0.92), uHorB: C(0.93, 0.9, 0.82), uSunColB: C(1, 0.95, 0.86),
              uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uK: { value: 1 } };
  const mtl = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: u,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform vec3 uTopA,uHorA,uSunColA,uTopB,uHorB,uSunColB,uSunDir; uniform float uK; varying vec3 vD;
      vec3 skyCol(vec3 top, vec3 hor, vec3 sunC, float t, float s){ return mix(hor, top, pow(t,0.38)) + sunC*(pow(s,900.)*4.0 + pow(s,12.)*0.25); }
      void main(){
        float t = clamp(vD.y,0.,1.); float s = max(dot(normalize(vD), normalize(uSunDir)),0.);
        // horizon changes first, zenith last: the new sky rises up from where the scan meets the horizon
        float k = smoothstep(0.0, 1.0, clamp(uK*1.6 - t*0.6, 0.0, 1.0));
        gl_FragColor = vec4(mix(skyCol(uTopA,uHorA,uSunColA,t,s), skyCol(uTopB,uHorB,uSunColB,t,s), k), 1.); }` });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), mtl); dome.renderOrder = -1; scene.add(dome);
  return { dome, uniforms: u };
}

export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xcfe4ff, 0x5a6a3a, 0.55); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.near = 0.5; sc.far = 40; sc.left = -7; sc.right = 7; sc.top = 7; sc.bottom = -7;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(sun); scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xbcd0ff, 0.35); fill.position.set(-4, 3, -6); scene.add(fill);
  return { hemi, sun, fill };
}
