"use client";

import { createPortfolioClient, type Locale } from "@portfolio/shared";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type NewsItem = {
	slug: string;
	name: string;
	kind: string;
	date: string;
	dateLabel: string;
	summary: string;
	href: string;
};

export type NewsLabels = {
	news: string;
	newsTitle: string;
	newsEmpty: string;
	newsUnread: string;
	readMore: string;
	allNews: string;
	close: string;
	notifyOn: string;
	notifyOff: string;
	notifyHint: string;
	notifyEnabled: string;
	notifyBlocked: string;
	notifyUnsupported: string;
	notifyIos: string;
	notifyFailed: string;
};

type Props = {
	items: NewsItem[];
	locale: Locale;
	labels: NewsLabels;
	allHref: string;
	/** VAPID public key; null hides the notification switch. */
	pushKey: string | null;
	apiUrl: string | null;
};

const SEEN_KEY = "news:seen";
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function readSeen(): string | null {
	try {
		return localStorage.getItem(SEEN_KEY);
	} catch {
		return null;
	}
}

function writeSeen(slug: string) {
	try {
		localStorage.setItem(SEEN_KEY, slug);
	} catch {
		// Private mode: the dot just comes back next time.
	}
}

/** The "news" button in the top bar and the dialog with the latest releases. */
export function NewsPanel({ items, locale, labels, allHref, pushKey, apiUrl }: Props) {
	const dialog = useRef<HTMLDialogElement>(null);
	// Unknown until mounted, so the server render and the first client render match.
	const [unread, setUnread] = useState(0);

	useEffect(() => {
		const seen = readSeen();
		const index = seen ? items.findIndex((item) => item.slug === seen) : -1;
		setUnread(index === -1 ? items.length : index);
	}, [items]);

	function open() {
		dialog.current?.showModal();
		if (items[0]) writeSeen(items[0].slug);
		setUnread(0);
	}

	return (
		<>
			<button type="button" className="news-button" onClick={open} aria-haspopup="dialog">
				{labels.news}
				{unread > 0 ? (
					<span className="news-button__dot">
						<span className="sr-only">
							{" "}
							({unread} {labels.newsUnread})
						</span>
					</span>
				) : null}
			</button>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: Esc already closes a modal dialog; the click only catches the backdrop */}
			<dialog
				ref={dialog}
				className="news"
				aria-labelledby="news-title"
				onClick={(event) => {
					if (event.target === event.currentTarget) event.currentTarget.close();
				}}
			>
				<div className="news__inner">
					<header className="news__head">
						<h2 id="news-title">{labels.newsTitle}</h2>
						<button type="button" className="news__close" onClick={() => dialog.current?.close()}>
							{labels.close} ✕
						</button>
					</header>
					{items.length === 0 ? (
						<p className="news__empty">{labels.newsEmpty}</p>
					) : (
						<ol className="news__list">
							{items.map((item) => (
								<li key={item.slug} className="news__item">
									<p className="news__meta">
										<span className="news__kind">{item.kind}</span>
										<time dateTime={item.date}>{item.dateLabel}</time>
									</p>
									<h3 className="news__name">
										<Link href={item.href}>{item.name}</Link>
									</h3>
									{item.summary ? <p className="news__summary">{item.summary}</p> : null}
									<Link className="news__more" href={item.href} tabIndex={-1}>
										{labels.readMore} →
									</Link>
								</li>
							))}
						</ol>
					)}
					<footer className="news__foot">
						{pushKey && apiUrl ? (
							<PushSwitch pushKey={pushKey} apiUrl={apiUrl} locale={locale} labels={labels} />
						) : null}
						<Link className="news__all" href={allHref}>
							{labels.allNews} →
						</Link>
					</footer>
				</div>
			</dialog>
		</>
	);
}

type PushState = "loading" | "unsupported" | "ios" | "blocked" | "off" | "on";

function isIos(): boolean {
	return (
		/iP(hone|ad|od)/.test(navigator.userAgent) ||
		(/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
	);
}

function decodeKey(key: string): Uint8Array<ArrayBuffer> {
	const base64 = key.replace(/-/g, "+").replace(/_/g, "/");
	const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
	return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function currentSubscription(): Promise<PushSubscription | null> {
	const registration = await navigator.serviceWorker.getRegistration(`${base}/`);
	return (await registration?.pushManager.getSubscription()) ?? null;
}

/** Subscribes this browser to release notifications (Web Push), or stops them. */
function PushSwitch({
	pushKey,
	apiUrl,
	locale,
	labels,
}: {
	pushKey: string;
	apiUrl: string;
	locale: Locale;
	labels: NewsLabels;
}) {
	const [state, setState] = useState<PushState>("loading");
	const [busy, setBusy] = useState(false);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
			// iOS only offers push to sites added to the Home Screen.
			setState(isIos() ? "ios" : "unsupported");
			return;
		}
		if (Notification.permission === "denied") {
			setState("blocked");
			return;
		}
		currentSubscription()
			.then((subscription) => setState(subscription && Notification.permission === "granted" ? "on" : "off"))
			.catch(() => setState("off"));
	}, []);

	const api = () => createPortfolioClient({ baseUrl: apiUrl });

	async function enable() {
		setBusy(true);
		setFailed(false);
		try {
			const permission = await Notification.requestPermission();
			if (permission !== "granted") {
				setState(permission === "denied" ? "blocked" : "off");
				return;
			}
			const registration = await navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` });
			await navigator.serviceWorker.ready;
			const subscription =
				(await registration.pushManager.getSubscription()) ??
				(await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeKey(pushKey) }));
			const { endpoint, keys } = subscription.toJSON();
			if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error("Incomplete push subscription");
			await api().subscribePush({ endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth }, locale });
			setState("on");
		} catch (error) {
			console.error("could not enable notifications", error);
			setFailed(true);
		} finally {
			setBusy(false);
		}
	}

	async function disable() {
		setBusy(true);
		try {
			const subscription = await currentSubscription();
			if (subscription) {
				await subscription.unsubscribe();
				await api()
					.unsubscribePush(subscription.endpoint)
					.catch(() => {});
			}
			setState("off");
		} finally {
			setBusy(false);
		}
	}

	if (state === "loading") return null;
	if (state === "unsupported" || state === "ios" || state === "blocked") {
		const text = { unsupported: labels.notifyUnsupported, ios: labels.notifyIos, blocked: labels.notifyBlocked }[state];
		return <p className="news__push-note">{text}</p>;
	}

	return (
		<div className="news__push">
			<button
				type="button"
				className={`news__push-button${state === "on" ? " is-on" : ""}`}
				disabled={busy}
				aria-pressed={state === "on"}
				onClick={state === "on" ? disable : enable}
			>
				{state === "on" ? labels.notifyOff : labels.notifyOn}
			</button>
			<p className="news__push-note" role="status">
				{failed ? labels.notifyFailed : state === "on" ? labels.notifyEnabled : labels.notifyHint}
			</p>
		</div>
	);
}
