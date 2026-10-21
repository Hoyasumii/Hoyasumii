import {
	type CollectionName,
	collectionNames,
	collectionSchemas,
	reorderSchema,
	type SettingsKey,
	settingsKeys,
	settingsSchemas,
} from "@portfolio/shared";
import { type Context, Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { ZodType, z } from "zod";
import type { AppEnv } from "../app";
import { badRequest, forbidden, HttpError, notFound, unauthorized } from "../lib/errors";
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES } from "../storage/media-storage";

const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
	const header = c.req.header("Authorization") ?? "";
	const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
	if (!token) throw unauthorized();

	const { verifier, adminEmails } = c.get("deps");
	const user = await verifier.verify(token);
	if (!user) throw unauthorized();
	if (!adminEmails.includes(user.email.toLowerCase())) throw forbidden();

	c.set("user", user);
	await next();
});

/** Runs work after the response is sent when possible. */
function inBackground(c: Context<AppEnv>, work: Promise<unknown>) {
	try {
		c.executionCtx.waitUntil(work);
	} catch {
		// No execution context outside Workers (tests): the promise simply runs on its own.
	}
}

function publish(c: Context<AppEnv>, reason: string) {
	const work = c
		.get("deps")
		.publisher.publish(reason)
		.catch((error) => console.error("publishing the website failed", error));
	inBackground(c, work);
}

/** Drops the cached content, then rebuilds the website in the background. */
async function afterChange(c: Context<AppEnv>, reason: string) {
	const { content, articles } = c.get("deps");
	await Promise.all([content.invalidate(), articles.invalidate()]);
	publish(c, reason);
}

function settingsKey(c: Context<AppEnv>): SettingsKey {
	const key = c.req.param("key") as SettingsKey;
	if (!settingsKeys.includes(key)) throw notFound(`Settings "${key}"`);
	return key;
}

function collectionName(c: Context<AppEnv>): CollectionName {
	const name = c.req.param("name") as CollectionName;
	if (!collectionNames.includes(name)) throw notFound(`Collection "${name}"`);
	return name;
}

/** Article slugs are their URLs, so two articles can't share one. */
async function assertUniqueSlug(c: Context<AppEnv>, name: CollectionName, input: unknown, id?: string) {
	if (name !== "articles") return;
	const { slug } = input as { slug: string };
	const taken = (await c.get("deps").repository.list("articles")).some(
		(article) => article.slug === slug && article.id !== id,
	);
	if (taken) throw new HttpError(409, "conflict", `Another article already uses the slug "${slug}"`);
}

async function body<S extends ZodType>(c: Context<AppEnv>, schema: S): Promise<z.output<S>> {
	const raw = await c.req.json().catch(() => {
		throw badRequest("Body must be JSON");
	});
	const result = schema.safeParse(raw);
	if (!result.success) throw badRequest("Invalid request body", result.error.issues);
	return result.data;
}

export const adminRoutes = new Hono<AppEnv>()
	.use(requireAdmin)
	.get("/me", (c) => c.json({ data: c.get("user") }))
	.post("/publish", async (c) => {
		await c.get("deps").publisher.publish(`manual publish by ${c.get("user").email}`);
		return c.json({ data: { queued: true } }, 202);
	})

	.get("/settings/:key", async (c) => {
		const key = settingsKey(c);
		const value = await c.get("deps").repository.getSettings(key);
		return c.json({ data: value ?? (await c.get("deps").content.getPublic())[key] });
	})
	.put("/settings/:key", async (c) => {
		const key = settingsKey(c);
		const value = await body(c, settingsSchemas[key]);
		const saved = await c.get("deps").repository.putSettings(key, value as never);
		await afterChange(c, `settings.${key} updated`);
		return c.json({ data: saved });
	})

	.get("/collections/:name", async (c) => {
		const name = collectionName(c);
		return c.json({ data: await c.get("deps").repository.list(name) });
	})
	.post("/collections/:name", async (c) => {
		const name = collectionName(c);
		const input = await body(c, collectionSchemas[name]);
		await assertUniqueSlug(c, name, input);
		const entry = await c.get("deps").repository.create(name, input as never);
		await afterChange(c, `${name} entry created`);
		return c.json({ data: entry }, 201);
	})
	.put("/collections/:name/order", async (c) => {
		const name = collectionName(c);
		const { ids } = await body(c, reorderSchema);
		const { repository } = c.get("deps");
		await repository.reorder(name, ids);
		await afterChange(c, `${name} reordered`);
		return c.json({ data: await repository.list(name) });
	})
	.put("/collections/:name/:id", async (c) => {
		const name = collectionName(c);
		const input = await body(c, collectionSchemas[name]);
		await assertUniqueSlug(c, name, input, c.req.param("id"));
		const entry = await c.get("deps").repository.update(name, c.req.param("id"), input as never);
		if (!entry) throw notFound("Entry");
		await afterChange(c, `${name} entry updated`);
		return c.json({ data: entry });
	})
	.delete("/collections/:name/:id", async (c) => {
		const name = collectionName(c);
		const id = c.req.param("id");
		if (!(await c.get("deps").repository.remove(name, id))) throw notFound("Entry");
		await afterChange(c, `${name} entry deleted`);
		return c.json({ data: { id } });
	})

	.post("/media", async (c) => {
		const form = await c.req.formData().catch(() => {
			throw badRequest("Body must be multipart/form-data");
		});
		const file = form.get("file");
		if (!(file instanceof File)) throw badRequest('Missing "file" field');
		if (!ALLOWED_MIME_TYPES.includes(file.type)) throw badRequest(`Unsupported file type ${file.type || "(none)"}`);
		if (file.size > MAX_UPLOAD_BYTES) throw badRequest("File is larger than 5 MB");
		return c.json({ data: await c.get("deps").storage.upload(file) }, 201);
	});
