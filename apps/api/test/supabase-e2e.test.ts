import type { Content, Project, SiteArticle } from "@portfolio/shared";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { runtimeFromEnv } from "../src/container";
import { createApiKey } from "../src/domain/api-keys";
import { store } from "../src/domain/repositories";
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
		store.use(new SupabaseProvider(createClient(url as string, key as string)));
		await seedDefaults();
		const { key: token } = await createApiKey({ name: `e2e ${Date.now()}`, scope: "write" });

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
