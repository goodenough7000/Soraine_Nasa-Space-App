/* Tony's loose props, on his rigid-body sim (cannon-es). Ported from kitchen/props.js in
 * github.com/TonySama-BoiledCabbage/Soraine_Nasa-Space-App. His words:
 *
 *   "Loose props on a real rigid-body sim: collisions between props and with the counters, Coulomb friction
 *    (so sliding resistance scales with g), stacking, tumbling. Gravity is per body: world.gravity is zero and
 *    each body gets m·g from whichever scenario has swept it. The scan front gives every prop the SAME small kick
 *    (a disturbance, like the camera jolt). What gravity does with that kick is the feedback: a rattle on Earth,
 *    a hop on the Moon, a slow drift away in microgravity."
 *
 * Kept from Tony: the prop list with its shapes, sizes, masses and materials, the solver settings, per-body gravity,
 * the scan kick, the microgravity drift and fence, the speed limits, and dragging a prop with the pointer.
 * Changed for this site: where the props sit (on this stove and on the ground in front of it), the fixed shapes they
 * collide with (this stove, pan and gas canister), and the scan starts when the world changes here.
 * The kick (0.3 m/s up, 0.06 m/s out) is Tony's visual disturbance, the same in every world; it is not a measured value.
 *
 * Public: window.SoraineProps = { fire(gOld, gNew), reset(), bodies }
 */
(function () {
  var T = THREE, K = SoraineKit, C = window.CANNON; if (!C) return;
  var TOP = 0.943, GROUND = { earth: 0, moon: 0, mars: 0.03, orbit: 0 };
  function mat(c, o) { o = o || {}; return new T.MeshStandardMaterial({ color: c, roughness: o.roughness == null ? 0.8 : o.roughness, metalness: o.metalness || 0 }); }
  var MAT = { white: mat(0xf2efe8), steel: mat(0xb8bcc0, { roughness: 0.35, metalness: 0.8 }), dark: mat(0x2e2d2c, { roughness: 0.5 }), wood: mat(0xb98a5a), woodDark: mat(0x8e6540),
    egg: mat(0xf3e6d0, { roughness: 0.6 }), tomato: mat(0xd2432c, { roughness: 0.45 }), black: mat(0x1d1c1b, { roughness: 0.4 }) };
  // [name, shape, dims (m), material, x, z, surface y, yaw (deg), mass (kg)]: sizes and masses are Tony's; positions are for this stove
  var SPEC = [
    ['salt',      'cyl', [0.025, 0.09],        'white',    0.00, -2.22, TOP,   0, 0.12],
    ['pepper',    'cyl', [0.024, 0.15],        'dark',     0.11, -2.25, TOP,   0, 0.18],
    ['spice',     'cyl', [0.022, 0.07],        'dark',    -0.07, -1.80, TOP,   0, 0.08],
    ['spoon',     'box', [0.26, 0.016, 0.05],  'wood',     0.10, -1.88, TOP,  25, 0.05],
    ['bowl',      'cyl', [0.065, 0.05],        'white',    0.49, -2.18, TOP,   0, 0.25],
    ['board',     'box', [0.34, 0.02, 0.24],   'woodDark', 0.00, -1.33, null,  8, 0.6],
    ['egg1',      'sph', [0.027],              'egg',     -0.05, -1.36, 0.022, 0, 0.06],
    ['egg2',      'sph', [0.027],              'egg',      0.05, -1.30, 0.022, 0, 0.06],
    ['tomato',    'sph', [0.034],              'tomato',   0.32, -1.28, null,  0, 0.12],
    ['knife',     'box', [0.22, 0.016, 0.03],  'black',    0.64, -1.30, null, -20, 0.1],
    ['chopstick', 'box', [0.24, 0.016, 0.016], 'wood',     0.42, -1.14, null, 70, 0.03]
  ];
  var KICK_UP = 0.3, KICK_OUT = 0.06, VMAX = 1.6, WMAX = 12;

  K.props.push(function (E) {
    var root = new T.Group(); root.name = 'looseProps'; E.scene.add(root);
    var w = new C.World({ gravity: new C.Vec3(0, 0, 0), allowSleep: true });
    w.broadphase = new C.SAPBroadphase(w);
    w.defaultContactMaterial.friction = 0.45; w.defaultContactMaterial.restitution = 0.18;
    w.defaultContactMaterial.contactEquationStiffness = 1e7; w.defaultContactMaterial.contactEquationRelaxation = 3;
    w.solver.iterations = 12;

    // fixed shapes: this stove, its backsplash, the pan, the gas canister, the ground
    function stat(shape, x, y, z) { var b = new C.Body({ mass: 0, type: C.Body.STATIC }); b.addShape(shape); b.position.set(x, y, z); w.addBody(b); return b; }
    stat(new C.Box(new C.Vec3(0.475, TOP / 2, 0.35)), 0.3, TOP / 2, -2.02);
    stat(new C.Box(new C.Vec3(0.46, 0.1, 0.035)), 0.3, 1.0, -2.32);
    stat(new C.Cylinder(0.2, 0.2, 0.075, 16), E.burner.x, TOP + 0.0375 + 0.13, E.burner.z);   // the pan, on the hob's pan supports
    stat(new C.Cylinder(0.14, 0.14, 0.6, 16), -0.29, 0.3, -1.78);
    var ground = new C.Body({ mass: 0, type: C.Body.STATIC, shape: new C.Plane() }); ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); w.addBody(ground);

    var center = new T.Vector3(E.burner.x, E.burner.y, E.burner.z), gOld = 9.81, gNew = 9.81, R = 1e5, held = null, target = null, acc = 0, last = 0;
    var bodies = SPEC.map(function (s) {
      var name = s[0], shape = s[1], d = s[2], geo, cs = null, half, rod = null, y0 = s[6] == null ? 0 : s[6];
      if (shape === 'cyl') { geo = new T.CylinderGeometry(d[0], d[0], d[1], 24); cs = new C.Cylinder(d[0], d[0], d[1], 12); half = d[1] / 2; }
      else if (shape === 'box' && (name === 'knife' || name === 'chopstick')) { geo = new T.BoxGeometry(d[0], d[1], d[2]); half = d[1] / 2; rod = { n: 4, r: d[1] / 2, len: d[0] }; }   // thin box contact is unstable: collide as a row of spheres, draw as a box
      else if (shape === 'box') { geo = new T.BoxGeometry(d[0], d[1], d[2]); cs = new C.Box(new C.Vec3(d[0] / 2, d[1] / 2, d[2] / 2)); half = d[1] / 2; }
      else { geo = new T.SphereGeometry(d[0], 24, 16); cs = new C.Sphere(d[0]); half = d[0]; }
      var mesh = new T.Mesh(geo, MAT[s[3]]); mesh.name = name; if (name.indexOf('egg') === 0) mesh.scale.set(1, 1.25, 1);   // look like an egg, collide like a ball
      root.add(mesh);
      var body = new C.Body({ mass: s[8], linearDamping: 0.45, angularDamping: 0.5, sleepSpeedLimit: 0.02, sleepTimeLimit: 0.6 });
      if (cs) body.addShape(cs); else for (var i = 0; i < rod.n; i++) body.addShape(new C.Sphere(rod.r), new C.Vec3(-rod.len / 2 + rod.r + i * (rod.len - 2 * rod.r) / (rod.n - 1), 0, 0));
      var home = new T.Vector3(s[4], y0 + half, s[5]), yaw = s[7] * Math.PI / 180;
      w.addBody(body);
      return { name: name, mesh: mesh, body: body, home: home, yaw: yaw, swept: true, bob: Math.random() * 6.28 };
    });
    function place() { bodies.forEach(function (b) { b.body.position.set(b.home.x, b.home.y + ground.position.y * (b.home.y < 0.5 ? 1 : 0) + 0.002, b.home.z); b.body.quaternion.setFromEuler(0, b.yaw, 0); b.body.velocity.set(0, 0, 0); b.body.angularVelocity.set(0, 0, 0); b.body.wakeUp(); }); }
    function gOf(b) { return b.swept ? gNew : gOld; }
    function applyGravity() {
      bodies.forEach(function (b) {
        if (b === held) return; var g = gOf(b), body = b.body; body.force.y -= body.mass * g;
        if (g < 0.5 && body.sleepState !== C.Body.SLEEPING) {       // microgravity: faint air currents keep things alive, and a soft fence keeps them in frame
          body.force.x += Math.sin(performance.now() * 0.0007 + b.bob) * body.mass * 0.006; body.force.z += Math.cos(performance.now() * 0.0005 + b.bob) * body.mass * 0.006;
          var dx = body.position.x - b.home.x, dz = body.position.z - b.home.z, dy = body.position.y - b.home.y, side = Math.hypot(dx, dz) - 0.05;
          if (side > 0) { var k = -side * body.mass * 2.5 / Math.hypot(dx, dz); body.force.x += dx * k; body.force.z += dz * k; }
          if (dy > 0.45) body.force.y -= (dy - 0.45) * body.mass * 2.5;
        }
      });
    }
    function sync() { bodies.forEach(function (b) { b.mesh.position.copy(b.body.position); b.mesh.quaternion.copy(b.body.quaternion); }); }
    place(); for (var q = 0; q < 120; q++) { applyGravity(); w.step(1 / 120); } sync();   // settle into resting contact before the first frame

    function fire(a, b) { gOld = a; gNew = b; R = 0; bodies.forEach(function (x) { x.swept = false; }); }

    // dragging: a velocity spring toward the pointer, so the held prop still collides with everything
    var ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(), hitP = new T.Vector3(), grab = new T.Vector3(), canvas = E.renderer.domElement;
    function cast(e) { var r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, E.camera); }
    canvas.addEventListener('pointerdown', function (e) {
      if (!root.visible) return; cast(e);
      var hit = ray.intersectObjects(bodies.map(function (b) { return b.mesh; }), false)[0]; if (!hit) return;
      held = bodies.filter(function (b) { return b.mesh === hit.object; })[0]; held.body.wakeUp(); window.SoraineDrag = true;
      plane.setFromNormalAndCoplanarPoint(E.camera.getWorldDirection(new T.Vector3()).negate(), hit.point);
      grab.copy(hit.point).sub(held.mesh.position); target = hit.point.clone(); canvas.style.cursor = 'grabbing'; e.preventDefault();
    });
    window.addEventListener('pointermove', function (e) { if (!held) return; cast(e); if (ray.ray.intersectPlane(plane, hitP)) target = hitP.clone(); });
    function up() { if (!held) return; held = null; canvas.style.cursor = ''; setTimeout(function () { window.SoraineDrag = false; }, 0); }
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);

    E.onFrame(function (t, f) {
      var dt = Math.min(0.05, Math.max(0, t - last)); last = t; root.visible = !f.focus; if (f.still || f.focus) return;
      if (E.wave && E.wave.active) R = E.wave.R; else if (R < 1e4) R += dt * 40;   // the scan front spreads out from the stove flame (the same front the screen shows)
      bodies.forEach(function (b) {                               // the front reaches a prop: same kick for everyone, gravity decides the outcome
        if (b.swept) return; var p = b.body.position, d = Math.hypot(p.x - center.x, p.y - center.y, p.z - center.z); if (d > R) return;
        b.swept = true; var ox = p.x - center.x, oz = p.z - center.z, ol = Math.hypot(ox, oz) || 1, fall = 1 / (1 + d * 1.5);
        b.body.wakeUp();
        b.body.applyImpulse(new C.Vec3(ox / ol * KICK_OUT * fall * b.body.mass, KICK_UP * fall * b.body.mass, oz / ol * KICK_OUT * fall * b.body.mass), new C.Vec3((Math.random() - 0.5) * 0.01, 0.004, (Math.random() - 0.5) * 0.01).vadd(b.body.position));
      });
      if (held) { var body = held.body, v = target.clone().sub(grab).sub(new T.Vector3(body.position.x, body.position.y, body.position.z)).multiplyScalar(14); if (v.length() > 5) v.setLength(5);
        body.velocity.set(v.x, v.y, v.z); body.angularVelocity.scale(0.9, body.angularVelocity); }
      acc += dt; var n = 0;
      while (acc >= 1 / 120 && n < 8) {                           // fixed-step integration, gravity reapplied every substep
        applyGravity(); w.step(1 / 120); acc -= 1 / 120; n++;
        bodies.forEach(function (b) { var v2 = b.body.velocity, w2 = b.body.angularVelocity, vm = b === held ? 5 : VMAX; if (v2.length() > vm) v2.scale(vm / v2.length(), v2); if (w2.length() > WMAX) w2.scale(WMAX / w2.length(), w2); });
      }
      bodies.forEach(function (b) { if (b.body.position.y < -3 || Math.abs(b.body.position.x) > 12) { b.body.position.set(b.home.x, b.home.y + 0.3, b.home.z); b.body.velocity.set(0, 0, 0); } });   // anything knocked far away comes back
      sync();
    });

    var first = true;
    window.addEventListener('soraine:scene', function (ev) {
      var to = ev.detail.to, g = K.g ? K.g(to) : 9.81; ground.position.y = GROUND[to] == null ? 0 : GROUND[to];
      if (first) { first = false; gOld = gNew = g; place(); return; }
      fire(gNew, g);
    });
    window.SoraineProps = { fire: fire, reset: place, bodies: bodies };
  });
})();
