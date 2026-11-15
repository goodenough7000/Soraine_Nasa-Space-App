// An illustrative orbital research enclosure, not a model of a particular station.
// Animation is advanced by the host's existing, visibility-aware render loop.
export function makeMicrogravityScene({THREE, load}) {
  const group = new THREE.Group();
  group.name = 'Microgravity research viewport';
  group.rotation.set(.055, -.24, -.045);
  group.scale.setScalar(.96);
  const drift = [];
  let elapsed = 0;

  const finish = (color, roughness = .48, metalness = .25) =>
    new THREE.MeshStandardMaterial({color, roughness, metalness});
  const structure = finish(0x8a8884, .44, .42);
  const pale = finish(0xb9b7af, .48, .24);
  const graphite = finish(0x171b22, .57, .24);
  const inset = finish(0x080b11, .63, .12);
  const steel = finish(0x687482, .32, .58);
  const blue = new THREE.MeshStandardMaterial({
    color: 0x4b9cff, emissive: 0x096cff, emissiveIntensity: 1.6,
    roughness: .4, metalness: .05
  });

  function roundedPath(path, width, height, radius) {
    const x = -width / 2, y = -height / 2;
    path.moveTo(x + radius, y);
    path.lineTo(x + width - radius, y);
    path.quadraticCurveTo(x + width, y, x + width, y + radius);
    path.lineTo(x + width, y + height - radius);
    path.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    path.lineTo(x + radius, y + height);
    path.quadraticCurveTo(x, y + height, x, y + height - radius);
    path.lineTo(x, y + radius);
    path.quadraticCurveTo(x, y, x + radius, y);
    path.closePath();
    return path;
  }

  function plate(width, height, depth, radius, material, parent = group) {
    const shape = roundedPath(new THREE.Shape(), width, height, radius);
    const bevel = Math.min(.022, depth * .18, radius * .22);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
      bevelSegments: 2, curveSegments: 8, steps: 1
    });
    geometry.translate(0, 0, -depth / 2);
    const mesh = new THREE.Mesh(geometry, material);
    parent.add(mesh);
    return mesh;
  }

  function rim(width, height, radius, band, depth, material, z) {
    const outline = roundedPath(new THREE.Shape(), width, height, radius);
    outline.holes.push(roundedPath(new THREE.Path(), width - band * 2,
      height - band * 2, Math.max(.02, radius - band)));
    const geometry = new THREE.ExtrudeGeometry(outline, {
      depth, bevelEnabled: true, bevelThickness: .012, bevelSize: .012,
      bevelSegments: 2, curveSegments: 12, steps: 1
    });
    geometry.translate(0, 0, -depth / 2);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = z;
    group.add(mesh);
    return mesh;
  }

  // Layered, sealed viewport: warm alloy outer frame, dark gasket, blue inner edge.
  rim(2.65, 2.12, .36, .18, .20, structure, -.12);
  rim(2.36, 1.84, .25, .09, .15, graphite, -.015);
  rim(2.23, 1.71, .19, .018, .022, blue, .078);
  const rear = plate(2.57, 2.04, .04, .30,
    new THREE.MeshBasicMaterial({color: 0x02050b}));
  rear.position.z = -1.0;

  // The familiar planet is a small view beyond the laboratory, not its centerpiece.
  const earth = new THREE.Mesh(new THREE.SphereGeometry(.48, 40, 28),
    new THREE.MeshStandardMaterial({
      map: load('earth.png'), roughness: 1, metalness: 0,
      emissive: 0x183047, emissiveIntensity: .19
    }));
  earth.position.set(.38, .27, -.49);
  earth.rotation.set(.15, 1.8, .32);
  group.add(earth);
  const haze = new THREE.Mesh(new THREE.SphereGeometry(.491, 32, 24),
    new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide,
      uniforms: {tint: {value: new THREE.Color(0x48a4ff)}},
      vertexShader: `varying vec3 vNormal; varying vec3 vView;
        void main(){ vec4 p=modelViewMatrix*vec4(position,1.0);
          vNormal=normalize(normalMatrix*normal); vView=normalize(-p.xyz);
          gl_Position=projectionMatrix*p; }`,
      fragmentShader: `uniform vec3 tint; varying vec3 vNormal; varying vec3 vView;
        void main(){ float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),3.0);
          gl_FragColor=vec4(tint,rim*.32); }`
    }));
  haze.position.copy(earth.position);
  group.add(haze);

  // A few fixed stars remain behind the glass and within the window opening.
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -.84,.56,-.90, -.56,.31,-.88, -.92,-.14,-.91, -.34,.68,-.90,
    .05,.67,-.92, .88,.57,-.90, .88,-.28,-.91, -.20,-.43,-.89,
    -.61,-.55,-.90, .61,-.52,-.90, -.12,.15,-.91
  ], 3));
  group.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({
    color: 0xc8ddff, size: .014, sizeAttenuation: true
  })));

  // Four flush fasteners and a shallow containment sill give a human-built scale.
  const fastenerGeometry = new THREE.CylinderGeometry(.035, .035, .016, 16);
  for (const [x, y] of [[-1.16,-.88], [1.16,-.88], [-1.16,.88], [1.16,.88]]) {
    const screw = new THREE.Mesh(fastenerGeometry, graphite);
    screw.rotation.x = Math.PI / 2;
    screw.position.set(x, y, .002);
    group.add(screw);
  }
  const sill = plate(2.60, .58, .14, .12, pale);
  sill.rotation.x = -Math.PI / 2;
  sill.position.set(0, -.98, .36);
  const bed = plate(2.24, .43, .026, .07, inset);
  bed.rotation.x = -Math.PI / 2;
  bed.position.set(0, -.896, .36);
  const sillLight = plate(1.88, .022, .012, .008, blue);
  sillLight.position.set(0, -1.005, .666);
  for (const x of [-1.17, 1.17]) {
    const guard = plate(.085, .23, .48, .035, structure);
    guard.position.set(x, -.86, .36);
  }

  function floating(object, phase, amplitudes, speed) {
    drift.push({object, base: object.position.clone(), rotation: object.rotation.clone(),
      phase, amplitudes, speed});
  }

  // Unheated material coupon: a framed specimen, deliberately no flame or risk tint.
  const coupon = new THREE.Group();
  group.add(coupon);
  plate(.39, .53, .034, .045, steel, coupon);
  const specimen = plate(.32, .43, .018, .025, finish(0xa6997c, .77, .05), coupon);
  specimen.position.z = .028;
  const couponClip = plate(.11, .035, .025, .009, graphite, coupon);
  couponClip.position.set(0, .22, .04);
  coupon.position.set(-.58, -.17, .47);
  coupon.rotation.set(-.10, .34, -.23);
  floating(coupon, .3, [.045, .07, .025], .55);

  const sample = new THREE.Group();
  group.add(sample);
  plate(.24, .24, .24, .035, pale, sample);
  const sampleInset = plate(.16, .16, .012, .02, graphite, sample);
  sampleInset.position.z = .134;
  const sampleMarker = plate(.08, .012, .015, .004, blue, sample);
  sampleMarker.position.set(0, .014, .146);
  sample.position.set(.48, -.43, .54);
  sample.rotation.set(.34, -.42, .21);
  floating(sample, 2.0, [.025, .055, .018], .45);

  // Pale blue, smooth droplets read clearly without expensive transmission buffers.
  const dropletMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x5e9bc7, roughness: .08, metalness: .1,
    clearcoat: 1, clearcoatRoughness: .08,
    transparent: true, opacity: .82, depthWrite: false,
    emissive: 0x123354, emissiveIntensity: .45
  });
  const dropletGeometry = new THREE.SphereGeometry(1, 20, 14);
  for (const [x, y, z, radius, phase] of [
    [-.04, -.25, .67, .075, .7], [.13, -.03, .55, .045, 2.7],
    [.77, -.04, .43, .052, 4.2]
  ]) {
    const drop = new THREE.Mesh(dropletGeometry, dropletMaterial);
    drop.position.set(x, y, z);
    drop.scale.setScalar(radius);
    group.add(drop);
    floating(drop, phase, [.025, .045, .02], .4);
  }

  const interiorLight = new THREE.PointLight(0x8db9ff, .55, 3, 2);
  interiorLight.position.set(-.35, .65, 1.0);
  group.add(interiorLight);

  function update() {
    for (const item of drift) {
      const t = elapsed * item.speed + item.phase;
      item.object.position.set(
        item.base.x + Math.sin(t) * item.amplitudes[0],
        item.base.y + Math.sin(t * .83) * item.amplitudes[1],
        item.base.z + Math.cos(t * .7) * item.amplitudes[2]
      );
      item.object.rotation.set(
        item.rotation.x + Math.sin(t * .6) * .045,
        item.rotation.y + Math.sin(t * .5) * .07,
        item.rotation.z + Math.sin(t * .75) * .045
      );
    }
    earth.rotation.y = 1.8 + elapsed * .012;
  }
  update();
  return {
    group,
    tick(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      elapsed += Math.min(dt, .1);
      update();
    },
    reset() {elapsed = 0; update();}
  };
}
