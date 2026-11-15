//! Port of the request handler in `server/index.mjs`: public assets with
//! validators and audio ranges, a health check and the two data routes.
use crate::research::Cache;
use axum::body::Body;
use axum::extract::{Request, State};
use axum::http::request::Parts;
use axum::http::{header, HeaderValue, Method, Response, StatusCode};
use axum::Router;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::UNIX_EPOCH;

pub struct App {
    /// The published `dist/` folder. Nothing outside it is ever served.
    pub root: PathBuf,
    pub research: Cache,
    pub original: Cache,
}

pub fn router(app: Arc<App>) -> Router { Router::new().fallback(handle).with_state(app) }

async fn handle(State(app): State<Arc<App>>, request: Request) -> Response<Body> {
    // Only the request line and headers are needed; dropping the body keeps the handler `Send`.
    let (request, _body) = request.into_parts();
    let head = request.method == Method::HEAD;
    let mut response = if !matches!(request.method, Method::GET | Method::HEAD) {
        Response::builder().status(StatusCode::METHOD_NOT_ALLOWED).header(header::ALLOW, "GET, HEAD").body(Body::empty()).expect("static response")
    } else {
        serve(&app, &request, head).await.unwrap_or_else(|| {
            let body = if head { Body::empty() } else { Body::from("Not found") };
            Response::builder().status(StatusCode::NOT_FOUND).header(header::CONTENT_TYPE, "text/plain").body(body).expect("static response")
        })
    };
    let headers = response.headers_mut();
    headers.insert("x-content-type-options", HeaderValue::from_static("nosniff"));
    headers.insert("referrer-policy", HeaderValue::from_static("strict-origin-when-cross-origin"));
    headers.insert("permissions-policy", HeaderValue::from_static("camera=(), microphone=(), geolocation=()"));
    response
}

fn json(body: String, head: bool) -> Option<Response<Body>> {
    Response::builder().header(header::CONTENT_TYPE, "application/json").header(header::CACHE_CONTROL, "public, max-age=30")
        .body(if head { Body::empty() } else { Body::from(body) }).ok()
}

fn content_type(extension: &str) -> &'static str {
    match extension {
        ".html" => "text/html; charset=utf-8",
        ".mjs" | ".js" => "text/javascript",
        ".css" => "text/css",
        ".json" => "application/json",
        ".svg" => "image/svg+xml",
        ".jpg" => "image/jpeg",
        ".png" => "image/png",
        ".webp" => "image/webp",
        ".woff2" => "font/woff2",
        ".wav" => "audio/wav",
        ".ogg" => "audio/ogg",
        ".mp3" => "audio/mpeg",
        ".wasm" => "application/wasm",
        _ => "application/octet-stream",
    }
}

/// Node's `resolve(root, '.' + pathname)`: purely lexical, so `..` can leave the root and is then refused.
fn resolve(root: &Path, pathname: &str) -> PathBuf {
    let mut out = root.to_path_buf();
    for part in pathname.split('/') {
        match part {
            "" | "." => {}
            ".." => { out.pop(); }
            name => out.push(name),
        }
    }
    out
}

#[derive(Debug, PartialEq, Eq)]
pub enum AudioRange { Ignore, Unsatisfiable, Bytes(u64, u64) }

/// Ignore malformed or multipart requests; a valid range outside the file is 416.
pub fn audio_range(header: Option<&str>, size: u64) -> AudioRange {
    let header = header.unwrap_or("").trim();
    let Some(rest) = header.get(..6).filter(|p| p.eq_ignore_ascii_case("bytes=")).map(|_| &header[6..]) else { return AudioRange::Ignore };
    let Some((first, last)) = rest.split_once('-') else { return AudioRange::Ignore };
    let digits = |s: &str| s.bytes().all(|b| b.is_ascii_digit());
    if !digits(first) || !digits(last) || (first.is_empty() && last.is_empty()) { return AudioRange::Ignore; }
    let big = |s: &str| s.parse::<u128>().unwrap_or(u128::MAX);
    let length = u128::from(size);
    if first.is_empty() {
        let suffix = big(last);
        if length == 0 || suffix == 0 { return AudioRange::Unsatisfiable; }
        return AudioRange::Bytes(if suffix >= length { 0 } else { (length - suffix) as u64 }, size - 1);
    }
    let start = big(first);
    let end = (!last.is_empty()).then(|| big(last));
    if end.is_some_and(|end| end < start) { return AudioRange::Ignore; }
    if start >= length { return AudioRange::Unsatisfiable; }
    AudioRange::Bytes(start as u64, end.map_or(size - 1, |end| end.min(length - 1) as u64))
}

async fn serve(app: &App, request: &Parts, head: bool) -> Option<Response<Body>> {
    let pathname = percent_encoding::percent_decode_str(request.uri.path()).decode_utf8().ok()?;
    match pathname.as_ref() {
        "/healthz" => return Response::builder().header(header::CONTENT_TYPE, "application/json")
            .body(if head { Body::empty() } else { Body::from(r#"{"status":"ok"}"#) }).ok(),
        "/api/research" => return json(app.research.get().await.to_string(), head),
        "/api/original-data" => return json(app.original.get().await.to_string(), head),
        _ => {}
    }
    // Restrict serving to public assets, never repository, cloud config or source.
    let mut file = resolve(&app.root, &pathname);
    if !file.starts_with(&app.root) { return Response::builder().status(StatusCode::FORBIDDEN).body(Body::empty()).ok(); }
    let mut info = tokio::fs::metadata(&file).await.ok()?;
    if info.is_dir() {
        file.push("index.html");
        info = tokio::fs::metadata(&file).await.ok()?;
    }
    let (size, modified) = (info.len(), info.modified().ok()?);
    let modified_ms = modified.duration_since(UNIX_EPOCH).ok()?.as_millis();
    let etag = format!("W/\"{size:x}-{modified_ms:x}\"");
    let path_text = file.to_string_lossy();
    let extension = file.extension().map(|e| format!(".{}", e.to_string_lossy().to_lowercase())).unwrap_or_default();
    let audio = matches!(extension.as_str(), ".wav" | ".ogg" | ".mp3");
    let stable = audio || [".png", ".jpg", ".webp", ".woff2", ".svg"].iter().any(|suffix| path_text.ends_with(suffix));
    let request_header = |name: header::HeaderName| request.headers.get(name).and_then(|v| v.to_str().ok());

    let mut response = Response::builder()
        .header(header::CACHE_CONTROL, if stable { "public, max-age=3600" } else { "public, max-age=0, must-revalidate" })
        .header(header::ETAG, &etag)
        .header(header::LAST_MODIFIED, httpdate::fmt_http_date(modified));
    if audio { response = response.header(header::ACCEPT_RANGES, "bytes"); }
    if request_header(header::IF_NONE_MATCH).unwrap_or("").split(',').any(|candidate| candidate.trim() == etag) {
        return response.status(StatusCode::NOT_MODIFIED).body(Body::empty()).ok();
    }
    response = response.header(header::CONTENT_TYPE, content_type(&extension));
    // Range applies to GET only. HEAD reports the full representation's headers.
    if head { return response.header(header::CONTENT_LENGTH, size).body(Body::empty()).ok(); }
    let bytes = tokio::fs::read(&file).await.ok()?;
    if audio {
        // Our validator is weak, so If-Range can match only a modification date.
        let range_allowed = request_header(header::IF_RANGE).is_none_or(|validator| {
            httpdate::parse_http_date(validator).ok().and_then(|date| date.duration_since(UNIX_EPOCH).ok()).is_some_and(|date| date.as_millis() >= modified_ms / 1000 * 1000)
        });
        match if range_allowed { audio_range(request_header(header::RANGE), size) } else { AudioRange::Ignore } {
            AudioRange::Unsatisfiable => {
                return response.status(StatusCode::RANGE_NOT_SATISFIABLE).header(header::CONTENT_RANGE, format!("bytes */{size}")).header(header::CONTENT_LENGTH, 0).body(Body::empty()).ok();
            }
            AudioRange::Bytes(start, end) => {
                let slice = bytes.get(start as usize..=end as usize)?.to_vec();
                return response.status(StatusCode::PARTIAL_CONTENT).header(header::CONTENT_RANGE, format!("bytes {start}-{end}/{size}"))
                    .header(header::CONTENT_LENGTH, slice.len()).body(Body::from(slice)).ok();
            }
            AudioRange::Ignore => {}
        }
    }
    response.header(header::CONTENT_LENGTH, bytes.len()).body(Body::from(bytes)).ok()
}
