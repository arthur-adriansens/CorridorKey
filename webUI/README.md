# CorridorKey web UI

Hi! This web UI was made by Arthur Adriansens. I stepped out of my comfort zone (JavaScripe, Node.js and Astro) to use Python. This UI version doens't use any pip python libraries, only native.
I wanted to avoid adding any packages to this awesome project, so I only used devDependencies, because I want to use Tailwind CSS for faster development and maintainability.

## Developer notes

### Prerequisites

- Python 3.10 or newer
- NPM to install Tailwind for development

### Install

To clone this intire project:

```bash
git clone https://github.com/nikopueringer/CorridorKey.git
cd CorridorKey
uv sync --group dev    # installs all dependencies + dev tools (pytest, ruff)

uv run uvicorn webUI.server.server:app --reload # start the python server (also for development)
```

Ffmpeg also needs to be installed:

```bash
winget install "FFmpeg (Essentials Build)"    # Windows
brew install ffmpeg     # macOS
sudo apt update && sudo apt install -y ffmpeg   # Ubuntu / Debian

# or: https://ffmpeg.org/download.html

ffmpeg -version
```

## Dev setup

To install tailwindCSS globally and enable tailwind watching to generate the ouput.css file

```bash
npm install -g tailwindcss@3 # v4 doesn't really work without a package.json

cd webUI && tailwindcss -i static/input.css -o static/styles.css --watch    # run this in a second terminal during development
```

That's it.

## Questions?

DM [Art on Discord](https://discord.com/users/714418367209144330).
Join the [Discord](https://discord.gg/zvwUrdWXJm) — it's the fastest way to get help or discuss ideas before opening a PR.
