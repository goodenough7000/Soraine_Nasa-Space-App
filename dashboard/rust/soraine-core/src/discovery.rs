//! Port of `dist/discovery.mjs`.
use serde_json::Value;
use std::cmp::Ordering;
use std::collections::HashMap;

/// Title order used for ties: the Unicode collation `localeCompare` applies in
/// JavaScript, so the source library lists in the same order in both builds.
pub fn compare_titles(a: &str, b: &str) -> Ordering {
    thread_local! {
        static COLLATOR: icu_collator::CollatorBorrowed<'static> =
            icu_collator::Collator::try_new(Default::default(), Default::default()).expect("root collation data is compiled in");
    }
    COLLATOR.with(|collator| collator.compare(a, b))
}

fn id_of<'a>(record: &'a Value, key: &str) -> &'a str { record.get(key).and_then(Value::as_str).unwrap_or("") }

/// Sources that have extracted results come first; the input is not reordered.
pub fn sources_by_results<'a>(sources: &'a [Value], measurements: &[Value]) -> Vec<&'a Value> {
    let mut counts: HashMap<&str, usize> = HashMap::new();
    for row in measurements { *counts.entry(id_of(row, "source_id")).or_default() += 1; }
    let count = |s: &Value| counts.get(id_of(s, "source_id")).copied().unwrap_or(0);
    let label = |s: &'a Value| -> &'a str {
        match s.get("title").and_then(Value::as_str) { Some(t) if !t.is_empty() => t, _ => id_of(s, "source_id") }
    };
    let mut sorted: Vec<&Value> = sources.iter().collect();
    sorted.sort_by(|a, b| count(b).cmp(&count(a)).then_with(|| compare_titles(label(a), label(b))));
    sorted
}

// Relevance is an editorial order based on the contents of these specific files,
// not a claim that source rows are extracted measurements or independent trials.
const FILE_ORDER: [&str; 6] = ["saffire-ii", "bass-ii", "saffire-i", "same-r", "saffire-iii", "bass"];

pub fn original_files_by_relevance(datasets: &[Value]) -> Vec<&Value> {
    let rank = |d: &Value| FILE_ORDER.iter().position(|id| *id == id_of(d, "id")).unwrap_or(FILE_ORDER.len());
    let mut sorted: Vec<&Value> = datasets.iter().collect();
    sorted.sort_by(|a, b| rank(a).cmp(&rank(b)).then_with(|| compare_titles(id_of(a, "title"), id_of(b, "title"))));
    sorted
}
