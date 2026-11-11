import { Exception } from "@afora/core";
import { Hono } from "hono";
import { type AppEnv, problem } from "../app";
import { upload } from "../domain/media";
import { authenticate, NotAnAdmin } from "../lib/auth";

/** `POST /admin/media`: a multipart upload from the panel, by a caller who may write. */
export const mediaRoutes = new Hono<AppEnv>().post("/", async (c) => {
	const services = c.get("services");
	let principal: Awaited<ReturnType<typeof authenticate>>;
	try {
		principal = await authenticate(c, services);
	} catch (error) {
		if (error instanceof NotAnAdmin) return problem(c, 403, "Forbidden", error.message);
		throw error;
	}
	if (!principal) return problem(c, 401, "Unauthenticated", "Missing or invalid token");
	if (principal.scope !== "write") return problem(c, 403, "Forbidden", "This API key can only read");

	const form = await c.req.formData().catch(() => null);
	if (!form) return problem(c, 400, "BadRequest", "Body must be multipart/form-data");
	const file = form.get("file");
	if (!(file instanceof File)) return problem(c, 400, "BadRequest", 'Missing "file" field');
	try {
		return c.json(await upload(services, file), 201);
	} catch (error) {
		if (error instanceof Exception && error.name === "BadRequest") return problem(c, 400, "BadRequest", error.message);
		throw error;
	}
});
