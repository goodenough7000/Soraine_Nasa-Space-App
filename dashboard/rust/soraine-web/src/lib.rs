//! Browser entry point. For now it exposes the research logic in
//! `soraine-core` to the page; the views and the 3D stages are added here in
//! later stages (see PLAN.md).
mod page;

use serde_json::Value;
use soraine_core::data::{self, Filter, Row};
use soraine_core::scene_link::{self, Link};
use soraine_core::{discovery, reading, views};
use wasm_bindgen::prelude::*;

fn id(row: Option<&Row>) -> String { row.map(|r| r.get("measurement_id")).unwrap_or_default() }

/// The published research bundle, joined once and queried from the page.
#[wasm_bindgen]
pub struct Research {
    bundle: Value,
    rows: Vec<Row>,
}

#[wasm_bindgen]
impl Research {
    /// `bundle_json` is the text of `data/research.json` or of `/api/research`.
    #[wasm_bindgen(constructor)]
    pub fn new(bundle_json: &str) -> Result<Research, JsError> {
        let bundle: Value = serde_json::from_str(bundle_json.trim_start_matches('\u{feff}')).map_err(|e| JsError::new(&e.to_string()))?;
        let rows = data::join_research(&bundle);
        Ok(Research { bundle, rows })
    }

    #[wasm_bindgen(getter, js_name = rowCount)]
    pub fn row_count(&self) -> usize { self.rows.len() }

    /// Measurement IDs matching the filters; `"All"` leaves a dimension open.
    #[wasm_bindgen(js_name = filterIds)]
    pub fn filter_ids(&self, query: &str, world: &str, material: &str, kind: &str) -> Vec<String> {
        data::filter_rows(&self.rows, &Filter { query, world, material, kind }).into_iter().map(|r| id(Some(r))).collect()
    }

    /// `[ULOI id, MOC id]`; an empty string means no published limit.
    #[wasm_bindgen(js_name = limitIds)]
    pub fn limit_ids(&self, material: &str, world: &str) -> Vec<String> {
        let limits = data::get_limits(&self.rows, material, world);
        vec![id(limits.uloi), id(limits.moc)]
    }

    pub fn csv(&self) -> String { data::csv(&self.rows) }

    #[wasm_bindgen(js_name = readingSummary)]
    pub fn reading_summary(&self, material: &str, world: &str) -> String { reading::reading_summary(&self.rows, material, world) }

    /// Markup of the overview view for the selected material and gravity environment.
    #[wasm_bindgen(js_name = overviewHtml)]
    pub fn overview_html(&self, material: &str, world: &str, specimen_instance: u32) -> String {
        views::overview(&self.rows, material, world, specimen_instance)
    }

    /// Markup of the four-gravity oxygen-limit chart panel.
    #[wasm_bindgen(js_name = chartPanelHtml)]
    pub fn chart_panel_html(&self, material: &str, world: &str, large: bool) -> String {
        views::chart_panel(&self.rows, material, world, large)
    }

    /// Markup of the compare view.
    #[wasm_bindgen(js_name = compareHtml)]
    pub fn compare_html(&self, material: &str, world: &str) -> String { views::compare(&self.rows, material, world) }

    /// Markup of the evidence view's frame (title, filters, empty results panel).
    #[wasm_bindgen(js_name = evidenceHtml)]
    pub fn evidence_html(&self, query: &str, world: &str, material: &str, kind: &str) -> String {
        views::evidence(&self.rows, &Filter { query, world, material, kind })
    }

    /// Markup of one page of the evidence table. The page is clamped to the last one.
    #[wasm_bindgen(js_name = evidenceResultsHtml)]
    pub fn evidence_results_html(&self, query: &str, world: &str, material: &str, kind: &str, page: usize) -> String {
        views::evidence_results(&self.rows, &Filter { query, world, material, kind }, page).0
    }

    /// Markup of the source library's frame.
    #[wasm_bindgen(js_name = sourceViewHtml)]
    pub fn source_view_html(&self, query: &str, source_type: &str) -> String { views::source_view(&self.bundle, query, source_type) }

    /// Markup of one page of the source table. The page is clamped to the last one.
    #[wasm_bindgen(js_name = sourceResultsHtml)]
    pub fn source_results_html(&self, query: &str, source_type: &str, page: usize) -> String {
        views::source_results(&self.bundle, &self.rows, query, source_type, page).0
    }

    /// Markup of a measurement's detail dialog; `undefined` for an unknown id.
    #[wasm_bindgen(js_name = recordDialogHtml)]
    pub fn record_dialog_html(&self, id: &str) -> Option<String> { views::record_dialog(&self.rows, id) }

    /// Markup of a source's detail dialog; `undefined` for an unknown id.
    #[wasm_bindgen(js_name = sourceDialogHtml)]
    pub fn source_dialog_html(&self, id: &str) -> Option<String> { views::source_dialog(&self.bundle, &self.rows, id) }

    /// Markup of the "about this data" dialog.
    #[wasm_bindgen(js_name = aboutDialogHtml)]
    pub fn about_dialog_html(&self) -> String { views::about_dialog(&self.bundle) }

    /// Source IDs, most-cited first.
    #[wasm_bindgen(js_name = sourceOrder)]
    pub fn source_order(&self) -> Vec<String> {
        let list = |key: &str| self.bundle.get(key).and_then(Value::as_array).cloned().unwrap_or_default();
        let (sources, measurements) = (list("sources"), list("measurements"));
        discovery::sources_by_results(&sources, &measurements).into_iter().map(|s| data::text(s.get("source_id"))).collect()
    }
}

#[wasm_bindgen(js_name = comparisonContext)]
pub fn comparison_context(material: &str) -> String { reading::comparison_context(material).to_string() }

/// Missing (`undefined`, `null` or `""`) stays "Not reported".
#[wasm_bindgen(js_name = formatNumber)]
pub fn format_number(value: Option<String>, digits: Option<usize>) -> String {
    data::number(value.map(Value::String).as_ref(), digits.unwrap_or(1))
}

#[wasm_bindgen(js_name = researchUrl)]
pub fn research_url(world: Option<String>, material: Option<String>, view: Option<String>, record: Option<String>, base: Option<String>) -> Result<String, JsError> {
    let default = Link::default();
    let link = Link {
        world: world.as_deref().unwrap_or(default.world),
        material: material.as_deref().unwrap_or(default.material),
        view: view.as_deref().unwrap_or(default.view),
        record: record.as_deref(),
    };
    scene_link::research_url(&link, base.as_deref().unwrap_or(scene_link::RESEARCH_SITE)).map_err(|e| JsError::new(&e.to_string()))
}

/// Start the dashboard on the current page. The page's bootstrap script calls this once.
#[wasm_bindgen(js_name = startPage)]
pub fn start_page() { page::start(); }
