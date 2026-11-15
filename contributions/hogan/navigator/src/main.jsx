import React,{useEffect,useMemo,useRef,useState} from 'react';
import {AnimatePresence,LayoutGroup,MotionConfig,motion} from 'motion/react';
import {AssistantRuntimeProvider,useLocalRuntime} from '@assistant-ui/react';
import bundle from '../../research/soraine-information.json';
import {PROMPT,SOURCE_URL,PDF_URL,buildComparison,routeCommand,makeSceneSelection,parseSceneSelection} from './research.mjs';
import Orb from './Orb.jsx';
import './styles.css';

const results=buildComparison(bundle);
const ease=[.22,1,.36,1];
const glide={duration:.6,ease};
function useSystemReducedMotion(){
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{const query=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
  return reduced;
}
function Icon({name,...props}) {
  const paths={arrow:<><path d="M5 12h14m-6-6 6 6-6 6"/></>,close:<path d="m6 6 12 12M6 18 18 6"/>,spark:<><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z"/></>,grid:<><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="3" width="6" height="6" rx="1"/><rect x="3" y="15" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/></>,book:<><path d="M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4Z"/><path d="M12 6v15"/></>,external:<><path d="M13 4h7v7m0-7L10 14M9 5H4v15h15v-5"/></>,back:<path d="m11 5-7 7 7 7M4 12h16"/>,wave:<><path d="M3 12h2l2-6 3 12 4-13 3 14 2-7h2"/></>,check:<path d="m5 12 4 4L19 6"/>,download:<><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/></>};
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]||paths.spark}</svg>;
}

export function ResearchNavigator({onReturnToScene}={}){
  const [screen,setScreen]=useState('home'),[selected,setSelected]=useState(null),[notice,setNotice]=useState(''),[still,setStill]=useState(false),[input,setInput]=useState('');
  const [sceneContext,setSceneContext]=useState(null);
  const systemReduced=useSystemReducedMotion(),quiet=still||systemReduced;
  const inputRef=useRef(null),returnFocus=useRef(null);
  const adapter=useMemo(()=>({async run({messages}){
    const message=[...messages].reverse().find(m=>m.role==='user');
    const text=message?.content.filter(p=>p.type==='text').map(p=>p.text).join(' ')||'';
    const route=routeCommand(text);
    if(route==='home'){setSelected(null);setScreen('home');setNotice('');}
    else if(route==='unsupported')setNotice('This preview explores Ultem on the Moon and Mars. Try the suggested comparison or ask for its source.');
    else {setNotice('');setScreen('compare');if(route==='source'){returnFocus.current=document.activeElement;setSelected('moon');}}
    return {content:[{type:'text',text:route==='unsupported'?'Try the Ultem Moon and Mars comparison.':'Opened the published Ultem comparison.'}]};
  }}),[]);
  const runtime=useLocalRuntime(adapter);
  const reset=()=>{setSelected(null);setScreen('home');setNotice('');setInput('');};
  const send=(text)=>{
    if(!text.trim())return;
    runtime.thread.append({role:'user',content:[{type:'text',text:text.trim()}]});
    setInput('');
  };
  const open=(id)=>{returnFocus.current=document.activeElement;setSelected(id);};
  const close=()=>{setSelected(null);requestAnimationFrame(()=>{if(returnFocus.current?.isConnected)returnFocus.current.focus();else inputRef.current?.focus();});};
  useEffect(()=>{
    const onKey=e=>{if((e.ctrlKey||e.metaKey)&&e.key==='k'&&!selected){e.preventDefault();inputRef.current?.focus();}if(e.key==='Escape'&&selected)close();};
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[selected]);
  useEffect(()=>{
    const inspect=selection=>{
      const valid=parseSceneSelection(selection);
      if(!valid){setNotice('This preview currently opens the Ultem film sample on the Moon or Mars.');return;}
      setSceneContext(valid);setScreen('compare');setSelected(valid.sceneId);setNotice('');
    };
    const event=e=>inspect(e.detail);
    const message=e=>{if(e.source===window.parent&&e.origin===location.origin&&e.data?.type==='soraine:inspect')inspect(e.data.selection);};
    window.addEventListener('soraine:inspect',event);window.addEventListener('message',message);
    if(window.parent!==window)window.parent.postMessage({type:'soraine:ready'},location.origin);
    const params=new URLSearchParams(location.search);
    if(params.get('sceneId'))inspect({objectId:params.get('objectId')||'sample-ultem',sceneId:params.get('sceneId'),atmosphereId:params.get('atmosphereId')||undefined});
    return()=>{window.removeEventListener('soraine:inspect',event);window.removeEventListener('message',message);};
  },[]);
  const active=screen==='compare';
  return <AssistantRuntimeProvider runtime={runtime}><MotionConfig reducedMotion={quiet?'always':'never'} transition={quiet?{duration:0}:glide}><LayoutGroup>
    <div className={`app ${active?'is-comparing':''} ${quiet?'quiet':''}`}>
      <div className="ambient" aria-hidden="true"/><div className="starfield" aria-hidden="true"/>
      <aside className="rail" aria-label="Main navigation" inert={selected?true:undefined}>
        <button className="brand-symbol" onClick={reset} aria-label="Soraine home"><span>✦</span></button>
        <div className="rail-links"><button className={!active?'rail-button selected':'rail-button'} onClick={reset} aria-label="Navigator home" title="Navigator"><Icon name="spark"/></button><button className={active?'rail-button selected':'rail-button'} onClick={()=>send(PROMPT)} aria-label="Ultem comparison" title="Ultem comparison"><Icon name="grid"/></button><button className="rail-button" onClick={()=>{setScreen('compare');open('moon');}} aria-label="Research source" title="Research source"><Icon name="book"/></button></div>
        <button className={`rail-button motion-toggle ${quiet?'toggled':''}`} onClick={()=>setStill(!still)} aria-label={systemReduced?'Reduced motion follows your system setting':still?'Enable motion':'Reduce motion'} aria-pressed={quiet} title={quiet?'Reduced motion':'Reduce motion'} disabled={systemReduced}><Icon name="wave"/></button>
      </aside>
      <div className="workspace" inert={selected?true:undefined}>
        <header className="topbar"><button className="wordmark" onClick={reset}>soraine<span> / </span><small>RESEARCH NAVIGATOR</small></button><div className="top-right"><span className="connection"><i/>Local research</span><span className="demo-tag">PROTOTYPE 01</span></div></header>
        <main>
          <AnimatePresence mode="popLayout" initial={false}>
            {!active?<motion.section key="home" className="landing" exit={{opacity:0,y:quiet?0:-18,filter:quiet?'none':'blur(3px)'}} transition={{duration:.28}} aria-labelledby="home-title">
              <div className="orb-scene"><div className="orb-side orb-side-left"><span>{bundle.evidence_records.length}</span>evidence records<div/></div><Orb quiet={quiet}/><div className="orb-side orb-side-right"><span>{Object.keys(bundle.sources).length}</span>linked sources<div/></div></div>
              <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} className="hero-copy"><p className="eyebrow">A SMALL SPARK. A BIGGER QUESTION.</p><h1 id="home-title">Follow the evidence.</h1><p>From a material to a world of possibilities.<br/>Explore how fire behaves beyond Earth.</p></motion.div>
              <motion.div layoutId="command-shell" className="command-shell home-command"><Command input={input} setInput={setInput} inputRef={inputRef} send={send}/></motion.div>
              <button className="suggestion" onClick={()=>send(PROMPT)}><span className="tiny-orbit"/><span>Ultem · Moon vs Mars</span><Icon name="arrow" width="16" height="16"/></button>
              <p className="demo-caption">A guided comparison, grounded in the team’s research.</p>
            </motion.section>:<motion.section key="comparison" className="comparison" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0,y:quiet?0:14}} aria-labelledby="comparison-title">
              <div className="comparison-heading"><div className="assistant-anchor"><Orb small quiet={quiet}/><div><p className="eyebrow">YOUR RESEARCH, IN CONTEXT</p><h1 id="comparison-title">One material. Two worlds.</h1></div></div><button className="text-button reset" onClick={reset}><Icon name="back" width="16"/>Start again</button></div>
              <motion.div className="answer" initial={{opacity:0,y:quiet?0:12}} animate={{opacity:1,y:0}} transition={{...glide,delay:.15}}><span className="answer-marker"/><p><strong>Ultem 1000 behaves differently at these gravity levels.</strong> Compare the oxygen endpoints from the same published test series.</p><span className="citation-pill">Table I · p. 6</span></motion.div>
              <div className="comparison-meta"><span>ULTEM 1000 <span className="muted">/ PEI FILM</span></span><span>0.254 mm film<span className="divider-dot">·</span>70.3 kPa absolute<span className="divider-dot">·</span>5.18 s drop</span></div>
              <div className="cards">{results.map((item,i)=><EvidenceCard key={item.id} item={item} index={i} open={()=>open(item.id)} quiet={quiet}/>)}</div>
              <motion.div className="takeaway" initial={{opacity:0,y:quiet?0:10}} animate={{opacity:1,y:0}} transition={{...glide,delay:.4}}><div className="takeaway-mark"><Icon name="spark"/></div><p><strong>A one-point difference.</strong> The lowest tested oxygen concentration with flame survival was 1 percentage point lower in the Moon test. These short-drop results are not habitat safety limits.</p><button className="text-button" onClick={()=>open('moon')}>Read the method<Icon name="arrow" width="16"/></button></motion.div>
              <motion.div layoutId="command-shell" className="command-shell docked-command"><Command input={input} setInput={setInput} inputRef={inputRef} send={send} active/></motion.div>
              <p className="dock-caption">Published endpoints · No continuous fire prediction</p>
            </motion.section>}
          </AnimatePresence>
          <div role="status" aria-live="polite" className={`notice ${notice?'visible':''}`}>{notice}</div>
        </main>
        <footer><span>FLAME IN FREEFALL<span className="footer-separator">/</span>NASA SPACE APPS</span><span><i/>Hogan · Ethan · Tony research</span></footer>
      </div>
      <AnimatePresence>{selected&&<Detail key={selected} item={results.find(r=>r.id===selected)} close={close} quiet={quiet} onReturnToScene={onReturnToScene} sceneContext={sceneContext}/>}</AnimatePresence>
    </div>
  </LayoutGroup></MotionConfig></AssistantRuntimeProvider>;
}

function Command({input,setInput,inputRef,send,active=false}){
  return <form className="command" onSubmit={e=>{e.preventDefault();send(input);}}><Icon name="spark"/><label className="sr-only" htmlFor={active?'command-active':'command-home'}>Ask about the Ultem comparison</label><input ref={inputRef} id={active?'command-active':'command-home'} value={input} onChange={e=>setInput(e.target.value)} placeholder={active?'Ask for the source, or explore Ultem again…':'What would you like to explore?'} autoComplete="off"/><kbd>Ctrl K</kbd><button type="submit" className="send-button" disabled={!input.trim()} aria-label="Send question"><Icon name="arrow"/></button></form>;
}

function Planet({id}){return <div className={`planet planet-${id}`} aria-hidden="true"><span/><i/><b/></div>;}

function EvidenceCard({item,index,open,quiet}){
  return <motion.article layoutId={`card-${item.id}`} className={`evidence-card ${item.id}`} style={{borderRadius:22}} initial={{opacity:0,y:quiet?0:32,filter:quiet?'none':'blur(3px)'}} animate={{opacity:1,y:0,filter:'blur(0px)'}} transition={{...glide,delay:.16+index*.10}}>
    <motion.div layout="position" className="card-header"><div><p className="eyebrow">{index===0?'01 / LUNAR':'02 / MARTIAN'} GRAVITY</p><h2>{item.name}<span>{item.gravity} g</span></h2></div><Planet id={item.id}/></motion.div>
    <motion.div layout="position" className="primary-value"><span>{item.survived.value}<em>%</em></span><div>OXYGEN<br/><b>ULOI*</b></div></motion.div>
    <p className="endpoint-description">Lowest tested oxygen with flame survival</p>
    <EndpointPlot item={item}/>
    <div className="secondary-value"><span><i/>Extinguished during drop <small>MOC*</small></span><strong>{item.extinguished.value}% <small>O₂</small></strong></div>
    <div className="card-footer"><span><i/>Published test</span><button onClick={open} aria-label={`Explore ${item.name} evidence`}>Explore evidence<Icon name="arrow" width="16" height="16"/></button></div>
  </motion.article>;
}

function EndpointPlot({item}){
  const x=v=>22+(v-19)/5*356;
  return <div className="endpoint-plot"><svg viewBox="0 0 400 70" role="img" aria-label={`${item.name}: extinction endpoint ${item.extinguished.value} percent oxygen; survival endpoint ${item.survived.value} percent. Shared axis 19 to 24 percent oxygen.`}><line x1="22" x2="378" y1="23" y2="23" className="axis"/>{[19,20,21,22,23,24].map(v=><g key={v}><line x1={x(v)} x2={x(v)} y1="19" y2="27" className="tick"/><text x={x(v)} y="54" textAnchor="middle">{v}%</text></g>)}<circle cx={x(item.extinguished.value)} cy="23" r="5" className="endpoint-empty"/><circle cx={x(item.survived.value)} cy="23" r="12" className="endpoint-glow"/><circle cx={x(item.survived.value)} cy="23" r="5" className="endpoint-solid"/></svg></div>;
}

function Detail({item,close,quiet,onReturnToScene,sceneContext}){
  const modal=useRef(null),[copied,setCopied]=useState(false);
  useEffect(()=>{
    modal.current?.focus();
    const trap=e=>{if(e.key!=='Tab')return;const els=modal.current?.querySelectorAll('button,a[href]');if(!els?.length)return;const first=els[0],last=els[els.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===modal.current)){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}};
    const node=modal.current;node?.addEventListener('keydown',trap);const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{node?.removeEventListener('keydown',trap);document.body.style.overflow=previous;};
  },[]);
  const exportEvidence=()=>{
    const evidence={selection:makeSceneSelection(item.id,sceneContext||{}),records:bundle.evidence_records.filter(r=>item.evidenceIds.includes(r.id)),source:item.source};
    const url=URL.createObjectURL(new Blob([JSON.stringify(evidence,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`soraine-ultem-${item.id}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setCopied(true);
  };
  return <motion.div className="detail-overlay" initial={{backgroundColor:'rgba(3,6,12,0)'}} animate={{backgroundColor:'rgba(3,6,12,.84)'}} exit={{backgroundColor:'rgba(3,6,12,0)'}} onClick={close}>
    <motion.section layoutId={`card-${item.id}`} className={`detail-card ${item.id}`} style={{borderRadius:24}} role="dialog" aria-modal="true" aria-labelledby="detail-title" tabIndex={-1} ref={modal} onClick={e=>e.stopPropagation()} transition={{duration:quiet?0:.5,ease}}>
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.2,delay:.15}}>
        <div className="detail-top"><span className="eyebrow">THE EVIDENCE / {item.name.toUpperCase()}</span><button className="close-button" onClick={close} aria-label="Close evidence"><Icon name="close"/></button></div>
        <div className="detail-heading"><div><h2 id="detail-title">Behind the number.</h2><p>Ultem 1000 · {item.gravity} g nominal · Published test endpoints</p></div><Planet id={item.id}/></div>
        <div className="detail-stats"><div><span>{item.survived.value}<em>% O₂</em></span><strong>Flame survived the drop <small>ULOI*</small></strong><p>{item.survived.explanation}</p></div><div><span>{item.extinguished.value}<em>% O₂</em></span><strong>Flame went out during the drop <small>MOC*</small></strong><p>{item.extinguished.explanation}</p></div></div>
        <div className="conditions"><div><span>CHAMBER PRESSURE</span><strong>{item.pressure.toFixed(1)} kPa</strong><small>{item.pressurePsia} psia, absolute</small></div><div><span>FILM THICKNESS</span><strong>{item.thickness} mm</strong><small>10 mil PEI film</small></div><div><span>TEST WINDOW</span><strong>{item.duration} seconds</strong><small>Drop-tower centrifuge</small></div></div>
        <div className="method-note"><Icon name="spark"/><p>The asterisk marks the short-drop method. These tests follow an already-ignited sample; oxygen alone does not start a fire. Survival during the drop does not establish indefinite burning or a safe cabin limit. Forced airflow was not reported.</p></div>
        <a className="source-card" href={PDF_URL} target="_blank" rel="noreferrer"><span className="source-icon"><Icon name="book"/></span><div><span>NASA TECHNICAL REPORTS SERVER <b>Table I · p. 6</b></span><h3>Evaluating Material Flammability in Microgravity and Martian Gravity Compared to the NASA Standard Normal Gravity Test</h3><p>Open the original paper</p></div><Icon name="external"/></a>
        <div className="detail-actions"><a className="text-button" href={SOURCE_URL} target="_blank" rel="noreferrer">Source record<Icon name="external" width="15"/></a><button className="text-button" onClick={exportEvidence}><Icon name={copied?'check':'download'} width="16"/>{copied?'Evidence downloaded':'Download evidence'}</button>{(onReturnToScene||window.parent!==window)&&<button className="text-button" onClick={()=>{const selection=makeSceneSelection(item.id,sceneContext||{});onReturnToScene?.(selection);window.dispatchEvent(new CustomEvent('soraine:return-to-scene',{detail:selection}));if(window.parent!==window)window.parent.postMessage({type:'soraine:return-to-scene',selection},location.origin);}}>Return to {item.name} scene</button>}<button className="pill-button" onClick={close}>Back to comparison<Icon name="arrow" width="16"/></button></div>
      </motion.div>
    </motion.section>
  </motion.div>;
}
