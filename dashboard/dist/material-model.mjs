import * as THREE from './vendor/three.module.js';
import {attachOrbitGestures} from './touch-orbit.mjs';

const NAMES=new Set(['Ultem 1000','Mylar G','Nomex HT90-40']);

// Generic specimen surfaces, not a reconstruction of a photographed test coupon.
export function createMaterialModel(host,initialMaterial){
 if(!host||!NAMES.has(initialMaterial))throw Error('Unsupported specimen');
 const fallbackNodes=[...host.childNodes];
 let renderer,environment,resizeObserver,intersectionObserver,frame=null,resumeTimer=null,disposed=false,visible=true;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const compact=matchMedia('(pointer:coarse)').matches||matchMedia('(max-width:760px)').matches;
 let scrolling=false,scrollTimer=null,gestures=null;
 const device=window.SORAINE_DEVICE||{};
 const pixelRatio=()=>Math.min(window.devicePixelRatio||1,device.low?1:compact?1.5:2);
 let paused=reduced.matches,holdUntil=0,lastRender=0,dirty=true;
 const controller=new AbortController(),geometries=new Set(),materials=new Set(),textures=new Set(),models=new Map();
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.05,30),turntable=new THREE.Group();
 let distance=4.05,targetDistance=4.05,pointer=null,dragging=false,lastX=0,lastY=0;
 const geometry=value=>(geometries.add(value),value),finish=value=>(materials.add(value),value),texture=value=>(textures.add(value),value);
 const listen=(target,event,callback,options={})=>target.addEventListener(event,callback,{...options,signal:controller.signal});

 const zooming=()=>Math.abs(targetDistance-distance)>.002;
 const rotating=now=>!paused&&!dragging&&pointer===null&&now>=holdUntil;
 function schedule(){
  if(disposed||!visible||scrolling||document.hidden)return;
  const now=performance.now();
  if(frame===null&&(dirty||zooming()||rotating(now)))frame=requestAnimationFrame(draw);
  else if(frame===null&&!paused&&!dragging&&pointer===null&&holdUntil>now&&resumeTimer===null)resumeTimer=setTimeout(()=>{resumeTimer=null;schedule();},holdUntil-now+8);
 }
 function draw(now){
  frame=null;if(disposed||!visible||scrolling||document.hidden)return;
  // A single shared loop renders at most 30 fps unless a direct input needs a frame.
  if(dirty||now-lastRender>=1000/(zooming()?60:30)){
   const dt=lastRender?Math.min((now-lastRender)/1000,.08):1/30;lastRender=now;
   if(rotating(now))turntable.rotation.y+=dt*.08;
   if(zooming()){distance=reduced.matches?targetDistance:THREE.MathUtils.lerp(distance,targetDistance,1-Math.exp(-dt*13));if(Math.abs(targetDistance-distance)<=.002)distance=targetDistance;fit();}
   renderer.render(scene,camera);dirty=false;
  }
  schedule();
 }
 function requestDraw(){dirty=true;schedule();}
 function stop(){if(frame!==null)cancelAnimationFrame(frame);if(resumeTimer!==null)clearTimeout(resumeTimer);frame=resumeTimer=null;lastRender=0;}
 function inspect(){holdUntil=performance.now()+2200;requestDraw();}
 function setPaused(value){paused=Boolean(value);stop();if(!paused)holdUntil=0;requestDraw();host.dispatchEvent(new CustomEvent('materialrotationchange',{detail:paused}));}
 function fit(){camera.position.set(0,.08,distance*Math.max(1,1.25/camera.aspect));camera.lookAt(0,0,0);camera.updateProjectionMatrix();}
 function resize(){if(disposed)return;const width=host.clientWidth,height=host.clientHeight;if(!width||!height)return;camera.aspect=width/height;fit();renderer.setPixelRatio(pixelRatio());renderer.setSize(width,height);requestDraw();}
 function reset(manual=true){gestures?.stop();turntable.rotation.set(-.43,-.48,-.18);distance=targetDistance=3.85;fit();if(manual)inspect();else requestDraw();}
 function zoom(amount){if(!Number.isFinite(amount))return;targetDistance=THREE.MathUtils.clamp(targetDistance+amount,2.65,6.5);inspect();}

 function dispose(){
  if(disposed)return;disposed=true;stop();clearTimeout(scrollTimer);controller.abort();resizeObserver?.disconnect();intersectionObserver?.disconnect();
  geometries.forEach(item=>item.dispose());materials.forEach(item=>item.dispose());textures.forEach(item=>item.dispose());environment?.dispose();
  if(renderer){const canvas=renderer.domElement;renderer.dispose();renderer.forceContextLoss();if(canvas.parentNode===host)canvas.remove();}
 }

 // A closed, thin sheet with curved faces and real edge thickness. The face is
 // three times as long as it is wide, matching the study's 15 × 5 cm window.
 function sheet(kind,thickness){
  const nx=64,ny=24,positions=[],uvs=[],indices=[];
  const surface=(u,v)=>{
   let x=(u-.5)*3,y=(v-.5);
   let z;
   if(kind==='ultem'){
    z=.07*Math.sin(u*Math.PI*1.35)+.07*(v-.5)**2;
    const length=Math.max(0,(u-.71)*3),angle=length/.66;
    x-=length-.66*Math.sin(angle);z+=.66*(1-Math.cos(angle))*(.82+.18*v);
   }else if(kind==='mylar'){
    z=.19*Math.sin(u*Math.PI*1.75)+.045*Math.sin(v*Math.PI);
    const length=Math.max(0,v-.58),angle=length/.28;
    y-=length-.28*Math.sin(angle);z+=.28*(1-Math.cos(angle));
    z+=.12*Math.pow(Math.max(0,(u-.80)/.20),2);
   }else{
    const fold=Math.pow(Math.max(0,(u-.66)/.34),2)*Math.pow(v,1.5);
    z=.10*Math.sin(u*Math.PI*2.3)*Math.sin(v*Math.PI)+.49*fold-.06*Math.cos(u*Math.PI);
    x-=.15*fold;y-=.10*fold+.04*Math.sin(u*Math.PI);
   }
   return [x,y,z];
  };
  const layer=(nx+1)*(ny+1);
  for(let side=0;side<2;side++)for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
   const u=x/nx,v=y/ny,p=surface(u,v);positions.push(p[0],p[1],p[2]+(side?-.5:.5)*thickness);uvs.push(u,v);
  }
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
   const a=y*(nx+1)+x,b=a+1,c=a+nx+1,d=c+1;
   indices.push(a,b,d,a,d,c,a+layer,d+layer,b+layer,a+layer,c+layer,d+layer);
  }
  const edge=(a,b)=>indices.push(a,a+layer,b+layer,a,b+layer,b);
  for(let x=0;x<nx;x++){edge(x+1,x);edge(ny*(nx+1)+x,ny*(nx+1)+x+1);}
  for(let y=0;y<ny;y++){edge(y*(nx+1),(y+1)*(nx+1));edge((y+1)*(nx+1)+nx,y*(nx+1)+nx);}
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));result.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));result.setIndex(indices);result.computeVertexNormals();return geometry(result);
 }

 function weave(){
  const size=256,canvas=document.createElement('canvas'),normalCanvas=document.createElement('canvas');canvas.width=canvas.height=normalCanvas.width=normalCanvas.height=size;
  const ctx=canvas.getContext('2d'),normalContext=normalCanvas.getContext('2d'),color=ctx.createImageData(size,size),normal=normalContext.createImageData(size,size),height=new Float32Array(size*size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const warp=(Math.cos(x*Math.PI/4)+1)/2,weft=(Math.cos(y*Math.PI/4)+1)/2,over=(Math.floor(x/8)+Math.floor(y/8))%2;
   height[y*size+x]=(over?warp:weft)*.68+(over?weft:warp)*.19+.035*Math.sin(x*2.7+y*1.3);
  }
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
   const i=(y*size+x)*4,h=height[y*size+x];
   color.data.set([184+h*51,176+h*50,157+h*54,255],i);
   const dx=height[y*size+(x+1)%size]-height[y*size+(x+size-1)%size],dy=height[((y+1)%size)*size+x]-height[((y+size-1)%size)*size+x];
   const n=new THREE.Vector3(-dx*1.3,-dy*1.3,1).normalize();normal.data.set([(n.x*.5+.5)*255,(n.y*.5+.5)*255,(n.z*.5+.5)*255,255],i);
  }
  ctx.putImageData(color,0,0);normalContext.putImageData(normal,0,0);
  const map=texture(new THREE.CanvasTexture(canvas)),normalMap=texture(new THREE.CanvasTexture(normalCanvas));map.colorSpace=THREE.SRGBColorSpace;
  for(const item of [map,normalMap]){item.wrapS=item.wrapT=THREE.RepeatWrapping;item.repeat.set(3,1);item.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}
  return {map,normalMap};
 }

 function makeModel(name){
  let material,kind,thickness;
  if(name==='Ultem 1000'){
   kind='ultem';thickness=.00508;
   material=new THREE.MeshPhysicalMaterial({color:0xd59022,metalness:0,roughness:.125,transmission:.72,thickness:.055,ior:1.64,attenuationColor:0xba660d,attenuationDistance:.16,clearcoat:.7,clearcoatRoughness:.10,envMapIntensity:.95,side:THREE.DoubleSide});
  }else if(name==='Mylar G'){
   kind='mylar';thickness=.00254;
   material=new THREE.MeshPhysicalMaterial({color:0xffffff,metalness:0,roughness:.075,transmission:.94,thickness:.006,ior:1.58,attenuationColor:0xf3f8ff,attenuationDistance:5,clearcoat:.6,clearcoatRoughness:.065,envMapIntensity:1.2,side:THREE.DoubleSide});
  }else{
   kind='nomex';thickness=.0061;const maps=weave();
   material=new THREE.MeshPhysicalMaterial({color:0xfff7e5,...maps,normalScale:new THREE.Vector2(.68,.68),metalness:0,roughness:.90,sheen:.5,sheenColor:0xe9ddc5,sheenRoughness:.8,envMapIntensity:.8,side:THREE.DoubleSide});
  }
  const object=new THREE.Mesh(sheet(kind,thickness),finish(material));object.name=name;models.set(name,object);return object;
 }

 function setMaterial(name){
  if(disposed||!NAMES.has(name))return false;
  const selected=models.get(name)||makeModel(name);for(const object of [...turntable.children])turntable.remove(object);turntable.add(selected);
  host.dataset.modelMaterial=name;host.dataset.materialModel=name;
  host.setAttribute('aria-label',`Rotate the ${name} specimen. Arrow keys rotate, plus and minus zoom, Home resets.`);
  requestDraw();return true;
 }

 try{
  renderer=new THREE.WebGLRenderer({alpha:false,antialias:!((window.SORAINE_DEVICE||{}).low),powerPreference:'low-power'});
  renderer.setPixelRatio(pixelRatio());renderer.setClearColor(0x05070d);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
  renderer.domElement.setAttribute('aria-hidden','true');
  scene.add(turntable);scene.add(new THREE.HemisphereLight(0xf4f7ff,0x293348,1.15));
  const key=new THREE.DirectionalLight(0xffffff,2.2);key.position.set(-2,3,4);scene.add(key);
  const fill=new THREE.DirectionalLight(0xc7e0ff,1.0);fill.position.set(3,.5,2);scene.add(fill);

  // Bright neutral studio panels make thin dielectric films legible on black.
  const studio=new THREE.Scene();studio.background=new THREE.Color(0x151b25);
  const studioObjects=[];
  for(const [width,height,x,y,z,power] of [[3,3,-3,3,4,3.2],[1.1,3.5,3,1,2,2.8],[4,.8,0,4,-1,2.4],[2,2,-1,-2,3,.8]]){
   const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({color:new THREE.Color().setRGB(power,power,power)}));mesh.position.set(x,y,z);mesh.lookAt(0,0,0);studio.add(mesh);studioObjects.push(mesh);
  }
  const pmrem=new THREE.PMREMGenerator(renderer);
  try{environment=pmrem.fromScene(studio,.035,.1,20);scene.environment=environment.texture;}
  finally{pmrem.dispose();studioObjects.forEach(object=>{object.geometry.dispose();object.material.dispose()});}

  const floor=new THREE.Mesh(geometry(new THREE.PlaneGeometry(20,20)),finish(new THREE.MeshStandardMaterial({color:0x080b10,roughness:.95,metalness:0})));floor.rotation.x=-Math.PI/2;floor.position.y=-.78;scene.add(floor);
  const shadowCanvas=document.createElement('canvas');shadowCanvas.width=shadowCanvas.height=128;const shadowContext=shadowCanvas.getContext('2d'),gradient=shadowContext.createRadialGradient(64,64,5,64,64,64);gradient.addColorStop(0,'rgba(0,0,0,.65)');gradient.addColorStop(1,'rgba(0,0,0,0)');shadowContext.fillStyle=gradient;shadowContext.fillRect(0,0,128,128);
  const shadow=new THREE.Mesh(geometry(new THREE.PlaneGeometry(3.7,1.35)),finish(new THREE.MeshBasicMaterial({map:texture(new THREE.CanvasTexture(shadowCanvas)),transparent:true,depthWrite:false})));shadow.rotation.x=-Math.PI/2;shadow.position.set(0,-.776,.04);scene.add(shadow);
  setMaterial(initialMaterial);reset(false);resize();stop();renderer.render(scene,camera);dirty=false;
  // Retain the supplied SVG fallback if setup or the first GPU render throws.
  host.replaceChildren(renderer.domElement);

  // One finger (or the mouse) rotates and glides to a stop; two fingers pinch to zoom.
  gestures=attachOrbitGestures(host,{
   signal:controller.signal,
   reducedMotion:()=>reduced.matches,
   start(){dragging=true;stop()},
   rotate(dx,dy,type){const touch=type!=='mouse';turntable.rotation.y+=dx*(touch?.0115:.009);turntable.rotation.x=THREE.MathUtils.clamp(turntable.rotation.x+dy*(touch?.009:.007),-1.25,1.25);requestDraw()},
   zoom:ratio=>zoom(ratio*4),
   end(){dragging=false;inspect()}
  });
  listen(host,'keydown',event=>{
   if(event.ctrlKey||event.metaKey||event.altKey)return;
   if(event.key==='ArrowLeft')turntable.rotation.y-=.16;
   else if(event.key==='ArrowRight')turntable.rotation.y+=.16;
   else if(event.key==='ArrowUp')turntable.rotation.x=Math.max(-1.25,turntable.rotation.x-.12);
   else if(event.key==='ArrowDown')turntable.rotation.x=Math.min(1.25,turntable.rotation.x+.12);
   else if(['+','='].includes(event.key))zoom(-.35);
   else if(event.key==='-')zoom(.35);
   else if(event.key==='Home')reset();else return;
   event.preventDefault();event.stopPropagation();inspect();
  });
  listen(reduced,'change',()=>{if(reduced.matches){distance=targetDistance;fit();}setPaused(reduced.matches);});
  listen(document,'visibilitychange',()=>{if(document.hidden)stop();else requestDraw();});
  listen(window,'scroll',()=>{if(!compact)return;scrolling=true;stop();clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{scrolling=false;requestDraw()},160);},{passive:true});
  resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);
  intersectionObserver=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)requestDraw();else stop();});intersectionObserver.observe(host);
  schedule();
  return {setMaterial,zoom,reset,dispose,get paused(){return paused},set paused(value){setPaused(value)}};
 }catch(error){dispose();host.replaceChildren(...fallbackNodes);throw error;}
}
