export type Theme = "light" | "dark";

/** The saved theme, else the system's. Keep in sync with themeScript, which inlines the same logic. */
export function applySavedTheme() {
	const root = document.documentElement;
	try {
		const saved = localStorage.getItem("theme");
		root.dataset.theme =
			saved === "light" || saved === "dark"
				? saved
				: matchMedia("(prefers-color-scheme: light)").matches
					? "light"
					: "dark";
	} catch {
		root.dataset.theme = "dark";
	}
}

/** Runs before paint so the saved theme never flashes. */
export const themeScript = `try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}`;
