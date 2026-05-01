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

// View modes togglers

const previewContainer = document.getElementById("preview");
const view_types = Array.from(document.querySelectorAll("#views button:not([disabled])")).map((child) => child.textContent);

function update_view() {
    generation_progress?.classList?.add("hidden");
    previewContainer.classList.remove("hidden");

    previewContainer.querySelector("p").classList.add("hidden");

    if (exportsList?.children) {
        document.querySelector("#exports-list li.selected")?.classList?.remove("selected");

        for (let video of exportsList.children) {
            if (video?.textContent?.includes(current_view)) {
                video.classList.add("selected");
                break;
            }
        }
    }

    switch (current_view) {
        case "Original":
            video_viewer(`/media/${PROJECT_NAME}/clips/Input/Source/Input.mp4`);
            break;

        case "COMP":
            video_viewer(`/media/${PROJECT_NAME}/clips/Input/_EXPORTS/Input_Comp_export.mp4`);
            break;

        case "Alpha":
            // view_alpha();
            view_frames(true);
            break;

        default:
            view_frames();
            break;
    }
}

function video_viewer(path) {
    imageEl?.classList?.add("hidden");

    // Video preview
    if (!videoEl) {
        create_video_element(path);
    } else {
        videoEl.classList.remove("hidden");
        videoEl.src = path;
    }

    if (!fps) count_frames(videoEl);
}

// This is for the videos that are stored as frame => TODO: just convert to mp4 on server
function view_alpha() {
    videoEl?.classList?.add("hidden");

    let frameString = currentFrame.toString().padStart(6, "0"); // format: 000594 with 594 being the frame

    // Frame preview
    if (!imageEl) {
        create_image_element(`/media/${PROJECT_NAME}/clips/Input/AlphaHint/frame_${frameString}.png`);
    } else {
        imageEl.classList.remove("hidden");
        imageEl.src = `/media/${PROJECT_NAME}/clips/Input/AlphaHint/frame_${frameString}.png`;
    }
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

function create_video_element(src) {
    videoEl = document.createElement("video");
    videoEl.src = src;
    videoEl.preload = "metadata";
    videoEl.controls = false;
    videoEl.className = "max-h-full max-w-full rounded";

    previewContainer.append(videoEl);

    const doSomethingWithTheFrame = (now, metadata) => {
        if (videoEl) {
            // console.log(now, metadata);
            const currentTime = metadata.mediaTime;
            const progress = (currentTime / videoDuration) * 100;
            updateFromEvent(undefined, progress, currentTime);
        }

        // Re-register the callback to be notified about the next frame.
        videoEl.requestVideoFrameCallback(doSomethingWithTheFrame);
    };

    videoEl.requestVideoFrameCallback(doSomethingWithTheFrame);

    videoEl.addEventListener("loadedmetadata", () => {
        if (videoDuration == 0) videoDuration = videoEl.duration;
        if (totalFrames == 0) totalFrames = Math.round(fps * videoDuration);

        document.getElementById("frames-total").textContent = totalFrames;
        buildTicks(totalFrames);
    });

    videoEl.addEventListener("ended", () => {
        if (!playPauseButton) return;
        playPauseButton.dataset.playing = "false";
    });
}

function create_image_element(src) {
    imageEl = document.createElement("img");
    imageEl.src = src;
    imageEl.className = "max-h-full max-w-full rounded";

    previewContainer.append(imageEl);
}

const generation_progress = document.getElementById("generate-progress");
const queue_ul = document.getElementById("queue");
const empty_queue = queue_ul.children[0];

async function generate_export(custom_view) {
    generation_progress.classList.remove("hidden");
    previewContainer.classList.add("hidden");

    generation_progress.innerHTML = `
        <p class="text-zinc-200 font-semibold">Generating Export</p>
        <p class="text-zinc-400 text-sm">Starting export…</p>
    `;

    id = 1;

    // Update Queue UI list
    const update_queue_ui = () => {
        let list_item = queue_ul.querySelector(`[data-id="${id}"]`);
        if (!queue?.[id]) {
            if (list_item) {
                list_item.style.background = `#029ad4`;
                list_item.remove();
            }
            empty_queue.style.display = "block";
            return;
        }

        if (!list_item) {
            list_item = document.createElement("li");
            list_item.textContent = queue[id].name;
            list_item.dataset.id = id;
            queue_ul.append(list_item);
            empty_queue.style.display = "none";
        }

        list_item.style.backgroundImage = `linear-gradient(to right, #029ad4 ${queue[id].percent}%, transparent ${queue[id].percent}%)`;
    };

    await fetch(`/api/generateExport?project=${PROJECT_NAME}&export_type=${custom_view || current_view}&fps=${fps || 30}`, { method: "POST" });

    async function poll() {
        const res = await fetch("/api/exportProgress");
        const data = await res.json();

        // Update text in preview window
        if (data.stage === "converting_exr_to_png") {
            id = Object.keys(queue).length + 1;
            queue[id] = { name: "Exporting", percent: 0 };

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
            update_queue_ui();
            return;
        } else if (data.stage === "error") {
            generation_progress.innerHTML = `
                <p class="text-red-500 font-semibold">Export Failed</p>
                <p class="text-zinc-400 text-sm">${data.message}</p>
            `;
            return;
        }

        update_queue_ui();

        setTimeout(poll, 500);
    }

    poll();
}

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
            toggle_group.querySelector(".btn-primary-sm").classList.replace("btn-primary-sm", "btn-secondary-sm");
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

// Run interference button
document.getElementById("run").onclick = run_interference;

async function run_interference() {
    const response = await fetch("/api/runInterference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            project: PROJECT_NAME,
        }),
    });

    if (!response.ok) {
        const message = await response.json();
        console.log("Unable to fetch project. Error:", message.detail);
        return;
    }

    body = await response.json();
    console.log(body);
}
