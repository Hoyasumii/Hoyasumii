import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

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
