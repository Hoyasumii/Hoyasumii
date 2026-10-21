import type { ApiKey, ApiKeyScope } from "@portfolio/shared";

export type NewApiKey = { name: string; prefix: string; hash: string; scope: ApiKeyScope };

/** Stores API keys by the SHA-256 of their value; the value itself is never stored. */
export interface ApiKeyRepository {
	list(): Promise<ApiKey[]>;
	create(key: NewApiKey): Promise<ApiKey>;
	/** The key with this hash, if it exists and was not revoked. */
	findActive(hash: string): Promise<ApiKey | null>;
	touch(id: string, at: Date): Promise<void>;
	/** Returns the revoked key and its hash (to drop it from caches), or null when unknown. */
	revoke(id: string): Promise<{ apiKey: ApiKey; hash: string } | null>;
}

type Stored = ApiKey & { hash: string };

const strip = ({ hash: _hash, ...key }: Stored): ApiKey => ({ ...key });

export class MemoryApiKeyRepository implements ApiKeyRepository {
	private keys: Stored[] = [];

	async list() {
		return [...this.keys].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(strip);
	}

	async create({ name, prefix, hash, scope }: NewApiKey) {
		const key: Stored = {
			id: crypto.randomUUID(),
			name,
			prefix,
			hash,
			scope,
			createdAt: new Date().toISOString(),
			lastUsedAt: null,
			revokedAt: null,
		};
		this.keys.push(key);
		return strip(key);
	}

	async findActive(hash: string) {
		const key = this.keys.find((item) => item.hash === hash && !item.revokedAt);
		return key ? strip(key) : null;
	}

	async touch(id: string, at: Date) {
		const key = this.keys.find((item) => item.id === id);
		if (key) key.lastUsedAt = at.toISOString();
	}

	async revoke(id: string) {
		const key = this.keys.find((item) => item.id === id);
		if (!key) return null;
		key.revokedAt ??= new Date().toISOString();
		return { apiKey: strip(key), hash: key.hash };
	}
}
