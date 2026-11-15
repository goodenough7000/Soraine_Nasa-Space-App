/* The ground for the Moon and Mars scenes.
 *
 *   K.ground(name, parent, at, opts)
 *     name    'moon' or 'mars': which of the team's landforms to use (js/terrain-data.js)
 *     at      [x, y, z] where the platform stands; the flattest spot of the landform is moved here
 *     opts    { sun [x,y,z] direction to the sun (long shadows are baked from it), shade 0..1 darkness of those shadows,
 *               tint, craters, map (colour picture), fine (close-up layer over the picture), picMix (0..1 how strongly the picture shows), detail (bump only), tile, bump, farAmp, strata, rocks, pebbles, rockColor,
 *               curve: radius in metres to wrap the ground over a small round world (the horizon then falls away),
 *               dunes: height of rolling dunes in the midground, mesas: height of far mesas, mesaFrom: distance they start at,
 *               grid: surface resolution (default 256),
 *               pad: size of the level patch the props stand on (1 = platform sized),
 *               relief: 0..1 scale of the landform heights, reach: how far the surface extends, spread: how far stones scatter }
 *   Returns { height(x, z), mesh }.
 *
 * One dense smooth surface: fine near the platform, coarser toward the horizon. The big shapes are the
 * team's; small craters, grain, rocks and pebbles are added here.
 */
(function () {
  var T = THREE, K = SoraineKit, rand = K.rand;

  // lattice values for the noise, worked out once into a 256 x 256 table (the lookup is many times faster than a sine per call)
  var HASH = new Float32Array(65536);
  (function () { for (var j = 0; j < 256; j++) for (var i = 0; i < 256; i++) { var n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; HASH[j * 256 + i] = n - Math.floor(n); } })();
  function hash(i, j) { return HASH[((j & 255) << 8) | (i & 255)]; }
  function noise(x, z) {                                        // smooth value noise, 0..1
    var i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j; fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
    var a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }
  function fbm(x, z) { return (noise(x, z) + 0.5 * noise(x * 2.03 + 7.1, z * 2.03 + 3.3) + 0.25 * noise(x * 4.1 + 1.7, z * 4.1 + 9.2)) / 1.75 - 0.5; }
  function smooth(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }
  function bytes(b64) { var s = atob(b64), u = new Uint8Array(s.length); for (var q = 0; q < s.length; q++) u[q] = s.charCodeAt(q); return u; }
  K.noise = noise; K.fbm = fbm;

  // a grainy, pebbly tile drawn in code (used where there is no photograph)
  K.grainTex = function (size) {
    var tex = K.canvasTex(size, function (g, n) {
      var img = g.createImageData(n, n), d = img.data, per = 8;
      function wn(x, y, f) { var p = per * f, i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
        var i1 = (i + 1) % p, j1 = (j + 1) % p; i %= p; j %= p; var a = hash(i, j + f * 17), b = hash(i1, j + f * 17), c = hash(i, j1 + f * 17), e = hash(i1, j1 + f * 17);
        return a + (b - a) * fx + (c - a) * fy + (a - b - c + e) * fx * fy; }
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
        var u = x / n * per, v = y / n * per, s = 0.5 * wn(u, v, 1) + 0.25 * wn(u * 2, v * 2, 2) + 0.15 * wn(u * 4, v * 4, 4) + 0.1 * wn(u * 8, v * 8, 8) + 0.1 * wn(u * 16, v * 16, 16);
        var c2 = 150 + s * 95 + (hash(x, y) - 0.5) * 22, o = (y * n + x) * 4; d[o] = d[o + 1] = d[o + 2] = c2; d[o + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      for (var k = 0; k < 900; k++) {                           // scattered grit: a dark underside and a light top
        var px = rand() * n, py = rand() * n, r = 0.6 + rand() * rand() * 3.2;
        g.fillStyle = 'rgba(40,30,25,.5)'; g.beginPath(); g.arc(px + r * 0.4, py + r * 0.4, r, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,245,235,.55)'; g.beginPath(); g.arc(px, py, r * 0.8, 0, 7); g.fill();
      }
    });
    tex.wrapS = tex.wrapT = T.RepeatWrapping; return tex;
  };

  // sharp close-up regolith drawn in code: soft tonal grain, then crisp little craters and pebbles lit from the upper left
  K.regolithTex = function (size, nCraters, nPebbles) {
    var tex = K.canvasTex(size, function (g, n) {
      var half = document.createElement('canvas'), m = n / 2; half.width = half.height = m; var hg = half.getContext('2d'), img = hg.createImageData(m, m), d = img.data, per = 6;
      function wn(x, y, f) { var p = per * f, i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
        var i1 = (i + 1) % p, j1 = (j + 1) % p; i %= p; j %= p; var a = hash(i, j + f * 17), b = hash(i1, j + f * 17), c = hash(i, j1 + f * 17), e = hash(i1, j1 + f * 17);
        return a + (b - a) * fx + (c - a) * fy + (a - b - c + e) * fx * fy; }
      for (var y = 0; y < m; y++) for (var x = 0; x < m; x++) {
        var u = x / m * per, v = y / m * per, s = 0.42 * wn(u, v, 1) + 0.26 * wn(u * 2, v * 2, 2) + 0.16 * wn(u * 4, v * 4, 4) + 0.1 * wn(u * 8, v * 8, 8) + 0.06 * wn(u * 16, v * 16, 16);
        var c2 = 168 + s * 62, o = (y * m + x) * 4; d[o] = d[o + 1] = d[o + 2] = c2; d[o + 3] = 255;
      }
      hg.putImageData(img, 0, 0); g.imageSmoothingQuality = 'high'; g.drawImage(half, 0, 0, n, n);
      var gi = g.getImageData(0, 0, n, n), gd = gi.data; for (var q = 0; q < gd.length; q += 4) { var gr = (hash(q % 977, q / 977 | 0) - 0.5) * 26; gd[q] += gr; gd[q + 1] += gr; gd[q + 2] += gr; } g.putImageData(gi, 0, 0);   // fine dust grain
      function wrap(px, py, r, fn) { for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) { var X = px + ox * n, Y = py + oy * n; if (X > -r * 2 && X < n + r * 2 && Y > -r * 2 && Y < n + r * 2) fn(X, Y); } }
      for (var k = 0; k < (nCraters == null ? 520 : nCraters); k++) (function () {                // little craters: dark wall toward the sun, bright wall away from it
        var r = 3 + Math.pow(rand(), 2.4) * n * 0.022, px = rand() * n, py = rand() * n;
        wrap(px, py, r, function (X, Y) {
          var rg = g.createRadialGradient(X, Y, 0, X, Y, r); rg.addColorStop(0, 'rgba(60,60,64,.34)'); rg.addColorStop(0.8, 'rgba(60,60,64,.22)'); rg.addColorStop(1, 'rgba(60,60,64,0)'); g.fillStyle = rg; g.beginPath(); g.arc(X, Y, r, 0, 7); g.fill();
          g.lineWidth = Math.max(1.2, r * 0.22); g.lineCap = 'round';
          g.strokeStyle = 'rgba(20,20,24,.5)'; g.beginPath(); g.arc(X, Y, r * 0.8, 2.9, 5.0); g.stroke();
          g.strokeStyle = 'rgba(255,255,255,.62)'; g.beginPath(); g.arc(X, Y, r * 0.95, -0.25, 1.85); g.stroke();
        });
      })();
      for (k = 0; k < (nPebbles == null ? 2600 : nPebbles); k++) (function () {                    // pebbles and grit: bright top-left, small shadow bottom-right
        var r = 0.8 + Math.pow(rand(), 3) * n * 0.004, px = rand() * n, py = rand() * n;
        wrap(px, py, r, function (X, Y) {
          g.fillStyle = 'rgba(15,15,18,.55)'; g.beginPath(); g.arc(X + r * 0.7, Y + r * 0.7, r, 0, 7); g.fill();
          g.fillStyle = 'rgba(248,248,250,.85)'; g.beginPath(); g.arc(X, Y, r, 0, 7); g.fill();
        });
      })();
    });
    tex.wrapS = tex.wrapT = T.RepeatWrapping; return tex;
  };

  function lump(seg, rings, seed, squash) {                      // a rounded, irregular stone
    var geo = new T.SphereGeometry(1, seg, rings), p = geo.attributes.position, v = new T.Vector3();
    for (var i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      var r = 0.72 + 0.42 * noise(v.x * 1.6 + seed, v.y * 1.6 + v.z * 1.3 + seed) + 0.16 * noise(v.x * 4 + v.y * 3 + seed, v.z * 4 - v.y * 2);
      p.setXYZ(i, v.x * r, Math.max(v.y * r * squash, -0.35), v.z * r);
    }
    geo.computeVertexNormals(); return geo;
  }

  K.ground = function (name, parent, at, o) {
    var D = (window.SORAINE_TERRAIN || {})[name]; o = o || {};
    var W = D.w, Hh = D.h, hs = new Uint16Array(bytes(D.hgt).buffer), cs = bytes(D.col);
    var ox = at[0] - D.site[0], oy = at[1] - D.site[1], oz = at[2] - D.site[2], yr = (D.ymax - D.ymin) / 65535, farAmp = o.farAmp || 2;
    var cx = at[0], cz = at[2] - (o.curve ? 0 : 4), i, craters = [], relief = o.relief == null ? 1 : o.relief, R = o.curve || 0, PAD = 2.7, pad = o.pad || 1, spread = o.spread || 1;
    function bend(x, y, z, out, nrm) {                           // wrap the flat ground over a ball of radius R; the pad under the platform stays level
      if (!R) { out.set(x, y, z); if (nrm) nrm.set(0, 1, 0); return; }
      var dx = x - at[0], dz = z - at[2], d = Math.hypot(dx, dz) || 1e-6, th = Math.min(Math.max(0, d - PAD) / R, 2.9), rr = R + y - at[1], hd = Math.min(d, PAD) + rr * Math.sin(th);
      out.set(at[0] + dx / d * hd, at[1] - R + rr * Math.cos(th), at[2] + dz / d * hd); if (nrm) nrm.set(dx / d * Math.sin(th), Math.cos(th), dz / d * Math.sin(th));
    }

    function form(x, z) {                                       // the team's landform, easing into rolling ground past its edges
      var tx = x - ox, tz = z - oz, u = (tx - D.x0) / (D.x1 - D.x0) * (W - 1), v = (tz - D.z0) / (D.z1 - D.z0) * (Hh - 1);
      u = u < 0 ? 0 : u > W - 1.001 ? W - 1.001 : u; v = v < 0 ? 0 : v > Hh - 1.001 ? Hh - 1.001 : v;
      var iu = u | 0, iv = v | 0, fu = u - iu, fv = v - iv, k = iv * W + iu;
      var h = D.ymin + yr * ((hs[k] * (1 - fu) + hs[k + 1] * fu) * (1 - fv) + (hs[k + W] * (1 - fu) + hs[k + W + 1] * fu) * fv) + oy;
      var dx = Math.max(D.x0 - tx, 0, tx - D.x1), dz = Math.max(D.z0 - tz, 0, tz - D.z1), d = Math.sqrt(dx * dx + dz * dz);
      if (d > 0) { var f = smooth(d / 16); h = h * (1 - f) + (at[1] + farAmp * (fbm(x / 80, z / 80) * 2 + 0.4 * fbm(x / 21, z / 21))) * f; }
      h = at[1] + (h - at[1]) * relief;
      if (o.dunes || o.mesas) {
        var dd = Math.hypot(x - at[0], z - at[2]);
        if (o.dunes) {                                           // midground: rolling dune ridges and broad swells, everywhere but the patch the props stand on
          var crest = 1 - Math.abs(2 * noise(x / 15 + z / 46 + 3, z / 10 + 7) - 1);
          h += o.dunes * smooth((dd - 5) / 16) * (crest * crest * 1.2 + 2.2 * fbm(x / 48, z / 48) + 0.6);
        }
        if (o.mesas) {                                           // far background: flat-topped mesas and low mountains
          var top = smooth((noise(x / 36 + 5, z / 36 + 2) - 0.54) / 0.08), hill = Math.max(0, fbm(x / 70 + 9, z / 70) + 0.12);
          h += smooth((dd - (o.mesaFrom || 45)) / 28) * (o.mesas * top * (0.75 + 0.5 * noise(x / 95, z / 95)) + o.mesas * 1.4 * hill);
        }
      }
      return h;
    }
    function tintAt(x, z, out) {                                // the team's ground colour at this spot
      var u = Math.round((x - ox - D.x0) / (D.x1 - D.x0) * (D.cw - 1)), v = Math.round((z - oz - D.z0) / (D.z1 - D.z0) * (D.ch - 1));
      u = u < 0 ? 0 : u > D.cw - 1 ? D.cw - 1 : u; v = v < 0 ? 0 : v > D.ch - 1 ? D.ch - 1 : v; var k = (v * D.cw + u) * 3;
      out[0] = cs[k] / 255; out[1] = cs[k + 1] / 255; out[2] = cs[k + 2] / 255;
    }
    for (i = 0; i < (o.craters || 0); i++) {                    // small impact pits around the platform
      var cr = { x: at[0] + (rand() - 0.5) * 46 * spread, z: at[2] + (R ? (rand() - 0.5) * 46 * spread : 5 - rand() * 36), r: 0.4 + Math.pow(rand(), 3) * 2.4 };
      if (Math.hypot((cr.x - at[0]) / 1.5, cr.z - at[2]) > 2.6 * pad + cr.r * 1.5) craters.push(cr);
    }
    var cells = {}, CS = 4;                                      // craters filed by 4 m square, so each lookup only tests the few nearby
    craters.forEach(function (q) { for (var ix = Math.floor((q.x - q.r * 1.7) / CS); ix <= Math.floor((q.x + q.r * 1.7) / CS); ix++) for (var iz = Math.floor((q.z - q.r * 1.7) / CS); iz <= Math.floor((q.z + q.r * 1.7) / CS); iz++) (cells[ix + ',' + iz] = cells[ix + ',' + iz] || []).push(q); });
    function big(x, z) {
      var h = form(x, z), list = craters.length ? cells[Math.floor(x / CS) + ',' + Math.floor(z / CS)] : null;
      if (list) for (var c = 0; c < list.length; c++) {
        var q = list[c], d = Math.hypot(x - q.x, z - q.z) / q.r;
        if (d < 1.7) h += q.r * (d < 1 ? -0.27 * (1 - d * d) * (1 - d * d * 0.35) : 0) + q.r * 0.085 * Math.exp(-Math.pow((d - 1) / 0.26, 2));   // bowl with a soft raised rim
      }
      return h;
    }
    function height(x, z) {
      var h = big(x, z) + 0.16 * fbm(x / 3.7, z / 3.7) + 0.045 * fbm(x * 1.1, z * 1.1) + (o.ripple ? o.ripple * Math.sin((x * 0.8 + z * 0.35) * 5 + 3 * noise(x / 3, z / 3)) * smooth(noise(x / 7 + 4, z / 7)) : 0);
      var f = smooth((Math.hypot((x - at[0]) / 1.5, z - at[2]) - 2.1 * pad) / (2.4 * pad));   // level pad under the platform
      return at[1] * (1 - f) + h * f;
    }

    // the surface: a square grid stretched so it is fine near the platform and coarse far away
    var N = o.grid || 256, n1 = N + 1, pos = new Float32Array(n1 * n1 * 3), uv = new Float32Array(n1 * n1 * 2), col = new Float32Array(n1 * n1 * 3), idx = new Uint32Array(N * N * 6);
    var reach = o.reach || 260, wk = (reach - 44) ;
    function warp(t) { var t3 = t * t * t; return (reach < 100 ? 12 * t + 18 * t3 + (reach - 30) * t3 * t3 * t3 : 14 * t + 30 * t3 + wk * t3 * t3 * t3); }
    var flat = new Float32Array(n1 * n1 * 3), tmp = new T.Vector3(), tn = new T.Vector3();
    var tile = o.tile || 30, a, b, k = 0;
    for (b = 0; b < n1; b++) for (a = 0; a < n1; a++) {
      var x = cx + warp(a / N * 2 - 1), z = cz + warp(b / N * 2 - 1), p = b * n1 + a;
      var hh = height(x, z); flat[p * 3] = x; flat[p * 3 + 1] = hh; flat[p * 3 + 2] = z; bend(x, hh, z, tmp);
      pos[p * 3] = tmp.x; pos[p * 3 + 1] = tmp.y; pos[p * 3 + 2] = tmp.z; uv[p * 2] = x / tile; uv[p * 2 + 1] = z / tile;
    }
    for (b = 0; b < N; b++) for (a = 0; a < N; a++) { var p0 = b * n1 + a; idx[k++] = p0; idx[k++] = p0 + n1; idx[k++] = p0 + 1; idx[k++] = p0 + 1; idx[k++] = p0 + n1; idx[k++] = p0 + n1 + 1; }
    var geo = new T.BufferGeometry(); geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2)); geo.setIndex(new T.BufferAttribute(idx, 1)); geo.computeVertexNormals();

    // colour per point: the team's colour, a little variation, darker banded cliffs, and long baked shadows from the sun
    var S = new T.Vector3().fromArray(o.sun || [1, 1, 0]).normalize(), nor = geo.attributes.normal.array, tint = o.tint || [1, 1, 1], rgb = [0, 0, 0], shade = o.shade == null ? 0.85 : o.shade;
    var mean = [0, 0, 0]; for (i = 0; i < cs.length; i += 3) { mean[0] += cs[i]; mean[1] += cs[i + 1]; mean[2] += cs[i + 2]; } var lum = (mean[0] + mean[1] + mean[2]) / cs.length / 255;
    var steps = o.bakeSteps || 26, grow = Math.pow(60 / 0.35, 1 / (steps - 1));
    for (p = 0; p < n1 * n1; p++) {
      var px = flat[p * 3], py = flat[p * 3 + 1], pz = flat[p * 3 + 2], lit = 1, t = 0.35, y0 = big(px, pz) + 0.03, far = Math.hypot(px - cx, pz - cz);
      for (var s = 0; s < steps && lit > 0; s++, t *= grow) { var cl = (y0 + S.y * t - (far < 34 ? big(px + S.x * t, pz + S.z * t) : form(px + S.x * t, pz + S.z * t))) / t; if (cl < 0.05) lit = Math.min(lit, smooth(cl / 0.05)); }
      tintAt(px, pz, rgb);
      var vary = 0.86 + 0.28 * noise(px / 9 + 3, pz / 9) + 0.1 * (noise(px * 0.9, pz * 0.9) - 0.5), steep = !o.strata ? 0 : smooth((Math.hypot(height(px + 0.3, pz) - height(px - 0.3, pz), height(px, pz + 0.3) - height(px, pz - 0.3)) / 0.6 - 0.35) / 0.6);
      if (o.strata) vary *= 1 - steep * (0.28 + 0.14 * Math.sin(py * 11 + 2 * noise(px / 4, pz / 4)));
      var m = vary * (1 - shade + shade * lit);
      col[p * 3] = rgb[0] / lum * tint[0] * m; col[p * 3 + 1] = rgb[1] / lum * tint[1] * m; col[p * 3 + 2] = rgb[2] / lum * tint[2] * m;
    }
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    var mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: o.map || null, bumpMap: o.detail || o.map || null, bumpScale: o.bump || 0.02 });
    if (o.fine) { if (!o.map) { mat.map = o.fine; o.picMix = 0; } mat.bumpMap = o.fine; mat.bumpScale = o.fineBump || 0.008;   // the fine layer also drives the bump, at its own fine scale                                      // a second, much finer layer over the picture keeps the ground crisp up close
      mat.onBeforeCompile = function (sh) {
        sh.uniforms.fineMap = { value: o.fine }; sh.uniforms.fineRep = { value: tile / (o.fineTile || 1.6) };
        sh.uniforms.picMix = { value: o.picMix == null ? 1 : o.picMix };
        sh.fragmentShader = 'uniform sampler2D fineMap; uniform float fineRep; uniform float picMix;\n' + sh.fragmentShader
          .replace('#include <bumpmap_pars_fragment>', T.ShaderChunk.bumpmap_pars_fragment.replace(/vUv/g, 'vUv * fineRep'))
          .replace('#include <map_fragment>', [
            'float pic = texture2D(map, vUv).g;                                  // the picture: broad light and dark patches only',
            'diffuseColor.rgb *= mix(1.0, clamp(pic / 0.26, 0.35, 1.9), picMix);',
            'float fineA = texture2D(fineMap, vUv * fineRep).g;                  // close-up layer, twice, at two scales so it never visibly repeats',
            'float fineB = texture2D(fineMap, vUv * fineRep * 0.31 + 0.37).g;',
            'diffuseColor.rgb *= (0.3 + 1.0 * fineA) * (0.62 + 0.55 * fineB);'].join('\n'));
      };
    }
    var mesh = new T.Mesh(geo, mat); mesh.name = name + 'Ground'; mesh.userData.noCast = true; K.objects[mesh.name] = mesh; parent.add(mesh);

    // stones: a few boulders, many rocks, a carpet of pebbles near the platform
    var dummy = new T.Object3D(), c3 = new T.Color(), up = new T.Vector3(0, 1, 0), qr = new T.Quaternion(), er = new T.Euler(), rockMat = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, bumpMap: o.fine || o.detail || o.map || null, bumpScale: 0.02 });
    function scatter(geo2, count, place, cast) {
      var im = new T.InstancedMesh(geo2, rockMat, count), base = new T.Color(o.rockColor || 0x777777);
      for (var q = 0; q < count; q++) {
        var w = place(q); bend(w[0], height(w[0], w[1]) - w[2] * 0.22, w[1], tmp, tn); dummy.position.copy(tmp);
        dummy.quaternion.setFromUnitVectors(up, tn).multiply(qr.setFromEuler(er.set((rand() - 0.5) * 0.7, rand() * 6.28, (rand() - 0.5) * 0.7)));
        dummy.scale.set(w[2] * (0.8 + rand() * 0.5), w[2] * (0.7 + rand() * 0.5), w[2] * (0.8 + rand() * 0.5)); dummy.updateMatrix(); im.setMatrixAt(q, dummy.matrix);
        im.setColorAt(q, c3.copy(base).multiplyScalar(0.7 + rand() * 0.55));
      }
      im.userData.noCast = !cast; im.frustumCulled = false; parent.add(im); return im;
    }
    function clear(x, z, r) { return Math.hypot((x - at[0]) / 1.5, z - at[2]) > 2.3 * pad + r; }
    function spot(reach, size, near) {                          // a free place on gentle ground, clear of the platform
      for (var g = 0; g < 40; g++) {
        var ang = rand() * 6.28, d = (near || 2.4 * pad) + Math.pow(rand(), 1.7) * reach * spread, x = at[0] + Math.cos(ang) * d * 1.3, z = at[2] - (R ? 0 : 2) + Math.sin(ang) * d;
        if (clear(x, z, size) && Math.abs(height(x + size, z) - height(x - size, z)) + Math.abs(height(x, z + size) - height(x, z - size)) < size * 0.7) return [x, z, size];
      }
      return [at[0], at[2] + 60, size];
    }
    var nr = o.rocks == null ? 150 : o.rocks, np = o.pebbles == null ? 1600 : o.pebbles;
    scatter(lump(14, 10, 1.3, 0.7), Math.round(nr * 0.5), function () { return spot(26, 0.07 + rand() * rand() * 0.3); }, true);
    scatter(lump(14, 10, 5.1, 0.55), Math.round(nr * 0.4), function () { return spot(34, 0.1 + rand() * rand() * 0.45); }, true);
    scatter(lump(18, 12, 8.7, 0.8), Math.round(nr * 0.1), function () { return spot(40, 0.45 + rand() * 0.7, 7); }, true);
    scatter(lump(7, 5, 2.2, 0.6), np, function () { return spot(11, 0.012 + rand() * rand() * 0.05); }, false);

    return { height: height, mesh: mesh };
  };
})();
