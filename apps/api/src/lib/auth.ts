import { Forbidden, Unauthenticated } from "@afora/core";
import type { Authenticator } from "@afora/core/adapters";
import type { Context } from "hono";
import type { AppEnv } from "../app";
import { isApiKey, verifyApiKey } from "../domain/api-keys";
import type { Adapters, Background, Services } from "../domain/services";
import { describePrincipal, type Principal } from "../services/auth";

/** Runs work after the response is sent when possible. */
export function inBackground(c: Context<AppEnv>, work: Promise<unknown>) {
	try {
		c.executionCtx.waitUntil(work);
	} catch {
		// No execution context outside Workers (tests): the promise simply runs on its own.
	}
}

export function bearer(header: string | undefined): string {
	return header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
}

/** A valid panel session whose email is not in ADMIN_EMAILS. */
export class NotAnAdmin extends Error {
	constructor() {
		super("This account cannot edit the site");
	}
}

/**
 * Resolves a bearer token (an API key `pk_…` or a panel session) to its principal, or null when
 * it is not valid. Throws NotAnAdmin for a valid session outside ADMIN_EMAILS.
 */
export async function authenticateToken(
	adapters: Adapters,
	token: string,
	background?: Background,
): Promise<Principal | null> {
	if (isApiKey(token)) {
		const key = await verifyApiKey(adapters.cache, token, background);
		return key ? { via: "api-key", id: key.id, name: key.name, scope: key.scope } : null;
	}

	const user = await adapters.verifier.verify(token);
	if (!user) return null;
	if (!adapters.adminEmails.includes(user.email.toLowerCase())) throw new NotAnAdmin();
	return { ...user, via: "session", scope: "write" };
}

/**
 * The principal afora checks `access` against: `admin:read` for everyone, `admin:write` for
 * sessions and write keys, `session` only for the owner's session. Its claims fill the context of
 * admin operations (see domain/services.ts).
 */
export function aforaPrincipal(principal: Principal) {
	const scopes = ["admin:read"];
	if (principal.scope === "write") scopes.push("admin:write");
	if (principal.via === "session") scopes.push("session");
	return {
		subject: principal.id,
		scopes,
		claims: {
			via: principal.via,
			scope: principal.scope,
			actor: describePrincipal(principal),
			...(principal.via === "session" ? { email: principal.email } : { name: principal.name }),
		},
	};
}

/** The `authenticator` of the hono sink: who calls, from `Authorization: Bearer …`. */
export const authenticator: Authenticator = async (request) => {
	const c = request.native as Context<AppEnv>;
	const token = bearer(request.header("authorization"));
	if (!token) return null;
	const services = c.get("services");
	try {
		const principal = await authenticateToken(services, token, services.background);
		if (!principal) {
			throw new Unauthenticated({
				source: "authenticator",
				message: isApiKey(token) ? "Invalid or revoked API key" : "Missing or invalid token",
			});
		}
		return aforaPrincipal(principal);
	} catch (error) {
		if (error instanceof NotAnAdmin) {
			throw new Forbidden({ source: "authenticator", message: error.message, details: { reason: "scope" } as never });
		}
		throw error;
	}
};

/** For the routes outside the output (/mcp, /admin/media): the caller, or null when unauthenticated. */
export async function authenticate(c: Context<AppEnv>, services: Services): Promise<Principal | null> {
	const token = bearer(c.req.header("Authorization"));
	if (!token) return null;
	return authenticateToken(services, token, services.background);
}
