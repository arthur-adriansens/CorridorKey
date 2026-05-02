/* This JS script contains code for
    1. SERVER CONNECTION, 
    2. DYNAMIC UI,
    3. FILE HANDLING & PROCESSING,
    4. FRAME TRACK SELECTOR */

// Global variables
let fps, videoEl, originalVideoEl, playPauseButton;
let videoDuration,
    totalFrames,
    currentFrame,
    previousFrame = 0;
let dragging = false;

let current_view = document.querySelector("#views > .btn-primary-sm")?.textContent;

// Get project name from url
const url_string = new URL(window.location.href);
const PROJECT_NAME = url_string.searchParams.get("name");
console.log("Project name:", PROJECT_NAME);

const queue = {};

/* 1. SERVER CONNECTION */

// Server status

const server_status = document.getElementById("server-status");

async function update_server_status() {
    try {
        const response = await fetch("/api/health");

        const { status } = await response.json();
        server_status.textContent = status;
        server_status.classList.remove("text-warning");
    } catch {
        console.log("Server offline.");

        server_status.textContent = "Offline";
        server_status.classList.add("text-warning");
    }
}

update_server_status();
const intervalID = setInterval(update_server_status, 5 * 1000);

// GPU status / info

const gpu_info = document.getElementById("gpu-info");
const gpu_vram_bar = document.getElementById("vram-bar");
const gpu_vram_info = document.getElementById("vram-info");

async function update_gpu_status() {
    try {
        const response = await fetch("/api/GPUs");

        if (!response.ok) {
            console.log("GPU endpoint error:", response);
            return;
        }
        const gpus = await response.json();

        if (gpus.length === 0) {
            gpu_info.textContent = "No active GPU found";
            return;
        }

        gpu_info.textContent = gpus[0].name;
        updateVRAMBar(gpus[0]);
    } catch {
        server_status.textContent = "Offline - GPU endpoint error";
        if (!server_status.classList.contains("text-warning")) server_status.classList.add("!text-error");
    }
}

function updateVRAMBar(gpuInfo) {
    const usedGB = gpuInfo.vram_total_gb - gpuInfo.vram_free_gb;
    const percent = Math.min((usedGB / gpuInfo.vram_total_gb) * 100, 100);
    gpu_vram_bar.style.width = 100 - percent + "%";

    gpu_vram_info.textContent = `${usedGB.toFixed(2)} / ${gpuInfo.vram_total_gb.toFixed(2)}`;

    if (percent > 75) {
        gpu_vram_bar.classList.add("danger");
    } else {
        gpu_vram_bar.classList.remove("danger");
    }
}

update_gpu_status();
const intervalID2 = setInterval(update_gpu_status, 3 * 1000);

// Server task displayer

// Todo: naast status: "- Uploading... <loading bar>" als iets aan het fetchen
// custom fetch misschien?

// Get list of projects
if (!window.location.href.includes("/project")) list_projects();

async function list_projects() {
    const response = await fetch("/api/projects");

    if (!response.ok) {
        console.log("Unable to fetch projects.");
        return;
    }

    const projects = await response.json();

    // Update projects list UI
    if (projects?.length > 0) {
        const projectsList = document.getElementById("projects-list");
        projectsList.innerHTML = "";

        projects.forEach((project) => {
            const link = document.createElement("a");
            link.href = `/project?name=${project}`;

            const li = document.createElement("li");
            li.textContent = project;
            if (project === PROJECT_NAME && window.location.href.includes("/project")) li.classList.add("selected");

            link.append(li);
            projectsList.append(link);
        });
    }
}

/* 2. DYNAMIC UI */

// Dynamic label that show input slider's value

const sliders = document.querySelectorAll("#dynamic-labels input[type='range']");

const updateDynamicLabel = (input) => {
    const span = input.parentNode.querySelector(`#${input.id}-label`);
    if (!span) return;
    span.textContent = input.value;
};

sliders.forEach((input) => {
    updateDynamicLabel(input);
    input.oninput = () => updateDynamicLabel(input);
});

// Resizable sidepannel

const layout = document.getElementById("layout");
const leftResizer = document.getElementById("left-resizer");
const rightResizer = document.getElementById("right-resizer");

let dragTarget = null;

const MIN_LEFT = 180;
const MIN_RIGHT = 240;
const MIN_CENTER = 400;

function getGrid() {
    return getComputedStyle(layout)
        .gridTemplateColumns.split(" ")
        .map((v) => parseFloat(v));
}

document.addEventListener("mousedown", (e) => {
    if (e.target === leftResizer) dragTarget = "left";
    if (e.target === rightResizer) dragTarget = "right";
});

document.addEventListener("mouseup", () => {
    dragTarget = null;
});

document.addEventListener("mousemove", (e) => {
    if (!dragTarget) return;

    const rect = layout.getBoundingClientRect();
    let [left, center, right] = getGrid();

    if (dragTarget === "left") {
        const newLeft = e.clientX - rect.left;

        center += left - newLeft;
        if (newLeft < MIN_LEFT || center < MIN_CENTER) return;

        left = newLeft;
    }

    if (dragTarget === "right") {
        const newRight = rect.right - e.clientX;

        center += right - newRight;
        if (newRight < MIN_RIGHT || center < MIN_CENTER) return;

        right = newRight;
    }

    layout.style.gridTemplateColumns = `${left}px ${center}px ${right}px`;
});

// Toggle group (only select one button)

const toggle_group = document.querySelectorAll("div[toggle-group]");

for (const group of toggle_group) {
    group.addEventListener("click", (e) => {
        if (e.target.tagName !== "BUTTON") return;

        if (e.target.closest("#compare-modes") && group.querySelector(".btn-primary-sm") == e.target) {
            e.target.classList.replace("btn-primary-sm", "btn-secondary-sm"); // Allow to de-select button
            update_compare_mode(group);
            return;
        }

        if (!group.querySelector(".btn-primary-sm")) {
            e.target.classList.add("btn-primary-sm");
        }

        group.querySelector(".btn-primary-sm").classList.replace("btn-primary-sm", "btn-secondary-sm");
        e.target.classList.replace("btn-secondary-sm", "btn-primary-sm");

        if (e.target.closest("#views")) {
            current_view = e.target.textContent;
            update_view();
            return;
        }

        if (e.target.closest("#compare-modes")) {
            update_compare_mode(group);
        }
    });
}

// Collapsable fieldsets

const collapsables_triggers = document.querySelectorAll("fieldset[collapsable]>legend");

collapsables_triggers.forEach((trigger) =>
    trigger.addEventListener("click", (e) => {
        if (e.target.tagName !== "LEGEND") return;

        const fieldset = trigger.parentNode;
        const closed = fieldset.getAttribute("closed") === "true";

        closed ? fieldset.removeAttribute("closed") : fieldset.setAttribute("closed", "true");
    }),
);

// Selectable export list items and actions

const exportActions = document.getElementById("export-actions");

function select_export(target) {
    if (!exportActions) return;

    const previouslySelected = document.querySelector("#exports-list li.selected");
    if (previouslySelected !== target) {
        previouslySelected?.classList.remove("selected");
    }

    target.classList.add("selected");
    const isSelected = target.classList.contains("selected");

    if (isSelected) {
        // Download video copy
        const download_btn = exportActions.querySelector("a#export-download");
        download_btn.href = `/media/${PROJECT_NAME}/clips/Input/_EXPORTS/Input_${current_view}_export.mp4`;
        download_btn.download = `${current_view}_export.mp4`;

        // Open video export file location
        const regenerate_btn = exportActions.querySelector("button#export-regenerate");
        regenerate_btn.onclick = async () => {
            console.log("Regenerating Video export for this view. Starting generation...");
            const success = generate_export(target.textContent?.includes("Alpha") ? "AlphaHint" : undefined);

            if (!success) {
                console.log("Failed to start export generation.");
                return;
            }
        };

        // Open video export file location
        const file_btn = exportActions.querySelector("button#export-open-location");
        file_btn.onclick = () => {
            fetch(`/api/showInExplorer/${PROJECT_NAME}/clips/Input/_EXPORTS/Input_${current_view}_export.mp4`);
        };

        // Remove video export
        const remove_btn = exportActions.querySelector("button#export-delete");
        remove_btn.onclick = async () => {
            const response = await fetch(`/api/removeExport/${PROJECT_NAME}/clips/Input/_EXPORTS/Input_${current_view}_export.mp4`, {
                method: "POST",
            });

            const data = await response.json();
            if (!response.ok) {
                console.log("Unable to remove export.", data);
                return;
            }

            if (target?.parentNode?.children?.length === 1) {
                target.parentNode.innerHTML = "<li>no exports</li>";
                return;
            }
            target.remove();
        };
    }
}

// Explenation dialog

const dialog = document.getElementById("explain-dialog");
const GAP = 8;

let explanations;
(async () => {
    const response = await fetch("/static/explanations.json");

    if (!response.ok) return;

    const data = await response.json();
    explanations = data;
})();

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function positionDialog(target) {
    const targetRect = target.getBoundingClientRect();
    const dialogRect = dialog.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const placements = [
        // bottom
        {
            top: targetRect.bottom + GAP,
            left: targetRect.left + targetRect.width / 2 - dialogRect.width / 2,
            fits: targetRect.bottom + GAP + dialogRect.height <= vh,
        },
        // top
        {
            top: targetRect.top - dialogRect.height - GAP,
            left: targetRect.left + targetRect.width / 2 - dialogRect.width / 2,
            fits: targetRect.top - GAP - dialogRect.height >= 0,
        },
        // right
        {
            top: targetRect.top + targetRect.height / 2 - dialogRect.height / 2,
            left: targetRect.right + GAP,
            fits: targetRect.right + GAP + dialogRect.width <= vw,
        },
        // left
        {
            top: targetRect.top + targetRect.height / 2 - dialogRect.height / 2,
            left: targetRect.left - dialogRect.width - GAP,
            fits: targetRect.left - GAP - dialogRect.width >= 0,
        },
    ];

    const placement = placements.find((p) => p.fits) || placements[0];

    dialog.style.top = clamp(placement.top, GAP, vh - dialogRect.height - GAP) + "px";
    dialog.style.left = clamp(placement.left, GAP, vw - dialogRect.width - GAP) + "px";
}

function getExplain(path, obj) {
    return path.split(".").reduce((o, k) => o?.[k], obj);
}

const dialog_title = document.getElementById("dialog-title");
const dialog_text = document.getElementById("dialog-text");

document.addEventListener("mouseover", (e) => {
    const target = e.target.closest("[data-explain]");
    if (!target?.dataset?.explain || !explanations) return;

    const explainData = getExplain(target.dataset.explain, explanations);
    if (!explainData) return;

    dialog_title.textContent = explainData.label;
    dialog_text.textContent = explainData.description;

    dialog.classList.replace("opacity-0", "delay-500");

    requestAnimationFrame(() => positionDialog(target)); // Must be visible before measuring
});

document.addEventListener("mouseout", (e) => {
    if (!e.target.closest("[data-explain]")) return;

    dialog.classList.replace("delay-500", "opacity-0");
});

/* 3. FILE HANDLING & PROCESSING */

// Drop zone

const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("folder-input");

if (dropZone && fileInput) {
    const previewContainer = dropZone.querySelector("div#preview");
    // Prevent browser defaults
    ["dragenter", "dragover", "dragleave", "drop"].forEach((event) => {
        dropZone.addEventListener(event, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    // Visual feedback
    dropZone.addEventListener("dragover", () => {
        previewContainer.classList.add("border-corridor-blue");
    });
    dropZone.addEventListener("dragleave", () => {
        previewContainer.classList.remove("border-corridor-blue");
    });
    dropZone.addEventListener("drop", () => {
        previewContainer.classList.remove("border-corridor-blue");
    });

    // Handle drop
    dropZone.addEventListener("drop", (e) => {
        handleFiles(e.dataTransfer.files);
    });

    // Handle click selection
    fileInput.addEventListener("change", (e) => {
        handleFiles(e.target.files);
    });
}

function handleFiles(files) {
    if (!files.length) return;

    // disable further uploads
    fileInput.setAttribute("disabled", "true");
    dropZone.classList.remove("!cursor-pointer");

    // preview first file only
    const file = files[0];
    const url = URL.createObjectURL(file);

    // Clear previous preview
    const previewContainer = dropZone.querySelector("div#preview");
    previewContainer.innerHTML = "";

    // VIDEO PREVIEW
    if (file.type.startsWith("video/")) {
        const video = document.createElement("video");
        video.src = url;
        // video.controls = true;
        video.className = "max-h-full max-w-full rounded";
        previewContainer.appendChild(video);
        return;
    }

    // IMAGE PREVIEW
    if (file.type.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = url;
        img.className = "max-h-full max-w-full rounded object-contain";
        previewContainer.appendChild(img);
        return;
    }

    // FALLBACK (any other file)
    const info = document.createElement("p");
    info.textContent = file.name;
    previewContainer.appendChild(info);
}

/* 4. FRAME TRACK SELECTOR */

const track = document.getElementById("frame-track");
const ticks = document.getElementById("frame-ticks");
const playhead = document.getElementById("playhead");

const frameLabel = document.getElementById("frame");
const framesTotalLabel = document.getElementById("frames-total");
const timecodeLabel = document.getElementById("timecode");

// Init track UI
buildTicks(totalFrames);

// ---------- interaction ----------

track.addEventListener("mousedown", (e) => {
    dragging = true;
    updateFromEvent(e);
});

window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    updateFromEvent(e);
});

window.addEventListener("mouseup", () => {
    dragging = false;
});

track.addEventListener("click", (e) => {
    updateFromEvent(e);
});

function updateFromEvent(e, progressFromVideo, currentTimeFromVideo) {
    if (progressFromVideo !== undefined) {
        currentFrame = Math.round((progressFromVideo / 100) * (totalFrames + 1));
        updateUI(`${progressFromVideo}%`, currentTimeFromVideo);
        return;
    }

    const rect = track.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
    const pct = x / rect.width;

    currentFrame = Math.round(totalFrames * pct);

    updateUI(`${(currentFrame / (totalFrames + 1)) * 100}%`, currentFrame / fps);
    onFrameChange(currentFrame);

    previousFrame = currentFrame;
}

function updateUI(percentage, currentTime) {
    frameLabel.textContent = currentFrame;
    playhead.style.left = percentage;
    timecode.textContent = new Date(currentTime * 1000).toISOString().substr(11, 12);
}

function buildTicks(count) {
    ticks.innerHTML = "";
    const visibleTicks = Math.min(count, 100);

    for (let i = 0; i < visibleTicks; i++) {
        const div = document.createElement("div");
        div.className = "frame-tick";
        ticks.appendChild(div);
    }
}

let timeStamp = 0;

function onFrameChange(frameIndex) {
    if (frameIndex === previousFrame || frameIndex === undefined || !originalVideoEl || !fps) return;

    timeStamp = frameIndex / fps;

    originalVideoEl.pause();
    originalVideoEl.currentTime = timeStamp;

    if (videoEl) {
        videoEl.pause();
        videoEl.currentTime = timeStamp;
    }

    if (playPauseButton) playPauseButton.dataset.playing = "false";
    previousFrame = frameIndex;
}

function playPauseSetup() {
    playPauseButton = document.getElementById("playPause");
    if (!playPauseButton) return;

    playPauseButton.addEventListener("click", () => {
        if (originalVideoEl.paused) {
            videoEl?.play();
            originalVideoEl.play();
            playPauseButton.dataset.playing = "true";
        } else {
            videoEl?.pause();
            originalVideoEl?.pause();
            playPauseButton.dataset.playing = "false";
        }
    });

    window.addEventListener("keydown", (e) => {
        if (e.code === "Space") {
            e.preventDefault();
            playPauseButton.click();
            return;
        }

        if (e.code === "ArrowRight") {
            e.preventDefault();
            currentFrame = Math.min(currentFrame + 1, totalFrames);
            videoEl.currentTime = currentFrame / fps;
            originalVideoEl.currentTime = currentFrame / fps;
            return;
        }

        if (e.code === "ArrowLeft") {
            e.preventDefault();
            currentFrame = Math.max(currentFrame - 1, 0);
            videoEl.currentTime = currentFrame / fps;
            originalVideoEl.currentTime = currentFrame / fps;
            return;
        }
    });
}

playPauseSetup();
