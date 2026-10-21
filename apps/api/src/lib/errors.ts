import type { ContentfulStatusCode } from "hono/utils/http-status";

export class HttpError extends Error {
	constructor(
		readonly status: ContentfulStatusCode,
		readonly code: string,
		message: string,
		readonly issues?: unknown,
	) {
		super(message);
		this.name = "HttpError";
	}
}

export const notFound = (what: string) => new HttpError(404, "not_found", `${what} not found`);
export const unauthorized = (message = "Missing or invalid token") => new HttpError(401, "unauthorized", message);
export const forbidden = () => new HttpError(403, "forbidden", "This account cannot edit the site");
export const badRequest = (message: string, issues?: unknown) => new HttpError(400, "bad_request", message, issues);
