from wsgiref.simple_server import make_server
from urllib.parse import parse_qs
from dataclasses import asdict
from pathlib import Path
import mimetypes
import json

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(__file__, "../../..")))

# Import corridorKey logic
import device_utils
import clip_manager

    
ROOT = Path(__file__).resolve().parent.parent  # project root
print(ROOT)


# MAIN SERVER CODE

def server(environ, start_response):
    path = environ.get("PATH_INFO", "/")

    # ---- API ----
    if path == "/api/health":
        return getHealth(start_response)

    if path == "/api/GPUs":
        return getGPUs(start_response)

    if path == "/api/projectInfo":
        return getProject(environ, start_response)

    # ---- STATIC FILES ----
    if path.startswith("/media/"):
        return getMediaFile(path, start_response)

    if path == "/":
        path = "/index.html"
    elif path == "/project":
        path = "/project.html"


    return getStaticFilePath(path, start_response)


# STATIC API PORTS

def getStaticFilePath(path, start_response):
    file_path = (ROOT / path.lstrip("/")).resolve()

    # prevent directory traversal
    if not file_path.is_file() or ROOT not in file_path.parents:
        start_response("404 Not Found", [("Content-Type", "text/plain")])
        return [b"Not found"]

    content_type, _ = mimetypes.guess_type(file_path)
    content_type = content_type or "application/octet-stream"

    start_response("200 OK", [("Content-Type", content_type)])
    return [file_path.read_bytes()]


def getMediaFile(path, start_response):
    MEDIA_ROOT = Path("C:/Users/arthu/AppData/Roaming/EZ-CorridorKey").resolve()
    
    # Strip "/media/"
    rel_path = path.replace("/media/", "", 1)

    file_path = (MEDIA_ROOT / rel_path).resolve()

    # Security check: prevent escaping MEDIA_ROOT
    if not file_path.is_file() or MEDIA_ROOT not in file_path.parents:
        start_response("404 Not Found", [("Content-Type", "text/plain")])
        return [b"Not found"]

    content_type, _ = mimetypes.guess_type(file_path)
    content_type = content_type or "application/octet-stream"

    headers = [
        ("Content-Type", content_type),
        ("Content-Length", str(file_path.stat().st_size)),
        ("Accept-Ranges", "bytes"),
    ]

    start_response("200 OK", headers)
    return [file_path.read_bytes()]


# HELPER FUNCTIONS / PORTS

def getHealth(start_response):
    start_response("200 OK", [("Content-Type", "application/json")])

    return [json.dumps({"status": "Online"}).encode()]

def getGPUs(start_response):
    gpus = device_utils.enumerate_gpus()
    json_ready = [asdict(gpu) for gpu in gpus]

    json_bytes = json.dumps(json_ready).encode("utf-8")
    start_response("200 OK", [
        ("Content-Type", "application/json"),
        ("Content-Length", str(len(json_bytes))),
        ("Cache-Control", "no-store"),
    ])

    return [json_bytes]

def getProject(environ, start_response):
    query_string  = parse_qs(environ.get('QUERY_STRING'))
    print(query_string)

    test = clip_manager.scan_clips()
    print(test)

    # get project path
    
    # get original video + fps(!!)

    start_response("200 OK", [("Content-Type", "application/json")])
    return [json.dumps({"status": "Online"}).encode()]



# START SERVER

if __name__ == "__main__":
    print("Serving on http://localhost:8000")
    make_server("localhost", 8000, server).serve_forever()
