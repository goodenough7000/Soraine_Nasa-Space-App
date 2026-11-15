/* Props shared by every scene: the gas stove with its candles, the pan and egg,
 * the flame, the gas canister, the oil bottle, the mug and the toy rocket.
 * They are built once and stay the same in every world.
 */
(function () {
  var T = THREE, K = SoraineKit, std = K.std, glow = K.glow, put = K.put, roundedGeo = K.roundedGeo, rbox = K.rbox, tube = K.tube, ball = K.ball,
      group = K.group, halo = K.halo, canvasTex = K.canvasTex, rand = K.rand, floater = K.floater, objects = K.objects, m = K.mat;
  var cream = m.cream, creamDark = m.creamDark, white = m.white, chrome = m.chrome, brass = m.brass, iron = m.iron, sage = m.sage, sageDark = m.sageDark, wood = m.wood, woodDark = m.woodDark, teal = m.teal, plaster = m.plaster, tile = m.tile, stone = m.stone, leaf = m.leaf;
  var BURNER = new T.Vector3(0.19, 0.93, 0.13);          // front-right burner, in the stove's own space

  K.props.push(function (E) {
    var scene = E.scene, i, stove, flameJets, flameBall, flameLight, flameHalo, candles = [], burnerWorld = E.burner;

    // ---- front and centre: the gas stove, with its hood ----
    stove = group(0.3, 0, -2.02, scene, 'stove');
    rbox(0.92, 0.86, 0.68, 0.06, cream, 0, 0.44, 0, stove);
    var hob = std(0x08090b, 0.85, 0.0);                         // dark enamel hob and splashback: a quiet backdrop, so the fire is what you look at
    rbox(0.95, 0.05, 0.7, 0.022, hob, 0, 0.885, 0, stove);
    rbox(0.92, 0.2, 0.07, 0.03, hob, 0, 1.0, -0.3, stove);
    rbox(0.7, 0.4, 0.04, 0.035, creamDark, 0, 0.32, 0.335, stove); rbox(0.46, 0.18, 0.02, 0.02, new T.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.2, emissive: 0xff8a2a, emissiveIntensity: 0.55 }), 0, 0.33, 0.357, stove);   // oven window, lit from inside
    var bar = tube(0.017, 0.017, 0.62, chrome, 0, 0.58, 0.385, stove); bar.rotation.z = Math.PI / 2;
    [-0.27, 0.27].forEach(function (x) { tube(0.012, 0.012, 0.05, chrome, x, 0.58, 0.36, stove).rotation.x = Math.PI / 2; });
    [-0.32, -0.11, 0.11, 0.32].forEach(function (x) { var kn = tube(0.04, 0.045, 0.04, std(0xd8d2c2, 0.3, 0.4), x, 0.75, 0.36, stove); kn.rotation.x = Math.PI / 2; });
    [[-0.19, -0.13], [0.19, -0.13], [-0.19, 0.13], [0.19, 0.13]].forEach(function (p) {
      tube(0.1, 0.1, 0.012, std(0x2b2d31, 0.6), p[0], 0.913, p[1], stove); tube(0.045, 0.05, 0.02, iron, p[0], 0.92, p[1], stove);
      [0, 1.571].forEach(function (r) { var g2 = rbox(0.25, 0.014, 0.018, 0.005, iron, p[0], 0.934, p[1], stove); g2.rotation.y = r; });
    });
    var dial = tube(0.055, 0.055, 0.012, white, 0, 1.01, -0.262, stove); dial.rotation.x = Math.PI / 2; var dialHand = rbox(0.006, 0.04, 0.004, 0.002, iron, 0, 1.02, -0.254, stove), dialPivot = group(0, 1.01, -0.254, stove, 'dialPivot'); dialPivot.add(dialHand); dialHand.position.set(0, 0.01, 0);   // the pointer turns about the dial's centre
    // two candles on the back ledge: wax, wick, a warm flame, a glow and a small light each
    [-0.34, 0.34].forEach(function (x) {
      tube(0.03, 0.032, 0.12, new T.MeshStandardMaterial({ color: 0xf6ecd2, roughness: 0.6, emissive: 0x7a4a14, emissiveIntensity: 0.45 }), x, 1.16, -0.3, stove);
      tube(0.003, 0.003, 0.02, iron, x, 1.228, -0.3, stove);
      var fl = put(new T.SphereGeometry(0.013, 16, 12), glow(0xffb347), x, 1.262, -0.3, stove); fl.scale.y = 2;
      put(new T.SphereGeometry(0.006, 10, 8), glow(0xfff4d0), x, 1.252, -0.3, stove);
      var hl = halo(0xff9a3c, 0.42, x, 1.262, -0.28, stove, 0.75);
      var cl = new T.PointLight(0xff9838, 0.8, 2.4, 1.6); cl.position.set(x, 1.3, -0.2); stove.add(cl);
      candles.push({ flame: fl, halo: hl, light: cl });
    });
    [[-0.38, 0.28], [0.38, 0.28], [-0.38, -0.28], [0.38, -0.28]].forEach(function (p) { tube(0.035, 0.028, 0.06, creamDark, p[0], 0.01, p[1], stove); });
    // the stove stays put in every world, free fall included: the fire on its burner is the fixed centre of the story


    // ---- pan, egg, flame ----
    stove.updateMatrixWorld(true);
    var burner = stove.localToWorld(BURNER.clone());
    var LIFT = 0.13;                                            // the pan rests this far above the burner on the hob's own pan-support fins, leaving the flame in view
    for (i = 0; i < 4; i++) { var ta = i * Math.PI / 2 + Math.PI / 4, fin = rbox(0.07, LIFT, 0.009, 0.003, iron, BURNER.x + Math.cos(ta) * 0.175, BURNER.y + LIFT / 2, BURNER.z + Math.sin(ta) * 0.175, stove); fin.rotation.y = -ta; }
    var pan = group(burner.x, burner.y + 0.035 + LIFT, burner.z, scene, 'pan');
    tube(0.22, 0.17, 0.06, iron, 0, 0, 0, pan); tube(0.2, 0.2, 0.006, std(0x2a2b2f, 0.45, 0.2), 0, 0.028, 0, pan);
    var handle = rbox(0.32, 0.026, 0.05, 0.012, iron, 0.33, 0.03, 0.12, pan); handle.rotation.y = -0.35;
    floater(pan, new T.Vector3(0.35, 0.45, 0.5), new T.Vector3(0.1, 0.16, 0.06));
    var egg = group(burner.x, burner.y + 0.072 + LIFT, burner.z, scene, 'egg');
    var eggWhite = std(0xfbf7ec, 0.5);
    tube(0.13, 0.135, 0.014, eggWhite, 0, 0, 0, egg); tube(0.075, 0.08, 0.014, eggWhite, 0.09, 0, 0.06, egg); tube(0.06, 0.065, 0.014, eggWhite, -0.08, 0, -0.07, egg);
    var yolk = put(new T.SphereGeometry(0.05, 28, 18), std(0xf5a623, 0.35), 0.01, 0.012, 0, egg); yolk.scale.y = 0.6;
    E.parts = { eggWhite: eggWhite, yolk: yolk };              // handles for js/physics.js
    floater(egg, new T.Vector3(-0.35, 0.8, 0.6), new T.Vector3(0.2, 0.1, 0.25));

    flameJets = group(burner.x, burner.y - 0.005, burner.z, scene, 'flame');
    for (i = 0; i < 14; i++) put(new T.ConeGeometry(0.014, 0.05, 12), glow(0x4a94ff), Math.cos(i * 0.449) * 0.085, 0, Math.sin(i * 0.449) * 0.085, flameJets);
    for (i = 0; i < 7; i++) put(new T.ConeGeometry(0.008, 0.026, 10), glow(0xbfe0ff), Math.cos(i * 0.898) * 0.085, 0.004, Math.sin(i * 0.898) * 0.085, flameJets);
    flameBall = put(new T.SphereGeometry(0.075, 32, 20), glow(0x5aa8ff), 0, 0, 0, scene); flameBall.visible = false;

    // The fire: the centre of the story. Tony's flame (kitchen/scene.js): a cone that morphs toward a sphere as buoyancy
    // weakens and shifts from yellow to blue. Two layers: a solid coloured body (reads against light backgrounds) and a bright glowing core.
    var fireU = { uTime: { value: 0 }, uBlue: { value: 0 }, uSphere: { value: 0 }, uFlicker: { value: 1 } };
    var NOISE = 'float hsh(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }\n' +
      'float vnoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);\n' +
      '  return mix(mix(mix(hsh(i), hsh(i + vec3(1,0,0)), f.x), mix(hsh(i + vec3(0,1,0)), hsh(i + vec3(1,1,0)), f.x), f.y),\n' +
      '             mix(mix(hsh(i + vec3(0,0,1)), hsh(i + vec3(1,0,1)), f.x), mix(hsh(i + vec3(0,1,1)), hsh(i + vec3(1,1,1)), f.x), f.y), f.z); }\n';
    // Each layer: turbulence that scrolls upward licks the surface (less of it as the flame rounds off); the colour runs from a
    // hot pale core through orange to a dark red edge, with a blue zone at the base; a round flame reads as a thin blue shell.
    function fireMat(additive, gain, opacity) {
      var mt = new T.MeshBasicMaterial({ color: 0xffa23a, transparent: true, opacity: opacity, depthWrite: false, side: T.DoubleSide, blending: additive ? T.AdditiveBlending : T.NormalBlending, toneMapped: false });
      mt.onBeforeCompile = function (s) {
        s.uniforms.uTime = fireU.uTime; s.uniforms.uBlue = fireU.uBlue; s.uniforms.uSphere = fireU.uSphere; s.uniforms.uFlicker = fireU.uFlicker; s.uniforms.uGain = { value: gain }; s.uniforms.uRound = { value: additive ? 0.22 : 1 };
        s.vertexShader = 'uniform float uTime, uSphere, uFlicker; varying float vH; varying float vF; varying vec3 vP;\n' + NOISE + s.vertexShader.replace('#include <begin_vertex>', [
          'vec3 transformed = position;',
          'float h = clamp(transformed.y / 0.2, 0., 1.); vH = h;',
          'vec3 sN = normalize(vec3(transformed.x, transformed.y - 0.075, transformed.z) + 1e-4);',
          'vec3 toS = sN * 0.075 + vec3(0., 0.075, 0.);                                       // sphere of radius 0.075 sitting on the burner',
          'transformed.xz *= 1.0 + 0.55 * sin(h * 3.1416) * (1. - h * 0.35);                  // belly: a teardrop, not a straight cone',
          'transformed = mix(transformed, toS, uSphere);',
          'float turb = uFlicker * (1. - 0.75 * uSphere);',
          'float n1 = vnoise(vec3(position.xz * 22., h * 5. - uTime * 3.2)) - 0.5, n2 = vnoise(vec3(position.xz * 48. + 7., h * 11. - uTime * 5.5)) - 0.5;',
          'transformed.xz *= 1.0 + (n1 * 0.7 + n2 * 0.3) * h * turb;                          // licks',
          'transformed.x += (vnoise(vec3(uTime * 1.7, h * 2.2, 3.)) - 0.5) * 0.07 * h * h * turb; transformed.z += (vnoise(vec3(7., h * 2.2, uTime * 1.5)) - 0.5) * 0.07 * h * h * turb;   // the tip wanders',
          'transformed.y *= 1.0 + (vnoise(vec3(uTime * 4.3, 1., 5.)) - 0.5) * 0.3 * turb;',
          'vec3 nn = normalize(mix(vec3(normal.x, 0.25, normal.z), sN, uSphere)); vec4 mvF = modelViewMatrix * vec4(transformed, 1.);',
          'vF = abs(dot(normalize(normalMatrix * nn), normalize(-mvF.xyz))); vP = position;'].join('\n'));
        s.fragmentShader = 'uniform float uBlue, uSphere, uGain, uTime, uRound; varying float vH; varying float vF; varying vec3 vP;\n' + NOISE + s.fragmentShader.replace('#include <color_fragment>', [
          'float fn = vnoise(vec3(vP.xz * 30., vH * 7. - uTime * 3.6));',
          'float heat = clamp(pow(vF, 1.3) * (1.15 - vH * 0.7) + (fn - 0.5) * 0.25, 0., 1.);',
          'vec3 warm = mix(vec3(0.75, 0.08, 0.0), vec3(1.0, 0.42, 0.02), smoothstep(0.0, 0.4, heat)); warm = mix(warm, vec3(1.0, 0.8, 0.22), smoothstep(0.35, 0.75, heat)); warm = mix(warm, vec3(1.0, 0.96, 0.78), smoothstep(0.75, 1.0, heat));',
          'warm = mix(warm, vec3(0.12, 0.38, 1.0), (1. - smoothstep(0.02, 0.2, vH)) * 0.85);                      // blue where gas and air first meet',
          'vec3 cool = mix(vec3(0.03, 0.14, 0.9), vec3(0.12, 0.45, 1.0), smoothstep(0.0, 0.5, heat)); cool = mix(cool, vec3(0.6, 0.86, 1.0), smoothstep(0.6, 1.0, heat));',
          'float shell = pow(1. - vF, 1.6);                                                                       // a round flame is brightest at its edge',
          'cool = mix(cool, vec3(0.02, 0.2, 0.95) + shell * vec3(0.08, 0.34, 0.05), uSphere);',
          'vec3 fc = mix(warm, cool, smoothstep(0.05, 0.95, uBlue)); fc = clamp(mix(vec3(dot(fc, vec3(0.33))), fc, 1.5), 0., 1.);',
          'diffuseColor.rgb = fc * uGain * mix(1., uRound, uSphere);',
          'float body = smoothstep(0.0, 0.4, vF) * (1. - smoothstep(0.5, 1.0, vH + (fn - 0.5) * 0.45));',
          'diffuseColor.a *= mix(body, 0.34 + 0.6 * shell, uSphere);'].join('\n'));
      };
      return mt;
    }
    var fireGeo = new T.ConeGeometry(0.075, 0.2, 56, 28, true); fireGeo.translate(0, 0.1, 0);
    var fire = group(burner.x, burner.y + 0.005, burner.z, scene, 'fire');
    var fireGlow = put(fireGeo, fireMat(true, 0.35, 0.5), 0, 0, 0, fire), fireBody = put(fireGeo, fireMat(false, 1.0, 0.92), 0, 0, 0, fire), fireCore = put(fireGeo, fireMat(true, 0.6, 0.85), 0, 0, 0, fire);
    fireGlow.scale.set(1.3, 1.12, 1.3); fireCore.scale.set(0.5, 0.62, 0.5);
    fireGlow.userData.noCast = fireBody.userData.noCast = fireCore.userData.noCast = true; fireGlow.renderOrder = 2; fireBody.renderOrder = 3; fireCore.renderOrder = 4;
    flameLight = new T.PointLight(0x6aa8ff, 0.6, 2.2); flameLight.position.set(burner.x, burner.y + 0.1, burner.z + 0.15); scene.add(flameLight);

    flameHalo = halo(0x4a8cff, 0.5, burner.x, burner.y + 0.02, burner.z, scene, 0.7);
    burnerWorld.copy(burner);
    E.parts.jets = flameJets; E.parts.light = flameLight; E.parts.halo = flameHalo; E.parts.ball = flameBall; E.parts.fire = { group: fire, uniforms: fireU };

    // ---- gas canister: this is a gas stove, so here is its fuel ----
    var canister = group(-0.29, 0, -1.78, scene, 'canister');
    var canRed = std(0xb8432a, 0.42, 0.25);
    tube(0.135, 0.135, 0.36, canRed, 0, 0.21, 0, canister);
    var dome = put(new T.SphereGeometry(0.135, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), canRed, 0, 0.39, 0, canister); dome.scale.y = 0.6;
    var base = put(new T.SphereGeometry(0.135, 32, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), canRed, 0, 0.03, 0, canister); base.scale.y = 0.25;
    tube(0.11, 0.11, 0.03, std(0x7d2c1b, 0.5, 0.25), 0, 0.012, 0, canister);
    put(new T.CylinderGeometry(0.085, 0.085, 0.08, 32, 1, true, 0.6, 5.1), new T.MeshStandardMaterial({ color: 0xb8432a, roughness: 0.42, metalness: 0.25, side: T.DoubleSide }), 0, 0.5, 0, canister);
    tube(0.03, 0.035, 0.05, brass, 0, 0.485, 0, canister); tube(0.012, 0.012, 0.06, brass, 0, 0.53, 0, canister);
    var wheel = put(new T.TorusGeometry(0.035, 0.008, 8, 20), std(0x23262a, 0.5), 0, 0.565, 0, canister); wheel.rotation.x = Math.PI / 2;
    rbox(0.07, 0.006, 0.006, 0.002, std(0x23262a, 0.5), 0, 0, 0, wheel); E.parts.wheel = wheel;   // a spoke, so the turn is visible
    rbox(0.16, 0.1, 0.006, 0.003, white, 0, 0.24, 0.134, canister);
    var hosePath = new T.CatmullRomCurve3([new T.Vector3(0.03, 0.5, 0), new T.Vector3(0.1, 0.5, 0.02), new T.Vector3(0.16, 0.56, -0.04), new T.Vector3(0.15, 0.7, -0.12), new T.Vector3(0.13, 0.78, -0.2)]);
    put(new T.TubeGeometry(hosePath, 28, 0.011, 8, false), std(0x15161a, 0.6), 0, 0, 0, canister);
    floater(canister, new T.Vector3(-0.9, 0.9, 0.9), new T.Vector3(0.08, 0.12, 0.1));

    // ---- oil bottle beside the stove ----
    var bottle = group(-0.62, 0.905, -1.92, scene, 'bottle');
    tube(0.045, 0.045, 0.2, new T.MeshStandardMaterial({ color: 0xd9a93a, roughness: 0.15, transparent: true, opacity: 0.88 }), 0, 0.1, 0, bottle);
    tube(0.018, 0.04, 0.06, new T.MeshStandardMaterial({ color: 0xd9a93a, roughness: 0.15, transparent: true, opacity: 0.88 }), 0, 0.23, 0, bottle);
    tube(0.021, 0.021, 0.03, iron, 0, 0.275, 0, bottle); rbox(0.07, 0.08, 0.004, 0.002, white, 0, 0.1, 0.045, bottle);
    floater(bottle, new T.Vector3(0.5, 0.55, 0.8), new T.Vector3(0.12, 0.2, 0.18));

    // ---- mug and toy rocket on the counter ----
    var mug = group(-0.9, 0.96, -1.9, scene, 'mug');
    tube(0.05, 0.045, 0.11, std(0xf3ead6, 0.4), 0, 0, 0, mug); put(new T.TorusGeometry(0.032, 0.01, 10, 20), std(0xf3ead6, 0.4), 0.055, 0, 0, mug);
    floater(mug, new T.Vector3(-0.3, 0.7, 0.9), new T.Vector3(0.25, 0.15, 0.2));
    var rocket = group(-1.35, 0.905, -1.85, scene, 'rocket');
    tube(0.045, 0.05, 0.17, std(0xf3ead6, 0.4), 0, 0.115, 0, rocket); put(new T.ConeGeometry(0.045, 0.09, 28), std(0xc93a30, 0.45), 0, 0.245, 0, rocket);
    ball(0.018, std(0x5f8fb8, 0.2), 0, 0.14, 0.046, rocket);
    [0, 2.094, 4.189].forEach(function (a) { var fin = rbox(0.012, 0.07, 0.05, 0.005, std(0xc93a30, 0.45), Math.cos(a) * 0.055, 0.04, Math.sin(a) * 0.055, rocket); fin.rotation.y = -a; });
    floater(rocket, new T.Vector3(0.5, 1.1, 1.0), new T.Vector3(0.05, 0.3, 0.12));

    ['stove', 'pan', 'egg', 'bottle', 'canister', 'mug', 'rocket'].forEach(function (nm) { K.pickable.push(nm); K.outline.push(nm); });

    // every frame: flicker the flames; in free fall they pull into blue balls
    E.onFrame(function (t, f) {
      var free = f.free, still = f.still;
      if (!f.focus) { flameJets.visible = !free; flameBall.visible = free; flameHalo.visible = true; }
      flameJets.children.forEach(function (c, q) { c.scale.y = 0.85 + 0.35 * Math.abs(Math.sin(t * 8 + q * 1.7)); });
      stove.updateMatrixWorld(true);
      flameBall.position.copy(stove.localToWorld(BURNER.clone().add(new T.Vector3(0, 0.07, 0))));
      flameBall.scale.setScalar(1 + 0.05 * Math.sin(t * 3));
      candles.forEach(function (c, q) {
        var fl = still ? 0 : Math.sin(t * 13 + q * 2.1) * 0.5 + Math.sin(t * 7.3 + q) * 0.5;
        c.flame.scale.set(free ? 1.4 : 1, free ? 1.4 : 2 + 0.3 * fl, free ? 1.4 : 1);
        c.flame.material.color.setHex(free ? 0x5aa8ff : 0xffb347); c.halo.material.color.setHex(free ? 0x4a8cff : 0xff9a3c);
        c.light.color.setHex(free ? 0x6aa8ff : 0xff9838); c.light.intensity = 0.8 + 0.14 * fl;
      });
      flameLight.intensity = (free ? 0.9 : 0.6) + (still ? 0 : 0.08 * Math.sin(t * 11));
      if (free) flameLight.position.copy(flameBall.position); else flameLight.position.set(burnerWorld.x, burnerWorld.y + 0.1, burnerWorld.z + 0.15);
      flameHalo.position.copy(free ? flameBall.position : burnerWorld); flameHalo.material.opacity = 0.6 + (still ? 0 : 0.12 * Math.sin(t * 9));
    });
  });
})();
