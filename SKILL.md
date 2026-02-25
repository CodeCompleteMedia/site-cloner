---
name: site-cloner
description: Clone any website into a pixel-perfect SvelteKit project. Uses clone-engine for deterministic extraction, screenshotting, and diffing — AI only handles component generation and targeted fixes.
triggers:
  - clone site
  - clone website
  - clone this page
  - rebuild this site in svelte
  - site to sveltekit
  - recreate this website
---

# Site Cloner — Claude Code Skill

Clone any website into a pixel-perfect SvelteKit project using deterministic extraction + AI generation.

## Prerequisites

- clone-engine CLI installed: `cd ~/Github/site-cloner && pnpm install && pnpm build && pnpm link --global`
- Playwright browsers: `npx playwright install chromium`

## Pipeline

When the user provides a URL to clone, follow this pipeline exactly:

### Step 1: Extract

```bash
clone-engine extract "<URL>" --output ./clone-workspace/extraction
```

This produces structured JSON files with:
- `extraction.json` — metadata, design tokens, routes, asset manifest
- `sections/` — per-section DOM + computed styles per viewport

Read `extraction.json` to understand the site structure.

### Step 2: Download Assets

```bash
clone-engine assets ./clone-workspace/extraction
```

Downloads all images, fonts, and SVGs referenced in the extraction.

### Step 3: Screenshot Original

```bash
clone-engine screenshot "<URL>" --output ./clone-workspace/screenshots/original
```

Captures baseline screenshots at 375px, 768px, and 1440px viewports.

### Step 4: Generate SvelteKit Components

Read each section JSON file from `clone-workspace/extraction/sections/`.

For each section, generate a Svelte 5 component following these rules:
- Use `$props()` rune for component props
- Use scoped `<style>` blocks, NOT Tailwind
- Preserve CSS custom properties (var(--name)) from the extraction
- Use semantic HTML matching the original landmarks
- Place components in `src/lib/components/`
- Import and compose them in `src/routes/+page.svelte`
- Copy downloaded assets to `static/`
- Use the `tokens.css` generated from design tokens

Also scaffold the SvelteKit project if not already done:
```bash
cd ./clone-workspace/generated
pnpm install
```

### Step 5: Screenshot Generated Site

Start the dev server and screenshot:
```bash
cd ./clone-workspace/generated
pnpm dev &
sleep 5
clone-engine screenshot "http://localhost:5173" --output ../screenshots/generated
```

### Step 6: Diff

```bash
clone-engine diff ./clone-workspace/screenshots/original ./clone-workspace/screenshots/generated --output ./clone-workspace/diff-output
```

### Step 7: Review and Fix

Read `clone-workspace/diff-output/diff-result.json`.

For each viewport that scored below 90%:
1. Read the diff overlay image to identify visual discrepancies
2. Make targeted fixes to the specific components that are failing
3. Only modify components related to failing sections

### Step 8: Iterate

Repeat Steps 5-7 until:
- All viewports score >= 90% match, OR
- 5 iterations completed, OR
- No improvement between consecutive iterations (scores changed < 1%)

### Step 9: Generate Report

```bash
clone-engine report ./clone-workspace/diff-output/diff-result.json --output ./clone-workspace/report.html
```

Present the final match percentages to the user.

## Output Structure

```
clone-workspace/
├── extraction/           # Step 1-2 output
│   ├── extraction.json
│   ├── sections/
│   └── assets/
├── screenshots/
│   ├── original/        # Step 3 output
│   └── generated/       # Step 5 output
├── generated/           # Step 4 output (SvelteKit project)
├── diff-output/         # Step 6 output
│   ├── diff-result.json
│   └── diff-*.png
└── report.html          # Step 9 output
```

## Key Principles

1. **AI only generates components** — extraction, screenshotting, and diffing are deterministic
2. **Section-level granularity** — fix only what's broken, not the whole page
3. **Measurable progress** — pixel diff scores drive iteration
4. **Multi-viewport** — responsive from the start (375/768/1440)
5. **Svelte 5** — use runes (`$props`, `$state`, `$derived`), not legacy syntax
