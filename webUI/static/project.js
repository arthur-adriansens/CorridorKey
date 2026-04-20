/* This JS script contains code for
    1. PROJECT SETUP (load files etc.), 
    2. SERVER CONNECTION */

/* 1. PROJECT SETUP */

// const PROJECT_BASE_URL = "C:/Users/arthu/AppData/Roaming/EZ-CorridorKey/Projects/260415_191034_Input"; // set this in the server eventually
const PROJECT_BASE_URL = "/media/Projects/260415_191034_Input";

window.current_view = document.querySelector("#views > .btn-primary-sm").textContent.toLowerCase();

// View modes togglers

const previewContainer = document.getElementById("preview");
const video = update_view();

function update_view() {
    const view = window.current_view;

    switch (view) {
        case "original":
            view_original();
            break;

        default:
            view_original();
            break;
    }
}

function count_frames(video) {
    let frameCount = 0;

    video.addEventListener("loadedmetadata", () => {
        video.pause();

        const fps = 30;
        const step = 1 / fps;

        for (let t = 0; t < video.duration; t += step) {
            video.currentTime = t;
            frameCount++;
        }

        console.log("Frames (approx):", frameCount);
        document.getElementById("frames-total").textContent = frameCount;

        totalFrames = frameCount;
        buildTicks(totalFrames);
    });
}
// TODO GET FPS EN herschijf dit alles (zie ocpilot)
projectInfo();

async function projectInfo() {
    const params = new URLSearchParams({
        project: "cool project name",
        path: "arthur",
    });

    const response = await fetch(`/api/projectInfo?${params}`);

    if (!response.ok) {
        console.log("Unable to fetch project.");
        return;
    }

    const test = await response.json();
    console.log(test);
}

function view_original() {
    // Video preview
    const videoEl = document.createElement("video");
    videoEl.src = `${PROJECT_BASE_URL}/clips/Input/Source/Input.mp4`;

    // video.controls = true;
    videoEl.className = "max-h-full max-w-full rounded";
    previewContainer.innerHTML = videoEl.outerHTML;

    const doSomethingWithTheFrame = (now, metadata) => {
        // Do something with the frame.
        console.log(now, metadata);
        // Re-register the callback to be notified about the next frame.
        videoEl.requestVideoFrameCallback(doSomethingWithTheFrame);
    };

    // Initially register the callback to be notified about the first frame.
    videoEl.requestVideoFrameCallback(doSomethingWithTheFrame);

    count_frames(videoEl);
}
