# @portfolio/brand

The logo and the Open Graph cover of hoyasumii.dev, as HTML templates rendered to PNG.

| Template              | Size                         | Images                                          |
| --------------------- | ---------------------------- | ----------------------------------------------- |
| `templates/logo.html` | 512×512, transparent corners | `images/logo-light.png`, `images/logo-dark.png` |
| `templates/og.html`   | 1200×630                     | `images/og-light.png`, `images/og-dark.png`     |

`templates/tokens.css` holds the site's colors and fonts (from `apps/web/src/app/site.css`); `?theme=dark`
switches them. Open a template in Chrome to preview it (the logo's rounded corners use `corner-shape`,
Chromium 139+).

```sh
bun run brand          # renders every image into images/
bun run brand og       # only the images whose file starts with "og"
```

The jobs (template, theme, size, output) are listed in `src/render.ts`. The renderer uses Playwright's
Chromium: run `bunx playwright install chromium` once on a new machine.

## Publishing

The site reads the favicon and the cover from the SEO settings, not from this folder. After rendering,
push the images and point `seo.favicon` / `seo.image` at them, from the panel (SEO section) or with the
portfolio MCP server: `upload_image_from_url` with the image's raw GitHub URL, then `update_settings`.

## Fonts

`templates/fonts/` has Archivo (variable, wdth and wght axes) and IBM Plex Mono, Latin subset, both
under the SIL Open Font License 1.1.
