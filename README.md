# Vary — Circle of Water 3D Experience

Live Demo: https://gourab775.github.io/vary-circle-of-water-3d-website

Category: Creative / Interactive 3D Web Experience

Stack: Three.js · Vite · JavaScript (ES Modules) · GLSL (Water Caustics)

## Overview

Vary — Circle of Water is an immersive, fashion-inspired 3D web experience that merges editorial storytelling with real-time water simulation. A full-screen WebGL canvas renders physically-inspired water caustics and a circular pool surface, while scroll-snapped editorial chapters unfold with fluid typography and motion.

Built as a lightweight, framework-free Vite application, it demonstrates advanced shader work, performant scroll orchestration, and a polished responsive layout — ideal as a luxury campaign microsite, lookbook, or experimental WebGL showcase.

## Features

- **Real-Time Water Simulation** — Custom `WaterPlane` and `WaterCaustics` shaders (Three.js) with interactive ripples, caustic projection, and depth-aware rendering
- **Editorial Scroll Narrative** — Splash + three chapters + finale with `scroll-snap`, `IntersectionObserver` reveals, and staggered typographic animation
- **Immersive Full-Screen Canvas** — Fixed WebGL layer under semantic HTML, with `stats-gl` instrumentation and eased camera / lighting controls
- **Tunable Visual System** — On-canvas GUI panel (Properties) for live tweaking of water, light, and material parameters — collapsible, mobile-friendly
- **Lightweight & Fast** — Vanilla ES modules via Vite, no framework overhead, optimized fonts (Space Grotesk, DM Sans, Inter) and asset delivery

## Tech Stack

| Layer | Technology |
|-------|------------|
| Rendering | Three.js 0.183, Custom GLSL (WaterPlane.js, WaterCaustics.js) |
| Build | Vite 6 |
| Utilities | `stats-gl` 4, `eases-jsnext`, `three` |
| Styling | Vanilla CSS, CSS variables, Google Fonts |
| Interaction | Scroll-snap, IntersectionObserver, custom GUI panel |

## Project Structure

```
vary-circle-of-water-3d-website/
├── index.html          # Editorial markup + styles + GUI + scroll logic
├── scene.js            # Three.js scene, camera, renderer, water setup
├── WaterPlane.js       # Water surface geometry & shader material
├── WaterCaustics.js    # Caustics simulation & projection
├── vite.config.js      # Vite configuration
├── package.json
└── public/ (if any)    # Static assets
```

## Getting Started

Prerequisites: Node.js 18+ and npm.

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

Open the local URL printed by Vite (typically http://localhost:5173).

## Deployment

Vite outputs static assets to `dist/`:

```bash
npm run build
```

Deploy `dist/` to any static host:

- **GitHub Pages** — Configure Pages to serve `dist/` (or use `gh-pages` / Actions). Live at https://gourab775.github.io/vary-circle-of-water-3d-website
- **Vercel / Netlify / EdgeOne Pages** — Connect repo, build command `npm run build`, output `dist`
- **S3 + CloudFront / Any CDN** — Upload `dist/` contents

No environment variables required.

## Customization

- **Copy & Chapters** — Edit editorial text in `index.html` (`.splash`, `.sections .section`, `.finale`)
- **Water Look** — Tune uniforms in `WaterPlane.js` / `WaterCaustics.js` and parameters wired in `scene.js` / GUI panel
- **Scene & Camera** — Adjust renderer, camera, and animation loop in `scene.js`; lighting and fog in material setup
- **Typography & Theme** — Update CSS variables (`--cream`, `--accent`, etc.) and Google Font imports in `<head>` of `index.html`
- **Build** — Extend `vite.config.js` for base path, aliases, or dev server proxies

## License

MIT — free for personal and commercial use.
