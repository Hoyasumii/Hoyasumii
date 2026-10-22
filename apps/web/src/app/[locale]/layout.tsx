import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getContent } from "@/lib/data";
import { fontClasses } from "@/lib/fonts";
import { isLocale, locales, t } from "@/lib/i18n";
import { shareImages, siteIcons, twitterCard } from "@/lib/seo";
import { themeScript } from "@/lib/theme";
import "../site.css";
import { AccentStyle } from "@/components/accent-style";
import { InlineScript } from "@/components/inline-script";

export const dynamicParams = false;

export function generateStaticParams() {
	return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
	const { locale } = await params;
	if (!isLocale(locale)) return {};
	const { seo, profile } = await getContent();
	const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
	const description = t(seo.description, locale);

	return {
		metadataBase: new URL(siteUrl),
		title: seo.title,
		description,
		keywords: seo.keywords.length > 0 ? seo.keywords : undefined,
		authors: [{ name: profile.name, url: siteUrl }],
		creator: profile.name,
		icons: siteIcons(seo),
		manifest: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/manifest.webmanifest`,
		alternates: {
			canonical: `/${locale}`,
			languages: { "pt-BR": "/pt", en: "/en" },
		},
		openGraph: {
			title: seo.title,
			description,
			url: `/${locale}`,
			siteName: profile.name,
			locale: locale === "pt" ? "pt_BR" : "en_US",
			alternateLocale: locale === "pt" ? "en_US" : "pt_BR",
			type: "website",
			images: shareImages(seo),
		},
		twitter: twitterCard(seo, { title: seo.title, description }),
	};
}

export const viewport: Viewport = {
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#ebe9e3" },
		{ media: "(prefers-color-scheme: dark)", color: "#0e0e0d" },
	],
};

export default async function LocaleLayout({
	children,
	params,
}: {
	children: React.ReactNode;
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	if (!isLocale(locale)) notFound();
	const { appearance } = await getContent();

	return (
		<html lang={locale === "pt" ? "pt-BR" : "en"} className={fontClasses} suppressHydrationWarning>
			<head>
				<InlineScript code={themeScript} />
				<AccentStyle accent={appearance.accent} />
			</head>
			<body>{children}</body>
		</html>
	);
}
