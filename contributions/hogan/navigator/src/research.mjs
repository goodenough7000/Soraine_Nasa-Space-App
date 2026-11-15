import {getObjectPanel} from '../../research/info-adapter.mjs';

export const PROMPT = 'Compare Ultem on the Moon and Mars';
export const SOURCE_URL = 'https://ntrs.nasa.gov/citations/20130010991';
export const PDF_URL = 'https://ntrs.nasa.gov/api/citations/20130010991/downloads/20130010991.pdf#page=6';

export function buildComparison(bundle) {
  return ['moon','mars'].map(sceneId => {
    const panel = getObjectPanel(bundle, {objectId:'sample-ultem',sceneId});
    const condition = panel.testConditions[0];
    const measurement = metric => panel.measurements.find(m=>m.metric===metric);
    if (!condition || !measurement('ULOI*') || !measurement('MOC*')) throw new Error('Ultem comparison evidence is missing.');
    return {
      id: sceneId, name: sceneId === 'moon' ? 'Moon' : 'Mars',
      caseId: panel.selectedCase.id, objectId: panel.objectId,
      gravity: condition.conditions.gravity_nominal_g,
      pressure: condition.conditions.pressure_kpa,
      pressurePsia: condition.conditions.pressure_psia,
      thickness: condition.geometry.thickness_mm,
      duration: condition.geometry.drop_duration_s,
      airflow: condition.conditions.airflow_mm_s,
      survived: measurement('ULOI*'), extinguished: measurement('MOC*'),
      source: panel.sources.find(s=>s.id==='NTRS-20130010991'),
      evidenceIds: panel.selectedCase.record_ids,
    };
  });
}

export function routeCommand(text) {
  const q = text.toLowerCase().trim();
  if (/^(reset|home|start over|restart)$/.test(q)) return 'home';
  if (/\b(source|sources|paper|citation|method|methods|why)\b/.test(q)) return 'source';
  if (/\b(ultem|pei|compare|comparison|moon|mars)\b/.test(q)) return 'compare';
  return 'unsupported';
}

export function makeSceneSelection(sceneId,context={}) {
  if (!['moon','mars'].includes(sceneId)) throw new Error('Unsupported scene.');
  return {objectId:'sample-ultem',sceneId,atmosphereId:context.atmosphereId||'illustrative-air',caseId:`olson-ultem-${sceneId}`,...(context.cabinOverrides?{cabinOverrides:{...context.cabinOverrides}}:{})};
}

export function parseSceneSelection(selection) {
  if (selection?.objectId !== 'sample-ultem' || !['moon','mars'].includes(selection?.sceneId)) return null;
  if (selection.caseId && selection.caseId !== `olson-ultem-${selection.sceneId}`) return null;
  if(selection.atmosphereId&&!['illustrative-air','illustrative-enriched'].includes(selection.atmosphereId))return null;
  if(selection.cabinOverrides){
    for(const [key,value] of Object.entries(selection.cabinOverrides)){
      if(!['oxygen_percent','pressure_kpa_absolute','airflow_mm_s'].includes(key))return null;
      if(value!==null&&(!Number.isFinite(value)||value<0||(key==='oxygen_percent'&&value>100)||(key==='pressure_kpa_absolute'&&value===0)))return null;
    }
  }
  return makeSceneSelection(selection.sceneId,selection);
}
