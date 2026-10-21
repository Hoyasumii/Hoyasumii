import { iconNames, isIconName, resolveIconName } from "@hoyasumii/skill-icons";

export { iconNames, isIconName, resolveIconName };

export const SKILL_ICONS_API = "https://skill-icons.alanreisanjo.workers.dev";

/** Suggested tints, the same palette the Skill Icons builder offers. */
export const TINT_SWATCHES = [
	"ff3b30",
	"ff9500",
	"ffcc00",
	"34c759",
	"00c7be",
	"30b0c7",
	"32ade6",
	"007aff",
	"5856d6",
	"af52de",
	"ff2d55",
	"a2845e",
	"ff8a80",
	"ffb86b",
	"ffe08a",
	"9be59b",
	"5fd3c4",
	"9cc9ff",
	"c3b1ff",
	"f3a6d8",
	"f5a623",
	"c084fc",
	"8e8e93",
	"e5e5ea",
];

/** Accepts `5fd3c4`, `#5FD3C4` or `5fc` and returns 6 lowercase hex digits. */
export function parseTint(raw: string | null | undefined): string | undefined {
	const hex = raw?.trim().replace(/^#/, "").toLowerCase();
	if (!hex) return undefined;
	if (/^[0-9a-f]{6}$/.test(hex)) return hex;
	if (/^[0-9a-f]{3}$/.test(hex)) return [...hex].map((c) => c + c).join("");
	return undefined;
}

/** One icon from the Skill Icons API, which caches and tints it at the edge. */
export function iconUrl(name: string, theme: "dark" | "light", tint?: string): string {
	const query = new URLSearchParams({ i: name, theme });
	if (tint) query.set("tint", tint);
	return `${SKILL_ICONS_API}/icons?${query}`;
}
