from wsgiref.simple_server import make_server
from pathlib import Path
import mimetypes
import json

ROOT = Path(__file__).resolve().parent.parent  # project root
print(ROOT)

def app(environ, start_response):
    path = environ.get("PATH_INFO", "/")

    # ---- API ----
    if path == "/api/health":
        start_response("200 OK", [("Content-Type", "application/json")])
        return [json.dumps({"status": "ok"}).encode()]

    # ---- STATIC FILES ----
    if path == "/":
        path = "/index.html"

    file_path = (ROOT / path.lstrip("/")).resolve()

    # prevent directory traversal
    if not file_path.is_file() or ROOT not in file_path.parents:
        start_response("404 Not Found", [("Content-Type", "text/plain")])
        return [b"Not found"]

    content_type, _ = mimetypes.guess_type(file_path)
    content_type = content_type or "application/octet-stream"

    start_response("200 OK", [("Content-Type", content_type)])
    return [file_path.read_bytes()]


if __name__ == "__main__":
    print("Serving on http://localhost:8000")
    make_server("localhost", 8000, app).serve_forever()