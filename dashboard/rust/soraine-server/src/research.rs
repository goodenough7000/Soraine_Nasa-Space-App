//! Port of `server/research.mjs`.
use futures_util::future::{try_join_all, BoxFuture};
use serde_json::{json, Map, Value};
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::Mutex;

/// One authenticated JSON read of a BigQuery REST URL.
pub type Request = Arc<dyn Fn(String) -> BoxFuture<'static, Result<Value, String>> + Send + Sync>;

// The public API reads only these columns from these four research tables.
// The database's file paths, manifests and download logs never enter the response.
pub const PUBLIC_FIELDS: [(&str, &str); 4] = [
    ("sources", "source_id,source_type,title,url,doi,publication_date,source_authority"),
    ("experiments", "experiment_id,source_id,context_type,material,gravity_label,gravity_nominal_g,gravity_basis,platform,pressure_psia,pressure_kpa,pressure_reported,oxygen_pct,flow_speed_cm_s,flow_mode,duration_s,conditions,comparability_group,limitation"),
    ("measurements", "measurement_id,experiment_id,source_id,metric,value,unit,normalized_value,normalized_unit,conversion,evidence_type,independent_raw_trial,pdf_page,locator,reliability_label,uncertainty_value,uncertainty_unit,uncertainty_status,limitation"),
    ("evidence", "evidence_id,source_id,statement,language,evidence_type,locator,pdf_page,related_measurement_ids,reliability_label,limitation"),
];

fn name_of(field: &Value) -> &str { field.get("name").and_then(Value::as_str).unwrap_or("") }

pub fn decode_value(value: Option<&Value>, field: &Value) -> Value {
    let Some(value) = value.filter(|v| !v.is_null()) else { return Value::Null };
    let kind = field.get("type").and_then(Value::as_str).unwrap_or("");
    if field.get("mode").and_then(Value::as_str) == Some("REPEATED") {
        let mut single = field.clone();
        single["mode"] = json!("NULLABLE");
        return Value::Array(value.as_array().map(|items| items.iter().map(|item| decode_value(item.get("v"), &single)).collect()).unwrap_or_default());
    }
    if kind == "RECORD" {
        let fields = field.get("fields").and_then(Value::as_array).cloned().unwrap_or_default();
        return Value::Object(fields.iter().enumerate().map(|(i, f)| (name_of(f).to_string(), decode_value(value.pointer(&format!("/f/{i}/v")), f))).collect());
    }
    if kind == "BOOLEAN" || kind == "BOOL" { return Value::Bool(value == &json!(true) || value == &json!("true")); }
    // Preserve decimal strings exactly. Presentation handles numeric formatting.
    value.clone()
}

pub fn valid_configuration(project: &str, dataset: &str) -> bool {
    let mut chars = project.chars();
    let project_ok = chars.next().is_some_and(|c| c.is_ascii_lowercase()) && project.len() >= 2
        && chars.all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-');
    project_ok && !dataset.is_empty() && dataset.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
}

pub fn data_query(fields: &[Value], page_token: Option<&str>) -> String {
    let names: Vec<&str> = fields.iter().map(name_of).collect();
    let mut query = url::form_urlencoded::Serializer::new(String::new());
    query.append_pair("maxResults", "1000").append_pair("selectedFields", &names.join(","));
    if let Some(token) = page_token { query.append_pair("pageToken", token); }
    query.finish()
}

async fn read_table(request: Request, base: String, table: &'static str, allowed: &'static str) -> Result<(&'static str, Vec<Value>), String> {
    let allowed: Vec<&str> = allowed.split(',').collect();
    let before = request(base.clone()).await?;
    let fields: Vec<Value> = before.pointer("/schema/fields").and_then(Value::as_array).map(|all| all.iter().filter(|f| allowed.contains(&name_of(f))).cloned().collect()).unwrap_or_default();
    if fields.len() != allowed.len() { return Err(format!("Research schema changed: {table}")); }
    let (mut records, mut page_token): (Vec<Value>, Option<String>) = (Vec::new(), None);
    loop {
        let page = request(format!("{base}/data?{}", data_query(&fields, page_token.as_deref()))).await?;
        for row in page.get("rows").and_then(Value::as_array).into_iter().flatten() {
            records.push(Value::Object(fields.iter().enumerate().map(|(i, f)| (name_of(f).to_string(), decode_value(row.pointer(&format!("/f/{i}/v")), f))).collect()));
        }
        page_token = page.get("pageToken").and_then(Value::as_str).filter(|t| !t.is_empty()).map(str::to_string);
        if records.len() > 10_000 { return Err(format!("Research table exceeds public export limit: {table}")); }
        if page_token.is_none() { break; }
    }
    let after = request(base).await?;
    if before.get("etag") != after.get("etag") || soraine_core::data::to_number(after.get("numRows")) != records.len() as f64 {
        return Err(format!("Research changed during refresh: {table}"));
    }
    Ok((table, records))
}

pub async fn read_public_bundle(request: Request, project: &str, dataset: &str, snapshot: &Value) -> Result<Value, String> {
    if !valid_configuration(project, dataset) { return Err("Invalid dataset configuration".to_string()); }
    let mut next: Map<String, Value> = snapshot.as_object().cloned().unwrap_or_default();
    next.insert("project".into(), json!(project));
    next.insert("dataset".into(), json!(dataset));
    next.insert("mode".into(), json!("BigQuery cached"));
    let mut counts = snapshot.get("tableCounts").and_then(Value::as_object).cloned().unwrap_or_default();
    if let Some(exported) = snapshot.get("exportedAt") { next.insert("catalogueCountsAsOf".into(), exported.clone()); }
    let reads = PUBLIC_FIELDS.iter().map(|(table, allowed)| {
        read_table(request.clone(), format!("https://bigquery.googleapis.com/bigquery/v2/projects/{project}/datasets/{dataset}/tables/{table}"), table, allowed)
    });
    for (table, records) in try_join_all(reads).await? {
        counts.insert(table.to_string(), json!(records.len()));
        next.insert(table.to_string(), Value::Array(records));
    }
    next.insert("tableCounts".into(), Value::Object(counts));
    let ids = |table: &str, key: &str| -> HashSet<String> {
        next.get(table).and_then(Value::as_array).into_iter().flatten().filter_map(|r| r.get(key)?.as_str().map(str::to_string)).collect()
    };
    let (source_ids, experiment_ids) = (ids("sources", "source_id"), ids("experiments", "experiment_id"));
    let known = |row: &Value, key: &str, set: &HashSet<String>| row.get(key).and_then(Value::as_str).is_some_and(|id| set.contains(id));
    if next.get("measurements").and_then(Value::as_array).into_iter().flatten().any(|m| !known(m, "source_id", &source_ids) || !known(m, "experiment_id", &experiment_ids)) {
        return Err("Research references are incomplete".to_string());
    }
    next.insert("exportedAt".into(), json!(crate::iso_now()));
    Ok(Value::Object(next))
}

pub type Refresh = Arc<dyn Fn() -> BoxFuture<'static, Result<Value, String>> + Send + Sync>;
pub type Clock = Arc<dyn Fn() -> u64 + Send + Sync>;

struct CacheState { bundle: Value, expires: u64, has_live: bool, last_error: bool }

/// One refresh per instance per TTL. Failures use the last complete data bundle
/// and retry later; concurrent visitors cannot fan out BigQuery requests.
pub struct Cache { state: Mutex<CacheState>, refresh: Refresh, ttl_ms: u64, now: Clock }

pub fn system_clock() -> Clock {
    Arc::new(|| std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0))
}

impl Cache {
    pub fn new(snapshot: Value, refresh: Refresh, ttl_ms: u64, now: Clock) -> Self {
        Cache { state: Mutex::new(CacheState { bundle: snapshot, expires: 0, has_live: false, last_error: false }), refresh, ttl_ms, now }
    }

    pub async fn get(&self) -> Value {
        // The lock is held across the refresh, so visitors arriving meanwhile wait for it and share its result.
        let mut state = self.state.lock().await;
        if (self.now)() >= state.expires {
            match (self.refresh)().await {
                Ok(next) => { state.bundle = next; state.has_live = true; state.last_error = false; state.expires = (self.now)() + self.ttl_ms; }
                Err(_) => { state.last_error = true; state.expires = (self.now)() + 60_000; }
            }
        }
        let mut bundle = state.bundle.as_object().cloned().unwrap_or_default();
        let mode = if !state.has_live { "snapshot" } else if state.last_error { "cached-stale" } else { "bigquery" };
        let refresh_seconds = if self.ttl_ms.is_multiple_of(1000) { json!(self.ttl_ms / 1000) } else { json!(self.ttl_ms as f64 / 1000.0) };
        let last_success = if state.has_live { bundle.get("exportedAt").cloned().unwrap_or(Value::Null) } else { Value::Null };
        bundle.insert("delivery".into(), json!({"mode": mode, "refreshSeconds": refresh_seconds, "lastSuccess": last_success}));
        Value::Object(bundle)
    }
}
