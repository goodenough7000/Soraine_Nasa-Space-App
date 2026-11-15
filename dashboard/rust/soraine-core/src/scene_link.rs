//! Port of `dist/scene-link.mjs`: the shared scene-to-research contract.
use crate::data::MATERIALS;
use std::fmt;
use url::Url;

pub const RESEARCH_SITE: &str = "https://soraine.vercel.app/";
const VIEWS: [&str; 5] = ["overview", "experiments", "compare", "evidence", "sources"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LinkError { InvalidUrl, BadBase, UnknownWorld, UnknownMaterial, UnknownView, BadRecord }

impl fmt::Display for LinkError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(match self {
            LinkError::InvalidUrl => "Invalid URL",
            LinkError::BadBase => "Research links require HTTP or HTTPS.",
            LinkError::UnknownWorld => "Unknown gravity context.",
            LinkError::UnknownMaterial => "Choose a published comparison material.",
            LinkError::UnknownView => "Unknown research view.",
            LinkError::BadRecord => "Invalid evidence record ID.",
        })
    }
}
impl std::error::Error for LinkError {}

#[derive(Debug, Clone)]
pub struct Link<'a> {
    pub world: &'a str,
    pub material: &'a str,
    pub view: &'a str,
    pub record: Option<&'a str>,
}

impl Default for Link<'_> {
    fn default() -> Self { Link { world: "earth", material: "Ultem 1000", view: "compare", record: None } }
}

fn normalize_world(world: &str) -> Option<&'static str> {
    Some(match world.to_lowercase().as_str() {
        "earth" => "earth",
        "moon" | "lunar" => "moon",
        "mars" | "martian" => "mars",
        "iss" | "microgravity" => "microgravity",
        _ => return None,
    })
}

fn valid_record(record: &str) -> bool {
    record.strip_prefix('E').is_some_and(|digits| digits.len() >= 3 && digits.bytes().all(|b| b.is_ascii_digit()))
}

pub fn research_url(link: &Link, base: &str) -> Result<String, LinkError> {
    let mut url = Url::parse(base).map_err(|_| LinkError::InvalidUrl)?;
    if !matches!(url.scheme(), "http" | "https") { return Err(LinkError::BadBase); }
    let world = normalize_world(link.world).ok_or(LinkError::UnknownWorld)?;
    if !MATERIALS.contains(&link.material) { return Err(LinkError::UnknownMaterial); }
    if !VIEWS.contains(&link.view) { return Err(LinkError::UnknownView); }
    if let Some(record) = link.record { if !valid_record(record) { return Err(LinkError::BadRecord); } }
    url.set_query(None);
    {
        let mut query = url.query_pairs_mut();
        query.append_pair("world", world).append_pair("material", link.material);
        if let Some(record) = link.record.filter(|r| !r.is_empty()) { query.append_pair("record", record); }
    }
    url.set_fragment(Some(link.view));
    Ok(url.to_string())
}
