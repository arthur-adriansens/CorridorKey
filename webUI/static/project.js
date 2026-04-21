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

    update_view();
}

// View modes togglers

const previewContainer = document.getElementById("preview");

function update_view() {
    switch (current_view) {
        case "original":
            view_original();
            break;

        case "comp":
            view_comp();
            break;

        case "alpha":
            view_alpha();
            break;

        default:
            view_original();
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
