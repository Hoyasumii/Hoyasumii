import { CONTENT_VERSION } from "@portfolio/shared";

/** Small key/value cache with TTLs. Upstash Redis in production, memory for dev/tests. */
export interface Cache {
	get<T>(key: string): Promise<T | null>;
	set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
	delete(...keys: string[]): Promise<void>;
}

export const cacheKeys = {
	content: `portfolio:content:v${CONTENT_VERSION}`,
	siteArticles: "portfolio:site-articles:v1",
	devtoArticles: "portfolio:devto-articles:v1",
	devtoArticle: (slug: string) => `portfolio:devto-article:v1:${slug}`,
};

/**
 * Reads `key` from the cache, or computes and stores it. A cache that is down never takes the
 * API down with it: errors are logged and the value is computed from the source.
 */
export async function remember<T>(cache: Cache, key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
	try {
		const hit = await cache.get<T>(key);
		if (hit !== null) return hit;
	} catch (error) {
		console.error(`cache get failed for ${key}`, error);
	}

	const value = await load();
	try {
		await cache.set(key, value, ttlSeconds);
	} catch (error) {
		console.error(`cache set failed for ${key}`, error);
	}
	return value;
}
