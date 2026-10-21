import type { Dictionary } from "@/lib/i18n";

export function SiteFooter({ name, d }: { name: string; d: Dictionary }) {
	return (
		<footer className="footer">
			<p className="footer__colophon">
				<span className="footer__label">{d.colophon}</span>
				{d.colophonText}
			</p>
			<p className="footer__end">
				© {new Date().getFullYear()} {name}
				<a href="#top">{d.backToTop} ↑</a>
			</p>
		</footer>
	);
}
