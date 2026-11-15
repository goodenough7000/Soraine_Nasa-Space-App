import {readingSummary,comparisonContext} from './reading.mjs';
import {sourcesByResults} from './discovery.mjs';
import {term,initGlossary,definitions} from './glossary.mjs';
import {originalDataHTML,mountOriginalData} from './original-data.mjs';
import {specimenHTML} from './specimen.mjs';
initGlossary();
import {WORLDS,COLORS,TYPES,MATERIALS,number,esc,safeUrl,joinResearch,getLimits,filterRows,csv,comparisonRows} from './data.mjs';
const paths={polymer:'M5 7 12 3l7 4v10l-7 4-7-4V7m0 0 7 4 7-4m-7 4v10',film:'M6 3h9l4 4v14H6V3m9 0v5h4M3 7v14',fabric:'M4 4h16v16H4V4m4 0v16m4-16v16m4-16v16M4 8h16M4 12h16M4 16h16',orbit:'M21 12a9 9 0 1 1-9-9M3 20 20 3M16 3h5v5',grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',chart:'M4 19V5m0 14h17M8 15v-4m5 4V7m5 8V3',layers:'m12 3 9 5-9 5-9-5 9-5m-9 9 9 5 9-5M3 16l9 5 9-5',book:'M3 4h6q3 0 3 3v14q0-3-3-3H3V4m18 0h-6q-3 0-3 3v14q0-3 3-3h6V4',info:'M12 10v7m0-10v.1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',download:'M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4',search:'M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',arrow:'M4 12h16m-6-6 6 6-6 6',external:'M14 3h7v7m-10 3L21 3M10 3H3v18h18v-7',flame:'M13 2c1 8-8 7-8 14a7 7 0 0 0 14 0c0-4-2-7-5-9 1 5-4 5-1-5',pause:'M8 5v14M16 5v14',play:'m8 4 12 8-12 8V4',reset:'M3 10a9 9 0 1 1 1 8M3 4v6h6',database:'M21 5c0 2-4 3-9 3S3 7 3 5s4-3 9-3 9 1 9 3M3 5v14c0 2 4 3 9 3s9-1 9-3V5M3 12c0 2 4 3 9 3s9-1 9-3'};
const icon=(name)=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name]||paths.orbit}"/></svg>`;
document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));
document.querySelectorAll('.main-nav button').forEach(button=>{button.innerHTML=icon({overview:'grid',experiments:'database',compare:'chart',evidence:'layers',sources:'book'}[button.dataset.view])+'<span>'+button.textContent+'</span>'});
document.querySelector('#export-all').setAttribute('aria-label','Export all research data');
function labelTableCells(){document.querySelectorAll('.data-table,.mini-table').forEach(table=>{const labels=[...table.querySelectorAll('thead th')].map(th=>th.textContent);table.querySelectorAll('tbody tr').forEach(row=>[...row.cells].forEach((cell,index)=>cell.dataset.label=labels[index]||''))})}
const view=document.querySelector('#view'),dialog=document.querySelector('#detail-dialog');
const VIEWS=['overview','experiments','compare','evidence','sources'];
const state={view:'overview',world:'Earth',material:'Ultem 1000',query:'',filterWorld:'All',filterMaterial:'All',filterKind:'All',page:0,sourceQuery:'',sourceType:'All',sourcePage:0,originalDataset:'',originalQuery:''};
const worldInfo={Moon:{title:'Lunar gravity',g:'0.16',sub:'Nominal lunar category',name:'The Moon',caption:'A different gravity. A different combustion story.'},Mars:{title:'Martian gravity',g:'0.38',sub:'Nominal Martian category',name:'Mars',caption:'Compare the evidence before the next frontier.'},Earth:{title:'Earth gravity',g:'1.00',sub:'Normal-gravity reference',name:'Earth',caption:'The familiar baseline. Not the whole picture.'},Microgravity:{title:'Orbital laboratory',g:'≈ 0',sub:'Free-fall environment',name:'Microgravity',caption:'Inside an orbiting habitat, objects fall together.'}};
let bundle,rows,globe,globeWorld,renderSequence=0,toastTimer,originalDataCleanup,materialView;
function toast(text){const el=document.querySelector('#toast');el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2600)}
function download(content,name,type='application/json'){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Export ready');}
function sampleText(value){return esc(value).replace(/\b(PEI|PET|PMMA)\b/g,key=>term(key));}
function materialDescription(material){return ({'Ultem 1000':'Polyetherimide (PEI), tested here as a thin polymer film.','Mylar G':'Polyethylene terephthalate (PET), a polyester film.','Nomex HT90-40':'An aramid fabric, tested here as a thin woven specimen.'})[material]||'';}
function unitLabel(value){const key={'O2 molar percent':'oxygen','O2 percentage points':'pp','cm/s':'cmps'}[value];return key?term(key,value):esc(value);}
function evidenceLabel(row){const key={reported_experimental_limit_aggregate:'published',reported_fit_to_experimental_data:'fitted',reported_experimental_summary:'summary',source_derived_from_limit_aggregates:'derived',model_derived_compensation_from_experiments:'model'}[row.evidence_type];return key?term(key,row.kind.name):esc(row.kind.name);}
function fieldLabel(label){const key={'Test pressure':'kPa',Oxygen:'oxygen',Airflow:'airflow'}[label];return key?term(key,label):esc(label);}
function materialPanel(){return `<section class="panel material-panel"><div class="panel-head">Oxygen-limit comparison<span class="tiny">2012 study</span></div><div class="material-list">${MATERIALS.map((m,i)=>`<button data-material="${esc(m)}" class="${state.material===m?'active':''}" aria-pressed="${state.material===m}"><span class="sample-mark">${icon(['polymer','film','fabric'][i])}</span>${esc(m)}<span class="count">${rows.filter(r=>r.experiment.material===m).length}</span></button>`).join('')}</div><button class="material-library-link text-link" data-browse-materials="true">Browse all reported materials ${icon('arrow')}</button></section>`}
function chart(large=false){
 const entries=comparisonRows(rows,state.material);
 return `<div class="limit-chart ${large?'limit-chart-large':''}" aria-label="Published oxygen limits for ${esc(state.material)}. Separate experimental observations.">
 <div class="limit-chart-head"><span>Gravity / pressure</span><div class="limit-scale">${[0,10,20,30].map(n=>`<span>${n}</span>`).join('')}</div><span>${term('ULOI','ULOI / *')}</span><span>${term('MOC','MOC / *')}</span></div>
 ${entries.map(({world,uloi,moc})=>`<button class="limit-row ${world===state.world?'selected':''}" data-record="${esc(uloi?.measurement_id||moc?.measurement_id)}" aria-label="Open ${world} ${state.material} oxygen-limit source">
 <span class="limit-world"><i class="world-glyph world-${world.toLowerCase()}" aria-hidden="true"></i><span>${world==='Microgravity'?'Micro-g':world}<small>${number(uloi?.experiment.pressure_kpa)} kPa</small></span></span>
 <span class="limit-track" aria-hidden="true">${[0,1,2,3].map(n=>`<i class="limit-tick" style="left:${n/3*100}%"></i>`).join('')}${[[uloi,'uloi'],[moc,'moc']].map(([r,kind])=>r?`<i class="limit-point ${kind}" style="left:${Math.min(100,Math.max(0,Number(r.value)/30*100))}%"></i>`:'').join('')}</span>
 <span class="limit-number uloi">${uloi?number(uloi.value):'—'}<small>%</small></span><span class="limit-number moc">${moc?number(moc.value):'—'}<small>%</small></span>
 </button>`).join('')}<div class="limit-chart-foot"><span>Oxygen concentration (%) · each point is a reported limit</span><span>Tap a row for its source ↗</span></div></div>`;
}
function chartPanel(large=false){return `<section class="panel chart-panel"><div class="panel-head"><span>How the reported limits compare</span><span class="tiny">${esc(state.material)}</span></div><div class="legend"><span><i style="background:#36a7ff"></i>${term('ULOI')} / ${term('ULOI*')}</span><span><i style="background:#b7d9ff"></i>${term('MOC')} / ${term('MOC*')}</span></div>${chart(large)}<p class="chart-note">${term('asterisk','*')} Starred low-g limits use short-duration flame survival or extinction. Earth tests use different burn criteria. <a href="https://ntrs.nasa.gov/citations/20130010991" target="_blank" rel="noopener noreferrer">Table I, p. 6 ↗</a></p></section>`}
function overview(){
 const info=worldInfo[state.world],limits=getLimits(rows,state.material,state.world),exp=limits.uloi?.experiment;
 return `<div class="mission-overview"><div class="mission-toolbar"><span class="label">01 / Choose an environment</span><div class="world-picker" aria-label="Gravity context">${['Earth','Microgravity','Moon','Mars'].map((w,i)=>`<button data-world="${w}" class="${state.world===w?'active':''}" aria-pressed="${state.world===w}" aria-label="${w}"><span class="world-index">0${i+1}</span>${w==='Microgravity'?'Micro-g':w}<span class="world-indicator"></span></button>`).join('')}</div></div>
 <div class="mission-grid">
  <section class="space-panel" aria-label="Interactive planet context">
   <div id="globe" aria-label="${state.world==='Microgravity'?'Drag to explore the illustrative orbital laboratory':'Drag or swipe sideways to rotate the decorative planet'}" role="img"><div class="globe-fallback"></div></div>
   <div class="space-top"><span class="space-label">${info.title}</span><span class="space-reference">${state.world==='Microgravity'?'NEAR-WEIGHTLESS <span>/ FREE FALL</span>':info.g+' g <span>/ NOMINAL</span>'}</span></div>
   <div class="space-caption"><span class="label">FLAME IN FREEFALL</span><h2>${info.name}</h2><p>${info.caption}</p></div>
   <div class="space-foot"><span>${state.world==='Microgravity'?'Illustrative orbital habitat':'Illustrative view'} <span class="foot-dot">·</span> Drag to explore</span><div class="globe-actions"><button id="zoom-in" aria-label="Zoom in" title="Zoom in">+</button><button id="zoom-out" aria-label="Zoom out" title="Zoom out">−</button><button id="rotate-toggle" aria-label="Pause rotation" title="Pause rotation">${icon('pause')}</button><button id="reset-globe" aria-label="Reset globe" title="Reset globe">${icon('reset')}</button></div></div>
  </section>
  <aside class="research-column" aria-label="Selected material research">
   ${materialPanel()}
   <section class="panel focus-panel"><div class="label">02 / Material in focus</div><div class="focus-heading"><h2>${esc(state.material)}</h2><span class="chip">${term('published','Published')}</span></div><p class="focus-sub">${sampleText(materialDescription(state.material))}<br>Study specimen: ${sampleText(exp?.conditions||'Published sample')} <span> / </span> ${state.world}</p>
    <div class="focus-inspector-grid">${specimenHTML({material:state.material,world:state.world,uloi:limits.uloi?.value??null,moc:limits.moc?.value??null,recordId:limits.uloi?.measurement_id,conditions:exp?.conditions})}
    <div class="focus-values"><div class="limit-pair">${[[limits.uloi,'ULOI'],[limits.moc,'MOC']].map(([r,label])=>`<div><div class="label">${term(r?.metric||label)}</div><strong>${r?number(r.value,8):'—'}<small>%</small></strong><div class="subtle">${term('oxygen','oxygen, molar')}</div></div>`).join('')}</div>
    <dl class="condition-list"><div><dt>Test pressure</dt><dd>${number(exp?.pressure_kpa)} ${term('kPa','kPa absolute')}</dd></div><div><dt>${state.world==='Microgravity'?'Effective acceleration':'Gravity category'}</dt><dd>${info.g} ${term(state.world==='Microgravity'?'microgravity':'g','g')}</dd></div><div><dt>Source</dt><dd>NASA ${term('NTRS')} · Table I</dd></div></dl>
    <button class="primary-btn wide" data-view="compare">Compare across gravity ${icon('arrow')}</button>
    </div></div>
   </section>
   <div class="reading-summary"><span class="label">READ THE RESULT</span><p>${esc(readingSummary(rows,state.material,state.world))}</p></div>
   <div class="research-footnote"><span class="note-number">↳</span><div><p>These are tests of ignited samples, not a prediction of habitat fire risk.</p><button class="text-link" data-record="${esc(limits.uloi?.measurement_id)}">Read the conditions ${icon('arrow')}</button></div></div>

  </aside>
 </div>
 </div>`;
}
function metricName(metric){if(metric==='reported_delta_O2_vs_1g')return term('oxygenDelta','Δ oxygen vs. Earth');if(Object.hasOwn(definitions,metric))return term(metric);return ({reported_delta_O2_vs_1g:'Δ oxygen vs. Earth',flame_base_speed_fit:'Flame-base speed (fit)',flame_tip_speed_fit:'Flame-tip speed (fit)',flame_base_speed_reported:'Flame-base speed',lunar_compensation_delta_at_assumed_35_cm_s:'Lunar compensation at 35 cm/s',O2_vs_flow_best_fit_slope:'O₂–flow slope (best fit)',O2_vs_flow_95pct_conservative_slope:'O₂–flow slope (conservative)'})[metric]||esc(metric)}
function compare(){const selected=getLimits(rows,state.material,'Moon').uloi;return `<div class="view-title-row"><div><div class="eyebrow">MATERIAL COMPARISON</div><h2>One material. Four environments.</h2><p>Follow the published oxygen limits across gravity, with the original test conditions kept in view.</p></div><button class="export-btn" id="export-comparison">${icon('download')}Export comparison</button></div><div class="compare-layout"><div class="left-stack">${materialPanel()}<section class="panel note-panel"><div class="note-title">${icon('info')}Compare with context</div><p>${sampleText(selected.experiment.conditions)}<br>${number(selected.experiment.pressure_kpa)} ${term('kPa','kPa absolute')} (${number(selected.experiment.pressure_psia)} ${term('psia')})</p><p>These are terrestrial experiments that reproduce gravity conditions. They are not fires measured on the lunar or Martian surface.</p></section></div><div class="compare-main">${chartPanel(true)}<div class="science-note"><h3>What this comparison can tell us</h3><p class="comparison-takeaway">${esc(readingSummary(rows,state.material,'Moon'))}</p><p>${esc(comparisonContext(state.material))} Nomex was tested at 101.3 kPa; the polymer films at 70.3 kPa. This is not a ranking of the safest material.</p><p>${state.material==='Mylar G'?'Mylar G is compared with the related but distinct Melinex 515 film in the Earth reference.':'The same material has different reported oxygen limits in different gravity conditions.'} The starred low-gravity values describe flame survival or extinction during short drop tests; the Earth values use different burn criteria. Read them alongside the methods, not as interchangeable safety thresholds. No curve or predicted intermediate-gravity value is inferred here.</p><a href="${safeUrl(selected.source.url)}" target="_blank" rel="noopener noreferrer">Olson & Ferkul · 2012 · Table I, PDF page 6 ↗</a></div></div></div>`}
function option(value,label,current){return `<option value="${esc(value)}" ${value===current?'selected':''}>${esc(label)}</option>`}
function evidence(){return `<div class="view-title-row"><div><div class="eyebrow">THE RESEARCH, IN DETAIL</div><h2>Published findings</h2><p>Results extracted from research papers, with the reported method and source page. For source-file rows, open Original data.</p></div><button class="export-btn" id="export-filtered">${icon('download')}Export filtered CSV</button></div><div class="filterbar"><label>${icon('search')}<input id="record-search" value="${esc(state.query)}" placeholder="Material, metric, source…" aria-label="Search evidence"></label><label>Gravity<select id="world-filter" aria-label="Filter gravity">${['All',...WORLDS,'Earth-to-Moon model'].map(v=>option(v,v==='All'?'All environments':v,state.filterWorld)).join('')}</select></label><label>Material<select id="material-filter" aria-label="Filter material">${['All',...new Set(rows.map(r=>r.experiment.material))].map(v=>option(v,v==='All'?'All materials':v,state.filterMaterial)).join('')}</select></label><label>Type<select id="kind-filter" aria-label="Filter evidence type">${option('All','All evidence',state.filterKind)}${Object.entries(TYPES).map(([v,t])=>option(v,t.name,state.filterKind)).join('')}</select></label><button class="clear-filter" id="clear-filters">Reset filters</button></div><section class="panel"><div id="evidence-results"></div></section><p class="browser-legend">Reported results include aggregates, fitted summaries and model-derived values. Row counts are not counts of independent raw trials.</p>`}
function matchingRows(){return filterRows(rows,{query:state.query,world:state.filterWorld,material:state.filterMaterial,kind:state.filterKind})}
function renderEvidenceRows(){const matches=matchingRows(),size=10,pages=Math.max(1,Math.ceil(matches.length/size));state.page=Math.min(state.page,pages-1);document.querySelector('#evidence-results').innerHTML=matches.length?`<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Record / material</th><th>Gravity</th><th>Metric</th><th>Value</th><th>Evidence</th><th>Source</th></tr></thead><tbody>${matches.slice(state.page*size,(state.page+1)*size).map(r=>`<tr data-record="${r.measurement_id}" tabindex="0" role="button" aria-label="Inspect ${r.measurement_id}"><td class="table-material">${esc(r.experiment.material)}<span class="table-sub mono">${r.measurement_id}</span></td><td style="color:${COLORS[r.experiment.gravity_label]||'#d9ba88'}">${esc(r.experiment.gravity_label)}</td><td>${metricName(r.metric)}</td><td><span class="number">${number(r.value,8)}</span><span class="table-sub">${unitLabel(r.unit)}</span></td><td><span class="chip ${r.evidence_type.startsWith('model')?'amber':''}" style="color:${r.kind.color}">${evidenceLabel(r)}</span></td><td class="mono">${esc(r.source_id.replace('NTRS-',''))}<span class="table-sub">PDF p. ${r.pdf_page||'—'} ↗</span></td></tr>`).join('')}</tbody></table></div><div class="pagination"><span>${state.page*size+1}–${Math.min((state.page+1)*size,matches.length)} of ${matches.length} results</span><div><button data-page="-1" ${state.page===0?'disabled':''} aria-label="Previous evidence page">←</button><span>${state.page+1} / ${pages}</span><button data-page="1" ${state.page===pages-1?'disabled':''} aria-label="Next evidence page">→</button></div></div>`:`<div class="empty"><strong>No matching results</strong>Try another material or reset the filters.</div>`;labelTableCells();}
function sourceView(){return `<div class="view-title-row"><div><div class="eyebrow">SOURCE LIBRARY</div><h2>From the archive to the evidence.</h2><p>${number(bundle.tableCounts.sources,0)} indexed sources. Sorted by extracted result count, highest first. Open the research behind each finding.</p></div></div><div class="pill-row"><span class="stat-pill"><strong>${number(bundle.tableCounts.raw_records,0)}</strong>raw records catalogued</span><span class="stat-pill"><strong>${number(bundle.tableCounts.files,0)}</strong>file metadata entries</span><span class="stat-pill"><strong>${bundle.evidence.length}</strong>supporting evidence statements</span></div><div class="filterbar"><label>${icon('search')}<input id="source-search" value="${esc(state.sourceQuery)}" placeholder="Search titles, source IDs or DOI" aria-label="Search sources"></label><label>Collection<select id="source-type" aria-label="Filter source collection">${['All',...new Set(bundle.sources.map(s=>s.source_type))].map(v=>option(v,v==='All'?'All collections':v.replaceAll('_',' '),state.sourceType)).join('')}</select></label></div><section class="panel"><div id="source-results"></div></section><p class="browser-legend">Catalogue totals describe indexed records. They do not imply that every file was downloaded or that every source supplied quantitative data.</p>`}
function renderSources(){const query=state.sourceQuery.toLowerCase().trim(),matches=sourcesByResults(bundle.sources,rows).filter(s=>(state.sourceType==='All'||s.source_type===state.sourceType)&&[s.title,s.source_id,s.doi].join(' ').toLowerCase().includes(query));const size=10,pages=Math.max(1,Math.ceil(matches.length/size));state.sourcePage=Math.min(state.sourcePage,pages-1);document.querySelector('#source-results').innerHTML=matches.length?`<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Source / title</th><th>Collection</th><th>Year</th><th>Extracted results</th><th></th></tr></thead><tbody>${matches.slice(state.sourcePage*size,(state.sourcePage+1)*size).map(s=>`<tr><td><a class="source-title" href="${safeUrl(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title||s.source_id)}</a><span class="table-sub mono">${esc(s.source_id)}</span></td><td>${esc(s.source_type.replaceAll('_',' '))}</td><td>${s.publication_date?esc(s.publication_date.slice(0,4)):'—'}</td><td>${rows.filter(r=>r.source_id===s.source_id).length||'—'}</td><td><button class="icon-btn" data-source="${esc(s.source_id)}" aria-label="Details for ${esc(s.title||s.source_id)}">${icon('info')}</button></td></tr>`).join('')}</tbody></table></div><div class="pagination"><span>${state.sourcePage*size+1}–${Math.min((state.sourcePage+1)*size,matches.length)} of ${matches.length} sources</span><div><button data-source-page="-1" ${state.sourcePage===0?'disabled':''} aria-label="Previous sources page">←</button><span>${state.sourcePage+1} / ${pages}</span><button data-source-page="1" ${state.sourcePage===pages-1?'disabled':''} aria-label="Next sources page">→</button></div></div>`:`<div class="empty"><strong>No matching sources</strong>Try a shorter search.</div>`;labelTableCells();}
function syncRotationButton(){const button=document.querySelector('#rotate-toggle');if(!button||!globe)return;button.innerHTML=icon(globe.paused?'play':'pause');button.setAttribute('aria-label',globe.paused?'Resume rotation':'Pause rotation');button.title=button.getAttribute('aria-label')}
function disposeMaterialView(){const previous=materialView;materialView=null;previous?.host.removeEventListener('materialrotationchange',syncMaterialControls);previous?.api?.dispose();}
function syncMaterialControls(){view.querySelectorAll('[data-material-action]').forEach(button=>{const api=materialView?.api;button.disabled=!api;if(button.dataset.materialAction==='rotate-toggle'){const paused=api?.paused??true;button.innerHTML=icon(paused?'play':'pause');button.setAttribute('aria-label',paused?'Resume material rotation':'Pause material rotation');button.title=button.getAttribute('aria-label');}});}
view.addEventListener('click',event=>{
 // Exploring a specimen never opens the separate source-record button.
 if(event.target.closest('[data-material-model]')){event.stopPropagation();return;}
 const button=event.target.closest('button[data-material-action]');if(!button)return;
 event.preventDefault();event.stopPropagation();
 const action=button.dataset.materialAction;
 if(action==='zoom-in')materialView?.api?.zoom(-.35);
 else if(action==='zoom-out')materialView?.api?.zoom(.35);
 else if(action==='rotate-toggle'&&materialView?.api)materialView.api.paused=!materialView.api.paused;
 else if(action==='reset')materialView?.api?.reset();
});
async function syncMaterialView(host){
 if(!host){disposeMaterialView();return;}
 if(materialView?.host===host){
  if(materialView.material!==state.material){materialView.material=state.material;materialView.api?.setMaterial(state.material);}
  syncMaterialControls();return materialView.pending;
 }
 disposeMaterialView();
 const instance={host,material:state.material,api:null,pending:null};materialView=instance;
 host.addEventListener('materialrotationchange',syncMaterialControls);
 const current=()=>materialView===instance&&state.view==='overview'&&host.isConnected;
 host.dataset.modelState='loading';syncMaterialControls();
 instance.pending=(async()=>{
  try{
   const {createMaterialModel}=await import('./material-model.mjs');
   if(!current())return;
   const api=createMaterialModel(host,instance.material);
   if(!current()){api.dispose();return;}
   instance.api=api;host.dataset.modelState='ready';syncMaterialControls();
  }catch(error){
   if(!current())return;
   host.dataset.modelState='fallback';syncMaterialControls();console.warn('Material illustration fallback:',error.message);
  }
 })();
 return instance.pending;
}
async function render(){
 const seq=++renderSequence;
 originalDataCleanup?.();originalDataCleanup=null;
 // Changing the material keeps the planet's renderer, textures and camera state.
 const retained=state.view==='overview'&&globe?document.querySelector('#globe'):null;
 if(!retained){globe?.dispose();globe=null;}
 const retainedMaterial=state.view==='overview'&&materialView?.host.dataset.modelState!=='fallback'?materialView?.host:null;
 if(!retainedMaterial)disposeMaterialView();
 document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===state.view);b.setAttribute('aria-current',b.dataset.view===state.view?'page':'false')});
 view.innerHTML=({overview,experiments:originalDataHTML,evidence,compare,sources:sourceView}[state.view])();document.body.dataset.view=state.view;

 if(state.view==='evidence')renderEvidenceRows();if(state.view==='sources')renderSources();labelTableCells();
 if(state.view==='experiments'){
  const cleanup=await mountOriginalData(view,{datasetId:state.originalDataset,query:state.originalQuery,onStateChange:next=>{
   if(seq!==renderSequence||state.view!=='experiments')return;
   state.originalDataset=next.datasetId;state.originalQuery=next.query;syncURL();
  }});
  if(seq!==renderSequence)cleanup();else originalDataCleanup=cleanup;
  return;
 }
 if(state.view==='overview'){
  const placeholder=view.querySelector('[data-material-model]');
  if(retainedMaterial&&placeholder)placeholder.replaceWith(retainedMaterial);
  await Promise.all([
   syncMaterialView(view.querySelector('[data-material-model]')),
   (async()=>{
    if(retained){document.querySelector('#globe').replaceWith(retained);globe.setWorld(state.world);globeWorld=state.world;syncRotationButton();return;}
    try{const {createGlobe}=await import('./globe.mjs');if(seq!==renderSequence)return;globe=createGlobe(document.querySelector('#globe'),state.world);globeWorld=state.world;syncRotationButton();document.querySelector('#globe').addEventListener('rotationchange',syncRotationButton)}catch(e){console.warn('Globe fallback:',e.message)}
   })()
  ]);
 }
}
function syncURL(){
 const url=new URL(location.href);
 for(const key of ['world','material','q','kind','dataset','collection','record'])url.searchParams.delete(key);
 const put=(key,value)=>{if(value)url.searchParams.set(key,value);};
 if(state.view==='overview'||state.view==='compare'){
  put('world',state.world.toLowerCase());put('material',state.material);
 }else if(state.view==='evidence'){
  if(state.filterWorld!=='All')put('world',state.filterWorld.toLowerCase());
  if(state.filterMaterial!=='All')put('material',state.filterMaterial);
  put('q',state.query);if(state.filterKind!=='All')put('kind',state.filterKind);
 }else if(state.view==='experiments'){
  put('dataset',state.originalDataset);put('q',state.originalQuery);
 }else if(state.view==='sources'){
  put('q',state.sourceQuery);if(state.sourceType!=='All')put('collection',state.sourceType);
 }
 url.hash=state.view;history.replaceState(null,'',url);
}
function restoreURLState(){
 const params=new URLSearchParams(location.search),hash=location.hash.slice(1);
 if(VIEWS.includes(hash))state.view=hash;
 const worldInput=params.get('world')?.toLowerCase();
 const world=worldInput==='iss'?'Microgravity':WORLDS.find(value=>value.toLowerCase()===worldInput);
 if(world)state.world=world;
 if(MATERIALS.includes(params.get('material')))state.material=params.get('material');
 if(state.view==='evidence'){
  state.query=params.get('q')||'';
  state.filterWorld=world||(worldInput==='earth-to-moon model'?'Earth-to-Moon model':'All');
  state.filterMaterial=rows.some(row=>row.experiment?.material===params.get('material'))?params.get('material'):'All';
  state.filterKind=Object.hasOwn(TYPES,params.get('kind'))?params.get('kind'):'All';
 }else if(state.view==='experiments'){
  state.originalDataset=params.get('dataset')||'';state.originalQuery=params.get('q')||'';
 }else if(state.view==='sources'){
  state.sourceQuery=params.get('q')||'';
  state.sourceType=bundle.sources.some(source=>source.source_type===params.get('collection'))?params.get('collection'):'All';
 }
 return params;
}
function navigate(name){if(!VIEWS.includes(name))return;state.view=name;syncURL();render();window.scrollTo({top:0,behavior:'instant'});document.querySelector('#workspace').focus({preventScroll:true})}
function routeGlobalSearch(query){
 const normalized=String(query).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 if(!normalized)return;
 const words=` ${normalized} `,has=phrase=>words.includes(` ${phrase} `);
 const original=/\b(original|csv|raw|bass|saffire)\b/.test(normalized);
 if(original){
  state.originalDataset=has('saffire')?'saffire-ii':has('bass')?'bass-ii':'';
  state.originalQuery=state.originalDataset?'':normalized.replace(/\b(original|csv|raw|data|records|nasa|show|find)\b/g,'').trim();
  navigate('experiments');return;
 }
 const knownMaterials=[...new Set(rows.map(row=>row.experiment?.material).filter(Boolean))];
 const normalize=value=>value.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 let material=knownMaterials.slice().sort((a,b)=>b.length-a.length).find(value=>has(normalize(value)));
 if(!material)material=Object.entries({ultem:'Ultem 1000',pei:'Ultem 1000',mylar:'Mylar G',pet:'Mylar G',nomex:'Nomex HT90-40',acrylic:'PMMA',p213:'P 213'}).find(([alias])=>has(alias))?.[1];
 const foundWorlds=[['Microgravity',/\b(microgravity|micro g|zero g|orbit|orbital|iss)\b/],['Moon',/\b(moon|lunar)\b/],['Mars',/\b(mars|martian)\b/],['Earth',/\b(earth|1g|1 g)\b/]].filter(([,pattern])=>pattern.test(normalized)).map(([world])=>world);
 const world=foundWorlds[0],wantsComparison=/\b(compare|comparison|vs|versus)\b/.test(normalized)||foundWorlds.length>1;
 if(world)state.world=world;
 if(material&&MATERIALS.includes(material))state.material=material;
 if(material&&!MATERIALS.includes(material)){
  Object.assign(state,{query:'',filterWorld:foundWorlds.length===1?world:'All',filterMaterial:material,filterKind:'All',page:0});navigate('evidence');return;
 }
 if(material||world){navigate(wantsComparison?'compare':'overview');return;}
 Object.assign(state,{query:String(query).trim(),filterWorld:'All',filterMaterial:'All',filterKind:'All',page:0});navigate('evidence');document.querySelector('#record-search')?.focus();
}
function openRecord(id){const r=rows.find(x=>x.measurement_id===id);if(!r)return;const e=r.experiment;const fields=[['Environment',e.gravity_label],['Test pressure',e.pressure_kpa!==null?number(e.pressure_kpa)+' kPa absolute':'Not reported'],['Oxygen',e.oxygen_pct!==null?number(e.oxygen_pct)+' molar %':'Not reported'],['Airflow',e.flow_speed_cm_s!==null?number(e.flow_speed_cm_s)+' cm/s':e.flow_mode||'Not reported'],['Sample',e.conditions||e.material],['Platform',e.platform||'See source'],['Test duration',e.duration_s!==null?number(e.duration_s)+' s':'Not reported'],['Evidence type',r.kind.name]];document.querySelector('#detail-content').innerHTML=`<div class="eyebrow">EVIDENCE / ${esc(r.measurement_id)}</div><h2 id="detail-title">${esc(e.material)}</h2><span class="chip ${r.evidence_type.startsWith('model')?'amber':''}">${evidenceLabel(r)}</span><div class="record-value">${number(r.value,8)}<small>${unitLabel(r.unit)}</small></div><div class="subtle">${metricName(r.metric)}</div><div class="detail-grid">${fields.map(([k,v])=>`<div><span>${fieldLabel(k)}</span><b>${k==='Evidence type'?evidenceLabel(r):k==='Sample'?sampleText(v):v==='Microgravity'?term('microgravity',v):esc(v)}</b></div>`).join('')}</div><h3>Original source</h3><a class="detail-source" href="${safeUrl(r.source.url)}" target="_blank" rel="noopener noreferrer">${esc(r.source.title)} ↗<br><small>${esc(r.locator)} · PDF page ${r.pdf_page||'not specified'}</small></a><div class="detail-limitation"><h3>How to interpret this result</h3><p>${esc(r.limitation)}</p><p>Reported summary, not an independent raw trial. Uncertainty values are ${r.uncertainty_value===null?'not supplied in this record':esc(r.uncertainty_value+' '+r.uncertainty_unit)}.</p></div><p class="subtle">Gravity basis: ${esc(e.gravity_basis||'See the source methods.')}</p><div class="detail-actions"><button class="export-btn" data-download-record="${r.measurement_id}">${icon('download')}Download record</button></div>`;dialog.showModal();}
function openSource(id){const source=bundle.sources.find(s=>s.source_id===id);if(!source)return;const statements=bundle.evidence.filter(e=>e.source_id===id);document.querySelector('#detail-content').innerHTML=`<div class="eyebrow">SOURCE / ${esc(source.source_id)}</div><h2 id="detail-title">${esc(source.title||source.source_id)}</h2><p>${esc(source.source_type.replaceAll('_',' '))}${source.publication_date?' · '+esc(source.publication_date.slice(0,4)):''}</p><a class="detail-source" href="${safeUrl(source.url)}" target="_blank" rel="noopener noreferrer">Open original source ↗</a><h3>${rows.filter(r=>r.source_id===id).length} extracted results · ${statements.length} evidence statements</h3>${statements.map(e=>`<div class="source-excerpt">${esc(e.statement)}<small>${esc(e.locator||'Source text')}${e.pdf_page?' · PDF p. '+e.pdf_page:''}</small>${e.limitation?`<p>${esc(e.limitation)}</p>`:''}</div>`).join('')}<p>Inclusion in the source catalogue does not mean this document contributed a measurement.</p>`;dialog.showModal();}
function showAbout(){document.querySelector('#detail-content').innerHTML=`<div class="eyebrow">TEAM SORAINE / FLAME IN FREEFALL</div><h2 id="detail-title">Built around the evidence.</h2><p>This public dashboard uses research from <strong>flame_in_freefall_2026</strong> from the team's Google BigQuery dataset. Data as of ${new Date(bundle.exportedAt).toLocaleString('en-CA',{timeZone:'UTC'})} UTC. ${bundle.delivery?.mode==='bigquery'?'The server reads BigQuery and caches complete results for five minutes.':bundle.delivery?.mode==='cached-stale'?'Showing the last successful BigQuery refresh while the connection recovers.':'Browsing and filtering use the saved snapshot, not a live database connection.'} File-catalogue totals describe the original export; raw catalogue rows are not exposed.</p><div class="detail-grid"><div><span>Reported results</span><b>${bundle.measurements.length}</b></div><div><span>Experiment contexts</span><b>${bundle.experiments.length}</b></div><div><span>Indexed sources</span><b>${bundle.sources.length}</b></div><div><span>Evidence statements</span><b>${bundle.evidence.length}</b></div></div><h3>Reading the science</h3><p>Published limits, fitted results, derived summaries and model-derived values are labelled separately. Experiment contexts are not independent trials. Pressure and oxygen describe the test environment, not a planet's outdoor atmosphere. The globe is illustrative and does not mark experiment locations. The microgravity view is an illustrative orbital laboratory, not a particular space station. Free fall can also be studied in drop towers. Its floating props do not simulate material fire behaviour. Lunar gravity is grouped nominally; individual test acceleration is described in each record.</p><h3>Credits</h3><ul class="credits-list"><li>Research: Hogan, Ethan and Tony / Team Soraine.</li><li>Music: <em>Quiet Orbit</em>, an original ambient waltz created for Soraine with Codex assistance. Original synthesized instruments; no external recordings. Use the music button to play, pause or mute.</li><li>Original Soraine interface. Layout study: <a href="https://www.awwwards.com/sites/the-bluejack-group-dashboard" target="_blank" rel="noopener noreferrer">The Bluejack Group Dashboard on Awwwards</a>. Reference artwork is not included.</li><li>Moon: <a href="https://svs.gsfc.nasa.gov/4720/" target="_blank" rel="noopener noreferrer">NASA Scientific Visualization Studio, CGI Moon Kit</a>, LRO/LROC color imagery and LOLA elevation-derived surface normals.</li><li>Earth: <a href="https://svs.gsfc.nasa.gov/2915/" target="_blank" rel="noopener noreferrer">NASA/Goddard Scientific Visualization Studio, Blue Marble</a>, Reto Stöckli and NASA Earth Observatory.</li><li>Mars: <a href="https://trek.nasa.gov/mars/" target="_blank" rel="noopener noreferrer">NASA Mars Trek</a>, Viking MDIM 2.1 color mosaic, NASA/JPL/USGS. Earth night lights: <a href="https://svs.gsfc.nasa.gov/2916/" target="_blank" rel="noopener noreferrer">NASA/GSFC and NOAA/NGDC</a>, Mayhew, Simmon, Imhoff and Elvidge.</li><li>Three.js, MIT license. Planet lighting inspired by the <a href="https://threejs.org/examples/webgpu_tsl_earth.html" target="_blank" rel="noopener noreferrer">Three.js Earth example</a>; rendered here in WebGL for broader device support. Lighting and rotation are illustrative, not a current satellite view. NASA Space Apps participant project; no NASA endorsement implied.</li></ul>`;dialog.showModal();}
document.addEventListener('click',e=>{const b=e.target.closest('button,a,tr[data-record]');if(!b)return;if(b.dataset.researchQuestion){routeGlobalSearch(b.dataset.researchQuestion)}else if(b.dataset.browseMaterials){Object.assign(state,{query:'',filterWorld:'All',filterMaterial:'All',filterKind:'All',page:0});navigate('evidence');document.querySelector('#material-filter').focus()}else if(b.dataset.view){e.preventDefault();navigate(b.dataset.view)}else if(b.dataset.material){state.material=b.dataset.material;syncURL();render()}else if(b.dataset.world){state.world=b.dataset.world;syncURL();render()}else if(b.dataset.record)openRecord(b.dataset.record);else if(b.dataset.source)openSource(b.dataset.source);else if(b.dataset.page){state.page+=Number(b.dataset.page);renderEvidenceRows()}else if(b.dataset.sourcePage){state.sourcePage+=Number(b.dataset.sourcePage);renderSources()}else if(b.dataset.downloadRecord){const r=rows.find(x=>x.measurement_id===b.dataset.downloadRecord);download(JSON.stringify(r,null,2),'soraine-'+r.measurement_id+'.json')}else if(b.id==='about-btn'||b.id==='credits-btn')showAbout();else if(b.id==='export-all')download(JSON.stringify(bundle,null,2),'soraine-bigquery-research.json');else if(b.id==='export-filtered')download(csv(matchingRows()),'soraine-filtered-results.csv','text/csv;charset=utf-8');else if(b.id==='export-comparison')download(csv(rows.filter(r=>r.experiment.material===state.material&&r.evidence_type==='reported_experimental_limit_aggregate')),'soraine-'+state.material.replaceAll(' ','-')+'-comparison.csv','text/csv;charset=utf-8');else if(b.id==='clear-filters'){Object.assign(state,{query:'',filterWorld:'All',filterMaterial:'All',filterKind:'All',page:0});syncURL();render()}else if(b.id==='zoom-in')globe?.zoom(-.4);else if(b.id==='zoom-out')globe?.zoom(.4);else if(b.id==='reset-globe')globe?.reset();else if(b.id==='rotate-toggle'&&globe){globe.paused=!globe.paused;b.innerHTML=icon(globe.paused?'play':'pause');b.setAttribute('aria-label',globe.paused?'Resume rotation':'Pause rotation');b.title=b.getAttribute('aria-label')}else if(b.classList.contains('dialog-close'))dialog.close();});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!dialog.open){e.preventDefault();document.querySelector('#global-search').focus()}if((e.key==='Enter'||e.key===' ')&&e.target.matches('tr[data-record]')){e.preventDefault();openRecord(e.target.dataset.record)}});
document.addEventListener('input',e=>{if(e.target.id==='record-search'){state.query=e.target.value;state.page=0;syncURL();renderEvidenceRows()}if(e.target.id==='source-search'){state.sourceQuery=e.target.value;state.sourcePage=0;syncURL();renderSources()}});
document.addEventListener('change',e=>{const key={'world-filter':'filterWorld','material-filter':'filterMaterial','kind-filter':'filterKind'}[e.target.id];if(key){state[key]=e.target.value;state.page=0;syncURL();renderEvidenceRows()}if(e.target.id==='source-type'){state.sourceType=e.target.value;state.sourcePage=0;syncURL();renderSources()}});
document.querySelector('#global-search').addEventListener('keydown',e=>{if(e.key==='Enter'){routeGlobalSearch(e.target.value);e.target.value=''}});

dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
try{let response=await fetch('./api/research').catch(()=>null);if(!response?.ok)response=await fetch('./data/research.json');if(!response.ok)throw Error('Research data could not be loaded.');bundle=await response.json();document.querySelector('.connection').innerHTML='<i></i> '+(bundle.delivery?.mode==='bigquery'?'BigQuery connected':bundle.delivery?.mode==='cached-stale'?'BigQuery cached':'Saved snapshot');rows=joinResearch(bundle);document.querySelector('#snapshot-date').textContent=(bundle.delivery?.mode==='bigquery'?'Refreshed ':'Snapshot ')+new Date(bundle.exportedAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'})+' · '+new Date(bundle.exportedAt).toISOString().slice(11,16)+' UTC';const params=restoreURLState();await render();if(params.has('record'))openRecord(params.get('record'));}catch(error){view.innerHTML=`<div class="empty"><strong>Research archive unavailable</strong>${esc(error.message)}<p>Reload this page to try again.</p></div>`;document.querySelector('#export-all').disabled=true;document.querySelector('#about-btn').disabled=true;document.querySelector('#credits-btn').disabled=true;console.error(error)}
