
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles

from pathlib import Path
from dataclasses import asdict
from threading import Thread, Lock
import re, json
import sys, os, platform, subprocess, logging

sys.path.insert(0, os.path.abspath(os.path.join(__file__, "../../..")))
os.environ["OPENCV_IO_ENABLE_OPENEXR"] = "1" # enable exr support by cv2
logging.getLogger("asyncio").setLevel(logging.ERROR)

import numpy as np
import cv2

# Import corridorKey logic
from backend.ffmpeg_tools import find_ffmpeg, stitch_video
from device_utils import resolve_device, enumerate_gpus
from clip_manager import ClipAsset, ClipEntry, InferenceSettings, run_inference, get_birefnet_usage_options

# Project root
ROOT = Path(__file__).resolve().parent.parent 
PROJECT_ROOT = Path(__file__).resolve().parent.parent / "projects"

# Progress tracker
EXPORT_PROGRESS = {
    "stage": "idle",
    "message": "",
    "current": 0,
    "total": 0,
    "percent": 0,
}

PROGRESS_LOCK = Lock()

# Inference tracking
INFERENCE_PROGRESS = {
    "stage": "idle",
    "clip": "",
    "message": "",
    "current": 0,
    "total": 0,
    "percent": 0,
}

INFERENCE_LOCK = Lock()

app = FastAPI() 
print("\nServer started! Only (critical) errors and warnings will show up here.")

# -------------------
# API
# -------------------

@app.get("/api/health")
def health():
    return {"status": "Online"}

@app.get("/api/GPUs")
def gpus():
    gpus = enumerate_gpus()
    return [asdict(gpu) for gpu in gpus]

@app.get("/api/projects")
def list_projects():
    # get projects (names)
    projects = [p.name for p in PROJECT_ROOT.iterdir() if p.is_dir()]

    return projects

@app.get("/api/projectInfo")
def project_info(project: str):
    # get projects (names)
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

    # get BiRefNet availble options
    birefnet_options = get_birefnet_usage_options()

    # get exports
    exports_path = (PROJECT_ROOT / project / "clips/Input/_EXPORTS")
    exports = {}
    if exports_path.is_dir():
        exports = {export.name: export for export in exports_path.iterdir() if export.is_file()}

    # check if alpha excists
    alpha_path = (PROJECT_ROOT / project / "clips/Input/AlphaHint")
    has_alpha = False

    # get options
    options_path = (PROJECT_ROOT / project / ".corridorkey_session.json")
    options = {}
    if (PROJECT_ROOT / project).is_dir() and options_path.is_file():
        with open(options_path, "r") as file:
            options = json.load(file)

    if (alpha_path.is_dir() and os.listdir(alpha_path)):
        has_alpha = True
    
    return {
        "fps": fps,
        "frame_count": frames,
        "duration": duration,
        "projects": projects,
        "exports": exports,
        "birefnet_options": birefnet_options,
        "options": options,
        "has_alpha": has_alpha,
    }

@app.get("/api/checkOutput")
def check_export(project: str, export_type: str):
    type = export_type

    # check if output video exists for project, generate if not
    export_path = (PROJECT_ROOT / project / "clips/Input/_EXPORTS")
    exported_file_path = (export_path / f"Input_{type}_export.mp4")

    if exported_file_path.is_file():
        return {"video_output": exported_file_path}
    
    return {"exported_file_path": exported_file_path}



@app.post("/api/generateExport")
def generate_export(project: str, export_type: str, fps: int):
    if not find_ffmpeg():
        raise HTTPException(status_code=500, detail="FFmpeg not found.")
    
    # Launch export in a persistent background thread.

    thread_exporting = Thread(
        target=_generate_export_worker,
        args=(project, export_type, fps),
        daemon=True
    )
    thread_exporting.start()

    return {"status": "started"}

@app.get("/api/exportProgress")
def export_progress():
    with PROGRESS_LOCK:
        return EXPORT_PROGRESS.copy()

@app.get("/api/inferenceProgress")
def inference_progress():
    with INFERENCE_LOCK:
        return INFERENCE_PROGRESS.copy()

@app.get("/api/showInExplorer/{path:path}")
def show_in_explorer(path: str):
    file_path = (PROJECT_ROOT / path).resolve()

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    system = platform.system()

    if system == "Windows":
        subprocess.run(["explorer", "/select,", str(file_path)])
    elif system == "Darwin":  # macOS
        subprocess.run(["open", "-R", str(file_path)])
    else:  # Linux
        subprocess.run(["xdg-open", str(file_path.parent)])

    return {"status": "ok"}

@app.post("/api/removeExport/{path:path}")
def remove_export(path: str):
    file_path = (PROJECT_ROOT / path).resolve()

    
    # Security check: must exist, must be a file, must be inside PROJECT_ROOT
    if (
        not file_path.exists()
        or not file_path.is_file()
        or PROJECT_ROOT not in file_path.parents
    ):
        raise HTTPException(status_code=404, detail="File not found")

    try:
        file_path.unlink()  # delete the file
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to remove export: {str(e)}"
        )


    return {"status": "ok"}

@app.post("/api/updateParameters")
def update_json(payload: dict):
    options = payload.get("options", {})
    project = payload.get("project")

    if not project or len(options) == 0:
        raise HTTPException(status_code=400, detail="Project and options is required")

    project_dir = PROJECT_ROOT / project
    if not project_dir.is_dir():
        raise HTTPException(status_code=404, detail="Project not found")

    options_path = project_dir / ".corridorkey_session.json"

    try:
        with open(options_path, "w", encoding="utf-8") as file:
            json.dump(options, file, indent=2)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to save options: {exc}")

    # print(f"Updated parameters for '{project}'.")

    return {"status": f"Options saved for project {project}"}

@app.post("/api/runInterference")
def run_interference(payload: dict):
    _set_inference("setup", "Running inference checks", 0, 100)

    project = payload.get("project")
    custom_backend = payload.get("backend")

    if not project:
        _set_inference("error", "Project required", 0, 0)
        raise HTTPException(status_code=400, detail="Project required")

    project_dir = PROJECT_ROOT / project
    if not project_dir.is_dir():
        _set_inference("error", "Project not found", 0, 0)
        raise HTTPException(status_code=404, detail="Project not found")

    # Load options
    _set_inference("setup", "Loading inference options", 25, 100)

    options_path = project_dir / ".corridorkey_session.json"
    if not options_path.is_file():
        _set_inference("error", "Options not found", 0, 0)
        raise HTTPException(status_code=404, detail="Options not found")

    with open(options_path, "r", encoding="utf-8") as file:
        options = json.load(file)

    # Map options to InferenceSettings
    params = options.get("params", {})
    settings = InferenceSettings(
        input_is_linear=params.get("input_is_linear", True),
        despill_strength=float(params.get("despill_strength", 0.5)),
        auto_despeckle=params.get("auto_despeckle", True),
        despeckle_size=int(params.get("despeckle_size", 400)),
        refiner_scale=float(params.get("refiner_scale", 1.0)),
        generate_comp=options.get("output_config", {}).get("comp_enabled", True),
        gpu_post_processing=False,
        image_size=options.get("image_size", 2048),
        tiled_inference=options.get("tiled_inference", False),
    )

    _set_inference("setup", "Loading clips", 65, 100)

    # Build the clip from the webUI project path, not from ClipsForInference
    clip_root = project_dir / "clips" / "Input"
    if not clip_root.is_dir():
        _set_inference("error", "Clip root not found", 0, 0)
        raise HTTPException(status_code=404, detail="Clip root not found")

    source_dir = clip_root / "Source"
    if not source_dir.is_dir():
        _set_inference("error", "Source directory not found", 0, 0)
        raise HTTPException(status_code=404, detail="Source directory not found")

    input_candidates = [p for p in source_dir.iterdir() if p.is_file() and p.suffix.lower() in (".mp4", ".mov", ".avi", ".mkv")]
    if not input_candidates:
        _set_inference("error", "Input source video not found", 0, 0)
        raise HTTPException(status_code=404, detail="Input source video not found")

    clip = ClipEntry(project, str(clip_root))
    clip.input_asset = ClipAsset(str(input_candidates[0]), "video")

    _set_inference("setup", "Loading AlphaHint", 80, 100)
    alpha_dir = clip_root / "AlphaHint"
    if alpha_dir.is_dir():
        clip.alpha_asset = ClipAsset(str(alpha_dir), "sequence")
    else:
        clip.alpha_asset = None

    if clip.alpha_asset is None:
        _set_inference("error", "AlphaHint not found for clip", 0, 0)
        raise HTTPException(status_code=404, detail="AlphaHint not found for clip")

    _set_inference("setup", "Setup complete!", 100, 100)
    
    # Run inference in background thread
    thread = Thread(
        target=_run_inference_worker,
        args=(clip, settings, custom_backend),
        daemon=True,
    )
    thread.start()

    return {"status": "Inference started"}

last_clip_name = ""
def on_clip_start(clip_name: str, total_frames: int):
    last_clip_name = clip_name
    _set_inference("inference", "Inference started", 0, total_frames, clip_name)

def on_frame_complete(current: int, total: int):
    _set_inference("inference", "Rendering frames", current+1, total)

def _run_inference_worker(clip, settings, custom_backend="auto"):
    try:
        device = resolve_device("auto")
        run_inference(
            [clip],
            device=device,
            backend=(custom_backend or "auto"),
            settings=settings,
            on_clip_start=on_clip_start,
            on_frame_complete=on_frame_complete,
        )

        _set_inference("done", "Export complete", 1, 1)
        print(f"Inference completed for {clip.name}")

    except Exception as e:
        _set_inference("error", f"Inference failed for {clip.name}: {e}", 0, 0)
        print(f"Inference failed for {clip.name}: {e}")

def _set_inference(stage, message="", current=0, total=0, clip_name=last_clip_name):
    with INFERENCE_LOCK:
        INFERENCE_PROGRESS.update({
            "stage": stage,
            "clip": clip_name,
            "message": message,
            "current": int(current),
            "total": int(total),
            "percent": int((current / total) * 100) if total > 0 else 0
        })

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

@app.get("/thumbnail/{project:str}/{path:path}")
def get_thumbnail(project:str, path: str):
    export_folder = (PROJECT_ROOT / project / "clips/Input/_EXPORTS")
    file_path = (export_folder / path).resolve()

    # Security check: prevent escaping PROJECT_ROOT
    if not file_path.is_file() or PROJECT_ROOT not in file_path.parents:
        raise HTTPException(status_code=404, detail="File not found.")

    thumbnail_bytes = get_video_thumbnail(str(file_path))

    return Response(content=thumbnail_bytes, media_type="image/png")

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

def get_video_thumbnail(video_path: str, output_size: tuple = (320, 180)) -> bytes:
    try:
        video = cv2.VideoCapture(video_path)
        
        if not video.isOpened():
            raise ValueError(f"Could not open video: {video_path}")
        
        # Read the first frame
        ret, frame = video.read()
        video.release()
        
        if not ret:
            raise ValueError("Could not read frame from video")
        
        # Resize to thumbnail size & Encode to PNG
        thumbnail = cv2.resize(frame, output_size)
        success, encoded_image = cv2.imencode('.png', thumbnail)
        
        if not success:
            raise ValueError("Could not encode thumbnail")
        
        return encoded_image.tobytes() # png format
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating thumbnail: {str(e)}")


def _set_progress(stage, message="", current=0, total=0):
    with PROGRESS_LOCK:
        EXPORT_PROGRESS.update({
            "stage": stage,
            "message": message,
            "current": int(current),
            "total": int(total),
            "percent": int((current / total) * 100) if total > 0 else 0
        })

def _generate_export_worker(project: str, export_type: str, fps: int):
    try:
        _set_progress("starting", "Preparing export", 0, 1)

        export_path = PROJECT_ROOT / project / "clips/Input/_EXPORTS"
        export_path.mkdir(parents=True, exist_ok=True)

        if (export_type == "AlphaHint"):
            frames_path = PROJECT_ROOT / project / "clips/Input/AlphaHint"
            output = export_path / "Input_Alpha_export.mp4"
        elif (export_type == "Original"):
            frames_path = PROJECT_ROOT / project / "clips/Input/Frames"
            output = export_path / "Input_Original_export.mp4"
        else:
            frames_path = PROJECT_ROOT / project / f"clips/Input/Output/{export_type}"
            output = export_path / f"Input_{export_type}_export.mp4"


        # --------------------------------------------------
        # Detect available frames
        # --------------------------------------------------

        exr_frames = sorted(frames_path.glob("*.exr"))
        png_frames = sorted(frames_path.glob("*.png"))

        if png_frames:
            source_type = "png"
            total_frames = len(png_frames)
        
        elif exr_frames:
            source_type = "exr"
            total_frames = len(exr_frames)

        else:
            raise RuntimeError("No EXR or PNG frames found")

        # --------------------------------------------------
        # Convert EXR → PNG (only if needed)
        # --------------------------------------------------

        if source_type == "exr":
            _set_progress(
                "converting_exr_to_png",
                "Converting EXR → PNG",
                0,
                total_frames
            )

            for i, frame in enumerate(exr_frames, start=1):
                img = cv2.imread(str(frame), cv2.IMREAD_UNCHANGED)
                if img is None:
                    print("Failed to read:", frame)
                    continue

                img = np.clip(img, 0, 1)
                img = (img * 65535).astype(np.uint16)

                cv2.imwrite(str(frame.with_suffix(".png")), img)

                _set_progress(
                    "converting_exr_to_png",
                    "Converting EXR → PNG",
                    i,
                    total_frames
                )

        # --------------------------------------------------
        # Stitch video (PNG input)
        # --------------------------------------------------

        _set_progress(
            "stitching_video",
            "Stitching frames into video",
            0,
            total_frames
        )

        stitch_video_with_progress(
            frames_path,
            output,
            fps,
            total_frames=total_frames
        )

        _set_progress("done", "Export complete", 1, 1)

    except Exception as e:
        _set_progress("error", str(e), 0, 0)


def infer_pattern(dir):
    files = sorted(file for file in os.listdir(dir) if file.endswith(".png"))
    match = re.match(r"^(.*?)(\d+)(\.[^.]+)$", files[0])
    return f"{match.group(1)}%0{len(match.group(2))}d{match.group(3)}" if match else None

def stitch_video_with_progress(
    frames_path: Path,
    output: Path,
    fps: int,
    total_frames: int,
):
    def on_progress(current: int, total: int):
        _set_progress(
            "stitching_video",
            "Stitching frames into video",
            min(current, total_frames),
            total_frames,
        )

    pattern = infer_pattern(frames_path)

    stitch_video(
        in_dir=str(frames_path),
        out_path=str(output),
        fps=float(fps),
        pattern = pattern,   # IMPORTANT: PNG, not EXR 
        on_progress=on_progress,
    )
