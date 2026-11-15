//! Port of the page logic in `dist/app.mjs` that does not touch the page:
//! the view state, how it maps to and from the address bar, and where a typed
//! question should lead. The browser crate applies the results.
use crate::data::{Row, EVIDENCE_TYPES, MATERIALS, WORLDS};
use serde_json::{json, Value};
use url::Url;

pub const VIEWS: [&str; 6] = ["overview", "experiments", "compare", "evidence", "sources", "scenes"];

/// The 3D scene (in `dist/scenes/`) that shows a gravity environment.
pub fn scene_for_world(world: &str) -> &'static str {
    match world { "Moon" => "moon", "Mars" => "mars", "Microgravity" => "orbit", _ => "earth" }
}

/// The gravity environment a 3D scene shows.
pub fn world_for_scene(scene: &str) -> Option<&'static str> {
    Some(match scene { "earth" => "Earth", "moon" => "Moon", "mars" => "Mars", "orbit" => "Microgravity", _ => return None })
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct State {
    pub view: String,
    pub world: String,
    pub material: String,
    pub query: String,
    pub filter_world: String,
    pub filter_material: String,
    pub filter_kind: String,
    pub page: usize,
    pub source_query: String,
    pub source_type: String,
    pub source_page: usize,
    pub original_dataset: String,
    pub original_query: String,
}

impl Default for State {
    fn default() -> Self {
        let all = || "All".to_string();
        State { view: "overview".into(), world: "Earth".into(), material: "Ultem 1000".into(), query: String::new(), filter_world: all(), filter_material: all(),
            filter_kind: all(), page: 0, source_query: String::new(), source_type: all(), source_page: 0, original_dataset: String::new(), original_query: String::new() }
    }
}

impl State {
    /// The state with the JavaScript object's key names, for comparison and debugging.
    pub fn to_json(&self) -> Value {
        json!({"view": self.view, "world": self.world, "material": self.material, "query": self.query, "filterWorld": self.filter_world, "filterMaterial": self.filter_material,
            "filterKind": self.filter_kind, "page": self.page, "sourceQuery": self.source_query, "sourceType": self.source_type, "sourcePage": self.source_page,
            "originalDataset": self.original_dataset, "originalQuery": self.original_query})
    }

    pub fn evidence_filter(&self) -> crate::data::Filter<'_> {
        crate::data::Filter { query: &self.query, world: &self.filter_world, material: &self.filter_material, kind: &self.filter_kind }
    }

    pub fn reset_evidence_filters(&mut self, query: &str, world: &str, material: &str) {
        self.query = query.to_string();
        self.filter_world = world.to_string();
        self.filter_material = material.to_string();
        self.filter_kind = "All".to_string();
        self.page = 0;
    }
}

const STATE_KEYS: [&str; 7] = ["world", "material", "q", "kind", "dataset", "collection", "record"];

/// The address for the current state: `href` with its state parameters replaced and the view as the fragment.
pub fn sync_url(state: &State, href: &str) -> Option<String> {
    let mut url = Url::parse(href).ok()?;
    let mut pairs: Vec<(String, String)> = url.query_pairs().filter(|(key, _)| !STATE_KEYS.contains(&key.as_ref())).map(|(k, v)| (k.into_owned(), v.into_owned())).collect();
    let mut put = |key: &str, value: &str| if !value.is_empty() { pairs.push((key.to_string(), value.to_string())); };
    match state.view.as_str() {
        "overview" | "compare" => { put("world", &state.world.to_lowercase()); put("material", &state.material); }
        "evidence" => {
            if state.filter_world != "All" { put("world", &state.filter_world.to_lowercase()); }
            if state.filter_material != "All" { put("material", &state.filter_material); }
            put("q", &state.query);
            if state.filter_kind != "All" { put("kind", &state.filter_kind); }
        }
        "experiments" => { put("dataset", &state.original_dataset); put("q", &state.original_query); }
        "sources" => { put("q", &state.source_query); if state.source_type != "All" { put("collection", &state.source_type); } }
        "scenes" => put("world", &state.world.to_lowercase()),
        _ => {}
    }
    if pairs.is_empty() { url.set_query(None); } else { url.query_pairs_mut().clear().extend_pairs(pairs); }
    url.set_fragment(Some(&state.view));
    Some(url.to_string())
}

/// Read the state from the address bar. `search` is `location.search`, `hash` is `location.hash`.
/// Returns the `record` parameter, if any, so the caller can open that record.
pub fn restore_url_state(state: &mut State, search: &str, hash: &str, rows: &[Row], bundle: &Value) -> Option<String> {
    let params: Vec<(String, String)> = url::form_urlencoded::parse(search.trim_start_matches('?').as_bytes()).into_owned().collect();
    let get = |key: &str| params.iter().find(|(k, _)| k == key).map(|(_, v)| v.clone());
    let fragment = hash.strip_prefix('#').unwrap_or(hash);
    if VIEWS.contains(&fragment) { state.view = fragment.to_string(); }
    let world_input = get("world").map(|w| w.to_lowercase());
    let world = match world_input.as_deref() {
        Some("iss") => Some("Microgravity"),
        Some(input) => WORLDS.iter().copied().find(|value| value.to_lowercase() == input),
        None => None,
    };
    if let Some(world) = world { state.world = world.to_string(); }
    let material = get("material");
    if let Some(material) = material.as_deref().filter(|m| MATERIALS.contains(m)) { state.material = material.to_string(); }
    match state.view.as_str() {
        "evidence" => {
            state.query = get("q").unwrap_or_default();
            state.filter_world = world.map(str::to_string).unwrap_or_else(|| if world_input.as_deref() == Some("earth-to-moon model") { "Earth-to-Moon model".into() } else { "All".into() });
            state.filter_material = material.filter(|m| rows.iter().any(|row| row.material() == Some(m))).unwrap_or_else(|| "All".into());
            state.filter_kind = get("kind").filter(|k| EVIDENCE_TYPES.contains(&k.as_str())).unwrap_or_else(|| "All".into());
        }
        "experiments" => { state.original_dataset = get("dataset").unwrap_or_default(); state.original_query = get("q").unwrap_or_default(); }
        "sources" => {
            state.source_query = get("q").unwrap_or_default();
            let known = |kind: &str| bundle.get("sources").and_then(Value::as_array).is_some_and(|sources| sources.iter().any(|s| s.get("source_type").and_then(Value::as_str) == Some(kind)));
            state.source_type = get("collection").filter(|c| known(c)).unwrap_or_else(|| "All".into());
        }
        _ => {}
    }
    get("record")
}

/// Lowercase, with every run of other characters turned into one space.
fn normalize(value: &str) -> String {
    let mut out = String::new();
    for c in value.to_lowercase().chars() {
        if c.is_ascii_lowercase() || c.is_ascii_digit() { out.push(c); } else if !out.ends_with(' ') { out.push(' '); }
    }
    out.trim().to_string()
}

/// Where a typed question leads.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Route {
    /// Nothing to do (the question was empty).
    Stay,
    /// Show this view.
    Go(&'static str),
    /// Show the evidence view and put the cursor in its search box.
    SearchEvidence,
}

/// Route a question from the search box, updating `state` on the way.
pub fn route_global_search(state: &mut State, rows: &[Row], query: &str) -> Route {
    let normalized = normalize(query);
    if normalized.is_empty() { return Route::Stay; }
    let words = format!(" {normalized} ");
    let has = |phrase: &str| words.contains(&format!(" {phrase} "));
    let any = |phrases: &[&str]| phrases.iter().any(|phrase| has(phrase));
    if any(&["original", "csv", "raw", "bass", "saffire"]) {
        state.original_dataset = if has("saffire") { "saffire-ii" } else if has("bass") { "bass-ii" } else { "" }.to_string();
        state.original_query = if state.original_dataset.is_empty() {
            const NOISE: [&str; 8] = ["original", "csv", "raw", "data", "records", "nasa", "show", "find"];
            normalized.split(' ').map(|token| if NOISE.contains(&token) { "" } else { token }).collect::<Vec<_>>().join(" ").trim().to_string()
        } else { String::new() };
        state.view = "experiments".to_string();
        return Route::Go("experiments");
    }
    let mut known: Vec<String> = Vec::new();
    for material in rows.iter().filter_map(Row::material).filter(|m| !m.is_empty()) { if !known.iter().any(|k| k == material) { known.push(material.to_string()); } }
    known.sort_by_key(|value| std::cmp::Reverse(value.encode_utf16().count()));
    let material = known.into_iter().find(|value| has(&normalize(value))).or_else(|| {
        [("ultem", "Ultem 1000"), ("pei", "Ultem 1000"), ("mylar", "Mylar G"), ("pet", "Mylar G"), ("nomex", "Nomex HT90-40"), ("acrylic", "PMMA"), ("p213", "P 213")]
            .iter().find(|(alias, _)| has(alias)).map(|(_, name)| name.to_string())
    });
    let found: Vec<&str> = [("Microgravity", &["microgravity", "micro g", "zero g", "orbit", "orbital", "iss"][..]), ("Moon", &["moon", "lunar"]), ("Mars", &["mars", "martian"]), ("Earth", &["earth", "1g", "1 g"])]
        .iter().filter(|(_, phrases)| any(phrases)).map(|(world, _)| *world).collect();
    let world = found.first().copied();
    let wants_comparison = any(&["compare", "comparison", "vs", "versus"]) || found.len() > 1;
    if let Some(world) = world { state.world = world.to_string(); }
    let published = material.as_deref().is_some_and(|m| MATERIALS.contains(&m));
    if published { state.material = material.clone().unwrap_or_default(); }
    if let Some(material) = material.as_deref().filter(|_| !published) {
        state.reset_evidence_filters("", if found.len() == 1 { world.unwrap_or("All") } else { "All" }, material);
        state.view = "evidence".to_string();
        return Route::Go("evidence");
    }
    if material.is_some() || world.is_some() {
        let view = if wants_comparison { "compare" } else { "overview" };
        state.view = view.to_string();
        return Route::Go(view);
    }
    state.reset_evidence_filters(query.trim(), "All", "All");
    state.view = "evidence".to_string();
    Route::SearchEvidence
}

/// Parts of an ISO timestamp such as `2026-11-15T16:17:04.123Z`.
fn iso_parts(iso: &str) -> Option<(u32, u32, u32, &str)> {
    let (date, time) = iso.strip_suffix('Z')?.split_once('T')?;
    let mut ymd = date.split('-').map(|part| part.parse::<u32>().ok());
    let (year, month, day) = (ymd.next()??, ymd.next()??, ymd.next()??);
    ((1..=12).contains(&month) && (1..=31).contains(&day) && time.len() >= 5).then(|| (year, month, day, &time[..5]))
}

/// The footer's snapshot line, e.g. `Snapshot 15 Nov 2026 · 16:17 UTC`.
pub fn snapshot_label(bundle: &Value) -> String {
    const MONTHS: [&str; 12] = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
    let prefix = if delivery_mode(bundle) == Some("bigquery") { "Refreshed " } else { "Snapshot " };
    match iso_parts(bundle.get("exportedAt").and_then(Value::as_str).unwrap_or("")) {
        Some((year, month, day, time)) => format!("{prefix}{day:02} {} {year} · {time} UTC", MONTHS[month as usize - 1]),
        None => format!("{prefix}Invalid Date"),
    }
}

pub fn delivery_mode(bundle: &Value) -> Option<&str> { bundle.pointer("/delivery/mode").and_then(Value::as_str) }

/// The header's connection label.
pub fn connection_label(bundle: &Value) -> &'static str {
    match delivery_mode(bundle) { Some("bigquery") => "BigQuery connected", Some("cached-stale") => "BigQuery cached", _ => "Saved snapshot" }
}
