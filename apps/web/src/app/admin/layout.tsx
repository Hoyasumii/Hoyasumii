import type { Metadata } from "next";
import { fontClasses } from "@/lib/fonts";
import { themeScript } from "@/lib/theme";
import "../site.css";
import "./admin.css";
import { InlineScript } from "@/components/inline-script";

export const metadata: Metadata = {
	title: "Painel — Alan Reis",
	robots: { index: false, follow: false },
};

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
