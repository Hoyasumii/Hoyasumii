import { expect } from "vitest";
import { createApp } from "../src/app";
import { MemoryCache } from "../src/cache/memory";
import { activate, memoryStore, pushConfig, type Runtime } from "../src/container";
import { SettingsDocument } from "../src/domain/entities";
import { SettingsDocuments } from "../src/domain/repositories";
import type { Adapters } from "../src/domain/services";
import type { Env } from "../src/env";
import { parseList, StaticTokenVerifier } from "../src/services/auth";
import { NoopPublisher } from "../src/services/publisher";
import { MemoryMediaStorage } from "../src/storage/memory";

export const ADMIN = "admin-token";
export const STRANGER = "stranger-token";

/** A fresh API on a fresh in-memory store, seeded with the default content. */
export function setup({ env = {}, fetcher }: { env?: Env; fetcher?: typeof fetch } = {}) {
	const cache = new MemoryCache();
	const publisher = new NoopPublisher();
	const settings: Env = { ADMIN_EMAILS: "owner@example.com", ALLOWED_ORIGINS: "https://site.test", ...env };
	const adapters: Adapters = {
		cache,
		publisher,
		storage: new MemoryMediaStorage(),
		verifier: new StaticTokenVerifier({
			[ADMIN]: { id: "1", email: "Owner@Example.com" },
			[STRANGER]: { id: "2", email: "someone@else.com" },
		}),
		push: pushConfig(settings),
		fetcher: fetcher ?? ((...args) => fetch(...args)),
		adminEmails: parseList(settings.ADMIN_EMAILS),
		allowedOrigins: parseList(settings.ALLOWED_ORIGINS),
		mode: { database: "memory", cache: "memory" },
	};
	const runtime: Runtime = { adapters, ...memoryStore() };
	const app = createApp(() => activate(runtime));

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

	/** Stores a settings document as is, like one saved before its schema changed. */
	const putSettings = async (key: string, value: unknown) => {
		activate(runtime);
		await runtime.prepare();
		const current = await SettingsDocuments.findById(key);
		if (current) await SettingsDocuments.update(current.change.value(value as never));
		else await SettingsDocuments.create(new SettingsDocument({ id: key, value: value as never }));
	};

	return { app, adapters, runtime, cache, publisher, call, putSettings };
}

/** The body of a successful response. */
export async function data<T = unknown>(response: Response): Promise<T> {
	return (await response.json()) as T;
}

/** The items of a list response (`{ items }`). */
export async function items<T = unknown>(response: Response): Promise<T[]> {
	return ((await response.json()) as { items: T[] }).items;
}

export type Problem = {
	type: string;
	title: string;
	status: number;
	detail: string;
	issues?: { path: (string | number)[]; code: string; message: string }[];
};

/** The problem details (application/problem+json) of an error response. */
export async function problem(response: Response): Promise<Problem> {
	expect(response.headers.get("content-type")).toContain("application/problem+json");
	return (await response.json()) as Problem;
}

/** Lets fire-and-forget work (publishing) settle. */
export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
