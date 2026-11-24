# Design sources

Editable sources for the images in `public/`. Edit the SVG, then render it to PNG.

| Source | Renders to |
| --- | --- |
| `icon.svg` | `public/favicon.svg` (copy), `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png` (180 px) |
| `og-image.svg` | `public/og-image.png` (1200 × 630, the link-preview card) |

`og-image.svg` uses the Oswald (700) and Source Sans 3 (400, 600) fonts, so the renderer needs them installed or passed in. [resvg](https://github.com/linebender/resvg) renders both files correctly; ImageMagick's built-in SVG renderer drops the lines and checkmarks.
