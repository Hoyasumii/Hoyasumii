import type { MetadataRoute } from "next";
import { getContent } from "@/lib/data";

export const dynamic = "force-static";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Lets the site be added to the Home Screen, which iOS requires before it allows notifications. */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
	const { seo, profile } = await getContent();
	const icon = seo.favicon || `${base}/favicon.ico`;
	return {
		name: seo.title || profile.name,
		short_name: profile.handle || profile.name,
		start_url: `${base}/`,
		scope: `${base}/`,
		display: "standalone",
		background_color: "#0e0e0d",
		theme_color: "#0e0e0d",
		icons: [{ src: icon, sizes: "any" }],
	};
}
