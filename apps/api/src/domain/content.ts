import {
	type Article,
	type ArticleSummary,
	type CollectionInput,
	type CollectionName,
	type Content,
	contentCollectionNames,
	defaultSettings,
	devtoUsername,
	type Entry,
	normalizeSettings,
	type Release,
	type Settings,
	type SettingsKey,
	type SiteArticle,
	settingsKeys,
} from "@portfolio/shared";
import { cacheKeys, remember } from "../cache/cache";
import { collectionEntities } from "./entities";
import { EntryNotFound } from "./exceptions";
import { collectionRepositories, SettingsDocuments } from "./repositories";
import type { Services } from "./services";

const CONTENT_TTL_SECONDS = 60 * 60;
const SITE_TTL_SECONDS = 60 * 60;
const RELEASES_TTL_SECONDS = 60 * 60;
const DEVTO_LIST_TTL_SECONDS = 30 * 60;
const DEVTO_ARTICLE_TTL_SECONDS = 6 * 60 * 60;
const DEVTO_API = "https://dev.to/api";
const WORDS_PER_MINUTE = 220;

/* ----------------------------------------------------------------------------
 * Entries: every collection is an entity with the same few operations.
 * ------------------------------------------------------------------------- */

type AnyEntity = { readonly id: string; toJSON(): Record<string, unknown> };
/** The repository of any collection, seen through the operations they all share. */
export type EntryRepository = {
	findById(id: string): Promise<AnyEntity | undefined>;
	findMany(query?: object): Promise<AnyEntity[]>;
	create(entity: AnyEntity): Promise<AnyEntity>;
	update(entity: AnyEntity): Promise<AnyEntity>;
	delete(entity: AnyEntity): Promise<unknown>;
};
type EntityClass = new (value: Record<string, unknown>) => AnyEntity;

export const repositoryOf = (name: CollectionName) => collectionRepositories[name] as unknown as EntryRepository;
export const entityClassOf = (name: CollectionName) => collectionEntities[name] as unknown as EntityClass;

/** What the API returns for an entry: its fields, id and position; timestamps stay internal. */
export function entryOf<N extends CollectionName>(entity: AnyEntity): Entry<CollectionInput<N>> {
	const { createdAt: _createdAt, updatedAt: _updatedAt, deletedAt: _deletedAt, ...entry } = entity.toJSON();
	return entry as Entry<CollectionInput<N>>;
}

/** Entries in display order (position, then creation). */
export async function listEntities(name: CollectionName): Promise<AnyEntity[]> {
	return repositoryOf(name).findMany({
		orderBy: [
			{ key: "position", direction: "asc" },
			{ key: "createdAt", direction: "asc" },
		],
	});
}

export async function listEntries<N extends CollectionName>(name: N): Promise<Entry<CollectionInput<N>>[]> {
	return (await listEntities(name)).map((entity) => entryOf<N>(entity));
}

export async function findEntity(name: CollectionName, id: string): Promise<AnyEntity> {
	const entity = await repositoryOf(name).findById(id);
	if (!entity) throw new EntryNotFound({ source: name, details: { what: "Entry" } });
	return entity;
}

/** Latest change, as an ISO string: entities carry it themselves. */
function latestChange(entities: AnyEntity[]): string | null {
	const dates = entities.map((entity) => {
		const { createdAt, updatedAt } = entity.toJSON() as { createdAt: string; updatedAt?: string };
		return updatedAt ?? createdAt;
	});
	return dates.sort().at(-1) ?? null;
}

/* ----------------------------------------------------------------------------
 * Settings
 * ------------------------------------------------------------------------- */

/** A stored settings document brought to the current shape, or null when it was never saved. */
export async function storedSettings<K extends SettingsKey>(key: K): Promise<Settings[K] | null> {
	const document = await SettingsDocuments.findById(key);
	return document ? normalizeSettings(key, document.value) : null;
}

/* ----------------------------------------------------------------------------
 * Public content: served from the cache and rebuilt after any change.
 * ------------------------------------------------------------------------- */

async function buildContent(): Promise<Content> {
	const [documents, ...collections] = await Promise.all([
		SettingsDocuments.findMany(),
		...(["projects", "experience", "stack", "links", "articles", "releases"] as const).map(
			async (name) => [name, await listEntities(name)] as const,
		),
	]);
	const stored = new Map(documents.map((document) => [document.id, document.value]));
	const settings = Object.fromEntries(
		settingsKeys.map((key) => [key, stored.has(key) ? normalizeSettings(key, stored.get(key)) : defaultSettings[key]]),
	);
	const shown = collections.filter(([name]) => (contentCollectionNames as string[]).includes(name));

	const content = {
		...settings,
		...Object.fromEntries(shown.map(([name, entities]) => [name, entities.map((entity) => entryOf(entity))])),
		updatedAt: latestChange([...documents, ...collections.flatMap(([, entities]) => entities)]),
	} as Content;
	content.projects = content.projects.filter((project) => project.published);
	return content;
}

export function getContent(services: Services): Promise<Content> {
	return remember(services.cache, cacheKeys.content, CONTENT_TTL_SECONDS, buildContent);
}

/* ----------------------------------------------------------------------------
 * Articles: written in the admin panel plus the author's dev.to posts. dev.to is optional: it can
 * be turned off in the settings, and when it is down the site's own articles are still served.
 * ------------------------------------------------------------------------- */

type DevToListItem = {
	slug: string;
	title: string;
	description: string;
	url: string;
	published_at: string;
	reading_time_minutes: number;
	tag_list: string[] | string;
	tags?: string[] | string;
	language?: string | null;
	cover_image: string | null;
};

type DevToArticle = DevToListItem & { body_html: string };

function devtoTags(article: DevToListItem): string[] {
	for (const value of [article.tags, article.tag_list]) {
		if (Array.isArray(value)) return value;
	}
	return String(article.tag_list ?? "")
		.split(",")
		.map((tag) => tag.trim())
		.filter(Boolean);
}

function fromDevTo(article: DevToListItem): ArticleSummary {
	return {
		slug: article.slug,
		source: "devto",
		title: article.title,
		excerpt: article.description,
		lang: article.language ?? "en",
		publishedAt: article.published_at.slice(0, 10),
		readingMinutes: article.reading_time_minutes,
		tags: devtoTags(article),
		cover: article.cover_image,
		externalUrl: article.url,
	};
}

export function readingMinutes(markdown: string): number {
	const words = markdown.split(/\s+/).filter(Boolean).length;
	return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

function fromSite(article: SiteArticle): ArticleSummary {
	return {
		slug: article.slug,
		source: "site",
		title: article.title,
		excerpt: article.excerpt,
		lang: article.lang,
		publishedAt: article.publishedAt,
		readingMinutes: readingMinutes(article.body),
		tags: article.tags,
		cover: article.cover || null,
		externalUrl: null,
	};
}

const articleNotFound = () => new EntryNotFound({ source: "articles", details: { what: "Article" } });

function publishedSiteArticles(services: Services): Promise<SiteArticle[]> {
	return remember(services.cache, cacheKeys.siteArticles, SITE_TTL_SECONDS, async () =>
		(await listEntries("articles")).filter((article) => article.published),
	);
}

async function devto<T>(services: Services, path: string): Promise<T> {
	const response = await services.fetcher(`${DEVTO_API}${path}`, {
		headers: { Accept: "application/json", "User-Agent": "portfolio-api" },
	});
	if (response.status === 404) throw articleNotFound();
	if (!response.ok) throw new Error(`dev.to responded ${response.status}`);
	return (await response.json()) as T;
}

async function devtoList(services: Services, username: string | null): Promise<ArticleSummary[]> {
	if (!username) return [];
	return remember(services.cache, cacheKeys.devtoArticles(username), DEVTO_LIST_TTL_SECONDS, async () => {
		const items = await devto<DevToListItem[]>(
			services,
			`/articles?username=${encodeURIComponent(username)}&per_page=100`,
		);
		return items.map(fromDevTo);
	});
}

export async function listArticles(services: Services): Promise<ArticleSummary[]> {
	const [site, devtoArticles] = await Promise.all([
		publishedSiteArticles(services),
		getContent(services)
			.then((content) => devtoList(services, devtoUsername(content.devto)))
			.catch((error) => {
				console.error("dev.to articles unavailable", error);
				return [] as ArticleSummary[];
			}),
	]);
	const ownSlugs = new Set(site.map((article) => article.slug));
	return [...site.map(fromSite), ...devtoArticles.filter((article) => !ownSlugs.has(article.slug))].sort((a, b) =>
		b.publishedAt.localeCompare(a.publishedAt),
	);
}

export async function getArticle(services: Services, slug: string): Promise<Article> {
	const own = (await publishedSiteArticles(services)).find((article) => article.slug === slug);
	if (own) return { ...fromSite(own), format: "markdown", body: own.body };
	const username = devtoUsername((await getContent(services)).devto);
	if (!username) throw articleNotFound();
	return remember(services.cache, cacheKeys.devtoArticle(username, slug), DEVTO_ARTICLE_TTL_SECONDS, async () => {
		const article = await devto<DevToArticle>(
			services,
			`/articles/${encodeURIComponent(username)}/${encodeURIComponent(slug)}`,
		);
		return { ...fromDevTo(article), format: "html" as const, body: article.body_html };
	});
}

/* ----------------------------------------------------------------------------
 * Releases: published release notes, newest first, for the news panel and their pages.
 * ------------------------------------------------------------------------- */

export function publishedReleases(services: Services): Promise<Release[]> {
	return remember(services.cache, cacheKeys.releases, RELEASES_TTL_SECONDS, async () =>
		(await listEntries("releases"))
			.filter((release) => release.published)
			.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.position - a.position),
	);
}

/* ----------------------------------------------------------------------------
 * After a change: drop the cached content, then rebuild the website in the background.
 * ------------------------------------------------------------------------- */

export async function afterChange(services: Services, reason: string, actor: string): Promise<void> {
	try {
		await services.cache.delete(cacheKeys.content, cacheKeys.siteArticles, cacheKeys.releases);
	} catch (error) {
		console.error("cache invalidation failed", error);
	}
	services.background(
		services.publisher
			.publish(`${reason} by ${actor}`)
			.catch((error) => console.error("publishing the website failed", error)),
	);
}
