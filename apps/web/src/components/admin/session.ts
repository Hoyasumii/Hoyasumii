"use client";

import { createPortfolioClient, type PortfolioClient } from "@portfolio/shared";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

/** Without Supabase settings the panel talks to a local API running on in-memory adapters. */
export const devMode = !supabaseUrl || !supabaseKey;
const DEV_TOKEN = "dev-admin-token";

let supabase: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
	if (devMode) return null;
	supabase ??= createClient(supabaseUrl as string, supabaseKey as string, {
		auth: { persistSession: true, autoRefreshToken: true },
	});
	return supabase;
}

export type Session =
	| { status: "loading" }
	| { status: "signed-out" }
	| { status: "signed-in"; email: string; api: PortfolioClient; signOut: () => Promise<void> };

export function useSession(): Session {
	const [state, setState] = useState<{ status: "loading" | "signed-out" | "signed-in"; email?: string }>(
		devMode ? { status: "signed-in", email: "dev@localhost" } : { status: "loading" },
	);

	useEffect(() => {
		const client = getSupabase();
		if (!client) return;
		client.auth.getSession().then(({ data }) => {
			setState(data.session ? { status: "signed-in", email: data.session.user.email } : { status: "signed-out" });
		});
		const { data } = client.auth.onAuthStateChange((_event, session) => {
			setState(session ? { status: "signed-in", email: session.user.email } : { status: "signed-out" });
		});
		return () => data.subscription.unsubscribe();
	}, []);

	const api = useMemo(
		() =>
			createPortfolioClient({
				baseUrl: apiUrl,
				getToken: async () => {
					if (devMode) return DEV_TOKEN;
					const { data } = (await getSupabase()?.auth.getSession()) ?? { data: { session: null } };
					return data.session?.access_token;
				},
			}),
		[],
	);

	if (state.status !== "signed-in") return { status: state.status };
	return {
		status: "signed-in",
		email: state.email ?? "",
		api,
		signOut: async () => {
			await getSupabase()?.auth.signOut();
		},
	};
}
