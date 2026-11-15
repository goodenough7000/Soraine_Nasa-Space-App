//! Port of `dist/specimen.mjs`: the specimen card with its illustration,
//! controls and oxygen-limit axis, returned as markup.
//!
//! The four illustrations in `specimen/*.svg` are the SVG the JavaScript
//! produces, with the per-card id replaced by `{id}`.
use crate::data::{esc, to_number};
use serde_json::Value;

/// (kind, label) for the three published comparison materials.
fn definition(material: &str) -> (&'static str, Option<&'static str>) {
    match material {
        "Ultem 1000" => ("ultem", Some("Amber PEI film")),
        "Mylar G" => ("mylar", Some("Translucent PET film")),
        "Nomex HT90-40" => ("nomex", Some("Woven Nomex fabric")),
        _ => ("unknown", None),
    }
}

fn model(kind: &str, id: &str) -> String {
    let template = match kind {
        "ultem" => include_str!("specimen/ultem.svg"),
        "mylar" => include_str!("specimen/mylar.svg"),
        "nomex" => include_str!("specimen/nomex.svg"),
        _ => include_str!("specimen/unknown.svg"),
    };
    template.replace("{id}", id)
}

/// A reported value: a number or a non-blank numeric string. Anything else is missing.
pub fn numeric(value: Option<&Value>) -> Option<f64> {
    let number = match value? {
        Value::Number(_) => to_number(value),
        Value::String(s) if !s.trim().is_empty() => to_number(value),
        _ => return None,
    };
    number.is_finite().then_some(number)
}

/// JavaScript `Number(value.toFixed(2)).toString()`.
fn format(value: f64) -> String {
    // toFixed rounds the exact binary value, halves away from zero.
    let exact = format!("{:.40}", value.abs());
    let (int_part, frac_part) = exact.split_once('.').unwrap_or((&exact, ""));
    let mut hundredths: u128 = format!("{int_part}{}", &frac_part[..2]).parse().unwrap_or(0);
    if frac_part.as_bytes()[2] >= b'5' { hundredths += 1; }
    let rounded = hundredths as f64 / 100.0;
    js_number(if value.is_sign_negative() && hundredths != 0 { -rounded } else { rounded })
}

/// JavaScript's default number-to-string for the magnitudes drawn here.
fn js_number(value: f64) -> String { format!("{value}") }

fn oxygen_axis(uloi: Option<f64>, moc: Option<f64>, id: &str, world: &str) -> String {
    let star = if matches!(world, "Moon" | "Mars" | "Microgravity") { "*" } else { "" };
    let rows = [(format!("ULOI{star}"), uloi, 14.0, "uloi"), (format!("MOC{star}"), moc, 36.0, "moc")];
    let detail = rows.iter().map(|(label, value, ..)| match value {
        None => format!("{label}: not reported"),
        Some(value) => format!("{label}: {} percent oxygen", format(*value)),
    }).collect::<Vec<_>>().join(". ");
    let x = |percent: f64| js_number(55.0 + percent / 30.0 * 279.0);
    let tracks = rows.iter().map(|(label, value, y, class)| {
        let ticks: String = [0.0, 10.0, 20.0, 30.0].iter().map(|tick| format!("<path class=\"specimen-axis-tick\" d=\"M{} {}v6\"/>", x(*tick), js_number(y - 3.0))).collect();
        let point = match value {
            Some(value) if (0.0..=30.0).contains(value) => format!(
                "<g class=\"specimen-axis-point {class}\"><path d=\"M{} {}v12\"/><circle cx=\"{}\" cy=\"{}\" r=\"3.5\"/></g>",
                x(*value), js_number(y - 6.0), x(*value), js_number(*y)),
            other => format!("<text class=\"specimen-axis-missing\" x=\"334\" y=\"{}\" text-anchor=\"end\">{}</text>", js_number(y - 5.0),
                other.map_or("Not reported".to_string(), |value| esc(&format!("{}% outside axis", format(value))))),
        };
        format!("<text class=\"specimen-axis-name\" x=\"0\" y=\"{}\">{label}</text>\n <path class=\"specimen-axis-track\" d=\"M55 {}H334\"/>\n {ticks}\n {point}", js_number(y + 3.0), js_number(*y))
    }).collect::<String>();
    format!("<div class=\"specimen-axis\"><span class=\"specimen-axis-label\">Oxygen concentration</span>\n <svg viewBox=\"0 0 350 59\" role=\"img\" aria-labelledby=\"{id}-axis-title\" focusable=\"false\"><title id=\"{id}-axis-title\">0 to 30 percent oxygen. {}.</title>\n {tracks}\n <text class=\"specimen-axis-unit\" x=\"55\" y=\"56\">0%</text><text class=\"specimen-axis-unit\" x=\"148\" y=\"56\" text-anchor=\"middle\">10%</text><text class=\"specimen-axis-unit\" x=\"241\" y=\"56\" text-anchor=\"middle\">20%</text><text class=\"specimen-axis-unit\" x=\"334\" y=\"56\" text-anchor=\"end\">30%</text>\n </svg></div>", esc(&detail))
}

#[derive(Debug, Clone, Default)]
pub struct Specimen<'a> {
    pub material: &'a str,
    pub world: &'a str,
    pub uloi: Option<f64>,
    pub moc: Option<f64>,
    /// The evidence record behind the limits; `None` or empty hides the link.
    pub record_id: Option<&'a str>,
}

/// `instance` numbers the card so its SVG ids stay unique on the page.
pub fn specimen_html(specimen: &Specimen, instance: u32) -> String {
    let (id, material, world) = (format!("specimen-{instance}"), specimen.material, specimen.world);
    let (kind, label) = definition(material);
    let source = specimen.record_id.filter(|record| !record.is_empty()).map_or(String::new(), |record| format!(
        "<button type=\"button\" class=\"specimen-source\" data-record=\"{}\" aria-label=\"{}\">Read test record <span aria-hidden=\"true\">↗</span></button>",
        esc(record), esc(&format!("Read {material} test record for {world}"))));
    format!("<section class=\"specimen\" aria-label=\"{} specimen and reported oxygen limits\">\n <div class=\"specimen-caption\"><span>Illustrative specimen</span><span class=\"specimen-material-label\">{}</span></div>\n <div class=\"material-model\" data-material-model=\"{}\" tabindex=\"0\" role=\"group\" aria-label=\"{}\">{}</div>\n <div class=\"specimen-model-toolbar\"><span class=\"specimen-gesture\">Drag to rotate · Arrow keys</span><div class=\"specimen-model-actions\"><button type=\"button\" data-material-action=\"zoom-in\" aria-label=\"Zoom in on material\" title=\"Zoom in\">+</button><button type=\"button\" data-material-action=\"zoom-out\" aria-label=\"Zoom out from material\" title=\"Zoom out\">−</button><button type=\"button\" data-material-action=\"rotate-toggle\" aria-label=\"Pause material rotation\" title=\"Pause material rotation\">Ⅱ</button><button type=\"button\" data-material-action=\"reset\" aria-label=\"Reset material view\" title=\"Reset view\">↺</button></div></div>\n {source}\n {}</section>",
        esc(material), esc(label.unwrap_or(material)), esc(material),
        esc(&format!("Rotate the {material} specimen. Arrow keys rotate, plus and minus zoom, Home resets.")),
        model(kind, &id), oxygen_axis(specimen.uloi, specimen.moc, &id, world))
}
