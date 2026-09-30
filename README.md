# ybat-liberia
Building and developing youth talents in Liberia.

## Current build

This repository contains a lightweight, mobile-first static website MVP for stakeholder and pre-launch community review. It uses the supplied YBAT logo and approved photographs from the organization's brand PDF.

The experience is intentionally low-data: no framework runtime, no external image library, no video autoplay, minimal JavaScript, lazy-loaded secondary images, and optimized local JPEG assets.

## Run locally

Because this is a static site, use any local server from the repository root:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Deploy on Netlify

The repository includes `netlify.toml`. Set the Netlify publish directory to the repository root (`.`). No build command is required for the current static MVP. Connect the `main` branch for production deploys.

## Contact and feedback

Public contact details currently used on the site:

- 0880 555 318
- 0775 663 145
- info.ybat2023@gmail.com (carried forward from the existing official site)
- Facebook: https://www.facebook.com/profile.php?id=61585509376783

The pre-launch feedback CTA opens a prepared email message so stakeholder and community feedback can be collected before public launch.

## Next review items

- Confirm final mission and program copy.
- Confirm the canonical domain.
- Confirm photo consent/safeguarding records for public use.
- Review the site on mobile data and lower-end devices.
- Replace the mailto feedback flow with Netlify Forms if a web-based inbox workflow is preferred.
