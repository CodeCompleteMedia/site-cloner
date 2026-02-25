# clone-engine

Deterministic website extraction, screenshotting, and pixel-diffing engine for site cloning.

Pairs with a Claude Code Skill to clone any website into a pixel-perfect SvelteKit project. The engine handles all deterministic work — AI only generates components and interprets diffs.

## Installation

```bash
git clone https://github.com/your-username/site-cloner.git
cd site-cloner
pnpm install
pnpm build

# Install Playwright browsers
npx playwright install chromium

# Link globally (optional)
pnpm link --global
```

## Commands

### `clone-engine extract <url>`

Extract page structure, styles, and assets from a URL.

```bash
clone-engine extract "https://example.com" --output ./extraction
clone-engine extract "https://example.com" -v 375,768,1440 -t 60000
```

Options:
- `-o, --output` — Output directory (default: `./extraction`)
- `-v, --viewports` — Comma-separated viewport widths (default: `375,768,1440`)
- `-t, --timeout` — Navigation timeout in ms (default: `30000`)
- `--no-scroll` — Disable auto-scrolling for lazy content

### `clone-engine assets <extraction-dir>`

Download all assets referenced in an extraction.

```bash
clone-engine assets ./extraction
clone-engine assets ./extraction -c 10 -r 5
```

Options:
- `-c, --concurrency` — Max concurrent downloads (default: `5`)
- `-r, --retries` — Retry count per asset (default: `3`)

### `clone-engine screenshot <url>`

Capture full-page screenshots at multiple viewports.

```bash
clone-engine screenshot "https://example.com" --output ./screenshots
clone-engine screenshot "http://localhost:5173" -v 375,1440
```

Options:
- `-o, --output` — Output directory (default: `./screenshots`)
- `-v, --viewports` — Comma-separated viewport widths (default: `375,768,1440`)
- `-t, --timeout` — Navigation timeout in ms (default: `30000`)
- `--no-scroll` — Disable auto-scrolling

### `clone-engine diff <dir-a> <dir-b>`

Compare two screenshot directories pixel-by-pixel.

```bash
clone-engine diff ./screenshots/original ./screenshots/generated
clone-engine diff ./a ./b --threshold 95
```

Options:
- `-o, --output` — Output directory (default: `./diff-output`)
- `-t, --threshold` — Pass threshold percentage (default: `90`)

### `clone-engine report <diff-json>`

Generate an HTML report from diff results.

```bash
clone-engine report ./diff-output/diff-result.json
clone-engine report ./diff-output/diff-result.json -o ./report.html
```

Options:
- `-o, --output` — Output HTML path (default: `./diff-output/report.html`)

## Claude Code Skill

Register the skill by cloning this repo into your skills directory:

```bash
git clone https://github.com/your-username/site-cloner.git ~/.claude/skills/site-cloner
```

Then trigger it in Claude Code with phrases like:
- "clone this site: https://example.com"
- "rebuild this page in SvelteKit"
- "recreate this website"

See [SKILL.md](./SKILL.md) for the full pipeline definition.

## Architecture

```
URL → Extract → Assets → Screenshot Original
                              ↓
              AI Generates SvelteKit Components
                              ↓
              Screenshot Generated → Diff → Fix Loop
                                            ↓
                                     HTML Report
```

The engine handles extraction, asset downloading, screenshotting, and pixel diffing deterministically. AI is only used for:
1. Generating Svelte components from structured extraction data
2. Interpreting diff results to make targeted fixes

## Tech Stack

- **CLI**: citty (lightweight, TS-native)
- **Build**: tsup (esbuild-powered)
- **Browser**: Playwright
- **Image diffing**: pixelmatch + pngjs
- **Image I/O**: sharp
- **Logging**: consola
- **Paths**: pathe

## License

MIT
