/* Scene "orbit" (the ISS button): free fall above the Earth.
 * The stove stands on the hull of a station module; a station drawn in code (truss, solar wings, radiators,
 * modules) hangs behind it and the Earth turns below. An original illustration, not a model of the real ISS.
 * freeFall: true tells the engine to let the loose props drift and the flame go round.
 */
(function () {
  var T = THREE, K = SoraineKit, std = K.std, glow = K.glow, put = K.put, rbox = K.rbox, tube = K.tube, halo = K.halo, canvasTex = K.canvasTex;
  var earth, clouds, station, wings = [], beacons = [], stars;

  function panelTex(base, line, nx, ny) {                       // a grid of panels: solar cells, hull blankets, radiators
    return canvasTex(256, function (c, s) {
      c.fillStyle = base; c.fillRect(0, 0, s, s); c.strokeStyle = line; c.lineWidth = 2;
      for (var i = 0; i <= nx; i++) { c.beginPath(); c.moveTo(i * s / nx, 0); c.lineTo(i * s / nx, s); c.stroke(); }
      for (var j = 0; j <= ny; j++) { c.beginPath(); c.moveTo(0, j * s / ny); c.lineTo(s, j * s / ny); c.stroke(); }
      for (var k = 0; k < 500; k++) { c.fillStyle = 'rgba(255,255,255,' + Math.random() * 0.05 + ')'; c.fillRect(Math.random() * s, Math.random() * s, 3, 3); }
    });
  }
  function mat(tex, rough, metal, rx, ry) { var m = std(0xffffff, rough, metal); m.map = tex.clone(); m.map.needsUpdate = true; m.map.wrapS = m.map.wrapT = T.RepeatWrapping; m.map.repeat.set(rx || 1, ry || 1); return m; }
  function module(parent, r, len, x, y, z, axis, m) {           // a pressurised module: cylinder, tapered ends, ribs
    var g = new T.Group(); g.position.set(x, y, z); parent.add(g); if (axis === 'x') g.rotation.z = Math.PI / 2; if (axis === 'z') g.rotation.x = Math.PI / 2;
    tube(r, r, len, m, 0, 0, 0, g); tube(r * 0.6, r, r * 0.5, m, 0, len / 2 + r * 0.25, 0, g); tube(r, r * 0.6, r * 0.5, m, 0, -len / 2 - r * 0.25, 0, g);
    for (var i = -1; i <= 1; i++) { var rib = put(new T.TorusGeometry(r * 1.02, r * 0.035, 8, 40), K.mat.chrome, 0, i * len * 0.33, 0, g); rib.rotation.x = Math.PI / 2; }
    return g;
  }

  K.scenes.orbit = {
    background: 0x000000,
    freeFall: true,
    sun: [5.5, 6.5, -16],
    camera: function (aspect) { return K.scenes.earth.camera(aspect); },
    build: function (E, g) {
      var SP = window.SORAINE_SPACE;
      stars = K.starField(g, 1100, 60);
      this.envMap = K.makeEnv(E.renderer, { top: 0x05060a, bottom: 0x1c4f86, sharp: 8, lights: [{ at: [5.5, 6.5, -16], color: 0xfff4e0, size: 2.5, power: 14 }] });

      // the Earth below, turning slowly, with a thin blue limb
      var EC = [2, -43.2, -14], sunDir = new T.Vector3(5.5, 6.5, -16).normalize();
      var em = std(0x2f76a8, 0.85); earth = put(new T.SphereGeometry(40, 192, 128), em, EC[0], EC[1], EC[2], g, 'earthBelow'); earth.rotation.set(0.5, 1.2, 0.2); earth.userData.noCast = true;
      em.onBeforeCompile = function (sh) {                         // seas glint in the sun, land stays matt; colours get a little more depth
        sh.fragmentShader = sh.fragmentShader.replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n float sea = smoothstep(0.02, 0.12, diffuseColor.b - max(diffuseColor.r, diffuseColor.g) * 0.95); roughnessFactor = mix(0.95, 0.32, sea);')
          .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = pow(diffuseColor.rgb, vec3(1.12)) * 1.18;');
      };
      function useMap(src, aniso) { new T.TextureLoader().load(src, function (tex) { tex.encoding = T.sRGBEncoding; tex.anisotropy = aniso; if (em.map) em.map.dispose(); em.map = tex; em.color.setHex(0xffffff); em.needsUpdate = true; }); }
      if (SP && SP.earth) useMap(SP.earth, 8);                    // the small picture first, then the 4096 x 2048 one once its file has loaded
      // Keep the prepared local Earth map; no late HD texture replacement.
      var cm = new T.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, roughness: 1, depthWrite: false });
      cm.alphaMap = canvasTex(1024, function (c, s) {              // clouds drawn in code (not weather data): bands, swirls and broken fields
        var im = c.createImageData(s, s), d = im.data, x, y, i = 0, f = K.fbm;
        for (y = 0; y < s; y++) for (x = 0; x < s; x++, i += 4) {
          var u = x / s * 14, v = y / s * 7, w = f(u * 0.7 + 3, v * 0.7) * 2.2, n = f(u + w, v * 1.6 + w * 0.6) + 0.5 * f(u * 3.1 + w, v * 3.1) + 0.25 * f(u * 7.3, v * 7.3);
          var lat = Math.abs(y / s - 0.5) * 2, band = 0.06 + 0.1 * Math.cos(lat * 9.5) * (1 - lat) + 0.12 * lat * lat, a = Math.max(0, Math.min(1, (n + band - 0.24) * 3.6));
          d[i] = d[i + 1] = d[i + 2] = a * a * (3 - 2 * a) * 255; d[i + 3] = 255;
        }
        c.putImageData(im, 0, 0);
      });
      cm.alphaMap.anisotropy = 8;
      clouds = put(new T.SphereGeometry(40.22, 160, 100), cm, EC[0], EC[1], EC[2], g); clouds.userData.noCast = clouds.userData.noReceive = true;
      var limb = put(new T.SphereGeometry(41.4, 128, 80), new T.ShaderMaterial({ transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.BackSide, uniforms: { sun: { value: sunDir } },
        vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vW = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * mv; }',
        fragmentShader: 'uniform vec3 sun; varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ float rim = pow(clamp(abs(dot(normalize(vN), normalize(vV))) * 3.2, 0., 1.), 2.0); float day = smoothstep(-0.35, 0.3, dot(normalize(vW), sun)); gl_FragColor = vec4(mix(vec3(0.2, 0.5, 1.0), vec3(0.65, 0.85, 1.0), rim) * rim * (0.25 + day) * 1.1, 1.0); }' }), EC[0], EC[1], EC[2], g);
      limb.userData.noCast = limb.userData.noReceive = true;

      // the hull the stove stands on: a big module seen from outside, with blanket panels, handrails and a hatch
      var hullM = mat(panelTex('#d9dbdd', '#9a9fa6', 8, 4), 0.6, 0.15, 6, 2), gold = std(0xc9a24a, 0.35, 0.9), dark = std(0x1a1c20, 0.6, 0.3);
      var hull = put(new T.CylinderGeometry(2.6, 2.6, 9, 72, 1), hullM, 0.3, -2.6, -2.0, g, 'hull'); hull.rotation.z = Math.PI / 2;
      [-3.2, -1.1, 1.7, 3.8].forEach(function (x) { var rb = put(new T.TorusGeometry(2.62, 0.035, 8, 80), K.mat.chrome, x, -2.6, -2.0, g); rb.rotation.y = Math.PI / 2; });
      for (var h = 0; h < 5; h++) {                              // handrails along the top of the hull
        var hx = -1.9 + h * 1.05, hz = h % 2 ? -1.15 : -2.9, dy = 2.6 - Math.sqrt(2.6 * 2.6 - (hz + 2) * (hz + 2));
        rbox(0.5, 0.02, 0.02, 0.008, gold, hx, 0.07 - dy, hz, g); tube(0.008, 0.008, 0.07, gold, hx - 0.23, 0.035 - dy, hz, g); tube(0.008, 0.008, 0.07, gold, hx + 0.23, 0.035 - dy, hz, g);
      }
      var hatch = put(new T.TorusGeometry(0.34, 0.035, 10, 40), K.mat.chrome, -1.25, -0.025, -1.75, g); hatch.rotation.x = Math.PI / 2; tube(0.33, 0.33, 0.02, dark, -1.25, -0.02, -1.75, g);
      var win = tube(0.12, 0.12, 0.025, new T.MeshStandardMaterial({ color: 0x0a1626, roughness: 0.08, metalness: 0.6, emissive: 0xffc27a, emissiveIntensity: 0.35 }), -1.25, -0.01, -1.75, g);
      var mast = tube(0.012, 0.012, 0.7, K.mat.chrome, 1.75, 0.3, -2.75, g), dish = put(new T.SphereGeometry(0.2, 32, 12, 0, Math.PI * 2, 0, 1.0), std(0xe9eaec, 0.4, 0.3), 1.75, 0.82, -2.75, g); dish.rotation.x = Math.PI + 0.5; dish.material.side = T.DoubleSide;
      [[-2.4, -0.02, -1.2, 0xff3b30], [2.9, -0.06, -1.3, 0x38e07b]].forEach(function (b) { tube(0.02, 0.025, 0.05, dark, b[0], b[1], b[2], g); var l = halo(b[3], 0.28, b[0], b[1] + 0.05, b[2], g, 0.9); beacons.push(l); });

      // the rest of the station, further off: truss, eight solar wings, radiators, modules
      station = new T.Group(); station.position.set(-7.5, 5.2, -30); station.rotation.set(0.34, 0.62, -0.2); station.scale.setScalar(1.35); g.add(station);
      var cell = panelTex('#14294f', '#7f95c4', 8, 28), rad = panelTex('#eef0f2', '#b9bec6', 3, 10), modM = mat(panelTex('#cfd2d6', '#8f959d', 6, 3), 0.55, 0.2, 3, 1);
      rbox(15, 0.32, 0.32, 0.04, std(0x8d9198, 0.5, 0.6), 0, 0, 0, station);
      for (var t = -7; t <= 7; t++) rbox(0.05, 0.42, 0.42, 0.01, K.mat.chrome, t, 0, 0, station);
      [-6.6, -4.9, 4.9, 6.6].forEach(function (x, i) {
        [-1, 1].forEach(function (s) {
          var w = new T.Group(); w.position.set(x, 0, s * 0.3); station.add(w); tube(0.03, 0.03, 0.5, K.mat.chrome, 0, 0, s * 0.25, w).rotation.x = Math.PI / 2;
          var p = put(new T.BoxGeometry(1.15, 0.02, 3.6), mat(cell, 0.3, 0.55), 0, 0, s * 2.3, w); p.material.emissive = new T.Color(0x0a1a44); p.material.emissiveIntensity = 0.5; wings.push(w);
        });
      });
      [-1.6, 1.6].forEach(function (x) { var r = put(new T.BoxGeometry(0.9, 0.02, 2.2), mat(rad, 0.5, 0.1), x, -0.25, -1.4, station); r.rotation.x = 0.5; });
      module(station, 0.55, 3.4, 0, -0.75, 1.4, 'z', modM); module(station, 0.5, 2.6, 0, -0.75, -1.9, 'z', modM); module(station, 0.48, 2.4, -1.7, -0.75, 0.3, 'x', modM); module(station, 0.48, 2.4, 1.7, -0.75, 0.3, 'x', modM);
      module(station, 0.36, 1.2, 0, -1.55, 2.4, 'y', mat(panelTex('#b9a56a', '#7d6c3c', 5, 3), 0.45, 0.7, 2, 1));
      var foil = std(0xd8b25a, 0.3, 0.85), wht = std(0xf1f2f4, 0.5, 0.1);
      module(station, 0.42, 1.9, 0, -0.75, 3.9, 'z', modM); module(station, 0.4, 1.6, 0, -0.75, -3.9, 'z', modM); module(station, 0.34, 1.3, -3.4, -0.75, 0.3, 'x', wht); module(station, 0.34, 1.3, 3.4, -0.75, 0.3, 'x', wht);
      module(station, 0.3, 0.9, 0, 0.55, 1.2, 'y', foil); module(station, 0.26, 0.8, -1.7, -1.5, 0.3, 'y', wht);
      [-3.2, 3.2].forEach(function (x) { for (var q = 0; q < 3; q++) { var r2 = put(new T.BoxGeometry(0.75, 0.02, 2.0), mat(rad, 0.5, 0.1), x + (q - 1) * 0.8, -0.2, 1.5, station); r2.rotation.x = -0.45; } });
      for (var bx = -6; bx <= 6; bx += 1.5) { rbox(0.28, 0.2, 0.28, 0.03, foil, bx, 0.26, 0, station); tube(0.008, 0.008, 0.5, K.mat.chrome, bx + 0.4, 0.4, 0.1, station); }
      var d2 = put(new T.SphereGeometry(0.32, 28, 10, 0, Math.PI * 2, 0, 1.0), wht, 0.9, 0.75, -0.6, station); d2.rotation.x = Math.PI + 0.7; d2.material.side = T.DoubleSide; tube(0.015, 0.015, 0.55, K.mat.chrome, 0.9, 0.42, -0.6, station);
      var cup = put(new T.SphereGeometry(0.3, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: 0x10202e, roughness: 0.1, metalness: 0.7, emissive: 0xffc27a, emissiveIntensity: 0.25 }), 0, -1.3, 1.4, station); cup.rotation.x = Math.PI;
      halo(0xffe2b0, 0.5, 0, -0.75, 4.95, station, 0.8);                                                   // a docking light
      station.traverse(function (o) { o.userData.noCast = true; });

      var sunHalo = new T.Group(); sunHalo.position.set(5.5, 6.5, -16); g.add(sunHalo);
      halo(0xfff0c8, 7, 0, 0, 0, sunHalo, 0.9); halo(0xffffff, 1.6, 0, 0, 0, sunHalo, 1);
      var sun = new T.DirectionalLight(0xffffff, 1.5); sun.position.copy(sunHalo.position); g.add(sun);
      var fill = new T.DirectionalLight(0x9fc4ff, 0.75); fill.position.set(-1, -6, 4); g.add(fill);          // earthshine from below
      var rim = new T.DirectionalLight(0xbfd4ff, 0.35); rim.position.set(-2, 1.5, 6); g.add(rim);
    },
    update: function (E, t, still) {
      if (still) return;
      if (earth) { earth.rotation.y = 1.2 + t * 0.012; clouds.rotation.set(0.5, 1.2 + t * 0.016, 0.2); }
      if (station) { station.rotation.y = 0.5 + Math.sin(t * 0.05) * 0.06; station.position.y = 5.2 + Math.sin(t * 0.21) * 0.05; }
      for (var i = 0; i < wings.length; i++) wings[i].rotation.z = Math.sin(t * 0.08) * 0.25;
      for (var b = 0; b < beacons.length; b++) beacons[b].material.opacity = (Math.sin(t * 2.2 + b * 2) > 0.8) ? 0.95 : 0.12;
      if (stars) stars.rotation.y = t * 0.004;
    }
  };
})();
