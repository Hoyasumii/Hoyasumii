import type { Metadata } from "next";
import { getContent } from "@/lib/data";
import { siteIcons } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
	const { seo } = await getContent();
	return { title: "Alan Reis", robots: { index: false }, icons: siteIcons(seo) };
}

export default function RedirectLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="pt-BR">
			<body style={{ background: "#0e0e0d" }}>{children}</body>
		</html>
	);
}
