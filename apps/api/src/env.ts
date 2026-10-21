/** Worker bindings. Secrets are set with `wrangler secret put`, plain vars in wrangler.jsonc. */
export type Env = {
	SUPABASE_URL?: string;
	/** Service role (or secret) key: the API is the only writer, so RLS stays closed to clients. */
	SUPABASE_SERVICE_ROLE_KEY?: string;
	SUPABASE_STORAGE_BUCKET?: string;
	UPSTASH_REDIS_REST_URL?: string;
	UPSTASH_REDIS_REST_TOKEN?: string;
	/** Comma-separated emails allowed to use the admin endpoints. */
	ADMIN_EMAILS?: string;
	/** Comma-separated origins allowed to call the admin endpoints from a browser. */
	ALLOWED_ORIGINS?: string;
	/** Website repository ("owner/name") whose Pages workflow rebuilds the site. */
	GITHUB_REPOSITORY?: string;
	/** Fine-grained token with "Contents: read and write" on that repository. */
	GITHUB_DISPATCH_TOKEN?: string;
	DEVTO_USERNAME?: string;
};
