import { type Content, defaultCollections, type Project, type SiteArticle } from "@portfolio/shared";
import { describe, expect, it, vi } from "vitest";
import { describeError } from "../src/repositories/supabase";
import { SupabaseTokenVerifier } from "../src/services/auth";
import { GitHubDispatchPublisher } from "../src/services/publisher";
import { ADMIN, data, flush, STRANGER, setup } from "./helpers";

const project = {
	...defaultCollections.projects[0],
	name: "New thing",
	featured: false,
};

const article = {
	title: "Hello",
	slug: "hello-world",
	lang: "pt",
	excerpt: "First post",
	body: "# Hello\n\nSome words here.",
	cover: "",
	tags: ["meta"],
	publishedAt: "2026-10-21",
	published: true,
};

describe("public content", () => {
	it("serves the seeded content", async () => {
		const { call } = setup();
		const response = await call("/content");
		expect(response.status).toBe(200);
		const content = await data<Content>(response);
		expect(content.profile.name).toBe("Alan Reis");
		expect(content.projects.length).toBe(defaultCollections.projects.length);
		expect(content).not.toHaveProperty("articles");
	});

	it("is cached until something changes", async () => {
		const { call, repository } = setup();
		const list = vi.spyOn(repository, "list");
		await call("/content");
		const callsAfterFirst = list.mock.calls.length;
		await call("/content");
		expect(list.mock.calls.length).toBe(callsAfterFirst);

		await call("/admin/collections/projects", { method: "POST", token: ADMIN, json: project });
		const content = await data<Content>(await call("/content"));
		expect(content.projects.at(-1)?.name).toBe("New thing");
	});

	it("hides unpublished projects", async () => {
		const { call } = setup();
		await call("/admin/collections/projects", {
			method: "POST",
			token: ADMIN,
			json: { ...project, name: "Draft", published: false },
		});
		const content = await data<Content>(await call("/content"));
		expect(content.projects.some((p) => p.name === "Draft")).toBe(false);
	});
});

describe("health", () => {
	it("reports the adapters in use", async () => {
		const { call } = setup();
		const response = await call("/health");
		expect(response.status).toBe(200);
		expect(await data(response)).toEqual({
			ok: true,
			database: { adapter: "memory", ok: true },
			cache: { adapter: "memory", ok: true },
		});
	});

	it("answers 503 with the reason when the database fails", async () => {
		const { call, repository } = setup();
		vi.spyOn(repository, "lastUpdatedAt").mockRejectedValue(new Error("Invalid API key"));
		const response = await call("/health");
		expect(response.status).toBe(503);
		expect(await data(response)).toMatchObject({ ok: false, database: { ok: false, error: "Invalid API key" } });
	});
});

describe("admin auth", () => {
	it("rejects requests without a token", async () => {
		const { call } = setup();
		expect((await call("/admin/me")).status).toBe(401);
	});

	it("rejects users outside ADMIN_EMAILS", async () => {
		const { call } = setup();
		expect((await call("/admin/me", { token: STRANGER })).status).toBe(403);
	});

	it("accepts the owner, ignoring email case", async () => {
		const { call } = setup();
		const response = await call("/admin/me", { token: ADMIN });
		expect(response.status).toBe(200);
	});

	it("only answers CORS preflights for allowed origins", async () => {
		const { call } = setup();
		const allowed = await call("/admin/me", {
			method: "OPTIONS",
			headers: { Origin: "https://site.test", "Access-Control-Request-Method": "PUT" },
		});
		expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("https://site.test");

		const denied = await call("/admin/me", {
			method: "OPTIONS",
			headers: { Origin: "https://evil.test", "Access-Control-Request-Method": "PUT" },
		});
		expect(denied.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});
});

describe("collections", () => {
	it("validates input", async () => {
		const { call } = setup();
		const response = await call("/admin/collections/projects", {
			method: "POST",
			token: ADMIN,
			json: { name: "" },
		});
		expect(response.status).toBe(400);
		const body = (await response.json()) as { error: { code: string; issues: unknown[] } };
		expect(body.error.code).toBe("bad_request");
		expect(body.error.issues.length).toBeGreaterThan(0);
	});

	it("404s unknown collections and entries", async () => {
		const { call } = setup();
		expect((await call("/admin/collections/nope", { token: ADMIN })).status).toBe(404);
		expect(
			(await call("/admin/collections/projects/missing", { method: "PUT", token: ADMIN, json: project })).status,
		).toBe(404);
	});

	it("creates, updates, reorders and deletes, publishing after each change", async () => {
		const { call, publisher } = setup();

		const created = await data<Project>(
			await call("/admin/collections/projects", { method: "POST", token: ADMIN, json: project }),
		);
		expect(created.id).toBeTruthy();

		const updated = await data<Project>(
			await call(`/admin/collections/projects/${created.id}`, {
				method: "PUT",
				token: ADMIN,
				json: { ...project, name: "Renamed" },
			}),
		);
		expect(updated).toMatchObject({ id: created.id, name: "Renamed", position: created.position });

		const list = await data<Project[]>(await call("/admin/collections/projects", { token: ADMIN }));
		const reversed = list.map((p) => p.id).reverse();
		const reordered = await data<Project[]>(
			await call("/admin/collections/projects/order", { method: "PUT", token: ADMIN, json: { ids: reversed } }),
		);
		expect(reordered.map((p) => p.id)).toEqual(reversed);

		const removed = await call(`/admin/collections/projects/${created.id}`, { method: "DELETE", token: ADMIN });
		expect(removed.status).toBe(200);

		await flush();
		expect(publisher.reasons).toEqual([
			"projects entry created",
			"projects entry updated",
			"projects reordered",
			"projects entry deleted",
		]);
	});
});

describe("settings", () => {
	it("updates the profile", async () => {
		const { call } = setup();
		const content = await data<Content>(await call("/content"));
		const profile = { ...content.profile, location: "Lisboa" };

		const response = await call("/admin/settings/profile", { method: "PUT", token: ADMIN, json: profile });
		expect(response.status).toBe(200);
		expect((await data<Content>(await call("/content"))).profile.location).toBe("Lisboa");
	});

	it("rejects an invalid tint", async () => {
		const { call } = setup();
		const response = await call("/admin/settings/appearance", {
			method: "PUT",
			token: ADMIN,
			json: { iconTint: "#FFF" },
		});
		expect(response.status).toBe(400);
	});
});

describe("articles", () => {
	function withDevTo(setupResult: ReturnType<typeof setup>, items: unknown[]) {
		vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json(items));
		return setupResult;
	}

	it("merges site articles with dev.to and serves drafts to nobody", async () => {
		const ctx = withDevTo(setup(), [
			{
				slug: "from-devto",
				title: "From dev.to",
				description: "x",
				url: "https://dev.to/x",
				published_at: "2025-07-23T10:00:00Z",
				reading_time_minutes: 3,
				tag_list: ["webdev"],
				tags: "webdev",
				language: "en",
				cover_image: null,
			},
		]);

		await ctx.call("/admin/collections/articles", { method: "POST", token: ADMIN, json: article });
		await ctx.call("/admin/collections/articles", {
			method: "POST",
			token: ADMIN,
			json: { ...article, slug: "draft", published: false },
		});

		const list = await data<{ slug: string; source: string }[]>(await ctx.call("/articles"));
		expect(list.map((a) => [a.slug, a.source])).toEqual([
			["hello-world", "site"],
			["from-devto", "devto"],
		]);

		const own = await data<SiteArticle & { format: string }>(await ctx.call("/articles/hello-world"));
		expect(own.format).toBe("markdown");
		expect(own.body).toContain("# Hello");

		expect((await ctx.call("/articles/draft")).status).not.toBe(200);
		vi.restoreAllMocks();
	});

	it("keeps serving site articles when dev.to is down", async () => {
		const ctx = setup();
		vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response("down", { status: 503 }));
		await ctx.call("/admin/collections/articles", { method: "POST", token: ADMIN, json: article });
		const list = await data<unknown[]>(await ctx.call("/articles"));
		expect(list).toHaveLength(1);
		vi.restoreAllMocks();
	});

	it("refuses duplicate slugs", async () => {
		const { call } = setup();
		await call("/admin/collections/articles", { method: "POST", token: ADMIN, json: article });
		const response = await call("/admin/collections/articles", { method: "POST", token: ADMIN, json: article });
		expect(response.status).toBe(409);
	});
});

describe("media", () => {
	it("accepts images and refuses other files", async () => {
		const { call } = setup();
		const image = new FormData();
		image.set("file", new File([new Uint8Array([137, 80, 78, 71])], "a.png", { type: "image/png" }));
		const ok = await call("/admin/media", { method: "POST", token: ADMIN, body: image });
		expect(ok.status).toBe(201);
		expect((await data<{ url: string }>(ok)).url).toMatch(/^data:image\/png;base64,/);

		const text = new FormData();
		text.set("file", new File(["hi"], "a.txt", { type: "text/plain" }));
		expect((await call("/admin/media", { method: "POST", token: ADMIN, body: text })).status).toBe(400);
	});
});

describe("supabase errors", () => {
	it("keeps every detail Supabase returns", () => {
		expect(describeError({ message: "Invalid API key", hint: "Double check your API key." })).toBe(
			"Invalid API key · Double check your API key.",
		);
		expect(describeError({ code: "PGRST205" })).toBe("code PGRST205");
		expect(describeError({} as never)).toBe("{}");
		expect(describeError(null)).toBe("no data returned");
	});
});

describe("supabase token verifier", () => {
	function verifierFor(user: Record<string, unknown> | null) {
		const client = { auth: { getUser: async () => ({ data: { user }, error: null }) } };
		return new SupabaseTokenVerifier(client as never);
	}

	it("accepts confirmed accounts", async () => {
		const user = { id: "1", email: "owner@example.com", email_confirmed_at: "2026-10-21T00:00:00Z" };
		expect(await verifierFor(user).verify("t")).toEqual({ id: "1", email: "owner@example.com" });
	});

	it("rejects accounts whose email was never confirmed", async () => {
		const user = { id: "1", email: "owner@example.com", email_confirmed_at: null };
		expect(await verifierFor(user).verify("t")).toBeNull();
	});
});

describe("publish", () => {
	it("explains why GitHub refused the rebuild", async () => {
		const { call, deps } = setup();
		vi.spyOn(deps.publisher, "publish").mockRejectedValue(
			new Error("403 Resource not accessible by personal access token"),
		);
		const response = await call("/admin/publish", { method: "POST", token: ADMIN });
		expect(response.status).toBe(502);
		const body = (await response.json()) as { error: { code: string; message: string } };
		expect(body.error.code).toBe("publish_failed");
		expect(body.error.message).toContain("403 Resource not accessible");
	});

	it("adds a hint for the usual token mistakes", async () => {
		const fetcher = async () =>
			Response.json({ message: "Resource not accessible by personal access token" }, { status: 403 });
		const publisher = new GitHubDispatchPublisher("owner/repo", "token", fetcher as typeof fetch);
		await expect(publisher.publish("test")).rejects.toThrow(/403 Resource not accessible.*Contents: Read and write/);
	});
});

describe("github dispatch publisher", () => {
	it("calls fetch unbound, as Workers require", async () => {
		const original = globalThis.fetch;
		let receiver: unknown = "not called";
		globalThis.fetch = function (this: unknown) {
			receiver = this;
			return Promise.resolve(new Response(null, { status: 204 }));
		} as typeof fetch;
		try {
			await new GitHubDispatchPublisher("owner/repo", "token").publish("test");
		} finally {
			globalThis.fetch = original;
		}
		expect(receiver).toBeUndefined();
	});
});
