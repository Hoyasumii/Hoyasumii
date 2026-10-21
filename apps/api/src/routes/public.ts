import { Hono } from "hono";
import type { AppEnv } from "../app";

type Check = { ok: true } | { ok: false; error: string };

async function check(run: () => Promise<unknown>): Promise<Check> {
	try {
		await run();
		return { ok: true };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export const publicRoutes = new Hono<AppEnv>()
	/** Says which adapters are in use and whether they answer; never includes credentials. */
	.get("/health", async (c) => {
		const { repository, cache, mode } = c.get("deps");
		const [database, cacheCheck] = await Promise.all([
			check(() => repository.lastUpdatedAt()),
			check(async () => {
				await cache.set("portfolio:health", Date.now(), 60);
				await cache.get("portfolio:health");
			}),
		]);
		const ok = database.ok && cacheCheck.ok;
		c.header("Cache-Control", "no-store");
		return c.json(
			{
				data: { ok, database: { adapter: mode.database, ...database }, cache: { adapter: mode.cache, ...cacheCheck } },
			},
			ok ? 200 : 503,
		);
	})
	.get("/content", async (c) => {
		const content = await c.get("deps").content.getPublic();
		c.header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=86400");
		return c.json({ data: content });
	})
	.get("/articles", async (c) => {
		const articles = await c.get("deps").articles.list();
		c.header("Cache-Control", "public, max-age=300, s-maxage=1800");
		return c.json({ data: articles });
	})
	.get("/articles/:slug", async (c) => {
		const article = await c.get("deps").articles.get(c.req.param("slug"));
		c.header("Cache-Control", "public, max-age=300, s-maxage=3600");
		return c.json({ data: article });
	});
