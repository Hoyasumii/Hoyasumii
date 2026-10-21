import "server-only";
import {
	type Article,
	type ArticleSummary,
	buildDefaultContent,
	type Content,
	createPortfolioClient,
} from "@portfolio/shared";

/**
 * Build-time data. Without API_URL the site builds from the default content, so it can be
 * previewed with no backend; with API_URL set, an unreachable API fails the build instead of
 * publishing stale defaults over the real content.
 */
const apiUrl = process.env.API_URL;
const client = apiUrl ? createPortfolioClient({ baseUrl: apiUrl, init: { cache: "force-cache" } }) : null;

let contentPromise: Promise<Content> | undefined;
let articlesPromise: Promise<ArticleSummary[]> | undefined;

export function getContent(): Promise<Content> {
	contentPromise ??= client ? client.getContent() : Promise.resolve(buildDefaultContent());
	return contentPromise;
}

export function getArticles(): Promise<ArticleSummary[]> {
	articlesPromise ??= client ? client.getArticles() : Promise.resolve([]);
	return articlesPromise;
}

export async function getArticle(slug: string): Promise<Article | null> {
	if (!client) return null;
	return client.getArticle(slug);
}
