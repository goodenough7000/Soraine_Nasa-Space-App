//! Port of `dist/reading.mjs`.
use crate::data::{format_number, get_limits, Row};

/// Explain a published comparison without converting an experimental endpoint
/// into an ignition probability or a habitat certification.
pub fn reading_summary(rows: &[Row], material: &str, world: &str) -> String {
    if get_limits(rows, material, world).uloi.is_none() {
        return "No matching published oxygen limit is available for this selection.".to_string();
    }
    if world == "Moon" || world == "Mars" {
        if let (Some(moon), Some(mars)) = (get_limits(rows, material, "Moon").uloi, get_limits(rows, material, "Mars").uloi) {
            let difference = moon.value() - mars.value();
            if difference == 0.0 {
                return "This study reports the same flame-survival oxygen limit at lunar and Martian gravity.".to_string();
            }
            let lower = if difference < 0.0 { "lunar" } else { "Martian" };
            let unit = if difference.abs() == 1.0 { "point" } else { "points" };
            return format!("In this study, the {lower}-gravity flame-survival limit is {} percentage {unit} lower than the other partial-gravity case.", format_number(difference.abs(), 1));
        }
    }
    if world == "Microgravity" {
        "These microgravity results include forced airflow. Floating does not mean that oxygen stops reaching a flame.".to_string()
    } else {
        "Earth tests provide a reference. A material’s Earth result does not establish its fire behaviour in reduced gravity.".to_string()
    }
}

pub fn comparison_context(material: &str) -> &'static str {
    if material == "Mylar G" {
        "Earth uses related Melinex 515 film; reduced-gravity tests use Mylar G. The sample and test endpoints differ."
    } else {
        "Compare the same specimen and test pressure. Earth and reduced-gravity tests use different burn endpoints."
    }
}
