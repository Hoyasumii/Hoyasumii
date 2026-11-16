import { SKILL_ICONS_API } from "./icons";

/** One entry of the Skill Icons catalog (`/icons.json` on the Worker). */
export type CatalogIcon = {
	/** Canonical name, the one `/icons?i=` and the site store. */
	id: string;
	/** Display name, e.g. "Node.js". */
	name: string;
	category: string;
	/** Short names the Worker also accepts, e.g. "ts" for "typescript". */
	aliases: string[];
};

export type IconCatalog = {
	icons: CatalogIcon[];
	/** Every id, alias and display name, normalized, pointing at its icon. */
	lookup: Map<string, CatalogIcon>;
	/**
	 * Whether the catalog lists aliases. Older Workers served it without them; a name missing from
	 * such a catalog may still be a valid alias, so callers shouldn't treat it as unknown.
	 */
	complete: boolean;
};

const normalize = (raw: string) => raw.trim().toLowerCase();

function buildCatalog(icons: CatalogIcon[], complete: boolean): IconCatalog {
	const lookup = new Map<string, CatalogIcon>();
	for (const icon of icons) {
		for (const key of [icon.name, ...icon.aliases, icon.id]) lookup.set(normalize(key), icon);
	}
	// Ids win over a display name or alias that happens to match another icon's id.
	for (const icon of icons) lookup.set(icon.id, icon);
	return { icons, lookup, complete };
}

let catalogPromise: Promise<IconCatalog | null> | undefined;

/**
 * The icon list straight from the Worker, so a new icon shows up without updating any package.
 * Fetched once per build or page load; resolves to null when the Worker can't be reached, and
 * callers then pass names through and let the Worker resolve them.
 */
export function loadIconCatalog(): Promise<IconCatalog | null> {
	catalogPromise ??= fetch(`${SKILL_ICONS_API}/icons.json`, { cache: "force-cache" })
		.then((res) => {
			if (!res.ok) throw new Error(`Skill Icons catalog: HTTP ${res.status}`);
			return res.json() as Promise<Partial<CatalogIcon>[]>;
		})
		.then((entries) =>
			buildCatalog(
				entries
					.filter((entry): entry is Partial<CatalogIcon> & { id: string } => typeof entry.id === "string")
					.map((entry) => ({
						id: entry.id,
						name: entry.name ?? entry.id,
						category: entry.category ?? "",
						aliases: entry.aliases ?? [],
					})),
				entries.some((entry) => Array.isArray(entry.aliases)),
			),
		)
		.catch((error: unknown) => {
			console.warn(error);
			catalogPromise = undefined;
			return null;
		});
	return catalogPromise;
}

/** Names a complete catalog doesn't know. */
export function unknownIcons(catalog: IconCatalog, names: string[]): string[] {
	return catalog.complete ? names.filter((name) => !resolveIcon(catalog, name)) : [];
}

/** The icon an id, alias or display name ("ts", "Node.js") points at. */
export function resolveIcon(catalog: IconCatalog, raw: string): CatalogIcon | undefined {
	return catalog.lookup.get(normalize(raw));
}

/** Up to `limit` icons matching the query, those starting with it first. */
export function searchIcons(catalog: IconCatalog, query: string, limit: number): CatalogIcon[] {
	const q = normalize(query);
	if (!q) return [];
	const rank = (icon: CatalogIcon) => {
		const keys = [icon.id, normalize(icon.name), ...icon.aliases];
		if (keys.includes(q)) return 0;
		if (keys.some((key) => key.startsWith(q))) return 1;
		return keys.some((key) => key.includes(q)) ? 2 : -1;
	};
	return catalog.icons
		.map((icon) => ({ icon, rank: rank(icon) }))
		.filter((match) => match.rank >= 0)
		.sort((a, b) => a.rank - b.rank || a.icon.id.length - b.icon.id.length)
		.slice(0, limit)
		.map((match) => match.icon);
}
