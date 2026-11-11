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
import { sendPush } from "../push/web-push";
import { getContent, publishedReleases } from "./content";
import { PushNotification, PushSubscriptionRecord } from "./entities";
import { PushDisabled } from "./exceptions";
import { PushNotifications, PushSubscriptions } from "./repositories";
import type { Services } from "./services";

/** Releases older than this are not announced (e.g. the ones written before push was set up). */
const MAX_AGE_DAYS = 7;
/** Messages in flight at once. */
const CONCURRENCY = 10;

/*
 * Release notifications: browsers subscribe from the site, and after each deploy the workflow asks
 * for the pending releases to be sent. A release is only sent once its page answers, so nobody is
 * sent to a page the deploy has not published yet.
 */

export const pushEnabled = (services: Services) => Boolean(services.push.vapid && services.push.siteUrl);

const disabled = (source: string) => new PushDisabled({ source });

export function publicKey(services: Services): string | null {
	return pushEnabled(services) ? (services.push.vapid?.publicKey ?? null) : null;
}

/** Adds a subscription, or updates its keys and language when the endpoint is known. */
export async function subscribe(services: Services, subscription: PushSubscriptionInput): Promise<void> {
	if (!pushEnabled(services)) throw disabled("Subscribe");
	const current = await PushSubscriptions.findByEndpoint(subscription.endpoint);
	if (current) {
		await PushSubscriptions.update(
			new PushSubscriptionRecord({ ...subscription, id: current.id, createdAt: current.createdAt }),
		);
	} else {
		await PushSubscriptions.create(new PushSubscriptionRecord(subscription));
	}
}

/** Returns false when the endpoint was not subscribed. */
export async function unsubscribe(endpoint: string): Promise<boolean> {
	const current = await PushSubscriptions.findByEndpoint(endpoint);
	if (!current) return false;
	await PushSubscriptions.delete(current);
	return true;
}

async function pending(services: Services): Promise<Release[]> {
	const [releases, notified] = await Promise.all([publishedReleases(services), PushNotifications.findMany()]);
	const sent = new Set(notified.map((notification) => notification.id));
	return releases.filter((release) => release.notify && !sent.has(release.id));
}

export async function pushStatus(services: Services): Promise<PushStatus> {
	const [subscribers, releases] = await Promise.all([PushSubscriptions.count(), pending(services)]);
	return {
		enabled: pushEnabled(services),
		subscribers,
		pending: releases.map((release) => ({ id: release.id, title: releaseName(release), slug: release.slug })),
	};
}

function daysAgo(days: number, now: Date): string {
	return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function inBatches<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
	for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(work));
}

const releaseUrl = (siteUrl: string, release: Release, locale: Locale) =>
	`${siteUrl}/${locale}/releases/${release.slug}/`;

async function isLive(services: Services, siteUrl: string, release: Release): Promise<boolean> {
	try {
		const response = await services.fetcher(releaseUrl(siteUrl, release, "pt"), { method: "HEAD", redirect: "follow" });
		return response.ok;
	} catch {
		return false;
	}
}

function message(siteUrl: string, release: Release, locale: Locale, icon: string): PushMessage {
	const other = locale === "pt" ? "en" : "pt";
	return {
		title: releaseName(release),
		body: release.summary[locale] || release.summary[other],
		url: releaseUrl(siteUrl, release, locale),
		tag: `release-${release.slug}`,
		icon: icon || undefined,
	};
}

const markNotified = (releaseId: string, recipients: number) =>
	PushNotifications.create(new PushNotification({ id: releaseId, recipients }));

/** Sends every pending release whose page is already live. Safe to call again: each goes out once. */
export async function sendPending(services: Services, now = new Date()): Promise<PushReport> {
	const { vapid, siteUrl } = services.push;
	if (!vapid || !siteUrl) throw disabled("SendPush");

	const report: PushReport = { sent: [], waiting: [], skipped: [], removed: 0 };
	const releases = await pending(services);
	if (releases.length === 0) return report;

	const oldest = daysAgo(MAX_AGE_DAYS, now);
	const subscriptions = await PushSubscriptions.findMany();
	const gone = new Set<string>();
	const { seo } = await getContent(services);

	for (const release of releases) {
		if (release.publishedAt < oldest) {
			await markNotified(release.id, 0);
			report.skipped.push(release.slug);
			continue;
		}
		if (!(await isLive(services, siteUrl, release))) {
			report.waiting.push(release.slug);
			continue;
		}

		const messages = Object.fromEntries(
			locales.map((locale) => [locale, JSON.stringify(message(siteUrl, release, locale, seo.favicon))]),
		) as Record<Locale, string>;
		let delivered = 0;
		let failed = 0;
		await inBatches(
			subscriptions.filter((subscription) => !gone.has(subscription.id)),
			CONCURRENCY,
			async (subscription) => {
				try {
					const response = await sendPush(vapid, subscription, messages[subscription.locale], {}, services.fetcher);
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
		await markNotified(release.id, delivered);
		report.sent.push({ id: release.id, slug: release.slug, recipients: delivered, failed });
	}

	for (const subscription of subscriptions) {
		if (gone.has(subscription.id)) await PushSubscriptions.delete(subscription);
	}
	report.removed = gone.size;
	return report;
}
