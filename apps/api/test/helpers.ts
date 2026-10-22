import { createApp } from "../src/app";
import { MemoryCache } from "../src/cache/memory";
import { assemble } from "../src/container";
import type { Env } from "../src/env";
import { MemoryApiKeyRepository } from "../src/repositories/api-key-repository";
import { MemoryContentRepository } from "../src/repositories/memory";
import { MemoryPushRepository } from "../src/repositories/push-repository";
import { StaticTokenVerifier } from "../src/services/auth";
import { NoopPublisher } from "../src/services/publisher";
import { MemoryMediaStorage } from "../src/storage/memory";

export const ADMIN = "admin-token";
export const STRANGER = "stranger-token";

export function setup({ env = {}, fetcher }: { env?: Env; fetcher?: typeof fetch } = {}) {
	const repository = new MemoryContentRepository();
	const pushRepository = new MemoryPushRepository();
	const cache = new MemoryCache();
	const publisher = new NoopPublisher();
	const deps = assemble(
		{
			repository,
			apiKeyRepository: new MemoryApiKeyRepository(),
			pushRepository,
			cache,
			publisher,
			storage: new MemoryMediaStorage(),
			verifier: new StaticTokenVerifier({
				[ADMIN]: { id: "1", email: "Owner@Example.com" },
				[STRANGER]: { id: "2", email: "someone@else.com" },
			}),
		},
		{ ADMIN_EMAILS: "owner@example.com", ALLOWED_ORIGINS: "https://site.test", ...env },
		undefined,
		fetcher,
	);
	const app = createApp(() => deps);

	const call = (path: string, init: RequestInit & { token?: string; json?: unknown } = {}) => {
		const headers = new Headers(init.headers);
		if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
		if (init.json !== undefined) headers.set("Content-Type", "application/json");
		return app.request(path, {
			...init,
			headers,
			body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
		});
	};

	return { app, deps, repository, pushRepository, cache, publisher, call };
}

export async function data<T = unknown>(response: Response): Promise<T> {
	return ((await response.json()) as { data: T }).data;
}

/** Lets fire-and-forget work (publishing) settle. */
export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
