# CorridorKey (webUI fork)

Hi! This web UI was made by Arthur Adriansens. I stepped out of my comfort zone (JavaScripe, Node.js and Astro) to use Python. This UI version doens't use any pip python libraries, only native.
I wanted to avoid adding any packages to this awesome project, so I only used devDependencies, because I want to use Tailwind CSS for faster development and maintainability.

## Todo's

- [ ] Make interference work.
    - [ x ] Bug where no clips are found (fixed with auto frame pattern detection)
    - [ ] Color space (sRGB / linear)
    - [ ] Add cuda check:
        ```py
        import torch
        print(torch.__version__)
        print("available:", torch.cuda.is_available()) #true?
        print("cuda devices:", torch.cuda.device_count()) #>= 1?
        print("cuda version:", torch.version.cuda)
        ```
    - [ ] Implement custom backend:
        ```py
        run_inference([clip], device=device, backend="auto" # here, ...)
        ```
- [ x ] Move original clip in UI to a underlying layer to implement "hold" compare mode
- [ ] A/B compare mode
- [ x ] Add a working queue with progress bar as background
- [ x ] Add explenation to views and compare modes
- [ ] Clean the 2 README's up.
- [ ] "Starting server" and "Project not found" page

## Developer notes

### Prerequisites

- NPM to install Tailwind for development

### Install

First clone this intire project:

```bash
git clone https://github.com/nikopueringer/CorridorKey.git`
cd CorridorKey
```

Then **run the original install script!**

- `Install_CorridorKey_Windows.bat` for Windows
- `Install_CorridorKey_Linux_Mac.sh` for Linux & Mac

FFmpeg also needs to be installed:

```bash
# https://ffmpeg.org/download.html

#---OR---

winget install "FFmpeg (Essentials Build)"    # Windows
brew install ffmpeg     # macOS
sudo apt update && sudo apt install -y ffmpeg   # Ubuntu / Debian

ffmpeg -version # test if installation was a succes
```

Then start the local server:

```bash
uv run --extra cuda uvicorn webUI.server.server:app --reload # start the python server (also for development)
```

### Dev setup

To install tailwindCSS globally:

```bash
uv sync --group dev # updates/installs all dependencies + dev tools (pytest, ruff)
npm install -g tailwindcss@3 # v4 doesn't really work without a package.json
```

And to enable tailwind "watching" to generate the ouput.css file when you make changes, you should run this in a second terminal during development:

```bash
cd webUI
tailwindcss -i static/input.css -o static/styles.css --watch
```

That's it!

## Questions?

DM [Art on Discord](https://discord.com/users/714418367209144330).
Join the [Discord](https://discord.gg/zvwUrdWXJm) — it's the fastest way to get help or discuss ideas before opening a PR.

# Parts of original repo README:

## Getting Started

### 1. Installation

This project uses **[uv](https://docs.astral.sh/uv/)** to manage Python and all dependencies. uv is a fast, modern replacement for pip that automatically handles Python versions, virtual environments, and package installation in a single step. You do **not** need to install Python yourself — uv does it for you.

**For Windows Users (Automated):**

1.  Clone or download this repository to your local machine.
2.  Double-click `Install_CorridorKey_Windows.bat`. This will automatically install uv (if needed), set up your Python environment, install all dependencies, and download the CorridorKey model.
    > **Note:** If this is the first time installing uv, any terminal windows you already had open won't see it. The installer script handles the current window automatically, but if you open a new terminal and get "'uv' is not recognized", just close and reopen that terminal.
3.  (Optional) Double-click `Install_GVM_Windows.bat` and `Install_VideoMaMa_Windows.bat` to download the heavy optional Alpha Hint generator weights.

**For Linux / Mac Users (Automated):**

1.  Clone or download this repository to your local machine.
2.  Open terminal and write `bash`. Put a space after writing `bash`.
3.  Drag and drop `Install_CorridorKey_Linux_Mac.sh` into the terminal. Then press enter.
4.  (Optional) Do the 2. step again. But now drag and drop `Install_GVM_Linux_Mac.sh` and `Install_VideoMaMa_Linux_Mac.sh` to download the heavy optional Alpha Hint generator weights.

**For Linux / Mac Users (Manual):**

1.  Clone or download this repository to your local machine.
2.  Install uv if you don't have it:
    ```bash
    curl -LsSf https://astral.sh/uv/install.sh | sh
    ```
3.  Install all dependencies (uv will download Python 3.10+ automatically if needed):
    ```bash
    uv sync                  # CPU/MPS (default — works everywhere)
    uv sync --extra cuda     # CUDA GPU acceleration (Linux/Windows)
    uv sync --extra mlx      # Apple Silicon MLX acceleration
    ```
    For **AMD ROCm** setup, see the [AMD ROCm Setup](#amd-rocm-setup) section below.
4.  **Download the Models:**
    - **CorridorKey v1.0 Model (~300MB):** Downloads automatically on first run. If no `.pth` file is found in `CorridorKeyModule/checkpoints/`, the engine fetches it from [CorridorKey's HuggingFace](https://huggingface.co/nikopueringer/CorridorKey_v1.0) and saves it as `CorridorKey.pth`. No manual download needed.
    - **GVM Weights (Optional):** [HuggingFace: geyongtao/gvm](https://huggingface.co/geyongtao/gvm)
        - Download using the CLI: `uv run hf download geyongtao/gvm --local-dir gvm_core/weights`
    - **VideoMaMa Weights (Optional):** [HuggingFace: SammyLim/VideoMaMa](https://huggingface.co/SammyLim/VideoMaMa)
        - Download the VideoMaMa fine-tuned weights:
            ```
            uv run hf download SammyLim/VideoMaMa --local-dir VideoMaMaInferenceModule/checkpoints/VideoMaMa
            ```
        - VideoMaMa also requires the Stable Video Diffusion base model (VAE + image encoder only, ~2.5GB). Accept the license at [stabilityai/stable-video-diffusion-img2vid-xt](https://huggingface.co/stabilityai/stable-video-diffusion-img2vid-xt), then:
            ```
            uv run hf download stabilityai/stable-video-diffusion-img2vid-xt \
              --local-dir VideoMaMaInferenceModule/checkpoints/stable-video-diffusion-img2vid-xt \
              --include "feature_extractor/*" "image_encoder/*" "vae/*" "model_index.json"
            ```
        - VideoMaMa is an amazing project, please go star their [repo](https://github.com/cvlab-kaist/VideoMaMa) and show them some support!

### 2. How it Works

CorridorKey requires two inputs to process a frame:

1.  **The Original RGB Image:** The to-be-processed green screen footage. This requires the sRGB color gamut (interchangeable with REC709 gamut), and the engine can ingest either an sRGB gamma or Linear gamma curve.
2.  **A Coarse Alpha Hint:** A rough black-and-white mask that generally isolates the subject. This does _not_ need to be precise. It can be generated by you with a rough chroma key or AI roto.

I've had the best results using GVM or VideoMaMa to create the AlphaHint, so I've repackaged those projects and integrated them here as optional modules inside `clip_manager.py`. Here is how they compare:

- **GVM:** Completely automatic and requires no additional input. It works exceptionally well for people, but can struggle with inanimate objects.
- **VideoMaMa:** Requires you to provide a rough VideoMamaMaskHint (often drawn by hand or AI) telling it what you want to key. If you choose to use this, place your mask hint in the `VideoMamaMaskHint/` folder that the wizard creates for your shot. VideoMaMa results are spectacular and can be controlled more easily than GVM due to this mask hint.
- **Please** go show the creators of these projects some love and star their repos. [VideoMaMa](https://github.com/cvlab-kaist/VideoMaMa) and [GVM](https://github.com/aim-uofa/GVM)

Perhaps in the future, I will implement other generators for the AlphaHint! In the meantime, the better your Alpha Hint, the better CorridorKey's final result will be. Experiment with different amounts of mask erosion or feathering. The model was trained on coarse, blurry, eroded masks, and is exceptional at filling in details from the hint. However, it is generally less effective at subtracting unwanted mask details if your Alpha Hint is expanded too far.

Please give feedback and share your results!

### 3. Usage: The Command Line Wizard

For the easiest experience, use the provided launcher scripts. These scripts launch a prompt-based configuration wizard in your terminal.

- **Windows:** Drag-and-drop a video file or folder onto `CorridorKey_DRAG_CLIPS_HERE_local.bat` (Note: Only launch via Drag-and-Drop or CMD. Double-clicking the `.bat` directly will throw an error).
- **Linux / Mac:** Run or drag-and-drop a video file or folder onto `./CorridorKey_DRAG_CLIPS_HERE_local.sh`.
-   - Or write `bash` again in terminal. Put a space after and then drag-and-drop `CorridorKey_DRAG_CLIPS_HERE_local.sh` and your clip folder together into terminal, respectively. Then press enter.

**Workflow Steps:**

1.  **Launch:** You can drag-and-drop a single loose video file (like an `.mp4`), a shot folder containing image sequences, or even a master "batch" folder containing multiple different shots all at once onto the launcher script.
2.  **Organization:** The wizard will detect what you dragged in. If you dropped loose video files or unorganized folders, the first prompt will ask if you want it to organize your clips into the proper structure.
    - If you say Yes, the script will automatically create a shot folder, move your footage into an `Input/` sub-folder, and generate empty `AlphaHint/` and `VideoMamaMaskHint/` folders for you. This structure is required for the engine to pair your hints and footage correctly!
3.  **Generate Hints (Optional):** If the wizard detects your shots are missing an `AlphaHint`, it will ask if you want to generate them automatically using the repackaged GVM or VideoMaMa modules.
4.  **Configure:** Once your clips have both Inputs and AlphaHints, select "Process Ready Clips". The wizard will prompt you to configure the run:
    - **Gamma Space:** Tell the engine if your sequence uses a Linear or sRGB gamma curve.
    - **Despill Strength:** This is a traditional despill filter (0-10), if you wish to have it baked into the output now as opposed to applying it in your comp later.
    - **Auto-Despeckle:** Toggle automatic cleanup and define the size threshold. This isn't just for tracking dots, it removes any small, disconnected islands of pixels.
    - **Refiner Strength:** Use the default (1.0) unless you are experimenting with extreme detail pushing.
5.  **Result:** The engine will generate several folders inside your shot directory:
    - `/Matte`: The raw Linear Alpha channel (EXR).
    - `/FG`: The raw Straight Foreground Color Object. (Note: The engine natively computes this in the sRGB gamut. You must manually convert this pass to linear gamma before being combined with the alpha in your compositing program).
    - `/Processed`: An RGBA image containing the Linear Foreground premultiplied against the Linear Alpha (EXR). This pass exists so you can immediately drop the footage into Premiere/Resolve for a quick preview without dealing with complex premultiplication routing. However, if you want more control over your image, working with the raw FG and Matte outputs will give you that.
    - `/Comp`: A simple preview of the key composited over a checkerboard (PNG).

## Backend Selection

CorridorKey supports two inference backends:

- **Torch** (default on Linux/Windows) — CUDA, MPS, or CPU
- **MLX** (Apple Silicon) — native Metal acceleration, no Torch overhead

Resolution: `--backend` flag > `CORRIDORKEY_BACKEND` env var > auto-detect.
Auto mode prefers MLX on Apple Silicon when available.

**Override via CLI flag (corridorkey_cli.py):**

```bash
uv run python unused_root_files/corridorkey_cli.py wizard --win_path "/path/to/clips" --backend mlx
uv run python unused_root_files/corridorkey_cli.py run_inference --backend torch
```

## Troubleshooting

- **"No .safetensors checkpoint found"** — place MLX weights in `CorridorKeyModule/checkpoints/`
- **"corridorkey_mlx not installed"** — run `uv sync --extra mlx`
- **"MLX requires Apple Silicon"** — MLX only works on M1+ Macs
- **Auto picked Torch unexpectedly** — set `CORRIDORKEY_BACKEND=mlx` explicitly

## Advanced Usage

For developers looking for more details on the specifics of what is happening in the CorridorKey engine, check out the README in the `/CorridorKeyModule` folder. We also have a dedicated handover document outlining the pipeline architecture for AI assistants in `/docs/LLM_HANDOVER.md`.

You can also explore the full, auto-generated codebase documentation on [DeepWiki](https://deepwiki.com/nikopueringer/CorridorKey).
