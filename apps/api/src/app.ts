import { type Context, Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Runtime } from "./container";
import { apiOutput } from "./domain/output";
import { SettingsDocuments } from "./domain/repositories";
import type { Services } from "./domain/services";
import type { Env } from "./env";
import { inBackground } from "./lib/auth";
import { publicOrigin } from "./lib/public-url";
import { mcpRoutes } from "./routes/mcp";
import { mediaRoutes } from "./routes/media";
import { oauthRoutes } from "./routes/oauth";

export type AppEnv = {
	Bindings: Env;
	Variables: { services: Services };
};

/** An error outside the afora operations, in the same application/problem+json as theirs. */
export function problem(
	c: Context,
	status: ContentfulStatusCode,
	title: string,
	detail: string,
	extra: Record<string, unknown> = {},
) {
	return c.body(JSON.stringify({ type: `urn:afora:exception:${title}`, title, status, detail, ...extra }), status, {
		"content-type": "application/problem+json",
	});
}

type Check = { ok: true } | { ok: false; error: string };

async function check(run: () => Promise<unknown>): Promise<Check> {
	try {
		await run();
		return { ok: true };
	} catch (error) {
		return { ok: false, error: error instanceof Error ? error.message : String(error) };
	}
}

export function createApp(resolveRuntime: (env: Env) => Runtime) {
	const app = new Hono<AppEnv>();

	app.use(secureHeaders({ xFrameOptions: "DENY" }));
	app.use(async (c, next) => {
		const env = c.env ?? {};
		const { adapters, prepare } = resolveRuntime(env);
		await prepare();
		c.set("services", {
			...adapters,
			background: (work) => inBackground(c, work),
			origin: publicOrigin(env, c.req.url),
			oauth: env.OAUTH_PROVIDER,
		});
		await next();
	});

	const allowed = (origin: string, c: Context<AppEnv>) =>
		c.get("services").allowedOrigins.includes(origin.toLowerCase()) ? origin : null;
	app.use(
		"/admin/*",
		cors({
			origin: allowed,
			allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
			allowHeaders: ["Authorization", "Content-Type"],
			maxAge: 86400,
		}),
	);
	// Visitors (un)subscribe to notifications from the website itself.
	app.use(
		"/push/*",
		cors({
			origin: allowed,
			allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
			allowHeaders: ["Content-Type"],
			maxAge: 86400,
		}),
	);
	app.use("*", cors({ origin: "*", allowMethods: ["GET", "OPTIONS"] }));

	app.get("/", (c) => c.json({ name: "portfolio-api", status: "ok" }));

	/** Says which adapters are in use and whether they answer; never includes credentials. */
	app.get("/health", async (c) => {
		const { cache, mode } = c.get("services");
		const [database, cacheCheck] = await Promise.all([
			check(() => SettingsDocuments.count()),
			check(async () => {
				await cache.set("portfolio:health", Date.now(), 60);
				await cache.get("portfolio:health");
			}),
		]);
		const ok = database.ok && cacheCheck.ok;
		c.header("Cache-Control", "no-store");
		return c.json(
			{ ok, database: { adapter: mode.database, ...database }, cache: { adapter: mode.cache, ...cacheCheck } },
			ok ? 200 : 503,
		);
	});

	app.route("/admin/media", mediaRoutes);
	app.route("/mcp", mcpRoutes);
	app.route("/", oauthRoutes);

	app.notFound((c) => problem(c, 404, "NotFound", "Route not found"));
	app.onError((error, c) => {
		if (error instanceof HTTPException)
			return problem(c, error.status as ContentfulStatusCode, "HttpError", error.message);
		// Message first: Workers logs keep the first argument whole but may cut the stack.
		console.error(`${c.req.method} ${c.req.path} failed: ${error.message}`, error);
		return problem(c, 500, "InternalError", "Internal error.");
	});

	return apiOutput(app as unknown as Hono).build() as unknown as Hono<AppEnv>;
}
