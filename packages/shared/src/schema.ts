import { z } from "zod";

export const locales = ["pt", "en"] as const;
export const localeSchema = z.enum(locales);
export type Locale = z.infer<typeof localeSchema>;

export const localized = z.object({
	pt: z.string(),
	en: z.string(),
});
export type Localized = z.infer<typeof localized>;

const optionalUrl = z.union([z.literal(""), z.url()]);
const iconName = z.string().trim().min(1).max(64);
/**
 * How Skill Icons are colored: "accent" follows the site's accent color in each theme, a hex
 * color without "#" tints them all the same, and an empty string keeps their original colors.
 */
export const tintSchema = z.union([z.literal("accent"), z.string().regex(/^([0-9a-f]{6})?$/)]);

/* ----------------------------------------------------------------------------
 * Settings: single documents, edited as a whole.
 * ------------------------------------------------------------------------- */

export const profileSchema = z.object({
	name: z.string().min(1),
	handle: z.string(),
	role: localized,
	location: z.string(),
	timeZone: z.string().min(1),
	headline: localized,
	about: localized,
	avatar: optionalUrl,
	email: z.email(),
	available: z.boolean(),
	availability: localized,
});

export const seoSchema = z.object({
	title: z.string(),
	description: localized,
});

const hexColor = z.string().regex(/^[0-9a-f]{6}$/, "Use 6 hex digits without #");

/** The site's accent color in each theme (hex, no "#"). */
export const defaultAccent = { light: "d4441c", dark: "ff6a3d" };

export const themes = ["light", "dark"] as const;
export type Theme = (typeof themes)[number];

/** How Skill Icons look in one theme of the site. */
export const iconStyleSchema = z.object({
	/** Which Skill Icons variant to draw: its light or dark tile. */
	variant: z.enum(themes),
	/** "accent" (this theme's accent color), a hex color, or "" for the original colors. */
	tint: tintSchema,
});
export type IconStyle = z.infer<typeof iconStyleSchema>;

export const defaultIconStyles: Record<Theme, IconStyle> = {
	light: { variant: "light", tint: "accent" },
	dark: { variant: "dark", tint: "accent" },
};

export const appearanceSchema = z.object({
	/** Accent color, per theme: headings, numbers, links and buttons. */
	accent: z.object({ light: hexColor, dark: hexColor }).default(defaultAccent),
	/** Skill Icons style per theme of the site. */
	icons: z.object({ light: iconStyleSchema, dark: iconStyleSchema }).default(defaultIconStyles),
});

export const settingsSchemas = {
	profile: profileSchema,
	seo: seoSchema,
	appearance: appearanceSchema,
} as const;

export type SettingsKey = keyof typeof settingsSchemas;
/**
 * Appearance documents saved before per-theme icon styles had one `iconTint` for both themes, with
 * each theme drawing its own variant. Keep that look.
 */
function migrateAppearance(value: unknown): unknown {
	if (typeof value !== "object" || value === null || "icons" in value || !("iconTint" in value)) return value;
	const { iconTint, ...rest } = value as { iconTint: unknown };
	return {
		...rest,
		icons: { light: { variant: "light", tint: iconTint }, dark: { variant: "dark", tint: iconTint } },
	};
}

/**
 * Fills fields added after a settings document was saved (like `appearance.accent`) with their
 * defaults. A document that no longer matches the schema is returned as stored.
 */
export function normalizeSettings<K extends SettingsKey>(key: K, value: unknown): Settings[K] {
	const parsed = settingsSchemas[key].safeParse(key === "appearance" ? migrateAppearance(value) : value);
	return (parsed.success ? parsed.data : value) as Settings[K];
}

export const settingsKeys = Object.keys(settingsSchemas) as SettingsKey[];
export type Settings = { [K in SettingsKey]: z.infer<(typeof settingsSchemas)[K]> };
export type Profile = Settings["profile"];
export type Seo = Settings["seo"];
export type Appearance = Settings["appearance"];

/* ----------------------------------------------------------------------------
 * Collections: ordered lists of entries, edited one entry at a time.
 * ------------------------------------------------------------------------- */

export const projectInput = z.object({
	name: z.string().min(1),
	kind: localized,
	year: z.string(),
	summary: localized,
	cover: optionalUrl,
	stack: z.array(iconName),
	featured: z.boolean(),
	published: z.boolean(),
	links: z.object({
		repo: optionalUrl,
		site: optionalUrl,
		docs: optionalUrl,
		npm: optionalUrl,
	}),
	/** Sub-packages or modules, rendered as a tree under the project. */
	parts: z.array(
		z.object({
			name: z.string().min(1),
			description: localized,
			url: optionalUrl,
		}),
	),
});

export const experienceInput = z.object({
	company: z.string().min(1),
	role: localized,
	start: z.string(),
	/** Empty means "present". */
	end: z.string(),
	description: localized,
});

export const stackGroupInput = z.object({
	title: localized,
	icons: z.array(iconName),
});

export const linkInput = z.object({
	label: z.string().min(1),
	url: z.string().min(1),
});

export const slugSchema = z
	.string()
	.min(1)
	.max(120)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens");

export const articleInput = z.object({
	title: z.string().min(1),
	slug: slugSchema,
	lang: localeSchema,
	excerpt: z.string(),
	/** Markdown. */
	body: z.string(),
	cover: optionalUrl,
	tags: z.array(z.string().trim().min(1).max(32)).max(8),
	/** ISO date (YYYY-MM-DD). */
	publishedAt: z.iso.date(),
	published: z.boolean(),
});

export const collectionSchemas = {
	projects: projectInput,
	experience: experienceInput,
	stack: stackGroupInput,
	links: linkInput,
	articles: articleInput,
} as const;

export type CollectionName = keyof typeof collectionSchemas;
export const collectionNames = Object.keys(collectionSchemas) as CollectionName[];
export type CollectionInput<N extends CollectionName> = z.infer<(typeof collectionSchemas)[N]>;

/** What the API stores and returns for every collection entry. */
export type Entry<T> = T & { id: string; position: number };

export type Project = Entry<z.infer<typeof projectInput>>;
export type Experience = Entry<z.infer<typeof experienceInput>>;
export type StackGroup = Entry<z.infer<typeof stackGroupInput>>;
export type Link = Entry<z.infer<typeof linkInput>>;
export type SiteArticle = Entry<z.infer<typeof articleInput>>;

export type Collections = { [N in CollectionName]: Entry<CollectionInput<N>>[] };

export const reorderSchema = z.object({
	ids: z.array(z.string().min(1)).min(1),
});

/* ----------------------------------------------------------------------------
 * Public content: everything the website renders, in one response.
 * ------------------------------------------------------------------------- */

/** Articles are served on their own (see /articles), so their bodies stay out of this document. */
export type ContentCollectionName = Exclude<CollectionName, "articles">;
export const contentCollectionNames = collectionNames.filter(
	(name): name is ContentCollectionName => name !== "articles",
);

export type Content = Settings & Pick<Collections, ContentCollectionName> & { updatedAt: string | null };

/* ----------------------------------------------------------------------------
 * Articles: written in the admin panel ("site") or mirrored from dev.to ("devto").
 * ------------------------------------------------------------------------- */

export type ArticleSource = "site" | "devto";

export type ArticleSummary = {
	slug: string;
	source: ArticleSource;
	title: string;
	excerpt: string;
	lang: string;
	publishedAt: string;
	readingMinutes: number;
	tags: string[];
	cover: string | null;
	/** Original address for dev.to articles; null for the site's own. */
	externalUrl: string | null;
};

export type Article = ArticleSummary & ({ format: "markdown"; body: string } | { format: "html"; body: string });

/* ----------------------------------------------------------------------------
 * API keys: let scripts and AI agents (through the MCP server) edit the site.
 * ------------------------------------------------------------------------- */

export const apiKeyScopes = ["read", "write"] as const;
export type ApiKeyScope = (typeof apiKeyScopes)[number];

export const apiKeyCreateSchema = z.object({
	name: z.string().trim().min(1).max(60),
	scope: z.enum(apiKeyScopes),
});
export type ApiKeyCreate = z.infer<typeof apiKeyCreateSchema>;

/** What the API returns about a key; the key itself is only shown once, on creation. */
export type ApiKey = {
	id: string;
	name: string;
	/** First characters of the key, to tell keys apart. */
	prefix: string;
	scope: ApiKeyScope;
	createdAt: string;
	lastUsedAt: string | null;
	revokedAt: string | null;
};

export type CreatedApiKey = { apiKey: ApiKey; key: string };

/** An app authorized through OAuth to use the MCP server (e.g. the claude.ai connector). */
export type OAuthConnection = {
	id: string;
	clientName: string;
	scope: ApiKeyScope;
	/** Where its tokens are sent, e.g. claude.ai. */
	redirectHost: string | null;
	createdAt: string;
};
