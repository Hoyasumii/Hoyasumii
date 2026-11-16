import { RepositoryUniqueViolation, repositoryOf } from "@afora/core";
import { providerContract } from "@afora/core/testing";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { Article } from "../src/domain/entities";
import { documentsMapping, entriesMapping, portfolioTables, SupabaseProvider } from "../src/providers/supabase";

describe("Supabase table mappings", () => {
	it("keeps an entry's fields in data and its identity in columns", () => {
		const mapping = entriesMapping("links");
		const row = mapping.toRow({ id: "a", position: 2, createdAt: "2026-01-01T00:00:00.000Z", label: "X", url: "u" });
		expect(row).toEqual({
			id: "a",
			position: 2,
			created_at: "2026-01-01T00:00:00.000Z",
			data: { label: "X", url: "u" },
		});
		expect(mapping.fromRow({ ...row, collection: "links", updated_at: null })).toEqual({
			id: "a",
			position: 2,
			createdAt: "2026-01-01T00:00:00.000Z",
			label: "X",
			url: "u",
		});
		expect(mapping.column("slug")).toBe("data->>slug");
		expect(mapping.scope).toEqual({ collection: "links" });
	});

	it("maps settings by key and API keys by snake_case columns", () => {
		expect(portfolioTables.settings.toRow({ id: "seo", value: { title: "t" }, createdAt: "d" })).toEqual({
			key: "seo",
			value: { title: "t" },
			updated_at: "d",
		});
		expect(portfolioTables.api_keys.fromRow({ id: "k", last_used_at: null, revoked_at: "r" })).toEqual({
			id: "k",
			revokedAt: "r",
		});
		expect(
			portfolioTables.push_subscriptions.toRow({
				id: "s",
				endpoint: "https://push.example/a",
				keys: { p256dh: "p", auth: "a" },
				locale: "pt",
				createdAt: "d",
			}),
		).toEqual({ id: "s", endpoint: "https://push.example/a", p256dh: "p", auth: "a", locale: "pt", created_at: "d" });
	});
});

/**
 * The afora provider contract, against a real Supabase: `supabase start`, then
 * SUPABASE_TEST_URL=http://127.0.0.1:54321 SUPABASE_TEST_KEY=<service role key> bun --filter @portfolio/api test
 */
const url = process.env.SUPABASE_TEST_URL;
const key = process.env.SUPABASE_TEST_KEY;

if (url && key) {
	const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
	providerContract(
		{ describe, it, expect },
		async () => {
			const { error } = await client.from("afora_contract").delete().neq("entity", "");
			if (error) throw new Error(error.message);
			return new SupabaseProvider(client, {}, (name) => documentsMapping("afora_contract", name));
		},
		{ transactions: false, keyset: false, indexes: false, versioning: false, atomic: false, expiry: false },
	);

	describe("Supabase provider unique keys", () => {
		it("refuses a value another row holds, even when the row being written comes first", async () => {
			const entity = "unique-keys";
			await client.from("afora_contract").delete().eq("entity", entity);
			// Two rows already sharing a slug (as rows written before the rule would), "a" sorting first.
			const { error } = await client.from("afora_contract").insert([
				{ entity, id: "a", data: { slug: "same" } },
				{ entity, id: "b", data: { slug: "same" } },
			]);
			if (error) throw new Error(error.message);

			const provider = new SupabaseProvider(client, {}, () => documentsMapping("afora_contract", entity));
			const articles = repositoryOf({ entity: Article, actions: ["update"], provider });
			const article = new Article({
				id: "a",
				position: 0,
				title: "A",
				slug: "same",
				lang: "pt",
				excerpt: "",
				body: "",
				cover: "",
				tags: [],
				publishedAt: "2026-11-16",
				published: false,
			});
			await expect(articles.update(article)).rejects.toBeInstanceOf(RepositoryUniqueViolation);
			await client.from("afora_contract").delete().eq("entity", entity);
		});
	});
} else {
	describe.skip("Supabase provider contract (set SUPABASE_TEST_URL and SUPABASE_TEST_KEY)", () => {
		it("runs against a local Supabase", () => {});
	});
}
