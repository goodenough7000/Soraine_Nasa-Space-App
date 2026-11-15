//! `test/server.test.mjs` and `test/original-data.test.mjs`, restated for the Rust server.
use futures_util::FutureExt;
use serde_json::{json, Value};
use soraine_server::original::{read_original_bundle, ORIGINAL_PUBLIC_FIELDS};
use soraine_server::research::{decode_value, read_public_bundle, Cache, Request, PUBLIC_FIELDS};
use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

const PROJECT: &str = "project-89aca125-c9a5-4fdd-bb0";
const DATASET: &str = "flame_in_freefall_2026";

#[test]
fn bigquery_decoding_preserves_null_exact_decimals_booleans_and_arrays() {
    assert_eq!(decode_value(None, &json!({"type": "FLOAT"})), Value::Null);
    assert_eq!(decode_value(Some(&json!("0.000016")), &json!({"type": "FLOAT"})), json!("0.000016"));
    assert_eq!(decode_value(Some(&json!("false")), &json!({"type": "BOOLEAN"})), json!(false));
    assert_eq!(decode_value(Some(&json!([{"v": "m1"}, {"v": "m2"}])), &json!({"type": "STRING", "mode": "REPEATED"})), json!(["m1", "m2"]));
}

#[tokio::test(flavor = "multi_thread")]
async fn refreshes_are_shared_cached_and_keep_the_last_complete_result_on_failure() {
    let (clock, calls, fail) = (Arc::new(AtomicU64::new(100)), Arc::new(AtomicUsize::new(0)), Arc::new(AtomicBool::new(false)));
    let refresh = { let (calls, fail) = (calls.clone(), fail.clone()); Arc::new(move || { let (calls, fail) = (calls.clone(), fail.clone()); async move {
        calls.fetch_add(1, Ordering::SeqCst);
        tokio::time::sleep(Duration::from_millis(10)).await;
        if fail.load(Ordering::SeqCst) { Err("denied".to_string()) } else { Ok(json!({"marker": "live", "exportedAt": "2026-11-14T23:00:00Z"})) }
    }.boxed() }) };
    let now = { let clock = clock.clone(); Arc::new(move || clock.load(Ordering::SeqCst)) };
    let cache = Arc::new(Cache::new(json!({"marker": "snapshot"}), refresh, 300_000, now));
    let results = futures_util::future::join_all((0..10).map(|_| { let cache = cache.clone(); async move { cache.get().await } })).await;
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    assert!(results.iter().all(|r| r["delivery"]["mode"] == "bigquery"));
    assert_eq!(results[0]["delivery"], json!({"mode": "bigquery", "refreshSeconds": 300, "lastSuccess": "2026-11-14T23:00:00Z"}));
    cache.get().await;
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    clock.fetch_add(300_001, Ordering::SeqCst);
    fail.store(true, Ordering::SeqCst);
    let stale = cache.get().await;
    assert_eq!((stale["marker"].as_str(), stale["delivery"]["mode"].as_str()), (Some("live"), Some("cached-stale")));
    cache.get().await;
    assert_eq!(calls.load(Ordering::SeqCst), 2);
}

#[tokio::test]
async fn a_failed_first_connection_is_honestly_labelled_as_a_saved_snapshot() {
    let cache = Cache::new(json!({"measurements": []}), Arc::new(|| async { Err("denied".to_string()) }.boxed()), 300_000, soraine_server::research::system_clock());
    assert_eq!(cache.get().await["delivery"], json!({"mode": "snapshot", "refreshSeconds": 300, "lastSuccess": null}));
}

#[tokio::test]
async fn public_reads_use_only_allowed_columns_and_never_query_operational_tables() {
    let urls = Arc::new(Mutex::new(Vec::<String>::new()));
    let request: Request = { let urls = urls.clone(); Arc::new(move |url: String| { let urls = urls.clone(); async move {
        urls.lock().unwrap().push(url.clone());
        let parsed = url::Url::parse(&url).unwrap();
        if parsed.path().ends_with("/data") { return Ok(json!({"rows": []})); }
        let table = parsed.path().split('/').nth(8).unwrap().to_string();
        let allowed = PUBLIC_FIELDS.iter().find(|f| f.0 == table).unwrap().1;
        let mut fields: Vec<Value> = allowed.split(',').map(|name| json!({"name": name, "type": "STRING"})).collect();
        fields.push(json!({"name": "private_path", "type": "STRING"}));
        Ok(json!({"etag": "a", "numRows": "0", "schema": {"fields": fields}}))
    }.boxed() }) };
    let snapshot = json!({"tableCounts": {"files": 60866}, "exportedAt": "2026-11-14T00:00:00Z"});
    let result = read_public_bundle(request, "project-test", "research", &snapshot).await.unwrap();
    assert_eq!(result["measurements"], json!([]));
    for url in urls.lock().unwrap().iter() {
        assert!(!url.contains("private_path"));
        assert!(!["files", "raw_records", "download_events"].iter().any(|t| url.contains(&format!("/{t}/")) || url.ends_with(&format!("/{t}"))));
    }
    assert_eq!(result["tableCounts"]["files"], 60866);
    assert_eq!((result["mode"].as_str(), result["catalogueCountsAsOf"].as_str()), (Some("BigQuery cached"), Some("2026-11-14T00:00:00Z")));
}

#[tokio::test]
async fn incomplete_or_changing_exports_never_replace_a_valid_bundle() {
    let request: Request = Arc::new(|url: String| async move {
        Ok(if url.ends_with("/data") { json!({"rows": []}) } else { json!({"etag": "a", "numRows": "1", "schema": {"fields": []}}) })
    }.boxed());
    assert!(read_public_bundle(request, "project-test", "research", &json!({"tableCounts": {}})).await.is_err());
}

fn original_snapshot() -> Value {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../dist/data/original-data.json");
    serde_json::from_str(std::fs::read_to_string(path).unwrap().trim_start_matches('\u{feff}')).unwrap()
}

/// The table rows BigQuery would hold for the published snapshot.
fn records(snapshot: &Value) -> Vec<Value> {
    snapshot["datasets"].as_array().unwrap().iter().flat_map(|d| d["rows"].as_array().unwrap().iter().map(move |row| json!({
        "dataset_id": d["id"], "title": d["title"], "source_id": d["sourceId"], "source_url": d["sourceUrl"], "source_sha256": d["sha256"],
        "headers": d["columns"], "cells": row["cells"], "record_id": row["id"], "csv_record_number": row["csvRecordNumber"].to_string(), "row_kind": row["rowKind"],
    }))).collect()
}

fn mock(rows: Vec<Value>, changed: bool, repeated_page: bool) -> (Request, Arc<Mutex<Vec<String>>>) {
    // Reverse order proves decoding follows the returned schema, not a hardcoded order.
    let fields: Vec<Value> = ORIGINAL_PUBLIC_FIELDS.iter().rev().map(|(name, kind)| {
        if matches!(*name, "headers" | "cells") { json!({"name": name, "type": kind, "mode": "REPEATED"}) } else { json!({"name": name, "type": kind}) }
    }).collect();
    let (urls, metadata_reads, rows) = (Arc::new(Mutex::new(Vec::new())), Arc::new(AtomicUsize::new(0)), Arc::new(rows));
    let request: Request = { let urls = urls.clone(); Arc::new(move |input: String| {
        let (urls, metadata_reads, rows, fields) = (urls.clone(), metadata_reads.clone(), rows.clone(), fields.clone());
        async move {
            urls.lock().unwrap().push(input.clone());
            let url = url::Url::parse(&input).unwrap();
            assert!(url.path().ends_with("/tables/public_experiment_rows") || url.path().ends_with("/tables/public_experiment_rows/data"));
            let names: Vec<String> = fields.iter().map(|f| f["name"].as_str().unwrap().to_string()).collect();
            if !url.path().ends_with("/data") {
                let etag = if changed && metadata_reads.fetch_add(1, Ordering::SeqCst) > 0 { "new" } else { "original" };
                let mut schema = fields.clone();
                schema.push(json!({"name": "local_path", "type": "STRING"}));
                return Ok(json!({"numRows": rows.len().to_string(), "etag": etag, "schema": {"fields": schema}}));
            }
            let param = |key: &str| url.query_pairs().find(|(k, _)| k == key).map(|(_, v)| v.into_owned());
            assert_eq!(param("selectedFields").unwrap(), names.join(","));
            let offset: usize = param("pageToken").map_or(0, |t| t.parse().unwrap());
            let page: Vec<Value> = rows.iter().skip(offset).take(70).map(|row| json!({"f": fields.iter().map(|field| {
                let value = &row[field["name"].as_str().unwrap()];
                if field.get("mode").is_some() { json!({"v": value.as_array().unwrap().iter().map(|v| json!({"v": v})).collect::<Vec<_>>()}) } else { json!({"v": value}) }
            }).collect::<Vec<_>>()})).collect();
            let mut body = json!({"rows": page});
            if offset + 70 < rows.len() { body["pageToken"] = json!(if repeated_page { "70".to_string() } else { (offset + 70).to_string() }); }
            Ok(body)
        }.boxed()
    }) };
    (request, urls)
}

async fn read(rows: Vec<Value>, changed: bool, repeated_page: bool) -> Result<Value, String> {
    read_original_bundle(mock(rows, changed, repeated_page).0, PROJECT, DATASET).await
}

#[tokio::test]
async fn serves_every_original_csv_string_and_public_provenance_across_paginated_reads() {
    let snapshot = original_snapshot();
    let rows = records(&snapshot);
    let (request, urls) = mock(rows.clone(), false, false);
    let result = read_original_bundle(request, PROJECT, DATASET).await.unwrap();
    assert_eq!(result["datasets"], snapshot["datasets"]);
    assert!(result["exportedAt"].as_str().is_some_and(|t| t.len() == 24 && t.ends_with('Z')));
    let counts: Vec<(String, usize)> = result["datasets"].as_array().unwrap().iter().map(|d| (d["id"].as_str().unwrap().to_string(), d["rows"].as_array().unwrap().len())).collect();
    let expected = [("bass", 122), ("bass-ii", 129), ("saffire-i", 4), ("saffire-ii", 15), ("saffire-iii", 2), ("same-r", 109)];
    assert_eq!(counts, expected.map(|(id, n)| (id.to_string(), n)));
    let dataset = |id: &str| result["datasets"].as_array().unwrap().iter().find(|d| d["id"] == id).unwrap().clone();
    let kinds = |id: &str, kind: &str| dataset(id)["rows"].as_array().unwrap().iter().filter(|row| row["rowKind"] == kind).count();
    assert_eq!(dataset("bass-ii")["rows"][1]["cells"][12], "1.6");
    assert_eq!((kinds("saffire-ii", "source_note"), kinds("saffire-ii", "pretest_reference"), kinds("saffire-i", "pretest_reference")), (4, 2, 2));
    assert_eq!(dataset("saffire-i")["rows"][1]["cells"][6], "~ 21.5");
    assert_eq!(dataset("saffire-i")["rows"][0]["cells"][9], "420");
    assert_eq!(dataset("same-r")["rows"][1]["cells"][7], "");
    assert_eq!(dataset("same-r")["rows"][24]["cells"][4], "0");
    assert!(!result.to_string().contains("local_path"));
    assert_eq!(urls.lock().unwrap().iter().filter(|url| url.contains("/data?")).count(), rows.len().div_ceil(70));
}

#[tokio::test]
async fn rejects_changed_duplicated_broken_inconsistent_foreign_and_private_rows() {
    let rows = records(&original_snapshot());
    assert!(read(rows.clone(), true, false).await.unwrap_err().contains("changed during refresh"));
    let mut duplicated = rows.clone();
    duplicated.push(rows[0].clone());
    assert!(read(duplicated, false, false).await.unwrap_err().contains("duplicated"));
    let mut broken = rows.clone();
    broken[0]["cells"].as_array_mut().unwrap().pop();
    assert!(read(broken, false, false).await.unwrap_err().contains("CSV row is invalid"));
    let mut changed_header = rows.clone();
    changed_header[1]["headers"][0] = json!("Changed column");
    assert!(read(changed_header, false, false).await.unwrap_err().contains("provenance changed"));
    let mut foreign = rows.clone();
    foreign[0]["source_url"] = json!("https://example.com/download");
    assert!(read(foreign, false, false).await.unwrap_err().contains("provenance is invalid"));
    let mut private_row = rows.clone();
    private_row[0]["cells"][0] = json!("C:\\Users\\someone\\private.csv");
    assert!(read(private_row, false, false).await.unwrap_err().contains("CSV row is invalid"));
}

#[tokio::test]
async fn requires_every_dataset_stops_repeated_pages_and_checks_configuration_first() {
    let rows = records(&original_snapshot());
    let only_one: Vec<Value> = rows.iter().filter(|row| row["dataset_id"] == "bass-ii").cloned().collect();
    assert!(read(only_one, false, false).await.unwrap_err().contains("incomplete"));
    assert!(read(rows, false, true).await.unwrap_err().contains("pagination repeated"));
    let never: Request = Arc::new(|_| async { panic!("request should not occur") }.boxed());
    assert!(read_original_bundle(never, PROJECT, "../private").await.unwrap_err().contains("Invalid original-data configuration"));
}
