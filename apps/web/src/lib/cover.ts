import { type Appearance, defaultAccent } from "@portfolio/shared";

/**
 * Share covers (1200x630) drawn on a canvas in the panel, in the hero's language: the top bar,
 * the name or title in condensed Archivo with the last line in the accent, and mono labels.
 * packages/brand/templates/og.html is the same layout as HTML.
 */

export const COVER_WIDTH = 1200;
export const COVER_HEIGHT = 630;

export type CoverTheme = "light" | "dark";
export type CoverLayout = "profile" | "article";

export type CoverDraft = {
	/** profile: one line per name line, like the hero. article: a title, wrapped to fit. */
	layout: CoverLayout;
	theme: CoverTheme;
	top: { start: string; center: string; end: string };
	headline: string;
	/** profile: stacked at the bottom right. article: one row at the bottom left. */
	meta: string[];
};

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** The site's host, as the top bar and the share previews show it. */
export const siteHost = (process.env.NEXT_PUBLIC_SITE_URL ?? "hoyasumii.dev")
	.replace(/^https?:\/\//, "")
	.replace(/\/$/, "");

/** Paper, ink, muted and rule from site.css; the accent comes from the appearance settings. */
const PALETTE = {
	light: { paper: "#ebe9e3", ink: "#141413", muted: "#75736c", rule: "rgba(20, 20, 19, 0.16)" },
	dark: { paper: "#0e0e0d", ink: "#ecebe5", muted: "#87857d", rule: "rgba(236, 235, 229, 0.14)" },
};

// Static fonts: canvas cannot pick a width on a variable font in every browser.
const DISPLAY = "Archivo Cover";
const MONO = "Plex Mono Cover";

let fontsReady: Promise<unknown> | undefined;

export function loadCoverFonts(): Promise<unknown> {
	fontsReady ??= Promise.all(
		[
			new FontFace(DISPLAY, `url(${base}/fonts/archivo-800-condensed.woff2)`),
			new FontFace(MONO, `url(${base}/fonts/ibm-plex-mono-500.woff2)`),
		].map(async (face) => document.fonts.add(await face.load())),
	).catch((error) => {
		fontsReady = undefined;
		throw error;
	});
	return fontsReady;
}

const GUTTER = 64;
const BAR = 84;
const TOP = BAR + 52;
const BOTTOM = COVER_HEIGHT - 52;
const LABEL = 20;
const META = 22;
const META_LEADING = 34;
const DISPLAY_TRACKING = -0.015;
const LABEL_TRACKING = 0.02;

const upper = (text: string) => text.trim().toLocaleUpperCase("pt-BR");

/** Width of a run with letter spacing, keeping the font's kerning. */
function measure(ctx: CanvasRenderingContext2D, text: string, tracking: number): number {
	const chars = Array.from(text);
	return ctx.measureText(text).width + Math.max(0, chars.length - 1) * tracking;
}

/** Draws a run with letter spacing (ctx.letterSpacing is not everywhere yet), aligned at x. */
function draw(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	tracking: number,
	align: "start" | "center" | "end" = "start",
) {
	const width = measure(ctx, text, tracking);
	const left = align === "end" ? x - width : align === "center" ? x - width / 2 : x;
	const chars = Array.from(text);
	let prefix = "";
	chars.forEach((char, index) => {
		ctx.fillText(char, left + ctx.measureText(prefix).width + index * tracking, y);
		prefix += char;
	});
}

function setDisplay(ctx: CanvasRenderingContext2D, size: number) {
	ctx.font = `${size}px "${DISPLAY}"`;
}

function setMono(ctx: CanvasRenderingContext2D, size: number) {
	ctx.font = `${size}px "${MONO}"`;
}

/** Cap height over font size, measured on the font itself. */
function capRatio(ctx: CanvasRenderingContext2D): number {
	setDisplay(ctx, 100);
	return ctx.measureText("H").actualBoundingBoxAscent / 100;
}

function drawBar(ctx: CanvasRenderingContext2D, draft: CoverDraft, colors: (typeof PALETTE)[CoverTheme]) {
	setMono(ctx, LABEL);
	const y = BAR / 2 + ctx.measureText("H").actualBoundingBoxAscent / 2;
	const tracking = LABEL * LABEL_TRACKING;
	ctx.fillStyle = colors.ink;
	draw(ctx, upper(draft.top.start), GUTTER, y, tracking);
	ctx.fillStyle = colors.muted;
	draw(ctx, upper(draft.top.center), COVER_WIDTH / 2, y, tracking, "center");
	draw(ctx, upper(draft.top.end), COVER_WIDTH - GUTTER, y, tracking, "end");
	ctx.fillStyle = colors.rule;
	ctx.fillRect(0, BAR, COVER_WIDTH, 1.5);
}

/** The hero: every line but the last in ink, the last indented and in the accent; meta at the bottom right. */
function drawProfile(
	ctx: CanvasRenderingContext2D,
	draft: CoverDraft,
	colors: (typeof PALETTE)[CoverTheme],
	accent: string,
) {
	const lines = draft.headline.split("\n").map(upper).filter(Boolean).slice(0, 3);
	const meta = draft.meta.map(upper).filter(Boolean).slice(0, 4);

	setMono(ctx, META);
	const metaTracking = META * LABEL_TRACKING;
	const dot = 26;
	const metaWidth = meta.length > 0 ? Math.max(...meta.map((line) => measure(ctx, line, metaTracking))) + dot : 0;

	if (lines.length > 0) {
		const cap = capRatio(ctx);
		const indentRatio = 96 / 297;
		// The largest size where the lines fit the height, the width, and the last one beside the meta.
		let size = Math.min(297, (BOTTOM - TOP) / (cap + 0.8 * (lines.length - 1)));
		setDisplay(ctx, 100);
		lines.forEach((line, index) => {
			const last = index === lines.length - 1 && lines.length > 1;
			const room = COVER_WIDTH - 2 * GUTTER - (index === lines.length - 1 && metaWidth ? metaWidth + 40 : 0);
			const width = measure(ctx, line, 100 * DISPLAY_TRACKING) / 100 + (last ? indentRatio : 0);
			size = Math.min(size, room / width);
		});

		setDisplay(ctx, size);
		const tracking = size * DISPLAY_TRACKING;
		lines.forEach((line, index) => {
			const last = index === lines.length - 1 && lines.length > 1;
			ctx.fillStyle = last ? accent : colors.ink;
			const baseline = BOTTOM - 0.8 * size * (lines.length - 1 - index);
			draw(ctx, line, GUTTER + (last ? indentRatio * size : 0), baseline, tracking);
		});
	}

	setMono(ctx, META);
	meta.forEach((line, index) => {
		const baseline = BOTTOM - META_LEADING * (meta.length - 1 - index);
		ctx.fillStyle = index === 0 ? colors.ink : colors.muted;
		draw(ctx, line, COVER_WIDTH - GUTTER, baseline, metaTracking, "end");
		if (index === 0) {
			const left = COVER_WIDTH - GUTTER - measure(ctx, line, metaTracking);
			const capHeight = ctx.measureText("H").actualBoundingBoxAscent;
			ctx.fillStyle = accent;
			ctx.beginPath();
			ctx.arc(left - 20, baseline - capHeight / 2, 6, 0, Math.PI * 2);
			ctx.fill();
		}
	});
}

/** Greedy word wrap at the current font. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, tracking: number): string[] {
	const lines: string[] = [];
	let line = "";
	for (const word of text.split(/\s+/).filter(Boolean)) {
		const next = line ? `${line} ${word}` : word;
		if (line && measure(ctx, next, tracking) > width) {
			lines.push(line);
			line = word;
		} else {
			line = next;
		}
	}
	if (line) lines.push(line);
	return lines;
}

/** A title, as large as it fits, the last line in the accent; meta in one row at the bottom left. */
function drawArticle(
	ctx: CanvasRenderingContext2D,
	draft: CoverDraft,
	colors: (typeof PALETTE)[CoverTheme],
	accent: string,
) {
	const title = upper(draft.headline.replace(/\s+/g, " "));
	const meta = draft.meta.map(upper).filter(Boolean).join("  ·  ");
	const width = COVER_WIDTH - 2 * GUTTER;
	const bottom = meta ? BOTTOM - META - 40 : BOTTOM;
	const cap = capRatio(ctx);
	const leading = 0.86;

	if (title) {
		let size = 220;
		let lines: string[] = [];
		for (; size > 48; size -= 4) {
			setDisplay(ctx, size);
			const tracking = size * DISPLAY_TRACKING;
			lines = wrap(ctx, title, width, tracking);
			const fitsWidth = lines.every((line) => measure(ctx, line, tracking) <= width);
			if (fitsWidth && cap * size + leading * size * (lines.length - 1) <= bottom - TOP) break;
		}
		setDisplay(ctx, size);
		lines.forEach((line, index) => {
			ctx.fillStyle = index === lines.length - 1 && lines.length > 1 ? accent : colors.ink;
			draw(ctx, line, GUTTER, TOP + cap * size + leading * size * index, size * DISPLAY_TRACKING);
		});
	}

	if (meta) {
		setMono(ctx, META);
		ctx.fillStyle = colors.muted;
		draw(ctx, meta, GUTTER, BOTTOM, META * LABEL_TRACKING);
	}
}

/** Draws the cover on a 1200x630 canvas. Call loadCoverFonts() first. */
export function drawCover(canvas: HTMLCanvasElement, draft: CoverDraft, appearance: Appearance) {
	canvas.width = COVER_WIDTH;
	canvas.height = COVER_HEIGHT;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	const colors = PALETTE[draft.theme];
	const accent = `#${(appearance.accent ?? defaultAccent)[draft.theme]}`;

	ctx.fillStyle = colors.paper;
	ctx.fillRect(0, 0, COVER_WIDTH, COVER_HEIGHT);
	ctx.textBaseline = "alphabetic";
	drawBar(ctx, draft, colors);
	if (draft.layout === "profile") drawProfile(ctx, draft, colors, accent);
	else drawArticle(ctx, draft, colors, accent);
}

export function coverBlob(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) =>
		canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível gerar a imagem"))), "image/png"),
	);
}
