import type { ApiKeyScope } from "@portfolio/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionUser = { id: string; email: string };

/**
 * Who is calling an admin endpoint: the owner signed in to the panel, one of their API keys, or an
 * app they authorized with OAuth (an MCP connector such as claude.ai).
 */
export type Principal =
	| (SessionUser & { via: "session"; scope: "write" })
	| { via: "api-key"; id: string; name: string; scope: ApiKeyScope }
	| { via: "oauth"; id: string; name: string; scope: ApiKeyScope };

export interface TokenVerifier {
	/** Returns the user behind a Supabase access token, or null when it is not valid. */
	verify(token: string): Promise<SessionUser | null>;
	/** Checks an email and password, for the OAuth consent page. */
	signIn(email: string, password: string): Promise<SessionUser | null>;
}

/** Asks Supabase Auth about the token, which works with both legacy and asymmetric JWT keys. */
export class SupabaseTokenVerifier implements TokenVerifier {
	constructor(
		private readonly client: SupabaseClient,
		/**
		 * A fresh client for each password sign-in: signing in stores the user's session on the
		 * client, and the shared service-role client must keep querying as the service role.
		 */
		private readonly newAuthClient: () => SupabaseClient,
	) {}

	async verify(token: string) {
		const { data, error } = await this.client.auth.getUser(token);
		if (error || !data.user?.email) return null;
		// An unconfirmed address proves nothing: anyone can sign up with someone else's email.
		if (!data.user.email_confirmed_at) return null;
		return { id: data.user.id, email: data.user.email };
	}

	async signIn(email: string, password: string) {
		const { data, error } = await this.newAuthClient().auth.signInWithPassword({ email, password });
		if (error || !data.user?.email || !data.user.email_confirmed_at) return null;
		return { id: data.user.id, email: data.user.email };
	}
}

/** Dev/test verifier: accepts the tokens it was given. */
export class StaticTokenVerifier implements TokenVerifier {
	constructor(
		private readonly users: Record<string, SessionUser>,
		/** email → password accepted by signIn. */
		private readonly passwords: Record<string, string> = {},
	) {}

	async verify(token: string) {
		return this.users[token] ?? null;
	}

	async signIn(email: string, password: string) {
		if (this.passwords[email] !== password) return null;
		return Object.values(this.users).find((user) => user.email === email) ?? null;
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
	if (principal.via === "session") return principal.email;
	return principal.via === "api-key" ? `API key "${principal.name}"` : `app "${principal.name}"`;
}
