import "server-only";
import {
	type Article,
	type ArticleSummary,
	buildDefaultContent,
	type Content,
	createPortfolioClient,
	normalizeContent,
	type Release,
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
let releasesPromise: Promise<Release[]> | undefined;
let pushKeyPromise: Promise<string | null> | undefined;

export function getContent(): Promise<Content> {
	// Normalized here too, so content from an API that is older or newer than this build
	// (or a stale cache) still has every field the pages read.
	contentPromise ??= (client ? client.getContent() : Promise.resolve(buildDefaultContent())).then(normalizeContent);
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

/** Published release notes, newest first. */
export function getReleases(): Promise<Release[]> {
	releasesPromise ??= client ? client.getReleases() : Promise.resolve([]);
	return releasesPromise;
}

/** The key browsers subscribe to release notifications with; null while push is off. */
export function getPushKey(): Promise<string | null> {
	pushKeyPromise ??= client ? client.getPushKey().then((key) => key.publicKey) : Promise.resolve(null);
	return pushKeyPromise;
}
