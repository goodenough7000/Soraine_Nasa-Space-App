//! The Rust port must return exactly what the JavaScript modules return for the
//! published data. `golden.json` is written by `tools/make-golden.mjs`.
use serde_json::Value;
use soraine_core::data::*;
use soraine_core::discovery::*;
use soraine_core::reading::*;
use soraine_core::scene_link::*;
use std::path::Path;

fn load(relative: &str) -> Value {
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join(relative);
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{}: {e}", path.display()));
    serde_json::from_str(text.trim_start_matches('\u{feff}')).unwrap()
}
fn bundle() -> Value { load("../../dist/data/research.json") }
fn golden() -> Value { load("tests/golden.json") }
fn id(row: Option<&Row>) -> Value { row.map_or(Value::Null, |r| Value::String(r.get("measurement_id"))) }
fn s(v: &Value) -> &str { v.as_str().unwrap() }

#[test]
fn join_matches_javascript() {
    let (bundle, golden) = (bundle(), golden());
    let rows = join_research(&bundle);
    assert_eq!(rows.len() as u64, golden["rowCount"].as_u64().unwrap());
    for (row, expected) in rows.iter().zip(golden["joined"].as_array().unwrap()) {
        let actual = serde_json::json!([row.get("measurement_id"), row.kind.name, row.kind.color,
            row.experiment_field("experiment_id").cloned().unwrap_or(Value::Null), row.source_field("source_id").cloned().unwrap_or(Value::Null)]);
        assert_eq!(&actual, expected);
    }
}

#[test]
fn limits_and_comparison_match_javascript() {
    let (bundle, golden) = (bundle(), golden());
    let rows = join_research(&bundle);
    for case in golden["limits"].as_array().unwrap() {
        let limits = get_limits(&rows, s(&case[0]), s(&case[1]));
        assert_eq!((id(limits.uloi), id(limits.moc)), (case[2].clone(), case[3].clone()), "{case}");
    }
    for (material, expected) in MATERIALS.iter().zip(golden["comparison"].as_array().unwrap()) {
        let actual: Vec<Value> = comparison_rows(&rows, material).into_iter().map(|(w, l)| serde_json::json!([w, id(l.uloi), id(l.moc)])).collect();
        assert_eq!(&Value::Array(actual), expected);
    }
}

#[test]
fn filters_match_javascript() {
    let (bundle, golden) = (bundle(), golden());
    let rows = join_research(&bundle);
    for case in golden["filters"].as_array().unwrap() {
        let f = &case["filter"];
        let pick = |key: &str, default: &'static str| f.get(key).and_then(Value::as_str).unwrap_or(default).to_string();
        let (query, world, material, kind) = (pick("query", ""), pick("world", "All"), pick("material", "All"), pick("kind", "All"));
        let filter = Filter { query: &query, world: &world, material: &material, kind: &kind };
        let ids: Vec<Value> = filter_rows(&rows, &filter).into_iter().map(|r| id(Some(r))).collect();
        assert_eq!(&Value::Array(ids), &case["ids"], "{f}");
    }
}

#[test]
fn csv_matches_javascript() {
    let (bundle, golden) = (bundle(), golden());
    assert_eq!(csv(&join_research(&bundle)), s(&golden["csv"]));
}

#[test]
fn reading_text_matches_javascript() {
    let (bundle, golden) = (bundle(), golden());
    let rows = join_research(&bundle);
    for case in golden["reading"].as_array().unwrap() {
        assert_eq!(reading_summary(&rows, s(&case[0]), s(&case[1])), s(&case[2]), "{case}");
    }
    for case in golden["context"].as_array().unwrap() { assert_eq!(comparison_context(s(&case[0])), s(&case[1])); }
}

#[test]
fn source_and_file_order_match_javascript() {
    let (bundle, golden) = (bundle(), golden());
    let sorted: Vec<Value> = sources_by_results(bundle["sources"].as_array().unwrap(), bundle["measurements"].as_array().unwrap())
        .into_iter().map(|s| s["source_id"].clone()).collect();
    assert_eq!(&Value::Array(sorted), &golden["sources"]);
    let original = load("../../dist/data/original-data.json");
    let files: Vec<Value> = original_files_by_relevance(original["datasets"].as_array().unwrap()).into_iter().map(|d| d["id"].clone()).collect();
    assert_eq!(&Value::Array(files), &golden["files"]);
}

#[test]
fn scene_links_match_javascript() {
    for case in golden()["links"].as_array().unwrap() {
        let args = &case["args"];
        let default = Link::default();
        let pick = |key: &str, fallback: &str| args.get(key).and_then(Value::as_str).unwrap_or(fallback).to_string();
        let (world, material, view) = (pick("world", default.world), pick("material", default.material), pick("view", default.view));
        let link = Link { world: &world, material: &material, view: &view, record: args.get("record").and_then(Value::as_str) };
        let result = research_url(&link, case["base"].as_str().unwrap_or(RESEARCH_SITE));
        match case.get("out").and_then(Value::as_str) {
            Some(expected) => assert_eq!(result.as_deref(), Ok(expected), "{case}"),
            None => assert_eq!(result.map_err(|e| e.to_string()), Err(s(&case["error"]).to_string()), "{case}"),
        }
    }
}

#[test]
fn formatting_matches_javascript() {
    let golden = golden();
    for case in golden["numbers"].as_array().unwrap() {
        let digits = case[1].as_u64().unwrap_or(1) as usize;
        assert_eq!(number(Some(&case[0]), digits), s(&case[2]), "{case}");
    }
    for case in golden["esc"].as_array().unwrap() { assert_eq!(esc(s(&case[0])), s(&case[1])); }
    for case in golden["safeUrl"].as_array().unwrap() { assert_eq!(safe_url(s(&case[0])), s(&case[1]), "{case}"); }
}

// The assertions below are the existing JavaScript unit tests, restated.
#[test]
fn ultem_comparison_preserves_the_exact_starred_moon_and_mars_metrics() {
    let bundle = bundle();
    let rows = join_research(&bundle);
    let (moon, mars) = (get_limits(&rows, "Ultem 1000", "Moon"), get_limits(&rows, "Ultem 1000", "Mars"));
    assert_eq!((moon.uloi.unwrap().value(), moon.moc.unwrap().value()), (21.0, 19.9));
    assert_eq!((mars.uloi.unwrap().value(), mars.moc.unwrap().value()), (22.0, 21.1));
    assert_eq!((moon.uloi.unwrap().metric(), moon.moc.unwrap().metric()), ("ULOI*", "MOC*"));
    assert_eq!(moon.uloi.unwrap().get("source_id"), "NTRS-20130010991");
    assert_eq!(moon.uloi.unwrap().experiment_field("pressure_kpa"), mars.uloi.unwrap().experiment_field("pressure_kpa"));
}

#[test]
fn every_result_resolves_its_experiment_and_source() {
    let bundle = bundle();
    let rows = join_research(&bundle);
    for table in ["measurements", "experiments", "sources", "evidence"] {
        assert_eq!(bundle[table].as_array().unwrap().len() as u64, bundle["tableCounts"][table].as_u64().unwrap());
    }
    assert!(rows.iter().all(|r| r.experiment.is_some() && r.source.is_some()));
    let unique: std::collections::HashSet<String> = rows.iter().map(|r| r.get("measurement_id")).collect();
    assert_eq!(unique.len(), rows.len());
}

#[test]
fn missing_evidence_never_becomes_a_numerical_comparison() {
    assert!(reading_summary(&[], "Ultem 1000", "Moon").contains("No matching published"));
    assert_eq!(number(None, 1), "Not reported");
}

/// Index and surroundings of the first difference, so a markup mismatch is quick to find.
fn first_difference(actual: &str, expected: &str) -> String {
    let at = actual.chars().zip(expected.chars()).position(|(a, b)| a != b).unwrap_or(actual.chars().count().min(expected.chars().count()));
    let around = |text: &str| text.chars().skip(at.saturating_sub(40)).take(90).collect::<String>();
    format!("differs at char {at}:\n  rust: {:?}\n  js:   {:?}", around(actual), around(expected))
}

#[test]
fn specimen_markup_matches_javascript() {
    use soraine_core::specimen::{numeric, specimen_html, Specimen};
    let golden = golden();
    let cases = golden["specimens"].as_array().unwrap();
    assert!(cases.len() > 40);
    for case in cases {
        let specimen = Specimen { material: s(&case["material"]), world: s(&case["world"]), uloi: numeric(case.get("uloi")), moc: numeric(case.get("moc")), record_id: case["recordId"].as_str() };
        let actual = specimen_html(&specimen, case["instance"].as_u64().unwrap() as u32);
        let expected = s(&case["html"]);
        assert!(actual == expected, "{} / {} / {} / {}: {}", case["material"], case["world"], case["uloi"], case["moc"], first_difference(&actual, expected));
    }
}

#[test]
fn glossary_matches_javascript() {
    use soraine_core::glossary::{definition, term, DEFINITIONS};
    let golden = golden();
    let entries = golden["glossary"].as_array().unwrap();
    assert_eq!(entries.len(), DEFINITIONS.len());
    for (entry, expected) in DEFINITIONS.iter().zip(entries) {
        assert_eq!((entry.0, entry.1, entry.2), (s(&expected[0]), s(&expected[1]), s(&expected[2])));
        assert_eq!(definition(entry.0), Some((entry.1, entry.2)));
    }
    for case in golden["terms"].as_array().unwrap() {
        assert_eq!(term(s(&case[0]), s(&case[1]), case[2].as_bool().unwrap()), s(&case[3]), "{case}");
    }
}

#[test]
fn app_helpers_and_data_match_javascript() {
    use soraine_core::views::*;
    let (bundle, golden) = (bundle(), golden());
    let rows = join_research(&bundle);
    for (entry, expected) in ICON_PATHS.iter().zip(golden["icons"].as_array().unwrap()) { assert_eq!((entry.0, entry.1), (s(&expected[0]), s(&expected[1]))); }
    for case in golden["iconMarkup"].as_array().unwrap() { assert_eq!(icon(s(&case[0])), s(&case[1])); }
    for info in &WORLD_INFO {
        let expected = &golden["worldInfo"][info.world];
        assert_eq!([info.title, info.g, info.sub, info.name, info.caption], ["title", "g", "sub", "name", "caption"].map(|key| s(&expected[key])));
    }
    assert_eq!(WORLD_INFO.len(), golden["worldInfo"].as_object().unwrap().len());
    let helpers = &golden["helpers"];
    for case in helpers["sampleText"].as_array().unwrap() { assert_eq!(sample_text(s(&case[0])), s(&case[1])); }
    for case in helpers["materialDescription"].as_array().unwrap() { assert_eq!(material_description(s(&case[0])), s(&case[1])); }
    for case in helpers["unitLabel"].as_array().unwrap() { assert_eq!(unit_label(s(&case[0])), s(&case[1])); }
    for case in helpers["fieldLabel"].as_array().unwrap() { assert_eq!(field_label(s(&case[0])), s(&case[1])); }
    for (row, case) in rows.iter().zip(helpers["evidenceLabel"].as_array().unwrap()) { assert_eq!(evidence_label(row), s(&case[1]), "{}", case[0]); }
}

#[test]
fn material_panel_and_chart_match_javascript() {
    use soraine_core::views::{chart, chart_panel, material_panel, overview};
    let (bundle, golden) = (bundle(), golden());
    let rows = join_research(&bundle);
    for view in golden["views"].as_array().unwrap() {
        let (material, world) = (s(&view["material"]), s(&view["world"]));
        let instance = view["specimenInstance"].as_u64().unwrap() as u32;
        for (actual, key) in [(material_panel(&rows, material), "materialPanel"), (chart(&rows, material, world, false), "chart"), (chart(&rows, material, world, true), "chartLarge"),
            (chart_panel(&rows, material, world, false), "chartPanel"), (chart_panel(&rows, material, world, true), "chartPanelLarge"), (overview(&rows, material, world, instance), "overview")] {
            assert!(actual == s(&view[key]), "{key} for {material} / {world}: {}", first_difference(&actual, s(&view[key])));
        }
    }
}

#[test]
fn compare_evidence_and_source_views_match_javascript() {
    use soraine_core::views::*;
    let (bundle, golden) = (bundle(), golden());
    let rows = join_research(&bundle);
    let same = |actual: String, expected: &Value, what: String| assert!(actual == s(expected), "{what}: {}", first_difference(&actual, s(expected)));
    for case in golden["metricNames"].as_array().unwrap() { assert_eq!(metric_name(s(&case[0])), s(&case[1])); }
    for case in golden["options"].as_array().unwrap() { assert_eq!(option(s(&case[0]), s(&case[1]), s(&case[2])), s(&case[3])); }
    for case in golden["compares"].as_array().unwrap() {
        same(compare(&rows, s(&case["material"]), s(&case["world"])), &case["html"], format!("compare {} {}", case["material"], case["world"]));
    }
    let cases = golden["evidenceCases"].as_array().unwrap();
    assert!(cases.len() >= 36);
    for case in cases {
        let f = &case["filter"];
        let pick = |key: &str, default: &'static str| f.get(key).and_then(Value::as_str).unwrap_or(default).to_string();
        let (query, world, material, kind) = (pick("query", ""), pick("world", "All"), pick("material", "All"), pick("kind", "All"));
        let filter = Filter { query: &query, world: &world, material: &material, kind: &kind };
        same(evidence(&rows, &filter), &case["frame"], format!("evidence frame {f}"));
        let (html, page) = evidence_results(&rows, &filter, case["page"].as_u64().unwrap() as usize);
        same(html, &case["results"], format!("evidence rows {f} page {}", case["page"]));
        assert_eq!(page as u64, case["shownPage"].as_u64().unwrap());
    }
    let cases = golden["sourceCases"].as_array().unwrap();
    assert!(cases.len() >= 36);
    for case in cases {
        let (query, kind) = (s(&case["query"]), s(&case["type"]));
        same(source_view(&bundle, query, kind), &case["frame"], format!("source frame {query:?} {kind}"));
        let (html, page) = source_results(&bundle, &rows, query, kind, case["page"].as_u64().unwrap() as usize);
        same(html, &case["results"], format!("source rows {query:?} {kind} page {}", case["page"]));
        assert_eq!(page as u64, case["shownPage"].as_u64().unwrap());
    }
}

#[test]
fn dialogs_match_javascript() {
    use soraine_core::views::{about_dialog, record_dialog, source_dialog};
    let (bundle, golden) = (bundle(), golden());
    let rows = join_research(&bundle);
    let same = |actual: String, expected: &Value, what: String| assert!(actual == s(expected), "{what}: {}", first_difference(&actual, s(expected)));
    let records = golden["recordDialogs"].as_array().unwrap();
    assert_eq!(records.len(), rows.len());
    for case in records { same(record_dialog(&rows, s(&case[0])).unwrap(), &case[1], format!("record {}", case[0])); }
    assert!(record_dialog(&rows, "E-nope").is_none());
    let sources = golden["sourceDialogs"].as_array().unwrap();
    assert!(sources.len() > 12);
    for case in sources { same(source_dialog(&bundle, &rows, s(&case[0])).unwrap(), &case[1], format!("source {}", case[0])); }
    for case in golden["aboutDialogs"].as_array().unwrap() {
        let mut next = bundle.clone();
        next["exportedAt"] = case["exportedAt"].clone();
        if let Some(mode) = case["mode"].as_str() { next["delivery"] = serde_json::json!({"mode": mode}); }
        same(about_dialog(&next), &case["html"], format!("about {} {}", case["mode"], case["exportedAt"]));
    }
}

/// A `State` from the JavaScript key names in a golden case, starting from the defaults.
fn state_from(changes: &Value) -> soraine_core::app::State {
    let mut state = soraine_core::app::State::default();
    let text = |key: &str, slot: &mut String| if let Some(value) = changes.get(key).and_then(Value::as_str) { *slot = value.to_string(); };
    text("view", &mut state.view); text("world", &mut state.world); text("material", &mut state.material); text("query", &mut state.query);
    text("filterWorld", &mut state.filter_world); text("filterMaterial", &mut state.filter_material); text("filterKind", &mut state.filter_kind);
    text("sourceQuery", &mut state.source_query); text("sourceType", &mut state.source_type); text("originalDataset", &mut state.original_dataset); text("originalQuery", &mut state.original_query);
    if let Some(page) = changes.get("page").and_then(Value::as_u64) { state.page = page as usize; }
    if let Some(page) = changes.get("sourcePage").and_then(Value::as_u64) { state.source_page = page as usize; }
    state
}

#[test]
fn page_logic_matches_javascript() {
    use soraine_core::app::*;
    let (bundle, golden) = (bundle(), golden());
    let rows = join_research(&bundle);
    for case in golden["syncUrls"].as_array().unwrap() {
        assert_eq!(sync_url(&state_from(&case["state"]), s(&case["href"])).as_deref(), Some(s(&case["out"])), "{} from {}", case["state"], case["href"]);
    }
    for case in golden["restores"].as_array().unwrap() {
        let mut state = State::default();
        let record = restore_url_state(&mut state, s(&case["search"]), s(&case["hash"]), &rows, &bundle);
        assert_eq!(state.to_json(), case["state"], "{} {}", case["search"], case["hash"]);
        assert_eq!(record.as_deref(), case["record"].as_str(), "{}", case["search"]);
    }
    for case in golden["searches"].as_array().unwrap() {
        let mut state = state_from(&serde_json::json!({"view": "sources", "world": "Mars", "material": "Mylar G", "page": 3}));
        let route = route_global_search(&mut state, &rows, s(&case["query"]));
        let navigated: Vec<&str> = case["navigated"].as_array().unwrap().iter().map(s).collect();
        let expected = match navigated.as_slice() { [] => Route::Stay, [view] => if *view == "evidence" && route == Route::SearchEvidence { Route::SearchEvidence } else { Route::Go(VIEWS.iter().copied().find(|v| v == view).unwrap()) }, _ => panic!("navigated twice") };
        assert_eq!(route, expected, "{}", case["query"]);
        assert_eq!(state.to_json(), case["state"], "{}", case["query"]);
    }
    for case in golden["labels"].as_array().unwrap() {
        let mut next = serde_json::json!({"exportedAt": case["exportedAt"]});
        if let Some(mode) = case["mode"].as_str() { next["delivery"] = serde_json::json!({"mode": mode}); }
        assert_eq!(snapshot_label(&next), s(&case["snapshot"]));
        assert_eq!(connection_label(&next), s(&case["connection"]));
    }
}
