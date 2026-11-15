// Post pass in the structure of Death Stranding's Odradek scan:
//   world position from depth -> distance to the flame -> masks built from (R - dist):
//   white front line, repeated scan lines trailing behind it, thick glow just behind the front,
//   darkening across the trail, and a depth-gradient outline on objects inside the trail.
// Also: depth-of-field for the detail page, vignette, ACES tone map + sRGB encode.
import * as THREE from 'three';

export class WavePass {
  constructor(renderer) {
    this.renderer = renderer;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.target = new THREE.WebGLRenderTarget(size.x, size.y, { depthTexture: new THREE.DepthTexture(size.x, size.y, THREE.UnsignedIntType), samples: 0 });
    this.target.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.uniforms = {
      tDiffuse: { value: this.target.texture }, tDepth: { value: this.target.depthTexture },
      uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
      uNear: { value: 0.1 }, uFar: { value: 200 },
      uCenter: { value: new THREE.Vector3() }, uRadius: { value: -1 }, uTrail: { value: 4 }, uSpacing: { value: 0.35 }, uStrength: { value: 0 },
      uLine: { value: new THREE.Color(0.45, 0.82, 1.0) }, uFront: { value: new THREE.Color(1, 1, 1) },
      uTexel: { value: new THREE.Vector2(1 / size.x, 1 / size.y) },
      uFocus: { value: 1.0 }, uDof: { value: 0 }, uVignette: { value: 0.25 }, uExposure: { value: 1.0 }, uDebug: { value: 0 }
    };
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: this.uniforms, depthTest: false, depthWrite: false,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy,0.,1.); }`,
      fragmentShader: `
        precision highp float;
        uniform sampler2D tDiffuse, tDepth; uniform mat4 uInvProj, uCamWorld; uniform vec3 uCenter, uLine, uFront;
        uniform float uNear, uFar, uRadius, uTrail, uSpacing, uStrength, uFocus, uDof, uVignette, uExposure, uDebug; uniform vec2 uTexel;
        varying vec2 vUv;
        vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.,1.); }
        vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c,vec3(1./2.4))-0.055, step(0.0031308,c)); }
        float linDepth(float d){ float z = d*2.-1.; return (2.*uNear*uFar)/(uFar+uNear-z*(uFar-uNear)); }
        vec3 worldPos(vec2 uv, float d){ vec4 ndc = vec4(uv*2.-1., d*2.-1., 1.); vec4 v = uInvProj*ndc; v/=v.w; return (uCamWorld*v).xyz; }
        void main(){
          float d = texture2D(tDepth, vUv).x;
          bool sky = d > 0.99999;
          vec3 wp = worldPos(vUv, d);
          float dist = distance(wp, uCenter);

          // depth of field (detail page)
          vec3 col;
          float coc = uDof * clamp(abs(linDepth(d) - uFocus) / max(uFocus,0.2), 0.0, 1.0);
          if (coc > 0.002) {
            col = vec3(0.); const int N = 12; float R = coc * 9.0;
            for (int i=0;i<N;i++){ float a = float(i)*2.399963; float r = sqrt(float(i)+0.5)/sqrt(float(N));
              col += texture2D(tDiffuse, vUv + vec2(cos(a),sin(a))*r*R*uTexel).rgb; }
            col /= float(N);
          } else col = texture2D(tDiffuse, vUv).rgb;

          // ---- scan ----
          if (uRadius > 0.0 && !sky && uStrength > 0.0) {
            float behind = uRadius - dist;                    // >0: already swept
            float fw = max(fwidth(behind), 1e-4);             // world metres per pixel along the gradient
            float trail = step(0.0, behind) * (1.0 - smoothstep(0.0, uTrail, behind));
            // white front line (always >= ~1.5 px wide)
            float front = 1.0 - smoothstep(0.0, max(fw*1.5, 0.02), abs(behind));
            // repeated scan lines behind the front, fixed world spacing; fade where they'd alias
            float ph = abs(fract(behind/uSpacing) - 0.5) * uSpacing;             // distance to nearest line
            float halfW = max(fw*0.9, uSpacing*0.035);
            float lines = 1.0 - smoothstep(halfW, halfW + fw, ph);
            lines *= trail * (1.0 - smoothstep(0.25, 0.6, fw/uSpacing));
            // thick glow just behind the front
            float glow = step(0.0, behind) * exp(-max(behind, 0.0) / max(uTrail*0.12, 0.05));   // clamp: avoids 0*inf ahead of the front
            // depth-gradient outline (Sobel-lite) on objects inside the trail
            float dl = linDepth(texture2D(tDepth, vUv-vec2(uTexel.x,0.)).x), dr = linDepth(texture2D(tDepth, vUv+vec2(uTexel.x,0.)).x);
            float du = linDepth(texture2D(tDepth, vUv+vec2(0.,uTexel.y)).x), dd = linDepth(texture2D(tDepth, vUv-vec2(0.,uTexel.y)).x);
            float edge = smoothstep(0.03, 0.2, (abs(dr-dl)+abs(du-dd)) / max(linDepth(d)*0.06, 0.02));
            // compose: darken the trail, then add emissive masks
            col *= 1.0 - 0.38 * trail * uStrength;
            vec3 add = uLine * (lines*1.4 + glow*0.6 + edge*trail*1.1) + uFront * front * 1.8;
            col += add * uStrength;
            if (uDebug > 0.5) col = vec3(front, lines, trail);
          }

          float v = distance(vUv, vec2(0.5)); col *= 1.0 - uVignette*smoothstep(0.45, 0.95, v);
          gl_FragColor = vec4(toSRGB(aces(col*uExposure)), 1.0);
        }`
    }));
    this.quadScene = new THREE.Scene(); this.quadScene.add(this.quad);
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  setSize(w, h) { this.target.setSize(w, h); this.uniforms.uTexel.value.set(1 / w, 1 / h); }
  render(scene, camera) {
    const r = this.renderer, u = this.uniforms;
    u.uInvProj.value.copy(camera.projectionMatrixInverse); u.uCamWorld.value.copy(camera.matrixWorld);
    u.uNear.value = camera.near; u.uFar.value = camera.far;
    r.setRenderTarget(this.target); r.render(scene, camera);
    r.setRenderTarget(null); r.render(this.quadScene, this.quadCam);
  }
}

// Wavefront kinematics + camera shake.
// R(t) = v0·t + ½a·t² + c·max(0,t−1)³: crosses the hob in ~0.2 s, 60 m at ~1.5 s, then accelerates out to the
// horizon, done by ~2 s.
// Shake: a jolt when the front crosses the camera (Gaussian in |R - dCam|) plus a short time-decaying rumble,
// both divided by (1 + 0.35·dCam) so a camera further from the flame shakes less.
export class Wave {
  constructor(center) {
    this.center = center.clone(); this.R = -1; this.t = 0; this.active = false;
    this.v0 = 4; this.accel = 44; this.cubic = 120; this.maxR = 220; this.timeScale = 1;
    this.sweptCam = false; this.tSweep = 0;
  }
  fire() { this.R = 0.001; this.t = 0; this.active = true; this.sweptCam = false; }
  update(dt, camPos) {
    if (!this.active) return;
    this.t += dt * this.timeScale;
    this.R = this.v0 * this.t + 0.5 * this.accel * this.t * this.t + this.cubic * Math.pow(Math.max(0, this.t - 1), 3);
    if (!this.sweptCam && this.R >= camPos.distanceTo(this.center)) { this.sweptCam = true; this.tSweep = this.t; }
    if (this.R > this.maxR) { this.active = false; this.R = -1; }
  }
  // scan visuals stay full strength, then fade over the last stretch so nothing pops at maxR
  strength() { return this.active ? 1 - THREE.MathUtils.smoothstep(this.R, this.maxR * 0.55, this.maxR) : 0; }
  trail() { return Math.min(0.6 + this.R * 0.3, 16 + this.R * 0.03); }
  shake(camPos, time) {
    if (!this.active) return null;
    const dCam = camPos.distanceTo(this.center);
    const gap = this.R - dCam;
    const jolt = Math.exp(-(gap * gap) / 0.6);
    const rumble = this.sweptCam ? Math.exp(-(this.t - this.tSweep) / 0.35) * 0.45 : 0;
    const amp = (jolt + rumble) / (1 + dCam * 0.35) * 0.03;
    if (amp < 1e-4) return null;
    const n = (f, p) => Math.sin(time * f + p) * Math.sin(time * f * 0.37 + p * 1.7);
    return { x: n(43, 1.3) * amp, y: n(37, 4.1) * amp * 0.7, roll: n(29, 2.2) * amp * 0.35 };
  }
}
