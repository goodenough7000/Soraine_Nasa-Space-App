use futures_util::FutureExt;
use serde_json::Value;
use soraine_server::http::{router, App};
use soraine_server::original::read_original_bundle;
use soraine_server::research::{read_public_bundle, system_clock, Cache, Refresh, Request};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

const TTL_MS: u64 = 300_000;

fn dist_root() -> PathBuf {
    if let Ok(path) = std::env::var("SORAINE_DIST") { return PathBuf::from(path); }
    let local = PathBuf::from("dist");
    if local.is_dir() { local } else { PathBuf::from(concat!(env!("CARGO_MANIFEST_DIR"), "/../../dist")) }
}

fn snapshot(root: &std::path::Path, name: &str) -> Value {
    let path = root.join("data").join(name);
    let text = std::fs::read_to_string(&path).unwrap_or_else(|error| panic!("{}: {error}", path.display()));
    serde_json::from_str(text.trim_start_matches('\u{feff}')).unwrap_or_else(|error| panic!("{}: {error}", path.display()))
}

/// Authenticated BigQuery reads using the Cloud Run runtime identity. No keys are stored anywhere.
fn bigquery_request() -> Request {
    let client = reqwest::Client::new();
    let credential: Arc<Mutex<(String, u64)>> = Arc::new(Mutex::new((String::new(), 0)));
    Arc::new(move |url: String| {
        let (client, credential, now) = (client.clone(), credential.clone(), system_clock());
        async move {
            if std::env::var_os("K_SERVICE").is_none() { return Err("Local snapshot mode".to_string()); }
            let mut cached = credential.lock().await;
            if cached.0.is_empty() || now() >= cached.1 {
                let response = client.get("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token")
                    .header("Metadata-Flavor", "Google").timeout(Duration::from_secs(3)).send().await.map_err(|e| e.to_string())?;
                if !response.status().is_success() { return Err("Runtime identity unavailable".to_string()); }
                let token: Value = response.json().await.map_err(|e| e.to_string())?;
                let lifetime = token.get("expires_in").and_then(Value::as_f64).unwrap_or(0.0);
                *cached = (token.get("access_token").and_then(Value::as_str).unwrap_or("").to_string(), now() + ((lifetime - 60.0).max(0.0) * 1000.0) as u64);
            }
            let bearer = cached.0.clone();
            drop(cached);
            let response = client.get(url).bearer_auth(bearer).timeout(Duration::from_secs(8)).send().await.map_err(|e| e.to_string())?;
            if !response.status().is_success() { return Err(format!("Research read failed: {}", response.status().as_u16())); }
            response.json::<Value>().await.map_err(|e| e.to_string())
        }.boxed()
    })
}

#[tokio::main]
async fn main() {
    let root = dist_root().canonicalize().expect("the dist folder exists");
    let project = std::env::var("BQ_PROJECT").unwrap_or_else(|_| "project-89aca125-c9a5-4fdd-bb0".to_string());
    let dataset = std::env::var("BQ_DATASET").unwrap_or_else(|_| "flame_in_freefall_2026".to_string());
    let (research_snapshot, original_snapshot) = (snapshot(&root, "research.json"), snapshot(&root, "original-data.json"));
    let request = bigquery_request();

    let refresh_research: Refresh = {
        let (request, project, dataset, snapshot) = (request.clone(), project.clone(), dataset.clone(), research_snapshot.clone());
        Arc::new(move || {
            let (request, project, dataset, snapshot) = (request.clone(), project.clone(), dataset.clone(), snapshot.clone());
            async move { read_public_bundle(request, &project, &dataset, &snapshot).await.inspect_err(|error| eprintln!("Research refresh: {error}")) }.boxed()
        })
    };
    let refresh_original: Refresh = Arc::new(move || {
        let (request, project, dataset) = (request.clone(), project.clone(), dataset.clone());
        async move { read_original_bundle(request, &project, &dataset).await.inspect_err(|error| eprintln!("Original data refresh: {error}")) }.boxed()
    });
    let app = Arc::new(App {
        root,
        research: Cache::new(research_snapshot, refresh_research, TTL_MS, system_clock()),
        original: Cache::new(original_snapshot, refresh_original, TTL_MS, system_clock()),
    });

    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(4335);
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", port)).await.expect("the port is free");
    println!("Soraine dashboard ready (port {})", listener.local_addr().map(|a| a.port()).unwrap_or(port));
    let shutdown = async {
        #[cfg(unix)]
        {
            let mut terminate = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()).expect("signal handler");
            tokio::select! { _ = terminate.recv() => {}, _ = tokio::signal::ctrl_c() => {} }
        }
        #[cfg(not(unix))]
        { let _ = tokio::signal::ctrl_c().await; }
    };
    axum::serve(listener, router(app)).with_graceful_shutdown(shutdown).await.expect("server runs");
}
