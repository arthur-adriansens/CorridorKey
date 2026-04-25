/* This JS script contains code for
    1. SERVER CONNECTION, 
    2. DYNAMIC UI,
    3. FILE HANDLING & PROCESSING */

// Global variables
let fps, videoEl, imageEl, playPauseButton;
let videoDuration,
    totalFrames,
    currentFrame,
    previousFrame = 0;
let dragging = false;

let current_view = document.querySelector("#views > .btn-primary-sm").textContent;
const PROJECT_NAME = "260415_191034_Input";

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

    if (percent > 85) {
        gpu_vram_bar.classList.add("danger");
    } else {
        gpu_vram_bar.classList.remove("danger");
    }
}

update_gpu_status();
const intervalID2 = setInterval(update_gpu_status, 3 * 1000);

/* 2. DYNAMIC UI */

// Dynamic label that show input slider's value

const sliders = document.querySelectorAll("#dynamic-labels input");

const updateDynamicLabel = (input) => {
    const span = input.parentNode.querySelector(`#${input.id}-label`);
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

const toggle_group = document.querySelector("div[toggle-group]");

toggle_group.addEventListener("click", (e) => {
    if (e.target.tagName !== "BUTTON") return;

    toggle_group.querySelector(".btn-primary-sm").classList.replace("btn-primary-sm", "btn-secondary-sm");
    e.target.classList.replace("btn-secondary-sm", "btn-primary-sm");

    current_view = e.target.textContent;
    update_view();
});

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
            console.log("Regenerating Video export for this view.");
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

            if (!response.ok) {
                console.log("Unable to remove export.");
                return;
            }

            const data = await response.json();

            if (target?.parentNode?.children?.length === 1) {
                target.parentNode.innerHTML = "<li>no exports</li>";
                return;
            }
            target.remove();
        };
    }
}

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
    if (e === undefined && (current_view == "Alpha" || current_view == "Matte")) {
        currentFrame = Math.round((progressFromVideo / 100) * totalFrames);
        updateUI(`${progressFromVideo}%`, currentTimeFromVideo);

        let frameString = currentFrame.toString().padStart(6, "0");

        if (!imageEl) return;

        if (current_view == "Alpha") {
            imageEl.src = `/media/${PROJECT_NAME}/clips/Input/AlphaHint/frame_${frameString}.png`;
        } else {
            imageEl.src = `/media/${PROJECT_NAME}/clips/Input/Output/Matte/frame_${frameString}.png`;
        }
        return;
    }

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

function onFrameChange(frameIndex) {
    if (frameIndex === previousFrame || frameIndex === undefined || !videoEl || !fps) return;

    const timeStamp = frameIndex / fps;

    videoEl.pause();
    if (playPauseButton) playPauseButton.dataset.playing = "false";

    videoEl.currentTime = timeStamp;
    previousFrame = frameIndex;
}

function playPauseSetup() {
    playPauseButton = document.getElementById("playPause");

    playPauseButton.addEventListener("click", () => {
        if (videoEl.paused) {
            videoEl.play();
            playPauseButton.dataset.playing = "true";
        } else {
            videoEl.pause();
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
            return;
        }

        if (e.code === "ArrowLeft") {
            e.preventDefault();
            currentFrame = Math.max(currentFrame - 1, 0);
            videoEl.currentTime = currentFrame / fps;
            return;
        }
    });
}

playPauseSetup();
