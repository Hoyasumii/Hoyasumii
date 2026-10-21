export type Theme = "light" | "dark";

/** The accent color of each theme, without "#". Keep in sync with --accent in site.css. */
export const ACCENT: Record<Theme, string> = {
	light: "d4441c",
	dark: "ff6a3d",
};

/** Resolves the appearance setting to the tint for one theme (undefined keeps original colors). */
export function tintFor(setting: string, theme: Theme): string | undefined {
	if (setting === "accent") return ACCENT[theme];
	return setting || undefined;
}

/** Runs before paint so the saved theme never flashes. */
export const themeScript = `try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}`;
