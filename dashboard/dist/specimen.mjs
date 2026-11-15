let specimenInstance=0;
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const numeric=value=>{
 if(!['number','string'].includes(typeof value)||String(value).trim()==='')return null;
 const number=Number(value);return Number.isFinite(number)?number:null;
};
const format=value=>Number(value.toFixed(2)).toString();

const materials={
 'Ultem 1000':{kind:'ultem',label:'Amber PEI film',description:'An illustrative amber polyetherimide film with a thin folded edge.'},
 'Mylar G':{kind:'mylar',label:'Translucent PET film',description:'An illustrative translucent polyester film with a curled, reflective edge.'},
 'Nomex HT90-40':{kind:'nomex',label:'Woven Nomex fabric',description:'An illustrative woven Nomex fabric swatch with a folded corner.'}
};

function model(kind,id){
 const start=`<svg class="specimen-model" viewBox="0 0 360 124" aria-hidden="true" focusable="false"><defs>
 <radialGradient id="${id}-shadow"><stop stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
 <linearGradient id="${id}-amber" x1=".15" y1="0" x2=".78" y2="1"><stop stop-color="#ffe2a1"/><stop offset=".34" stop-color="#dca346"/><stop offset=".65" stop-color="#f5cf84"/><stop offset="1" stop-color="#a76320"/></linearGradient>
 <linearGradient id="${id}-amber-edge"><stop stop-color="#915520"/><stop offset=".5" stop-color="#eab160"/><stop offset="1" stop-color="#744115"/></linearGradient>
 <linearGradient id="${id}-glass" x1="0" y1=".2" x2="1" y2=".85"><stop stop-color="#b3d6ef" stop-opacity=".28"/><stop offset=".24" stop-color="#e9f6ff" stop-opacity=".85"/><stop offset=".38" stop-color="#7aa6d2" stop-opacity=".32"/><stop offset=".57" stop-color="#bcd8fb" stop-opacity=".5"/><stop offset=".74" stop-color="#f5faff" stop-opacity=".94"/><stop offset="1" stop-color="#728db8" stop-opacity=".3"/></linearGradient>
 <linearGradient id="${id}-silver" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f2faff"/><stop offset=".42" stop-color="#7791ae"/><stop offset="1" stop-color="#d8edff"/></linearGradient>
 <linearGradient id="${id}-cloth" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#e4dfd2"/><stop offset=".6" stop-color="#bfb8a8"/><stop offset="1" stop-color="#969184"/></linearGradient>
 <linearGradient id="${id}-fold"><stop stop-color="#7e796e"/><stop offset=".55" stop-color="#c5bead"/><stop offset="1" stop-color="#eee7d6"/></linearGradient>
 <pattern id="${id}-weave" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 1H5M1 0V5" stroke="#615e56" stroke-opacity=".25" stroke-width="1.2"/><path d="M0 3.5H5M3.5 0V5" stroke="#fff8e9" stroke-opacity=".38" stroke-width=".8"/></pattern>
 </defs><ellipse cx="185" cy="106" rx="128" ry="17" fill="url(#${id}-shadow)"/>`;
 const finish='</svg>';
 if(kind==='ultem')return start+`<g class="specimen-object">
 <path d="M81 77L265 97L291 43L290 48L266 102L81 82Z" fill="url(#${id}-amber-edge)"/>
 <path d="M81 77L123 22L291 43L265 97Z" fill="url(#${id}-amber)" stroke="#f7d28a" stroke-opacity=".75" stroke-width=".7"/>
 <path d="M123 22L144 25L104 80L81 77Z" fill="#fff4ce" opacity=".25"/>
 <path d="M134 26L269 43L248 84L111 71Z" fill="#d08a28" opacity=".11"/>
 <path d="M272 41L291 43L278 69Q270 60 272 41Z" fill="#ffe5a7" opacity=".78"/>
 <path d="M272 41Q269 61 278 69M82 77L265 97" fill="none" stroke="#fff1c4" stroke-opacity=".7" stroke-width=".8"/>
 <path d="M118 34L254 51" stroke="#fff7dc" stroke-opacity=".28" stroke-width="2"/>
 </g>`+finish;
 if(kind==='mylar')return start+`<g class="specimen-object">
 <path d="M82 91L251 105L293 55L126 39Z" fill="#5289bf" fill-opacity=".045" stroke="#7899b7" stroke-opacity=".15" stroke-dasharray="2 5"/>
 <path d="M91 39Q166 9 281 40Q259 65 264 95Q182 69 86 100Q105 72 91 39Z" fill="url(#${id}-glass)" stroke="#c6e4ff" stroke-opacity=".68" stroke-width=".75"/>
 <path d="M91 39Q166 9 281 40L270 49Q161 19 96 48Z" fill="url(#${id}-silver)" opacity=".74"/>
 <path d="M86 100Q182 69 264 95L267 100Q181 76 86 103Z" fill="url(#${id}-silver)" opacity=".7"/>
 <path d="M131 32Q143 61 119 89M227 33Q211 54 220 83" fill="none" stroke="#f2faff" stroke-opacity=".45" stroke-width="2"/>
 <path d="M96 49Q180 23 269 49M96 90Q178 65 259 87" fill="none" stroke="#eaf6ff" stroke-opacity=".2" stroke-width=".75"/>
 </g>`+finish;
 if(kind==='nomex')return start+`<g class="specimen-object">
 <path d="M104 34L242 22L281 80L234 105L82 90Z" fill="#716c61"/>
 <path d="M104 30L242 18L280 76L233 101L82 86Z" fill="url(#${id}-cloth)" stroke="#ded8c9" stroke-width=".8"/>
 <path d="M104 30L242 18L280 76L233 101L82 86Z" fill="url(#${id}-weave)"/>
 <path d="M242 18Q236 45 258 59L280 76Z" fill="url(#${id}-fold)"/>
 <path d="M242 18Q236 45 258 59L280 76" fill="none" stroke="#f6edda" stroke-opacity=".7"/>
 <path d="M106 35L235 25M89 82L232 95L270 77" fill="none" stroke="#f3ecdc" stroke-opacity=".5" stroke-width="1" stroke-dasharray="2 3"/>
 <path d="M96 87L94 93M104 88L102 94M115 89L113 95M126 90L125 96M137 91L136 97M149 92L148 98M161 93L160 99M174 94L173 100M187 96L186 101M200 97L199 102M213 98L212 103" stroke="#c3bcab" stroke-opacity=".65" stroke-width=".8"/>
 </g>`+finish;
 return start+'<text x="180" y="67" text-anchor="middle" fill="currentColor" font-size="12">Specimen illustration unavailable</text>'+finish;
}

function oxygenAxis(uloi,moc,id,world){
 const star=['Moon','Mars','Microgravity'].includes(world)?'*':'';
 const rows=[{label:`ULOI${star}`,value:numeric(uloi),y:14,className:'uloi'},{label:`MOC${star}`,value:numeric(moc),y:36,className:'moc'}];
 const detail=rows.map(({label,value})=>`${label}: ${value===null?'not reported':format(value)+' percent oxygen'}`).join('. ');
 return `<div class="specimen-axis"><span class="specimen-axis-label">Oxygen concentration</span>
 <svg viewBox="0 0 350 59" role="img" aria-labelledby="${id}-axis-title" focusable="false"><title id="${id}-axis-title">0 to 30 percent oxygen. ${escape(detail)}.</title>
 ${rows.map(({label,value,y,className})=>`<text class="specimen-axis-name" x="0" y="${y+3}">${label}</text>
 <path class="specimen-axis-track" d="M55 ${y}H334"/>
 ${[0,10,20,30].map(tick=>`<path class="specimen-axis-tick" d="M${55+tick/30*279} ${y-3}v6"/>`).join('')}
 ${value!==null&&value>=0&&value<=30?`<g class="specimen-axis-point ${className}"><path d="M${55+value/30*279} ${y-6}v12"/><circle cx="${55+value/30*279}" cy="${y}" r="3.5"/></g>`:`<text class="specimen-axis-missing" x="334" y="${y-5}" text-anchor="end">${value===null?'Not reported':escape(format(value)+'% outside axis')}</text>`}`).join('')}
 <text class="specimen-axis-unit" x="55" y="56">0%</text><text class="specimen-axis-unit" x="148" y="56" text-anchor="middle">10%</text><text class="specimen-axis-unit" x="241" y="56" text-anchor="middle">20%</text><text class="specimen-axis-unit" x="334" y="56" text-anchor="end">30%</text>
 </svg></div>`;
}

export function specimenHTML({material='',world='',uloi=null,moc=null,recordId=null,conditions}={}){
 const id=`specimen-${++specimenInstance}`,definition=materials[material]||{kind:'unknown',label:String(material),description:'No specimen illustration is available for this material.'};
 const inspect=recordId!==null&&recordId!==undefined&&String(recordId)!=='';
 return `<section class="specimen" aria-label="${escape(material)} specimen and reported oxygen limits">
 <div class="specimen-caption"><span>Illustrative specimen</span><span class="specimen-material-label">${escape(definition.label)}</span></div>
 <div class="material-model" data-material-model="${escape(material)}" tabindex="0" role="group" aria-label="${escape(`Rotate the ${material} specimen. Arrow keys rotate, plus and minus zoom, Home resets.`)}">${model(definition.kind,id)}</div>
 <div class="specimen-model-toolbar"><span class="specimen-gesture">Drag to rotate · Arrow keys</span><div class="specimen-model-actions"><button type="button" data-material-action="zoom-in" aria-label="Zoom in on material" title="Zoom in">+</button><button type="button" data-material-action="zoom-out" aria-label="Zoom out from material" title="Zoom out">−</button><button type="button" data-material-action="rotate-toggle" aria-label="Pause material rotation" title="Pause material rotation">Ⅱ</button><button type="button" data-material-action="reset" aria-label="Reset material view" title="Reset view">↺</button></div></div>
 ${inspect?`<button type="button" class="specimen-source" data-record="${escape(recordId)}" aria-label="${escape(`Read ${material} test record for ${world}`)}">Read test record <span aria-hidden="true">↗</span></button>`:''}
 ${oxygenAxis(uloi,moc,id,world)}</section>`;
}
