/* Scene "earth": the cozy retro kitchen at night. Walls, tiles, floor, counter,
 * hood, fridge, shelf, window, table, stool and the lamps. The stove and the loose
 * props come from props.js.
 */
(function () {
  var T = THREE, K = SoraineKit, std = K.std, glow = K.glow, put = K.put, roundedGeo = K.roundedGeo, rbox = K.rbox, tube = K.tube, ball = K.ball,
      group = K.group, halo = K.halo, canvasTex = K.canvasTex, rand = K.rand, floater = K.floater, objects = K.objects, m = K.mat;
  var cream = m.cream, creamDark = m.creamDark, white = m.white, chrome = m.chrome, brass = m.brass, iron = m.iron, sage = m.sage, sageDark = m.sageDark, wood = m.wood, woodDark = m.woodDark, teal = m.teal, plaster = m.plaster, tile = m.tile, stone = m.stone, leaf = m.leaf;

  K.scenes.earth = {
    background: 0x07080c,
    camera: function (aspect) {               // where the camera rests: [x, y, z] position and the point it looks at
      return aspect < 0.8 ? { pos: [0.3, 1.4, 2.2], look: [0.3, 1.0, -2.4] } : { pos: [0.6, 1.45, 2.6], look: [0.6, 0.98, -2.4] };
    },
    build: function (E, room) {
      var scene = E.scene;
      var i, j, n, M = new T.Matrix4(), Q = new T.Quaternion(), one = new T.Vector3(1, 1, 1), col = new T.Color();

    // ---- room: plaster, dark green tile dado, octagonal stone floor ----
    put(new T.PlaneGeometry(9.4, 3.3), plaster, 0.4, 1.65, -2.4, room, 'wallBack');
    var wl = put(new T.PlaneGeometry(7, 3.3), plaster, -3.9, 1.65, 0.6, room, 'wallLeft'); wl.rotation.y = Math.PI / 2;
    var wr = put(new T.PlaneGeometry(7, 3.3), plaster, 4.7, 1.65, 0.6, room, 'wallRight'); wr.rotation.y = -Math.PI / 2;
    var ce = put(new T.PlaneGeometry(9.4, 7), std(0x8a5f38, 1), 0.4, 3.3, 0.6, room); ce.rotation.x = Math.PI / 2;
    var gr = put(new T.PlaneGeometry(9.4, 7), std(0x2a241d, 1), 0.4, 0, 0.6, room); gr.rotation.x = -Math.PI / 2;
    rbox(9.4, 0.14, 0.14, 0.03, woodDark, 0.4, 3.2, -2.33, room);                                        // ceiling beam

    var tiles = new T.InstancedMesh(roundedGeo(0.29, 0.29, 0.04, 0.02), tile, 4 * 31); tiles.name = 'tiles'; room.add(tiles); n = 0;
    for (j = 0; j < 4; j++) for (i = 0; i < 31; i++) { M.compose(new T.Vector3(-4.1 + i * 0.3, 0.16 + j * 0.3, -2.385), Q, one); tiles.setMatrixAt(n, M); tiles.setColorAt(n++, col.setHex([0x0c3323, 0x0e3a28, 0x0a2c1f, 0x10402c][(i * 5 + j * 3 + ((i * j) % 3)) % 4])); }
    rbox(9.4, 0.06, 0.07, 0.02, std(0x0a2a1c, 0.2), 0.4, 1.31, -2.365, room);

    var og = new T.CylinderGeometry(0.4, 0.4, 0.05, 8); og.rotateY(Math.PI / 8);
    var floor = new T.InstancedMesh(og, stone, 12 * 8); floor.name = 'floor'; room.add(floor); n = 0;
    var tones = [0xc9a777, 0xb89462, 0xd2b184, 0xab8a5c, 0xc19d6c];
    for (i = 0; i < 12; i++) for (j = 0; j < 8; j++) { M.compose(new T.Vector3(-3.8 + i * 0.76, 0, -2.05 + j * 0.76), Q, one); floor.setMatrixAt(n, M); floor.setColorAt(n++, col.setHex(tones[(i * 3 + j * 7) % 5])); }

    // ---- left: sage counter with a crock of spoons ----
    var counter = group(-1.2, 0, -2.03, room, 'counter');
    rbox(1.5, 0.82, 0.66, 0.04, sage, 0, 0.41, 0, counter); rbox(1.58, 0.07, 0.72, 0.025, wood, 0, 0.87, 0, counter);
    [-0.37, 0.37].forEach(function (x) {
      rbox(0.68, 0.2, 0.03, 0.02, sageDark, x, 0.66, 0.335, counter); rbox(0.68, 0.42, 0.03, 0.02, sageDark, x, 0.3, 0.335, counter);
      rbox(0.14, 0.04, 0.04, 0.018, brass, x, 0.66, 0.365, counter); rbox(0.04, 0.12, 0.04, 0.018, brass, x * 0.25, 0.36, 0.365, counter);
    });
    tube(0.085, 0.075, 0.2, cream, -0.5, 1.01, -0.1, counter, 'crock');
    [-0.04, 0.0, 0.045].forEach(function (x, q) { var sp = rbox(0.022, 0.3, 0.014, 0.006, wood, -0.5 + x, 1.2, -0.1, counter); sp.rotation.z = (q - 1) * 0.16; var hd = put(new T.SphereGeometry(0.035, 16, 12), wood, -0.5 + x + (q - 1) * 0.03, 1.36, -0.1, counter); hd.scale.set(1, 1.35, 0.35); });


    var hood = group(0.3, 0, -2.1, room, 'hood');
    var canopy = put(new T.CylinderGeometry(0.36, 0.72, 0.42, 4, 1), white, 0, 2.02, 0.02, hood); canopy.rotation.y = Math.PI / 4; canopy.scale.set(1, 1, 0.62);
    rbox(1.04, 0.1, 0.62, 0.03, white, 0, 1.79, 0.02, hood); rbox(0.36, 1.0, 0.26, 0.03, white, 0, 2.7, -0.12, hood);
    rbox(0.6, 0.012, 0.3, 0.004, glow(0xffe9b0), 0, 1.737, 0.06, hood);
    var hoodLight = new T.SpotLight(0xffc27a, 2.6, 3.4, 0.8, 0.6, 1.1); hoodLight.position.set(0, 1.72, 0.1); hoodLight.target.position.set(0, 0, 0.25); hood.add(hoodLight); hood.add(hoodLight.target);
    halo(0xffc070, 1.1, 0, 1.66, 0.12, hood, 0.55);

    // ---- right of the stove: sage fridge with a trailing plant ----
    var fridge = group(1.32, 0, -2.02, room, 'fridge');
    rbox(0.86, 1.92, 0.72, 0.11, sage, 0, 0.97, 0, fridge);
    rbox(0.82, 0.014, 0.02, 0.005, std(0x5f7a58, 0.6), 0, 1.26, 0.362, fridge);
    [1.36, 1.14].forEach(function (y) { var h = tube(0.02, 0.02, 0.24, chrome, -0.2, y, 0.4, fridge); h.rotation.z = Math.PI / 2; });
    rbox(0.16, 0.035, 0.012, 0.006, chrome, 0.22, 1.72, 0.365, fridge);
    tube(0.17, 0.14, 0.15, std(0xa9793f, 0.8), 0.22, 2.0, -0.05, fridge, 'basket'); put(new T.TorusGeometry(0.17, 0.014, 8, 32), std(0x8b6230, 0.8), 0.22, 2.075, -0.05, fridge).rotation.x = Math.PI / 2;
    var plant = group(-0.12, 1.93, -0.05, fridge, 'plant');
    tube(0.13, 0.1, 0.17, woodDark, 0, 0.085, 0, plant);
    [[0, 0.3, 0], [0.12, 0.26, 0.05], [-0.12, 0.27, 0.04], [0.05, 0.36, -0.04], [-0.2, 0.16, 0.12], [-0.27, 0.0, 0.2], [-0.3, -0.18, 0.26], [-0.26, -0.36, 0.3], [-0.31, -0.54, 0.32], [-0.2, -0.1, 0.3], [0.18, 0.14, 0.14]].forEach(function (p, q) {
      var lf = ball(0.085, leaf, p[0], p[1], p[2], plant); lf.scale.set(1, 0.45, 0.8); lf.rotation.z = q * 0.7; lf.rotation.x = q * 0.4;
    });

    // ---- shelf with jars and books, towel on a ring ----
    var shelf = group(2.3, 1.98, -2.24, room, 'shelf');
    rbox(0.95, 0.05, 0.3, 0.02, wood, 0, 0, 0, shelf);
    [-0.36, 0.36].forEach(function (x) { rbox(0.04, 0.16, 0.22, 0.012, woodDark, x, -0.1, -0.02, shelf); });
    [[-0.3, 0.09], [-0.1, 0.07]].forEach(function (p) { tube(p[1], p[1], 0.16, cream, p[0], 0.105, 0, shelf); tube(p[1] * 1.05, p[1] * 1.05, 0.03, sageDark, p[0], 0.2, 0, shelf); ball(0.018, sageDark, p[0], 0.225, 0, shelf); });
    [[0.12, 0x2f5d50], [0.2, 0x9b4a2c], [0.28, 0x3b4a6b], [0.355, 0xc59a4a]].forEach(function (b, q) { rbox(0.06, 0.24 - q * 0.015, 0.18, 0.008, std(b[1], 0.7), b[0], 0.145 - q * 0.007, 0, shelf); });
    put(new T.TorusGeometry(0.06, 0.008, 10, 28), chrome, 2.0, 1.22, -2.35, room);
    rbox(0.2, 0.4, 0.03, 0.012, std(0xefe6d2, 0.9), 2.0, 1.0, -2.34, room, 'towel'); rbox(0.2, 0.035, 0.034, 0.01, std(0x4d7c5a, 0.9), 2.0, 0.87, -2.34, room);

    // ---- window on the night, table with flowers and fruit, stool, pendant lamp ----
    rbox(1.5, 1.5, 0.12, 0.03, woodDark, 3.15, 1.85, -2.37, room, 'windowFrame');
    put(new T.PlaneGeometry(1.3, 1.3), glow(0x101d55), 3.15, 1.85, -2.305, room, 'window');
    [[2.75, 2.3], [3.0, 2.05], [3.35, 2.35], [3.6, 2.15], [3.5, 1.8], [2.7, 1.9], [3.1, 2.4], [2.9, 1.7]].forEach(function (p, q) { put(new T.CircleGeometry(q % 3 ? 0.01 : 0.016, 8), glow(0xfff6d8), p[0], p[1], -2.3, room); });
    [[2.75, 0.3, 0.5], [3.05, 0.36, 0.62], [3.45, 0.32, 0.55], [3.7, 0.26, 0.42]].forEach(function (p) { put(new T.CircleGeometry(p[1], 20), glow(0x091238), p[0], 1.2 + p[2], -2.298, room); });
    put(new T.PlaneGeometry(1.3, 0.22), glow(0x091238), 3.15, 1.31, -2.297, room);
    rbox(0.06, 1.3, 0.06, 0.015, woodDark, 3.15, 1.85, -2.29, room); rbox(1.3, 0.06, 0.06, 0.015, woodDark, 3.15, 1.85, -2.29, room);
    rbox(1.62, 0.07, 0.2, 0.02, woodDark, 3.15, 1.08, -2.3, room);

    var table = group(3.1, 0, -1.55, room, 'table');
    rbox(1.3, 0.06, 0.8, 0.03, teal, 0, 0.78, 0, table); rbox(1.2, 0.09, 0.7, 0.02, wood, 0, 0.71, 0, table);
    [[-0.54, -0.3], [0.54, -0.3], [-0.54, 0.3], [0.54, 0.3]].forEach(function (p) { tube(0.04, 0.03, 0.7, wood, p[0], 0.35, p[1], table); });
    var jug = group(-0.22, 0.81, -0.08, table, 'flowers');
    tube(0.06, 0.075, 0.17, white, 0, 0.085, 0, jug); put(new T.TorusGeometry(0.04, 0.011, 8, 18), white, 0.085, 0.09, 0, jug);
    [[0, 0.36, 0], [0.07, 0.31, 0.03], [-0.07, 0.32, -0.02], [0.03, 0.29, -0.06], [-0.03, 0.3, 0.06], [0.1, 0.26, -0.03], [-0.1, 0.25, 0.03]].forEach(function (p) {
      tube(0.006, 0.006, p[1] - 0.14, leaf, p[0] * 0.5, 0.14 + (p[1] - 0.14) / 2, p[2] * 0.5, jug); ball(0.032, white, p[0], p[1], p[2], jug); ball(0.012, std(0xe7b33a, 0.5), p[0], p[1] + 0.022, p[2], jug);
    });
    var bowl = group(0.3, 0.81, 0.0, table, 'fruit');
    tube(0.15, 0.08, 0.08, white, 0, 0.04, 0, bowl);
    [[-0.05, 0.1, 0.02], [0.06, 0.1, -0.02], [0.0, 0.11, 0.07]].forEach(function (p) { ball(0.055, std(0xc23b2e, 0.35), p[0], p[1], p[2], bowl); });

    var stool = group(2.45, 0, -0.85, scene, 'stool');
    tube(0.2, 0.2, 0.06, wood, 0, 0.5, 0, stool); tube(0.19, 0.19, 0.02, std(0xb9773f, 0.6), 0, 0.535, 0, stool);
    [0.785, 2.356, 3.927, 5.498].forEach(function (a) { var leg = tube(0.027, 0.022, 0.5, wood, Math.cos(a) * 0.15, 0.24, Math.sin(a) * 0.15, stool); leg.rotation.z = -Math.cos(a) * 0.14; leg.rotation.x = Math.sin(a) * 0.14; });
    put(new T.TorusGeometry(0.17, 0.012, 8, 32), wood, 0, 0.18, 0, stool).rotation.x = Math.PI / 2;
    floater(stool, new T.Vector3(-0.3, 0.55, 0.3), new T.Vector3(0.05, 0.08, 0.1));

    var pendant = group(3.0, 0, -1.5, room, 'pendant');
    tube(0.008, 0.008, 0.6, iron, 0, 3.0, 0, pendant); tube(0.05, 0.07, 0.06, brass, 0, 2.7, 0, pendant);
    put(new T.SphereGeometry(0.3, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: 0xf6e7c2, roughness: 0.5, side: T.DoubleSide, emissive: 0xc98a3a, emissiveIntensity: 0.9 }), 0, 2.4, 0, pendant, 'lampShade');
    ball(0.07, glow(0xffe6b0), 0, 2.43, 0, pendant);
    var lamp = new T.PointLight(0xffac55, 2.4, 12, 1.4); lamp.position.set(0, 2.3, 0); lamp.castShadow = true;
    lamp.shadow.mapSize.set(1024, 1024); lamp.shadow.bias = -0.002; lamp.shadow.radius = 6; pendant.add(lamp);
    halo(0xffb060, 2.2, 0, 2.36, 0, pendant, 0.7); halo(0xffd9a0, 0.7, 0, 2.4, 0, pendant, 0.9);


    // night outside, amber inside
    var nightLight = new T.DirectionalLight(0x6f86d0, 0.12); nightLight.position.set(3, 2.4, -6); room.add(nightLight);
    var fill = new T.PointLight(0xff9d4a, 0.8, 8, 1.5); fill.position.set(-1.6, 2.4, 0.4); room.add(fill);

      // what the enamel and chrome reflect: a dim warm room with two lamps
      this.envMap = K.makeEnv(E.renderer, { top: 0x120b05, bottom: 0x0b0704, sharp: 2, lights: [{ at: [2.4, 2.2, -1.2], color: 0xffb060, size: 6, power: 1.6 }, { at: [-0.3, 2, -2], color: 0xffc27a, size: 4, power: 1.1 }, { at: [3, 1.2, -4], color: 0x1f3fa8, size: 5, power: 0.5 }] });
      // baked contact shadows: soft dark patches where furniture meets the floor
      K.contact(room, 0.3, 0.03, -1.95, 1.5, 1.2, 0.6); K.contact(room, 1.32, 0.03, -1.95, 1.4, 1.2, 0.6); K.contact(room, -1.2, 0.03, -1.95, 2.1, 1.2, 0.55);
      K.contact(room, 3.1, 0.03, -1.55, 1.9, 1.3, 0.4); K.contact(room, 2.45, 0.03, -0.85, 0.7, 0.7, 0.45); K.contact(room, -0.29, 0.03, -1.78, 0.6, 0.6, 0.5);

      ['wallBack', 'wallLeft', 'wallRight', 'lampShade'].forEach(function (nm) { objects[nm].userData.noCast = true; });
      ['stool', 'fridge', 'counter', 'table', 'hood', 'shelf'].forEach(function (nm) { K.outline.push(nm); });
    }
  };
})();
