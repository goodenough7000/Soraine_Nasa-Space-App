//! Port of `server/original-data.mjs`.
//! This reader cannot access the private file catalogue or ingestion paths.
use crate::research::{data_query, decode_value, valid_configuration, Request};
use regex::Regex;
use serde_json::{json, Value};
use std::collections::HashSet;
use std::sync::LazyLock;

pub const ORIGINAL_PUBLIC_FIELDS: [(&str, &str); 10] = [
    ("dataset_id", "STRING"), ("title", "STRING"), ("source_id", "STRING"), ("source_url", "STRING"), ("source_sha256", "STRING"),
    ("headers", "STRING"), ("cells", "STRING"), ("record_id", "STRING"), ("csv_record_number", "INTEGER"), ("row_kind", "STRING"),
];
/// (id, title, source, investigation)
const DATASETS: [(&str, &str, &str, &str); 6] = [
    ("bass", "BASS", "CSV-67a3768509ed061032c125fb", "PSI-26"),
    ("bass-ii", "BASS-II", "CSV-fa0a9a6e384c7e455825173a", "PSI-25"),
    ("saffire-i", "Saffire-I", "CSV-6792c46eb7b6ff8e65037f3e", "PSI-98"),
    ("saffire-ii", "Saffire-II", "CSV-e7a94940d9d2f3c035985141", "PSI-99"),
    ("saffire-iii", "Saffire-III", "CSV-6792d422b7b6ff8e650381da", "PSI-100"),
    ("same-r", "SAME-R", "CSV-679a9e2209ed061032c0cd23", "PSI-101"),
];
const ROW_KINDS: [&str; 4] = ["source_record", "test_record", "source_note", "pretest_reference"];
const MAX_ROWS: usize = 5000;
const MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_991.0;

// Email addresses, user-folder paths and network shares must never be published.
// (Case folding here is Unicode-aware, so it rejects slightly more than the JavaScript pattern.)
static PRIVATE_CONTENT: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|[a-z]:[\\/](?:Users|home|Documents)[\\/]|\\\\[^\s\\]+\\").expect("valid pattern")
});

fn text<'a>(record: &'a Value, key: &str) -> &'a str { record.get(key).and_then(Value::as_str).unwrap_or("") }
fn hex(value: &str, length: usize) -> bool { value.len() == length && value.bytes().all(|b| b.is_ascii_hexdigit()) }
fn safe_integer(value: f64) -> bool { value.is_finite() && value.fract() == 0.0 && value.abs() <= MAX_SAFE_INTEGER }

fn public_source_url(value: &str, investigation: &str) -> bool {
    let Ok(url) = url::Url::parse(value) else { return false };
    let first = |key: &str| url.query_pairs().find(|(k, _)| k == key).map(|(_, v)| v.into_owned()).unwrap_or_default();
    url.scheme() == "https" && url.host_str() == Some("psi.nasa.gov") && url.port().is_none()
        && url.username().is_empty() && url.password().is_none() && url.fragment().is_none_or(str::is_empty)
        && url.path() == format!("/geode-py/ws/studies/{investigation}/download")
        && hex(&first("file"), 24)
        && { let version = first("version"); !version.is_empty() && version.bytes().all(|b| b.is_ascii_digit()) }
        && url.query_pairs().all(|(key, _)| key == "file" || key == "version")
}

fn original_strings(values: Option<&Value>) -> Option<Vec<String>> {
    let values = values?.as_array()?;
    if values.is_empty() || values.len() > 100 { return None; }
    values.iter().map(|value| {
        let text = value.as_str()?;
        (text.encode_utf16().count() <= 10_000 && !PRIVATE_CONTENT.is_match(text)).then(|| text.to_string())
    }).collect()
}

struct Group { id: String, title: String, source_id: String, source_url: String, sha256: String, columns: Vec<String>, rows: Vec<(f64, Value)> }

fn assemble(records: &[Value]) -> Result<Value, String> {
    let (mut groups, mut ids, mut positions): (Vec<Group>, HashSet<String>, HashSet<String>) = (Vec::new(), HashSet::new(), HashSet::new());
    for record in records {
        let dataset_id = text(record, "dataset_id");
        let valid = DATASETS.iter().find(|d| d.0 == dataset_id).is_some_and(|(_, title, source, investigation)| {
            text(record, "title") == *title && text(record, "source_id") == *source
                && public_source_url(text(record, "source_url"), investigation) && hex(text(record, "source_sha256"), 64)
        });
        if !valid { return Err("Original data provenance is invalid".to_string()); }
        let number = soraine_core::data::to_number(record.get("csv_record_number"));
        let record_id = text(record, "record_id");
        let id_ok = (1..=160).contains(&record_id.len()) && record_id.bytes().all(|b| b.is_ascii_alphanumeric() || matches!(b, b':' | b'_' | b'-'));
        let (headers, cells) = (original_strings(record.get("headers")), original_strings(record.get("cells")));
        let (Some(headers), Some(cells)) = (headers, cells) else { return Err("Original CSV row is invalid".to_string()) };
        if !id_ok || !safe_integer(number) || number < 2.0 || !ROW_KINDS.contains(&text(record, "row_kind")) || headers.len() != cells.len() {
            return Err("Original CSV row is invalid".to_string());
        }
        if !ids.insert(record_id.to_string()) || !positions.insert(format!("{dataset_id}:{number}")) { return Err("Original CSV row is duplicated".to_string()); }
        if !groups.iter().any(|g| g.id == dataset_id) {
            groups.push(Group { id: dataset_id.to_string(), title: text(record, "title").to_string(), source_id: text(record, "source_id").to_string(),
                source_url: text(record, "source_url").to_string(), sha256: text(record, "source_sha256").to_string(), columns: headers.clone(), rows: Vec::new() });
        }
        let group = groups.iter_mut().find(|g| g.id == dataset_id).expect("group was just ensured");
        if group.source_id != text(record, "source_id") || group.source_url != text(record, "source_url") || group.sha256 != text(record, "source_sha256") || group.columns != headers {
            return Err("Original CSV provenance changed within a dataset".to_string());
        }
        // Source strings, blanks, units, approximations and notes remain unchanged.
        group.rows.push((number, json!({"id": record_id, "csvRecordNumber": number as u64, "cells": cells, "rowKind": text(record, "row_kind")})));
    }
    if groups.len() != DATASETS.len() { return Err("Original datasets are incomplete".to_string()); }
    groups.sort_by(|a, b| soraine_core::discovery::compare_titles(&a.id, &b.id));
    let datasets: Vec<Value> = groups.into_iter().map(|mut group| {
        group.rows.sort_by(|a, b| a.0.total_cmp(&b.0));
        json!({"id": group.id, "title": group.title, "sourceId": group.source_id, "sourceUrl": group.source_url, "sha256": group.sha256,
               "columns": group.columns, "rows": group.rows.into_iter().map(|row| row.1).collect::<Vec<_>>()})
    }).collect();
    Ok(json!({"exportedAt": crate::iso_now(), "datasets": datasets}))
}

// The caller's separate cache owns snapshot fallback and retry timing.
pub async fn read_original_bundle(request: Request, project: &str, dataset: &str) -> Result<Value, String> {
    if !valid_configuration(project, dataset) { return Err("Invalid original-data configuration".to_string()); }
    let base = format!("https://bigquery.googleapis.com/bigquery/v2/projects/{project}/datasets/{dataset}/tables/public_experiment_rows");
    let before = request(base.clone()).await?;
    let total = soraine_core::data::to_number(before.get("numRows"));
    if !safe_integer(total) || total < 1.0 || total > MAX_ROWS as f64 { return Err("Original data exceeds public export limit".to_string()); }
    let expected = |name: &str| ORIGINAL_PUBLIC_FIELDS.iter().find(|f| f.0 == name).map(|f| f.1);
    let name = |field: &Value| field.get("name").and_then(Value::as_str).unwrap_or("").to_string();
    let fields: Vec<Value> = before.pointer("/schema/fields").and_then(Value::as_array).map(|all| all.iter().filter(|f| expected(&name(f)).is_some()).cloned().collect()).unwrap_or_default();
    let schema_ok = fields.len() == ORIGINAL_PUBLIC_FIELDS.len() && fields.iter().all(|field| {
        let repeated = field.get("mode").and_then(Value::as_str) == Some("REPEATED");
        field.get("type").and_then(Value::as_str) == expected(&name(field)) && repeated == matches!(name(field).as_str(), "headers" | "cells")
    });
    if !schema_ok { return Err("Original-data schema changed".to_string()); }

    let (mut records, mut tokens, mut page_token): (Vec<Value>, HashSet<String>, Option<String>) = (Vec::new(), HashSet::new(), None);
    loop {
        let page = request(format!("{base}/data?{}", data_query(&fields, page_token.as_deref()))).await?;
        for row in page.get("rows").and_then(Value::as_array).into_iter().flatten() {
            records.push(Value::Object(fields.iter().enumerate().map(|(i, field)| (name(field), decode_value(row.pointer(&format!("/f/{i}/v")), field))).collect()));
        }
        if records.len() > MAX_ROWS { return Err("Original data exceeds public export limit".to_string()); }
        page_token = page.get("pageToken").and_then(Value::as_str).filter(|t| !t.is_empty()).map(str::to_string);
        match &page_token {
            Some(token) => if !tokens.insert(token.clone()) { return Err("Original data pagination repeated".to_string()); },
            None => break,
        }
    }
    let after = request(base).await?;
    if before.get("etag") != after.get("etag") || total != records.len() as f64 || soraine_core::data::to_number(after.get("numRows")) != records.len() as f64 {
        return Err("Original data changed during refresh".to_string());
    }
    assemble(&records)
}
