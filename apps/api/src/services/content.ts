import {
	type Content,
	contentCollectionNames,
	defaultSettings,
	type Settings,
	type SettingsKey,
	settingsKeys,
} from "@portfolio/shared";
import { type Cache, cacheKeys, remember } from "../cache/cache";
import type { ContentRepository } from "../repositories/content-repository";

const CONTENT_TTL_SECONDS = 60 * 60;

/** Builds the public content document; served from the cache and rebuilt after any change. */
export class ContentService {
	constructor(
		private readonly repository: ContentRepository,
		private readonly cache: Cache,
	) {}

	getPublic(): Promise<Content> {
		return remember(this.cache, cacheKeys.content, CONTENT_TTL_SECONDS, () => this.build());
	}

	async invalidate(): Promise<void> {
		try {
			await this.cache.delete(cacheKeys.content);
		} catch (error) {
			console.error("cache invalidation failed", error);
		}
	}

	private async build(): Promise<Content> {
		const [settings, collections, updatedAt] = await Promise.all([
			Promise.all(settingsKeys.map(async (key) => [key, await this.settingsOrDefault(key)] as const)),
			Promise.all(contentCollectionNames.map(async (name) => [name, await this.repository.list(name)] as const)),
			this.repository.lastUpdatedAt(),
		]);

		const content = {
			...Object.fromEntries(settings),
			...Object.fromEntries(collections),
			updatedAt,
		} as Content;

		content.projects = content.projects.filter((project) => project.published);
		return content;
	}

	private async settingsOrDefault<K extends SettingsKey>(key: K): Promise<Settings[K]> {
		return (await this.repository.getSettings(key)) ?? defaultSettings[key];
	}
}
