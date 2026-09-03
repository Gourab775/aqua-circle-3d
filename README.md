# Vary â€” Circle of Water 3D Experience

Live Demo: https://aqua-circle-3d.vercel.app

Category: Creative / Interactive 3D Web Experience

Stack: Three.js Â· Vite Â· JavaScript (ES Modules) Â· GLSL (Water Caustics)

## Overview

Vary â€” Circle of Water is an immersive, fashion-inspired 3D web experience that merges editorial storytelling with real-time water simulation. A full-screen WebGL canvas renders physically-inspired water caustics and a circular pool surface, while scroll-snapped editorial chapters unfold with fluid typography and motion.

Built as a lightweight, framework-free Vite application, it demonstrates advanced shader work, performant scroll orchestration, and a polished responsive layout â€” ideal as a luxury campaign microsite, lookbook, or experimental WebGL showcase.

## Features

- **Real-Time Water Simulation** â€” Custom `WaterPlane` and `WaterCaustics` shaders (Three.js) with interactive ripples, caustic projection, and depth-aware rendering
- **Editorial Scroll Narrative** â€” Splash + three chapters + finale with `scroll-snap`, `IntersectionObserver` reveals, and staggered typographic animation
- **Immersive Full-Screen Canvas** â€” Fixed WebGL layer under semantic HTML, with `stats-gl` instrumentation and eased camera / lighting controls
- **Tunable Visual System** â€” On-canvas GUI panel (Properties) for live tweaking of water, light, and material parameters â€” collapsible, mobile-friendly
- **Lightweight & Fast** â€” Vanilla ES modules via Vite, no framework overhead, optimized fonts (Space Grotesk, DM Sans, Inter) and asset delivery

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
â”œâ”€â”€ index.html          # Editorial markup + styles + GUI + scroll logic
â”œâ”€â”€ scene.js            # Three.js scene, camera, renderer, water setup
â”œâ”€â”€ WaterPlane.js       # Water surface geometry & shader material
â”œâ”€â”€ WaterCaustics.js    # Caustics simulation & projection
â”œâ”€â”€ vite.config.js      # Vite configuration
â”œâ”€â”€ package.json
â””â”€â”€ public/ (if any)    # Static assets
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

- **GitHub Pages** â€” Configure Pages to serve `dist/` (or use `gh-pages` / Actions). Live at https://aqua-circle-3d.vercel.app
- **Vercel / Netlify / EdgeOne Pages** â€” Connect repo, build command `npm run build`, output `dist`
- **S3 + CloudFront / Any CDN** â€” Upload `dist/` contents

No environment variables required.

## Customization

- **Copy & Chapters** â€” Edit editorial text in `index.html` (`.splash`, `.sections .section`, `.finale`)
- **Water Look** â€” Tune uniforms in `WaterPlane.js` / `WaterCaustics.js` and parameters wired in `scene.js` / GUI panel
- **Scene & Camera** â€” Adjust renderer, camera, and animation loop in `scene.js`; lighting and fog in material setup
- **Typography & Theme** â€” Update CSS variables (`--cream`, `--accent`, etc.) and Google Font imports in `<head>` of `index.html`
- **Build** â€” Extend `vite.config.js` for base path, aliases, or dev server proxies

## License

MIT â€” free for personal and commercial use.

