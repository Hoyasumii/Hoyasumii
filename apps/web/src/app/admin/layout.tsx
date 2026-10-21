import type { Metadata } from "next";
import { getContent } from "@/lib/data";
import { fontClasses } from "@/lib/fonts";
import { siteIcons } from "@/lib/seo";
import { themeScript } from "@/lib/theme";
import "../site.css";
import "./admin.css";
import { InlineScript } from "@/components/inline-script";

export async function generateMetadata(): Promise<Metadata> {
	const { seo } = await getContent();
	return { title: "Painel — Alan Reis", robots: { index: false, follow: false }, icons: siteIcons(seo) };
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="pt-BR" className={fontClasses} suppressHydrationWarning>
			<head>
				<InlineScript code={themeScript} />
			</head>
			<body>{children}</body>
		</html>
	);
}
