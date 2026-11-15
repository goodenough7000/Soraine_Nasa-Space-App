//! The running page: port of the event handling and rendering in `dist/app.mjs`.
//!
//! All markup and decisions come from `soraine-core`; this file only moves them
//! onto the page and listens for input. Until their own ports land (PLAN.md,
//! stages 3 to 5) the planet, the specimen model, the original-data explorer
//! and the glossary tooltip are still the existing JavaScript modules, loaded
//! from here.
use js_sys::{Array, Function, Object, Promise, Reflect};
use serde_json::{json, Value};
use soraine_core::app::{self, Route, State};
use soraine_core::data::{self, Row};
use soraine_core::views;
use std::cell::RefCell;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::{spawn_local, JsFuture};
use web_sys::{Document, Element, Event, EventTarget, HtmlDialogElement, HtmlElement, HtmlInputElement, HtmlSelectElement, KeyboardEvent, MouseEvent};

#[wasm_bindgen(inline_js = "export function import_module(path) { return import(new URL(path, document.baseURI).href); }")]
extern "C" {
    fn import_module(path: &str) -> Promise;
}

struct MaterialView {
    host: Element,
    material: String,
    api: Option<JsValue>,
    token: u32,
    listener: Function,
}

struct App {
    bundle: Value,
    rows: Vec<Row>,
    state: State,
    render_sequence: u32,
    specimen_instance: u32,
    material_token: u32,
    globe: Option<JsValue>,
    globe_world: String,
    material_view: Option<MaterialView>,
    original_cleanup: Option<Function>,
    original_listener: Option<Closure<dyn FnMut(JsValue)>>,
    scene_listener: Option<Closure<dyn FnMut(JsValue)>>,
    toast_timer: Option<i32>,
}

thread_local! {
    static APP: RefCell<Option<App>> = const { RefCell::new(None) };
}

/// Run `f` on the loaded app. `None` before the research data has arrived.
/// Never call into page code that can fire events while inside `f`.
fn app<R>(f: impl FnOnce(&mut App) -> R) -> Option<R> {
    APP.with(|cell| cell.borrow_mut().as_mut().map(f))
}

fn window() -> web_sys::Window { web_sys::window().expect("a browser window") }
fn document() -> Document { window().document().expect("a document") }
fn query(selector: &str) -> Option<Element> { document().query_selector(selector).ok().flatten() }
fn query_all(root: &Element, selector: &str) -> Vec<Element> {
    let Ok(list) = root.query_selector_all(selector) else { return Vec::new() };
    (0..list.length()).filter_map(|i| list.get(i)).filter_map(|node| node.dyn_into().ok()).collect()
}
fn body() -> Element { document().body().expect("a body").into() }
fn dialog() -> Option<HtmlDialogElement> { query("#detail-dialog").and_then(|el| el.dyn_into().ok()) }
fn focus(selector: &str) { if let Some(el) = query(selector).and_then(|el| el.dyn_into::<HtmlElement>().ok()) { let _ = el.focus(); } }
fn js_get(object: &JsValue, key: &str) -> JsValue { Reflect::get(object, &key.into()).unwrap_or(JsValue::UNDEFINED) }
fn js_set(object: &JsValue, key: &str, value: &JsValue) { let _ = Reflect::set(object, &key.into(), value); }
fn js_call(object: &JsValue, method: &str, arguments: &[JsValue]) -> Result<JsValue, JsValue> {
    let function: Function = js_get(object, method).dyn_into()?;
    function.apply(object, &arguments.iter().collect::<Array>())
}
fn message(error: &JsValue) -> JsValue { let text = js_get(error, "message"); if text.is_undefined() { error.clone() } else { text } }
fn listen(target: &EventTarget, event: &str, handler: impl FnMut(Event) + 'static) {
    let closure = Closure::<dyn FnMut(Event)>::new(handler);
    let _ = target.add_event_listener_with_callback(event, closure.as_ref().unchecked_ref());
    closure.forget(); // page-lifetime listeners
}
fn later(milliseconds: i32, callback: impl FnOnce() + 'static) -> Option<i32> {
    let closure = Closure::once_into_js(callback);
    window().set_timeout_with_callback_and_timeout_and_arguments_0(closure.unchecked_ref(), milliseconds).ok()
}
/// A `data-*` attribute, when present and not empty (JavaScript truthiness of `dataset.x`).
fn data_attribute(element: &Element, name: &str) -> Option<String> { element.get_attribute(&format!("data-{name}")).filter(|v| !v.is_empty()) }

fn toast(text: &str) {
    let Some(el) = query("#toast") else { return };
    el.set_text_content(Some(text));
    let _ = el.class_list().add_1("show");
    if let Some(timer) = app(|a| a.toast_timer.take()).flatten() { window().clear_timeout_with_handle(timer); }
    let timer = later(2600, || { if let Some(el) = query("#toast") { let _ = el.class_list().remove_1("show"); } });
    app(|a| a.toast_timer = timer);
}

fn download(content: &str, name: &str, kind: &str) {
    let options = Object::new();
    js_set(&options, "type", &kind.into());
    let Ok(blob) = web_sys::Blob::new_with_str_sequence_and_options(&Array::of1(&content.into()), options.unchecked_ref()) else { return };
    let Ok(url) = web_sys::Url::create_object_url_with_blob(&blob) else { return };
    if let Ok(anchor) = document().create_element("a").map(|a| a.unchecked_into::<web_sys::HtmlAnchorElement>()) {
        anchor.set_href(&url);
        anchor.set_download(name);
        anchor.click();
    }
    later(2000, move || { let _ = web_sys::Url::revoke_object_url(&url); });
    toast("Export ready");
}

/// Give every table cell its column heading, which the narrow layout shows beside the value.
fn label_table_cells() {
    for table in query_all(&body(), ".data-table,.mini-table") {
        let labels: Vec<String> = query_all(&table, "thead th").iter().map(|th| th.text_content().unwrap_or_default()).collect();
        for row in query_all(&table, "tbody tr") {
            let cells = row.children();
            for index in 0..cells.length() {
                if let Some(cell) = cells.item(index) { let _ = cell.set_attribute("data-label", labels.get(index as usize).map_or("", String::as_str)); }
            }
        }
    }
}

fn set_toggle(button: &Element, paused: bool, resume: &str, pause: &str) {
    button.set_inner_html(&views::icon(if paused { "play" } else { "pause" }));
    let label = if paused { resume } else { pause };
    let _ = button.set_attribute("aria-label", label);
    let _ = button.set_attribute("title", label);
}

fn sync_rotation_button() {
    let (Some(button), Some(globe)) = (query("#rotate-toggle"), app(|a| a.globe.clone()).flatten()) else { return };
    set_toggle(&button, js_get(&globe, "paused").is_truthy(), "Resume rotation", "Pause rotation");
}

fn sync_material_controls() {
    let Some(view) = query("#view") else { return };
    let api = app(|a| a.material_view.as_ref().and_then(|m| m.api.clone())).flatten();
    for button in query_all(&view, "[data-material-action]") {
        if let Some(control) = button.dyn_ref::<web_sys::HtmlButtonElement>() { control.set_disabled(api.is_none()); }
        if button.get_attribute("data-material-action").as_deref() == Some("rotate-toggle") {
            let paused = api.as_ref().is_none_or(|api| js_get(api, "paused").is_truthy());
            set_toggle(&button, paused, "Resume material rotation", "Pause material rotation");
        }
    }
}

fn dispose_material_view() {
    let Some(previous) = app(|a| a.material_view.take()).flatten() else { return };
    let _ = previous.host.remove_event_listener_with_callback("materialrotationchange", &previous.listener);
    if let Some(api) = previous.api { let _ = js_call(&api, "dispose", &[]); }
}

/// Attach the specimen model to `host`, reusing the running one when the host is unchanged.
fn sync_material_view(host: Option<Element>) {
    let Some(host) = host else { dispose_material_view(); return };
    let material = app(|a| a.state.material.clone()).unwrap_or_default();
    let same = app(|a| a.material_view.as_mut().filter(|m| m.host == host).map(|m| (m.material != material, m.api.clone()))).flatten();
    if let Some((changed, api)) = same {
        if changed {
            app(|a| if let Some(m) = a.material_view.as_mut() { m.material = material.clone(); });
            if let Some(api) = api { let _ = js_call(&api, "setMaterial", &[material.as_str().into()]); }
        }
        sync_material_controls();
        return;
    }
    dispose_material_view();
    let listener: Function = Closure::<dyn FnMut()>::new(sync_material_controls).into_js_value().unchecked_into();
    let _ = host.add_event_listener_with_callback("materialrotationchange", &listener);
    let token = app(|a| {
        a.material_token += 1;
        a.material_view = Some(MaterialView { host: host.clone(), material: material.clone(), api: None, token: a.material_token, listener });
        a.material_token
    }).unwrap_or(0);
    let _ = host.set_attribute("data-model-state", "loading");
    sync_material_controls();
    spawn_local(async move {
        let current = |host: &Element| app(|a| a.material_view.as_ref().is_some_and(|m| m.token == token) && a.state.view == "overview").unwrap_or(false) && host.is_connected();
        let created = async {
            let module = JsFuture::from(import_module("./material-model.mjs")).await?;
            if !current(&host) { return Ok(None); }
            js_call(&module, "createMaterialModel", &[host.clone().into(), material.as_str().into()]).map(Some)
        }.await;
        match created {
            Ok(Some(api)) => {
                if !current(&host) { let _ = js_call(&api, "dispose", &[]); return; }
                app(|a| if let Some(m) = a.material_view.as_mut() { m.api = Some(api); });
                let _ = host.set_attribute("data-model-state", "ready");
                sync_material_controls();
            }
            Ok(None) => {}
            Err(error) => {
                if !current(&host) { return; }
                let _ = host.set_attribute("data-model-state", "fallback");
                sync_material_controls();
                web_sys::console::warn_2(&"Material illustration fallback:".into(), &message(&error));
            }
        }
    });
}

fn render_evidence_rows() {
    let Some((html, _)) = app(|a| { let (html, page) = views::evidence_results(&a.rows, &a.state.evidence_filter(), a.state.page); a.state.page = page; (html, page) }) else { return };
    if let Some(el) = query("#evidence-results") { el.set_inner_html(&html); }
    label_table_cells();
}

fn render_sources() {
    let Some((html, _)) = app(|a| { let (html, page) = views::source_results(&a.bundle, &a.rows, &a.state.source_query, &a.state.source_type, a.state.source_page); a.state.source_page = page; (html, page) }) else { return };
    if let Some(el) = query("#source-results") { el.set_inner_html(&html); }
    label_table_cells();
}

fn sync_url() {
    let Ok(href) = window().location().href() else { return };
    if let Some(next) = app(|a| app::sync_url(&a.state, &href)).flatten() {
        if let Ok(history) = window().history() { let _ = history.replace_state_with_url(&JsValue::NULL, "", Some(&next)); }
    }
}

fn render() {
    let Some(view) = query("#view") else { return };
    // Leaving the experiments view closes its explorer.
    if let Some(cleanup) = app(|a| a.original_cleanup.take()).flatten() { let _ = cleanup.call0(&JsValue::NULL); }
    let Some((sequence, name, world, markup)) = app(|a| {
        a.render_sequence += 1;
        let s = &a.state;
        let markup = match s.view.as_str() {
            "experiments" => None, // the JavaScript explorer supplies its own frame below
            "evidence" => Some(views::evidence(&a.rows, &s.evidence_filter())),
            "compare" => Some(views::compare(&a.rows, &s.material, &s.world)),
            "sources" => Some(views::source_view(&a.bundle, &s.source_query, &s.source_type)),
            "scenes" => Some(views::scenes(&s.world)),
            _ => { a.specimen_instance += 1; Some(views::overview(&a.rows, &s.material, &s.world, a.specimen_instance)) }
        };
        (a.render_sequence, s.view.clone(), s.world.clone(), markup)
    }) else { return };
    let overview = name == "overview";
    // All environments share one renderer; switching worlds must not lose its GPU cache.
    let retained = if overview && app(|a| a.globe.is_some()).unwrap_or(false) { query("#globe") } else { None };
    if retained.is_none() { if let Some(globe) = app(|a| a.globe.take()).flatten() { let _ = js_call(&globe, "dispose", &[]); } }
    let retained_material = if overview { app(|a| a.material_view.as_ref().map(|m| m.host.clone())).flatten().filter(|host| host.get_attribute("data-model-state").as_deref() != Some("fallback")) } else { None };
    if retained_material.is_none() { dispose_material_view(); }
    // The whole document, as in JavaScript: the body carries data-view too.
    for button in document().document_element().map(|root| query_all(&root, "[data-view]")).unwrap_or_default() {
        let active = button.get_attribute("data-view").as_deref() == Some(name.as_str());
        let _ = button.class_list().toggle_with_force("active", active);
        let _ = button.set_attribute("aria-current", if active { "page" } else { "false" });
    }
    let _ = body().set_attribute("data-view", &name);

    match name.as_str() {
        "experiments" => {
            let view = view.clone();
            spawn_local(async move {
                let Ok(module) = JsFuture::from(import_module("./original-data.mjs")).await else { return };
                if app(|a| a.render_sequence != sequence).unwrap_or(true) { return; }
                view.set_inner_html(&js_call(&module, "originalDataHTML", &[]).ok().and_then(|html| html.as_string()).unwrap_or_default());
                let on_change = Closure::<dyn FnMut(JsValue)>::new(move |next: JsValue| {
                    let text = |key: &str| js_get(&next, key).as_string().unwrap_or_default();
                    let applied = app(|a| {
                        if a.render_sequence != sequence || a.state.view != "experiments" { return false; }
                        a.state.original_dataset = text("datasetId");
                        a.state.original_query = text("query");
                        true
                    }).unwrap_or(false);
                    if applied { sync_url(); }
                });
                let options = Object::new();
                let (dataset, search) = app(|a| (a.state.original_dataset.clone(), a.state.original_query.clone())).unwrap_or_default();
                js_set(&options, "datasetId", &dataset.into());
                js_set(&options, "query", &search.into());
                js_set(&options, "onStateChange", on_change.as_ref());
                app(|a| a.original_listener = Some(on_change));
                let Ok(mounted) = js_call(&module, "mountOriginalData", &[view.clone().into(), options.into()]) else { return };
                let Ok(cleanup) = JsFuture::from(Promise::resolve(&mounted)).await.and_then(|f| f.dyn_into::<Function>()) else { return };
                if app(|a| a.render_sequence != sequence).unwrap_or(true) { let _ = cleanup.call0(&JsValue::NULL); } else { app(|a| a.original_cleanup = Some(cleanup)); }
            });
        }
        _ => {
            view.set_inner_html(&markup.unwrap_or_default());
            if name == "evidence" { render_evidence_rows(); }
            if name == "sources" { render_sources(); }
            if name == "scenes" { follow_scene_frame(); }
            label_table_cells();
        }
    }
    if !overview { return; }
    if let (Some(host), Some(placeholder)) = (&retained_material, view.query_selector("[data-material-model]").ok().flatten()) { let _ = placeholder.replace_with_with_node_1(host); }
    sync_material_view(view.query_selector("[data-material-model]").ok().flatten());
    if let (Some(kept), Some(placeholder)) = (&retained, query("#globe")) {
        let _ = placeholder.replace_with_with_node_1(kept);
        app(|a| { if let Some(globe) = &a.globe { let _ = js_call(globe, "setWorld", &[world.as_str().into()]); } a.globe_world = world.clone(); });
        sync_rotation_button();
        return;
    }
    spawn_local(async move {
        let created = async {
            let module = JsFuture::from(import_module("./globe.mjs")).await?;
            if app(|a| a.render_sequence != sequence).unwrap_or(true) { return Ok(None); }
            let host = query("#globe").ok_or_else(|| JsValue::from_str("The planet stage is missing."))?;
            let globe = js_call(&module, "createGlobe", &[host.clone().into(), world.as_str().into()])?;
            Ok::<_, JsValue>(Some((host, globe)))
        }.await;
        match created {
            Ok(Some((host, globe))) => {
                app(|a| { a.globe = Some(globe); a.globe_world = world; });
                sync_rotation_button();
                listen(&host, "rotationchange", |_| sync_rotation_button());
            }
            Ok(None) => {}
            Err(error) => web_sys::console::warn_2(&"Globe fallback:".into(), &message(&error)),
        }
    });
}

/// Keep the selected gravity environment in step with the 3D scene the visitor moves to.
fn follow_scene_frame() {
    let Some(frame) = query("#scene-frame") else { return };
    let on_scene = Closure::<dyn FnMut(JsValue)>::new(|event: JsValue| {
        let Some(world) = js_get(&js_get(&event, "detail"), "to").as_string().and_then(|scene| app::world_for_scene(&scene)) else { return };
        if app(|a| { let changed = a.state.view == "scenes" && a.state.world != world; if changed { a.state.world = world.to_string(); } changed }).unwrap_or(false) {
            sync_url();
            if let Some(link) = query("#scene-open") { let _ = link.set_attribute("href", &format!("./scenes/index.html#{}", app::scene_for_world(world))); }
        }
    });
    let listener: Function = on_scene.as_ref().clone().unchecked_into();
    let target = frame.clone();
    listen(&frame, "load", move |_| { let _ = js_call(&js_get(&target, "contentWindow"), "addEventListener", &["soraine:scene".into(), listener.clone().into()]); });
    app(|a| a.scene_listener = Some(on_scene));
}

fn navigate(name: &str) {
    if !app::VIEWS.contains(&name) { return; }
    app(|a| a.state.view = name.to_string());
    sync_url();
    render();
    let top = Object::new();
    js_set(&top, "top", &0.into());
    js_set(&top, "behavior", &"instant".into());
    let _ = js_call(&window(), "scrollTo", &[top.into()]);
    if let Some(workspace) = query("#workspace") {
        let quiet = Object::new();
        js_set(&quiet, "preventScroll", &true.into());
        let _ = js_call(&workspace, "focus", &[quiet.into()]);
    }
}

fn route_global_search(question: &str) {
    match app(|a| app::route_global_search(&mut a.state, &a.rows, question)).unwrap_or(Route::Stay) {
        Route::Stay => {}
        Route::Go(view) => navigate(view),
        Route::SearchEvidence => { navigate("evidence"); focus("#record-search"); }
    }
}

fn show_dialog(markup: Option<String>) {
    let (Some(markup), Some(content), Some(dialog)) = (markup, query("#detail-content"), dialog()) else { return };
    content.set_inner_html(&markup);
    let _ = dialog.show_modal();
}

/// A joined result as the JavaScript app exports it: the measurement plus its experiment, source and kind.
fn exported_row(row: &Row) -> Value {
    let mut record = row.measurement.as_object().cloned().unwrap_or_default();
    record.insert("experiment".into(), row.experiment.clone().unwrap_or(Value::Null));
    record.insert("source".into(), row.source.clone().unwrap_or(Value::Null));
    record.insert("kind".into(), json!({"name": row.kind.name, "color": row.kind.color}));
    Value::Object(record)
}
fn pretty(value: &Value) -> String { serde_json::to_string_pretty(value).unwrap_or_default() }

fn on_click(event: Event) {
    let Some(target) = event.target().and_then(|t| t.dyn_into::<Element>().ok()) else { return };
    let Some(b) = target.closest("button,a,tr[data-record]").ok().flatten() else { return };
    let id = b.id();
    if let Some(question) = data_attribute(&b, "research-question") { route_global_search(&question); }
    else if data_attribute(&b, "browse-materials").is_some() {
        app(|a| a.state.reset_evidence_filters("", "All", "All"));
        navigate("evidence");
        focus("#material-filter");
    }
    else if let Some(view) = data_attribute(&b, "view") { event.prevent_default(); navigate(&view); }
    else if let Some(material) = data_attribute(&b, "material") { app(|a| a.state.material = material); sync_url(); render(); }
    else if let Some(world) = data_attribute(&b, "world") { app(|a| a.state.world = world); sync_url(); render(); }
    else if let Some(record) = data_attribute(&b, "record") { show_dialog(app(|a| views::record_dialog(&a.rows, &record)).flatten()); }
    else if let Some(source) = data_attribute(&b, "source") { show_dialog(app(|a| views::source_dialog(&a.bundle, &a.rows, &source)).flatten()); }
    else if let Some(step) = data_attribute(&b, "page") { app(|a| a.state.page = a.state.page.saturating_add_signed(step.parse().unwrap_or(0))); render_evidence_rows(); }
    else if let Some(step) = data_attribute(&b, "source-page") { app(|a| a.state.source_page = a.state.source_page.saturating_add_signed(step.parse().unwrap_or(0))); render_sources(); }
    else if let Some(record) = data_attribute(&b, "download-record") {
        if let Some(content) = app(|a| a.rows.iter().find(|r| r.get("measurement_id") == record).map(|r| pretty(&exported_row(r)))).flatten() { download(&content, &format!("soraine-{record}.json"), "application/json"); }
    }
    else if id == "about-btn" || id == "credits-btn" { show_dialog(app(|a| views::about_dialog(&a.bundle))); }
    else if id == "export-all" { if let Some(content) = app(|a| pretty(&a.bundle)) { download(&content, "soraine-bigquery-research.json", "application/json"); } }
    else if id == "export-filtered" { if let Some(content) = app(|a| data::csv(data::filter_rows(&a.rows, &a.state.evidence_filter()))) { download(&content, "soraine-filtered-results.csv", "text/csv;charset=utf-8"); } }
    else if id == "export-comparison" {
        if let Some((content, material)) = app(|a| (data::csv(a.rows.iter().filter(|r| r.material() == Some(a.state.material.as_str()) && r.evidence_type() == data::LIMIT_AGGREGATE)), a.state.material.clone())) {
            download(&content, &format!("soraine-{}-comparison.csv", material.replace(' ', "-")), "text/csv;charset=utf-8");
        }
    }
    else if id == "clear-filters" { app(|a| a.state.reset_evidence_filters("", "All", "All")); sync_url(); render(); }
    else if matches!(id.as_str(), "zoom-in" | "zoom-out" | "reset-globe" | "rotate-toggle") {
        let Some(globe) = app(|a| a.globe.clone()).flatten() else { return };
        match id.as_str() {
            "zoom-in" => { let _ = js_call(&globe, "zoom", &[(-0.4).into()]); }
            "zoom-out" => { let _ = js_call(&globe, "zoom", &[0.4.into()]); }
            "reset-globe" => { let _ = js_call(&globe, "reset", &[]); }
            _ => {
                let paused = !js_get(&globe, "paused").is_truthy();
                js_set(&globe, "paused", &paused.into());
                set_toggle(&b, js_get(&globe, "paused").is_truthy(), "Resume rotation", "Pause rotation");
            }
        }
    }
    else if b.class_list().contains("dialog-close") { if let Some(dialog) = dialog() { dialog.close(); } }
}

/// Clicks inside the overview: the specimen model and its four controls.
fn on_view_click(event: Event) {
    let Some(target) = event.target().and_then(|t| t.dyn_into::<Element>().ok()) else { return };
    // Exploring a specimen never opens the separate source-record button.
    if target.closest("[data-material-model]").ok().flatten().is_some() { event.stop_propagation(); return; }
    let Some(button) = target.closest("button[data-material-action]").ok().flatten() else { return };
    event.prevent_default();
    event.stop_propagation();
    let Some(api) = app(|a| a.material_view.as_ref().and_then(|m| m.api.clone())).flatten() else { return };
    match button.get_attribute("data-material-action").as_deref() {
        Some("zoom-in") => { let _ = js_call(&api, "zoom", &[(-0.35).into()]); }
        Some("zoom-out") => { let _ = js_call(&api, "zoom", &[0.35.into()]); }
        Some("rotate-toggle") => js_set(&api, "paused", &(!js_get(&api, "paused").is_truthy()).into()),
        Some("reset") => { let _ = js_call(&api, "reset", &[]); }
        _ => {}
    }
}

fn on_keydown(event: Event) {
    let Some(key) = event.dyn_ref::<KeyboardEvent>().map(KeyboardEvent::key) else { return };
    let typing = document().active_element().is_some_and(|el| matches!(el.tag_name().as_str(), "INPUT" | "TEXTAREA" | "SELECT"));
    if key == "/" && !typing && !dialog().is_some_and(|d| d.open()) { event.prevent_default(); focus("#global-search"); }
    if key == "Enter" || key == " " {
        if let Some(row) = event.target().and_then(|t| t.dyn_into::<Element>().ok()).filter(|el| el.matches("tr[data-record]").unwrap_or(false)) {
            event.prevent_default();
            let record = row.get_attribute("data-record").unwrap_or_default();
            show_dialog(app(|a| views::record_dialog(&a.rows, &record)).flatten());
        }
    }
}

fn on_input(event: Event) {
    let Some(input) = event.target().and_then(|t| t.dyn_into::<HtmlInputElement>().ok()) else { return };
    match input.id().as_str() {
        "record-search" => { app(|a| { a.state.query = input.value(); a.state.page = 0; }); sync_url(); render_evidence_rows(); }
        "source-search" => { app(|a| { a.state.source_query = input.value(); a.state.source_page = 0; }); sync_url(); render_sources(); }
        _ => {}
    }
}

fn on_change(event: Event) {
    let Some(select) = event.target().and_then(|t| t.dyn_into::<HtmlSelectElement>().ok()) else { return };
    let value = select.value();
    let evidence = app(|a| {
        match select.id().as_str() {
            "world-filter" => a.state.filter_world = value.clone(),
            "material-filter" => a.state.filter_material = value.clone(),
            "kind-filter" => a.state.filter_kind = value.clone(),
            "source-type" => { a.state.source_type = value.clone(); a.state.source_page = 0; return Some(false); }
            _ => return None,
        }
        a.state.page = 0;
        Some(true)
    }).flatten();
    match evidence { Some(true) => { sync_url(); render_evidence_rows(); } Some(false) => { sync_url(); render_sources(); } None => {} }
}

async fn load_bundle() -> Result<Value, JsValue> {
    let fetch = |path: &'static str| async move { JsFuture::from(window().fetch_with_str(path)).await.and_then(|r| r.dyn_into::<web_sys::Response>()) };
    let mut response = fetch("./api/research").await.ok().filter(web_sys::Response::ok);
    if response.is_none() { response = Some(fetch("./data/research.json").await?); }
    let response = response.filter(web_sys::Response::ok).ok_or_else(|| JsValue::from_str("Research data could not be loaded."))?;
    let text = JsFuture::from(response.text()?).await?.as_string().unwrap_or_default();
    serde_json::from_str(text.trim_start_matches('\u{feff}')).map_err(|error| JsValue::from_str(&error.to_string()))
}

fn set_disabled(selector: &str) { if let Some(button) = query(selector).and_then(|el| el.dyn_into::<web_sys::HtmlButtonElement>().ok()) { button.set_disabled(true); } }

/// Start the page. Called once when the WebAssembly module loads.
pub fn start() {
    for el in query_all(&body(), "[data-icon]") { el.set_inner_html(&views::icon(&el.get_attribute("data-icon").unwrap_or_default())); }
    for button in query_all(&body(), ".main-nav button") {
        let name = match button.get_attribute("data-view").as_deref() { Some("overview") => "grid", Some("experiments") => "database", Some("compare") => "chart", Some("evidence") => "layers", Some("sources") => "book", Some("scenes") => "flame", _ => "" };
        button.set_inner_html(&format!("{}<span>{}</span>", views::icon(name), button.text_content().unwrap_or_default()));
    }
    if let Some(export) = query("#export-all") { let _ = export.set_attribute("aria-label", "Export all research data"); }

    let page: EventTarget = document().into();
    listen(&page, "click", on_click);
    listen(&page, "keydown", on_keydown);
    listen(&page, "input", on_input);
    listen(&page, "change", on_change);
    if let Some(view) = query("#view") { listen(&view, "click", on_view_click); }
    if let Some(search) = query("#global-search") {
        listen(&search, "keydown", |event| {
            let (Some(key), Some(input)) = (event.dyn_ref::<KeyboardEvent>().map(KeyboardEvent::key), event.target().and_then(|t| t.dyn_into::<HtmlInputElement>().ok())) else { return };
            if key == "Enter" { route_global_search(&input.value()); input.set_value(""); }
        });
    }
    if let Some(dialog) = dialog() {
        let backdrop = dialog.clone();
        listen(&dialog, "click", move |event| {
            let itself: &EventTarget = backdrop.as_ref();
            let (Some(mouse), true) = (event.dyn_ref::<MouseEvent>(), event.target().is_some_and(|t| &t == itself)) else { return };
            let (r, x, y) = (backdrop.get_bounding_client_rect(), f64::from(mouse.client_x()), f64::from(mouse.client_y()));
            if x < r.left() || x > r.right() || y < r.top() || y > r.bottom() { backdrop.close(); }
        });
    }

    spawn_local(async {
        if let Ok(glossary) = JsFuture::from(import_module("./glossary.mjs")).await { let _ = js_call(&glossary, "initGlossary", &[]); }
        match load_bundle().await {
            Ok(bundle) => {
                if let Some(connection) = query(".connection") { connection.set_inner_html(&format!("<i></i> {}", app::connection_label(&bundle))); }
                if let Some(date) = query("#snapshot-date") { date.set_text_content(Some(&app::snapshot_label(&bundle))); }
                let rows = data::join_research(&bundle);
                let mut state = State::default();
                let location = window().location();
                let record = app::restore_url_state(&mut state, &location.search().unwrap_or_default(), &location.hash().unwrap_or_default(), &rows, &bundle);
                APP.with(|cell| *cell.borrow_mut() = Some(App { bundle, rows, state, render_sequence: 0, specimen_instance: 0, material_token: 0, globe: None, globe_world: String::new(),
                    material_view: None, original_cleanup: None, original_listener: None, scene_listener: None, toast_timer: None }));
                render();
                if let Some(record) = record { show_dialog(app(|a| views::record_dialog(&a.rows, &record)).flatten()); }
            }
            Err(error) => {
                let text = message(&error).as_string().unwrap_or_default();
                if let Some(view) = query("#view") { view.set_inner_html(&format!("<div class=\"empty\"><strong>Research archive unavailable</strong>{}<p>Reload this page to try again.</p></div>", data::esc(&text))); }
                for selector in ["#export-all", "#about-btn", "#credits-btn"] { set_disabled(selector); }
                web_sys::console::error_1(&error);
            }
        }
    });
}
