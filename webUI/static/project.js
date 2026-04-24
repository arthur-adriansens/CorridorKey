/* This JS script contains code for
    1. PROJECT SETUP (load files etc.), 
    2. SERVER CONNECTION */

/* 1. PROJECT SETUP */

// const PROJECT_NAME = "C:/Users/arthu/AppData/Roaming/EZ-CorridorKey/Projects/260415_191034_Input";
const PROJECT_NAME = "260415_191034_Input";

projectInfo();

// Setup

async function projectInfo() {
    const params = new URLSearchParams({
        project: PROJECT_NAME,
    });

    const response = await fetch(`/api/projectInfo?${params}`);

    if (!response.ok) {
        const message = await response.json();
        console.log("Unable to fetch project. Error:", message.detail);
        return;
    }

    const info = await response.json();
    console.log(info);

    videoDuration = info.duration;
    totalFrames = info.frame_count;

    // Update fps UI
    fps = info.fps;
    document.getElementById("fps").textContent = fps;

    // Update projects list UI
    if (info?.projects?.length > 0) {
        const projectsList = document.getElementById("projects-list");
        projectsList.innerHTML = "";

        info.projects.forEach((project) => {
            const li = document.createElement("li");
            li.textContent = project;
            if (project === PROJECT_NAME) li.classList.add("selected");

            projectsList.append(li);
        });
    }

    // Update BiRefNet options UI
    if (info?.birefnet_options?.length > 0) {
        const birefnetSelect = document.getElementById("birefnet-options");
        birefnetSelect.innerHTML = "";

        info.birefnet_options.forEach((option) => {
            const opt = document.createElement("option");
            opt.textContent = option;
            birefnetSelect.append(opt);
        });
    }

    update_view();

    // Update exports list UI
    if (info?.exports) {
        const exportsList = document.getElementById("exports-list");
        exportsList.innerHTML = "";

        Object.entries(info.exports).forEach(([videoName, videoPath]) => {
            const li = document.createElement("li");
            const img = get_thumbnail(videoName);

            li.textContent = videoName;
            li.onclick = click_thumbnail;
            exportsList.append(li);
            li.prepend(img);
        });
    }
}

// View modes togglers

const previewContainer = document.getElementById("preview");
const view_types = Array.from(document.querySelectorAll("#views button:not([disabled])")).map((child) => child.textContent);

function update_view() {
    switch (current_view) {
        case "Original":
            view_original();
            break;

        case "COMP":
            view_comp();
            break;

        case "Alpha":
            view_alpha();
            break;

        case "Matte":
            view_matte();
            break;

        default:
            view_frames();
            break;
    }
}

function view_original() {
    previewContainer.querySelector("p").classList.add("hidden");
    imageEl?.classList?.add("hidden");

    // Video preview
    if (!videoEl) {
        create_video_element(`/media/${PROJECT_NAME}/clips/Input/Source/Input.mp4`);
    } else {
        videoEl.classList.remove("hidden");
        videoEl.src = `/media/${PROJECT_NAME}/clips/Input/Source/Input.mp4`;
    }

    if (!fps) count_frames(videoEl);
}

function view_comp() {
    previewContainer.querySelector("p").classList.add("hidden");
    imageEl?.classList?.add("hidden");

    // Video preview
    if (!videoEl) {
        create_video_element(`/media/${PROJECT_NAME}/clips/Input/_EXPORTS/Input_Comp_export.mp4`);
    } else {
        videoEl.classList.remove("hidden");
        videoEl.src = `/media/${PROJECT_NAME}/clips/Input/_EXPORTS/Input_Comp_export.mp4`;
    }

    if (!fps) count_frames(videoEl);
}

// This is for the videos that are stored as frame => TODO: just convert to mp4 on server
function view_alpha() {
    previewContainer.querySelector("p").classList.add("hidden");
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

// This is for the videos that are stored as frame => TODO: just convert exr's to png's to mp4 on server
function view_matte() {
    previewContainer.querySelector("p").classList.add("hidden");
    videoEl?.classList?.add("hidden");

    let frameString = currentFrame.toString().padStart(6, "0"); // format: 000594 with 594 being the frame

    // Frame preview
    if (!imageEl) {
        create_image_element(`/media/${PROJECT_NAME}/clips/Input/Output/Matte/frame_${frameString}.png`);
    } else {
        imageEl.classList.remove("hidden");
        imageEl.src = `/media/${PROJECT_NAME}/clips/Input/Output/Matte/frame_${frameString}.png`;
    }
}

async function view_frames() {
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

    // Render video preview
    previewContainer.querySelector("p").classList.add("hidden");
    imageEl?.classList?.add("hidden");

    if (!videoEl) {
        create_video_element(`/media/${PROJECT_NAME}/clips/Input/_EXPORTS/Input_${current_view}_export.mp4`);
    } else {
        videoEl.classList.remove("hidden");
        videoEl.src = `/media/${PROJECT_NAME}/clips/Input/_EXPORTS/Input_${current_view}_export.mp4`;
    }

    if (!fps) count_frames(videoEl);
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
    if (!event?.target) return;
    const views = document.querySelector("#views").children;

    for (const view_button of views) {
        const view_type = view_button.textContent;

        if (event.target.textContent.includes(view_type)) {
            current_view = view_type;
            toggle_group.querySelector(".btn-primary-sm").classList.replace("btn-primary-sm", "btn-secondary-sm");
            view_button.classList.replace("btn-secondary-sm", "btn-primary-sm");

            update_view();

            const previouslySelected = document.querySelector("#exports-list li.selected");
            if (previouslySelected !== event.target) {
                previouslySelected?.classList.remove("selected");
            }
            event.target.classList.toggle("selected");
            return;
        }
    }
}
