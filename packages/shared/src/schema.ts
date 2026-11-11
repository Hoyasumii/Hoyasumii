import {
	BooleanProperty,
	DateProperty,
	Email,
	enumOf,
	listOf,
	optionalOf,
	blueprintOf as plainBlueprintOf,
	propertyOf,
	type StandardSchemaV1,
	StringProperty,
	Text,
} from "@afora/core";
import { Type } from "typebox";

/*
 * Every schema here is an @afora/core blueprint: it validates and normalizes a value, rejects keys it
 * does not declare and implements Standard Schema V1, so any validator that takes one takes it.
 * `safeParse(value)` returns `{ value }` or `{ issues }` and never throws.
 */

/** The value a schema gives back once it accepted an input. */
export type Infer<Schema extends StandardSchemaV1> = Mutable<StandardSchemaV1.InferOutput<Schema>>;
type Mutable<T> = T extends readonly (infer Item)[]
	? Mutable<Item>[]
	: T extends object
		? { -readonly [Key in keyof T]: Mutable<T[Key]> }
		: T;

/** One problem with a value, as the API reports it: where, what kind and what to fix. */
export type SchemaIssue = { path: (string | number)[]; code: string; message: string };

/** A string property that also passes `test`, failing with `message` (the panel shows it as is). */
function checkedString(
	name: string,
	test: (value: string) => boolean,
	message: string,
	{ min, max, trim = false }: { min?: number; max?: number; trim?: boolean } = {},
) {
	return propertyOf({
		name,
		schema: Type.String({ minLength: min, maxLength: max }),
		preHandle: trim ? (value) => value.trim() : undefined,
		afterHandle: (value) => {
			if (!test(value)) throw new Error(message);
			return value;
		},
	});
}

function isUrl(value: string): boolean {
	try {
		return new URL(value).host !== "" || value.startsWith("mailto:");
	} catch {
		return false;
	}
}

export const locales = ["pt", "en"] as const;
export const localeSchema = enumOf(locales, { name: "locale" });
export type Locale = (typeof locales)[number];

export const localized = plainBlueprintOf((ctx) => ({
	pt: ctx.string,
	en: ctx.string,
}));
export type Localized = Infer<typeof localized>;

const optionalUrl = checkedString(
	"optionalUrl",
	(value) => value === "" || isUrl(value),
	"Use a full URL or leave it empty",
	{
		max: 2048,
	},
);
const iconName = Text.with({ max: 64 });
const required = StringProperty.with({ min: 1 });
/**
 * How Skill Icons are colored: "accent" follows the site's accent color in each theme, a hex
 * color without "#" tints them all the same, and an empty string keeps their original colors.
 */
export const tintSchema = checkedString(
	"tint",
	(value) => /^(accent|[0-9a-f]{6})?$/.test(value),
	'Use "accent", 6 hex digits without # or leave it empty',
);

/* ----------------------------------------------------------------------------
 * Settings: single documents, edited as a whole.
 * ------------------------------------------------------------------------- */

export const profileSchema = plainBlueprintOf((ctx) => ({
	name: required,
	handle: ctx.string,
	role: localized,
	location: ctx.string,
	timeZone: required,
	headline: localized,
	about: localized,
	avatar: optionalUrl,
	email: Email,
	available: ctx.boolean,
	availability: localized,
}));

export const seoSchema = plainBlueprintOf((ctx) => ({
	title: ctx.string,
	description: localized,
	/** Browser tab icon. Empty keeps the site's built-in favicon. Defaults to "". */
	favicon: optionalOf(optionalUrl),
	/** Cover shown when a link to the site is shared (Open Graph and X cards); 1200×630 works best. Defaults to "". */
	image: optionalOf(optionalUrl),
	/** Defaults to []. */
	keywords: optionalOf(listOf(Text.with({ max: 40 }), { maxItems: 20 })),
	/** X (Twitter) handle, without "@". Defaults to "". */
	twitter: optionalOf(
		checkedString("twitter", (value) => /^[A-Za-z0-9_]{0,15}$/.test(value), "Use the handle without @"),
	),
}));

const hexColor = checkedString("hexColor", (value) => /^[0-9a-f]{6}$/.test(value), "Use 6 hex digits without #");

/** The site's accent color in each theme (hex, no "#"). */
export const defaultAccent = { light: "d4441c", dark: "ff6a3d" };

export const themes = ["light", "dark"] as const;
export type Theme = (typeof themes)[number];

/** How Skill Icons look in one theme of the site. */
export const iconStyleSchema = plainBlueprintOf(() => ({
	/** Which Skill Icons variant to draw: its light or dark tile. */
	variant: enumOf(themes, { name: "theme" }),
	/** "accent" (this theme's accent color), a hex color, or "" for the original colors. */
	tint: tintSchema,
}));
export type IconStyle = Infer<typeof iconStyleSchema>;

export const defaultIconStyles: Record<Theme, IconStyle> = {
	light: { variant: "light", tint: "accent" },
	dark: { variant: "dark", tint: "accent" },
};

export const appearanceSchema = plainBlueprintOf(() => ({
	/** Accent color, per theme: headings, numbers, links and buttons. Defaults to defaultAccent. */
	accent: optionalOf(plainBlueprintOf(() => ({ light: hexColor, dark: hexColor }))),
	/** Skill Icons style per theme of the site. Defaults to defaultIconStyles. */
	icons: optionalOf(plainBlueprintOf(() => ({ light: iconStyleSchema, dark: iconStyleSchema }))),
}));

const devtoPage = /^https?:\/\/(?:www\.)?dev\.to\/([A-Za-z0-9_]+)\/?$/;

/**
 * Whether the site lists the author's dev.to articles, and whose. Turning it on needs the page: see
 * {@link settingsIssues}, which the API checks on top of this schema.
 */
export const devtoSchema = plainBlueprintOf((ctx) => ({
	enabled: ctx.boolean,
	/** Profile page, e.g. https://dev.to/username. */
	url: checkedString(
		"devtoPage",
		(value) => value === "" || devtoPage.test(value),
		"Use the profile page, e.g. https://dev.to/username",
		{ trim: true },
	),
}));

/** The dev.to username whose articles the site lists, or null when dev.to is off. */
export function devtoUsername(devto: Pick<Infer<typeof devtoSchema>, "enabled" | "url">): string | null {
	if (!devto.enabled) return null;
	return devtoPage.exec(devto.url.trim())?.[1] ?? null;
}

export const settingsSchemas = {
	profile: profileSchema,
	seo: seoSchema,
	appearance: appearanceSchema,
	devto: devtoSchema,
} as const;

export type SettingsKey = keyof typeof settingsSchemas;

/** `T` with the keys `K`, optional in the schema, always set (to their defaults). */
type Defaulted<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: Exclude<T[P], undefined> };

export type Settings = {
	profile: Infer<typeof profileSchema>;
	seo: Defaulted<Infer<typeof seoSchema>, "favicon" | "image" | "keywords" | "twitter">;
	appearance: Defaulted<Infer<typeof appearanceSchema>, "accent" | "icons">;
	devto: Infer<typeof devtoSchema>;
};
export type Profile = Settings["profile"];
export type Seo = Settings["seo"];
export type Appearance = Settings["appearance"];
export type DevTo = Settings["devto"];

/** Values of the fields a settings document may leave out. */
function settingsDefaults(key: SettingsKey): Record<string, unknown> {
	switch (key) {
		case "seo":
			return { favicon: "", image: "", keywords: [], twitter: "" };
		case "appearance":
			return { accent: structuredClone(defaultAccent), icons: structuredClone(defaultIconStyles) };
		default:
			return {};
	}
}

/** Checks a schema cannot express: dev.to needs its page to be turned on. */
export function settingsIssues<K extends SettingsKey>(
	key: K,
	value: Settings[K] | Infer<(typeof settingsSchemas)[K]>,
): SchemaIssue[] {
	if (key === "devto") {
		const devto = value as DevTo;
		if (devto.enabled && devto.url === "") {
			return [{ path: ["url"], code: "invalid_value", message: "Set the dev.to page to show its articles" }];
		}
	}
	return [];
}

/**
 * Validates a settings document and fills the fields it left out with their defaults: `{ value }`,
 * or `{ issues }` with every problem.
 */
export function parseSettings<K extends SettingsKey>(
	key: K,
	input: unknown,
): { value: Settings[K]; issues?: undefined } | { value?: undefined; issues: SchemaIssue[] } {
	const parsed = settingsSchemas[key].safeParse(input);
	if (parsed.issues) {
		return {
			issues: parsed.issues.map(({ path, code, message }) => ({
				path: [...path],
				code,
				message: message.replace(/^Invalid value for property "[^"]*": /, ""),
			})),
		};
	}
	const defined = Object.fromEntries(Object.entries(parsed.value as object).filter(([, field]) => field !== undefined));
	const value = structuredClone({ ...settingsDefaults(key), ...defined }) as Settings[K];
	const issues = settingsIssues(key, value);
	return issues.length > 0 ? { issues } : { value };
}

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
	const parsed = parseSettings(key, key === "appearance" ? migrateAppearance(value) : value);
	return (parsed.issues ? value : parsed.value) as Settings[K];
}

export const settingsKeys = Object.keys(settingsSchemas) as SettingsKey[];

/* ----------------------------------------------------------------------------
 * Collections: ordered lists of entries, edited one entry at a time.
 * ------------------------------------------------------------------------- */

export const projectInput = plainBlueprintOf((ctx) => ({
	name: required,
	kind: localized,
	year: ctx.string,
	summary: localized,
	cover: optionalUrl,
	stack: listOf(iconName),
	featured: ctx.boolean,
	published: ctx.boolean,
	links: plainBlueprintOf(() => ({
		repo: optionalUrl,
		site: optionalUrl,
		docs: optionalUrl,
		npm: optionalUrl,
	})),
	/** Sub-packages or modules, rendered as a tree under the project. */
	parts: listOf(
		plainBlueprintOf(() => ({
			name: required,
			description: localized,
			url: optionalUrl,
		})),
	),
}));

export const experienceInput = plainBlueprintOf((ctx) => ({
	company: required,
	role: localized,
	start: ctx.string,
	/** Empty means "present". */
	end: ctx.string,
	description: localized,
}));

export const stackGroupInput = plainBlueprintOf(() => ({
	title: localized,
	icons: listOf(iconName),
}));

export const linkInput = plainBlueprintOf(() => ({
	label: required,
	url: required,
}));

export const slugSchema = checkedString(
	"slug",
	(value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
	"Use lowercase letters, numbers and hyphens",
	{ min: 1, max: 120 },
);

export const articleInput = plainBlueprintOf((ctx) => ({
	title: required,
	slug: slugSchema,
	lang: localeSchema,
	excerpt: ctx.string,
	/** Markdown. */
	body: ctx.string,
	cover: optionalUrl,
	tags: listOf(Text.with({ max: 32 }), { maxItems: 8 }),
	/** ISO date (YYYY-MM-DD). */
	publishedAt: DateProperty,
	published: ctx.boolean,
}));

export const releaseKinds = ["launch", "feature"] as const;
export type ReleaseKind = (typeof releaseKinds)[number];

/**
 * Release notes: a new project ("launch") or something new in one ("feature"). They have their own
 * page and show in the site's "news" panel, never in the articles list, and can go out as a push
 * notification to whoever subscribed in the browser.
 */
export const releaseInput = plainBlueprintOf((ctx) => ({
	/** What was released, usually the project's name ("Skill Icons"). */
	title: Text.with({ max: 80 }),
	/** Optional version shown after the title ("26.10.3"). */
	version: propertyOf({ name: "version", schema: Type.String({ maxLength: 32 }), preHandle: (value) => value.trim() }),
	kind: enumOf(releaseKinds, { name: "releaseKind" }),
	/** Id of the entry in `projects` this is about; empty when it is about none. */
	project: ctx.string,
	slug: slugSchema,
	/** One or two sentences: shown in the news panel and as the notification text. */
	summary: localized,
	/** Markdown, one text per language. */
	body: localized,
	cover: optionalUrl,
	/** ISO date (YYYY-MM-DD). */
	publishedAt: DateProperty,
	published: BooleanProperty,
	/** Sends a push notification to subscribers once the release is live on the site. */
	notify: BooleanProperty,
}));

export const collectionSchemas = {
	projects: projectInput,
	experience: experienceInput,
	stack: stackGroupInput,
	links: linkInput,
	articles: articleInput,
	releases: releaseInput,
} as const;

export type CollectionName = keyof typeof collectionSchemas;
export const collectionNames = Object.keys(collectionSchemas) as CollectionName[];
export type CollectionInput<N extends CollectionName> = Infer<(typeof collectionSchemas)[N]>;

/** What the API stores and returns for every collection entry. */
export type Entry<T> = T & { id: string; position: number };

export type Project = Entry<Infer<typeof projectInput>>;
export type Experience = Entry<Infer<typeof experienceInput>>;
export type StackGroup = Entry<Infer<typeof stackGroupInput>>;
export type Link = Entry<Infer<typeof linkInput>>;
export type SiteArticle = Entry<Infer<typeof articleInput>>;
export type Release = Entry<Infer<typeof releaseInput>>;

/** How a release is named everywhere: "Skill Icons 26.10.3". */
export function releaseName(release: Pick<Release, "title" | "version">): string {
	return [release.title, release.version].filter(Boolean).join(" ");
}

export type Collections = { [N in CollectionName]: Entry<CollectionInput<N>>[] };

export const reorderSchema = plainBlueprintOf(() => ({
	ids: listOf(required, { minItems: 1 }),
}));

/* ----------------------------------------------------------------------------
 * Public content: everything the website renders, in one response.
 * ------------------------------------------------------------------------- */

/**
 * Articles and releases are served on their own (see /articles and /releases), so their bodies stay
 * out of this document.
 */
export type ContentCollectionName = Exclude<CollectionName, "articles" | "releases">;
export const contentCollectionNames = collectionNames.filter(
	(name): name is ContentCollectionName => name !== "articles" && name !== "releases",
);

/** Collections whose entries have a page of their own, so their slugs must be unique. */
export const sluggedCollections: CollectionName[] = ["articles", "releases"];

export type Content = Settings & Pick<Collections, ContentCollectionName> & { updatedAt: string | null };

/**
 * Version of the Content shape. Bump it whenever settings or collections change shape: cached
 * copies (Upstash) are keyed by it, so a deploy never serves a document in the old shape.
 */
export const CONTENT_VERSION = 5;

/** Brings every settings document of a Content to the current shape (see normalizeSettings). */
export function normalizeContent(content: Content): Content {
	return {
		...content,
		profile: normalizeSettings("profile", content.profile),
		seo: normalizeSettings("seo", content.seo),
		appearance: normalizeSettings("appearance", content.appearance),
		devto: normalizeSettings("devto", content.devto),
	};
}

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

export const apiKeyCreateSchema = plainBlueprintOf(() => ({
	name: Text.with({ max: 60 }),
	scope: enumOf(apiKeyScopes, { name: "apiKeyScope" }),
}));
export type ApiKeyCreate = Infer<typeof apiKeyCreateSchema>;

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

/** The MCP server of the deployed API. */
export type McpServer = { url: string };

/* ----------------------------------------------------------------------------
 * Web Push: visitors subscribe in the browser and get a notification for each new release.
 * ------------------------------------------------------------------------- */

const base64url = "^[A-Za-z0-9_-]+={0,2}$";

const pushEndpoint = checkedString(
	"pushEndpoint",
	(value) => {
		try {
			return new URL(value).protocol === "https:";
		} catch {
			return false;
		}
	},
	"Use an https:// URL",
	{ max: 2048 },
);

/** What a browser's PushSubscription.toJSON() gives, plus the language to notify in. */
export const pushSubscriptionSchema = plainBlueprintOf(() => ({
	endpoint: pushEndpoint,
	keys: plainBlueprintOf(() => ({
		p256dh: StringProperty.with({ pattern: base64url, max: 256 }),
		auth: StringProperty.with({ pattern: base64url, max: 64 }),
	})),
	locale: localeSchema,
}));
export type PushSubscriptionInput = Infer<typeof pushSubscriptionSchema>;

export const pushUnsubscribeSchema = plainBlueprintOf(() => ({ endpoint: pushEndpoint }));

/** The VAPID public key browsers subscribe with; null while push is not configured. */
export type PushKey = { publicKey: string | null };

/** What a release notification carries; the service worker turns it into a notification. */
export type PushMessage = { title: string; body: string; url: string; tag: string; icon?: string };

export type PushStatus = {
	enabled: boolean;
	subscribers: number;
	/** Published releases with `notify` on that were not sent yet. */
	pending: { id: string; title: string; slug: string }[];
};

export type PushReport = {
	sent: { id: string; slug: string; recipients: number; failed: number }[];
	/** Releases not on the site yet (its page answered 404): they go out on the next run. */
	waiting: string[];
	/** Releases too old to notify about, marked as handled without sending. */
	skipped: string[];
	/** Subscriptions the push service said are gone, now deleted. */
	removed: number;
};
