import { type Locale, locales, type Profile, releaseName } from "@portfolio/shared";
import Link from "next/link";
import { getPushKey, getReleases } from "@/lib/data";
import { type Dictionary, t } from "@/lib/i18n";
import { formatDate } from "./article-list";
import { LocalClock } from "./local-clock";
import { type NewsItem, NewsPanel } from "./news-panel";
import { ThemeToggle } from "./theme-toggle";

/** How many releases the news panel lists; the rest are on the news page. */
const NEWS_LIMIT = 12;

export type NavItem = { id: string; label: string };

type Props = {
	profile: Profile;
	locale: Locale;
	nav: NavItem[];
	d: Dictionary;
	/** Path after the locale, kept when switching language (e.g. "articles/my-post/"). */
	path?: string;
	/** Where the section anchors live; empty on the home page itself. */
	anchorBase?: string;
};

export async function SiteHeader({ profile, locale, nav, d, path = "", anchorBase = "" }: Props) {
	const [releases, pushKey] = await Promise.all([getReleases(), getPushKey()]);
	const news: NewsItem[] = releases.slice(0, NEWS_LIMIT).map((release) => ({
		slug: release.slug,
		name: releaseName(release),
		kind: d[release.kind],
		date: release.publishedAt,
		dateLabel: formatDate(release.publishedAt, locale),
		summary: t(release.summary, locale),
		href: `/${locale}/releases/${release.slug}/`,
	}));

	return (
		<header className="topbar">
			<Link href={`/${locale}/`} className="topbar__brand">
				{profile.handle || profile.name}
			</Link>
			<p className="topbar__where">
				{profile.location} <span aria-hidden="true">·</span> <span className="sr-only">{d.localTime}: </span>
				<LocalClock timeZone={profile.timeZone} />
			</p>
			<nav className="topbar__nav" aria-label={d.index}>
				{nav.map((item) => (
					<a key={item.id} href={`${anchorBase}#${item.id}`}>
						{item.label}
					</a>
				))}
			</nav>
			<div className="topbar__tools">
				{news.length > 0 || pushKey ? (
					<NewsPanel
						items={news}
						locale={locale}
						allHref={`/${locale}/releases/`}
						pushKey={pushKey}
						apiUrl={process.env.NEXT_PUBLIC_API_URL ?? null}
						labels={d}
					/>
				) : null}
				<nav className="lang-switch" aria-label={d.language}>
					{locales.map((code) =>
						code === locale ? (
							<span key={code} className="lang-switch__item is-current" aria-current="true">
								{code.toUpperCase()}
							</span>
						) : (
							<Link
								key={code}
								href={`/${code}/${path}`}
								hrefLang={code}
								lang={code === "pt" ? "pt-BR" : "en"}
								className="lang-switch__item"
								title={d.switchTo}
							>
								{code.toUpperCase()}
							</Link>
						),
					)}
				</nav>
				<ThemeToggle label={d.theme} />
			</div>
		</header>
	);
}
