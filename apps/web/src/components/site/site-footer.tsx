import type { Dictionary } from "@/lib/i18n";

// Fixed on purpose: the license is part of the code, not of the panel content.
const LICENSE_URL = "https://github.com/Hoyasumii/Hoyasumii/blob/main/LICENSE";

export function SiteFooter({ name, d }: { name: string; d: Dictionary }) {
	return (
		<footer className="footer">
			<p className="footer__colophon">
				<span className="footer__label">{d.colophon}</span>
				{d.colophonText}
			</p>
			<p className="footer__end">
				<span>
					© {new Date().getFullYear()} {name} ·{" "}
					<a href={LICENSE_URL} rel="license">
						{d.license}
					</a>
				</span>
				<a href="#top">{d.backToTop} ↑</a>
			</p>
		</footer>
	);
}
