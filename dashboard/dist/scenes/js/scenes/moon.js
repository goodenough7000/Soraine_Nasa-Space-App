/* Scene "moon": the lunar surface galley. The team's lunar landform (assets/terrain/moon.glb) as a dense smooth surface (js/ground.js),
 * the shared outpost (js/outpost.js), the real Earth above the horizon, a hard sun.
 */
(function () {
  var T = THREE, K = SoraineKit, std = K.std, glow = K.glow, put = K.put, roundedGeo = K.roundedGeo, rbox = K.rbox, tube = K.tube, ball = K.ball,
      group = K.group, halo = K.halo, canvasTex = K.canvasTex, rand = K.rand, floater = K.floater, objects = K.objects, m = K.mat;
  var cream = m.cream, creamDark = m.creamDark, white = m.white, chrome = m.chrome, brass = m.brass, iron = m.iron, sage = m.sage, sageDark = m.sageDark, wood = m.wood, woodDark = m.woodDark, teal = m.teal, plaster = m.plaster, tile = m.tile, stone = m.stone, leaf = m.leaf;
  var post, stars, stars2, clouds, comet;

  K.scenes.moon = {
    background: 0x04060b,
    exposure: 1.04,
    liveShadows: true,                        // things move here, so shadows redraw every frame
    hide: ['stool'],                          // props that stay behind on Earth
    place: { mug: [1.25, 0.055, -1.2], bottle: [2.05, 0, -2.2], rocket: [2.1, 0, -1.25] },   // where loose props sit here
    sun: [-30, 34, 41],                         // where the sun is: the scan ripple starts from this point
    camera: function (aspect) {               // raised three-quarter view of the whole platform
      return aspect < 0.8 ? { pos: [1.9, 2.2, 3.1], look: [0.6, 0.9, -1.7] } : { pos: [2.5, 1.8, 1.55], look: [0.7, 0.9, -1.7] };
    },
    build: function (E, moon) {
      var SP = window.SORAINE_SPACE, loader = new T.TextureLoader();
      stars = K.starField(moon, 1100, 70); stars2 = K.starField(moon, 260, 66); stars2.material = stars2.material.clone(); stars2.material.size = 3.4; stars2.material.transparent = true; stars2.material.color.setHex(0xcfe0ff); stars2.rotation.set(1.1, 0.6, 0);   // two layers that drift at different speeds
      // what the metal reflects: black sky, sunlit ground, a hard white sun and the blue Earth
      this.envMap = K.makeEnv(E.renderer, { top: 0x0c0d12, bottom: 0x6a6866, sharp: 8, lights: [{ at: [-4.9, 5.5, 6.7], color: 0xfff4e0, size: 2.5, power: 14 }, { at: [-12, 5.4, -60], color: 0x4f8fff, size: 6, power: 3 }] });

      // the ground: a small round world under the platform. The team's crater layout sets the big shapes, the lunar surface
      // picture gives broad light and dark patches, a sharp close-up layer drawn in code gives the grain, soft-rimmed craters are added, and it curves away so the horizon drops into the stars.
      var SUN = [-0.49, 0.55, 0.67];                            // one key light from the upper left: it lights the galley and the Earth alike
      var soilTex = loader.load(SP.moon); soilTex.wrapS = soilTex.wrapT = T.MirroredRepeatWrapping; soilTex.encoding = T.sRGBEncoding; soilTex.anisotropy = 16;   // lunar surface picture
      K.ground('moon', moon, [0.8, -0.004, -1.65], { pad: 0.62, bakeSteps: 16, sun: SUN, shade: 0.88, tint: [0.4, 0.4, 0.413], craters: 150, map: soilTex, fine: (function () { var rt = K.regolithTex(1024); rt.anisotropy = 16; return rt; })(), fineTile: 1.7, fineBump: 0.02, picMix: 0.45, tile: 28, curve: 19, relief: 1, reach: 62, spread: 0.75,
        farAmp: 1.6, rocks: 130, pebbles: 1600, rockColor: 0x5c5c60 });

      post = K.outpost(moon, { platform: false, gravity: K.g('moon'), rock: std(0x4f4f54, 1), dust: 0xd9d4c8 });   // 1.62 m/s2: lunar surface gravity

      // the Earth in the sky: the real Blue Marble picture, lit by the same key light as the galley
      // (so its day/night line matches the shadows on the ground), with a soft blue rim of atmosphere
      var EP = [-12, 5.6, -60], ER = 5.9, sunDir = new T.Vector3().fromArray(SUN).normalize();
      var earthMat = new T.MeshStandardMaterial({ color: 0x2f74c8, roughness: 0.48, metalness: 0.05, emissive: 0xffffff, emissiveIntensity: 0 });
      if (SP) loader.load(SP.earth, function (tex) {
        tex.encoding = T.sRGBEncoding; tex.anisotropy = 8; earthMat.map = tex; earthMat.emissiveMap = tex; earthMat.color.setHex(0xffffff); earthMat.emissiveIntensity = 0.26; earthMat.needsUpdate = true;
      });
      var earth = put(new T.SphereGeometry(ER, 64, 40), earthMat, EP[0], EP[1], EP[2], moon, 'earthRise'); earth.rotation.set(0.25, 3.9, 0.15);
      var cloudTex = canvasTex(1024, function (g, n) {           // thin wispy cloud drawn in code (for looks, not weather data)
        var img = g.createImageData(n, n), d = img.data;
        for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
          var u = x / n * 26, v = y / n * 13, wx = 3 * K.fbm(u * 0.5, v * 0.5), wy = 3 * K.fbm(u * 0.5 + 9, v * 0.5 + 4);
          var w = K.fbm(u + wx, v * 1.5 + wy) + 0.55 * K.fbm(u * 3.3 + wy, v * 3.3) + 0.3 * K.fbm(u * 7.7, v * 7.7), lat = Math.abs(y / n - 0.5) * 2;
          var al = Math.max(0, Math.min(1, (w - 0.07 + 0.1 * Math.sin(lat * 9)) * 3.4)), o = (y * n + x) * 4; d[o] = d[o + 1] = d[o + 2] = 255; d[o + 3] = al * 200;
        }
        g.putImageData(img, 0, 0);
      });
      cloudTex.anisotropy = 8;
      clouds = put(new T.SphereGeometry(ER * 1.008, 96, 64), new T.MeshStandardMaterial({ map: cloudTex, transparent: true, roughness: 1, depthWrite: false, emissive: 0xffffff, emissiveIntensity: 0.1 }), EP[0], EP[1], EP[2], moon, 'earthClouds');
      clouds.rotation.set(0.25, 1.2, 0.15); clouds.userData.noCast = clouds.userData.noReceive = true;

      // a small comet that crosses the far sky now and then (an original background detail)
      comet = group(0, 0, 0, moon, 'comet');
      var tail = put(new T.PlaneGeometry(9, 0.9), new T.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, map: canvasTex(256, function (g, n) {
        var lg = g.createLinearGradient(0, 0, n, 0); lg.addColorStop(0, 'rgba(150,200,255,0)'); lg.addColorStop(0.75, 'rgba(170,215,255,.35)'); lg.addColorStop(1, 'rgba(255,255,255,.95)'); g.fillStyle = lg; g.fillRect(0, 0, n, n);
        var vg = g.createLinearGradient(0, 0, 0, n); vg.addColorStop(0, 'rgba(0,0,0,1)'); vg.addColorStop(0.5, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = vg; g.fillRect(0, 0, n, n);
      }) }), -4.5, 0, 0, comet); tail.userData.noCast = true;
      halo(0xdff0ff, 2.2, 0, 0, 0, comet, 0.9); comet.rotation.z = -0.32;

      var air = put(new T.SphereGeometry(ER * 1.05, 64, 40), new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, uniforms: { sun: { value: sunDir } },
        vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vW = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform vec3 sun; varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); float day = smoothstep(-0.3, 0.45, dot(normalize(vW), sun)); gl_FragColor = vec4(vec3(0.38, 0.66, 1.0) * (rim + 0.6 * pow(rim, 0.6) * day * 0.35) * (0.3 + day) * 3.0, 1.0); }' }), EP[0], EP[1], EP[2], moon, 'earthAir');
      halo(0x5f9dff, ER * 3.0, EP[0] + sunDir.x * 0.8, EP[1] + sunDir.y * 0.8, EP[2] - 1, moon, 0.42);   // soft glow, offset toward the lit side
      [earth, air].forEach(function (o) { o.userData.noCast = o.userData.noReceive = true; });

      // the key light: unfiltered sun from the upper left, hard shadows; a little blue fill from the Earth
      var sunL = new T.DirectionalLight(0xfff3e2, 2.25); sunL.position.set(0.8 + SUN[0] * 16, SUN[1] * 16, -1.65 + SUN[2] * 16); sunL.target.position.set(0.8, 0, -1.65); sunL.castShadow = true;
      sunL.shadow.mapSize.set(2048, 2048); sunL.shadow.bias = -0.0002; sunL.shadow.normalBias = 0.03; sunL.shadow.radius = 1.5;
      var sc = sunL.shadow.camera; sc.left = -11; sc.right = 11; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 60;
      moon.add(sunL); moon.add(sunL.target);
      var earthFill = new T.DirectionalLight(0x86aaff, 0.95); earthFill.position.set(EP[0], EP[1], EP[2]); moon.add(earthFill);   // earthshine
      moon.add(new T.HemisphereLight(0xfff0dc, 0xa39a8e, 0.19));                                 // soft warm fill everywhere: sunlight bounced off the ground
      var fill = new T.DirectionalLight(0xffe6cc, 0.14); fill.position.set(6, 3, 8); moon.add(fill);   // warm fill from the camera side, no shadows, so the front of the platform reads                                 // light bounced off the bright ground lifts the shadows
    },
    update: function (E, t, still) {
      post.update(t, still);
      if (still) comet.visible = false; else { var ct = (t % 46) / 14; comet.visible = ct < 1; comet.position.set(-52 + ct * 30, 24 - ct * 9.5, -64); clouds.rotation.y = 1.2 + t * 0.003; }
      if (!still) { stars.rotation.y = t * 0.006; stars.rotation.x = t * 0.0015; stars2.rotation.y = 0.6 - t * 0.011; stars2.material.opacity = 0.75 + 0.25 * Math.sin(t * 0.9); }   // slow drift and a faint twinkle
    }
  };
})();
