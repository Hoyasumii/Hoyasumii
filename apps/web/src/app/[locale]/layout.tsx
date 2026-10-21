import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getContent } from "@/lib/data";
import { fontClasses } from "@/lib/fonts";
import { isLocale, locales, t } from "@/lib/i18n";
import { themeScript } from "@/lib/theme";
import "../site.css";
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

	return {
		metadataBase: new URL(siteUrl),
		title: seo.title,
		description: t(seo.description, locale),
		alternates: {
			canonical: `/${locale}`,
			languages: { "pt-BR": "/pt", en: "/en" },
		},
		openGraph: {
			title: seo.title,
			description: t(seo.description, locale),
			url: `/${locale}`,
			siteName: profile.name,
			locale: locale === "pt" ? "pt_BR" : "en_US",
			type: "website",
		},
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

	return (
		<html lang={locale === "pt" ? "pt-BR" : "en"} className={fontClasses} suppressHydrationWarning>
			<head>
				<InlineScript code={themeScript} />
			</head>
			<body>{children}</body>
		</html>
	);
}
