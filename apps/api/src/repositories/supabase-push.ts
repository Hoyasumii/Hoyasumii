import type { Locale, PushSubscriptionInput } from "@portfolio/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PushRepository, StoredSubscription } from "./push-repository";
import { describeError } from "./supabase";

type Row = { id: string; endpoint: string; p256dh: string; auth: string; locale: Locale };

function fail(action: string, error: Parameters<typeof describeError>[0]): never {
	throw new Error(`Supabase: could not ${action}: ${describeError(error)}`);
}

/** The `push_subscriptions` and `push_notifications` tables (see supabase/migrations). */
export class SupabasePushRepository implements PushRepository {
	constructor(private readonly client: SupabaseClient) {}

	async subscribe({ endpoint, keys, locale }: PushSubscriptionInput) {
		const { error } = await this.client
			.from("push_subscriptions")
			.upsert({ endpoint, p256dh: keys.p256dh, auth: keys.auth, locale }, { onConflict: "endpoint" });
		if (error) fail("save push subscription", error);
	}

	async unsubscribe(endpoint: string) {
		const { data, error } = await this.client.from("push_subscriptions").delete().eq("endpoint", endpoint).select("id");
		if (error) fail("delete push subscription", error);
		return (data ?? []).length > 0;
	}

	async list() {
		const subscriptions: StoredSubscription[] = [];
		// PostgREST caps each response, so read in pages.
		const page = 1000;
		for (let from = 0; ; from += page) {
			const { data, error } = await this.client
				.from("push_subscriptions")
				.select("id, endpoint, p256dh, auth, locale")
				.order("created_at", { ascending: true })
				.range(from, from + page - 1);
			if (error) fail("list push subscriptions", error);
			const rows = (data ?? []) as Row[];
			for (const row of rows) {
				subscriptions.push({
					id: row.id,
					endpoint: row.endpoint,
					keys: { p256dh: row.p256dh, auth: row.auth },
					locale: row.locale,
				});
			}
			if (rows.length < page) return subscriptions;
		}
	}

	async count() {
		const { count, error } = await this.client.from("push_subscriptions").select("id", { count: "exact", head: true });
		if (error) fail("count push subscriptions", error);
		return count ?? 0;
	}

	async remove(ids: string[]) {
		if (ids.length === 0) return;
		const { error } = await this.client.from("push_subscriptions").delete().in("id", ids);
		if (error) fail("delete push subscriptions", error);
	}

	async notified() {
		const { data, error } = await this.client.from("push_notifications").select("release_id");
		if (error) fail("read sent notifications", error);
		return new Set((data ?? []).map((row) => row.release_id as string));
	}

	async markNotified(releaseId: string, recipients: number) {
		const { error } = await this.client
			.from("push_notifications")
			.upsert({ release_id: releaseId, recipients, sent_at: new Date().toISOString() }, { onConflict: "release_id" });
		if (error) fail("record sent notification", error);
	}
}
