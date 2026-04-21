
from backend.ffmpeg_tools import probe_video, find_ffmpeg, stitch_video
from fastapi.responses import JSONResponse, FileResponse
from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from dataclasses import asdict
from pathlib import Path
import json
import sys
import os

import numpy as np
import cv2

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
def project_info(project: str):
    # get project (names)
    projects = [p.name for p in PROJECT_ROOT.iterdir() if p.is_dir()]

    # get video metadata of current project
    metadata_path = (PROJECT_ROOT / project / "clips/Input/.video_metadata.json")

    if (PROJECT_ROOT / project).is_dir() and metadata_path.is_file():
        with open(metadata_path, "r") as file:
            data = json.load(file)
            fps = data.get("fps")
            frames = data.get("frame_count")
            duration = data.get("duration") or (frames / fps)
    else:
        raise HTTPException(status_code=404, detail="Project not found.")

    return {"fps": fps, "frame_count": frames, "duration": duration, "projects": projects}

@app.get("/api/checkOutput")
def check_export(project: str, export_type: str, fps: int):
    type = export_type

    # check if output video exists for project, generate if not
    export_path = (PROJECT_ROOT / project / "clips/Input/_EXPORTS")
    exported_file_path = (export_path / f"Input_{type}_export.mp4")

    if exported_file_path.is_file():
        return {"video_output": exported_file_path}
    
    if not find_ffmpeg():
        raise HTTPException(status_code=500, detail="FFmpeg not found.")

    # stitch_video from frames
    frames_folder_path = (PROJECT_ROOT / project / f"clips/Input/Output/{type}")

    if type == "Matte":
        convert_exr_to_png(frames_folder_path)

        return {"video_output": None}

    try:
        stitch_video(frames_folder_path, exported_file_path, fps = float(fps), pattern="frame_%06d.exr")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error occurred while stitching video: {str(e)}")

    return {"video_output": exported_file_path}

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

# -------------------
# Helper functions
# -------------------

def convert_exr_to_png(frames_folder_path: Path):
    for frame in sorted(frames_folder_path.glob("frame_*.exr")):
        img = cv2.imread(str(frame), cv2.IMREAD_UNCHANGED)
        if img is None:
            print("Failed to read:", frame)
            continue

        img = np.clip(img, 0, 1)
        img = (img * 65535).astype(np.uint16)

        out = frame.with_suffix(".png")
        cv2.imwrite(str(out), img)

    return "success"


