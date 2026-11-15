//! Port of the markup functions in `dist/app.mjs`. Each returns the same HTML
//! string as its JavaScript counterpart; the browser crate puts it on the page.
use crate::data::{comparison_rows, esc, number, Row, MATERIALS};
use crate::glossary::term;
pub use crate::app_data::{WorldInfo, ICON_PATHS, WORLD_INFO};
use serde_json::Value;

pub fn world_info(world: &str) -> Option<&'static WorldInfo> { WORLD_INFO.iter().find(|info| info.world == world) }

/// JavaScript's default number-to-string for the magnitudes used in markup.
fn js_number(value: f64) -> String { if value.is_nan() { "NaN".to_string() } else { format!("{value}") } }

pub fn icon(name: &str) -> String {
    let path = ICON_PATHS.iter().find(|entry| entry.0 == name).or_else(|| ICON_PATHS.iter().find(|entry| entry.0 == "orbit")).map_or("", |entry| entry.1);
    format!("<svg class=\"icon\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"{path}\"/></svg>")
}

/// Escaped text with the polymer abbreviations turned into glossary terms.
pub fn sample_text(value: &str) -> String {
    let (escaped, mut out, mut i) = (esc(value), String::new(), 0);
    let bytes = escaped.as_bytes();
    let word = |b: u8| b.is_ascii_alphanumeric() || b == b'_';
    'scan: while i < bytes.len() {
        if i == 0 || !word(bytes[i - 1]) {
            for key in ["PEI", "PET", "PMMA"] {
                let end = i + key.len();
                if escaped[i..].starts_with(key) && bytes.get(end).is_none_or(|b| !word(*b)) {
                    out.push_str(&term(key, key, false));
                    i = end;
                    continue 'scan;
                }
            }
        }
        let next = escaped[i..].chars().next().map_or(1, char::len_utf8);
        out.push_str(&escaped[i..i + next]);
        i += next;
    }
    out
}

pub fn material_description(material: &str) -> &'static str {
    match material {
        "Ultem 1000" => "Polyetherimide (PEI), tested here as a thin polymer film.",
        "Mylar G" => "Polyethylene terephthalate (PET), a polyester film.",
        "Nomex HT90-40" => "An aramid fabric, tested here as a thin woven specimen.",
        _ => "",
    }
}

fn labelled(key: Option<&str>, label: &str) -> String { key.map_or_else(|| esc(label), |key| term(key, label, false)) }

pub fn unit_label(value: &str) -> String {
    labelled(match value { "O2 molar percent" => Some("oxygen"), "O2 percentage points" => Some("pp"), "cm/s" => Some("cmps"), _ => None }, value)
}

pub fn evidence_label(row: &Row) -> String {
    labelled(match row.evidence_type() {
        "reported_experimental_limit_aggregate" => Some("published"),
        "reported_fit_to_experimental_data" => Some("fitted"),
        "reported_experimental_summary" => Some("summary"),
        "source_derived_from_limit_aggregates" => Some("derived"),
        "model_derived_compensation_from_experiments" => Some("model"),
        _ => None,
    }, &row.kind.name)
}

pub fn field_label(label: &str) -> String {
    labelled(match label { "Test pressure" => Some("kPa"), "Oxygen" => Some("oxygen"), "Airflow" => Some("airflow"), _ => None }, label)
}

/// The material picker; `selected` is the material in focus.
pub fn material_panel(rows: &[Row], selected: &str) -> String {
    let buttons: String = MATERIALS.iter().zip(["polymer", "film", "fabric"]).map(|(material, mark)| {
        let active = *material == selected;
        format!("<button data-material=\"{0}\" class=\"{1}\" aria-pressed=\"{active}\"><span class=\"sample-mark\">{2}</span>{0}<span class=\"count\">{3}</span></button>",
            esc(material), if active { "active" } else { "" }, icon(mark), rows.iter().filter(|r| r.material() == Some(material)).count())
    }).collect();
    format!("<section class=\"panel material-panel\"><div class=\"panel-head\">Oxygen-limit comparison<span class=\"tiny\">2012 study</span></div><div class=\"material-list\">{buttons}</div><button class=\"material-library-link text-link\" data-browse-materials=\"true\">Browse all reported materials {}</button></section>", icon("arrow"))
}

/// The four-gravity oxygen-limit chart for `material`, with `world` highlighted.
pub fn chart(rows: &[Row], material: &str, world: &str, large: bool) -> String {
    let scale: String = [0, 10, 20, 30].iter().map(|n| format!("<span>{n}</span>")).collect();
    let ticks: String = (0..4).map(|n| format!("<i class=\"limit-tick\" style=\"left:{}%\"></i>", js_number(f64::from(n) / 3.0 * 100.0))).collect();
    let entries: String = comparison_rows(rows, material).into_iter().map(|(entry_world, limits)| {
        let record = [limits.uloi, limits.moc].into_iter().flatten().map(|r| r.get("measurement_id")).find(|id| !id.is_empty()).unwrap_or_default();
        let points: String = [(limits.uloi, "uloi"), (limits.moc, "moc")].into_iter().filter_map(|(row, kind)| {
            let left = row?.value() / 30.0 * 100.0;
            Some(format!("<i class=\"limit-point {kind}\" style=\"left:{}%\"></i>", js_number(if left.is_nan() { left } else { left.clamp(0.0, 100.0) })))
        }).collect();
        let reading = |row: Option<&Row>| row.map_or("—".to_string(), |r| number(r.field("value"), 1));
        format!("<button class=\"limit-row {selected}\" data-record=\"{record}\" aria-label=\"Open {entry_world} {material} oxygen-limit source\">\n <span class=\"limit-world\"><i class=\"world-glyph world-{glyph}\" aria-hidden=\"true\"></i><span>{name}<small>{pressure} kPa</small></span></span>\n <span class=\"limit-track\" aria-hidden=\"true\">{ticks}{points}</span>\n <span class=\"limit-number uloi\">{uloi}<small>%</small></span><span class=\"limit-number moc\">{moc}<small>%</small></span>\n </button>",
            selected = if entry_world == world { "selected" } else { "" }, record = esc(&record), glyph = entry_world.to_lowercase(),
            name = if entry_world == "Microgravity" { "Micro-g" } else { entry_world },
            pressure = number(limits.uloi.and_then(|r| r.experiment_field("pressure_kpa")), 1), uloi = reading(limits.uloi), moc = reading(limits.moc))
    }).collect();
    format!("<div class=\"limit-chart {}\" aria-label=\"Published oxygen limits for {}. Separate experimental observations.\">\n <div class=\"limit-chart-head\"><span>Gravity / pressure</span><div class=\"limit-scale\">{scale}</div><span>{}</span><span>{}</span></div>\n {entries}<div class=\"limit-chart-foot\"><span>Oxygen concentration (%) · each point is a reported limit</span><span>Tap a row for its source ↗</span></div></div>",
        if large { "limit-chart-large" } else { "" }, esc(material), term("ULOI", "ULOI / *", false), term("MOC", "MOC / *", false))
}

pub fn chart_panel(rows: &[Row], material: &str, world: &str, large: bool) -> String {
    let t = |key: &str| term(key, key, false);
    format!("<section class=\"panel chart-panel\"><div class=\"panel-head\"><span>How the reported limits compare</span><span class=\"tiny\">{}</span></div><div class=\"legend\"><span><i style=\"background:#36a7ff\"></i>{} / {}</span><span><i style=\"background:#b7d9ff\"></i>{} / {}</span></div>{}<p class=\"chart-note\">{} Starred low-g limits use short-duration flame survival or extinction. Earth tests use different burn criteria. <a href=\"https://ntrs.nasa.gov/citations/20130010991\" target=\"_blank\" rel=\"noopener noreferrer\">Table I, p. 6 ↗</a></p></section>",
        esc(material), t("ULOI"), t("ULOI*"), t("MOC"), t("MOC*"), chart(rows, material, world, large), term("asterisk", "*", false))
}

/// The overview: environment picker, planet stage, and the material in focus.
/// `specimen_instance` numbers the specimen card (see [`crate::specimen::specimen_html`]).
pub fn overview(rows: &[Row], material: &str, world: &str, specimen_instance: u32) -> String {
    use crate::specimen::{numeric, specimen_html, Specimen};
    let micro = world == "Microgravity";
    let info = world_info(world);
    let field = |pick: fn(&WorldInfo) -> &'static str| info.map_or("", pick);
    let limits = crate::data::get_limits(rows, material, world);
    let experiment = limits.uloi.and_then(|r| r.experiment.as_ref());
    let conditions = experiment.and_then(|e| e.get("conditions")).and_then(Value::as_str).filter(|c| !c.is_empty()).unwrap_or("Published sample");
    let record = limits.uloi.map(|r| r.get("measurement_id")).unwrap_or_default();
    let picker: String = ["Earth", "Microgravity", "Moon", "Mars"].iter().enumerate().map(|(i, w)| {
        let active = *w == world;
        format!("<button data-world=\"{w}\" class=\"{}\" aria-pressed=\"{active}\" aria-label=\"{w}\"><span class=\"world-index\">0{}</span>{}<span class=\"world-indicator\"></span></button>",
            if active { "active" } else { "" }, i + 1, if *w == "Microgravity" { "Micro-g" } else { w })
    }).collect();
    let specimen = specimen_html(&Specimen {
        material, world,
        uloi: limits.uloi.and_then(|r| numeric(r.field("value"))),
        moc: limits.moc.and_then(|r| numeric(r.field("value"))),
        record_id: limits.uloi.map(|_| record.as_str()),
    }, specimen_instance);
    let pair: String = [(limits.uloi, "ULOI"), (limits.moc, "MOC")].into_iter().map(|(row, label)| {
        let key = row.map(|r| r.metric()).filter(|metric| !metric.is_empty()).unwrap_or(label);
        format!("<div><div class=\"label\">{}</div><strong>{}<small>%</small></strong><div class=\"subtle\">{}</div></div>",
            term(key, key, false), row.map_or("—".to_string(), |r| number(r.field("value"), 8)), term("oxygen", "oxygen, molar", false))
    }).collect();
    format!("<div class=\"mission-overview\"><div class=\"mission-toolbar\"><span class=\"label\">01 / Choose an environment</span><div class=\"world-picker\" aria-label=\"Gravity context\">{picker}</div></div>\n <div class=\"mission-grid\">\n  <section class=\"space-panel\" aria-label=\"Interactive planet context\">\n   <div id=\"globe\" aria-label=\"{globe_label}\" role=\"img\"><div class=\"globe-fallback\"></div></div>\n   <div class=\"space-top\"><span class=\"space-label\">{title}</span><span class=\"space-reference\">{reference}</span></div>\n   <div class=\"space-caption\"><span class=\"label\">FLAME IN FREEFALL</span><h2>{name}</h2><p>{caption}</p></div>\n   <div class=\"space-foot\"><span>{view_kind} <span class=\"foot-dot\">·</span> Drag to explore</span><div class=\"globe-actions\"><button id=\"zoom-in\" aria-label=\"Zoom in\" title=\"Zoom in\">+</button><button id=\"zoom-out\" aria-label=\"Zoom out\" title=\"Zoom out\">−</button><button id=\"rotate-toggle\" aria-label=\"Pause rotation\" title=\"Pause rotation\">{pause}</button><button id=\"reset-globe\" aria-label=\"Reset globe\" title=\"Reset globe\">{reset}</button></div></div>\n  </section>\n  <aside class=\"research-column\" aria-label=\"Selected material research\">\n   {panel}\n   <section class=\"panel focus-panel\"><div class=\"label\">02 / Material in focus</div><div class=\"focus-heading\"><h2>{material_text}</h2><span class=\"chip\">{published}</span></div><p class=\"focus-sub\">{description}<br>Study specimen: {sample} <span> / </span> {world}</p>\n    <div class=\"focus-inspector-grid\">{specimen}\n    <div class=\"focus-values\"><div class=\"limit-pair\">{pair}</div>\n    <dl class=\"condition-list\"><div><dt>Test pressure</dt><dd>{pressure} {kpa}</dd></div><div><dt>{gravity_label}</dt><dd>{g} {g_term}</dd></div><div><dt>Source</dt><dd>NASA {ntrs} · Table I</dd></div></dl>\n    <button class=\"primary-btn wide\" data-view=\"compare\">Compare across gravity {arrow}</button>\n    </div></div>\n   </section>\n   <div class=\"reading-summary\"><span class=\"label\">READ THE RESULT</span><p>{reading}</p></div>\n   <div class=\"research-footnote\"><span class=\"note-number\">↳</span><div><p>These are tests of ignited samples, not a prediction of habitat fire risk.</p><button class=\"text-link\" data-record=\"{record}\">Read the conditions {arrow}</button></div></div>\n\n  </aside>\n </div>\n </div>",
        globe_label = if micro { "Drag to explore the illustrative orbital laboratory" } else { "Drag or swipe sideways to rotate the decorative planet" },
        title = field(|i| i.title),
        reference = if micro { "NEAR-WEIGHTLESS <span>/ FREE FALL</span>".to_string() } else { format!("{} g <span>/ NOMINAL</span>", field(|i| i.g)) },
        name = field(|i| i.name), caption = field(|i| i.caption),
        view_kind = if micro { "Illustrative orbital habitat" } else { "Illustrative view" },
        pause = icon("pause"), reset = icon("reset"), panel = material_panel(rows, material), material_text = esc(material),
        published = term("published", "Published", false), description = sample_text(material_description(material)), sample = sample_text(conditions),
        pressure = number(experiment.and_then(|e| e.get("pressure_kpa")), 1), kpa = term("kPa", "kPa absolute", false),
        gravity_label = if micro { "Effective acceleration" } else { "Gravity category" }, g = field(|i| i.g),
        g_term = term(if micro { "microgravity" } else { "g" }, "g", false), ntrs = term("NTRS", "NTRS", false), arrow = icon("arrow"),
        reading = esc(&crate::reading::reading_summary(rows, material, world)), record = esc(&record))
}

/// Display name for a measurement's metric.
pub fn metric_name(metric: &str) -> String {
    if metric == "reported_delta_O2_vs_1g" { return term("oxygenDelta", "Δ oxygen vs. Earth", false); }
    if crate::glossary::definition(metric).is_some() { return term(metric, metric, false); }
    match metric {
        "flame_base_speed_fit" => "Flame-base speed (fit)".to_string(),
        "flame_tip_speed_fit" => "Flame-tip speed (fit)".to_string(),
        "flame_base_speed_reported" => "Flame-base speed".to_string(),
        "lunar_compensation_delta_at_assumed_35_cm_s" => "Lunar compensation at 35 cm/s".to_string(),
        "O2_vs_flow_best_fit_slope" => "O₂–flow slope (best fit)".to_string(),
        "O2_vs_flow_95pct_conservative_slope" => "O₂–flow slope (conservative)".to_string(),
        other => esc(other),
    }
}

/// The compare view: one material across the four gravity environments.
pub fn compare(rows: &[Row], material: &str, world: &str) -> String {
    let selected = crate::data::get_limits(rows, material, "Moon").uloi;
    let experiment = |key: &str| selected.and_then(|r| r.experiment_field(key));
    format!(r##"<div class="view-title-row"><div><div class="eyebrow">MATERIAL COMPARISON</div><h2>One material. Four environments.</h2><p>Follow the published oxygen limits across gravity, with the original test conditions kept in view.</p></div><button class="export-btn" id="export-comparison">{download}Export comparison</button></div><div class="compare-layout"><div class="left-stack">{panel}<section class="panel note-panel"><div class="note-title">{info}Compare with context</div><p>{conditions}<br>{kpa} {kpa_term} ({psia} {psia_term})</p><p>These are terrestrial experiments that reproduce gravity conditions. They are not fires measured on the lunar or Martian surface.</p></section></div><div class="compare-main">{chart}<div class="science-note"><h3>What this comparison can tell us</h3><p class="comparison-takeaway">{takeaway}</p><p>{context} Nomex was tested at 101.3 kPa; the polymer films at 70.3 kPa. This is not a ranking of the safest material.</p><p>{same} The starred low-gravity values describe flame survival or extinction during short drop tests; the Earth values use different burn criteria. Read them alongside the methods, not as interchangeable safety thresholds. No curve or predicted intermediate-gravity value is inferred here.</p><a href="{url}" target="_blank" rel="noopener noreferrer">Olson & Ferkul · 2012 · Table I, PDF page 6 ↗</a></div></div></div>"##,
        download = icon("download"), panel = material_panel(rows, material), info = icon("info"),
        conditions = sample_text(&crate::data::text(experiment("conditions"))),
        kpa = number(experiment("pressure_kpa"), 1), kpa_term = term("kPa", "kPa absolute", false),
        psia = number(experiment("pressure_psia"), 1), psia_term = term("psia", "psia", false),
        chart = chart_panel(rows, material, world, true),
        takeaway = esc(&crate::reading::reading_summary(rows, material, "Moon")), context = esc(crate::reading::comparison_context(material)),
        same = if material == "Mylar G" { "Mylar G is compared with the related but distinct Melinex 515 film in the Earth reference." } else { "The same material has different reported oxygen limits in different gravity conditions." },
        url = crate::data::safe_url(&crate::data::text(selected.and_then(|r| r.source_field("url")))))
}

pub fn option(value: &str, label: &str, current: &str) -> String {
    format!(r#"<option value="{}" {}>{}</option>"#, esc(value), if value == current { "selected" } else { "" }, esc(label))
}

/// Values in first-seen order, as `[...new Set(values)]` gives.
fn distinct(values: impl Iterator<Item = String>) -> Vec<String> {
    let mut seen: Vec<String> = Vec::new();
    for value in values { if !seen.contains(&value) { seen.push(value); } }
    seen
}

const PAGE_SIZE: usize = 10;

/// `<button … disabled>` when `off`, matching the template's spacing.
fn disabled(off: bool) -> &'static str { if off { "disabled" } else { "" } }

fn pagination(page: usize, pages: usize, total: usize, noun: &str, attribute: &str, label: &str) -> String {
    format!(r#"<div class="pagination"><span>{}–{} of {total} {noun}</span><div><button {attribute}="-1" {} aria-label="Previous {label} page">←</button><span>{} / {pages}</span><button {attribute}="1" {} aria-label="Next {label} page">→</button></div></div>"#,
        page * PAGE_SIZE + 1, ((page + 1) * PAGE_SIZE).min(total), disabled(page == 0), page + 1, disabled(page == pages - 1))
}

/// The evidence view's frame: title, filters and an empty results panel.
pub fn evidence(rows: &[Row], filter: &crate::data::Filter) -> String {
    let worlds: String = ["All"].into_iter().chain(crate::data::WORLDS).chain(["Earth-to-Moon model"])
        .map(|v| option(v, if v == "All" { "All environments" } else { v }, filter.world)).collect();
    let materials: String = ["All".to_string()].into_iter().chain(distinct(rows.iter().map(|r| crate::data::text(r.experiment_field("material")))))
        .map(|v| option(&v, if v == "All" { "All materials" } else { &v }, filter.material)).collect();
    let kinds: String = crate::data::EVIDENCE_TYPES.iter().map(|v| option(v, &crate::data::kind_of(v).name, filter.kind)).collect();
    format!(r##"<div class="view-title-row"><div><div class="eyebrow">THE RESEARCH, IN DETAIL</div><h2>Published findings</h2><p>Results extracted from research papers, with the reported method and source page. For source-file rows, open Original data.</p></div><button class="export-btn" id="export-filtered">{download}Export filtered CSV</button></div><div class="filterbar"><label>{search}<input id="record-search" value="{query}" placeholder="Material, metric, source…" aria-label="Search evidence"></label><label>Gravity<select id="world-filter" aria-label="Filter gravity">{worlds}</select></label><label>Material<select id="material-filter" aria-label="Filter material">{materials}</select></label><label>Type<select id="kind-filter" aria-label="Filter evidence type">{all}{kinds}</select></label><button class="clear-filter" id="clear-filters">Reset filters</button></div><section class="panel"><div id="evidence-results"></div></section><p class="browser-legend">Reported results include aggregates, fitted summaries and model-derived values. Row counts are not counts of independent raw trials.</p>"##,
        download = icon("download"), search = icon("search"), query = esc(filter.query), all = option("All", "All evidence", filter.kind))
}

/// The evidence table for one page of matches. Returns the markup and the page actually shown.
pub fn evidence_results(rows: &[Row], filter: &crate::data::Filter, page: usize) -> (String, usize) {
    let matches = crate::data::filter_rows(rows, filter);
    let pages = matches.len().div_ceil(PAGE_SIZE).max(1);
    let page = page.min(pages - 1);
    if matches.is_empty() { return (r#"<div class="empty"><strong>No matching results</strong>Try another material or reset the filters.</div>"#.to_string(), page); }
    let body: String = matches.iter().skip(page * PAGE_SIZE).take(PAGE_SIZE).map(|r| {
        let (id, world) = (r.get("measurement_id"), crate::data::text(r.experiment_field("gravity_label")));
        let page_number = Some(r.get("pdf_page")).filter(|p| !p.is_empty()).unwrap_or_else(|| "—".to_string());
        format!(r##"<tr data-record="{id}" tabindex="0" role="button" aria-label="Inspect {id}"><td class="table-material">{material}<span class="table-sub mono">{id}</span></td><td style="color:{colour}">{world}</td><td>{metric}</td><td><span class="number">{value}</span><span class="table-sub">{unit}</span></td><td><span class="chip {amber}" style="color:{kind_colour}">{evidence}</span></td><td class="mono">{source}<span class="table-sub">PDF p. {page_number} ↗</span></td></tr>"##,
            material = esc(&crate::data::text(r.experiment_field("material"))), colour = crate::data::world_color(&world).unwrap_or("#d9ba88"), world = esc(&world),
            metric = metric_name(r.metric()), value = number(r.field("value"), 8), unit = unit_label(&r.get("unit")),
            amber = if r.evidence_type().starts_with("model") { "amber" } else { "" }, kind_colour = r.kind.color, evidence = evidence_label(r),
            source = esc(&r.get("source_id").replacen("NTRS-", "", 1)))
    }).collect();
    (format!(r#"<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Record / material</th><th>Gravity</th><th>Metric</th><th>Value</th><th>Evidence</th><th>Source</th></tr></thead><tbody>{body}</tbody></table></div>{}"#,
        pagination(page, pages, matches.len(), "results", "data-page", "evidence")), page)
}

/// The source library's frame: totals, search and collection filter.
pub fn source_view(bundle: &Value, query: &str, source_type: &str) -> String {
    let count = |key: &str| number(bundle.pointer(&format!("/tableCounts/{key}")), 0);
    let sources = bundle.get("sources").and_then(Value::as_array).cloned().unwrap_or_default();
    let types: String = ["All".to_string()].into_iter().chain(distinct(sources.iter().map(|s| crate::data::text(s.get("source_type")))))
        .map(|v| option(&v, &if v == "All" { "All collections".to_string() } else { v.replace('_', " ") }, source_type)).collect();
    format!(r##"<div class="view-title-row"><div><div class="eyebrow">SOURCE LIBRARY</div><h2>From the archive to the evidence.</h2><p>{sources} indexed sources. Sorted by extracted result count, highest first. Open the research behind each finding.</p></div></div><div class="pill-row"><span class="stat-pill"><strong>{raw}</strong>raw records catalogued</span><span class="stat-pill"><strong>{files}</strong>file metadata entries</span><span class="stat-pill"><strong>{evidence}</strong>supporting evidence statements</span></div><div class="filterbar"><label>{search}<input id="source-search" value="{query}" placeholder="Search titles, source IDs or DOI" aria-label="Search sources"></label><label>Collection<select id="source-type" aria-label="Filter source collection">{types}</select></label></div><section class="panel"><div id="source-results"></div></section><p class="browser-legend">Catalogue totals describe indexed records. They do not imply that every file was downloaded or that every source supplied quantitative data.</p>"##,
        sources = count("sources"), raw = count("raw_records"), files = count("files"),
        evidence = bundle.get("evidence").and_then(Value::as_array).map_or(0, Vec::len), search = icon("search"), query = esc(query))
}

/// The source table for one page of matches. Returns the markup and the page actually shown.
pub fn source_results(bundle: &Value, rows: &[Row], query: &str, source_type: &str, page: usize) -> (String, usize) {
    let query = query.to_lowercase();
    let query = query.trim();
    let sources = bundle.get("sources").and_then(Value::as_array).cloned().unwrap_or_default();
    let measurements: Vec<Value> = rows.iter().map(|r| r.measurement.clone()).collect();
    let field = |s: &Value, key: &str| crate::data::text(s.get(key));
    let matches: Vec<&Value> = crate::discovery::sources_by_results(&sources, &measurements).into_iter().filter(|s| {
        (source_type == "All" || field(s, "source_type") == source_type)
            && [field(s, "title"), field(s, "source_id"), field(s, "doi")].join(" ").to_lowercase().contains(query)
    }).collect();
    let pages = matches.len().div_ceil(PAGE_SIZE).max(1);
    let page = page.min(pages - 1);
    if matches.is_empty() { return (r#"<div class="empty"><strong>No matching sources</strong>Try a shorter search.</div>"#.to_string(), page); }
    let body: String = matches.iter().skip(page * PAGE_SIZE).take(PAGE_SIZE).map(|s| {
        let id = field(s, "source_id");
        let title = esc(&Some(field(s, "title")).filter(|t| !t.is_empty()).unwrap_or_else(|| id.clone()));
        let year = Some(field(s, "publication_date")).filter(|d| !d.is_empty()).map_or("—".to_string(), |d| esc(&d.chars().take(4).collect::<String>()));
        let results = rows.iter().filter(|r| r.get("source_id") == id).count();
        format!(r#"<tr><td><a class="source-title" href="{url}" target="_blank" rel="noopener noreferrer">{title}</a><span class="table-sub mono">{id}</span></td><td>{kind}</td><td>{year}</td><td>{results}</td><td><button class="icon-btn" data-source="{id}" aria-label="Details for {title}">{info}</button></td></tr>"#,
            url = crate::data::safe_url(&field(s, "url")), id = esc(&id), kind = esc(&field(s, "source_type").replace('_', " ")),
            results = if results == 0 { "—".to_string() } else { results.to_string() }, info = icon("info"))
    }).collect();
    (format!(r#"<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Source / title</th><th>Collection</th><th>Year</th><th>Extracted results</th><th></th></tr></thead><tbody>{body}</tbody></table></div>{}"#,
        pagination(page, pages, matches.len(), "sources", "data-source-page", "sources")), page)
}

/// The detail dialog for one measurement, or `None` if the id is unknown.
pub fn record_dialog(rows: &[Row], id: &str) -> Option<String> {
    use crate::data::text;
    let r = rows.iter().find(|r| r.get("measurement_id") == id)?;
    let e = |key: &str| r.experiment_field(key);
    let null = |key: &str| matches!(e(key), Some(Value::Null));
    let measured = |key: &str, unit: &str| if null(key) { "Not reported".to_string() } else { format!("{}{unit}", number(e(key), 1)) };
    let or = |key: &str, fallback: String| Some(text(e(key))).filter(|v| !v.is_empty()).unwrap_or(fallback);
    let fields = [
        ("Environment", text(e("gravity_label"))),
        ("Test pressure", measured("pressure_kpa", " kPa absolute")),
        ("Oxygen", measured("oxygen_pct", " molar %")),
        ("Airflow", if null("flow_speed_cm_s") { or("flow_mode", "Not reported".to_string()) } else { measured("flow_speed_cm_s", " cm/s") }),
        ("Sample", or("conditions", text(e("material")))),
        ("Platform", or("platform", "See source".to_string())),
        ("Test duration", measured("duration_s", " s")),
        ("Evidence type", r.kind.name.clone()),
    ];
    let grid: String = fields.iter().map(|(label, value)| {
        let shown = match *label {
            "Evidence type" => evidence_label(r),
            "Sample" => sample_text(value),
            _ if value == "Microgravity" => term("microgravity", value, false),
            _ => esc(value),
        };
        format!("<div><span>{}</span><b>{shown}</b></div>", field_label(label))
    }).collect();
    let uncertainty = if matches!(r.field("uncertainty_value"), Some(Value::Null)) { "not supplied in this record".to_string() } else {
        let unit = match r.field("uncertainty_unit") { Some(Value::Null) => "null".to_string(), None => "undefined".to_string(), other => text(other) };
        esc(&format!("{} {unit}", r.get("uncertainty_value")))
    };
    Some(format!(r##"<div class="eyebrow">EVIDENCE / {id}</div><h2 id="detail-title">{material}</h2><span class="chip {amber}">{evidence}</span><div class="record-value">{value}<small>{unit}</small></div><div class="subtle">{metric}</div><div class="detail-grid">{grid}</div><h3>Original source</h3><a class="detail-source" href="{url}" target="_blank" rel="noopener noreferrer">{title} ↗<br><small>{locator} · PDF page {page}</small></a><div class="detail-limitation"><h3>How to interpret this result</h3><p>{limitation}</p><p>Reported summary, not an independent raw trial. Uncertainty values are {uncertainty}.</p></div><p class="subtle">Gravity basis: {basis}</p><div class="detail-actions"><button class="export-btn" data-download-record="{raw_id}">{download}Download record</button></div>"##,
        id = esc(&r.get("measurement_id")), material = esc(&text(e("material"))), amber = if r.evidence_type().starts_with("model") { "amber" } else { "" },
        evidence = evidence_label(r), value = number(r.field("value"), 8), unit = unit_label(&r.get("unit")), metric = metric_name(r.metric()),
        url = crate::data::safe_url(&text(r.source_field("url"))), title = esc(&text(r.source_field("title"))), locator = esc(&r.get("locator")),
        page = Some(r.get("pdf_page")).filter(|p| !p.is_empty()).unwrap_or_else(|| "not specified".to_string()), limitation = esc(&r.get("limitation")),
        basis = esc(&or("gravity_basis", "See the source methods.".to_string())), raw_id = r.get("measurement_id"), download = icon("download")))
}

/// The detail dialog for one source, or `None` if the id is unknown.
pub fn source_dialog(bundle: &Value, rows: &[Row], id: &str) -> Option<String> {
    use crate::data::text;
    let list = |key: &str| bundle.get(key).and_then(Value::as_array).cloned().unwrap_or_default();
    let source = list("sources").into_iter().find(|s| s.get("source_id").and_then(Value::as_str) == Some(id))?;
    let field = |record: &Value, key: &str| text(record.get(key));
    let statements: Vec<Value> = list("evidence").into_iter().filter(|e| e.get("source_id").and_then(Value::as_str) == Some(id)).collect();
    let excerpts: String = statements.iter().map(|e| {
        let (page, limitation) = (field(e, "pdf_page"), field(e, "limitation"));
        format!(r#"<div class="source-excerpt">{}<small>{}{}</small>{}</div>"#, esc(&field(e, "statement")),
            esc(&Some(field(e, "locator")).filter(|l| !l.is_empty()).unwrap_or_else(|| "Source text".to_string())),
            if page.is_empty() { String::new() } else { format!(" · PDF p. {page}") },
            if limitation.is_empty() { String::new() } else { format!("<p>{}</p>", esc(&limitation)) })
    }).collect();
    let date = field(&source, "publication_date");
    Some(format!(r#"<div class="eyebrow">SOURCE / {id}</div><h2 id="detail-title">{title}</h2><p>{kind}{year}</p><a class="detail-source" href="{url}" target="_blank" rel="noopener noreferrer">Open original source ↗</a><h3>{results} extracted results · {count} evidence statements</h3>{excerpts}<p>Inclusion in the source catalogue does not mean this document contributed a measurement.</p>"#,
        id = esc(&field(&source, "source_id")), title = esc(&Some(field(&source, "title")).filter(|t| !t.is_empty()).unwrap_or_else(|| field(&source, "source_id"))),
        kind = esc(&field(&source, "source_type").replace('_', " ")),
        year = if date.is_empty() { String::new() } else { format!(" · {}", esc(&date.chars().take(4).collect::<String>())) },
        url = crate::data::safe_url(&field(&source, "url")), results = rows.iter().filter(|r| r.get("source_id") == id).count(), count = statements.len()))
}

/// `new Date(iso).toLocaleString('en-CA', {timeZone: 'UTC'})` for the ISO timestamps the bundle carries.
pub fn locale_datetime(iso: &str) -> String {
    let parse = || -> Option<String> {
        let (date, time) = iso.strip_suffix('Z')?.split_once('T')?;
        let mut ymd = date.split('-').map(|part| part.parse::<u32>().ok());
        let (year, month, day) = (ymd.next()??, ymd.next()??, ymd.next()??);
        let mut hms = time.split('.').next()?.split(':').map(|part| part.parse::<u32>().ok());
        let (hour, minute, second) = (hms.next()??, hms.next()??, hms.next()??);
        if date.len() != 10 || !(1..=12).contains(&month) || !(1..=31).contains(&day) || hour > 23 || minute > 59 || second > 59 { return None; }
        Some(format!("{year:04}-{month:02}-{day:02}, {}:{minute:02}:{second:02} {}", if hour % 12 == 0 { 12 } else { hour % 12 }, if hour < 12 { "a.m." } else { "p.m." }))
    };
    parse().unwrap_or_else(|| "Invalid Date".to_string())
}

/// The "about this data" dialog. Its fixed text lives in `views_templates/about.html`.
pub fn about_dialog(bundle: &Value) -> String {
    let count = |key: &str| bundle.get(key).and_then(Value::as_array).map_or(0, Vec::len).to_string();
    let delivery = match bundle.pointer("/delivery/mode").and_then(Value::as_str) {
        Some("bigquery") => "The server reads BigQuery and caches complete results for five minutes.",
        Some("cached-stale") => "Showing the last successful BigQuery refresh while the connection recovers.",
        _ => "Browsing and filtering use the saved snapshot, not a live database connection.",
    };
    include_str!("views_templates/about.html")
        .replace("{date}", &locale_datetime(bundle.get("exportedAt").and_then(Value::as_str).unwrap_or("")))
        .replace("{delivery}", delivery)
        .replace("{measurements}", &count("measurements")).replace("{experiments}", &count("experiments"))
        .replace("{sources}", &count("sources")).replace("{evidence}", &count("evidence"))
}

/// The 3D tab: the kitchen scenes from `dist/scenes/`, opened on the selected gravity environment.
/// This view is new in the Rust build; the scenes themselves run in their own frame.
pub fn scenes(world: &str) -> String {
    let scene = crate::app::scene_for_world(world);
    format!(r##"<div class="view-title-row"><div><div class="eyebrow">INTERACTIVE SCENES</div><h2>One kitchen. Four worlds.</h2><p>The same stove, pan and egg on Earth, the Moon, Mars and in orbit. Drag to look around and tap an object for a close view.</p></div><div class="scene-actions"><a class="export-btn" id="scene-open" href="./scenes/index.html#{scene}" target="_blank" rel="noopener">{external}Open full screen</a><button class="export-btn" data-view="compare">{chart}Compare the evidence</button></div></div><section class="scene-stage" aria-label="Interactive 3D scenes"><iframe id="scene-frame" class="scene-frame" title="Flame in Freefall 3D scenes" src="./scenes/index.html#{scene}" allow="fullscreen"></iframe></section><p class="browser-legend">Illustrative scenes, not to scale. Flame shapes follow a simple buoyancy heuristic, not a combustion model. The published measurements are in the research views.</p>"##,
        external = icon("external"), chart = icon("chart"))
}

/// `Value` text helper for callers that hold raw records.
pub fn text_of(value: Option<&Value>) -> String { crate::data::text(value) }
