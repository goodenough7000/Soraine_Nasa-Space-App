/* Soraine engine: the part that does not change when ideas change.
 * It owns the renderer, the camera, the frame loop, the scan snapshot, clicking
 * and the close shot. It knows nothing about kitchens or moons: it builds whatever
 * is registered in SoraineKit.props and SoraineKit.scenes, and shows one scene at a time.
 *
 * A scene definition (see js/scenes/*.js):
 *   build(E, group)        required. Add your objects to `group`.
 *   camera(aspect)         required. Returns { pos: [x,y,z], look: [x,y,z] }.
 *   background             hex colour behind everything.
 *   update(E, t, still)    optional, every frame while the scene is showing.
 *   place                  optional { propName: [x,y,z] }: where loose props sit in this scene.
 *   hide                   optional [propName]: loose props not shown in this scene.
 *   freeFall               optional true: loose props drift, flames go round.
 *   liveShadows            optional true: redraw shadows every frame.
 *   exposure               optional number: overall brightness of this scene (1 is normal).
 *   envMap                 optional texture (K.makeEnv): what shiny surfaces reflect in this scene.
 *   fog                    optional [hex, near, far]: distance haze.
 *   sun                    optional [x,y,z]: the scan ripple starts where this appears on screen.
 */
(function () {
  var T = THREE, K = SoraineKit, objects = K.objects, floaters = K.floaters;
  var renderer, scene, camera, state = null, still = false, k = 0, lastT = 0, freeStart = 0;
  var HQ = /[?&]hq\b/.test(location.search), LITE = /[?&]lite\b/.test(location.search) || !!window.SORAINE_LITE, noWave = !!window.SORAINE_LOW, shadowDirty = 4, ratio = LITE ? 1 : 1.5, frames = 0, slow = 0, level = LITE ? 2 : 0, acc = 0, tick = 0;
  var preparing = false;
  var groups = {}, built = {}, hooks = [], lineMat, inspectKey, pickRoots = [];
  var view = 'intro', introUntil = 0, focus = null, saved = [], focusCenter = new T.Vector3(), tmp = new T.Vector3();
  var goalPos = new T.Vector3(), goalLook = new T.Vector3(), camPos = new T.Vector3(), camLook = new T.Vector3();
  var orb = { th: 0, ph: 0.1, d: 1, bd: 1, cth: 0, cph: 0.1, cd: 1 };

  /* E is what props and scenes are handed: the shared scene, the object registry, a place to hook into the frame loop */
  var E = {
    scene: null, renderer: null, objects: objects,
    burner: new T.Vector3(),                                   // world position of the lit burner (set by props.js)
    onFrame: function (fn) { hooks.push(fn); },                // fn(t, { free, still, focus, state })
    group: function (id) { return groups[id]; }
  };
  var rig = null, dof = 0, dofGoal = 0;                           // Tony's page views: a named camera rig, and depth-of-field blur for the detail page
  var topMode = 'pan';                                         // which special view `top` means: the opening close shot of the fire, or the top-down view of the pan
  var top = true;                                               // the top-down view over the pan (the opening shot)
  // Tony's scan wave: see scanCapture / scanFire below
  var wave = { active: false, t: 0, R: -1, v0: 4, accel: 44, cubic: 120, maxR: 220, swept: false, tSweep: 0 }, rt = null, oldCanvas = null, oldTex = null, quad = null, qScene = null, qCam = null, waveDone = null, bufSize = new T.Vector2();
  E.wave = wave;
  function def() { return K.scenes[state]; }

  function build(firstId) {
    scene = E.scene = new T.Scene(); scene.background = new T.Color(0x000000);
    Object.keys(K.scenes).forEach(function (id) { var g = new T.Group(); g.name = 'scene:' + id; g.visible = false; scene.add(g); groups[id] = g; });
    K.props.forEach(function (fn) { fn(E); });
    ensure(firstId);                                           // the opening scene; the others are built later (see ensure)
    scene.add(new T.HemisphereLight(0x2c3760, 0x24170c, 0.22));

    scene.traverse(function (o) { if (o.isMesh && o.material.isMeshStandardMaterial) { o.castShadow = !o.userData.noCast; o.receiveShadow = !o.userData.noReceive; } });
    floaters.forEach(function (o) { o.userData.home = o.position.clone(); o.userData.turn = o.rotation.clone(); });

    // edge lines for the scan: object outlines that light up as the ripple passes
    lineMat = new T.LineBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0, depthTest: false }); lineMat.visible = false;
    K.outline.forEach(function (nm) {
      if (!objects[nm]) return; var list = [];
      objects[nm].traverse(function (o) { if (o.isMesh && !o.isInstancedMesh) list.push(o); });
      list.forEach(function (o) { var ln = new T.LineSegments(new T.EdgesGeometry(o.geometry, 40), lineMat); ln.raycast = function () {}; o.add(ln); });
    });
    K.pickable.forEach(function (nm) { if (objects[nm]) { objects[nm].userData.pick = nm; pickRoots.push(objects[nm]); } });

    inspectKey = new T.Group(); inspectKey.visible = false; scene.add(inspectKey);
    var ik = new T.DirectionalLight(0xffd9a8, 1.5); ik.position.set(2, 3, 4); inspectKey.add(ik);
    var ir = new T.DirectionalLight(0x7fa8ff, 0.5); ir.position.set(-3, 1, -2); inspectKey.add(ir);
    camera = E.camera = new T.PerspectiveCamera(46, 1, 0.1, 600);
  }

  function resize() {
    ratio = Math.min(window.devicePixelRatio || 1, ratio); renderer.setPixelRatio(ratio);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = camera.aspect < 0.8 ? 62 : (camera.aspect < 1.4 ? 54 : 46);
    camera.updateProjectionMatrix(); shadowDirty = 4; sizeWave(); draw(performance.now());
  }
  // The resting view puts the fire in the middle of the frame (Tony: the flame is the main character, not the stove).
  function overview() { goalPos.copy(E.burner).add(camera.aspect < 0.8 ? tmp.set(0.3, 0.5, 2.1) : tmp.set(0.44, 0.3, 1.2)); goalLook.copy(E.burner); goalLook.y += 0.13; }
  function wide() { var c = def().camera(camera.aspect); goalPos.fromArray(c.pos); goalLook.fromArray(c.look); }   // each scene's own wide establishing view

  function draw(now) {
    var sc = def(), free = !!sc.freeFall, t = still ? 6 : now / 1000;
    var dt = Math.min(0.1, (now - lastT) / 1000) || 0.016; lastT = now;
    // Automatic quality: every 60 frames look at the average frame time and step down if the machine is struggling.
    // level 1: normal resolution. level 2: also no panel blur, shadows drawn once. level 3: also no shadows, 0.7 x resolution.
    tick++;
    if (!preparing && !still && !HQ && level < 3 && !wave.active && now > 4000) {
      frames++; acc += dt;
      if (frames === 60) { if (acc / 60 > 0.027) setLevel(level + 1); frames = 0; acc = 0; }
    }
    k += ((free ? 1 : 0) - k) * (still ? 1 : 1 - Math.exp(-dt * 1.8));

    // Lift the hood out of the overhead camera's sightline; restore it in all other views.
    if (objects.hood) objects.hood.visible = !(state === 'earth' && top && topMode === 'pan' && !rig && !focus);
    // camera: opening close shot on the burner, then the scene's resting view, or a turnable close shot of one object
    var sway = still ? 0 : Math.sin(t * 0.22) * 0.05;
    if (view === 'intro' && (now > introUntil || still)) view = 'overview';
    if (view === 'intro') { goalPos.copy(E.burner).add(tmp.set(0.03, 0.6, 0.26)); goalLook.copy(E.burner); }
    else if (view === 'inspect' && focus) {
      var e2 = still ? 1 : 1 - Math.exp(-dt * 7);
      if (free) new T.Box3().setFromObject(focus[0]).getCenter(focusCenter);
      orb.cth += (orb.th - orb.cth) * e2; orb.cph += (orb.ph - orb.cph) * e2; orb.cd += (orb.d - orb.cd) * e2;
      goalLook.copy(focusCenter); sway = 0;
      goalPos.set(focusCenter.x + orb.cd * Math.sin(orb.cph) * Math.sin(orb.cth), focusCenter.y + orb.cd * Math.cos(orb.cph), focusCenter.z + orb.cd * Math.sin(orb.cph) * Math.cos(orb.cth));
      camPos.copy(goalPos);
    }
    else if (rig === 'detail') { goalPos.copy(E.burner).add(tmp.set(0.26, 0.14, 0.5)); goalLook.copy(E.burner); goalLook.y += 0.1; sway *= 0.3; }   // close on the fire (Tony's detail page)
    else if (rig === 'about') { wide(); sway *= 0.4; }                                                                                              // the whole scene (Tony's about page)
    else if (top && topMode === 'pan') { goalPos.copy(E.burner).add(tmp.set(0, 1.25, 0.03)); goalLook.copy(E.burner); sway = 0; }                   // straight down on the pan
    else if (top) { goalPos.copy(E.burner).add(tmp.set(0.14, 0.1, 0.52)); goalLook.copy(E.burner); goalLook.y += 0.1; sway = 0; }                   // opening shot: close on the fire
    else overview();
    var ease = still ? 1 : 1 - Math.exp(-dt * (view === 'inspect' ? 5 : 2.2));
    camPos.lerp(goalPos, ease); camLook.lerp(goalLook, ease);
    camera.position.copy(camPos); camera.position.x += sway; camera.lookAt(camLook);

    // loose props: at home, or where this scene places them; drifting when the scene is in free fall
    floaters.forEach(function (o) {
      var u = o.userData, pl = sc.place && sc.place[o.name];
      if (pl) o.position.fromArray(pl); else o.position.copy(u.home);
      o.position.addScaledVector(u.lift, k); o.position.y += Math.sin(t * 0.6 + u.spin.x * 20) * 0.04 * k;
      var to = (t - freeStart) * k; o.rotation.set(u.turn.x + u.spin.x * to, u.turn.y + u.spin.y * to, u.turn.z + u.spin.z * to);
    });

    var info = { free: free, still: still, focus: !!focus, state: state };
    for (var h = 0; h < hooks.length; h++) hooks[h](t, info);
    if (sc.update && !focus) sc.update(E, t, still);

    if (shadowDirty > 0 || (k > 0.002 && k < 0.998) || (sc.liveShadows && !focus && level < 2 && tick % 2 === 0)) { renderer.shadowMap.needsUpdate = true; shadowDirty--; }   // shadows only redraw when something moved
    dof += ((focus ? 0 : dofGoal) - dof) * (still ? 1 : 1 - Math.exp(-dt * 3));
    if (!noWave && (wave.active || dof > 0.01)) renderWave(dt, t); else renderer.render(scene, camera);
  }

  /* Tony's scan wave (kitchen/wave.js in his repository), in the structure he describes: world position from depth ->
     distance to the flame -> masks built from (R - dist): a white front line, scan lines trailing behind it, a glow just
     behind the front, darkening across the trail, and a depth-edge outline on objects inside the trail.
     Here the front also uncovers the new world: pixels it has passed show the new scene, the rest still show the old one. */
  function initWave() {
    renderer.getDrawingBufferSize(bufSize);
    rt = new T.WebGLRenderTarget(bufSize.x, bufSize.y, { type: T.HalfFloatType, depthTexture: new T.DepthTexture(bufSize.x, bufSize.y, T.UnsignedIntType) });
    oldCanvas = document.createElement('canvas'); oldTex = new T.CanvasTexture(oldCanvas); oldTex.minFilter = oldTex.magFilter = T.LinearFilter; oldTex.generateMipmaps = false;
    quad = new T.Mesh(new T.PlaneGeometry(2, 2), new T.ShaderMaterial({ depthTest: false, depthWrite: false,
      uniforms: { tDiffuse: { value: rt.texture }, tDepth: { value: rt.depthTexture }, tOld: { value: oldTex }, uInvProj: { value: new T.Matrix4() }, uCamWorld: { value: new T.Matrix4() }, uNear: { value: 0.1 }, uFar: { value: 600 },
        uCenter: { value: new T.Vector3() }, uRadius: { value: -1 }, uTrail: { value: 4 }, uSpacing: { value: 0.35 }, uStrength: { value: 0 }, uLine: { value: new T.Color(0.45, 0.82, 1.0) }, uFront: { value: new T.Color(1, 1, 1) },
        uTexel: { value: new T.Vector2() }, uShake: { value: new T.Vector2() }, uFocus: { value: 1 }, uDof: { value: 0 }, uSkyK: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: [
        'uniform sampler2D tDiffuse, tDepth, tOld; uniform mat4 uInvProj, uCamWorld; uniform vec3 uCenter, uLine, uFront;',
        'uniform float uNear, uFar, uRadius, uTrail, uSpacing, uStrength, uFocus, uDof, uSkyK; uniform vec2 uTexel, uShake; varying vec2 vUv;',
        'float linDepth(float d){ float z = d*2.-1.; return (2.*uNear*uFar)/(uFar+uNear-z*(uFar-uNear)); }',
        'vec3 worldPos(vec2 uv, float d){ vec4 ndc = vec4(uv*2.-1., d*2.-1., 1.); vec4 v = uInvProj*ndc; v/=v.w; return (uCamWorld*v).xyz; }',
        'void main(){',
        '  vec2 uv = vUv + uShake;',
        '  float d = texture2D(tDepth, uv).x; bool sky = d > 0.99999;',
        '  float dist = distance(worldPos(uv, d), uCenter), behind = uRadius - dist;',
        '  vec3 fresh;                                                                    // depth of field for the detail page (Tony: 12 taps on a spiral)',
        '  float coc = uDof * clamp(abs(linDepth(d) - uFocus) / max(uFocus, 0.2), 0., 1.);',
        '  if (coc > 0.002) { fresh = vec3(0.); float rr = coc * 9.0;',
        '    for (int i = 0; i < 12; i++) { float a = float(i) * 2.399963; float r = sqrt(float(i) + 0.5) / sqrt(12.); fresh += texture2D(tDiffuse, uv + vec2(cos(a), sin(a)) * r * rr * uTexel).rgb; }',
        '    fresh /= 12.; } else fresh = texture2D(tDiffuse, uv).rgb;',
        '  #ifdef TONE_MAPPING',
        '    fresh = toneMapping(fresh);',
        '  #endif',
        '  fresh = linearToOutputTexel(vec4(fresh, 1.)).rgb;',
        '  float up = clamp(normalize(worldPos(uv, 1.) - uCamWorld[3].xyz).y, 0., 1.);    // how high in the sky this pixel looks',
        '  float skyShown = smoothstep(0., 1., clamp(uSkyK * 1.6 - up * 0.6, 0., 1.));     // Tony: the horizon changes first, the zenith last',
        '  float shown = uRadius < 0. ? 1. : (sky ? skyShown : step(0., behind));',
        '  vec3 col = mix(texture2D(tOld, uv).rgb, fresh, shown);',
        '  if (uRadius > 0. && !sky && uStrength > 0.) {',
        '    float fw = max(fwidth(behind), 1e-4);',
        '    float trail = step(0., behind) * (1. - smoothstep(0., uTrail, behind));',
        '    float front = 1. - smoothstep(0., max(fw*1.5, 0.02), abs(behind));',
        '    float ph = abs(fract(behind/uSpacing) - 0.5) * uSpacing, halfW = max(fw*0.9, uSpacing*0.035);',
        '    float lines = (1. - smoothstep(halfW, halfW + fw, ph)) * trail * (1. - smoothstep(0.25, 0.6, fw/uSpacing));',
        '    float glow = step(0., behind) * exp(-max(behind, 0.) / max(uTrail*0.12, 0.05));',
        '    float dl = linDepth(texture2D(tDepth, uv-vec2(uTexel.x,0.)).x), dr = linDepth(texture2D(tDepth, uv+vec2(uTexel.x,0.)).x);',
        '    float du = linDepth(texture2D(tDepth, uv+vec2(0.,uTexel.y)).x), dd = linDepth(texture2D(tDepth, uv-vec2(0.,uTexel.y)).x);',
        '    float edge = smoothstep(0.03, 0.2, (abs(dr-dl)+abs(du-dd)) / max(linDepth(d)*0.06, 0.02));',
        '    col *= 1. - 0.38 * trail * uStrength;',
        '    col += (uLine * (lines*1.4 + glow*0.6 + edge*trail*1.1) + uFront * front * 1.8) * uStrength;',
        '  }',
        '  gl_FragColor = vec4(col, 1.);',
        '}'].join('\n') }));
    quad.frustumCulled = false; qScene = new T.Scene(); qScene.add(quad); qCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  function sizeWave() { if (!rt) return; renderer.getDrawingBufferSize(bufSize); rt.setSize(bufSize.x, bufSize.y); }
  function renderWave(dt, t) {
    if (!rt) { try { initWave(); } catch (e) { wave.active = false; dof = dofGoal = 0; renderer.render(scene, camera); return; } }
    var u = quad.material.uniforms, amp = 0;
    renderer.getDrawingBufferSize(bufSize); if (rt.width !== bufSize.x || rt.height !== bufSize.y) rt.setSize(bufSize.x, bufSize.y);
    if (wave.active) {
      wave.t += dt;
      wave.R = wave.v0 * wave.t + 0.5 * wave.accel * wave.t * wave.t + wave.cubic * Math.pow(Math.max(0, wave.t - 1), 3);   // Tony's front: slow off the hob, then racing to the horizon
      var dCam = camera.position.distanceTo(E.burner), gap = wave.R - dCam;
      if (!wave.swept && gap >= 0) { wave.swept = true; wave.tSweep = wave.t; }
      amp = (Math.exp(-(gap * gap) / 0.6) + (wave.swept ? Math.exp(-(wave.t - wave.tSweep) / 0.35) * 0.45 : 0)) / (1 + dCam * 0.35) * 0.03;   // a jolt as the front crosses the camera, then a short rumble
    }
    u.uShake.value.set(Math.sin(t * 43 + 1.3) * Math.sin(t * 15.9 + 2.2) * amp * 0.5, Math.sin(t * 37 + 4.1) * Math.sin(t * 13.7 + 7) * amp * 0.35);
    camera.updateMatrixWorld(); u.uInvProj.value.copy(camera.projectionMatrixInverse); u.uCamWorld.value.copy(camera.matrixWorld); u.uNear.value = camera.near; u.uFar.value = camera.far;
    u.uCenter.value.copy(E.burner); u.uRadius.value = wave.active ? wave.R : -1; u.uTrail.value = Math.min(0.6 + Math.max(wave.R, 0) * 0.3, 16 + Math.max(wave.R, 0) * 0.03); u.uSpacing.value = 0.25 + Math.max(wave.R, 0) * 0.045;   // lines ride with the front, so their spacing can grow
    u.uSkyK.value = wave.active ? Math.min(1, Math.max(0, (wave.R - camera.position.distanceTo(E.burner) * 0.6) / 60)) : 1;
    u.uStrength.value = wave.active ? 1 - Math.min(1, Math.max(0, (wave.R - wave.maxR * 0.55) / (wave.maxR * 0.45))) : 0; u.uTexel.value.set(1 / bufSize.x, 1 / bufSize.y);
    u.uDof.value = dof; u.uFocus.value = camera.position.distanceTo(E.burner);
    renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.render(qScene, qCam);
    if (wave.active && wave.R > wave.maxR) { wave.active = false; wave.R = -1; shadowDirty = 4; var cb = waveDone; waveDone = null; if (cb) cb(); }
  }
  function loop(now) { if (!preparing && !document.hidden) draw(now); requestAnimationFrame(loop); }

  // Scenes are built the first time they are needed (and quietly ahead of time once the page is up),
  // so opening the page only has to build the first one.
  function setLevel(n) {
    level = n; ratio = n >= 3 ? 0.7 : n >= 1 ? 1 : ratio;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ratio)); renderer.setSize(window.innerWidth, window.innerHeight, false); sizeWave();
    if (n >= 3) { renderer.shadowMap.enabled = false; scene.traverse(function (o) { if (o.material) o.material.needsUpdate = true; }); }
    document.documentElement.classList.toggle('is-light', n >= 2); shadowDirty = 4;
    if (window.console) console.info('[soraine] quality level ' + n);
  }
  function ensure(id) {
    if (built[id] || !K.scenes[id]) return;
    built[id] = true; var t0 = performance.now(); K.scenes[id].build(E, groups[id]); (window.__built = window.__built || {})[id] = Math.round(performance.now() - t0);
    groups[id].traverse(function (o) { if (o.isMesh && o.material.isMeshStandardMaterial) { o.castShadow = !o.userData.noCast; o.receiveShadow = !o.userData.noReceive; } });    floaters.forEach(function (o) { if (!o.userData.home) { o.userData.home = o.position.clone(); o.userData.turn = o.rotation.clone(); } });
    shadowDirty = 4;
  }
  function prebuild() {
    if (LITE) return;                                            // phones build a world only when it is opened: less memory, no start-up freeze
    var next = Object.keys(K.scenes).filter(function (id) { return !built[id] && id !== 'orbit'; })[0]; if (!next) return;
    try { ensure(next); } catch (e) { if (window.console) console.error(e); }
    setTimeout(prebuild, 1200);
  }

  function setState(next) {
    if (!K.scenes[next]) return false;
    ensure(next);
    state = next; var sc = def(), hide = sc.hide || [];
    Object.keys(groups).forEach(function (id) { groups[id].visible = id === next; });
    floaters.forEach(function (o) { o.visible = hide.indexOf(o.name) < 0; });
    scene.background = new T.Color(sc.background || 0x000000);
    scene.environment = sc.envMap || null; renderer.toneMappingExposure = sc.exposure || 1;
    scene.fog = sc.fog ? new T.Fog(sc.fog[0], sc.fog[1], sc.fog[2]) : null;
    if (sc.freeFall) freeStart = still ? 6 : performance.now() / 1000;
    shadowDirty = 4; return true;
  }

  window.SoraineScene = {
    init: function (canvas, first) {
      renderer = new T.WebGLRenderer({ canvas: canvas, antialias: !LITE, alpha: true, powerPreference: 'high-performance' }); window.__R = renderer;
      renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
      if (!renderer.capabilities.isWebGL2 && !(renderer.extensions.has('OES_texture_half_float') && renderer.extensions.has('WEBGL_depth_texture'))) noWave = true;   // old graphics chips
      renderer.shadowMap.enabled = !LITE; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;   // add ?lite to the address for slow machines: no shadows, lower resolution
      E.renderer = renderer;
      build(first || Object.keys(K.scenes)[0]); setState(first || Object.keys(K.scenes)[0]);
      // All worlds are prepared behind the startup overlay.
      canvas.addEventListener('webglcontextlost', function (ev) { ev.preventDefault(); window.dispatchEvent(new CustomEvent('soraine:error', { detail: 'The graphics card dropped the 3D view (out of graphics memory). Reload the page.' })); });
      camera.aspect = window.innerWidth / window.innerHeight; overview();
      if (still) { camPos.copy(goalPos); camLook.copy(goalLook); view = 'overview'; }
      else { camPos.copy(E.burner).add(tmp.set(0, 1.25, 0.03)); camLook.copy(E.burner); view = 'overview'; }   // open close on the fire
      resize();
      window.addEventListener('resize', resize);
      requestAnimationFrame(loop);
    },
    prepareAll: async function (progress) {
      preparing = true;
      var ids = Object.keys(K.scenes), target = new T.WebGLRenderTarget(256, 256);
      var breathe = function () { return new Promise(function (resolve) { requestAnimationFrame(function () { requestAnimationFrame(resolve); }); }); };
      try {
        if (!rt) initWave(); sizeWave();
        oldCanvas.width = renderer.domElement.width; oldCanvas.height = renderer.domElement.height;
        oldTex.userData.sized = true;
        oldCanvas.getContext('2d').fillRect(0, 0, oldCanvas.width, oldCanvas.height);
        oldTex.needsUpdate = true; renderer.initTexture(oldTex);
        for (var i = 0; i < ids.length; i++) {
          progress(Math.round(i / ids.length * 88), 'Preparing ' + (ids[i] === 'orbit' ? 'ISS' : ids[i]) + '…');
          await breathe(); ensure(ids[i]);
          await window.SoraineWaitForAssets();
          setState(ids[i]);
          var textures = new Set(); scene.traverse(function (o) { if (!o.material) return; var ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(function (m) { Object.keys(m).forEach(function (k) { if (m[k] && m[k].isTexture) textures.add(m[k]); }); }); });
          textures.forEach(function (t) { renderer.initTexture(t); });
          var renderables = [];
          scene.traverse(function (o) { if (o.isMesh || o.isPoints || o.isLine) { renderables.push([o, o.frustumCulled, o.visible]); o.frustumCulled = false; o.visible = true; } });
          lineMat.visible = true;
          try {
            renderer.compile(scene, camera);
            renderer.shadowMap.needsUpdate = true;
            renderer.setRenderTarget(target); renderer.render(scene, camera); renderer.setRenderTarget(null);
            // The screen output encoding also has its own material variants.
            renderer.render(scene, camera);
            // Shadow materials pick up the active world's lights after the first pass.
            renderer.shadowMap.needsUpdate = true; renderer.render(scene, camera);
            // Warm the full-size depth/scan target and screen shader, not just the small upload target.
            dof = 1; renderWave(0, performance.now() / 1000); dof = 0;
          } finally {
            renderer.setRenderTarget(null); lineMat.visible = false;
            renderables.forEach(function (x) { x[0].frustumCulled = x[1]; x[0].visible = x[2]; });
          }
          progress(Math.round((i + 0.65) / ids.length * 88), 'Preparing close-ups and effects…'); await breathe();
          // Inspection changes the light configuration, so its shader variants need a real render too.
          for (var p = 0; p < K.pickable.length; p++) {
            if (!window.SoraineScene.inspect(K.pickable[p])) continue;
            try { renderer.compile(scene, camera); renderer.setRenderTarget(target); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.render(scene, camera); }
            finally { renderer.setRenderTarget(null); window.SoraineScene.release(); }
          }
        }
        progress(94, 'Finishing graphics preparation…'); await breathe();
        // Complete queued GPU uploads behind the loader, never during an interaction.
        renderer.getContext().finish();
        if (document.fonts) await document.fonts.ready;
        setState('earth'); top = true; topMode = 'pan'; rig = null; dof = dofGoal = 0;
        k = 0; frames = 0; acc = 0; view = 'overview';
        camPos.copy(E.burner).add(tmp.set(0, 1.25, 0.03)); camLook.copy(E.burner);
        lastT = performance.now(); draw(lastT); progress(100, 'Ready');
      } finally { renderer.setRenderTarget(null); target.dispose(); preparing = false; }
    },
    setState: setState,
    camera: function () { return camera; },
    /* the top-down view over the pan: on or off */
    topView: function (on, mode) { top = !!on; if (mode) topMode = mode; return top; },
    /* Tony's page views: 'detail' (close on the pan, background blurred), 'about' (stepped back), or null for the scene's own view */
    setRig: function (name) { rig = name || null; dofGoal = rig === 'detail' ? 1 : 0; },
    isTop: function () { return top; },
    /* Scan transition, step 1: keep a picture of the world as it is now. Call before changing scene. */
    scanCapture: function () {
      if (noWave) return false;                                   // weak phone or no float/depth textures: the caller falls back to the simple wipe
      try {
        if (!rt) initWave(); sizeWave(); draw(performance.now());
        if (oldCanvas.width !== renderer.domElement.width || oldCanvas.height !== renderer.domElement.height || !oldTex.userData.sized) { oldTex.dispose(); oldCanvas.width = renderer.domElement.width; oldCanvas.height = renderer.domElement.height; oldTex.userData.sized = true; }   // a texture keeps its first size: start a new one when the picture's size changes
        oldCanvas.getContext('2d').drawImage(renderer.domElement, 0, 0); oldTex.needsUpdate = true; return true;
      } catch (e) { if (window.console) console.warn(e); return false; }
    },
    /* Scan transition, step 2: after the scene has changed, send the front out from the stove flame. done() runs when it has passed. */
    scanFire: function (done) {
      if (!rig && !top) { overview(); camPos.copy(goalPos); camLook.copy(goalLook); }
      wave.active = true; wave.t = 0; wave.R = 0.001; wave.swept = false; waveDone = done || null;
    },
    scenes: function () { return Object.keys(K.scenes); },
    setStill: function (v) { still = !!v; },
    /* the current frame as an image, for the scan wipe and the blurred backdrop */
    snapshot: function () { draw(performance.now()); return renderer.domElement.toDataURL('image/jpeg', 0.82); },
    /* 0..1: how brightly object outlines glow during the scan */
    edges: function (a) { lineMat.opacity = a; lineMat.visible = a > 0.01; },
    /* where the scene's sun sits on screen, in CSS pixels: the centre of the ripple */
    sunPoint: function () {
      var sun = def().sun, cx = -1.1, cy = 0.9;
      if (sun) { var v = tmp.fromArray(sun).project(camera); if (v.z <= 1) { cx = Math.max(-1.1, Math.min(1.1, v.x)); cy = Math.max(-1.1, Math.min(1.1, v.y)); } }
      return { x: (cx * 0.5 + 0.5) * window.innerWidth, y: (-cy * 0.5 + 0.5) * window.innerHeight };
    },
    /* name of the clickable object under a screen point, or null */
    pick: function (x, y) {
      if (focus) return null;
      var ray = new T.Raycaster(); ray.setFromCamera(new T.Vector2(x / window.innerWidth * 2 - 1, -(y / window.innerHeight) * 2 + 1), camera);
      var hit = ray.intersectObjects(pickRoots.filter(function (o) { return o.visible; }), true)[0]; if (!hit) return null;
      for (var o = hit.object; o; o = o.parent) if (o.userData.pick) return o.userData.pick; return null;
    },
    /* close shot: keep only the chosen object, swing the camera above it. Call snapshot() first for the backdrop. */
    inspect: function (name) {
      var keep = name === 'pan' ? [objects.pan, objects.egg] : [objects[name]]; if (!keep[0]) return false;
      focus = keep; saved = [];
      scene.children.forEach(function (c) { if (keep.indexOf(c) < 0 && !c.isLight && c !== inspectKey) { saved.push([c, c.visible]); c.visible = false; } });
      inspectKey.visible = true; scene.background = null; renderer.setClearColor(0x000000, 0);
      var box = new T.Box3().setFromObject(keep[0]), size = box.getSize(new T.Vector3()); box.getCenter(focusCenter);
      var rel = camPos.clone().sub(focusCenter);
      orb.cd = rel.length(); orb.cph = Math.acos(Math.max(-1, Math.min(1, rel.y / orb.cd))); orb.cth = Math.atan2(rel.x, rel.z);
      orb.bd = Math.max(size.x, size.y, size.z) * 1.45 + 0.18; orb.d = orb.bd; orb.th = 0; orb.ph = 0.1;
      view = 'inspect'; return true;
    },
    /* close-shot controls: turn (radians), zoom (factor), snap to a named angle, read the angle */
    turn: function (dth, dph) { orb.th += dth; orb.ph = Math.max(0.06, Math.min(1.5, orb.ph + dph)); },
    zoom: function (f) { orb.d = Math.max(orb.bd * 0.5, Math.min(orb.bd * 2.5, orb.d * f)); },
    lookFrom: function (th, ph) { orb.th = th + Math.round((orb.th - th) / (Math.PI * 2)) * Math.PI * 2; orb.ph = ph; },
    angles: function () { return { th: orb.cth, ph: orb.cph }; },
    release: function () {
      if (!focus) return; focus = null; view = 'overview';
      saved.forEach(function (p) { p[0].visible = p[1]; }); saved = []; inspectKey.visible = false;
      setState(state);
    },
    objects: objects
  };
})();
