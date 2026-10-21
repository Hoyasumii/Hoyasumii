import type {
	ApiKey,
	ApiKeyCreate,
	Article,
	ArticleSummary,
	CollectionInput,
	CollectionName,
	Content,
	CreatedApiKey,
	Entry,
	McpServer,
	OAuthConnection,
	Settings,
	SettingsKey,
} from "./schema";

export type ApiErrorBody = {
	error: { code: string; message: string; issues?: unknown };
};

export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
		readonly issues?: unknown,
	) {
		super(message);
		this.name = "ApiError";
	}
}

export type ClientOptions = {
	baseUrl: string;
	/** Returns the Supabase access token for admin requests. */
	getToken?: () => Promise<string | null | undefined> | string | null | undefined;
	fetch?: typeof fetch;
	/** Extra options for every request, e.g. Next.js `{ next: { tags } }`. */
	init?: RequestInit & Record<string, unknown>;
};

/** Typed client for the portfolio API, shared by the website and the admin panel. */
export function createPortfolioClient({ baseUrl, getToken, fetch: fetcher = fetch, init }: ClientOptions) {
	const root = baseUrl.replace(/\/$/, "");

	async function request<T>(path: string, options: RequestInit = {}, auth = false): Promise<T> {
		const headers = new Headers(options.headers);
		if (options.body && !(options.body instanceof FormData)) {
			headers.set("Content-Type", "application/json");
		}
		if (auth) {
			const token = await getToken?.();
			if (!token) throw new ApiError(401, "unauthorized", "Not signed in");
			headers.set("Authorization", `Bearer ${token}`);
		}

		const response = await fetcher(`${root}${path}`, { ...init, ...options, headers });
		const body = (await response.json().catch(() => null)) as { data: T } | ApiErrorBody | null;

		if (!response.ok || !body || "error" in body) {
			const error = body && "error" in body ? body.error : undefined;
			throw new ApiError(
				response.status,
				error?.code ?? "http_error",
				error?.message ?? response.statusText,
				error?.issues,
			);
		}
		return body.data;
	}

	const json = (method: string, value: unknown): RequestInit => ({
		method,
		body: JSON.stringify(value),
	});

	return {
		getContent: () => request<Content>("/content"),
		getArticles: () => request<ArticleSummary[]>("/articles"),
		getArticle: (slug: string) => request<Article>(`/articles/${encodeURIComponent(slug)}`),

		getSettings: <K extends SettingsKey>(key: K) => request<Settings[K]>(`/admin/settings/${key}`, {}, true),
		updateSettings: <K extends SettingsKey>(key: K, value: Settings[K]) =>
			request<Settings[K]>(`/admin/settings/${key}`, json("PUT", value), true),

		list: <N extends CollectionName>(name: N) =>
			request<Entry<CollectionInput<N>>[]>(`/admin/collections/${name}`, {}, true),
		create: <N extends CollectionName>(name: N, input: CollectionInput<N>) =>
			request<Entry<CollectionInput<N>>>(`/admin/collections/${name}`, json("POST", input), true),
		update: <N extends CollectionName>(name: N, id: string, input: CollectionInput<N>) =>
			request<Entry<CollectionInput<N>>>(
				`/admin/collections/${name}/${encodeURIComponent(id)}`,
				json("PUT", input),
				true,
			),
		remove: <N extends CollectionName>(name: N, id: string) =>
			request<{ id: string }>(`/admin/collections/${name}/${encodeURIComponent(id)}`, { method: "DELETE" }, true),
		reorder: <N extends CollectionName>(name: N, ids: string[]) =>
			request<Entry<CollectionInput<N>>[]>(`/admin/collections/${name}/order`, json("PUT", { ids }), true),

		listApiKeys: () => request<ApiKey[]>("/admin/api-keys", {}, true),
		createApiKey: (input: ApiKeyCreate) => request<CreatedApiKey>("/admin/api-keys", json("POST", input), true),
		revokeApiKey: (id: string) =>
			request<ApiKey>(`/admin/api-keys/${encodeURIComponent(id)}`, { method: "DELETE" }, true),

		getMcpServer: () => request<McpServer>("/admin/mcp", {}, true),

		listConnections: () => request<OAuthConnection[]>("/admin/connections", {}, true),
		revokeConnection: (id: string) =>
			request<{ id: string }>(`/admin/connections/${encodeURIComponent(id)}`, { method: "DELETE" }, true),

		/** Rebuilds the website now (saving already does this). */
		publish: () => request<{ queued: boolean }>("/admin/publish", { method: "POST" }, true),

		uploadMedia: (file: File) => {
			const form = new FormData();
			form.set("file", file);
			return request<{ url: string; path: string }>("/admin/media", { method: "POST", body: form }, true);
		},
	};
}

export type PortfolioClient = ReturnType<typeof createPortfolioClient>;
