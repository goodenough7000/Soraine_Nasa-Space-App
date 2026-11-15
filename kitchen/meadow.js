// Earth tall-grass meadow. Adapted from Tony's meadow-wind.js (09_assets/.../earth-grassland):
// same tuft atlas, tuft geometry, wind field, canopy and 6 m camera-following tiles (only tiles within ~13 m of
// the camera exist, so grass is generated and drawn only where the lens can see it up close).
// Added for this scene:
//   - scan clipping: uRole 1 = draw only outside the scan front (old state), 2 = only inside (new), 3 = always
//   - keep-out zones: no tufts on the kitchen footprint or where the camera rigs stand (world coordinates)
//   - fog, so the meadow's far edge melts into the horizon like the rest of the scene
import * as THREE from 'three';

const field = `
uniform float uTime, uStrength;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise2(vec2 p){vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float gustAt(vec2 x){vec2 p=x-normalize(vec2(1.,-.35))*uTime*2.4;
 return smoothstep(.24,.78,.73*noise2(p*.20)+.27*noise2(p*.49+8.));}
`;
function strandAtlas() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 256, 256);
  let seed = 48231; const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 46; i++) {
    const x = 24 + random() * 204, tip = Math.min(253, Math.max(3, x + (random() - .5) * 74));
    const top = 2 + random() * 43, wide = 2.3 + random() * 2.2, curve = (random() - .5) * 26;
    ctx.fillStyle = 'rgb(255,' + Math.floor(65 + random() * 185) + ',0)';
    ctx.beginPath(); ctx.moveTo(x - wide, 256); ctx.quadraticCurveTo((x + tip) * .5 + curve - wide, 130, tip, top);
    ctx.quadraticCurveTo((x + tip) * .5 + curve + wide, 130, x + wide, 256); ctx.closePath(); ctx.fill();
  }
  return new THREE.CanvasTexture(c);
}
function tuftGeometry() {
  const g = new THREE.BufferGeometry(), points = [], uv = [], idx = [];
  for (let i = 0; i < 3; i++) { const h = i * .5; points.push(-.39, h, 0, .39, h, 0); uv.push(0, h, 1, h); }
  for (let i = 0; i < 4; i += 2) idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
}

// keepOut(worldX, worldZ) -> true where no tuft may stand
export function enableMeadowWind(root, { SWEEP, SWEEP_GLSL, SWEEP_FN, roleU, keepOut }) {
  const ground = root.getObjectByName('TallMeadowGround') || root.getObjectByName('MeadowGround');
  const blade = root.getObjectByName('BladeTemplate');
  const positions = ground.geometry.attributes.position;
  const cameraPos = new THREE.Vector3();
  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog]);
  Object.assign(uniforms, { uTime: { value: 0 }, uStrength: { value: 1 }, uEye: { value: cameraPos } }, SWEEP, { uRole: roleU });
  const make = (vertexShader, fragmentShader) => new THREE.ShaderMaterial({ uniforms, vertexColors: true, side: THREE.DoubleSide, fog: true, vertexShader, fragmentShader });
  const clip = SWEEP_GLSL + '\n' + SWEEP_FN + `
   uniform float uRole;
   void clipBySweep(vec3 w){ float s = sweepMix(w); if ((uRole < 1.5 && s > 0.5) || (uRole > 1.5 && uRole < 2.5 && s < 0.5)) discard; }\n`;
  const output = `
   #include <tonemapping_fragment>
   #include <colorspace_fragment>
   #include <fog_fragment>
  }`;
  const atlas = strandAtlas(), tuft = tuftGeometry(); uniforms.strands = { value: atlas };
  const leaves = make(field + `
   #include <fog_pars_vertex>
   uniform vec3 uEye; varying vec3 shade; varying vec2 strandUV; varying vec3 vSweepW;
   void main(){
    vec3 p=(instanceMatrix*vec4(position,1.)).xyz;
    vec3 base=instanceMatrix[3].xyz;strandUV=uv;float h=uv.y;float t=h*h*uStrength;
    float gust=gustAt(base.xz);
    p.xz+=normalize(vec2(1.,-.35))*t*(.23+.67*gust+.045*sin(dot(base.xz,vec2(1.9,2.4))-uTime*4.7));
    p.y-=t*(.025+.19*gust);
    float fade=smoothstep(8.,13.,distance(base.xz,uEye.xz));
    p=mix(p,vec3(base.x,base.y+.80,base.z),fade);
    shade=mix(vec3(.055,.095,.012),mix(vec3(.22,.29,.041),vec3(.74,.68,.20),smoothstep(.12,.86,gust)),pow(h,.75))*(.87+.23*fract(base.x*5.23+base.z*3.13));
    vSweepW=(modelMatrix*vec4(p,1.)).xyz;
    vec4 mvPosition=modelViewMatrix*vec4(p,1.);
    gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
   }`, clip + `
   #include <fog_pars_fragment>
   uniform sampler2D strands; varying vec2 strandUV; varying vec3 shade;
   void main(){ clipBySweep(vSweepW); vec2 ink=texture2D(strands,strandUV).rg;if(ink.r<.23)discard;gl_FragColor=vec4(shade*(.78+.35*ink.g),1.);` + output);
  const canopy = make(`
   #include <fog_pars_vertex>
   uniform vec3 uEye; varying vec2 coord;varying vec3 paint; varying vec3 vSweepW;
   void main(){
    vec3 p=position;p.y+=.15+.64*smoothstep(3.,11.,distance(p.xz,uEye.xz));coord=p.xz;paint=color.rgb;
    vSweepW=(modelMatrix*vec4(p,1.)).xyz;
    vec4 mvPosition=modelViewMatrix*vec4(p,1.);
    gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
   }`, field + clip + `
   #include <fog_pars_fragment>
   varying vec2 coord;varying vec3 paint;
   void main(){ clipBySweep(vSweepW); float gust=gustAt(coord);
    vec2 grainDir=vec2(dot(coord,vec2(.94,-.34)),dot(coord,vec2(.34,.94)));float groove=grainDir.y*41.+5.*sin(grainDir.x*1.7+grainDir.y*.9+gust*3.)+7.*noise2(coord*2.);float grain=.5+.5*sin(groove)*(1.-smoothstep(.45,3.,fwidth(groove)));
    float sheen=smoothstep(.16,.87,gust);
    vec3 color=mix(paint*vec3(.43,.52,.21),vec3(.56,.54,.136),clamp(sheen*uStrength,0.,1.));
    gl_FragColor=vec4(color*(.82+.33*grain),1.);` + output);
  blade.visible = false; ground.material = canopy;

  // sample the exported terrain (the exporter may reorder vertices)
  const grid = new Float32Array(87 * 55);
  for (let i = 0; i < positions.count; i++) {
    const ix = Math.round(positions.getX(i)) + 43, iz = Math.round(-positions.getZ(i)) + 18;
    grid[iz * 87 + ix] = positions.getY(i);
  }
  function height(x, z) {
    const a = x + 43, b = 18 - z, i = Math.floor(a), j = Math.floor(b), f = a - i, g = b - j, k = j * 87 + i;
    return (grid[k] * (1 - f) + grid[k + 1] * f) * (1 - g) + (grid[k + 87] * (1 - f) + grid[k + 88] * f) * g;
  }
  const tiles = new Map(), tmp = new THREE.Object3D(), off = new THREE.Vector3(); let last = '';
  function tile(ix, iz) {
    root.updateWorldMatrix(true, false); off.setFromMatrixPosition(root.matrixWorld);
    let seed = ((ix + 44) * 73856093 ^ (iz + 32) * 19349663) >>> 0;
    const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const side = 39, mesh = new THREE.InstancedMesh(tuft, leaves, side * side); let count = 0;
    for (let a = 0; a < side; a++) for (let b = 0; b < side; b++) {
      const x = (ix + (a + rand()) / side) * 6, z = (iz + (b + rand()) / side) * 6;
      const r1 = rand(), r2 = rand(), r3 = rand();
      if (x < -42 || x > 42 || z < -35 || z > 17) continue;
      if (keepOut && keepOut(x + off.x, z + off.z)) continue;
      tmp.position.set(x, height(x, z) - .012, z); tmp.rotation.y = r1 * Math.PI * 2;
      tmp.scale.set(.75 + r2 * .55, .96 + r3 * .32, 1); tmp.updateMatrix(); mesh.setMatrixAt(count++, tmp.matrix);
    }
    mesh.count = count; mesh.computeBoundingSphere(); mesh.boundingSphere.radius += 1; root.add(mesh); return mesh;
  }
  function follow(x, z) {
    const cx = Math.floor(x / 6), cz = Math.floor(z / 6), key = cx + ',' + cz; if (key === last) return; last = key;
    const needed = new Set();
    for (let i = cx - 3; i <= cx + 3; i++) for (let j = cz - 3; j <= cz + 3; j++) {
      if (i < -7 || i > 6 || j < -6 || j > 2) continue;
      if (Math.hypot(Math.max(0, Math.abs(i - cx) * 6 - 6), Math.max(0, Math.abs(j - cz) * 6 - 6)) > 13) continue;
      const id = i + ',' + j; needed.add(id); if (!tiles.has(id)) tiles.set(id, tile(i, j));
    }
    for (const [id, m] of tiles) if (!needed.has(id)) { root.remove(m); m.dispose(); tiles.delete(id); }
  }
  return {
    update(seconds, camera) { uniforms.uTime.value = seconds; if (camera) { camera.getWorldPosition(cameraPos); root.worldToLocal(cameraPos); } follow(cameraPos.x, cameraPos.z); },
    setStrength(v) { uniforms.uStrength.value = THREE.MathUtils.clamp(v, 0, 2); },
    tileCount: () => tiles.size,
  };
}
