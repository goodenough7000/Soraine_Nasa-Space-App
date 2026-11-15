//! Soraine research logic, ported from `dashboard/dist/{data,discovery,reading,scene-link}.mjs`.
//!
//! Pure functions over the published research bundle. Nothing here draws,
//! fetches or touches the DOM, so the same code serves the browser build
//! (WebAssembly), the server and native tests.
pub mod app;
pub mod data;
pub mod discovery;
pub mod gesture;
pub mod glossary;
mod glossary_terms;
pub mod reading;
pub mod scene_link;
pub mod specimen;
pub mod views;
mod app_data;
