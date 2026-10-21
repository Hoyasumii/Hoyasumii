import {
	buildDefaultContent,
	type CollectionInput,
	type CollectionName,
	type Collections,
	collectionNames,
	type Entry,
	type Settings,
	type SettingsKey,
	settingsKeys,
} from "@portfolio/shared";
import type { ContentRepository } from "./content-repository";

type Stored = Entry<Record<string, unknown>>;

/** Keeps everything in the isolate's memory, seeded with the default content. */
export class MemoryContentRepository implements ContentRepository {
	private settings = new Map<SettingsKey, unknown>();
	private entries = new Map<CollectionName, Stored[]>();
	private updatedAt: string | null = null;

	constructor(seed: Settings & Partial<Collections> = buildDefaultContent()) {
		for (const key of settingsKeys) this.settings.set(key, structuredClone(seed[key]));
		for (const name of collectionNames) this.entries.set(name, structuredClone(seed[name] ?? []) as Stored[]);
	}

	private touch() {
		this.updatedAt = new Date().toISOString();
	}

	private items(name: CollectionName): Stored[] {
		return this.entries.get(name) ?? [];
	}

	async getSettings<K extends SettingsKey>(key: K) {
		return structuredClone((this.settings.get(key) as Settings[K] | undefined) ?? null);
	}

	async putSettings<K extends SettingsKey>(key: K, value: Settings[K]) {
		this.settings.set(key, structuredClone(value));
		this.touch();
		return value;
	}

	async list<N extends CollectionName>(name: N) {
		const sorted = [...this.items(name)].sort((a, b) => a.position - b.position);
		return structuredClone(sorted) as Entry<CollectionInput<N>>[];
	}

	async create<N extends CollectionName>(name: N, input: CollectionInput<N>) {
		const items = this.items(name);
		const position = items.reduce((max, item) => Math.max(max, item.position + 1), 0);
		const entry = { ...structuredClone(input), id: crypto.randomUUID(), position } as Stored;
		this.entries.set(name, [...items, entry]);
		this.touch();
		return structuredClone(entry) as Entry<CollectionInput<N>>;
	}

	async update<N extends CollectionName>(name: N, id: string, input: CollectionInput<N>) {
		const items = this.items(name);
		const current = items.find((item) => item.id === id);
		if (!current) return null;
		const entry = { ...structuredClone(input), id, position: current.position } as Stored;
		this.entries.set(
			name,
			items.map((item) => (item.id === id ? entry : item)),
		);
		this.touch();
		return structuredClone(entry) as Entry<CollectionInput<N>>;
	}

	async remove(name: CollectionName, id: string) {
		const items = this.items(name);
		if (!items.some((item) => item.id === id)) return false;
		this.entries.set(
			name,
			items.filter((item) => item.id !== id),
		);
		this.touch();
		return true;
	}

	async reorder(name: CollectionName, ids: string[]) {
		const order = new Map(ids.map((id, index) => [id, index]));
		for (const item of this.items(name)) {
			const position = order.get(item.id);
			if (position !== undefined) item.position = position;
		}
		this.touch();
	}

	async lastUpdatedAt() {
		return this.updatedAt;
	}
}
