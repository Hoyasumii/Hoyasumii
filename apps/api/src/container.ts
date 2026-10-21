import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis/cloudflare";
import type { Cache } from "./cache/cache";
import { MemoryCache } from "./cache/memory";
import { UpstashCache } from "./cache/upstash";
import type { Env } from "./env";
import type { ContentRepository } from "./repositories/content-repository";
import { MemoryContentRepository } from "./repositories/memory";
import { SupabaseContentRepository } from "./repositories/supabase";
import { ArticlesService } from "./services/articles";
import { parseList, StaticTokenVerifier, SupabaseTokenVerifier, type TokenVerifier } from "./services/auth";
import { ContentService } from "./services/content";
import { GitHubDispatchPublisher, NoopPublisher, type Publisher } from "./services/publisher";
import type { MediaStorage } from "./storage/media-storage";
import { MemoryMediaStorage } from "./storage/memory";
import { SupabaseMediaStorage } from "./storage/supabase";

export type Deps = {
	repository: ContentRepository;
	cache: Cache;
	storage: MediaStorage;
	verifier: TokenVerifier;
	publisher: Publisher;
	content: ContentService;
	articles: ArticlesService;
	adminEmails: string[];
	/** Which adapters are in use, reported by /health. */
	mode: { database: "supabase" | "memory"; cache: "upstash" | "memory" };
	allowedOrigins: string[];
};

export type Adapters = Pick<Deps, "repository" | "cache" | "storage" | "verifier" | "publisher">;

export function assemble(
	adapters: Adapters,
	env: Env,
	mode: Deps["mode"] = { database: "memory", cache: "memory" },
): Deps {
	return {
		mode,
		...adapters,
		content: new ContentService(adapters.repository, adapters.cache),
		articles: new ArticlesService(adapters.repository, adapters.cache, env.DEVTO_USERNAME ?? "hoyasumii"),
		adminEmails: parseList(env.ADMIN_EMAILS),
		allowedOrigins: parseList(env.ALLOWED_ORIGINS),
	};
}

/** Development token accepted when the API runs without Supabase (`wrangler dev` with no secrets). */
export const DEV_TOKEN = "dev-admin-token";

let memoryAdapters: Adapters | undefined;
let cached: { env: Env; deps: Deps } | undefined;

/**
 * Builds the dependencies from the bindings, once per isolate. Without Supabase or Upstash
 * credentials it falls back to in-memory adapters, so `wrangler dev` works out of the box.
 */
export function depsFromEnv(env: Env): Deps {
	if (cached?.env === env) return cached.deps;

	const hasSupabase = Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
	const hasUpstash = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);

	let adapters: Adapters;
	if (hasSupabase) {
		const supabase = createClient(env.SUPABASE_URL as string, env.SUPABASE_SERVICE_ROLE_KEY as string, {
			auth: { persistSession: false, autoRefreshToken: false },
		});
		adapters = {
			repository: new SupabaseContentRepository(supabase),
			storage: new SupabaseMediaStorage(supabase, env.SUPABASE_STORAGE_BUCKET ?? "media"),
			verifier: new SupabaseTokenVerifier(supabase),
			cache: new MemoryCache(),
			publisher: new NoopPublisher(),
		};
	} else {
		memoryAdapters ??= {
			repository: new MemoryContentRepository(),
			storage: new MemoryMediaStorage(),
			verifier: new StaticTokenVerifier({ [DEV_TOKEN]: { id: "dev", email: "dev@localhost" } }),
			cache: new MemoryCache(),
			publisher: new NoopPublisher(),
		};
		adapters = { ...memoryAdapters };
	}

	if (hasUpstash) {
		adapters.cache = new UpstashCache(
			new Redis({ url: env.UPSTASH_REDIS_REST_URL as string, token: env.UPSTASH_REDIS_REST_TOKEN as string }),
		);
	}
	if (env.GITHUB_REPOSITORY && env.GITHUB_DISPATCH_TOKEN) {
		adapters.publisher = new GitHubDispatchPublisher(env.GITHUB_REPOSITORY, env.GITHUB_DISPATCH_TOKEN);
	}

	const mode: Deps["mode"] = {
		database: hasSupabase ? "supabase" : "memory",
		cache: hasUpstash ? "upstash" : "memory",
	};
	const deps = assemble(
		adapters,
		{
			...env,
			ADMIN_EMAILS: hasSupabase ? env.ADMIN_EMAILS : (env.ADMIN_EMAILS ?? "dev@localhost"),
		},
		mode,
	);
	cached = { env, deps };
	return deps;
}
