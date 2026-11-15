"""Local preview server: python serve.py [port]. Correct MIME types for ES modules / GLB, no caching."""
import http.server, sys, os
os.chdir(os.path.dirname(os.path.abspath(__file__)))
class H(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
        ".glb": "model/gltf-binary", ".css": "text/css", ".html": "text/html"}
    def end_headers(self):
        self.send_header("Cache-Control", "no-store"); super().end_headers()
port = int(sys.argv[1]) if len(sys.argv) > 1 else 5180
print(f"Flame in Freefall: http://localhost:{port}  (Ctrl+C to stop)")
http.server.ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
