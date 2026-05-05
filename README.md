# CorridorKey (webUI fork)

Hi! This web UI was made by Arthur Adriansens. I stepped out of my comfort zone (JavaScript, Node.js and Astro) to use Python. The backend uses standard library, together with the already installed packages from CorridorKey, plus fastapi. The project also uses Tailwind CSS for faster development and maintainability.

Special thanks to EZ-CorridorKey for inspiring this project. A big part of the UI explenations are also from EZ-CorridorKey.

![UI screenshot](./static/images/screenshot.png "UI screenshot")

## Install

Clone this project:

```bash
git clone https://github.com/arthur-adriansens/CorridorKey.git`
cd CorridorKey
```

Run the install scripts:

1. Double-click `1. Install_CorridorKey_Windows.bat` for Windows

    > **Info:** This will automatically install uv (if needed), set up your Python environment, install all dependencies, and download the CorridorKey model.

    > **Note:** If this is the first time installing uv, any terminal windows you already had open won't see it. The installer script handles the current window automatically, but if you open a new terminal and get "'uv' is not recognized", just close and reopen that terminal.

    Run `1. Install_CorridorKey_Linux_Mac.sh` for Linux & Mac

2. (**Optional**) Double-click `2. Install_GVM_Windows.bat` and `2. Install_VideoMaMa_Windows.bat` to download the heavy optional Alpha Hint generator weights.

3. FFmpeg also needs to be installed:

    ```bash
    https://ffmpeg.org/download.html

    # ---OR---

    # Windows
    winget install "FFmpeg (Essentials Build)"

    # macOS
    brew install ffmpeg

    # Ubuntu / Debian
    sudo apt update && sudo apt install -y ffmpeg

    # Verify the installation
    ffmpeg -version
    ```

---

4. Start the server and open the UI by double-clicking on `4. RUN_CorridorKeyUI.bat` for Windows

## Todo's

- [x] Make inference work.
    - [x] Make it work (lol).
    - [x] Connect progress and queue to UI
    - [x] Bug where no clips are found (fixed with auto frame pattern detection)
    - [x] Color space (sRGB / linear)
    - [x] ~~Add cuda check~~
    - [x] Implement custom backend
- [x] Move original clip in UI to a underlying layer to implement "hold" compare mode
- [ ] A/B compare mode
- [x] Add a working queue with progress bar as background
- [x] Add explenation to views and compare modes
- [x] Clean the 2 README's up.
- [x] "Starting server" and "Project not found" page
- [x] Load queue when reloading UI page
- [ ] Display average frames per second processing speed and time estimate for inference
- [ ] Add Linear <-> sRGB converter (see color_utils.linear_to_srgb and srgb_to_linear functions)
- [x] Add an installer page ~~with secondary server~~ which does not need any installation.
- [x] gpu_check popups
- [x] ~~ffmpeg_check~~ (ffmpeg enkel nodig bij frame stitiching => handled die error al)
- [] webUI update (available) button (git fetch)

## Developer notes

### Prerequisites

- Node.js and npm for Tailwind development: [Node.js](https://nodejs.org/en)
- Lucide Icons (for UI icons)

### Developer install

Install the Python dependencies:

```bash
uv sync --group dev # updates/installs all dependencies + dev tools (pytest, ruff)
```

> This project uses **[uv](https://docs.astral.sh/uv/)** to manage Python and all dependencies. uv is a fast, modern replacement for pip that automatically handles Python versions, virtual environments, and package installation in a single step. You do **not** need to install Python yourself — uv does it for you.

To install tailwindCSS globally:

```bash
npm install -g tailwindcss@3 # v4 doesn't really work without a package.json, which I don't want to add
```

### Start the dev server

Start the local server automaticly:

- `start_dev_servers.bat` for Windows (will start servers in a minified terminal)

---

Or start the local server manually:

```bash
uv run --extra cuda uvicorn webUI.server.server:app --reload # start the python server (also for development)
```

To enable tailwind "watching" in a second terminal during development (generates the ouput.css file when you make changes)=

```bash
cd webUI && tailwindcss -i static/input.css -o static/styles.css --watch
```

## Questions?

DM [Art on Discord](https://discord.com/users/714418367209144330), or [open an issue](https://github.com/arthur-adriansens/CorridorKey/issues) on my Git page.
