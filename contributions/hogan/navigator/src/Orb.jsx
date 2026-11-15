import React,{useEffect,useRef,useState} from 'react';
import {motion} from 'motion/react';

// A local Higgsfield loop with an original, bounded procedural canvas fallback.
export default function Orb({small=false,quiet=false}) {
  const canvas=useRef(null),video=useRef(null);
  const [mediaReady,setMediaReady]=useState(false),[mediaFailed,setMediaFailed]=useState(false);
  const showMedia=mediaReady&&!mediaFailed;
  useEffect(()=>{
    const node=video.current;if(!node||quiet||mediaFailed)return;
    const play=()=>{if(document.hidden)node.pause();else node.play().catch(()=>setMediaFailed(true));};
    play();document.addEventListener('visibilitychange',play);
    return()=>{document.removeEventListener('visibilitychange',play);node.pause();};
  },[quiet,mediaFailed]);
  useEffect(()=>{
    if(showMedia)return;
    const el=canvas.current, ctx=el.getContext('2d');
    if(!ctx) return;
    const size=360, dpr=Math.min(devicePixelRatio||1,1.5);
    el.width=size*dpr; el.height=size*dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    let frame, last=0;
    const draw=(timestamp)=>{
      if(document.hidden){frame=requestAnimationFrame(draw);return;}
      if(!quiet && timestamp-last<30){frame=requestAnimationFrame(draw);return;}
      last=timestamp;
      const t=quiet?1:timestamp*.00016, cx=180,cy=180,r=114;
      ctx.clearRect(0,0,size,size);
      const halo=ctx.createRadialGradient(cx,cy,65,cx,cy,165);
      halo.addColorStop(0,'rgba(31,80,142,.14)');halo.addColorStop(.68,'rgba(16,108,151,.10)');halo.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=halo;ctx.fillRect(0,0,size,size);
      const body=ctx.createRadialGradient(145,143,12,cx,cy,115);
      body.addColorStop(0,'#0e2038');body.addColorStop(.7,'#091222');body.addColorStop(.96,'#153e59');body.addColorStop(1,'#307591');
      ctx.fillStyle=body;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
      const project=(lat,lon,dist)=>{
        let x=Math.cos(lat)*Math.cos(lon)*dist,y=Math.sin(lat)*dist,z=Math.cos(lat)*Math.sin(lon)*dist;
        const yaw=t*.48, a=x*Math.cos(yaw)-z*Math.sin(yaw);z=x*Math.sin(yaw)+z*Math.cos(yaw);x=a;
        const pitch=.42, b=y*Math.cos(pitch)-z*Math.sin(pitch);z=y*Math.sin(pitch)+z*Math.cos(pitch);y=b;
        const tilt=-.45;return [cx+x*Math.cos(tilt)-y*Math.sin(tilt),cy+x*Math.sin(tilt)+y*Math.cos(tilt),z];
      };
      ctx.globalCompositeOperation='lighter';
      for(let i=0;i<39;i++){
        const lat=-1.46+i*2.92/38;
        ctx.beginPath();
        for(let j=0;j<=112;j++){
          const lon=j*Math.PI*2/112;
          const wave=Math.sin(lon*4+t*2+i*.24)*.036+Math.cos(lon*3-t+i*.19)*.025;
          const p=project(lat+wave,lon,r+2*Math.sin(lon*5+t+i*.38));
          if(j===0)ctx.moveTo(p[0],p[1]);else ctx.lineTo(p[0],p[1]);
        }
        const mix=i/38;
        ctx.strokeStyle=`rgba(${Math.round(72+mix*31)},${Math.round(133+mix*92)},255,${.2+Math.sin(mix*Math.PI)*.2})`;
        ctx.lineWidth=.65;ctx.stroke();
      }
      for(let i=0;i<420;i++){
        const lat=Math.asin(-1+2*(i+.5)/420),lon=i*2.399963+t;
        const p=project(lat,lon,r+2.4*Math.sin(i+t*3));
        if(p[2]<-20)continue;
        ctx.fillStyle=`rgba(154,235,255,${.14+(p[2]/r+1)*.27})`;
        ctx.beginPath();ctx.arc(p[0],p[1],p[2]>75?1.05:.65,0,Math.PI*2);ctx.fill();
      }
      ctx.globalCompositeOperation='source-over';
      if(!quiet)frame=requestAnimationFrame(draw);
    };
    frame=requestAnimationFrame(draw);
    return ()=>cancelAnimationFrame(frame);
  },[quiet,showMedia]);
  const ready=()=>setMediaReady(true),failed=()=>setMediaFailed(true);
  return <motion.div layoutId="navigator-orb" transition={{duration:quiet?0:.75,ease:[.22,1,.36,1]}} className={`orb ${small?'orb-small':''} ${showMedia?'orb-cinematic':''}`} aria-hidden="true">
    <div className="orb-aura"/><canvas ref={canvas} style={{opacity:showMedia?0:1}}/>
    {!mediaFailed&&(quiet?<img className="orb-media" src={`${import.meta.env.BASE_URL}media/orb-poster.jpg`} alt="" onLoad={ready} onError={failed}/>:<video ref={video} className="orb-media" src={`${import.meta.env.BASE_URL}media/orb-loop.mp4`} poster={`${import.meta.env.BASE_URL}media/orb-poster.jpg`} autoPlay loop muted playsInline preload="auto" onLoadedData={ready} onError={failed}/>)}
    {!showMedia&&<><div className="orb-orbit orbit-one"/><div className="orb-orbit orbit-two"/></>}
  </motion.div>;
}
