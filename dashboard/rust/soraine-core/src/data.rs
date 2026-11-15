//! Port of `dist/data.mjs`.
use serde_json::Value;
use std::collections::HashMap;

pub const WORLDS: [&str; 4] = ["Microgravity", "Moon", "Mars", "Earth"];
pub const MATERIALS: [&str; 3] = ["Ultem 1000", "Mylar G", "Nomex HT90-40"];
pub const LIMIT_AGGREGATE: &str = "reported_experimental_limit_aggregate";

pub fn world_color(world: &str) -> Option<&'static str> {
    Some(match world {
        "Microgravity" => "#b5abd0",
        "Moon" => "#b6cfff",
        "Mars" => "#d8ae81",
        "Earth" => "#91a5be",
        _ => return None,
    })
}

/// The evidence types in the order the filters list them.
pub const EVIDENCE_TYPES: [&str; 5] = [
    "reported_experimental_limit_aggregate", "reported_fit_to_experimental_data", "reported_experimental_summary",
    "source_derived_from_limit_aggregates", "model_derived_compensation_from_experiments",
];

/// Display name and colour for an evidence type.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Kind {
    pub name: String,
    pub color: &'static str,
}

pub fn kind_of(evidence_type: &str) -> Kind {
    let (name, color) = match evidence_type {
        "reported_experimental_limit_aggregate" => ("Published limit", "#b6cfff"),
        "reported_fit_to_experimental_data" => ("Fitted result", "#819bd2"),
        "reported_experimental_summary" => ("Reported summary", "#a6afbd"),
        "source_derived_from_limit_aggregates" => ("Derived summary", "#b8a4cd"),
        "model_derived_compensation_from_experiments" => ("Model-derived", "#d8ae81"),
        other => (other, "#a6afbd"),
    };
    Kind { name: name.to_string(), color }
}

/// One measurement joined to its experiment and source. The original records
/// are kept whole so no published field is dropped on the way through.
#[derive(Debug, Clone)]
pub struct Row {
    pub measurement: Value,
    pub experiment: Option<Value>,
    pub source: Option<Value>,
    pub kind: Kind,
}

/// JavaScript `String(value ?? '')` for the value types the bundle holds.
pub fn text(value: Option<&Value>) -> String {
    match value {
        None | Some(Value::Null) => String::new(),
        Some(Value::String(s)) => s.clone(),
        Some(other) => other.to_string(),
    }
}

impl Row {
    pub fn field(&self, key: &str) -> Option<&Value> { self.measurement.get(key) }
    pub fn get(&self, key: &str) -> String { text(self.field(key)) }
    pub fn experiment_field(&self, key: &str) -> Option<&Value> { self.experiment.as_ref().and_then(|e| e.get(key)) }
    pub fn source_field(&self, key: &str) -> Option<&Value> { self.source.as_ref().and_then(|s| s.get(key)) }
    pub fn material(&self) -> Option<&str> { self.experiment_field("material").and_then(Value::as_str) }
    pub fn world(&self) -> Option<&str> { self.experiment_field("gravity_label").and_then(Value::as_str) }
    pub fn evidence_type(&self) -> &str { self.field("evidence_type").and_then(Value::as_str).unwrap_or("") }
    pub fn metric(&self) -> &str { self.field("metric").and_then(Value::as_str).unwrap_or("") }
    /// JavaScript `Number(row.value)`.
    pub fn value(&self) -> f64 { to_number(self.field("value")) }
}

/// JavaScript `Number(x)` for strings, numbers, booleans and null.
pub fn to_number(value: Option<&Value>) -> f64 {
    match value {
        None => f64::NAN,
        Some(Value::Null) => 0.0,
        Some(Value::Bool(b)) => f64::from(u8::from(*b)),
        Some(Value::Number(n)) => n.as_f64().unwrap_or(f64::NAN),
        Some(Value::String(s)) => {
            let t = s.trim();
            if t.is_empty() { 0.0 } else { t.parse::<f64>().unwrap_or(f64::NAN) }
        }
        Some(_) => f64::NAN,
    }
}

/// `number(x, digits)`: missing stays "Not reported"; otherwise en-US grouping
/// with at most `digits` decimals and no trailing zeros.
pub fn number(value: Option<&Value>, digits: usize) -> String {
    match value {
        None | Some(Value::Null) => "Not reported".to_string(),
        Some(Value::String(s)) if s.is_empty() => "Not reported".to_string(),
        some => format_number(to_number(some), digits),
    }
}

pub fn format_number(x: f64, digits: usize) -> String {
    if x.is_nan() { return "NaN".to_string(); }
    if x.is_infinite() { return if x > 0.0 { "∞".to_string() } else { "-∞".to_string() }; }
    // Intl rounds the shortest decimal that round-trips (19.95, not 19.9499…),
    // half away from zero.
    let shortest = format!("{}", x.abs());
    let (int_part, frac_part) = shortest.split_once('.').unwrap_or((&shortest, ""));
    let padded = format!("{frac_part:0<digits$}");
    let mut digits_all: Vec<u8> = int_part.bytes().chain(padded.bytes().take(digits)).map(|b| b - b'0').collect();
    let round_up = frac_part.as_bytes().get(digits).is_some_and(|b| *b >= b'5');
    if round_up {
        let mut i = digits_all.len();
        loop {
            if i == 0 { digits_all.insert(0, 1); break; }
            i -= 1;
            if digits_all[i] == 9 { digits_all[i] = 0; } else { digits_all[i] += 1; break; }
        }
    }
    let split = digits_all.len() - digits;
    let int_digits: String = digits_all[..split].iter().map(|d| (d + b'0') as char).collect();
    let frac_digits: String = digits_all[split..].iter().map(|d| (d + b'0') as char).collect();
    let frac_digits = frac_digits.trim_end_matches('0');
    let mut grouped = String::new();
    for (i, c) in int_digits.chars().enumerate() {
        if i > 0 && (int_digits.len() - i).is_multiple_of(3) { grouped.push(','); }
        grouped.push(c);
    }
    // Intl keeps the sign of a negative value that rounds to zero ("-0").
    let sign = if x.is_sign_negative() { "-" } else { "" };
    if frac_digits.is_empty() { format!("{sign}{grouped}") } else { format!("{sign}{grouped}.{frac_digits}") }
}

/// HTML-escape text for insertion into markup.
pub fn esc(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for c in value.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            '\'' => out.push_str("&#39;"),
            other => out.push(other),
        }
    }
    out
}

/// Only http(s) links leave the app; anything else becomes `#`.
pub fn safe_url(value: &str) -> String {
    match url::Url::parse(value) {
        Ok(url) if matches!(url.scheme(), "http" | "https") => url.to_string(),
        _ => "#".to_string(),
    }
}

fn list<'a>(bundle: &'a Value, key: &str) -> &'a [Value] {
    bundle.get(key).and_then(Value::as_array).map(Vec::as_slice).unwrap_or(&[])
}

pub fn join_research(bundle: &Value) -> Vec<Row> {
    let index = |table: &str, id: &str| -> HashMap<String, Value> {
        list(bundle, table).iter().filter_map(|r| Some((r.get(id)?.as_str()?.to_string(), r.clone()))).collect()
    };
    let experiments = index("experiments", "experiment_id");
    let sources = index("sources", "source_id");
    list(bundle, "measurements").iter().map(|m| {
        let key = |k: &str| m.get(k).and_then(Value::as_str).unwrap_or("");
        Row {
            experiment: experiments.get(key("experiment_id")).cloned(),
            source: sources.get(key("source_id")).cloned(),
            kind: kind_of(key("evidence_type")),
            measurement: m.clone(),
        }
    }).collect()
}

#[derive(Debug, Clone, Copy, Default)]
pub struct Limits<'a> {
    pub uloi: Option<&'a Row>,
    pub moc: Option<&'a Row>,
}

pub fn get_limits<'a>(rows: &'a [Row], material: &str, world: &str) -> Limits<'a> {
    let matching = || rows.iter().filter(move |r| r.material() == Some(material) && r.world() == Some(world) && r.evidence_type() == LIMIT_AGGREGATE);
    Limits {
        uloi: matching().find(|r| matches!(r.metric(), "ULOI" | "ULOI*")),
        moc: matching().find(|r| matches!(r.metric(), "MOC" | "MOC*")),
    }
}

/// `"All"` (the default) leaves a dimension unfiltered.
#[derive(Debug, Clone)]
pub struct Filter<'a> {
    pub query: &'a str,
    pub world: &'a str,
    pub material: &'a str,
    pub kind: &'a str,
}

impl Default for Filter<'_> {
    fn default() -> Self { Filter { query: "", world: "All", material: "All", kind: "All" } }
}

pub fn filter_rows<'a>(rows: &'a [Row], filter: &Filter) -> Vec<&'a Row> {
    let lowered = filter.query.to_lowercase();
    let terms: Vec<&str> = lowered.split_whitespace().collect();
    rows.iter().filter(|r| {
        (filter.world == "All" || r.world() == Some(filter.world))
            && (filter.material == "All" || r.material() == Some(filter.material))
            && (filter.kind == "All" || r.evidence_type() == filter.kind)
            && {
                let haystack = [
                    r.get("measurement_id"), r.get("metric"), r.get("unit"), r.get("value"),
                    text(r.experiment_field("material")), text(r.experiment_field("gravity_label")),
                    text(r.source_field("title")), r.get("source_id"), r.kind.name.clone(),
                ].join(" ").to_lowercase();
                terms.iter().all(|q| haystack.contains(q))
            }
    }).collect()
}

/// CSV export. Cells that a spreadsheet would run as a formula are neutralised.
pub fn csv<'a>(rows: impl IntoIterator<Item = &'a Row>) -> String {
    const FIELDS: [&str; 10] = ["measurement_id", "material", "gravity", "metric", "value", "unit", "evidence_type", "source_url", "pdf_page", "limitation"];
    let cell = |value: String| {
        let guarded = if value.starts_with(['=', '+', '@', '\t', '\r']) { format!("'{value}") } else { value };
        format!("\"{}\"", guarded.replace('"', "\"\""))
    };
    let mut lines = vec![FIELDS.join(",")];
    for r in rows {
        lines.push([
            r.get("measurement_id"), text(r.experiment_field("material")), text(r.experiment_field("gravity_label")),
            r.get("metric"), r.get("value"), r.get("unit"), r.get("evidence_type"),
            text(r.source_field("url")), r.get("pdf_page"), r.get("limitation"),
        ].map(cell).join(","));
    }
    lines.join("\r\n")
}

pub fn comparison_rows<'a>(rows: &'a [Row], material: &str) -> Vec<(&'static str, Limits<'a>)> {
    WORLDS.iter().map(|world| (*world, get_limits(rows, material, world))).collect()
}
