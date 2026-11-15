/** Pure information lookup. No renderer, DOM, network, scene mutation or fire model. */
export function getObjectPanel(bundle, selection) {
  const {objectId, sceneId, caseId} = selection;
  const object = bundle.objects.find(o => o.id === objectId || o.aliases.includes(objectId));
  const scene = bundle.scenes.find(s => s.id === sceneId);
  if (!object || !scene) throw new Error(`Unknown object or scene: ${objectId}, ${sceneId}`);
  const atmosphereId = selection.atmosphereId ?? scene.default_atmosphere_id;
  const preset = bundle.atmospheres.find(a => a.id === atmosphereId);
  if (!preset) throw new Error(`Unknown atmosphere: ${atmosphereId}`);
  const atmosphere = {...preset};
  for (const [key,value] of Object.entries(selection.cabinOverrides ?? {})) {
    if(!['oxygen_percent','pressure_kpa_absolute','airflow_mm_s'].includes(key)) throw new Error(`Unknown cabin setting: ${key}`);
    if(value !== null && (!Number.isFinite(value) || value < 0 || (key === 'oxygen_percent' && value > 100) || (key === 'pressure_kpa_absolute' && value === 0))) throw new Error(`Invalid cabin setting: ${key}`);
    atmosphere[key]=value;
  }
  if(Object.keys(selection.cabinOverrides ?? {}).length) {
    atmosphere.label='Custom illustrative cabin';
    atmosphere.basis='User-selected scene settings. These do not create a measured experiment.';
  }
  const material = bundle.materials.find(m => m.id === object.material_id) ?? null;
  const card = bundle.cards.find(c => c.id === object.card_id);
  const relevantCases = bundle.cases.filter(c => c.material_id === object.material_id && c.scene_id === sceneId);
  const chosenId = caseId ?? bundle.default_case_by_object[object.id]?.[sceneId];
  const chosen = chosenId ? relevantCases.find(c => c.id === chosenId) : null;
  if (caseId && !chosen) throw new Error('This case does not belong to the selected material and scene.');
  const records = chosen ? chosen.record_ids.map(id => bundle.evidence_records.find(r => r.id === id)) : [];
  const findings = bundle.findings.filter(f => object.finding_ids.includes(f.id));
  const sourceIds = new Set([...card.source_ids, ...records.map(r => r.source_id), ...findings.map(f => f.source_id)]);
  const measurementRows = records.flatMap(record => record.measurements.map(measurement => {
    const definition = bundle.metrics[measurement.metric] ?? {};
    return {
      evidenceId: record.id, metric: measurement.metric,
      label: definition.label ?? measurement.metric,
      value: measurement.value,
      displayValue: measurement.value === null ? 'Not reported' :
        definition.value_labels?.[measurement.value] ?? String(measurement.value),
      unit: definition.unit_label ?? measurement.unit,
      explanation: definition.meaning ?? null,
      evidenceType: bundle.ui_states[record.evidence_kind] ?? record.evidence_kind,
      sourceId: record.source_id, sourceLocation: record.source_location
    };
  }));
  const noExperiment = records.some(r=>r.measurements.some(m=>m.metric==='burning_outcome' && m.value==='no_experiment'));
  return {
    objectId: object.id, title: object.label, role: object.role, material, card,
    sceneConditions: {...scene, atmosphere},
    availableCases: relevantCases.map(c => ({id:c.id,label:c.label})),
    selectedCase: chosen ?? null,
    evidenceState: noExperiment ? 'no_experiment' : chosen ? 'published_test' : object.role === 'material' ? 'no_matching_case' : object.role,
    emptyMessage: !chosen && object.role === 'material' ? 'No matching test in this collection. Related research is available below.' : null,
    measurements: measurementRows,
    testConditions: records.map(r => ({evidenceId:r.id,material:r.material,platform:r.platform,conditions:r.conditions,geometry:r.details,limitations:r.limitations})),
    relatedFindings: findings,
    relatedEvidence: material ? material.record_ids.map(id => bundle.evidence_records.find(r => r.id === id)) : [],
    comparisonCases: chosen ? bundle.cases.filter(c => c.compare_group === chosen.compare_group && c.id !== chosen.id) : [],
    scope: records.length ? 'These are published test results. The selected scene atmosphere does not modify them.' : null,
    sources: [...sourceIds].filter(Boolean).map(id => bundle.sources[id]),
    animationPolicy: 'illustrative_only'
  };
}

export function getComparison(bundle, firstCaseId, secondCaseId) {
  const first=bundle.cases.find(c=>c.id===firstCaseId), second=bundle.cases.find(c=>c.id===secondCaseId);
  if(!first || !second) throw new Error('Unknown comparison case.');
  if(first.compare_group !== second.compare_group) return {allowed:false,reason:'Different materials, series or flow configurations.'};
  const records=[first,second].map(c=>c.record_ids.map(id=>bundle.evidence_records.find(r=>r.id===id)));
  return {allowed:true,mode:'side_by_side_published_tests',cases:[first,second],records,
    note:first.compare_group.startsWith('olson-') ? 'Compare the published endpoints with their methods visible. Earth and reduced-gravity endpoints use different criteria; the PET Earth comparison also uses a different grade.' : 'Compare discrete tests at fixed flow. Extinction and missing experiments are not zero-valued spread rates.',
    allowPrediction:false,allowSafetyRanking:false};
}
