import { Hono } from "hono";
import type { AppEnv } from "../app";

export const publicRoutes = new Hono<AppEnv>()
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
