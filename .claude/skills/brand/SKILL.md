---
name: brand
description: Change, re-render or publish the site's logo/favicon or Open Graph (link preview) cover. Use when asked to edit, redo or create brand images for hoyasumii.dev.
---

# Brand images

Templates, renderer and outputs live in `packages/brand` (see its README).

1. Edit `packages/brand/templates/logo.html` or `og.html`. Colors and fonts come from
   `templates/tokens.css`, which mirrors `apps/web/src/app/site.css`: keep them in sync, never invent
   colors. New image or size: add a job to `JOBS` in `packages/brand/src/render.ts`.
2. Render with `bun run brand` (or `bun run brand logo` / `bun run brand og`), then open the PNGs in
   `packages/brand/images/` and check them: text fits, nothing is clipped, both themes read well, and the
   logo is still legible at 32 px.
3. Commit and push the templates and the images together.
4. To publish, upload with the portfolio MCP server: `upload_image_from_url` on
   `https://raw.githubusercontent.com/Hoyasumii/Hoyasumii/<commit sha>/packages/brand/images/<file>.png`, then
   `update_settings` on `seo` with `favicon` and/or `image`. Read `seo` first and keep the variant (light or
   dark) the user picked unless they ask for another one.

Link previews cache per URL: after changing the cover, test with a fresh query (`hoyasumii.dev/?v=2`).

The panel has its own cover generator (SEO and article covers, "Gerar capa"): the same layout drawn on a
canvas in `apps/web/src/lib/cover.ts`, with static fonts from `apps/web/public/fonts/`. A layout change in
`og.html` should usually be made there too.
