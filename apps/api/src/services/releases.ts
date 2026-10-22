import type { Release } from "@portfolio/shared";
import { type Cache, cacheKeys, remember } from "../cache/cache";
import type { ContentRepository } from "../repositories/content-repository";

const RELEASES_TTL_SECONDS = 60 * 60;

/** Published release notes, newest first, for the site's news panel and their pages. */
export class ReleasesService {
	constructor(
		private readonly repository: ContentRepository,
		private readonly cache: Cache,
	) {}

	list(): Promise<Release[]> {
		return remember(this.cache, cacheKeys.releases, RELEASES_TTL_SECONDS, async () =>
			(await this.repository.list("releases"))
				.filter((release) => release.published)
				.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.position - a.position),
		);
	}

	async invalidate(): Promise<void> {
		try {
			await this.cache.delete(cacheKeys.releases);
		} catch (error) {
			console.error("cache invalidation failed", error);
		}
	}
}
