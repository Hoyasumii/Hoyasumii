import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminUser = { id: string; email: string };

export interface TokenVerifier {
	/** Returns the user behind a Supabase access token, or null when it is not valid. */
	verify(token: string): Promise<AdminUser | null>;
}

/** Asks Supabase Auth about the token, which works with both legacy and asymmetric JWT keys. */
export class SupabaseTokenVerifier implements TokenVerifier {
	constructor(private readonly client: SupabaseClient) {}

	async verify(token: string) {
		const { data, error } = await this.client.auth.getUser(token);
		if (error || !data.user?.email) return null;
		return { id: data.user.id, email: data.user.email };
	}
}

/** Dev/test verifier: accepts the tokens it was given. */
export class StaticTokenVerifier implements TokenVerifier {
	constructor(private readonly users: Record<string, AdminUser>) {}

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
