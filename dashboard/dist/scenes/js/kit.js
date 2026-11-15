/* Soraine kit: the shared toolbox. Everything a scene or prop file needs to build
 * things in the house style: bevelled boxes, tubes, the material palette, glows.
 * Scenes register themselves in SoraineKit.scenes, props in SoraineKit.props.
 * See README.md, "Adding to the project".
 */
(function () {
  var T = THREE, objects = {}, floaters = [], glowTex;
  var seed = 7; function rand() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  function canvasTex(size, paint, rx, ry) {             // small procedural textures, drawn once
    var c = document.createElement('canvas'); c.width = c.height = size; paint(c.getContext('2d'), size);
    var t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx || 1, ry || 1); t.encoding = T.sRGBEncoding; return t;
  }
  function halo(color, size, x, y, z, parent, opacity) {  // soft additive glow around a light source
    var sp = new T.Sprite(new T.SpriteMaterial({ map: glowTex, color: color, blending: T.AdditiveBlending, depthWrite: false, transparent: true, opacity: opacity || 0.8 }));
    sp.scale.set(size, size, 1); sp.position.set(x, y, z); parent.add(sp); return sp;
  }
  function std(c, rough, metal) { return new T.MeshStandardMaterial({ color: c, roughness: rough === undefined ? 0.75 : rough, metalness: metal || 0 }); }
  function glow(c) { return new T.MeshBasicMaterial({ color: c }); }
  function put(geo, material, x, y, z, parent, name) {
    var m = new T.Mesh(geo, material); m.position.set(x, y, z);
    if (name) { m.name = name; objects[name] = m; }
    parent.add(m); return m;
  }
  function roundedGeo(w, h, d, r) {                        // a box with soft bevelled edges
    r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001);
    var b = r * 0.6, s = new T.Shape(), x = -w / 2 + r, y = -h / 2 + r, W = w - 2 * r, H = h - 2 * r;
    s.absarc(x, y, r, Math.PI, Math.PI * 1.5); s.absarc(x + W, y, r, Math.PI * 1.5, Math.PI * 2);
    s.absarc(x + W, y + H, r, 0, Math.PI * 0.5); s.absarc(x, y + H, r, Math.PI * 0.5, Math.PI);
    var g = new T.ExtrudeGeometry(s, { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 4, curveSegments: 6 });
    g.center(); return g;
  }
  function rbox(w, h, d, r, material, x, y, z, parent, name) { return put(roundedGeo(w, h, d, r), material, x, y, z, parent, name); }
  function tube(r1, r2, h, material, x, y, z, parent, name) { return put(new T.CylinderGeometry(r1, r2, h, 40), material, x, y, z, parent, name); }
  function ball(r, material, x, y, z, parent) { return put(new T.SphereGeometry(r, 24, 16), material, x, y, z, parent); }
  function group(x, y, z, parent, name) { var g = new T.Group(); g.position.set(x, y, z); g.name = name; objects[name] = g; parent.add(g); return g; }
  function floater(obj, lift, spin) { obj.userData.lift = lift; obj.userData.spin = spin; floaters.push(obj); }
  function starField(parent, count, radius) {                // crisp points on a big sphere: mostly faint, a few bright, slight colour variety
    var pts = [], cols = [], big = [], rnd = function (q) { var v = Math.sin(q * 127.1) * 43758.5453; return v - Math.floor(v); };
    for (var i = 0; i < count; i++) {
      var th = rnd(i) * 6.283, ph = Math.acos(2 * rnd(i + 0.5) - 1), x = radius * Math.sin(ph) * Math.cos(th), y = radius * Math.cos(ph), z = radius * Math.sin(ph) * Math.sin(th);
      var m = Math.pow(rnd(i + 0.25), 2.6), br = 0.3 + 0.7 * m, tint = rnd(i + 0.75);
      pts.push(x, y, z); cols.push(br * (tint > 0.82 ? 1 : 0.86 + 0.14 * tint), br * 0.93, br * (tint < 0.25 ? 1 : 0.82 + 0.18 * tint));
      if (m > 0.72) big.push(x * 0.995, y * 0.995, z * 0.995);
    }
    var sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(pts, 3)); sg.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
    var st = new T.Points(sg, new T.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, vertexColors: true })); parent.add(st);
    if (big.length) { var bg = new T.BufferGeometry(); bg.setAttribute('position', new T.Float32BufferAttribute(big, 3)); st.add(new T.Points(bg, new T.PointsMaterial({ color: 0xffffff, size: 3.4, sizeAttenuation: false, transparent: true, opacity: 0.9 }))); }
    return st;
  }

  /* A small lighting environment, so metal and enamel reflect something real.
     spec: { top, bottom, sharp, lights: [{ at: [x,y,z], color, size, power }] } */
  function makeEnv(renderer, spec) {
    var es = new T.Scene(), geo = new T.SphereGeometry(50, 32, 16), cols = [], pos = geo.attributes.position;
    var top = new T.Color(spec.top), bot = new T.Color(spec.bottom), c = new T.Color();
    for (var i = 0; i < pos.count; i++) { c.copy(bot).lerp(top, Math.min(1, Math.max(0, pos.getY(i) / 50 * (spec.sharp || 4) + 0.5))); cols.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
    es.add(new T.Mesh(geo, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
    (spec.lights || []).forEach(function (l) {
      var mm = new T.MeshBasicMaterial({ color: l.color }); mm.color.multiplyScalar(l.power || 1);
      var ms = new T.Mesh(new T.SphereGeometry(l.size, 16, 12), mm); ms.position.fromArray(l.at).normalize().multiplyScalar(40); es.add(ms);
    });
    var pm = new T.PMREMGenerator(renderer), tex = pm.fromScene(es, 0.03).texture; pm.dispose(); return tex;
  }
  /* A baked contact shadow: a soft dark patch under something that stands on a surface. */
  var shadeTex;
  function contact(parent, x, y, z, sx, sz, opacity) {
    if (!shadeTex) { shadeTex = canvasTex(128, function (g, n2) { var rg = g.createRadialGradient(n2 / 2, n2 / 2, 0, n2 / 2, n2 / 2, n2 / 2); rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(0.55, 'rgba(0,0,0,.55)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0, 0, n2, n2); }); }
    var pl = new T.Mesh(new T.PlaneGeometry(sx, sz), new T.MeshBasicMaterial({ map: shadeTex, transparent: true, opacity: opacity || 0.5, depthWrite: false }));
    pl.rotation.x = -Math.PI / 2; pl.position.set(x, y, z); pl.renderOrder = 1; parent.add(pl); return pl;
  }

  // the palette: one material per surface, shared by every scene so the props always match
  var MAT = (function () {
    var cream = std(0xefe2c4, 0.5), creamDark = std(0xdccdaa, 0.55), white = std(0xf1ece0, 0.45), chrome = std(0xcfd4d8, 0.22, 0.9),
        brass = std(0xb98a3c, 0.35, 0.8), iron = std(0x17181b, 0.45, 0.35), sage = std(0x8fae86, 0.48), sageDark = std(0x7c9a74, 0.5),
        wood = std(0x9a5f33, 0.65), woodDark = std(0x6e4424, 0.7), teal = std(0x4f9c8c, 0.4), plaster = std(0xb9834d, 0.95),
        tile = std(0x0c3323, 0.16), stone = std(0xffffff, 0.85), leaf = std(0x3f8a3c, 0.6);

    glowTex = canvasTex(128, function (g, n2) { var rg = g.createRadialGradient(n2 / 2, n2 / 2, 0, n2 / 2, n2 / 2, n2 / 2); rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.25, 'rgba(255,255,255,.45)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, n2, n2); });
    plaster.map = canvasTex(256, function (g, n2) { g.fillStyle = '#fff'; g.fillRect(0, 0, n2, n2); for (var q = 0; q < 260; q++) { g.fillStyle = 'rgba(' + (rand() < 0.55 ? '70,38,10' : '255,236,205') + ',' + (0.03 + rand() * 0.06) + ')'; g.beginPath(); g.arc(rand() * n2, rand() * n2, 6 + rand() * 42, 0, 6.3); g.fill(); } }, 3, 1.5);
    var grain = canvasTex(256, function (g, n2) { g.fillStyle = '#fff'; g.fillRect(0, 0, n2, n2); for (var q = 0; q < 110; q++) { g.strokeStyle = 'rgba(60,28,8,' + (0.05 + rand() * 0.16) + ')'; g.lineWidth = 0.6 + rand() * 1.8; var y0 = rand() * n2; g.beginPath(); g.moveTo(0, y0); g.bezierCurveTo(n2 * 0.3, y0 + rand() * 8 - 4, n2 * 0.6, y0 + rand() * 8 - 4, n2, y0 + rand() * 6 - 3); g.stroke(); } }, 1.5, 3);
    wood.map = grain; woodDark.map = grain;
    stone.map = canvasTex(128, function (g, n2) { g.fillStyle = '#fff'; g.fillRect(0, 0, n2, n2); for (var q = 0; q < 500; q++) { g.fillStyle = 'rgba(' + (rand() < 0.6 ? '60,45,25' : '255,250,235') + ',' + (0.05 + rand() * 0.12) + ')'; g.fillRect(rand() * n2, rand() * n2, 1 + rand() * 3, 1 + rand() * 3); } }, 2, 2);
    tile.color.setHex(0xffffff);
    return { cream: cream, creamDark: creamDark, white: white, chrome: chrome, brass: brass, iron: iron, sage: sage, sageDark: sageDark, wood: wood, woodDark: woodDark, teal: teal, plaster: plaster, tile: tile, stone: stone, leaf: leaf };
  })();

  window.SoraineKit = {
    std: std, glow: glow, put: put, roundedGeo: roundedGeo, rbox: rbox, tube: tube, ball: ball, group: group, halo: halo,
    canvasTex: canvasTex, makeEnv: makeEnv, contact: contact, rand: rand, floater: floater, starField: starField, mat: MAT,
    objects: objects,      // every named object, by name
    floaters: floaters,    // loose props that can drift or be moved per scene
    props: [],             // functions (E) that build props shared by all scenes
    scenes: {},            // id -> scene definition
    outline: [],           // names of objects that get edge lines during the scan
    pickable: []           // names of objects that can be clicked for a close shot
  };
})();
