import type { Locale, Profile } from "@portfolio/shared";
import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";
import { LocalClock } from "./local-clock";
import { ThemeToggle } from "./theme-toggle";

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

export function SiteHeader({ profile, locale, nav, d, path = "", anchorBase = "" }: Props) {
	const otherLocale: Locale = locale === "pt" ? "en" : "pt";

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
				<Link href={`/${otherLocale}/${path}`} hrefLang={otherLocale} className="topbar__lang" title={d.switchTo}>
					{otherLocale.toUpperCase()}
				</Link>
				<ThemeToggle label={d.theme} />
			</div>
		</header>
	);
}
