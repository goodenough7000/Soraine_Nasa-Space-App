import {getLimits,number} from './data.mjs';

// Explain a published comparison without converting an experimental endpoint
// into an ignition probability or a habitat certification.
export function readingSummary(rows,material,world){
 const selected=getLimits(rows,material,world).uloi;
 const moon=getLimits(rows,material,'Moon').uloi;
 const mars=getLimits(rows,material,'Mars').uloi;
 if(!selected)return 'No matching published oxygen limit is available for this selection.';
 if(world==='Moon'||world==='Mars'){
  if(moon&&mars){
   const difference=Number(moon.value)-Number(mars.value);
   const lower=difference<0?'lunar':'Martian';
   return difference===0
    ? 'This study reports the same flame-survival oxygen limit at lunar and Martian gravity.'
    : `In this study, the ${lower}-gravity flame-survival limit is ${number(Math.abs(difference))} percentage ${Math.abs(difference)===1?'point':'points'} lower than the other partial-gravity case.`;
  }
 }
 return world==='Microgravity'
  ? 'These microgravity results include forced airflow. Floating does not mean that oxygen stops reaching a flame.'
  : 'Earth tests provide a reference. A material’s Earth result does not establish its fire behaviour in reduced gravity.';
}

export function comparisonContext(material){
 return material==='Mylar G'
  ? 'Earth uses related Melinex 515 film; reduced-gravity tests use Mylar G. The sample and test endpoints differ.'
  : 'Compare the same specimen and test pressure. Earth and reduced-gravity tests use different burn endpoints.';
}
