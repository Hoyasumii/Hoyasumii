import type { CreatedApiKey } from "@portfolio/shared";
import { describe, expect, it } from "vitest";
import { ADMIN, data, flush, setup } from "./helpers";

async function createKey(call: ReturnType<typeof setup>["call"], scope: "read" | "write") {
	const response = await call("/admin/api-keys", {
		method: "POST",
		token: ADMIN,
		json: { name: `${scope} key`, scope },
	});
	expect(response.status).toBe(201);
	return data<CreatedApiKey>(response);
}

type RpcResponse = {
	result: {
		isError?: boolean;
		content: { text: string }[];
		tools: { name: string }[];
		serverInfo: { name: string };
		instructions: string;
	};
};

/** Sends one JSON-RPC message to the MCP endpoint. */
async function mcp(call: ReturnType<typeof setup>["call"], token: string, method: string, params: unknown = {}) {
	const response = await call("/mcp", {
		method: "POST",
		token,
		headers: { Accept: "application/json, text/event-stream" },
		json: { jsonrpc: "2.0", id: 1, method, params },
	});
	return { status: response.status, body: (await response.json().catch(() => null)) as RpcResponse };
}

const INIT = {
	protocolVersion: "2025-06-18",
	capabilities: {},
	clientInfo: { name: "test", version: "1.0.0" },
};

describe("API keys", () => {
	it("are shown once and stored only as a hash", async () => {
		const { call, deps } = setup();
		const { key, apiKey } = await createKey(call, "write");
		expect(key).toMatch(/^pk_[A-Za-z0-9_-]{43}$/);
		expect(key.startsWith(apiKey.prefix)).toBe(true);

		const listed = await data<Record<string, unknown>[]>(await call("/admin/api-keys", { token: ADMIN }));
		expect(listed).toHaveLength(1);
		expect(JSON.stringify(listed)).not.toContain(key);
		expect(await deps.apiKeys.verify(key)).toMatchObject({ id: apiKey.id });
	});

	it("authenticate the admin API, and read-only keys cannot write", async () => {
		const { call } = setup();
		const reader = await createKey(call, "read");
		expect((await call("/admin/collections/projects", { token: reader.key })).status).toBe(200);
		const write = await call("/admin/collections/links", {
			method: "POST",
			token: reader.key,
			json: { label: "X", url: "https://x.test" },
		});
		expect(write.status).toBe(403);

		const writer = await createKey(call, "write");
		const created = await call("/admin/collections/links", {
			method: "POST",
			token: writer.key,
			json: { label: "X", url: "https://x.test" },
		});
		expect(created.status).toBe(201);
	});

	it("cannot manage other keys", async () => {
		const { call } = setup();
		const writer = await createKey(call, "write");
		const response = await call("/admin/api-keys", {
			method: "POST",
			token: writer.key,
			json: { name: "minted", scope: "write" },
		});
		expect(response.status).toBe(403);
	});

	it("stop working as soon as they are revoked, despite the cache", async () => {
		const { call } = setup();
		const { key, apiKey } = await createKey(call, "write");
		expect((await call("/admin/me", { token: key })).status).toBe(200);
		expect((await call(`/admin/api-keys/${apiKey.id}`, { method: "DELETE", token: ADMIN })).status).toBe(200);
		expect((await call("/admin/me", { token: key })).status).toBe(401);
	});

	it("reject unknown keys", async () => {
		const { call } = setup();
		expect((await call("/admin/me", { token: "pk_not-a-real-key" })).status).toBe(401);
	});
});

describe("MCP server", () => {
	it("asks for a key", async () => {
		const { call } = setup();
		const response = await call("/mcp", {
			method: "POST",
			json: { jsonrpc: "2.0", id: 1, method: "initialize", params: INIT },
		});
		expect(response.status).toBe(401);
		expect(response.headers.get("WWW-Authenticate")).toContain("Bearer");
	});

	it("initializes and only offers read tools to read-only keys", async () => {
		const { call } = setup();
		const reader = await createKey(call, "read");
		const init = await mcp(call, reader.key, "initialize", INIT);
		expect(init.status).toBe(200);
		expect(init.body.result.serverInfo.name).toBe("hoyasumii-portfolio");
		expect(init.body.result.instructions).toContain("bilingual");

		const tools = (await mcp(call, reader.key, "tools/list")).body.result.tools.map((t: { name: string }) => t.name);
		expect(tools).toContain("list_entries");
		expect(tools).not.toContain("create_entry");
	});

	it("creates, patches and deletes entries through tools, publishing the site", async () => {
		const { call, publisher } = setup();
		const { key } = await createKey(call, "write");
		const callTool = async (name: string, args: Record<string, unknown>) => {
			const { body } = await mcp(call, key, "tools/call", { name, arguments: args });
			const isError = Boolean(body.result.isError);
			const text: string = body.result.content[0].text;
			return { isError, value: isError ? text : JSON.parse(text) };
		};

		const tools = (await mcp(call, key, "tools/list")).body.result.tools.map((t: { name: string }) => t.name);
		expect(tools).toEqual(expect.arrayContaining(["create_entry", "update_entry", "delete_entry", "update_settings"]));

		const schema = await callTool("describe_schema", { target: "links" });
		expect(schema.value.properties).toHaveProperty("label");

		const created = await callTool("create_entry", {
			collection: "links",
			data: { label: "Bluesky", url: "https://bsky.app" },
		});
		expect(created.isError).toBe(false);

		const patched = await callTool("update_entry", {
			collection: "links",
			id: created.value.id,
			data: { label: "Bsky" },
		});
		expect(patched.value).toMatchObject({ label: "Bsky", url: "https://bsky.app" });

		const profile = await callTool("update_settings", { key: "profile", data: { role: { en: "Software Engineer" } } });
		expect(profile.value.role).toEqual({ pt: "Desenvolvedor Fullstack", en: "Software Engineer" });

		const invalid = await callTool("create_entry", { collection: "links", data: { label: "" } });
		expect(invalid.isError).toBe(true);
		expect(invalid.value).toContain("Invalid data");

		await callTool("delete_entry", { collection: "links", id: created.value.id });
		await flush();
		expect(publisher.reasons).toEqual([
			'links entry created by API key "write key"',
			'links entry updated by API key "write key"',
			'settings.profile updated by API key "write key"',
			'links entry deleted by API key "write key"',
		]);
	});
});

describe("MCP server address", () => {
	it("is the /mcp endpoint of the deployed API", async () => {
		const { call } = setup();
		const server = await data<{ url: string }>(await call("/admin/mcp", { token: ADMIN }));
		expect(server.url).toBe("http://localhost/mcp");
		expect((await call("/admin/mcp")).status).toBe(401);
	});
});
