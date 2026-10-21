import { type Appearance, defaultAccent } from "@portfolio/shared";

export type Theme = "light" | "dark";

/**
 * Resolves the icon tint for one theme: "accent" follows the site's accent color for that theme,
 * a hex color tints every icon the same, and "" keeps their original colors (undefined).
 */
export function tintFor(appearance: Appearance, theme: Theme): string | undefined {
	if (appearance.iconTint === "accent") return (appearance.accent ?? defaultAccent)[theme];
	return appearance.iconTint || undefined;
}

/** Runs before paint so the saved theme never flashes. */
export const themeScript = `try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}`;
