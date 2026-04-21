/* This JS script contains code for
    1. PROJECT SETUP (load files etc.), 
    2. SERVER CONNECTION */

/* 1. PROJECT SETUP */

// const PROJECT_BASE_URL = "C:/Users/arthu/AppData/Roaming/EZ-CorridorKey/Projects/260415_191034_Input";
const PROJECT_BASE_URL = "Projects/260415_191034_Input";

projectInfo();

// Setup

async function projectInfo() {
    const params = new URLSearchParams({
        project: "cool project name",
        path: `${PROJECT_BASE_URL}/clips/Input/Source/Input.mp4`,
    });

    const response = await fetch(`/api/projectInfo?${params}`);

    if (!response.ok) {
        console.log("Unable to fetch project.");
        return;
    }

    const info = await response.json();
    console.log(info);

    fps = info.fps;
    document.getElementById("fps").textContent = fps;

    update_view();
}

// View modes togglers

const previewContainer = document.getElementById("preview");

function update_view() {
    switch (current_view) {
        case "original":
            view_original();
            break;

        default:
            view_original();
            break;
    }
}

function view_original() {
    previewContainer.querySelector("p").classList.add("hidden");

    // Video preview
    videoEl = document.createElement("video");

    videoEl.src = `/media/${PROJECT_BASE_URL}/clips/Input/Source/Input.mp4`;
    videoEl.preload = "metadata";
    // videoEl.controls = true;
    videoEl.className = "max-h-full max-w-full rounded";

    previewContainer.append(videoEl);

    const doSomethingWithTheFrame = (now, metadata) => {
        if (videoEl) {
            // console.log(now, metadata);
            const currentTime = metadata.mediaTime;
            const progress = (currentTime / videoDuration) * 100;
            updateFromEvent(undefined, progress);
        }

        // Re-register the callback to be notified about the next frame.
        videoEl.requestVideoFrameCallback(doSomethingWithTheFrame);
    };

    videoEl.requestVideoFrameCallback(doSomethingWithTheFrame);

    if (!fps) {
        count_frames(videoEl);
    }

    videoEl.addEventListener("loadedmetadata", () => {
        videoDuration = videoEl.duration;
        const estimatedFrames = Math.round(fps * videoDuration);

        totalFrames = Math.round(fps * videoDuration);
        document.getElementById("frames-total").textContent = totalFrames;

        buildTicks(totalFrames);
    });

    videoEl.addEventListener("ended", () => {
        if (!playPauseButton) return;
        playPauseButton.dataset.playing = "false";
    });
}

// Helpers

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
