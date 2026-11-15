import * as THREE from './vendor/three.module.js';

// Original WebGL implementation of the day/night and limb-lighting ideas in
// https://threejs.org/examples/webgpu_tsl_earth.html. Maps are NASA products.
const vertexShader = `
varying vec2 vUv;
varying vec3 vNormalWorld;
varying vec3 vPositionWorld;
void main(){
  vUv=uv;
  vNormalWorld=normalize(mat3(modelMatrix)*normal);
  vec4 world=modelMatrix*vec4(position,1.0);
  vPositionWorld=world.xyz;
  gl_Position=projectionMatrix*viewMatrix*world;
}`;

export function makePlanet({world,load}) {
  const earth=world==='Earth'||world==='Microgravity';
  const day=load(earth?'earth.png':world==='Moon'?'moon-lroc.jpg':'mars-viking.jpg');
  const night=earth?load('earth-night.png'):day;
  const sun=new THREE.Vector3(-3,1.8,2.7).normalize();
  const uniforms={dayMap:{value:day},nightMap:{value:night},sunDirection:{value:sun},isEarth:{value:earth?1:0},isMoon:{value:world==='Moon'?1:0}};
  let material=new THREE.ShaderMaterial({uniforms,vertexShader,fragmentShader:`
    uniform sampler2D dayMap;
    uniform sampler2D nightMap;
    uniform vec3 sunDirection;
    uniform float isEarth;
    uniform float isMoon;
    varying vec2 vUv;
    varying vec3 vNormalWorld;
    varying vec3 vPositionWorld;
    void main(){
      vec3 normal=normalize(vNormalWorld);
      float sunlight=dot(normal,sunDirection);
      vec3 viewDirection=normalize(cameraPosition-vPositionWorld);
      float fresnel=pow(1.0-max(dot(normal,viewDirection),0.0),3.0);
      vec3 day=texture2D(dayMap,vUv).rgb;
      float diffuse=max(sunlight,0.0);
      vec3 surface=day*(0.045+1.35*pow(diffuse,0.8));
      if(isEarth>0.5){
        vec3 night=texture2D(nightMap,vUv).rgb;
        float nightMask=1.0-smoothstep(-0.15,0.12,sunlight);
        surface+=night*nightMask*1.9;
        vec3 atmosphere=mix(vec3(0.6,0.12,0.025),vec3(0.08,0.42,0.92),smoothstep(-0.25,0.5,sunlight));
        surface=mix(surface,atmosphere,fresnel*smoothstep(-0.35,0.8,sunlight)*0.5);
      }
      gl_FragColor=vec4(surface,1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  if(!earth){
    material.dispose();
    material=new THREE.MeshStandardMaterial({
      map:day,
      color:world==='Moon'?0xc7cbd0:0xffffff,
      roughness:1,
      metalness:0,
    });
    if(world==='Moon'){
      material.normalMap=load('moon-normal.png',THREE.NoColorSpace);
      material.normalScale=new THREE.Vector2(1,1);
    }
  }
  let atmosphere;
  if(world!=='Moon'){
    const halo=new THREE.ShaderMaterial({side:THREE.BackSide,transparent:true,depthWrite:false,vertexShader,uniforms:{sunDirection:{value:sun},tint:{value:new THREE.Color(earth?'#52aeff':'#d88b64')},strength:{value:earth?0.72:0.14}},fragmentShader:`
      uniform vec3 sunDirection;
      uniform vec3 tint;
      uniform float strength;
      varying vec3 vNormalWorld;
      varying vec3 vPositionWorld;
      void main(){
        vec3 normal=normalize(vNormalWorld);
        vec3 toCamera=normalize(cameraPosition-vPositionWorld);
        float limb=pow(1.0-abs(dot(normal,toCamera)),4.0);
        float lit=smoothstep(-0.3,0.7,dot(normal,sunDirection));
        gl_FragColor=vec4(tint,limb*lit*strength);
        #include <colorspace_fragment>
      }`});
    atmosphere=new THREE.Mesh(new THREE.SphereGeometry(earth?1.65:1.615,96,64),halo);
  }
  return {material,atmosphere};
}
