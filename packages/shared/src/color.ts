import { type Appearance, defaultAccent, defaultIconStyles, type Theme } from "./schema";

/** Small color helpers shared by the site, the admin panel and the API. Colors are 6-digit hex, no "#". */

export type Rgb = [number, number, number];

/** The site's paper (background) color in each theme, which the accent must stand out from. */
export const PAPER = { light: "ebe9e3", dark: "0e0e0d" } as const;
/** Ink options for text on top of an accent-colored background. */
export const ACCENT_INK = { light: "ffffff", dark: "0e0e0d" } as const;
/** WCAG minimum for large text and UI parts, which is how the accent is used. */
export const MIN_ACCENT_CONTRAST = 3;

export function hexToRgb(hex: string): Rgb {
	const value = hex.replace(/^#/, "");
	return [0, 2, 4].map((i) => Number.parseInt(value.slice(i, i + 2), 16)) as Rgb;
}

export function rgbToHex([r, g, b]: Rgb): string {
	return [r, g, b]
		.map((channel) =>
			Math.round(Math.min(255, Math.max(0, channel)))
				.toString(16)
				.padStart(2, "0"),
		)
		.join("");
}

function luminance(hex: string): number {
	const [r, g, b] = hexToRgb(hex).map((channel) => {
		const c = channel / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
	const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (light + 0.05) / (dark + 0.05);
}

/** The ink (white or near-black) that reads best on top of `accent`. */
export function inkOn(accent: string): string {
	return contrastRatio(accent, ACCENT_INK.light) >= contrastRatio(accent, ACCENT_INK.dark)
		? ACCENT_INK.light
		: ACCENT_INK.dark;
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
	const [rn, gn, bn] = [r / 255, g / 255, b / 255];
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const l = (max + min) / 2;
	if (max === min) return [0, 0, l];
	const d = max - min;
	const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
	const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
	return [h / 6, s, l];
}

function hslToRgb([h, s, l]: [number, number, number]): Rgb {
	if (s === 0) return [l * 255, l * 255, l * 255];
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	const channel = (t: number) => {
		const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
		if (x < 1 / 6) return p + (q - p) * 6 * x;
		if (x < 1 / 2) return q;
		if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
		return p;
	};
	return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255];
}

/**
 * Suggests the accent for `theme` from a color picked for any theme: same hue, lightness moved in
 * small steps until it reaches the minimum contrast against that theme's paper.
 */
export function accentFor(theme: "light" | "dark", hex: string): string {
	const [h, s, l0] = rgbToHsl(hexToRgb(hex));
	const step = theme === "dark" ? 0.02 : -0.02;
	let l = l0;
	let candidate = hex.replace(/^#/, "").toLowerCase();
	for (let i = 0; i < 50 && contrastRatio(candidate, PAPER[theme]) < MIN_ACCENT_CONTRAST + 0.5; i++) {
		l = Math.min(0.95, Math.max(0.05, l + step));
		candidate = rgbToHex(hslToRgb([h, s, l]));
	}
	return candidate;
}

/** The Skill Icons variant and tint to draw in one theme of the site (tint undefined: original colors). */
export function iconLook(appearance: Appearance, theme: Theme): { variant: Theme; tint?: string } {
	const style = appearance.icons?.[theme] ?? defaultIconStyles[theme];
	const accent = appearance.accent ?? defaultAccent;
	const tint = style.tint === "accent" ? accent[theme] : style.tint || undefined;
	return { variant: style.variant, tint };
}
