import type { CollectionInput, PushReport, PushStatus, Release } from "@portfolio/shared";
import { describe, expect, it } from "vitest";
import { base64url, generateVapidKeys } from "../src/push/web-push";
import { ADMIN, data, setup } from "./helpers";

const today = () => new Date().toISOString().slice(0, 10);

const release = (overrides: Partial<CollectionInput<"releases">> = {}): CollectionInput<"releases"> => ({
	title: "Skill Icons",
	version: "26.10.3",
	kind: "feature",
	project: "",
	slug: "skill-icons-26-10-3",
	summary: { pt: "Novos ícones.", en: "New icons." },
	body: { pt: "# Novidades", en: "# What's new" },
	cover: "",
	publishedAt: today(),
	published: true,
	notify: true,
	...overrides,
});

/** A browser's subscription: real P-256 and auth keys, so the payload can be encrypted for it. */
async function browserSubscription(endpoint: string, locale: "pt" | "en" = "pt") {
	const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
		"deriveBits",
	])) as CryptoKeyPair;
	const p256dh = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
	return {
		endpoint,
		keys: { p256dh: base64url(p256dh), auth: base64url(crypto.getRandomValues(new Uint8Array(16))) },
		locale,
	};
}

type Sent = { url: string; method: string; headers: Headers; body?: BodyInit | null };

/** Answers the site's pages with `pageStatus` and each push endpoint with its own status. */
function fakeNetwork(pageStatus: () => number, endpoints: Record<string, number> = {}) {
	const sent: Sent[] = [];
	const fetcher = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
		const url = String(input);
		sent.push({ url, method: init.method ?? "GET", headers: new Headers(init.headers), body: init.body });
		if (url.startsWith("https://site.test/")) return new Response(null, { status: pageStatus() });
		return new Response(null, { status: endpoints[url] ?? 201 });
	}) as typeof fetch;
	return { sent, fetcher };
}

async function pushSetup(pageStatus = () => 200, endpoints: Record<string, number> = {}) {
	const keys = await generateVapidKeys();
	const network = fakeNetwork(pageStatus, endpoints);
	const ctx = setup({
		env: {
			VAPID_PUBLIC_KEY: keys.publicKey,
			VAPID_PRIVATE_KEY: keys.privateKey,
			VAPID_SUBJECT: "mailto:owner@example.com",
			PUBLIC_SITE_URL: "https://site.test/",
		},
		fetcher: network.fetcher,
	});
	return { ...ctx, ...network, keys };
}

describe("releases", () => {
	it("are served on their own, published only, newest first", async () => {
		const { call } = setup();
		await call("/admin/collections/releases", {
			method: "POST",
			token: ADMIN,
			json: release({ slug: "older", publishedAt: "2026-01-02" }),
		});
		await call("/admin/collections/releases", { method: "POST", token: ADMIN, json: release({ slug: "newer" }) });
		await call("/admin/collections/releases", {
			method: "POST",
			token: ADMIN,
			json: release({ slug: "draft", published: false }),
		});

		const list = await data<Release[]>(await call("/releases"));
		expect(list.map((item) => item.slug)).toEqual(["newer", "older"]);
		const articles = await data<{ source: string }[]>(await call("/articles"));
		expect(articles.filter((article) => article.source === "site")).toEqual([]);
		expect(await data(await call("/content"))).not.toHaveProperty("releases");
	});

	it("refuses duplicate slugs and unknown projects", async () => {
		const { call } = setup();
		await call("/admin/collections/releases", { method: "POST", token: ADMIN, json: release() });
		const duplicate = await call("/admin/collections/releases", { method: "POST", token: ADMIN, json: release() });
		expect(duplicate.status).toBe(409);

		const unknown = await call("/admin/collections/releases", {
			method: "POST",
			token: ADMIN,
			json: release({ slug: "other", project: "nope" }),
		});
		expect(unknown.status).toBe(400);

		const known = await call("/admin/collections/releases", {
			method: "POST",
			token: ADMIN,
			json: release({ slug: "other", project: "projects-1" }),
		});
		expect(known.status).toBe(201);
	});
});

describe("push", () => {
	it("is off without VAPID keys", async () => {
		const { call } = setup();
		expect(await data(await call("/push/key"))).toEqual({ publicKey: null });
		const subscribe = await call("/push/subscriptions", {
			method: "POST",
			json: await browserSubscription("https://push.example/a"),
		});
		expect(subscribe.status).toBe(503);
		expect((await call("/admin/push/send", { method: "POST", token: ADMIN })).status).toBe(503);
	});

	it("lets the site subscribe and unsubscribe", async () => {
		const { call, keys } = await pushSetup();
		expect(await data(await call("/push/key"))).toEqual({ publicKey: keys.publicKey });

		const preflight = await call("/push/subscriptions", {
			method: "OPTIONS",
			headers: { Origin: "https://site.test", "Access-Control-Request-Method": "POST" },
		});
		expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe("https://site.test");

		const subscription = await browserSubscription("https://push.example/a");
		expect((await call("/push/subscriptions", { method: "POST", json: subscription })).status).toBe(201);
		// Subscribing again (e.g. from the other language) updates instead of duplicating.
		await call("/push/subscriptions", { method: "POST", json: { ...subscription, locale: "en" } });
		expect((await data<PushStatus>(await call("/admin/push", { token: ADMIN }))).subscribers).toBe(1);

		await call("/push/subscriptions", { method: "DELETE", json: { endpoint: subscription.endpoint } });
		expect((await data<PushStatus>(await call("/admin/push", { token: ADMIN }))).subscribers).toBe(0);
	});

	it("refuses subscriptions that are not https push endpoints", async () => {
		const { call } = await pushSetup();
		const response = await call("/push/subscriptions", {
			method: "POST",
			json: await browserSubscription("http://push.example/a"),
		});
		expect(response.status).toBe(400);
	});

	it("sends each live release once, in each subscriber's language", async () => {
		const { call, sent } = await pushSetup(() => 200, { "https://push.example/gone": 410 });
		for (const [endpoint, locale] of [
			["https://push.example/pt", "pt"],
			["https://push.example/en", "en"],
			["https://push.example/gone", "pt"],
		] as const) {
			await call("/push/subscriptions", { method: "POST", json: await browserSubscription(endpoint, locale) });
		}
		await call("/admin/collections/releases", { method: "POST", token: ADMIN, json: release() });
		await call("/admin/collections/releases", {
			method: "POST",
			token: ADMIN,
			json: release({ slug: "quiet", notify: false }),
		});

		const pending = await data<PushStatus>(await call("/admin/push", { token: ADMIN }));
		expect(pending.pending.map((item) => item.title)).toEqual(["Skill Icons 26.10.3"]);

		const report = await data<PushReport>(await call("/admin/push/send", { method: "POST", token: ADMIN }));
		expect(report.sent).toEqual([expect.objectContaining({ slug: "skill-icons-26-10-3", recipients: 2, failed: 0 })]);
		expect(report.removed).toBe(1);

		expect(sent[0]).toMatchObject({ method: "HEAD", url: "https://site.test/pt/releases/skill-icons-26-10-3/" });
		const pushes = sent.filter((request) => request.url.startsWith("https://push.example/"));
		expect(pushes).toHaveLength(3);
		for (const push of pushes) {
			expect(push.headers.get("Content-Encoding")).toBe("aes128gcm");
			expect(push.headers.get("Authorization")).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
			// salt (16) + record size (4) + key length (1) + key (65) + payload + delimiter + tag (16)
			expect((push.body as Uint8Array).length).toBeGreaterThan(86 + 17);
		}

		const again = await data<PushReport>(await call("/admin/push/send", { method: "POST", token: ADMIN }));
		expect(again.sent).toEqual([]);
		const status = await data<PushStatus>(await call("/admin/push", { token: ADMIN }));
		expect(status).toMatchObject({ subscribers: 2, pending: [] });
	});

	it("waits for the page to be deployed, and skips old releases", async () => {
		let page = 404;
		const { call } = await pushSetup(() => page);
		await call("/push/subscriptions", {
			method: "POST",
			json: await browserSubscription("https://push.example/a"),
		});
		await call("/admin/collections/releases", { method: "POST", token: ADMIN, json: release() });
		await call("/admin/collections/releases", {
			method: "POST",
			token: ADMIN,
			json: release({ slug: "ancient", publishedAt: "2020-01-01" }),
		});

		const first = await data<PushReport>(await call("/admin/push/send", { method: "POST", token: ADMIN }));
		expect(first).toMatchObject({ sent: [], waiting: ["skill-icons-26-10-3"], skipped: ["ancient"] });

		page = 200;
		const second = await data<PushReport>(await call("/admin/push/send", { method: "POST", token: ADMIN }));
		expect(second.sent.map((item) => item.slug)).toEqual(["skill-icons-26-10-3"]);
		expect(second.skipped).toEqual([]);
	});
});

describe("MCP", () => {
	async function callTool(call: ReturnType<typeof setup>["call"], name: string, args: unknown) {
		const response = await call("/mcp", {
			method: "POST",
			token: ADMIN,
			headers: { Accept: "application/json, text/event-stream" },
			json: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
		});
		return ((await response.json()) as { result: { isError?: boolean; content: { text: string }[] } }).result;
	}

	it("offers a release note after creating a project, and writes releases", async () => {
		const { call } = setup();
		const project = await callTool(call, "create_entry", {
			collection: "projects",
			data: {
				name: "New thing",
				kind: { pt: "Lib", en: "Lib" },
				year: "2026",
				summary: { pt: "", en: "" },
				cover: "",
				stack: [],
				featured: false,
				published: true,
				links: { repo: "", site: "", docs: "", npm: "" },
				parts: [],
			},
		});
		expect(project.isError).toBeFalsy();
		expect(project.content.at(-1)?.text).toContain("release note");

		const { id } = JSON.parse(project.content[0].text) as { id: string };
		const created = await callTool(call, "create_entry", {
			collection: "releases",
			data: release({ title: "New thing", version: "", kind: "launch", project: id, slug: "new-thing" }),
		});
		expect(created.isError).toBeFalsy();
		expect((await data<Release[]>(await call("/releases"))).map((item) => item.slug)).toEqual(["new-thing"]);
	});
});
