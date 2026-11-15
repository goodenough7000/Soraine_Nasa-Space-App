// Loose props on a real rigid-body sim (cannon-es): collisions between props and with the counters,
// Coulomb friction (so sliding resistance scales with g), stacking, tumbling.
//
// Gravity is per body: world.gravity is zero and each body gets m·g from whichever scenario has swept it.
// The scan front gives every prop the SAME small kick (a disturbance, like the camera jolt). What gravity does
// with that kick is the feedback: a rattle on Earth, a hop on the Moon, a slow drift away in microgravity.
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const TOP_HOB = 0.94, TOP_WOOD = 0.96;
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
const MAT = {
  white: mat(0xf2efe8), steel: mat(0xb8bcc0, { roughness: 0.35, metalness: 0.8 }), dark: mat(0x2e2d2c, { roughness: 0.5 }),
  wood: mat(0xb98a5a), woodDark: mat(0x8e6540), egg: mat(0xf3e6d0, { roughness: 0.6 }), tomato: mat(0xd2432c, { roughness: 0.45 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x9ec9a2, roughness: 0.15, transmission: 0.6, thickness: 0.4, transparent: true }),
  mug: mat(0x5b7fa3, { roughness: 0.5 }), black: mat(0x1d1c1b, { roughness: 0.4 })
};

// Every spot below projects inside the cook camera's frame and clear of the UI (checked with the camera rig).
// [name, shape, dims, material, x, z, surfaceY, yawDeg, mass kg]
const SPEC = [
  ['salt',      'cyl', [0.025, 0.09],         'white',   0.42,  0.25, TOP_HOB,  0, 0.12],
  ['pepper',    'cyl', [0.024, 0.15],         'dark',    0.52,  0.22, TOP_HOB,  0, 0.18],
  ['oil',       'cyl', [0.035, 0.22],         'glass',   0.45, -0.30, TOP_HOB,  0, 0.55],
  ['spoon',     'box', [0.26, 0.016, 0.05],   'wood',   -0.38,  0.20, TOP_HOB, 25, 0.05],
  ['bowl',      'cyl', [0.065, 0.05],         'white',  -0.42, -0.22, TOP_HOB,  0, 0.25],
  ['spice',     'cyl', [0.022, 0.07],         'dark',   -0.24, -0.29, TOP_HOB,  0, 0.08],
  ['board',     'box', [0.34, 0.02, 0.24],    'woodDark', 0.95, -0.05, TOP_WOOD, 8, 0.6],
  ['egg1',      'sph', [0.027],               'egg',     0.90, -0.08, TOP_WOOD + 0.02, 0, 0.06],
  ['egg2',      'sph', [0.027],               'egg',     0.99, -0.01, TOP_WOOD + 0.02, 0, 0.06],
  ['mug',       'cyl', [0.045, 0.095],        'mug',     0.80, -0.32, TOP_WOOD, 0, 0.3],
  ['tomato',    'sph', [0.034],               'tomato',  1.15, -0.28, TOP_WOOD, 0, 0.12],
  ['knife',     'box', [0.22, 0.016, 0.03],   'black',   1.27,  0.02, TOP_WOOD, -20, 0.1],
  ['chopstick', 'box', [0.24, 0.016, 0.016],  'wood',    1.32, -0.22, TOP_WOOD, 70, 0.03],
];

const KICK_UP = 0.3, KICK_OUT = 0.06;
const VMAX = 1.6, WMAX = 12;          // solver safety: thin boxes can otherwise get launched out of a contact   // m/s, same for every scenario (visual disturbance, not a measured value)

export class Props {
  constructor(scene, camera, canvas, flamePos) {
    this.cam = camera; this.canvas = canvas; this.center = flamePos.clone();
    this.gOld = 9.81; this.gNew = 9.81; this.R = 1e5;
    const w = this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, 0, 0), allowSleep: true });
    w.broadphase = new CANNON.SAPBroadphase(w);
    w.defaultContactMaterial.friction = 0.45; w.defaultContactMaterial.restitution = 0.18;
    w.defaultContactMaterial.contactEquationStiffness = 1e7; w.defaultContactMaterial.contactEquationRelaxation = 3;
    w.solver.iterations = 12;

    // static colliders: the three counters, the pan + trivet stack, the ground
    const stat = (shape, x, y, z) => { const b = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC }); b.addShape(shape); b.position.set(x, y, z); w.addBody(b); };
    stat(new CANNON.Box(new CANNON.Vec3(0.6, TOP_HOB / 2, 0.45)), 0, TOP_HOB / 2, 0);
    stat(new CANNON.Box(new CANNON.Vec3(0.975, TOP_WOOD / 2, 0.475)), 1.6, TOP_WOOD / 2, 0);
    stat(new CANNON.Box(new CANNON.Vec3(0.475, TOP_WOOD / 2, 0.725)), -1.1, TOP_WOOD / 2, 1.1);
    stat(new CANNON.Cylinder(0.17, 0.17, 0.135, 16), 0.05, TOP_HOB + 0.0675, 0.08);
    stat(new CANNON.Box(new CANNON.Vec3(0.15, 0.015, 0.015)), 0.36, 1.08, 0.08);
    const ground = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
    ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0); w.addBody(ground);

    this.bodies = SPEC.map(([name, shape, dims, m, x, z, y0, yaw, mass]) => {
      let geo, cs, half;
      if (shape === 'cyl') { const [r, h] = dims; geo = new THREE.CylinderGeometry(r, r, h, 20); cs = new CANNON.Cylinder(r, r, h, 12); half = h / 2; }
      else if (shape === 'box' && (name === 'knife' || name === 'chopstick')) {
        // thin box-vs-box contact is unstable in cannon-es; collide as a row of spheres instead, draw as a box
        const [sx, sy, sz] = dims; geo = new THREE.BoxGeometry(sx, sy, sz); half = sy / 2; cs = null;
        var rod = { n: 4, r: sy / 2, len: sx };
      }
      else if (shape === 'box') { const [sx, sy, sz] = dims; geo = new THREE.BoxGeometry(sx, sy, sz); cs = new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)); half = sy / 2; }
      else { const [r] = dims; geo = new THREE.SphereGeometry(r, 20, 14); cs = new CANNON.Sphere(r); half = r; }
      const mesh = new THREE.Mesh(geo, MAT[m]); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = name;
      if (name.startsWith('egg')) mesh.scale.set(1, 1.25, 1);   // look like an egg, collide like a ball
      scene.add(mesh);
      const body = new CANNON.Body({ mass, linearDamping: 0.45, angularDamping: 0.5, sleepSpeedLimit: 0.02, sleepTimeLimit: 0.6 });
      if (cs) body.addShape(cs);
      else for (let i = 0; i < rod.n; i++) body.addShape(new CANNON.Sphere(rod.r), new CANNON.Vec3(-rod.len / 2 + rod.r + i * (rod.len - 2 * rod.r) / (rod.n - 1), 0, 0));
      rod = undefined;
      body.position.set(x, y0 + half + 0.002, z);
      body.quaternion.setFromEuler(0, THREE.MathUtils.degToRad(yaw), 0);
      w.addBody(body);
      const rec = { name, mesh, body, home: new THREE.Vector3(x, y0 + half, z), swept: true, bob: Math.random() * 6.28 };
      body.addEventListener('collide', () => {});   // keeps contact events cheap but available for sound later
      return rec;
    });

    // pointer drag: a velocity spring toward the pointer, so the held prop still collides with everything
    this.ray = new THREE.Raycaster(); this.ndc = new THREE.Vector2(); this.plane = new THREE.Plane(); this.hit = new THREE.Vector3();
    this.held = null; this.grab = new THREE.Vector3();
    canvas.addEventListener('pointerdown', e => this.down(e));
    addEventListener('pointermove', e => this.move(e));
    addEventListener('pointerup', () => this.up()); addEventListener('pointercancel', () => this.up());
    this.warm(1.0);   // settle into resting contact before the first frame
  }

  warm(seconds) { for (let i = 0; i < seconds * 120; i++) { this.applyGravity(); this.world.step(1 / 120); } }

  setGravity(gOld, gNew, R) { this.gOld = gOld; this.gNew = gNew; this.R = R < 0 ? 1e5 : R; for (const b of this.bodies) { b.swept = true; b.body.wakeUp(); } }
  fire(gOld, gNew) { this.gOld = gOld; this.gNew = gNew; this.R = 0; for (const b of this.bodies) b.swept = false; }

  gOf(b) { return b.swept ? this.gNew : this.gOld; }
  applyGravity() {
    for (const b of this.bodies) {
      if (b === this.held) continue;
      const g = this.gOf(b), body = b.body;
      body.force.y -= body.mass * g;
      if (g < 0.5 && body.sleepState !== CANNON.Body.SLEEPING) {
        // microgravity: faint cabin air currents keep things alive, and a soft fence keeps them in frame
        body.force.x += Math.sin(performance.now() * 0.0007 + b.bob) * body.mass * 0.006;
        body.force.z += Math.cos(performance.now() * 0.0005 + b.bob) * body.mass * 0.006;
        // fence: tight sideways (stay over the counter they came from), loose upward (free to float up)
        const dx = body.position.x - b.home.x, dz = body.position.z - b.home.z, dy = body.position.y - b.home.y;
        const side = Math.hypot(dx, dz) - 0.05;
        if (side > 0) { const k = -side * body.mass * 2.5 / Math.hypot(dx, dz); body.force.x += dx * k; body.force.z += dz * k; }
        if (dy > 0.45) body.force.y -= (dy - 0.45) * body.mass * 2.5;
      }
    }
  }

  cast(e) {
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.cam);
  }
  down(e) {
    this.cast(e);
    const hit = this.ray.intersectObjects(this.bodies.map(b => b.mesh), false)[0];
    if (!hit) return;
    const b = this.bodies.find(x => x.mesh === hit.object);
    this.held = b; b.body.wakeUp();
    this.plane.setFromNormalAndCoplanarPoint(this.cam.getWorldDirection(new THREE.Vector3()).negate(), hit.point);
    this.grab.copy(hit.point).sub(b.mesh.position);              // keep the grab offset
    this.target = hit.point.clone();
    this.canvas.style.cursor = 'grabbing'; e.preventDefault();
  }
  move(e) {
    if (!this.held) return;
    this.cast(e);
    if (this.ray.ray.intersectPlane(this.plane, this.hit)) this.target = this.hit.clone();
  }
  up() { if (!this.held) return; this.held = null; this.canvas.style.cursor = ''; }

  update(dt, time) {
    // scan front reaches a prop: same kick for everyone, gravity decides the outcome
    for (const b of this.bodies) {
      if (b.swept) continue;
      const p = b.body.position;
      const d = Math.hypot(p.x - this.center.x, p.y - this.center.y, p.z - this.center.z);
      if (d > this.R) continue;
      b.swept = true;
      const out = new THREE.Vector3(p.x - this.center.x, 0, p.z - this.center.z).normalize();
      const fall = 1 / (1 + d * 1.5);
      const j = new CANNON.Vec3(out.x * KICK_OUT * fall, KICK_UP * fall, out.z * KICK_OUT * fall).scale(b.body.mass);
      b.body.wakeUp();
      b.body.applyImpulse(j, new CANNON.Vec3((Math.random() - 0.5) * 0.01, 0.004, (Math.random() - 0.5) * 0.01).vadd(b.body.position));
    }
    // dragged prop: drive velocity toward the pointer
    if (this.held) {
      const body = this.held.body, want = this.target.clone().sub(this.grab);
      const v = want.sub(new THREE.Vector3(body.position.x, body.position.y, body.position.z)).multiplyScalar(14);
      if (v.length() > 5) v.setLength(5);
      body.velocity.set(v.x, v.y, v.z); body.angularVelocity.scale(0.9, body.angularVelocity);
    }
    // fixed-step integration, gravity reapplied every substep
    this.acc = (this.acc || 0) + Math.min(dt, 0.05);
    let n = 0;
    while (this.acc >= 1 / 120 && n < 8) {
      this.applyGravity(); this.world.step(1 / 120); this.acc -= 1 / 120; n++;
      for (const b of this.bodies) {
        const v = b.body.velocity, w = b.body.angularVelocity, vm = b === this.held ? 5 : VMAX;
        if (v.length() > vm) v.scale(vm / v.length(), v);
        if (w.length() > WMAX) w.scale(WMAX / w.length(), w);
      }
    }
    for (const b of this.bodies) { b.mesh.position.copy(b.body.position); b.mesh.quaternion.copy(b.body.quaternion); }
  }
}
