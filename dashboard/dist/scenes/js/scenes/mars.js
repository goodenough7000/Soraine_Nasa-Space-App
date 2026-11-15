/* Scene "mars": the Mars galley. The team's mesa landform (assets/terrain/mars.glb)
 * as a dense smooth surface (js/ground.js), the shared outpost (js/outpost.js), a dusty butterscotch sky.
 */
(function () {
  var T = THREE, K = SoraineKit, std = K.std, glow = K.glow, put = K.put, roundedGeo = K.roundedGeo, rbox = K.rbox, tube = K.tube, ball = K.ball,
      group = K.group, halo = K.halo, canvasTex = K.canvasTex, rand = K.rand, floater = K.floater, objects = K.objects, m = K.mat;
  var cream = m.cream, creamDark = m.creamDark, white = m.white, chrome = m.chrome, brass = m.brass, iron = m.iron, sage = m.sage, sageDark = m.sageDark, wood = m.wood, woodDark = m.woodDark, teal = m.teal, plaster = m.plaster, tile = m.tile, stone = m.stone, leaf = m.leaf;
  var post, wisps = [], motes, devil = [], RM = 95, GY = 0.028;   // RM: radius of the round world (large: a wide, gently curving surface); GY: ground level, just above the props' feet so they sink into the sand
  function sink(x, z) { return RM * (1 - Math.cos(Math.max(0, Math.hypot(x - 0.8, z + 1.65) - 2.7) / RM)); }   // how far the round ground has dropped at (x, z)

  K.scenes.mars = {
    background: 0xe08a42,
    fog: [0xe08a42, 18, 210],                 // dust haze: far dunes fade into the glow at the horizon
    exposure: 1.0,
    liveShadows: true,
    hide: ['stool'],
    place: { mug: [1.25, 0.055, -1.2], bottle: [2.05, 0, -2.2], rocket: [2.1, 0, -1.25] },
    sun: [-244, 62, -153],                    // where the sun is: the scan ripple starts from this point
    camera: function (aspect) {               // lower and more level than the Moon view, so the twilight sky shows
      return aspect < 0.8 ? { pos: [2.0, 1.9, 3.4], look: [0.6, 1.05, -1.7] } : { pos: [2.6, 1.5, 1.9], look: [0.7, 1.1, -1.7] };
    },
    build: function (E, mars) {
      var i, SUN = [-0.8, 0.326, -0.503];                     // one low sun in the upper left of the view: it is the only directional light
      // what the metal reflects: dark sky above, rust ground below, the low sun
      this.envMap = K.makeEnv(E.renderer, { top: 0x4a2414, bottom: 0x6a2c14, sharp: 3, lights: [{ at: [-8.2, 2.3, -5.2], color: 0xffd9a8, size: 3, power: 10 }] });

      // twilight sky: dark rust-brown overhead, falling to a glowing amber haze at the horizon
      var sky = put(new T.SphereGeometry(450, 48, 32), new T.MeshBasicMaterial({ side: T.BackSide, fog: false, depthWrite: false, map: canvasTex(1024, function (g, n) {
        var lg = g.createLinearGradient(0, 0, 0, n); lg.addColorStop(0, '#120706'); lg.addColorStop(0.36, '#1d0b08'); lg.addColorStop(0.41, '#431609'); lg.addColorStop(0.445, '#7e2f12'); lg.addColorStop(0.475, '#bd5f24');
        lg.addColorStop(0.497, '#ea9a4c'); lg.addColorStop(0.52, '#e08a42'); lg.addColorStop(1, '#e08a42'); g.fillStyle = lg; g.fillRect(0, 0, n, n);
      }) }), 0, 0, 0, mars, 'marsSky'); sky.userData.noCast = true; sky.renderOrder = -2;

      // crisp white stars in the dark upper sky; they fade out toward the bright horizon
      var sp3 = [], sc3 = [];
      for (i = 0; i < 700; i++) { var el = (7 + rand() * 60) * Math.PI / 180, az = rand() * 6.283, b = Math.min(1, (el * 57.3 - 7) / 12) * (0.45 + rand() * 0.55);
        sp3.push(400 * Math.cos(el) * Math.cos(az), 400 * Math.sin(el), 400 * Math.cos(el) * Math.sin(az)); sc3.push(b, b, b); }
      var sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(sp3, 3)); sg.setAttribute('color', new T.Float32BufferAttribute(sc3, 3));
      var st = new T.Points(sg, new T.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true, blending: T.AdditiveBlending, depthWrite: false })); st.renderOrder = -1; st.frustumCulled = false; mars.add(st);

      // the sun, golden-white, low in the upper left; and the Earth, a small pale-blue dot in the upper right
      function skyDot(color, size, x, y, z, op, solid) { var h = halo(color, size, x, y, z, mars, op); h.material.fog = false; if (solid) h.material.blending = T.NormalBlending; return h; }
      skyDot(0xffa050, 120, -244, 62, -153, 0.5); skyDot(0xffe0a8, 44, -244, 62, -153, 0.9); skyDot(0xfffaf0, 14, -244, 62, -153, 1);
      skyDot(0x6fb0ff, 9, -17, 66, -290, 1, true); skyDot(0xb4d6ff, 4.5, -17, 66, -290, 1, true); skyDot(0x6aa8ff, 22, -17, 66, -290, 0.35);

      // the ground: a wide curving world in three layers. Near: the team's mesas and mounds at full height, banded cliffs, ripples,
      // rocks and grit around the props. Middle: rolling dunes right across the view. Far: hazy mesas and low mountains.
      var fine = K.regolithTex(1024, 70, 5200); fine.anisotropy = 16;
      K.ground('mars', mars, [0.8, GY, -1.65], { sun: SUN, shade: 0.86, tint: [0.6, 0.22, 0.1], fine: fine, fineTile: 1.7, fineBump: 0.034, tile: 28, curve: RM, relief: 1.15, reach: 230, grid: 256, bakeSteps: 16, spread: 1, pad: 0.62,
        farAmp: 2.5, dunes: 0.8, mesas: 20, mesaFrom: 40, strata: true, ripple: 0.06, rocks: 240, pebbles: 2800, rockColor: 0x3c1a0e });

      // dust in the air: low wisps drifting across the mid-ground dunes, fine motes blowing past, and one distant dust devil
      var puff = canvasTex(256, function (g, n) {
        for (var q = 0; q < 46; q++) { var px = n * (0.15 + rand() * 0.7), py = n * (0.36 + rand() * 0.28), r = n * (0.08 + rand() * 0.16), rg = g.createRadialGradient(px, py, 0, px, py, r);
          rg.addColorStop(0, 'rgba(255,255,255,.16)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, n, n); }
      });
      for (i = 0; i < 18; i++) {
        var sp = new T.Sprite(new T.SpriteMaterial({ map: puff, color: 0xd98a50, transparent: true, opacity: 0.3, depthWrite: false }));
        sp.scale.set(9 + rand() * 10, 1.6 + rand() * 2, 1); mars.add(sp); wisps.push({ o: sp, x: rand() * 60, z: -6 - rand() * 26, lift: 0.4 + rand() * 0.9, v: 0.35 + rand() * 0.5, a: 0.2 + rand() * 0.2 });
      }
      var mp = new Float32Array(700 * 3); for (i = 0; i < 700; i++) { mp[i * 3] = rand() * 30 - 15; mp[i * 3 + 1] = rand() * 5 - 0.6; mp[i * 3 + 2] = rand() * 13 - 14; }
      var mg = new T.BufferGeometry(); mg.setAttribute('position', new T.BufferAttribute(mp, 3));
      motes = new T.Points(mg, new T.PointsMaterial({ color: 0xffd9ae, size: 0.035, transparent: true, opacity: 0.7, depthWrite: false })); motes.frustumCulled = false; mars.add(motes);
      for (i = 0; i < 14; i++) {
        var dv = new T.Sprite(new T.SpriteMaterial({ map: puff, color: 0xa8521f, transparent: true, opacity: 0.8, depthWrite: false })), f = i / 13;
        dv.scale.set(0.9 + f * f * 3.4, 1.3, 1); mars.add(dv); devil.push({ o: dv, f: f });
      }

      post = K.outpost(mars, { platform: false, gravity: K.g('mars'), rock: std(0x6e2f18, 1), dust: 0xe0b08a });   // 3.71 m/s2: Mars surface gravity

      // the single key light: the low sun. Long clean shadows; sky and ground light keep the shaded sides readable.
      var sunL = new T.DirectionalLight(0xffc27a, 3.4); sunL.position.set(0.8 + SUN[0] * 18, SUN[1] * 18, -1.65 + SUN[2] * 18); sunL.target.position.set(0.8, 0, -1.65); sunL.castShadow = true;
      sunL.shadow.mapSize.set(2048, 2048); sunL.shadow.bias = -0.0003; sunL.shadow.normalBias = 0.03; sunL.shadow.radius = 1.4;
      var sc = sunL.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 8; sc.bottom = -8; sc.near = 1; sc.far = 60;
      mars.add(sunL); mars.add(sunL.target);
      mars.add(new T.HemisphereLight(0xd89a6a, 0x8a3a1c, 0.4));                                 // warm light bounced from sky and sand keeps the dunes and far ridges in colour
    },
    update: function (E, t, still) {
      post.update(t, still); var tt = still ? 0 : t, k;
      for (k = 0; k < wisps.length; k++) {                       // wisps slide right to left with the wind and wrap around
        var w = wisps[k], x = 30 - ((w.x + tt * w.v) % 60), edge = Math.min(1, (30 - Math.abs(x)) / 8);
        w.o.position.set(x, GY - sink(x, w.z) + w.lift, w.z); w.o.material.opacity = w.a * edge;
      }
      motes.position.x = -((tt * 0.6) % 6); motes.position.y = Math.sin(tt * 0.3) * 0.08;
      for (k = 0; k < devil.length; k++) {                       // a thin leaning column that twists as it wanders
        var d = devil[k], bx = 9 + Math.sin(tt * 0.07) * 1.5, bz = -22;
        d.o.position.set(bx + d.f * 0.9 + Math.sin(tt * 1.7 + d.f * 7) * (0.08 + d.f * 0.35), GY - sink(bx, bz) + 0.3 + d.f * 5.2, bz + Math.cos(tt * 1.3 + d.f * 6) * 0.2);
        d.o.material.rotation = tt * 0.9 + k; d.o.material.opacity = 0.85 - d.f * 0.45;
      }
    }
  };
})();
