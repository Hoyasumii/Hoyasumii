import { inMemoryProvider, recordNameOf } from "@afora/core";
import type { IRepositoryProvider } from "@afora/core/adapters";
import type { CreatedApiKey, Link, SiteArticle } from "@portfolio/shared";
import { describe, expect, it } from "vitest";
import { memoryStore } from "../src/container";
import { revokeApiKey, verifyApiKey } from "../src/domain/api-keys";
import { ApiKeys } from "../src/domain/repositories";
import { ADMIN, data, items, setup } from "./helpers";

const link = { label: "Somewhere", url: "https://somewhere.test" };

/** Every operation of `provider`, bound, to override some of them. */
function forwarded(provider: IRepositoryProvider): IRepositoryProvider {
	return {
		capabilities: provider.capabilities,
		findOne: (context, query) => provider.findOne(context, query),
		findMany: (context, query) => provider.findMany(context, query),
		insert: (context, data) => provider.insert(context, data),
		update: (context, data, options) => provider.update(context, data, options),
		remove: (context, id) => provider.remove(context, id),
		count: (context, query) => provider.count(context, query),
		transaction: provider.transaction?.bind(provider),
	};
}

async function createKey(call: ReturnType<typeof setup>["call"]) {
	const response = await call("/admin/api-keys", { method: "POST", token: ADMIN, json: { name: "k", scope: "write" } });
	return data<CreatedApiKey>(response);
}

describe("API key usage", () => {
	it("is never recorded on a revoked key, so a revocation is not undone", async () => {
		const { call, run, cache } = setup();
		const { apiKey } = await createKey(call);

		await run(async () => {
			await revokeApiKey(cache, apiKey.id);
			expect(await ApiKeys.touch(apiKey.id, new Date().toISOString())).toBe(false);
			const stored = await ApiKeys.findById(apiKey.id);
			expect(stored?.revokedAt).toBeTruthy();
			expect(stored?.lastUsedAt).toBeUndefined();
		});
	});

	it("keeps a key revoked when the revocation lands between reading the key and recording its use", async () => {
		// A store that revokes the key right after the usage write reads it, the moment a write of the
		// whole row would carry the stale "not revoked" back.
		let between: (() => Promise<unknown>) | undefined;
		const base = inMemoryProvider();
		const provider: IRepositoryProvider = {
			...forwarded(base),
			findOne: async (context, query) => {
				const row = await base.findOne(context, query);
				const usageRead = recordNameOf(context.entity) === "api_keys" && query?.where?.id !== undefined;
				if (usageRead && between) {
					const revoke = between;
					between = undefined;
					await revoke();
				}
				return row;
			},
		};
		const { call, run, cache } = setup({ store: memoryStore(undefined, provider) });
		const { key, apiKey } = await createKey(call);

		await run(async () => {
			const work: Promise<unknown>[] = [];
			between = () => revokeApiKey(cache, apiKey.id);
			expect(await verifyApiKey(cache, key, (job) => work.push(job))).toMatchObject({ id: apiKey.id });
			await Promise.all(work);
			if (between) await between(); // the usage write read nothing: revoke now

			expect((await ApiKeys.findById(apiKey.id))?.revokedAt).toBeTruthy();
			expect(await verifyApiKey(cache, key)).toBeNull();
		});
	});

	it("is recorded on an active key", async () => {
		const { call, run, cache } = setup();
		const { key, apiKey } = await createKey(call);

		await run(async () => {
			const work: Promise<unknown>[] = [];
			await verifyApiKey(cache, key, (job) => work.push(job));
			await Promise.all(work);
			expect((await ApiKeys.findById(apiKey.id))?.lastUsedAt).toBeTruthy();
		});
	});
});

describe("reordering", () => {
	it("sets the positions from the order given and leaves unknown ids out", async () => {
		const { call } = setup();
		const list = await items<Link>(await call("/admin/collections/links", { token: ADMIN }));
		const reversed = list.map((entry) => entry.id).reverse();
		const response = await call("/admin/collections/links/order", {
			method: "PUT",
			token: ADMIN,
			json: { ids: ["not-an-entry", ...reversed] },
		});
		const reordered = await items<Link>(response);
		expect(reordered.map((entry) => entry.id)).toEqual(reversed);
		expect(reordered.map((entry) => entry.label)).toEqual(list.map((entry) => entry.label).reverse());
	});
});

describe("entry ids", () => {
	it("404 when they name no entry, whatever their shape", async () => {
		const { call } = setup();
		for (const id of ["abc", "00000000-0000-4000-8000-000000000000"]) {
			const path = `/admin/collections/links/${id}`;
			expect((await call(path, { token: ADMIN })).status).toBe(404);
			expect((await call(path, { method: "PUT", token: ADMIN, json: link })).status).toBe(404);
			expect((await call(path, { method: "DELETE", token: ADMIN })).status).toBe(404);
		}
		expect((await call("/admin/api-keys/abc", { method: "DELETE", token: ADMIN })).status).toBe(404);
	});
});

describe("slugs", () => {
	const article = {
		title: "Hi",
		slug: "hi",
		lang: "pt",
		excerpt: "",
		body: "x",
		cover: "",
		tags: [],
		publishedAt: "2026-11-11",
		published: true,
	};

	it("can't be taken by another entry on update either", async () => {
		const { call } = setup();
		await call("/admin/collections/articles", { method: "POST", token: ADMIN, json: article });
		const other = await data<SiteArticle>(
			await call("/admin/collections/articles", { method: "POST", token: ADMIN, json: { ...article, slug: "other" } }),
		);
		const response = await call(`/admin/collections/articles/${other.id}`, {
			method: "PUT",
			token: ADMIN,
			json: article,
		});
		expect(response.status).toBe(409);
		expect(((await response.json()) as { detail: string }).detail).toContain("hi");

		// Keeping its own slug is fine.
		const kept = await call(`/admin/collections/articles/${other.id}`, {
			method: "PUT",
			token: ADMIN,
			json: { ...article, slug: "other", title: "Renamed" },
		});
		expect(kept.status).toBe(200);
	});
});

describe("the in-memory store", () => {
	it("seeds again after a seed that failed", async () => {
		let attempts = 0;
		const store = memoryStore(async () => {
			attempts++;
			if (attempts === 1) throw new Error("seed failed");
		});
		await expect(store.prepare()).rejects.toThrow("seed failed");
		await expect(store.prepare()).resolves.toBeUndefined();
		await store.prepare();
		expect(attempts).toBe(2);
	});

	it("belongs to its own API: two of them never see each other's entries", async () => {
		const first = setup();
		const second = setup();
		const create = (api: ReturnType<typeof setup>, label: string) =>
			api.call("/admin/collections/links", { method: "POST", token: ADMIN, json: { ...link, label } });
		const labels = async (api: ReturnType<typeof setup>) =>
			(await items<Link>(await api.call("/admin/collections/links", { token: ADMIN }))).map((entry) => entry.label);

		// Interleaved, as concurrent requests in one process would be.
		await Promise.all([create(first, "first"), create(second, "second"), create(first, "first again")]);
		const [inFirst, inSecond] = await Promise.all([labels(first), labels(second)]);
		expect(inFirst).toEqual(expect.arrayContaining(["first", "first again"]));
		expect(inFirst).not.toContain("second");
		expect(inSecond).toContain("second");
		expect(inSecond).not.toContain("first");
	});
});

describe("image uploads from a URL", () => {
	const SIX_MB = 6 * 1024 * 1024;

	/** A response streamed in chunks, with no content-length. */
	function streamed(size: number) {
		let sent = 0;
		const body = new ReadableStream<Uint8Array>({
			pull(controller) {
				if (sent >= size) return controller.close();
				const chunk = new Uint8Array(Math.min(64 * 1024, size - sent));
				sent += chunk.byteLength;
				controller.enqueue(chunk);
			},
		});
		return new Response(body, { headers: { "content-type": "image/png" } });
	}

	async function upload(size: number) {
		const requested: string[] = [];
		const fetcher = (async (input: RequestInfo | URL) => {
			requested.push(String(input));
			return streamed(size);
		}) as typeof fetch;
		const { call } = setup({ fetcher });
		const { key } = await createKey(call);
		const response = await call("/mcp", {
			method: "POST",
			token: key,
			headers: { Accept: "application/json, text/event-stream" },
			json: {
				jsonrpc: "2.0",
				id: 1,
				method: "tools/call",
				params: { name: "upload_image_from_url", arguments: { url: "https://images.test/a.png" } },
			},
		});
		const { result } = (await response.json()) as { result: { isError?: boolean; content: { text: string }[] } };
		return { requested, isError: Boolean(result.isError), text: result.content[0].text };
	}

	it("download through the API's fetcher", async () => {
		const { requested, isError, text } = await upload(1024);
		expect(requested).toEqual(["https://images.test/a.png"]);
		expect(isError).toBe(false);
		expect(text).toContain("data:image/png;base64,");
	});

	it("refuse a body over 5 MB even without content-length", async () => {
		const { isError, text } = await upload(SIX_MB);
		expect(isError).toBe(true);
		expect(text).toContain("larger than 5 MB");
	});
});
