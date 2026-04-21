
from backend.ffmpeg_tools import probe_video, find_ffmpeg
from fastapi.responses import JSONResponse, FileResponse
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from dataclasses import asdict
from pathlib import Path
import json
import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(__file__, "../../..")))

# Import corridorKey logic
import device_utils
# import clip_manager

# Project root
ROOT = Path(__file__).resolve().parent.parent 
PROJECT_ROOT = Path(__file__).resolve().parent.parent / "projects"

print(PROJECT_ROOT)

app = FastAPI() 

print("Server started.")

# -------------------
# API
# -------------------

@app.get("/api/health")
def health():
    return {"status": "Online"}

@app.get("/api/GPUs")
def gpus():
    gpus = device_utils.enumerate_gpus()
    return [asdict(gpu) for gpu in gpus]
 
@app.get("/api/projectInfo")
def project_info(project: str, path: str):
    # get project path
    projects = [p.name for p in PROJECT_ROOT.iterdir() if p.is_dir()]
    
    # with open("data.json", "r") as f:
    #     json.dump(data, f)

    # get original video fps
    file_path = (PROJECT_ROOT / path).resolve()
    print("path", file_path)
    
    fps = 0
    if find_ffmpeg():
        try:
            video_info = probe_video(file_path)
            fps = video_info.get("fps", 24.0)
        except:
            print("Error probing video, using default fps of 24.0")
    else:
        print("ffmpeg not found, using default fps of 24.0")

    # clips = clip_manager.scan_clips()

    return {"fps": fps, "projects": projects}

# -------------------
# Media files
# -------------------

@app.get("/media/{path:path}")
def media_file(path: str):
    file_path = (PROJECT_ROOT / path).resolve()

    # Security check: prevent escaping PROJECT_ROOT
    if not file_path.is_file() or PROJECT_ROOT not in file_path.parents:
        raise HTTPException(status_code=404)

    return FileResponse(file_path)

# -------------------
# Static files
# -------------------

@app.get("/")
def index_page():
    return FileResponse(ROOT / "index.html")

@app.get("/project")
def project_page():
    return FileResponse(ROOT / "project.html")


app.mount("/", StaticFiles(directory=ROOT, html=True), name="static")