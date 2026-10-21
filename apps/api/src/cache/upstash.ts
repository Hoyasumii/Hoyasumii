import type { Redis } from "@upstash/redis/cloudflare";
import type { Cache } from "./cache";

export class UpstashCache implements Cache {
	constructor(private readonly redis: Redis) {}

	async get<T>(key: string) {
		return (await this.redis.get<T>(key)) ?? null;
	}

	async set<T>(key: string, value: T, ttlSeconds: number) {
		await this.redis.set(key, value, { ex: ttlSeconds });
	}

	async delete(...keys: string[]) {
		if (keys.length > 0) await this.redis.del(...keys);
	}
}
