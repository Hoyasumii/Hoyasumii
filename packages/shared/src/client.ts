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
	PushKey,
	PushReport,
	PushStatus,
	PushSubscriptionInput,
	Release,
	Settings,
	SettingsKey,
} from "./schema";

/** An error response of the API: RFC 9457 problem details (`application/problem+json`). */
export type ApiProblem = {
	type: string;
	/** The name of the error, e.g. "InvalidUseCaseInput" or "EntryNotFound". */
	title: string;
	status: number;
	detail?: string;
	layer?: string;
	/** Invalid input (400): where each problem is and what to fix. */
	issues?: { path: (string | number)[]; code: string; message: string }[];
};

/** Strips the property name afora puts before a custom message, which the panel already shows. */
const issueMessage = (message: string) => message.replace(/^Invalid value for property "[^"]*": /, "");

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
		const body = (await response.json().catch(() => null)) as unknown;

		if (!response.ok) {
			const problem = (body ?? {}) as Partial<ApiProblem>;
			throw new ApiError(
				response.status,
				problem.title ?? "http_error",
				problem.detail ?? response.statusText,
				problem.issues?.map((issue) => ({ ...issue, message: issueMessage(issue.message) })),
			);
		}
		return body as T;
	}

	/** Lists come wrapped as `{ items }`. */
	const list = async <T>(path: string, options: RequestInit = {}, auth = false): Promise<T[]> =>
		(await request<{ items: T[] }>(path, options, auth)).items;

	const json = (method: string, value: unknown): RequestInit => ({
		method,
		body: JSON.stringify(value),
	});

	return {
		getContent: () => request<Content>("/content"),
		getArticles: () => list<ArticleSummary>("/articles"),
		getArticle: (slug: string) => request<Article>(`/articles/${encodeURIComponent(slug)}`),
		/** Published release notes, newest first. */
		getReleases: () => list<Release>("/releases"),

		getPushKey: () => request<PushKey>("/push/key"),
		subscribePush: (subscription: PushSubscriptionInput) =>
			request<{ subscribed: true }>("/push/subscriptions", json("POST", subscription)),
		unsubscribePush: (endpoint: string) =>
			request<{ subscribed: false }>(`/push/subscriptions?endpoint=${encodeURIComponent(endpoint)}`, {
				method: "DELETE",
			}),

		getSettings: <K extends SettingsKey>(key: K) => request<Settings[K]>(`/admin/settings/${key}`, {}, true),
		updateSettings: <K extends SettingsKey>(key: K, value: Settings[K]) =>
			request<Settings[K]>(`/admin/settings/${key}`, json("PUT", value), true),

		list: <N extends CollectionName>(name: N) =>
			list<Entry<CollectionInput<N>>>(`/admin/collections/${name}`, {}, true),
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
			list<Entry<CollectionInput<N>>>(`/admin/collections/${name}/order`, json("PUT", { ids }), true),

		listApiKeys: () => list<ApiKey>("/admin/api-keys", {}, true),
		createApiKey: (input: ApiKeyCreate) => request<CreatedApiKey>("/admin/api-keys", json("POST", input), true),
		revokeApiKey: (id: string) =>
			request<ApiKey>(`/admin/api-keys/${encodeURIComponent(id)}`, { method: "DELETE" }, true),

		getMcpServer: () => request<McpServer>("/admin/mcp", {}, true),

		listConnections: () => list<OAuthConnection>("/admin/connections", {}, true),
		revokeConnection: (id: string) =>
			request<{ id: string }>(`/admin/connections/${encodeURIComponent(id)}`, { method: "DELETE" }, true),

		getPushStatus: () => request<PushStatus>("/admin/push", {}, true),
		/** Notifies subscribers about the releases already live on the site (the deploy does this). */
		sendPush: () => request<PushReport>("/admin/push/send", { method: "POST" }, true),

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
