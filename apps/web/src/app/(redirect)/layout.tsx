import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Alan Reis",
	robots: { index: false },
};

export default function RedirectLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="pt-BR">
			<body style={{ background: "#0e0e0d" }}>{children}</body>
		</html>
	);
}
