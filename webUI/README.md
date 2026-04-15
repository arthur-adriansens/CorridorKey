# Contributing to CorridorKey web UI

Hi! This web UI was made by Arthur Adriansens. I stepped out of my comfort zone (JavaScripe, Node.js and Astro) to use Python. This UI version doens't use any pip python libraries, only native.
I wanted to avoid adding any packages to this awesome project, so I only used devDependencies, because I want to use Tailwind CSS for faster development and maintainability.

## Developer notes

### Prerequisites

- Python 3.10 or newer
- NPM to install Tailwind for development

### Dev Setup

To clone this intire project:

```bash
git clone https://github.com/nikopueringer/CorridorKey.git
cd CorridorKey
uv sync --group dev    # installs all dependencies + dev tools (pytest, ruff)

python webUI/server/server.py # start the python server
```

To install tailwindCSS globally and enable tailwind watching to generate the ouput.css file

```bash
npm install -g tailwindcss@3 # v4 doesn't really work without a package.json
cd webUI
tailwindcss -i input.css -o styles.css --watch
```

That's it.

### Linting and Formatting

```bash
uv run ruff check          # check for lint errors
uv run ruff format --check # check formatting (no changes)
uv run ruff format         # auto-format your code
```

CI runs both checks on every pull request. Running them locally before pushing saves a round-trip.

## Making Changes

### Pull Requests

1. Fork the repo and create a branch for your change
2. Make your changes
3. Run `uv run pytest` and `uv run ruff check` to make sure everything passes
4. Open a pull request against `main`

In your PR description, focus on **why** you made the change, not just what changed. If you're fixing a bug, describe the symptoms. If you're adding a feature, explain the use case. A couple of sentences is plenty.

### What Makes a Good Contribution

- **Bug fixes** — especially for edge cases in EXR/linear workflows, color space handling, or platform-specific issues
- **Tests** — more test coverage is always welcome, particularly for `clip_manager.py` and `inference_engine.py`
- **Documentation** — better explanations, usage examples, or clarifying comments in tricky code
- **Performance** — reducing GPU memory usage, speeding up frame processing, or optimizing I/O

### Code Style

- The project uses [ruff](https://docs.astral.sh/ruff/) for both linting and formatting
- Lint rules: `E, F, W, I, B` (basic style, unused imports, import sorting, common bug patterns)
- Line length: 120 characters
- Third-party code in `gvm_core/` and `VideoMaMaInferenceModule/` is excluded from lint enforcement — those are derived from research repos and we try to keep them close to upstream

## Questions?

DM [Art on Discord](https://discord.com/users/714418367209144330).
Join the [Discord](https://discord.gg/zvwUrdWXJm) — it's the fastest way to get help or discuss ideas before opening a PR.
