import { apiKeyCreateSchema, reorderSchema } from "@portfolio/shared";
import { type Context, Hono } from "hono";
import type { ZodType, z } from "zod";
import type { AppEnv } from "../app";
import { requireAdmin, requireSession } from "../lib/auth";
import { badRequest, notFound } from "../lib/errors";
import { assertCollection, assertSettingsKey } from "../services/admin";

async function json(c: Context<AppEnv>): Promise<unknown> {
	return c.req.json().catch(() => {
		throw badRequest("Body must be JSON");
	});
}

async function body<S extends ZodType>(c: Context<AppEnv>, schema: S): Promise<z.output<S>> {
	const result = schema.safeParse(await json(c));
	if (!result.success) throw badRequest("Invalid request body", result.error.issues);
	return result.data;
}

const apiKeyRoutes = new Hono<AppEnv>()
	.use(requireSession)
	.get("/", async (c) => c.json({ data: await c.get("deps").apiKeys.list() }))
	.post("/", async (c) => {
		const input = await body(c, apiKeyCreateSchema);
		return c.json({ data: await c.get("deps").apiKeys.create(input) }, 201);
	})
	.delete("/:id", async (c) => {
		const key = await c.get("deps").apiKeys.revoke(c.req.param("id"));
		if (!key) throw notFound("API key");
		return c.json({ data: key });
	});

export const adminRoutes = new Hono<AppEnv>()
	.use(requireAdmin)
	.get("/me", (c) => c.json({ data: c.get("user") }))
	.post("/publish", async (c) => {
		await c.get("admin").publish();
		return c.json({ data: { queued: true } }, 202);
	})
	.route("/api-keys", apiKeyRoutes)

	.get("/settings/:key", async (c) => {
		const key = c.req.param("key");
		assertSettingsKey(key);
		return c.json({ data: await c.get("admin").getSettings(key) });
	})
	.put("/settings/:key", async (c) => {
		const key = c.req.param("key");
		assertSettingsKey(key);
		return c.json({ data: await c.get("admin").putSettings(key, await json(c)) });
	})

	.get("/collections/:name", async (c) => {
		const name = c.req.param("name");
		assertCollection(name);
		return c.json({ data: await c.get("admin").list(name) });
	})
	.post("/collections/:name", async (c) => {
		const name = c.req.param("name");
		assertCollection(name);
		return c.json({ data: await c.get("admin").create(name, await json(c)) }, 201);
	})
	.put("/collections/:name/order", async (c) => {
		const name = c.req.param("name");
		assertCollection(name);
		const { ids } = await body(c, reorderSchema);
		return c.json({ data: await c.get("admin").reorder(name, ids) });
	})
	.put("/collections/:name/:id", async (c) => {
		const name = c.req.param("name");
		assertCollection(name);
		return c.json({ data: await c.get("admin").update(name, c.req.param("id"), await json(c)) });
	})
	.delete("/collections/:name/:id", async (c) => {
		const name = c.req.param("name");
		assertCollection(name);
		return c.json({ data: await c.get("admin").remove(name, c.req.param("id")) });
	})

	.post("/media", async (c) => {
		const form = await c.req.formData().catch(() => {
			throw badRequest("Body must be multipart/form-data");
		});
		const file = form.get("file");
		if (!(file instanceof File)) throw badRequest('Missing "file" field');
		return c.json({ data: await c.get("admin").upload(file) }, 201);
	});
