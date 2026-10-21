import type { Cache } from "./cache";

export class MemoryCache implements Cache {
	private store = new Map<string, { value: unknown; expiresAt: number }>();

	async get<T>(key: string) {
		const hit = this.store.get(key);
		if (!hit) return null;
		if (hit.expiresAt <= Date.now()) {
			this.store.delete(key);
			return null;
		}
		return structuredClone(hit.value) as T;
	}

	async set<T>(key: string, value: T, ttlSeconds: number) {
		this.store.set(key, { value: structuredClone(value), expiresAt: Date.now() + ttlSeconds * 1000 });
	}

	async delete(...keys: string[]) {
		for (const key of keys) this.store.delete(key);
	}
}
