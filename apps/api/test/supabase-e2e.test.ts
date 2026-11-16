import type { Content, Project, SiteArticle } from "@portfolio/shared";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { runtimeFromEnv } from "../src/container";
import { createApiKey } from "../src/domain/api-keys";
import { Link } from "../src/domain/entities";
import { ApiKeys, Links, store } from "../src/domain/repositories";
import { seedDefaults } from "../src/domain/seed";
import { SupabaseProvider } from "../src/providers/supabase";

/**
 * The API on the portfolio's real tables, against a local Supabase (`supabase start`, which applies
 * supabase/migrations): SUPABASE_TEST_URL=http://127.0.0.1:54321 SUPABASE_TEST_KEY=<service role key>.
 * It writes to that database, so never point it at production.
 */
const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_KEY;

describe.runIf(url && key)("API on Supabase", () => {
	it("reads and writes every kind of row through the afora provider", async () => {
		const env = { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key, ADMIN_EMAILS: "owner@example.com" };
		const provider = new SupabaseProvider(createClient(url as string, key as string));
		const { key: token } = await store.run(provider, async () => {
			await seedDefaults();
			return createApiKey({ name: `e2e ${Date.now()}`, scope: "write" });
		});

		const app = createApp(runtimeFromEnv);
		const call = async (path: string, init: RequestInit & { json?: unknown } = {}) => {
			const headers = new Headers(init.headers);
			headers.set("Authorization", `Bearer ${token}`);
			if (init.json !== undefined) headers.set("Content-Type", "application/json");
			const body = init.json !== undefined ? JSON.stringify(init.json) : undefined;
			return app.request(path, { ...init, headers, body }, env);
		};

		expect(await (await call("/health")).json()).toMatchObject({ ok: true, database: { adapter: "supabase" } });
		const content = (await (await call("/content")).json()) as Content;
		expect(content.projects.length).toBeGreaterThan(0);

		// Entries: list, reorder, create, conflict, update, delete.
		const links = ((await (await call("/admin/collections/links")).json()) as { items: Project[] }).items;
		const reversed = links.map((link) => link.id).reverse();
		const reordered = await call("/admin/collections/links/order", { method: "PUT", json: { ids: reversed } });
		expect(((await reordered.json()) as { items: Project[] }).items.map((link) => link.id)).toEqual(reversed);

		const slug = `e2e-${Date.now()}`;
		const article = {
			title: "Hi",
			slug,
			lang: "pt",
			excerpt: "",
			body: "x",
			cover: "",
			tags: [],
			publishedAt: "2026-11-11",
			published: true,
		};
		const created = await call("/admin/collections/articles", { method: "POST", json: article });
		expect(created.status).toBe(201);
		const { id } = (await created.json()) as SiteArticle;
		expect((await call("/admin/collections/articles", { method: "POST", json: article })).status).toBe(409);
		const updated = await call(`/admin/collections/articles/${id}`, {
			method: "PUT",
			json: { ...article, title: "Hello" },
		});
		expect(await updated.json()).toMatchObject({ id, title: "Hello" });
		const listed = (await (await call("/articles")).json()) as { items: { slug: string; title: string }[] };
		expect(listed.items.find((item) => item.slug === slug)?.title).toBe("Hello");
		expect((await call(`/admin/collections/articles/${id}`, { method: "DELETE" })).status).toBe(200);
		expect((await call(`/admin/collections/articles/${id}`)).status).toBe(404);

		// Ids that are not uuids name no row: 404, not a Postgres error.
		const unknown = "/admin/collections/articles/abc";
		expect((await call(unknown)).status).toBe(404);
		expect((await call(unknown, { method: "PUT", json: article })).status).toBe(404);
		expect((await call(unknown, { method: "DELETE" })).status).toBe(404);
		expect((await call("/admin/collections/projects/abc")).status).toBe(404);

		// Settings documents.
		const profile = (await (await call("/admin/settings/profile")).json()) as Record<string, unknown>;
		const location = `Lisboa ${Date.now()}`;
		expect((await call("/admin/settings/profile", { method: "PUT", json: { ...profile, location } })).status).toBe(200);
		expect(((await (await call("/content")).json()) as Content).profile.location).toBe(location);

		// API keys (the caller's own, touched on use) and push subscriptions.
		expect(await (await call("/admin/me")).json()).toMatchObject({ via: "api-key", scope: "write" });
		expect((await call("/admin/push")).status).toBe(200);
	});
});

describe.runIf(url && key)("Supabase partial writes", () => {
	/** A provider that counts its whole-row updates. */
	class CountingProvider extends SupabaseProvider {
		updates = 0;
		override async update(...args: Parameters<SupabaseProvider["update"]>) {
			this.updates++;
			return super.update(...args);
		}
	}
	const connect = () =>
		createClient(url as string, key as string, { auth: { persistSession: false, autoRefreshToken: false } });

	it("reorders a collection in one write of the positions alone", async () => {
		const client = connect();
		const provider = new CountingProvider(client);
		await store.run(provider, async () => {
			const created = await Promise.all(
				["a", "b", "c"].map((label, position) =>
					Links.create(new Link({ label: `e2e ${label}`, url: "https://e2e.test", position: 900 + position })),
				),
			);
			const [a, b, c] = created.map((link) => link.id);
			try {
				// An entry edited after the ids were read keeps its edit: the reorder writes positions only.
				await client
					.from("entries")
					.update({ data: { label: "e2e renamed", url: "https://e2e.test" } })
					.eq("id", a);
				provider.updates = 0;
				await Links.reorder([c, "not-a-uuid", a, b]);
				expect(provider.updates).toBe(0);
				const links = await Promise.all([a, b, c].map((id) => Links.findById(id)));
				expect(links[0]?.label).toBe("e2e renamed");
				const positions = Object.fromEntries(links.map((link) => [link?.id, link?.position]));
				expect(positions).toEqual({ [c]: 0, [a]: 2, [b]: 3 });
			} finally {
				for (const id of [a, b, c]) await Links.delete(id).catch(() => {});
			}
		});
	});

	it("records an API key's use without writing anything else, and never on a revoked key", async () => {
		const client = connect();
		await store.run(new SupabaseProvider(client), async () => {
			const { apiKey } = await createApiKey({ name: `e2e touch ${Date.now()}`, scope: "read" });
			const at = new Date().toISOString();
			expect(await ApiKeys.touch(apiKey.id, at)).toBe(true);

			// The key is revoked (and renamed) after the API read it: the touch must not undo either.
			const revokedAt = new Date().toISOString();
			await client.from("api_keys").update({ revoked_at: revokedAt, name: "renamed" }).eq("id", apiKey.id);
			expect(await ApiKeys.touch(apiKey.id, new Date().toISOString())).toBe(false);

			const stored = await ApiKeys.findById(apiKey.id);
			expect(stored?.revokedAt).toBeTruthy();
			expect(stored?.name).toBe("renamed");
			expect(Date.parse(stored?.lastUsedAt ?? "")).toBe(Date.parse(at));
			expect(await ApiKeys.touch("abc", at)).toBe(false);
			expect(await ApiKeys.findById("abc")).toBeUndefined();
		});
	});
});
