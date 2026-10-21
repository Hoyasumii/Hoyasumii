import type { CollectionInput, CollectionName, Entry, Settings, SettingsKey } from "@portfolio/shared";

/** Where the site content lives. Implemented by Supabase in production and in memory for dev/tests. */
export interface ContentRepository {
	getSettings<K extends SettingsKey>(key: K): Promise<Settings[K] | null>;
	putSettings<K extends SettingsKey>(key: K, value: Settings[K]): Promise<Settings[K]>;

	list<N extends CollectionName>(name: N): Promise<Entry<CollectionInput<N>>[]>;
	create<N extends CollectionName>(name: N, input: CollectionInput<N>): Promise<Entry<CollectionInput<N>>>;
	/** Returns null when the entry does not exist. */
	update<N extends CollectionName>(
		name: N,
		id: string,
		input: CollectionInput<N>,
	): Promise<Entry<CollectionInput<N>> | null>;
	/** Returns false when the entry does not exist. */
	remove(name: CollectionName, id: string): Promise<boolean>;
	/** Sets positions from the order of `ids`; ids from other collections are ignored. */
	reorder(name: CollectionName, ids: string[]): Promise<void>;

	/** Latest change across settings and entries, as an ISO string. */
	lastUpdatedAt(): Promise<string | null>;
}
