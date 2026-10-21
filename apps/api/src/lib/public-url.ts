import type { Env } from "../env";

/** Public address of the API: PUBLIC_API_URL, or the origin of the request in development. */
export function publicOrigin(env: Env | undefined, requestUrl: string): string {
	return (env?.PUBLIC_API_URL ?? new URL(requestUrl).origin).replace(/\/$/, "");
}
