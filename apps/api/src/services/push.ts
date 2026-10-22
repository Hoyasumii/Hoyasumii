import {
	type Locale,
	locales,
	type PushMessage,
	type PushReport,
	type PushStatus,
	type PushSubscriptionInput,
	type Release,
	releaseName,
} from "@portfolio/shared";
import { HttpError } from "../lib/errors";
import { sendPush, type VapidKeys } from "../push/web-push";
import type { PushRepository, StoredSubscription } from "../repositories/push-repository";
import type { ContentService } from "./content";
import type { ReleasesService } from "./releases";

/** Releases older than this are not announced (e.g. the ones written before push was set up). */
const MAX_AGE_DAYS = 7;
/** Messages in flight at once. */
const CONCURRENCY = 10;

export type PushConfig = {
	vapid: VapidKeys | null;
	/** Public address of the website (with its base path), for the links in notifications. */
	siteUrl: string | null;
};

function daysAgo(days: number, now: Date): string {
	return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function inBatches<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
	for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(work));
}

const disabled = () =>
	new HttpError(503, "push_disabled", "Push notifications are not configured (VAPID keys and PUBLIC_SITE_URL)");

/**
 * Release notifications: browsers subscribe from the site, and after each deploy the workflow asks
 * for the pending releases to be sent. A release is only sent once its page answers, so nobody is
 * sent to a page the deploy has not published yet.
 */
export class PushService {
	constructor(
		private readonly repository: PushRepository,
		private readonly releases: ReleasesService,
		private readonly content: ContentService,
		private readonly config: PushConfig,
		private readonly fetcher: typeof fetch = (...args) => fetch(...args),
	) {}

	get enabled(): boolean {
		return Boolean(this.config.vapid && this.config.siteUrl);
	}

	publicKey(): string | null {
		return this.enabled ? (this.config.vapid?.publicKey ?? null) : null;
	}

	async subscribe(subscription: PushSubscriptionInput): Promise<void> {
		if (!this.enabled) throw disabled();
		await this.repository.subscribe(subscription);
	}

	unsubscribe(endpoint: string): Promise<boolean> {
		return this.repository.unsubscribe(endpoint);
	}

	async status(): Promise<PushStatus> {
		const [subscribers, pending] = await Promise.all([this.repository.count(), this.pending()]);
		return {
			enabled: this.enabled,
			subscribers,
			pending: pending.map((release) => ({ id: release.id, title: releaseName(release), slug: release.slug })),
		};
	}

	/** Sends every pending release whose page is already live. Safe to call again: each goes out once. */
	async send(now = new Date()): Promise<PushReport> {
		const { vapid, siteUrl } = this.config;
		if (!vapid || !siteUrl) throw disabled();

		const report: PushReport = { sent: [], waiting: [], skipped: [], removed: 0 };
		const pending = await this.pending();
		if (pending.length === 0) return report;

		const oldest = daysAgo(MAX_AGE_DAYS, now);
		const subscriptions = await this.repository.list();
		const gone = new Set<string>();
		const { seo } = await this.content.getPublic();

		for (const release of pending) {
			if (release.publishedAt < oldest) {
				await this.repository.markNotified(release.id, 0);
				report.skipped.push(release.slug);
				continue;
			}
			if (!(await this.isLive(siteUrl, release))) {
				report.waiting.push(release.slug);
				continue;
			}

			const messages = Object.fromEntries(
				locales.map((locale) => [locale, JSON.stringify(this.message(siteUrl, release, locale, seo.favicon))]),
			) as Record<Locale, string>;
			let delivered = 0;
			let failed = 0;
			await inBatches(
				subscriptions.filter((subscription) => !gone.has(subscription.id)),
				CONCURRENCY,
				async (subscription: StoredSubscription) => {
					try {
						const response = await sendPush(vapid, subscription, messages[subscription.locale], {}, this.fetcher);
						if (response.ok) delivered++;
						else if (response.status === 404 || response.status === 410) gone.add(subscription.id);
						else {
							failed++;
							console.error(`push to ${new URL(subscription.endpoint).host} failed with ${response.status}`);
						}
					} catch (error) {
						failed++;
						console.error("push failed", error);
					}
				},
			);
			await this.repository.markNotified(release.id, delivered);
			report.sent.push({ id: release.id, slug: release.slug, recipients: delivered, failed });
		}

		if (gone.size > 0) await this.repository.remove([...gone]);
		report.removed = gone.size;
		return report;
	}

	private async pending(): Promise<Release[]> {
		const [releases, notified] = await Promise.all([this.releases.list(), this.repository.notified()]);
		return releases.filter((release) => release.notify && !notified.has(release.id));
	}

	private url(siteUrl: string, release: Release, locale: Locale): string {
		return `${siteUrl}/${locale}/releases/${release.slug}/`;
	}

	private async isLive(siteUrl: string, release: Release): Promise<boolean> {
		try {
			const response = await this.fetcher(this.url(siteUrl, release, "pt"), { method: "HEAD", redirect: "follow" });
			return response.ok;
		} catch {
			return false;
		}
	}

	private message(siteUrl: string, release: Release, locale: Locale, icon: string): PushMessage {
		const other = locale === "pt" ? "en" : "pt";
		return {
			title: releaseName(release),
			body: release.summary[locale] || release.summary[other],
			url: this.url(siteUrl, release, locale),
			tag: `release-${release.slug}`,
			icon: icon || undefined,
		};
	}
}
