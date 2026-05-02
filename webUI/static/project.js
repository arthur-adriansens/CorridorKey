/* This JS script contains code for
    1. PROJECT SETUP (load files etc.), 
    2. SERVER CONNECTION */

/* 1. PROJECT SETUP */

load_project();

// Setup

let projectData = {};

async function load_project() {
    const params = new URLSearchParams({
        project: PROJECT_NAME,
    });

    const response = await fetch(`/api/projectInfo?${params}`);

    if (!response.ok) {
        const message = await response.json();
        console.log("Unable to fetch project. Error:", message.detail);
        return;
    }

    projectData = await response.json();
    console.log(projectData);

    videoDuration = projectData.duration;
    totalFrames = projectData.frame_count;

    // Update fps UI
    fps = projectData.fps;
    document.getElementById("fps").textContent = fps;

    // Update projects list UI
    if (projectData?.projects?.length > 0) {
        const projectsList = document.getElementById("projects-list");
        projectsList.innerHTML = "";

        projectData.projects.forEach((project) => {
            const link = document.createElement("a");
            link.href = `/project?name=${project}`;

            const li = document.createElement("li");
            li.textContent = project;
            if (project === PROJECT_NAME && window.location.href.includes("/project")) li.classList.add("selected");

            link.append(li);
            projectsList.append(link);
        });
    }

    // Update BiRefNet options UI
    if (projectData?.birefnet_options?.length > 0) {
        const birefnetSelect = document.getElementById("birefnet-options");
        birefnetSelect.innerHTML = "";

        projectData.birefnet_options.forEach((option) => {
            const opt = document.createElement("option");
            opt.textContent = option;
            birefnetSelect.append(opt);
        });
    }

    // Update hasAlpha label color
    if (projectData?.has_alpha === true) {
        const alphaLabel = document.getElementById("hasAlpha");

        alphaLabel.classList.replace("!text-warning", "!text-success");
        alphaLabel.closest("fieldset").setAttribute("closed", "true");
    }

    // Update options
    if (projectData?.options?.params) {
        const parameters = { ...projectData.options.params, ...projectData.options.output_config };

        for (let option in parameters) {
            const input = document.getElementById(option);
            if (!input) continue;

            const input_type = input.type;
            if (input_type == "checkbox") input.checked = parameters[option];

            input.value = parameters[option];
            updateDynamicLabel(input);
        }

        document.getElementById("live_preview").checked = projectData.options.live_preview;
    }

    // Update exports list UI
    if (projectData?.exports) {
        update_exports_list();
    }

    update_view();

    if (!originalVideoEl) {
        original_video_viewer();
    }
}

const exportsList = document.getElementById("exports-list");

function update_exports_list() {
    generation_progress?.classList?.add("hidden");
    previewContainer.classList.remove("hidden");

    if (Object.keys(projectData.exports).length == 0) return;
    exportsList.innerHTML = "";

    Object.entries(projectData.exports).forEach(([videoName, videoPath]) => {
        const li = document.createElement("li");
        const img = get_thumbnail(videoName);

        li.textContent = videoName;
        exportsList.append(li);
        li.prepend(img);
        li.onclick = click_thumbnail;
    });
}

// Compare mode toggler
const previewContainer = document.getElementById("preview");
let selectedMode = "";

const toggleVideo = (e) => {
    if (!videoEl) return;
    const hidden = e.type == "mousedown";
    videoEl.style.opacity = hidden ? 0 : 1;
    previewContainer.classList.toggle("cursor-default", hidden);
};

function update_compare_mode(compareTogglerParent) {
    selectedMode = compareTogglerParent?.querySelector(".btn-primary-sm")?.textContent || "";

    if (selectedMode == "Hold") {
        originalVideoEl.classList.remove("opacity-0");
        previewContainer.classList.add("cursor-pointer");

        previewContainer.addEventListener("mousedown", toggleVideo);
        previewContainer.addEventListener("mouseup", toggleVideo);
    } else {
        originalVideoEl.classList.toggle("opacity-0", current_view !== "Original");
        if (videoEl) videoEl.style.opacity = 1;
        previewContainer.classList.remove("cursor-pointer");

        previewContainer.removeEventListener("mousedown", toggleVideo);
        previewContainer.removeEventListener("mouseup", toggleVideo);
    }
}

// View modes togglers
const view_types = Array.from(document.querySelectorAll("#views button:not([disabled])")).map((child) => child.textContent);

function update_view() {
    generation_progress?.classList?.add("hidden");
    previewContainer.classList.remove("hidden");

    if (exportsList?.children) {
        document.querySelector("#exports-list li.selected")?.classList?.remove("selected");

        for (let video of exportsList.children) {
            if (video?.textContent?.includes(current_view)) {
                select_export(video);
                break;
            }
        }
    }

    switch (current_view) {
        case "Original":
            original_video_viewer();
            break;

        case "COMP":
            video_viewer(`/media/${PROJECT_NAME}/clips/Input/_EXPORTS/Input_Comp_export.mp4`);
            break;

        case "Alpha":
            view_frames(true);
            break;

        case "queue":
            previewContainer.classList.add("hidden");
            break;

        default:
            view_frames();
            break;
    }

    originalVideoEl?.pause();
    if (originalVideoEl) originalVideoEl.currentTime = timeStamp;
    if (videoEl) videoEl.currentTime = timeStamp;
}

function original_video_viewer(path = `/media/${PROJECT_NAME}/clips/Input/Source/Input.mp4`) {
    videoEl?.classList?.add("hidden");

    // Seperate Video preview for the original video

    if (!originalVideoEl) {
        create_video_element(path, true);

        const doSomethingWithTheFrame = (now, metadata) => {
            if (originalVideoEl) {
                // console.log(now, metadata);
                const currentTime = metadata.mediaTime;
                const progress = (currentTime / videoDuration) * 100;
                updateFromEvent(undefined, progress, currentTime);
            }

            // Re-register the callback to be notified about the next frame.
            originalVideoEl.requestVideoFrameCallback(doSomethingWithTheFrame);
        };

        originalVideoEl.requestVideoFrameCallback(doSomethingWithTheFrame);

        originalVideoEl.addEventListener("loadedmetadata", () => {
            if (videoDuration == 0) videoDuration = originalVideoEl.duration;
            if (totalFrames == 0) totalFrames = Math.round(fps * videoDuration);

            document.getElementById("frames-total").textContent = totalFrames;
            buildTicks(totalFrames);
        });

        originalVideoEl.addEventListener("ended", () => {
            if (!playPauseButton) return;
            playPauseButton.dataset.playing = "false";
        });
    } else {
        originalVideoEl.classList.remove("opacity-0");
    }

    if (!fps) count_frames(originalVideoEl);
}

function video_viewer(path) {
    originalVideoEl.classList.toggle("opacity-0", selectedMode === "");

    // Video preview
    if (!videoEl) {
        create_video_element(path);
    } else {
        videoEl.classList.remove("hidden");
        videoEl.src = path;
    }

    if (!fps) count_frames(videoEl);
}

async function view_frames(isAlpha = false) {
    const params = new URLSearchParams({
        project: PROJECT_NAME,
        export_type: current_view,
        fps,
    });

    const response = await fetch(`/api/checkOutput?${params}`);

    if (!response.ok) {
        const message = await response.json();
        console.log("Unable to fetch output. Error:", message.detail);
        return;
    }

    const data = await response.json();

    if (!data.video_output) {
        console.log("Video export hasn't been generated yet for this view.");
        const success = generate_export(isAlpha ? "AlphaHint" : undefined);

        if (!success) {
            console.log("Failed to start export generation.");
        }

        return;
    }

    video_viewer(`/media/${PROJECT_NAME}/clips/Input/_EXPORTS/Input_${current_view}_export.mp4`);
}

// Helpers

function create_video_element(src, isOriginal = false) {
    const newVideo = document.createElement("video");
    newVideo.src = src;
    newVideo.preload = "metadata";
    newVideo.controls = false;
    newVideo.className = `max-h-full max-w-full rounded ${isOriginal ? "absolute" : "z-10"}`;

    previewContainer.append(newVideo);

    if (isOriginal) originalVideoEl = newVideo;
    else videoEl = newVideo;
}

// Update Queue UI listµ
const queue_ul = document.getElementById("queue");
const empty_queue = queue_ul.children[0];

const update_queue_ui = (queueID) => {
    let list_item = queue_ul.querySelector(`[data-id="${queueID}"]`);
    if (!queue?.[queueID]) {
        if (list_item) {
            list_item.style.background = `#029ad4`;
            list_item.remove();
        }
        empty_queue.style.display = "block";
        return;
    }

    if (!list_item) {
        list_item = document.createElement("li");
        list_item.textContent = queue[queueID].name;
        list_item.dataset.id = queueID;
        list_item.onclick = () => {
            current_view = "queue";
            update_view();
        };

        queue_ul.append(list_item);
        empty_queue.style.display = "none";
    }

    list_item.textContent = queue[queueID].name;
    list_item.style.backgroundImage = `linear-gradient(to right, #029ad4 ${queue[queueID].percent}%, transparent ${queue[queueID].percent}%)`;
};

// Generate export progress displayer

const generation_progress = document.getElementById("generate-progress");

async function generate_export(custom_view, already_running = false) {
    generation_progress.classList.remove("hidden");
    previewContainer.classList.add("hidden");

    generation_progress.innerHTML = `
        <p class="text-zinc-200 font-semibold">Generating Export</p>
        <p class="text-zinc-400 text-sm">Starting export…</p>
    `;

    id = Object.keys(queue).length + 1;
    queue[id] = { name: "Exporting", percent: 0 };

    if (!already_running) {
        await fetch(`/api/generateExport?project=${PROJECT_NAME}&export_type=${custom_view || current_view}&fps=${fps || 30}`, { method: "POST" });
    }

    async function poll() {
        const res = await fetch("/api/exportProgress");
        const data = await res.json();

        // Update text in preview window
        if (data.stage === "converting_exr_to_png") {
            queue[id] = { name: "Exporting", percent: data.percent };

            generation_progress.innerHTML = `
                <p class="text-zinc-200 font-semibold">Generating Export</p>
                <p class="text-zinc-400 text-sm">Converting EXR frames to PNG</p>
                <p class="text-zinc-500 text-xs">${data.current} / ${data.total} (${data.percent}%)</p>
            `;
        } else if (data.stage === "stitching_video") {
            queue[id] = { name: "Exporting", percent: data.percent };
            generation_progress.innerHTML = `
                <p class="text-zinc-200 font-semibold">Generating Export</p>
                <p class="text-zinc-400 text-sm">Stitching frames into video</p>
                <p class="text-zinc-500 text-xs">${data.current} / ${data.total} (${data.percent}%)</p>
            `;
        } else if (data.stage === "done") {
            delete queue[id];

            generation_progress.innerHTML = `
                <p class="text-green-400 font-semibold">Export Complete</p>
                <p class="text-zinc-400 text-sm">Video is ready!</p>
            `;

            video_viewer(`/media/${PROJECT_NAME}/clips/Input/_EXPORTS/Input_${current_view}_export.mp4`);
            load_project();
            update_queue_ui(id);
            return;
        } else if (data.stage === "error") {
            generation_progress.innerHTML = `
                <p class="text-red-500 font-semibold">Export Failed</p>
                <p class="text-zinc-400 text-sm">${data.message}</p>
            `;

            delete queue[id];
            update_queue_ui(id);
            return;
        }

        update_queue_ui();

        setTimeout(poll, 500);
    }

    poll();
}

// Run inference progress displayer

const inference_progress = document.getElementById("inference-progress");

async function run_interference(already_running = false) {
    inference_progress.classList.remove("hidden");
    previewContainer.classList.add("hidden");

    inference_progress.innerHTML = `
        <p class="text-zinc-200 font-semibold">Starting Inference</p>
        <p class="text-zinc-400 text-sm">Warming up server…</p>
    `;

    id = Object.keys(queue).length + 1;
    queue[id] = { name: "Setting Up", percent: 0 };

    if (!already_running) {
        await fetch("/api/runInterference", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                project: PROJECT_NAME,
            }),
        });
    }

    async function poll() {
        const res = await fetch("/api/inferenceProgress");
        const data = await res.json();

        // Update text in preview window
        if (data.stage === "setup") {
            queue[id] = { name: "Setting Up", percent: data.percent };

            inference_progress.innerHTML = `
                <p class="text-zinc-200 font-semibold">Running Inference Setup</p>
                <p class="text-zinc-400 text-sm">${data.message}</p>
                <p class="text-zinc-500 text-xs">${data.current} / ${data.total} (${data.percent}%)</p>
            `;
        } else if (data.stage === "inference") {
            queue[id] = { name: "Running", percent: data.percent };
            inference_progress.innerHTML = `
                <p class="text-zinc-200 font-semibold">Running Inference</p>
                <p class="text-zinc-400 text-sm">${data.message}</p>
                <p class="text-zinc-500 text-xs">${data.current} / ${data.total} (${data.percent}%)</p>
            `;
        } else if (data.stage === "done") {
            delete queue[id];

            inference_progress.innerHTML = `
                <p class="text-green-400 font-semibold">Export Complete</p>
                <p class="text-zinc-400 text-sm">Frames are keyed!</p>
            `;

            // video_viewer(`/media/${PROJECT_NAME}/clips/Input/_EXPORTS/Input_${current_view}_export.mp4`);
            load_project();
            update_queue_ui(id);
            return;
        } else if (data.stage === "error") {
            inference_progress.innerHTML = `
                <p class="text-red-500 font-semibold">Inference Failed</p>
                <p class="text-zinc-400 text-sm">${data.message}</p>
            `;

            delete queue[id];
            update_queue_ui(id);
            return;
        }

        update_queue_ui(id);

        setTimeout(poll, 500);
    }

    poll();
}

// Run interference button
document.getElementById("run").onclick = run_interference;

function count_frames(video) {
    let frameCount = 0;

    video.addEventListener("loadedmetadata", () => {
        video.pause();

        const fpsEstimate = 30;
        const step = 1 / fpsEstimate;

        for (let t = 0; t < video.duration; t += step) {
            video.currentTime = t;
            frameCount++;
        }

        fps = frameCount;
        console.log("Frames (approx):", frameCount);
        document.getElementById("frames-total").textContent = frameCount;
        document.getElementById("fps").textContent = fps;

        totalFrames = frameCount;
        buildTicks(totalFrames);
    });
}

// Check if something is already in queue
async function check_queue() {
    const inference = await fetch("/api/inferenceProgress");
    const inference_data = await inference.json();
    if (inference_data?.stage !== "idle" && inference_data?.stage !== "done") {
        current_view = "queue";
        run_interference(true);
    }

    const exporting = await fetch("/api/exportProgress");
    const exporting_data = await exporting.json();
    if (exporting_data?.stage !== "idle" && exporting_data?.stage !== "done") {
        current_view = "queue";
        generate_export(undefined, true);
    }
}

check_queue(); // Once, on page load

function get_thumbnail(videoFileName) {
    const thumbnailEl = document.createElement("img");
    thumbnailEl.src = `/thumbnail/${PROJECT_NAME}/${videoFileName}`;
    thumbnailEl.className = "w-16 h-9 object-cover rounded mr-2";
    return thumbnailEl;
}

function click_thumbnail(event) {
    const target = event?.target?.closest("li");
    if (!target) return;
    const views = document.querySelector("#views").children;

    for (const view_button of views) {
        const view_type = view_button.textContent;

        if (target.textContent.includes(view_type)) {
            current_view = view_type;
            document.querySelector("#views .btn-primary-sm").classList.replace("btn-primary-sm", "btn-secondary-sm");
            view_button.classList.replace("btn-secondary-sm", "btn-primary-sm");

            update_view();
            select_export(target);
            return;
        }
    }
}

// Update (& remember) the parameters object

const parametersForm = document.querySelector("form#parameters");
for (let element of parametersForm.elements) {
    if (element.id) {
        element.addEventListener("change", updateParameter);
    }
}

async function updateParameter(event) {
    // Update options locally
    const input = event.target;
    if (projectData?.options?.version === undefined) return;

    const old_value = findKey(projectData.options, input.id);
    if (old_value === undefined) return;

    let new_value = input.type == "checkbox" ? input.checked : input.value;
    if ((!typeof new_value) in ["boolean", "options"] && +new_value !== NaN) new_value = +new_value;

    setKey(projectData.options, input.id, new_value);

    // Upload options
    const response = await fetch("/api/updateParameters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            options: projectData.options,
            project: PROJECT_NAME,
        }),
    });

    if (!response.ok) {
        console.log("Unable to update parameter.");
        return;
    }

    const data = await response.json();
    // console.log(data);
}

// Nested object helpers
const findKey = (obj, key) =>
    obj && typeof obj === "object" ? (obj[key] ?? Object.values(obj).reduce((found, value) => found ?? findKey(value, key), undefined)) : undefined;

const setKey = (obj, key, value) =>
    obj && typeof obj === "object" ? (key in obj ? ((obj[key] = value), true) : Object.values(obj).some((v) => setKey(v, key, value))) : false;
