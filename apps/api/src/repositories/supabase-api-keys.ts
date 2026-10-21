import type { ApiKey, ApiKeyScope } from "@portfolio/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApiKeyRepository, NewApiKey } from "./api-key-repository";
import { describeError } from "./supabase";

type Row = {
	id: string;
	name: string;
	prefix: string;
	scope: ApiKeyScope;
	created_at: string;
	last_used_at: string | null;
	revoked_at: string | null;
};

const COLUMNS = "id, name, prefix, scope, created_at, last_used_at, revoked_at";

const toApiKey = (row: Row): ApiKey => ({
	id: row.id,
	name: row.name,
	prefix: row.prefix,
	scope: row.scope,
	createdAt: row.created_at,
	lastUsedAt: row.last_used_at,
	revokedAt: row.revoked_at,
});

function fail(action: string, error: Parameters<typeof describeError>[0]): never {
	throw new Error(`Supabase: could not ${action}: ${describeError(error)}`);
}

/** API keys in the `api_keys` table (see supabase/migrations). */
export class SupabaseApiKeyRepository implements ApiKeyRepository {
	constructor(private readonly client: SupabaseClient) {}

	async list() {
		const { data, error } = await this.client
			.from("api_keys")
			.select(COLUMNS)
			.order("created_at", { ascending: false });
		if (error) fail("list API keys", error);
		return (data ?? []).map(toApiKey);
	}

	async create(key: NewApiKey) {
		const { data, error } = await this.client.from("api_keys").insert(key).select(COLUMNS).single();
		if (error || !data) fail("create API key", error);
		return toApiKey(data);
	}

	async findActive(hash: string) {
		const { data, error } = await this.client
			.from("api_keys")
			.select(COLUMNS)
			.eq("hash", hash)
			.is("revoked_at", null)
			.maybeSingle();
		if (error) fail("read API key", error);
		return data ? toApiKey(data) : null;
	}

	async touch(id: string, at: Date) {
		const { error } = await this.client.from("api_keys").update({ last_used_at: at.toISOString() }).eq("id", id);
		if (error) fail("update API key usage", error);
	}

	async revoke(id: string) {
		const { data: current, error: readError } = await this.client
			.from("api_keys")
			.select(`${COLUMNS}, hash`)
			.eq("id", id)
			.maybeSingle();
		if (readError) fail("read API key", readError);
		if (!current) return null;
		if (current.revoked_at) return { apiKey: toApiKey(current), hash: current.hash };

		const { data, error } = await this.client
			.from("api_keys")
			.update({ revoked_at: new Date().toISOString() })
			.eq("id", id)
			.select(COLUMNS)
			.single();
		if (error || !data) fail("revoke API key", error);
		return { apiKey: toApiKey(data), hash: current.hash };
	}
}
