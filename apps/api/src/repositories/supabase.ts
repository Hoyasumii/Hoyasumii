import type { CollectionInput, CollectionName, Entry, Settings, SettingsKey } from "@portfolio/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContentRepository } from "./content-repository";

type EntryRow = {
	id: string;
	collection: CollectionName;
	data: Record<string, unknown>;
	position: number;
	updated_at: string;
};

function toEntry<T>(row: Pick<EntryRow, "id" | "data" | "position">): Entry<T> {
	return { ...(row.data as T), id: row.id, position: row.position };
}

function fail(action: string, error: { message: string } | null): never {
	throw new Error(`Supabase: could not ${action}: ${error?.message ?? "unknown error"}`);
}

/** Content stored in the `settings` and `entries` tables (see supabase/migrations). */
export class SupabaseContentRepository implements ContentRepository {
	constructor(private readonly client: SupabaseClient) {}

	async getSettings<K extends SettingsKey>(key: K) {
		const { data, error } = await this.client.from("settings").select("value").eq("key", key).maybeSingle();
		if (error) fail(`read settings "${key}"`, error);
		return (data?.value as Settings[K] | undefined) ?? null;
	}

	async putSettings<K extends SettingsKey>(key: K, value: Settings[K]) {
		const { error } = await this.client
			.from("settings")
			.upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
		if (error) fail(`save settings "${key}"`, error);
		return value;
	}

	async list<N extends CollectionName>(name: N) {
		const { data, error } = await this.client
			.from("entries")
			.select("id, data, position")
			.eq("collection", name)
			.order("position", { ascending: true })
			.order("created_at", { ascending: true });
		if (error) fail(`list ${name}`, error);
		return (data ?? []).map((row) => toEntry<CollectionInput<N>>(row));
	}

	async create<N extends CollectionName>(name: N, input: CollectionInput<N>) {
		const { data: last, error: lastError } = await this.client
			.from("entries")
			.select("position")
			.eq("collection", name)
			.order("position", { ascending: false })
			.limit(1)
			.maybeSingle();
		if (lastError) fail(`read ${name} positions`, lastError);

		const { data, error } = await this.client
			.from("entries")
			.insert({ collection: name, data: input, position: (last?.position ?? -1) + 1 })
			.select("id, data, position")
			.single();
		if (error || !data) fail(`create ${name} entry`, error);
		return toEntry<CollectionInput<N>>(data);
	}

	async update<N extends CollectionName>(name: N, id: string, input: CollectionInput<N>) {
		const { data, error } = await this.client
			.from("entries")
			.update({ data: input, updated_at: new Date().toISOString() })
			.eq("collection", name)
			.eq("id", id)
			.select("id, data, position")
			.maybeSingle();
		if (error) fail(`update ${name} entry`, error);
		return data ? toEntry<CollectionInput<N>>(data) : null;
	}

	async remove(name: CollectionName, id: string) {
		const { data, error } = await this.client.from("entries").delete().eq("collection", name).eq("id", id).select("id");
		if (error) fail(`delete ${name} entry`, error);
		return (data ?? []).length > 0;
	}

	async reorder(name: CollectionName, ids: string[]) {
		const { error } = await this.client.rpc("reorder_entries", { p_collection: name, p_ids: ids });
		if (error) fail(`reorder ${name}`, error);
	}

	async lastUpdatedAt() {
		const [settings, entries] = await Promise.all([
			this.client.from("settings").select("updated_at").order("updated_at", { ascending: false }).limit(1),
			this.client.from("entries").select("updated_at").order("updated_at", { ascending: false }).limit(1),
		]);
		if (settings.error) fail("read settings timestamps", settings.error);
		if (entries.error) fail("read entries timestamps", entries.error);
		const dates = [settings.data?.[0]?.updated_at, entries.data?.[0]?.updated_at].filter(Boolean) as string[];
		return dates.sort().at(-1) ?? null;
	}
}
