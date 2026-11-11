import { inMemoryProvider } from "@afora/core";
import type { IRepositoryProvider } from "@afora/core/adapters";
import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis/cloudflare";
import { MemoryCache } from "./cache/memory";
import { UpstashCache } from "./cache/upstash";
import { store } from "./domain/repositories";
import { seedDefaults } from "./domain/seed";
import type { Adapters, PushConfig } from "./domain/services";
import type { Env } from "./env";
import { SupabaseProvider } from "./providers/supabase";
import { parseList, StaticTokenVerifier, SupabaseTokenVerifier } from "./services/auth";
import { GitHubDispatchPublisher, NoopPublisher } from "./services/publisher";
import { MemoryMediaStorage } from "./storage/memory";
import { SupabaseMediaStorage } from "./storage/supabase";

/** Push is on when the VAPID keys and the site's address are all set. */
export function pushConfig(env: Env): PushConfig {
	const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, PUBLIC_SITE_URL } = env;
	return {
		vapid:
			VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT
				? { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY, subject: VAPID_SUBJECT }
				: null,
		siteUrl: PUBLIC_SITE_URL ? PUBLIC_SITE_URL.replace(/\/+$/, "") : null,
	};
}

/** Development token accepted when the API runs without Supabase (`wrangler dev` with no secrets). */
export const DEV_TOKEN = "dev-admin-token";
/** Password for dev@localhost on the OAuth consent page, in the same mode. */
export const DEV_PASSWORD = "dev";

/**
 * What runs the API: the adapters, and the provider the repositories write through. Every request
 * awaits `prepare()` (the seed of the in-memory store, once) before it reaches a use case.
 */
export type Runtime = { adapters: Adapters; provider: IRepositoryProvider; prepare: () => Promise<void> };

/** Uses `runtime`: points the repositories at its provider. */
export function activate(runtime: Runtime): Runtime {
	store.use(runtime.provider);
	return runtime;
}

/**
 * An in-memory store with the default content, as `wrangler dev` without secrets and the tests use.
 * It is seeded on the first `prepare()`, once its provider is the one in use.
 */
export function memoryStore(): Pick<Runtime, "provider" | "prepare"> {
	const provider = inMemoryProvider();
	let seeded: Promise<void> | undefined;
	const prepare = () => {
		seeded ??= seedDefaults({ keepIds: true }).then(() => undefined);
		return seeded;
	};
	return { provider, prepare };
}

let memory: ReturnType<typeof memoryStore> | undefined;
let cached: { env: Env; runtime: Runtime } | undefined;

/**
 * Builds the runtime from the bindings, once per isolate. Without Supabase or Upstash credentials
 * it falls back to in-memory adapters, so `wrangler dev` works out of the box.
 */
export function runtimeFromEnv(env: Env): Runtime {
	if (cached?.env === env) return activate(cached.runtime);

	const hasSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
	const hasUpstash = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
	const fetcher: typeof fetch = (...args) => fetch(...args);

	let provider: IRepositoryProvider;
	let prepare = () => Promise.resolve();
	let base: Pick<Adapters, "storage" | "verifier">;
	if (hasSupabase) {
		const connect = () =>
			createClient(env.SUPABASE_URL as string, env.SUPABASE_SERVICE_ROLE_KEY as string, {
				auth: { persistSession: false, autoRefreshToken: false },
			});
		const supabase = connect();
		provider = new SupabaseProvider(supabase);
		base = {
			storage: new SupabaseMediaStorage(supabase, env.SUPABASE_STORAGE_BUCKET ?? "media"),
			verifier: new SupabaseTokenVerifier(supabase, connect),
		};
	} else {
		memory ??= memoryStore();
		({ provider, prepare } = memory);
		base = {
			storage: new MemoryMediaStorage(),
			verifier: new StaticTokenVerifier(
				{ [DEV_TOKEN]: { id: "dev", email: "dev@localhost" } },
				{ "dev@localhost": DEV_PASSWORD },
			),
		};
	}

	const adapters: Adapters = {
		...base,
		cache: hasUpstash
			? new UpstashCache(
					new Redis({ url: env.UPSTASH_REDIS_REST_URL as string, token: env.UPSTASH_REDIS_REST_TOKEN as string }),
				)
			: new MemoryCache(),
		publisher:
			env.GITHUB_REPOSITORY && env.GITHUB_DISPATCH_TOKEN
				? new GitHubDispatchPublisher(env.GITHUB_REPOSITORY, env.GITHUB_DISPATCH_TOKEN)
				: new NoopPublisher(),
		push: pushConfig(env),
		fetcher,
		adminEmails: parseList(hasSupabase ? env.ADMIN_EMAILS : (env.ADMIN_EMAILS ?? "dev@localhost")),
		allowedOrigins: parseList(env.ALLOWED_ORIGINS),
		mode: { database: hasSupabase ? "supabase" : "memory", cache: hasUpstash ? "upstash" : "memory" },
	};

	const runtime = activate({ adapters, provider, prepare });
	cached = { env, runtime };
	return runtime;
}
