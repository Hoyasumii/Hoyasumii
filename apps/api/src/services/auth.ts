import type { ApiKeyScope } from "@portfolio/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionUser = { id: string; email: string };

/** Who is calling an admin endpoint: the owner signed in to the panel, or one of their API keys. */
export type Principal =
	| (SessionUser & { via: "session"; scope: "write" })
	| { via: "api-key"; id: string; name: string; scope: ApiKeyScope };

export interface TokenVerifier {
	/** Returns the user behind a Supabase access token, or null when it is not valid. */
	verify(token: string): Promise<SessionUser | null>;
}

/** Asks Supabase Auth about the token, which works with both legacy and asymmetric JWT keys. */
export class SupabaseTokenVerifier implements TokenVerifier {
	constructor(private readonly client: SupabaseClient) {}

	async verify(token: string) {
		const { data, error } = await this.client.auth.getUser(token);
		if (error || !data.user?.email) return null;
		// An unconfirmed address proves nothing: anyone can sign up with someone else's email.
		if (!data.user.email_confirmed_at) return null;
		return { id: data.user.id, email: data.user.email };
	}
}

/** Dev/test verifier: accepts the tokens it was given. */
export class StaticTokenVerifier implements TokenVerifier {
	constructor(private readonly users: Record<string, SessionUser>) {}

	async verify(token: string) {
		return this.users[token] ?? null;
	}
}

export function parseList(value: string | undefined): string[] {
	return (value ?? "")
		.split(",")
		.map((item) => item.trim().toLowerCase())
		.filter(Boolean);
}

/** A short label for logs and publish reasons. */
export function describePrincipal(principal: Principal): string {
	return principal.via === "session" ? principal.email : `API key "${principal.name}"`;
}
