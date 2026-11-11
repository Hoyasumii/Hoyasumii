import type { ApiKey, ApiKeyCreate, CreatedApiKey } from "@portfolio/shared";
import type { Cache } from "../cache/cache";
import { StoredApiKey } from "./entities";
import { ApiKeys } from "./repositories";
import type { Background } from "./services";

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

/** What the API shows about a key: never its hash. */
export function apiKeyOf(stored: StoredApiKey): ApiKey {
	return {
		id: stored.id,
		name: stored.name,
		prefix: stored.prefix,
		scope: stored.scope,
		createdAt: stored.createdAt,
		lastUsedAt: stored.lastUsedAt ?? null,
		revokedAt: stored.revokedAt ?? null,
	};
}

export async function listApiKeys(): Promise<ApiKey[]> {
	const keys = await ApiKeys.findMany({ orderBy: [{ key: "createdAt", direction: "desc" }] });
	return keys.map(apiKeyOf);
}

/** Keys are 256 random bits; only their hash is stored. */
export async function createApiKey(input: ApiKeyCreate): Promise<CreatedApiKey> {
	const key = `${API_KEY_PREFIX}${base64url(crypto.getRandomValues(new Uint8Array(32)))}`;
	const stored = await ApiKeys.create(
		new StoredApiKey({
			name: input.name,
			scope: input.scope,
			prefix: key.slice(0, API_KEY_PREFIX.length + 6),
			hash: await hashKey(key),
		}),
	);
	return { apiKey: apiKeyOf(stored), key };
}

/**
 * Returns the active key matching `key`, or null. Lookups are cached briefly; revoking a key drops
 * it from the cache, so revocation takes effect at once.
 */
export async function verifyApiKey(cache: Cache, key: string, background?: Background): Promise<ApiKey | null> {
	if (!isApiKey(key)) return null;
	const hash = await hashKey(key);

	let apiKey = await cache.get<ApiKey>(cacheKey(hash)).catch(() => null);
	if (!apiKey) {
		const stored = await ApiKeys.findByHash(hash);
		if (!stored || stored.revokedAt) return null;
		apiKey = apiKeyOf(stored);
		await cache.set(cacheKey(hash), apiKey, VERIFY_TTL_SECONDS).catch(() => {});
	}

	const last = apiKey.lastUsedAt ? Date.parse(apiKey.lastUsedAt) : 0;
	if (Date.now() - last > TOUCH_EVERY_MS) {
		const now = new Date().toISOString();
		const touched = { ...apiKey, lastUsedAt: now };
		const work = ApiKeys.findById(apiKey.id)
			.then((stored) => stored && ApiKeys.update(stored.change.lastUsedAt(now)))
			.then(() => cache.set(cacheKey(hash), touched, VERIFY_TTL_SECONDS))
			.catch((error) => console.error("could not record API key usage", error));
		background?.(work);
	}
	return apiKey;
}

/** Returns the revoked key, or null when it is unknown. */
export async function revokeApiKey(cache: Cache, id: string): Promise<ApiKey | null> {
	const stored = await ApiKeys.findById(id);
	if (!stored) return null;
	const revoked = stored.revokedAt ? stored : await ApiKeys.update(stored.change.revokedAt(new Date().toISOString()));
	await cache.delete(cacheKey(revoked.hash)).catch(() => {});
	return apiKeyOf(revoked);
}
