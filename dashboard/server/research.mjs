// The public API reads only these columns from these four research tables.
// The database's file paths, manifests and download logs never enter the response.
export const PUBLIC_FIELDS = Object.freeze({
  sources: 'source_id,source_type,title,url,doi,publication_date,source_authority'.split(','),
  experiments: 'experiment_id,source_id,context_type,material,gravity_label,gravity_nominal_g,gravity_basis,platform,pressure_psia,pressure_kpa,pressure_reported,oxygen_pct,flow_speed_cm_s,flow_mode,duration_s,conditions,comparability_group,limitation'.split(','),
  measurements: 'measurement_id,experiment_id,source_id,metric,value,unit,normalized_value,normalized_unit,conversion,evidence_type,independent_raw_trial,pdf_page,locator,reliability_label,uncertainty_value,uncertainty_unit,uncertainty_status,limitation'.split(','),
  evidence: 'evidence_id,source_id,statement,language,evidence_type,locator,pdf_page,related_measurement_ids,reliability_label,limitation'.split(',')
});

export function decodeValue(value, field) {
  if (value == null) return null;
  if (field.mode === 'REPEATED') return value.map(item => decodeValue(item.v, {...field, mode: 'NULLABLE'}));
  if (field.type === 'RECORD') return Object.fromEntries(field.fields.map((f,i) => [f.name, decodeValue(value.f[i]?.v,f)]));
  if (field.type === 'BOOLEAN' || field.type === 'BOOL') return value === true || value === 'true';
  // Preserve decimal strings exactly. Presentation handles numeric formatting.
  return value;
}

export async function readPublicBundle({request, project, dataset, snapshot}) {
  if (!/^[a-z][a-z0-9-]+$/.test(project) || !/^\w+$/.test(dataset)) throw Error('Invalid dataset configuration');
  const next = {...snapshot, project, dataset, mode: 'BigQuery cached', tableCounts: {...snapshot.tableCounts}};
  next.catalogueCountsAsOf = snapshot.exportedAt;
  await Promise.all(Object.entries(PUBLIC_FIELDS).map(async ([table, allowed]) => {
    const base = `https://bigquery.googleapis.com/bigquery/v2/projects/${project}/datasets/${dataset}/tables/${table}`;
    const before = await request(base);
    const fields = before.schema.fields.filter(f => allowed.includes(f.name));
    if (fields.length !== allowed.length) throw Error(`Research schema changed: ${table}`);
    const records = []; let pageToken;
    do {
      const query = new URLSearchParams({maxResults: '1000', selectedFields: fields.map(f=>f.name).join(',')});
      if(pageToken) query.set('pageToken', pageToken);
      const page = await request(`${base}/data?${query}`);
      for(const row of page.rows || []) records.push(Object.fromEntries(fields.map((f,i)=>[f.name,decodeValue(row.f[i]?.v,f)])));
      pageToken = page.pageToken;
      if (records.length > 10000) throw Error(`Research table exceeds public export limit: ${table}`);
    } while(pageToken);
    const after = await request(base);
    if (before.etag !== after.etag || Number(after.numRows) !== records.length) throw Error(`Research changed during refresh: ${table}`);
    next[table] = records; next.tableCounts[table] = records.length;
  }));
  const sourceIds = new Set(next.sources.map(s=>s.source_id));
  const experimentIds = new Set(next.experiments.map(e=>e.experiment_id));
  if (next.measurements.some(m=>!sourceIds.has(m.source_id)||!experimentIds.has(m.experiment_id))) throw Error('Research references are incomplete');
  next.exportedAt = new Date().toISOString();
  return next;
}

// One refresh per instance per TTL. Failures use the last complete data bundle
// and retry later; concurrent visitors cannot fan out BigQuery requests.
export function createResearchCache({snapshot, refresh, ttlMs=300000, now=Date.now}) {
  let bundle = snapshot, expires = 0, pending, hasLive = false, lastError = false;
  return async function getResearch() {
    if(now() >= expires && !pending) {
      pending = refresh().then(next=>{bundle=next;hasLive=true;lastError=false;expires=now()+ttlMs;})
        .catch(()=>{lastError=true;expires=now()+60000;})
        .finally(()=>{pending=null;});
    }
    if(pending) await pending;
    return {...bundle, delivery:{mode:hasLive ? (lastError?'cached-stale':'bigquery') : 'snapshot', refreshSeconds:ttlMs/1000, lastSuccess:hasLive?bundle.exportedAt:null}};
  };
}
