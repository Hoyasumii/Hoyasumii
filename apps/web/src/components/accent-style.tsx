import { type Appearance, defaultAccent, inkOn } from "@portfolio/shared";

/**
 * The accent color chosen in the admin panel, as the CSS variables site.css uses. `html:root` wins
 * over the stylesheet's `:root` defaults whatever order the browser loads them in.
 */
export function accentCss(accent: Appearance["accent"] = defaultAccent): string {
	return `html:root{--accent:#${accent.light};--accent-ink:#${inkOn(accent.light)}}html:root[data-theme="dark"]{--accent:#${accent.dark};--accent-ink:#${inkOn(accent.dark)}}`;
}

export function AccentStyle({ accent }: { accent?: Appearance["accent"] }) {
	// biome-ignore lint/security/noDangerouslySetInnerHtml: validated 6-digit hex colors only
	return <style dangerouslySetInnerHTML={{ __html: accentCss(accent) }} />;
}
