import {
	type CollectionInput,
	type CollectionName,
	collectionNames,
	collectionSchemas,
	type Entry,
	type Settings,
	type SettingsKey,
	settingsKeys,
	settingsSchemas,
} from "@portfolio/shared";
import type { ZodType, z } from "zod";
import type { Deps } from "../container";
import { badRequest, HttpError, notFound } from "../lib/errors";
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES, type StoredMedia } from "../storage/media-storage";

/** Runs work after the response when the runtime allows it (Workers' waitUntil). */
export type Background = (work: Promise<unknown>) => void;

function parse<S extends ZodType>(schema: S, value: unknown): z.output<S> {
	const result = schema.safeParse(value);
	if (!result.success) throw badRequest("Invalid data", result.error.issues);
	return result.data;
}

export function assertSettingsKey(key: string): asserts key is SettingsKey {
	if (!settingsKeys.includes(key as SettingsKey)) throw notFound(`Settings "${key}"`);
}

export function assertCollection(name: string): asserts name is CollectionName {
	if (!collectionNames.includes(name as CollectionName)) throw notFound(`Collection "${name}"`);
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** Merges `patch` into `base` key by key; nested objects merge too, arrays and scalars replace. */
export function deepMerge<T>(base: T, patch: unknown): T {
	if (!isPlainObject(base) || !isPlainObject(patch)) return (patch === undefined ? base : patch) as T;
	const result: Record<string, unknown> = { ...base };
	for (const [key, value] of Object.entries(patch)) result[key] = deepMerge(result[key], value);
	return result as T;
}

/**
 * Every change to the content, shared by the admin HTTP routes and the MCP server: validation,
 * article slug uniqueness, cache invalidation and rebuilding the website.
 */
export class AdminService {
	constructor(
		private readonly deps: Deps,
		private readonly background: Background,
		private readonly actor: string,
	) {}

	async getSettings<K extends SettingsKey>(key: K): Promise<Settings[K]> {
		return (await this.deps.repository.getSettings(key)) ?? (await this.deps.content.getPublic())[key];
	}

	async putSettings<K extends SettingsKey>(key: K, value: unknown): Promise<Settings[K]> {
		const saved = await this.deps.repository.putSettings(key, parse(settingsSchemas[key], value) as Settings[K]);
		await this.afterChange(`settings.${key} updated`);
		return saved;
	}

	async patchSettings<K extends SettingsKey>(key: K, patch: unknown): Promise<Settings[K]> {
		return this.putSettings(key, deepMerge(await this.getSettings(key), patch));
	}

	list<N extends CollectionName>(name: N): Promise<Entry<CollectionInput<N>>[]> {
		return this.deps.repository.list(name);
	}

	async get<N extends CollectionName>(name: N, id: string): Promise<Entry<CollectionInput<N>>> {
		const entry = (await this.list(name)).find((item) => item.id === id);
		if (!entry) throw notFound("Entry");
		return entry;
	}

	async create<N extends CollectionName>(name: N, value: unknown): Promise<Entry<CollectionInput<N>>> {
		const input = parse(collectionSchemas[name], value) as CollectionInput<N>;
		await this.assertUniqueSlug(name, input);
		const entry = await this.deps.repository.create(name, input);
		await this.afterChange(`${name} entry created`);
		return entry;
	}

	async update<N extends CollectionName>(name: N, id: string, value: unknown): Promise<Entry<CollectionInput<N>>> {
		const input = parse(collectionSchemas[name], value) as CollectionInput<N>;
		await this.assertUniqueSlug(name, input, id);
		const entry = await this.deps.repository.update(name, id, input);
		if (!entry) throw notFound("Entry");
		await this.afterChange(`${name} entry updated`);
		return entry;
	}

	/** Changes only the given fields of an entry. */
	async patch<N extends CollectionName>(name: N, id: string, patch: unknown): Promise<Entry<CollectionInput<N>>> {
		const { id: _id, position: _position, ...current } = await this.get(name, id);
		return this.update(name, id, deepMerge(current, patch));
	}

	async remove(name: CollectionName, id: string): Promise<{ id: string }> {
		if (!(await this.deps.repository.remove(name, id))) throw notFound("Entry");
		await this.afterChange(`${name} entry deleted`);
		return { id };
	}

	async reorder<N extends CollectionName>(name: N, ids: string[]): Promise<Entry<CollectionInput<N>>[]> {
		await this.deps.repository.reorder(name, ids);
		await this.afterChange(`${name} reordered`);
		return this.list(name);
	}

	async upload(file: File): Promise<StoredMedia> {
		if (!ALLOWED_MIME_TYPES.includes(file.type)) throw badRequest(`Unsupported file type ${file.type || "(none)"}`);
		if (file.size > MAX_UPLOAD_BYTES) throw badRequest("File is larger than 5 MB");
		return this.deps.storage.upload(file);
	}

	/** Downloads an image from a public URL and stores it like an upload from the panel. */
	async uploadFromUrl(url: string): Promise<StoredMedia> {
		let parsed: URL;
		try {
			parsed = new URL(url);
		} catch {
			throw badRequest("Not a valid URL");
		}
		if (parsed.protocol !== "https:") throw badRequest("Only https:// URLs are accepted");

		const response = await fetch(parsed, { redirect: "follow" }).catch(() => {
			throw badRequest("Could not download the image");
		});
		if (!response.ok) throw badRequest(`Downloading the image failed with ${response.status}`);
		const type = (response.headers.get("content-type") ?? "").split(";")[0].trim();
		const declared = Number(response.headers.get("content-length") ?? 0);
		if (declared > MAX_UPLOAD_BYTES) throw badRequest("File is larger than 5 MB");

		const bytes = await response.arrayBuffer();
		const name = parsed.pathname.split("/").pop() || "image";
		return this.upload(new File([bytes], name, { type }));
	}

	async publish(): Promise<void> {
		try {
			await this.deps.publisher.publish(`manual publish by ${this.actor}`);
		} catch (error) {
			const reason = error instanceof Error ? error.message : String(error);
			throw new HttpError(502, "publish_failed", `GitHub refused the rebuild: ${reason}`);
		}
	}

	/** Article slugs are their URLs, so two articles can't share one. */
	private async assertUniqueSlug(name: CollectionName, input: unknown, id?: string) {
		if (name !== "articles") return;
		const { slug } = input as { slug: string };
		const taken = (await this.deps.repository.list("articles")).some(
			(article) => article.slug === slug && article.id !== id,
		);
		if (taken) throw new HttpError(409, "conflict", `Another article already uses the slug "${slug}"`);
	}

	/** Drops the cached content, then rebuilds the website in the background. */
	private async afterChange(reason: string) {
		const { content, articles, publisher } = this.deps;
		await Promise.all([content.invalidate(), articles.invalidate()]);
		this.background(
			publisher
				.publish(`${reason} by ${this.actor}`)
				.catch((error) => console.error("publishing the website failed", error)),
		);
	}
}
