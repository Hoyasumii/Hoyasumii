import { createClient } from "@supabase/supabase-js";
import { Redis } from "@upstash/redis/cloudflare";
import type { Cache } from "./cache/cache";
import { MemoryCache } from "./cache/memory";
import { UpstashCache } from "./cache/upstash";
import type { Env } from "./env";
import { type ApiKeyRepository, MemoryApiKeyRepository } from "./repositories/api-key-repository";
import type { ContentRepository } from "./repositories/content-repository";
import { MemoryContentRepository } from "./repositories/memory";
import { MemoryPushRepository, type PushRepository } from "./repositories/push-repository";
import { SupabaseContentRepository } from "./repositories/supabase";
import { SupabaseApiKeyRepository } from "./repositories/supabase-api-keys";
import { SupabasePushRepository } from "./repositories/supabase-push";
import { ApiKeyService } from "./services/api-keys";
import { ArticlesService } from "./services/articles";
import { parseList, StaticTokenVerifier, SupabaseTokenVerifier, type TokenVerifier } from "./services/auth";
import { ContentService } from "./services/content";
import { GitHubDispatchPublisher, NoopPublisher, type Publisher } from "./services/publisher";
import { type PushConfig, PushService } from "./services/push";
import { ReleasesService } from "./services/releases";
import type { MediaStorage } from "./storage/media-storage";
import { MemoryMediaStorage } from "./storage/memory";
import { SupabaseMediaStorage } from "./storage/supabase";

export type Deps = {
	repository: ContentRepository;
	apiKeyRepository: ApiKeyRepository;
	pushRepository: PushRepository;
	cache: Cache;
	storage: MediaStorage;
	verifier: TokenVerifier;
	publisher: Publisher;
	content: ContentService;
	articles: ArticlesService;
	releases: ReleasesService;
	push: PushService;
	apiKeys: ApiKeyService;
	adminEmails: string[];
	/** Which adapters are in use, reported by /health. */
	mode: { database: "supabase" | "memory"; cache: "upstash" | "memory" };
	allowedOrigins: string[];
};

export type Adapters = Pick<
	Deps,
	"repository" | "apiKeyRepository" | "pushRepository" | "cache" | "storage" | "verifier" | "publisher"
>;

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

export function assemble(
	adapters: Adapters,
	env: Env,
	mode: Deps["mode"] = { database: "memory", cache: "memory" },
	fetcher?: typeof fetch,
): Deps {
	const content = new ContentService(adapters.repository, adapters.cache);
	const releases = new ReleasesService(adapters.repository, adapters.cache);
	return {
		mode,
		...adapters,
		content,
		releases,
		push: new PushService(adapters.pushRepository, releases, content, pushConfig(env), fetcher),
		articles: new ArticlesService(adapters.repository, adapters.cache, content),
		apiKeys: new ApiKeyService(adapters.apiKeyRepository, adapters.cache),
		adminEmails: parseList(env.ADMIN_EMAILS),
		allowedOrigins: parseList(env.ALLOWED_ORIGINS),
	};
}

/** Development token accepted when the API runs without Supabase (`wrangler dev` with no secrets). */
export const DEV_TOKEN = "dev-admin-token";
/** Password for dev@localhost on the OAuth consent page, in the same mode. */
export const DEV_PASSWORD = "dev";

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
		const connect = () =>
			createClient(env.SUPABASE_URL as string, env.SUPABASE_SERVICE_ROLE_KEY as string, {
				auth: { persistSession: false, autoRefreshToken: false },
			});
		const supabase = connect();
		adapters = {
			repository: new SupabaseContentRepository(supabase),
			apiKeyRepository: new SupabaseApiKeyRepository(supabase),
			pushRepository: new SupabasePushRepository(supabase),
			storage: new SupabaseMediaStorage(supabase, env.SUPABASE_STORAGE_BUCKET ?? "media"),
			verifier: new SupabaseTokenVerifier(supabase, connect),
			cache: new MemoryCache(),
			publisher: new NoopPublisher(),
		};
	} else {
		memoryAdapters ??= {
			repository: new MemoryContentRepository(),
			apiKeyRepository: new MemoryApiKeyRepository(),
			pushRepository: new MemoryPushRepository(),
			storage: new MemoryMediaStorage(),
			verifier: new StaticTokenVerifier(
				{ [DEV_TOKEN]: { id: "dev", email: "dev@localhost" } },
				{ "dev@localhost": DEV_PASSWORD },
			),
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
