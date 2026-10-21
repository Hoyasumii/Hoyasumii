import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import type { Deps } from "./container";
import type { Env } from "./env";
import { HttpError } from "./lib/errors";
import { adminRoutes } from "./routes/admin";
import { publicRoutes } from "./routes/public";
import type { AdminUser } from "./services/auth";

export type AppEnv = {
	Bindings: Env;
	Variables: { deps: Deps; user: AdminUser };
};

export function createApp(resolveDeps: (env: Env) => Deps) {
	const app = new Hono<AppEnv>();

	app.use(secureHeaders());
	app.use(async (c, next) => {
		c.set("deps", resolveDeps(c.env ?? {}));
		await next();
	});

	app.use(
		"/admin/*",
		cors({
			origin: (origin, c) => (c.get("deps").allowedOrigins.includes(origin.toLowerCase()) ? origin : null),
			allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
			allowHeaders: ["Authorization", "Content-Type"],
			maxAge: 86400,
		}),
	);
	app.use("*", cors({ origin: "*", allowMethods: ["GET", "OPTIONS"] }));

	app.get("/", (c) => c.json({ data: { name: "portfolio-api", status: "ok" } }));
	app.route("/", publicRoutes);
	app.route("/admin", adminRoutes);

	app.notFound((c) => c.json({ error: { code: "not_found", message: "Route not found" } }, 404));

	app.onError((error, c) => {
		if (error instanceof HttpError) {
			return c.json({ error: { code: error.code, message: error.message, issues: error.issues } }, error.status);
		}
		if (error instanceof HTTPException) {
			return c.json({ error: { code: "http_error", message: error.message } }, error.status);
		}
		console.error(error);
		return c.json({ error: { code: "internal_error", message: "Something went wrong" } }, 500);
	});

	return app;
}
