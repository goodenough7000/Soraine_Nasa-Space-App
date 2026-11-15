/* The outpost: everything the Moon and Mars scenes share. One place to change the
 * platform, the plant or the falling debris for both worlds.
 *
 *   K.outpost(group, opts)        the metal work-platform, potted plant, loose utensils, droplets,
 *                                 crumbs and dust. opts: { gravity (m/s2), rock (material), dust (hex), dome, platform: false to leave it out }
 *                                 Returns { update(t, still) }: call it every frame.
 */
(function () {
  var T = THREE, K = SoraineKit, std = K.std, glow = K.glow, put = K.put, roundedGeo = K.roundedGeo, rbox = K.rbox, tube = K.tube, ball = K.ball,
      group = K.group, halo = K.halo, canvasTex = K.canvasTex, rand = K.rand, floater = K.floater, objects = K.objects, m = K.mat;
  var cream = m.cream, creamDark = m.creamDark, white = m.white, chrome = m.chrome, brass = m.brass, iron = m.iron, sage = m.sage, sageDark = m.sageDark, wood = m.wood, woodDark = m.woodDark, teal = m.teal, plaster = m.plaster, tile = m.tile, stone = m.stone, leaf = m.leaf;

  K.outpost = function (moon, opts) {
    opts = opts || {};
    var i, tossed = [], dust, grav = opts.gravity || 1.62, soil = opts.rock || std(0x55555a, 1);

    // metallic modular work-platform: two modules, yellow edge markers, chunky feet
      var metal = std(0xb4bac3, 0.36, 0.8), metalDark = std(0x7a7f88, 0.45, 0.75), marker = std(0xf2b21d, 0.45, 0.2);
      var deck = group(0.8, 0, -1.65, moon, 'platform');
      [-0.8, 0.8].forEach(function (x) {
        rbox(1.58, 0.14, 2.0, 0.035, metal, x, -0.072, 0, deck);
        rbox(1.4, 0.006, 1.82, 0.003, std(0xc3c9d1, 0.28, 0.85), x, 0.001, 0, deck);
        rbox(0.5, 0.04, 0.012, 0.005, marker, x, -0.07, 1.003, deck); rbox(0.5, 0.04, 0.012, 0.005, marker, x, -0.07, -1.003, deck);
        [[-0.7, -0.92], [0.7, -0.92], [-0.7, 0.92], [0.7, 0.92]].forEach(function (b) { tube(0.022, 0.022, 0.012, metalDark, x + b[0], 0.004, b[1], deck); });
      });
      [-0.55, 0.55].forEach(function (z) { rbox(0.012, 0.04, 0.4, 0.005, marker, 1.6, -0.07, z, deck); rbox(0.012, 0.04, 0.4, 0.005, marker, -1.6, -0.07, z, deck); });
      [[-1.5, -0.9], [1.5, -0.9], [-1.5, 0.9], [1.5, 0.9], [0, -0.9], [0, 0.9]].forEach(function (p2) {
        rbox(0.2, 0.26, 0.2, 0.03, metalDark, p2[0], -0.27, p2[1], deck); rbox(0.3, 0.05, 0.3, 0.02, metalDark, p2[0], -0.415, p2[1], deck);
      });

      if (opts.platform === false) deck.visible = false;        // no platform: everything stands straight on the ground

    // Optional clear pressurised dome over the platform (a flame needs air around it, and the Moon has none).
    // Off unless the scene asks for it: K.outpost(g, { dome: true }).
    var dome = put(new T.SphereGeometry(3.2, 56, 24, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.05, roughness: 0.05, side: T.DoubleSide, depthWrite: false }), 0.8, -0.14, -1.65, moon);
    dome.visible = !!opts.dome; dome.userData.noCast = dome.userData.noReceive = true;

    // potted plant with clean, separate leaves
      var mplant = group(1.75, 0, -1.3, moon, 'moonPlant');
      var terra = std(0xc26a3c, 0.75);
      tube(0.15, 0.1, 0.2, terra, 0, 0.1, 0, mplant); tube(0.165, 0.165, 0.035, terra, 0, 0.2, 0, mplant); tube(0.17, 0.19, 0.02, terra, 0, 0.01, 0, mplant);
      tube(0.135, 0.135, 0.012, std(0x3b2a1c, 1), 0, 0.212, 0, mplant);
      var leafHi = std(0x58b64a, 0.5);
      for (i = 0; i < 8; i++) {                               // eight leaves, evenly spaced, in two tiers so none overlap
        var la = i * 0.7854 + 0.3, lh = i % 2 ? 0.44 : 0.3, lr = i % 2 ? 0.1 : 0.175;
        var st2 = tube(0.006, 0.008, lh, leaf, Math.cos(la) * 0.03, 0.21 + lh / 2, Math.sin(la) * 0.03, mplant); st2.rotation.z = -Math.cos(la) * 0.22; st2.rotation.x = Math.sin(la) * 0.22;
        var lf2 = ball(0.085, i % 2 ? leaf : leafHi, Math.cos(la) * lr, 0.2 + lh, Math.sin(la) * lr, mplant); lf2.scale.set(1.25, 0.14, 0.72); lf2.rotation.y = -la; lf2.rotation.z = 0.45;
      }

    // loose utensils, water droplets and crumbs: tossed up, they come back down slowly (the scene's own gravity)
    function toss(obj, x, y, z, vx, vy, vz, rest, spin) { obj.position.set(x, y, z); moon.add(obj); tossed.push({ o: obj, p: new T.Vector3(x, y, z), v: new T.Vector3(vx, vy, vz), T: 2 * vy / grav, rest: rest, ph: rand() * 6, spin: spin || 0 }); }
    function spoon(c) { var g3 = new T.Group(); rbox(0.02, 0.24, 0.012, 0.005, c, 0, 0, 0, g3); var bw = ball(0.035, c, 0, 0.15, 0, g3); bw.scale.set(1, 1.3, 0.35); return g3; }
      var paleWood = std(0xd9a55f, 0.6);
      // (the spoons and spatula that kept hopping here were removed after Tony's review: they pulled the eye away from the fire)
    var water = new T.MeshStandardMaterial({ color: 0xbfe3ff, roughness: 0.05, transparent: true, opacity: 0.8 });
    for (i = 0; i < 16; i++) toss(new T.Mesh(new T.SphereGeometry(0.014 + rand() * 0.016, 14, 10), water), -0.5 + rand() * 2.6, 0.03, -2.4 + rand() * 1.5, (rand() - 0.5) * 0.08, 0.7 + rand() * 0.9, (rand() - 0.5) * 0.08, 0.3 + rand() * 1.5);
    var crumb = std(0xc99a5b, 0.9);
    for (i = 0; i < 26; i++) toss(new T.Mesh(new T.DodecahedronGeometry(0.008 + rand() * 0.012, 0), i % 3 ? crumb : soil), -0.4 + rand() * 2.4, 0.02, -2.3 + rand() * 1.4, (rand() - 0.5) * 0.06, 0.5 + rand() * 0.8, (rand() - 0.5) * 0.06, 0.4 + rand() * 2, 2);
    var dp = []; for (i = 0; i < 320; i++) dp.push(0.8 + (rand() - 0.5) * 5, rand() * 2.2, -1.65 + (rand() - 0.5) * 4);
    var dg = new T.BufferGeometry(); dg.setAttribute('position', new T.Float32BufferAttribute(dp, 3));
    dust = new T.Points(dg, new T.PointsMaterial({ color: opts.dust || 0xd9d4c8, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.55 })); moon.add(dust);


    // baked contact shadows where things meet the platform and the ground
    if (opts.platform !== false) K.contact(moon, 0.8, -0.4, -1.65, 5.4, 3.6, 0.55);
    K.contact(moon, 0.3, 0.004, -2.02, 1.35, 1.05, 0.55);
    K.contact(moon, -0.29, 0.004, -1.78, 0.5, 0.5, 0.5); K.contact(moon, 1.75, 0.004, -1.3, 0.55, 0.55, 0.5);

    return {
      update: function (t, still) {
        for (var ti = 0; ti < tossed.length; ti++) {             // up, then back down: y = v t - g t^2 / 2 with this world's g
          var ts = tossed[ti], tau = still ? 0.35 * ts.T : (t + ts.ph) % (ts.T + ts.rest), fl = Math.min(tau, ts.T);
          ts.o.position.set(ts.p.x + ts.v.x * fl, ts.p.y + ts.v.y * fl - 0.5 * grav * fl * fl, ts.p.z + ts.v.z * fl);
          if (ts.spin) ts.o.rotation.set(fl * ts.spin, fl * ts.spin * 0.6, 1.2);
        }
        dust.rotation.y = still ? 0 : t * 0.01; dust.position.y = still ? 0 : Math.sin(t * 0.15) * 0.05;
      }
    };
  };
})();
