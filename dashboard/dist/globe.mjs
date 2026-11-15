import * as THREE from './vendor/three.module.js';
import {makePlanet} from './planet-materials.mjs';
import {makeMicrogravityScene} from './microgravity-scene.mjs';
import {attachOrbitGestures} from './touch-orbit.mjs';
export function createGlobe(host,world){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const status=document.createElement('div');status.dataset.globeStatus='';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 Object.assign(status.style,{position:'absolute',top:'40%',left:'50%',transform:'translateX(-50%)',width:'min(260px, 76%)',textAlign:'center',fontFamily:'inherit',fontSize:'12px',lineHeight:'1.6',color:'#c8cbd2',zIndex:'1',cursor:'default'});
 function showStatus(message,state='loading',retry){
  host.dataset.globeState=state;host.setAttribute('aria-busy',String(state==='loading'));status.replaceChildren();
  const text=document.createElement('span');text.textContent=message;status.append(text);
  if(retry){const button=document.createElement('button');button.type='button';button.textContent='Retry surface';Object.assign(button.style,{display:'block',margin:'12px auto 0',padding:'8px 12px',border:'1px solid #168bff80',color:'#80ceff',background:'#05070d'});button.addEventListener('pointerdown',e=>e.stopPropagation());button.addEventListener('click',e=>{e.stopPropagation();retry()});status.append(button)}
  if(status.parentNode!==host)host.append(status);
 }
 const device=window.SORAINE_DEVICE||{};
 // Phones with dense screens skip antialiasing (the extra pixels already smooth edges); weak phones draw at the screen's base resolution.
 let renderer;try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:!(device.low||(device.phone&&(window.devicePixelRatio||1)>=2)),powerPreference:'low-power'});}catch(error){host.replaceChildren();showStatus('The 3D view is unavailable in this browser. Research data is still available.','error');throw error}
 const touchDevice=matchMedia('(pointer: coarse)').matches;
 const compact=touchDevice||matchMedia('(max-width: 760px)').matches;
 const pixelRatio=()=>Math.min(window.devicePixelRatio||1,device.low?1:compact?1.5:2);renderer.setPixelRatio(pixelRatio());renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;host.replaceChildren(renderer.domElement);
 let surfaceReady=false,initialized=false;renderer.domElement.style.visibility='hidden';
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,.1,100);camera.position.set(0,.12,5.8);const group=new THREE.Group();group.rotation.z=world==='Microgravity'?0:.15;scene.add(group);
 const loader=new THREE.ImageLoader(),textures=new Map(),worlds=new Map();let disposed=false,active=null,lab=null,sphere=null,selection=0,requestedWorld=null,fade=null;
 const load=(name,colorSpace=THREE.SRGBColorSpace)=>{
  if(textures.has(name))return textures.get(name);
  // A defined black night map avoids invented lights if that optional image fails.
  const placeholder=document.createElement('canvas');placeholder.width=placeholder.height=1;
  const context=placeholder.getContext('2d');context.fillStyle=name==='moon-normal.png'?'#8080ff':'#000';context.fillRect(0,0,1,1);
  const texture=new THREE.Texture(placeholder);texture.colorSpace=colorSpace;texture.wrapS=THREE.RepeatWrapping;texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),device.low?2:8);
  const small=name.replace(/\.(png|jpg)$/, '-mobile.webp');
  // These NASA-derived maps resolve the displayed globe without a mid-animation
  // multi-megabyte replacement. Keep both decoded maps and GPU textures alive.
  const ready=loader.loadAsync(new URL('./assets/'+small,import.meta.url).href)
   .catch(()=>loader.loadAsync(new URL('./assets/'+name,import.meta.url).href))
   .then(async image=>{
    if(disposed)return;
    if(image.decode)await image.decode();
    if(disposed)return;
    texture.image=image;texture.needsUpdate=true;renderer.initTexture(texture);
   }).catch(error=>{
    if(name==='earth-night.png'||name==='moon-normal.png'){
     if(!disposed){texture.needsUpdate=true;renderer.initTexture(texture)}
     return;
    }
    textures.delete(name);texture.dispose();throw error;
   });
  const entry={texture,ready};textures.set(name,entry);return entry;
 };
 function prepare(next){
  if(worlds.has(next))return worlds.get(next).ready;
  const root=new THREE.Group(),pending=[],read=(name,colorSpace)=>{const entry=load(name,colorSpace);pending.push(entry.ready);return entry.texture};
  const record={root,lab:null,sphere:null,ready:null};
  if(next==='Microgravity'){record.lab=makeMicrogravityScene({THREE,load:read});root.add(record.lab.group)}
  else{
   const {material,atmosphere}=makePlanet({world:next,load:read});
   record.sphere=new THREE.Mesh(new THREE.SphereGeometry(1.6,compact?64:96,compact?40:64),material);
   record.sphere.rotation.y=next==='Moon'?-1.45:next==='Mars'?-.55:1.8;root.add(record.sphere);if(atmosphere)root.add(atmosphere);
  }
  record.ready=Promise.all(pending).then(async()=>{
   if(disposed)return record;
   // Compile with the existing scene's lights before the visible world changes.
   await renderer.compileAsync(root,camera,scene);
   return record;
  }).catch(error=>{worlds.delete(next);disposeTree(root);throw error});
  worlds.set(next,record);return record.ready;
 }
 // Decorative orbit guide. Thin geometry supplies the light falloff without a bloom pass.
 const orbit=new THREE.Group();orbit.visible=!lab;orbit.rotation.set(1.08,-.12,-.45);group.add(orbit);
 const orbitRadius=2.10,orbitSegments=compact?128:192;
 function orbitBand(radius,width,opacity,arc=Math.PI*2){
  const geometry=new THREE.TorusGeometry(radius,width,4,orbitSegments,arc);
  const vertices=geometry.getAttribute('position'),colors=new Float32Array(vertices.count*3);
  const dark=new THREE.Color(0x09264a),blue=new THREE.Color(0x168bff),cyan=new THREE.Color(0x00c7ff),color=new THREE.Color();
  for(let i=0;i<vertices.count;i++){
   const angle=Math.atan2(vertices.getY(i),vertices.getX(i));
   const glow=Math.pow((Math.cos(angle-1.1)+1)/2,2.5);
   color.copy(dark).lerp(blue,glow).lerp(cyan,Math.pow(glow,3)*.9);
   color.toArray(colors,i*3);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  const band=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity,depthTest:true,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending}));
  band.renderOrder=2;orbit.add(band);return band;
 }
 orbitBand(orbitRadius,.025,.035);orbitBand(orbitRadius,.012,.10);orbitBand(orbitRadius,.0035,.88);
 // A quiet parallel arc makes the guide feel intentional without another full ring.
 const companion=orbitBand(orbitRadius+.075,.002,.24,Math.PI*.72);companion.rotation.z=.25;
 const orbitMarker=new THREE.Group();orbit.add(orbitMarker);
 const markerCore=new THREE.Mesh(new THREE.SphereGeometry(.017,12,8),new THREE.MeshBasicMaterial({color:0xa6eaff,toneMapped:false}));
 const markerGlow=new THREE.Mesh(new THREE.SphereGeometry(.037,12,8),new THREE.MeshBasicMaterial({color:0x168bff,transparent:true,opacity:.12,depthTest:true,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending}));
 markerGlow.renderOrder=3;orbitMarker.add(markerCore,markerGlow);
 let orbitPhase=1.05;const placeMarker=()=>orbitMarker.position.set(Math.cos(orbitPhase)*orbitRadius,Math.sin(orbitPhase)*orbitRadius,0);placeMarker();
 const ambient=new THREE.AmbientLight(0xffffff,.10);scene.add(ambient);const sun=new THREE.DirectionalLight(0xfff8f0,3.1);sun.position.set(-3,1.8,2.7);scene.add(sun);const fill=new THREE.DirectionalLight(0xabc4e0,.08);fill.position.set(4,-1,3);scene.add(fill);
 let seed=789;const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);const positions=[];for(let i=0;i<380;i++){positions.push((rand()-.5)*18,(rand()-.5)*14,-4-rand()*7)}const starsGeo=new THREE.BufferGeometry();starsGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));scene.add(new THREE.Points(starsGeo,new THREE.PointsMaterial({color:0xcddfff,size:.018,transparent:true,opacity:.65})));
 let paused=reduced.matches,frame=null,previous=0,drag=false,lastX=0,lastY=0,visible=true,pointer=null,zoomDistance=5.8,targetDistance=5.8,resumeAt=0,dirty=false,scrolling=false,scrollTimer=null;
 function fitCamera(){camera.position.z=zoomDistance*Math.max(1,1/camera.aspect)}
 let width=0,height=0,dpr=0;
 function resize(){if(disposed)return;const w=host.clientWidth,h=host.clientHeight,p=pixelRatio();if(w<1||h<1||(w===width&&h===height&&p===dpr))return;width=w;height=h;dpr=p;camera.aspect=w/h;fitCamera();camera.updateProjectionMatrix();renderer.setPixelRatio(p);renderer.setSize(w,h,false);draw()}
 function draw(){if(disposed||!initialized||!surfaceReady||!visible||scrolling||document.hidden)return;renderer.render(scene,camera);dirty=false}
 function requestDraw(){dirty=true;schedule()}
 const isZooming=()=>Math.abs(targetDistance-zoomDistance)>.001;
 function schedule(){if(initialized&&surfaceReady&&!disposed&&visible&&!scrolling&&!document.hidden&&(dirty||!paused||isZooming())&&frame===null)frame=requestAnimationFrame(animate)}
 function animate(t){
  frame=null;if(disposed||!visible||document.hidden)return;
  if(!previous)previous=t;
  // Zoom gets up to 60 fps; quiet background rotation stays capped near 30.
  const zooming=isZooming(),interval=zooming?1000/60:1000/30;
  if(dirty||t-previous>=interval){
   const dt=Math.min((t-previous)/1000,.05);previous=t;
   if(zooming){zoomDistance+=(targetDistance-zoomDistance)*(1-Math.exp(-10*dt));if(!isZooming())zoomDistance=targetDistance;fitCamera()}
   if(!paused&&!drag&&pointer===null&&t>=resumeAt){if(lab)lab.tick(dt);else{sphere.rotation.y+=dt*.06;orbitPhase=(orbitPhase+dt*.075)%(Math.PI*2);placeMarker()}}
   draw();
  }
  schedule();
 }
 function stop(){if(frame!==null)cancelAnimationFrame(frame);frame=null;previous=0}
 const visibility=()=>{if(document.hidden)stop();else schedule()};
 document.addEventListener('visibilitychange',visibility);
 // Let native touch scrolling use the frame budget. Resume without a time jump.
 const onScroll=()=>{if(!compact)return;scrolling=true;stop();clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{scrolling=false;requestDraw()},160)};
 window.addEventListener('scroll',onScroll,{passive:true});
 const intersection=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)schedule();else stop()});intersection.observe(host);
 const observer=new ResizeObserver(resize);observer.observe(host);
 // One finger (or the mouse) rotates and glides to a stop; two fingers pinch to zoom.
 // The stage no longer scrolls the page (touch-action: none); the lanes beside it do.
 const gestures=attachOrbitGestures(host,{
  reducedMotion:()=>reduced.matches,
  start(){drag=true},
  rotate(dx,dy,type){const touch=type!=='mouse';group.rotation.y+=dx*(touch?.0105:.007);group.rotation.x=THREE.MathUtils.clamp(group.rotation.x+dy*(touch?.006:.004),-.7,.7);requestDraw()},
  zoom(ratio){targetDistance=THREE.MathUtils.clamp(targetDistance+ratio*4,4.3,7.8);moveCamera()},
  end(){drag=false;resumeAt=performance.now()+1400}
 });
 function moveCamera(){if(reduced.matches){zoomDistance=targetDistance;fitCamera();draw()}else schedule()}
 function disposeTree(root){
  const geometry=new Set(),materials=new Set();root.traverse(obj=>{if(obj.geometry)geometry.add(obj.geometry);if(obj.material)(Array.isArray(obj.material)?obj.material:[obj.material]).forEach(m=>materials.add(m))});
  geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
 }
 async function setWorld(next){
  if(disposed||!['Earth','Moon','Mars','Microgravity'].includes(next)||requestedWorld===next)return;
  requestedWorld=next;const ticket=++selection;
  fade?.cancel();fade=null;renderer.domElement.style.opacity='1';
  host.dataset.requestedWorld=next;
  // Keep the last complete planet visible while a new surface is being prepared.
  status.style.top=surfaceReady?'auto':'40%';status.style.bottom=surfaceReady?'8px':'auto';
  showStatus(`Preparing ${next}…`);
  try{
   const record=await prepare(next);
   if(disposed||ticket!==selection)return;
   if(surfaceReady&&!reduced.matches){
    fade=renderer.domElement.animate([{opacity:1},{opacity:0}],{duration:100,fill:'forwards',easing:'ease-out'});
    await fade.finished.catch(()=>{});
    if(disposed||ticket!==selection)return;
   }
   if(active)group.remove(active.root);
   active=record;lab=record.lab;sphere=record.sphere;world=next;group.add(record.root);
   group.rotation.z=lab?0:.15;orbit.visible=!lab;
   ambient.intensity=next==='Moon'?.065:.10;fill.color.set(next==='Mars'?0xd49670:0xabc4e0);
   surfaceReady=true;host.dataset.globeWorld=next;host.dataset.globeState='ready';host.setAttribute('aria-busy','false');status.remove();
   renderer.domElement.style.visibility='visible';fade?.cancel();
   draw();requestDraw();
   if(!reduced.matches)fade=renderer.domElement.animate([{opacity:0},{opacity:1}],{duration:180,easing:'ease-out'});
  }catch(error){
   if(disposed||ticket!==selection)return;
   requestedWorld=null;showStatus(`${next} imagery could not load. Research data is still available.`,'error',()=>setWorld(next));
   console.warn('Planet preparation:',error);
  }
 }
 const onMotion=()=>{paused=reduced.matches;if(reduced.matches)fade?.finish();stop();moveCamera();draw();host.dispatchEvent(new CustomEvent('rotationchange',{detail:paused}))};reduced.addEventListener('change',onMotion);initialized=true;resize();setWorld(world);
 return {setWorld,get paused(){return paused},set paused(value){paused=!!value;stop();schedule();draw()},zoom(amount){if(!Number.isFinite(amount))return;targetDistance=THREE.MathUtils.clamp(targetDistance+amount,4.3,7.8);moveCamera()},reset(){gestures.stop();group.rotation.set(0,0,lab?0:.15);lab?.reset();targetDistance=5.8;moveCamera();draw()},dispose(){
  if(disposed)return;disposed=true;++selection;fade?.cancel();stop();clearTimeout(scrollTimer);window.removeEventListener('scroll',onScroll);observer.disconnect();intersection.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',onMotion);gestures.dispose();
  if(active)group.remove(active.root);worlds.forEach(record=>disposeTree(record.root));disposeTree(scene);textures.forEach(entry=>entry.texture.dispose());renderer.dispose();renderer.forceContextLoss();
 }};
}
