//! Port of the data and markup half of `dist/glossary.mjs`. The tooltip
//! behaviour (hover, focus, pinning) belongs to the browser crate.
use crate::data::esc;
pub use crate::glossary_terms::DEFINITIONS;

/// (title, description) for a glossary key.
pub fn definition(key: &str) -> Option<(&'static str, &'static str)> {
    DEFINITIONS.iter().find(|entry| entry.0 == key).map(|entry| (entry.1, entry.2))
}

/// Markup for a defined term. `passive` is for text inside an existing button;
/// otherwise the term is its own button. Unknown keys are plain escaped text.
pub fn term(key: &str, label: &str, passive: bool) -> String {
    if definition(key).is_none() { return esc(label); }
    let attributes = format!("class=\"science-term\" data-termkey=\"{0}\" data-term=\"{0}\"", esc(key));
    if passive { return format!("<span {attributes}>{}</span>", esc(label)); }
    format!("<button type=\"button\" {attributes} aria-label=\"{0}: definition\">{0}</button>", esc(label))
}
