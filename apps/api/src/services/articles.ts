import type { Article, ArticleSummary, SiteArticle } from "@portfolio/shared";
import { type Cache, cacheKeys, remember } from "../cache/cache";
import { notFound } from "../lib/errors";
import type { ContentRepository } from "../repositories/content-repository";

const SITE_TTL_SECONDS = 60 * 60;
const DEVTO_LIST_TTL_SECONDS = 30 * 60;
const DEVTO_ARTICLE_TTL_SECONDS = 6 * 60 * 60;
const DEVTO_API = "https://dev.to/api";
const WORDS_PER_MINUTE = 220;

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

/**
 * Articles written in the admin panel plus the author's dev.to posts. dev.to is optional: when
 * it is down, the site's own articles are still served.
 */
export class ArticlesService {
	constructor(
		private readonly repository: ContentRepository,
		private readonly cache: Cache,
		private readonly devtoUsername: string,
		private readonly fetcher?: typeof fetch,
	) {}

	async list(): Promise<ArticleSummary[]> {
		const [site, devto] = await Promise.all([
			this.publishedSiteArticles(),
			this.devtoList().catch((error) => {
				console.error("dev.to articles unavailable", error);
				return [] as ArticleSummary[];
			}),
		]);
		const ownSlugs = new Set(site.map((article) => article.slug));
		return [...site.map(fromSite), ...devto.filter((article) => !ownSlugs.has(article.slug))].sort((a, b) =>
			b.publishedAt.localeCompare(a.publishedAt),
		);
	}

	async get(slug: string): Promise<Article> {
		const own = (await this.publishedSiteArticles()).find((article) => article.slug === slug);
		if (own) return { ...fromSite(own), format: "markdown", body: own.body };
		return this.devtoArticle(slug);
	}

	async invalidate(): Promise<void> {
		try {
			await this.cache.delete(cacheKeys.siteArticles);
		} catch (error) {
			console.error("cache invalidation failed", error);
		}
	}

	private publishedSiteArticles(): Promise<SiteArticle[]> {
		return remember(this.cache, cacheKeys.siteArticles, SITE_TTL_SECONDS, async () =>
			(await this.repository.list("articles")).filter((article) => article.published),
		);
	}

	private devtoList(): Promise<ArticleSummary[]> {
		return remember(this.cache, cacheKeys.devtoArticles, DEVTO_LIST_TTL_SECONDS, async () => {
			const items = await this.devto<DevToListItem[]>(
				`/articles?username=${encodeURIComponent(this.devtoUsername)}&per_page=100`,
			);
			return items.map(fromDevTo);
		});
	}

	private devtoArticle(slug: string): Promise<Article> {
		return remember(this.cache, cacheKeys.devtoArticle(slug), DEVTO_ARTICLE_TTL_SECONDS, async () => {
			const article = await this.devto<DevToArticle>(
				`/articles/${encodeURIComponent(this.devtoUsername)}/${encodeURIComponent(slug)}`,
			);
			return { ...fromDevTo(article), format: "html" as const, body: article.body_html };
		});
	}

	private async devto<T>(path: string): Promise<T> {
		const response = await (this.fetcher ?? fetch)(`${DEVTO_API}${path}`, {
			headers: { Accept: "application/json", "User-Agent": "portfolio-api" },
		});
		if (response.status === 404) throw notFound("Article");
		if (!response.ok) throw new Error(`dev.to responded ${response.status}`);
		return (await response.json()) as T;
	}
}
