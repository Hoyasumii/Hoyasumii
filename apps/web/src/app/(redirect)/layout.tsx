import type { Metadata } from "next";
import { getContent } from "@/lib/data";
import { shareImages, siteIcons, twitterCard } from "@/lib/seo";

/**
 * Link previews (WhatsApp, LinkedIn, X…) read this page as is: they never run the redirect
 * script, so it carries the same share tags as /pt/, the page the noscript fallback goes to.
 */
export async function generateMetadata(): Promise<Metadata> {
	const { seo, profile } = await getContent();
	const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
	const description = seo.description.pt;

	return {
		metadataBase: new URL(siteUrl),
		title: seo.title,
		description,
		robots: { index: false },
		icons: siteIcons(seo),
		alternates: { canonical: "/pt" },
		openGraph: {
			title: seo.title,
			description,
			url: "/",
			siteName: profile.name,
			locale: "pt_BR",
			alternateLocale: "en_US",
			type: "website",
			images: shareImages(seo),
		},
		twitter: twitterCard(seo, { title: seo.title, description }),
	};
}

export default function RedirectLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="pt-BR">
			<body style={{ background: "#0e0e0d" }}>{children}</body>
		</html>
	);
}
