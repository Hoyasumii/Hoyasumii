import type { Metadata } from "next";
import { getContent } from "@/lib/data";
import { fontClasses } from "@/lib/fonts";
import { siteIcons } from "@/lib/seo";
import { themeScript } from "@/lib/theme";
import "./site.css";
import { InlineScript } from "@/components/inline-script";
import { ThemeSync } from "@/components/theme-sync";

export async function generateMetadata(): Promise<Metadata> {
	const { seo } = await getContent();
	return { title: "404 — Alan Reis", robots: { index: false }, icons: siteIcons(seo) };
}

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** GitHub Pages serves this as 404.html for every unknown address. */
export default function GlobalNotFound() {
	return (
		<html lang="pt-BR" className={fontClasses} data-scroll-behavior="smooth" suppressHydrationWarning>
			<head>
				<InlineScript code={themeScript} />
			</head>
			<body>
				<ThemeSync />
				<main className="lost">
					<p className="lost__code">404</p>
					<p className="lede">
						Página não encontrada. <span lang="en">Page not found.</span>
					</p>
					<p>
						<a href={`${base}/pt/`}>Início</a> · <a href={`${base}/en/`}>Home</a>
					</p>
				</main>
			</body>
		</html>
	);
}
