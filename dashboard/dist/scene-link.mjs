// Shared scene-to-research contract. No renderer or Google credentials required.
import {MATERIALS} from './data.mjs';

export const RESEARCH_SITE='https://soraine.vercel.app/';
const worlds={earth:'earth',moon:'moon',lunar:'moon',mars:'mars',martian:'mars',iss:'microgravity',microgravity:'microgravity'};
const views=['overview','experiments','compare','evidence','sources'];

export function researchUrl({world='earth',material='Ultem 1000',view='compare',record}={},base=RESEARCH_SITE){
 const url=new URL(base);
 if(!['http:','https:'].includes(url.protocol))throw new TypeError('Research links require HTTP or HTTPS.');
 const normalized=worlds[String(world).toLowerCase()];
 if(!normalized)throw new RangeError('Unknown gravity context.');
 if(!MATERIALS.includes(material))throw new RangeError('Choose a published comparison material.');
 if(!views.includes(view))throw new RangeError('Unknown research view.');
 if(record!==undefined&&!/^E\d{3,}$/.test(record))throw new RangeError('Invalid evidence record ID.');
 url.search='';url.searchParams.set('world',normalized);url.searchParams.set('material',material);
 if(record)url.searchParams.set('record',record);
 url.hash=view;
 return url.href;
}
