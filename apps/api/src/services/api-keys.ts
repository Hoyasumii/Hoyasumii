import type { ApiKey, ApiKeyCreate, CreatedApiKey } from "@portfolio/shared";
import type { Cache } from "../cache/cache";
import type { ApiKeyRepository } from "../repositories/api-key-repository";

export const API_KEY_PREFIX = "pk_";
const VERIFY_TTL_SECONDS = 60;
/** last_used_at is a hint, not an audit log: write it at most this often per key. */
const TOUCH_EVERY_MS = 5 * 60 * 1000;

const cacheKey = (hash: string) => `portfolio:api-key:v1:${hash}`;

function base64url(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashKey(key: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isApiKey(token: string): boolean {
	return token.startsWith(API_KEY_PREFIX);
}

/** Creates, checks and revokes API keys. Keys are 256 random bits; only their hash is stored. */
export class ApiKeyService {
	constructor(
		private readonly repository: ApiKeyRepository,
		private readonly cache: Cache,
	) {}

	list(): Promise<ApiKey[]> {
		return this.repository.list();
	}

	async create(input: ApiKeyCreate): Promise<CreatedApiKey> {
		const key = `${API_KEY_PREFIX}${base64url(crypto.getRandomValues(new Uint8Array(32)))}`;
		const apiKey = await this.repository.create({
			name: input.name,
			scope: input.scope,
			prefix: key.slice(0, API_KEY_PREFIX.length + 6),
			hash: await hashKey(key),
		});
		return { apiKey, key };
	}

	/**
	 * Returns the active key matching `key`, or null. Lookups are cached briefly; revoking a key
	 * drops it from the cache, so revocation takes effect at once.
	 */
	async verify(key: string, onTouch?: (work: Promise<unknown>) => void): Promise<ApiKey | null> {
		if (!isApiKey(key)) return null;
		const hash = await hashKey(key);

		let apiKey = await this.cache.get<ApiKey>(cacheKey(hash)).catch(() => null);
		if (!apiKey) {
			apiKey = await this.repository.findActive(hash);
			if (!apiKey) return null;
			await this.cache.set(cacheKey(hash), apiKey, VERIFY_TTL_SECONDS).catch(() => {});
		}

		const last = apiKey.lastUsedAt ? Date.parse(apiKey.lastUsedAt) : 0;
		if (Date.now() - last > TOUCH_EVERY_MS) {
			const now = new Date();
			const work = this.repository
				.touch(apiKey.id, now)
				.then(() => this.cache.set(cacheKey(hash), { ...apiKey, lastUsedAt: now.toISOString() }, VERIFY_TTL_SECONDS))
				.catch((error) => console.error("could not record API key usage", error));
			onTouch?.(work);
		}
		return apiKey;
	}

	async revoke(id: string): Promise<ApiKey | null> {
		const result = await this.repository.revoke(id);
		if (!result) return null;
		await this.cache.delete(cacheKey(result.hash)).catch(() => {});
		return result.apiKey;
	}
}
