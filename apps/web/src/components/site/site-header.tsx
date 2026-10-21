import { type Locale, locales, type Profile } from "@portfolio/shared";
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
